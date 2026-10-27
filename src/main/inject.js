'use strict';

const fs = require('fs');
const path = require('path');
const { app, session, shell, nativeImage, net } = require('electron');

const C = require('./constants');
const log = require('./log');
const { SettingsStore } = require('./settings');
const { ThemeManager } = require('./themes');
const { NetFilter } = require('./netfilter');
const { registerIpc } = require('./ipc');
const { attachContextMenu } = require('./contextmenu');
const { resolveDataDir } = require('./datadir');
const { AppIcon } = require('./appicon');
const { installTrayPatch } = require('./trayicon');
const { Updater, defaultRepoForPlatform } = require('./updater');

function addPreload(ses, file) {
  if (typeof ses.registerPreloadScript === 'function') {
    ses.registerPreloadScript({ type: 'frame', filePath: file });
    return 'registerPreloadScript';
  }
  if (typeof ses.setPreloads === 'function') {
    ses.setPreloads([...(typeof ses.getPreloads === 'function' ? ses.getPreloads() : []), file]);
    return 'setPreloads';
  }
  throw new Error('this Electron version cannot add preload scripts');
}

function install() {
  const dataLocation = resolveDataDir(app.getPath('appData'));
  const dataDir = dataLocation.dir;
  const settings = new SettingsStore(path.join(dataDir, 'settings'));
  settings.load();

  if (settings.get().window.skipProxyDetection !== false) app.commandLine.appendSwitch('no-proxy-server');
  const themes = new ThemeManager(path.join(dataDir, 'themes'));
  const netfilter = new NetFilter();

  let yapperIcon;
  const appIcon = new AppIcon({
    dir: path.join(dataDir, 'icons'),
    nativeImage,
    isEnabled: () => !!((settings.get().plugins || {}).CustomIcons || {}).enabled,
    originalWindow: () => {
      if (yapperIcon === undefined) {
        try { yapperIcon = nativeImage.createFromBuffer(fs.readFileSync(path.join(process.resourcesPath, '_app.asar', 'build', 'icon.png'))); } catch (_) { yapperIcon = null; }
        if (yapperIcon && yapperIcon.isEmpty()) yapperIcon = null;
      }
      return yapperIcon;
    },
    log,
  });

  installTrayPatch({ icon: appIcon, log });

  let ownPkg = {};
  try { ownPkg = require('../../package.json'); } catch (_) {  }
  const updater = new Updater({
    currentVersion: ownPkg.version || '0.0.0',
    mode: 'official',
    runtimeDir: path.join(app.getPath('appData'), 'YapCord', 'runtime'),
    getRepo: () => (settings.get().updater || {}).repo || defaultRepoForPlatform(ownPkg, process.platform),
    fetch: (url, init) => net.fetch(url, init),
    log,
  });

  let mainWin = null;
  const getWindow = () => (mainWin && !mainWin.isDestroyed() ? mainWin : null);
  const send = (channel, ...args) => {
    const w = getWindow();
    if (w) w.webContents.send(channel, ...args);
  };
  const openExternalSafe = (url) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url).catch(() => undefined);
  };

  const applyWindowSettings = () => {
    const s = settings.get();
    netfilter.enabled = !(s.plugins && s.plugins.NoTrack && s.plugins.NoTrack.enabled === false);
    appIcon.refresh();
  };

  app.on('browser-window-created', (_e, win) => {
    if (getWindow()) return;
    mainWin = win;
    win.on('closed', () => {
      if (mainWin === win) mainWin = null;
    });
    attachContextMenu(win.webContents, { getWindow, settings, openExternal: openExternalSafe });
    appIcon.attachWindow(win);
  });

  process.on('uncaughtException', (err) => log.error('uncaughtException:', err));
  process.on('unhandledRejection', (err) => log.error('unhandledRejection:', err));
  app.on('before-quit', () => settings.flush());

  app.whenReady().then(() => {
    log.init(path.join(dataDir, 'logs'));
    let own = '';
    try { own = require('../../package.json').version; } catch (_) {  }
    log.info('YapCord ' + own + ' running inside Yapper ' + app.getVersion() + ' (electron ' + process.versions.electron + ')');
    themes.ensureDir(C.BUNDLED_THEMES_DIR);
    const ses = session.defaultSession;
    netfilter.install(ses);
    applyWindowSettings();
    registerIpc({ getWindow, settings, themes, netfilter, dataDir, applyWindowSettings, mode: 'official', appIcon, updater });
    const how = addPreload(ses, C.PRELOAD);
    log.info('preload added with ' + how);

    updater.on('state', (st) => send('ym:updater-state', st));
    updater.start(() => settings.get().updater);
    app.on('before-quit', () => updater.stop());

    themes.watch(() => send('ym:themes-changed', themes.list()));
    try {
      let t = null;
      fs.watch(settings.dir, { persistent: false }, (_ev, fileName) => {
        if (fileName && fileName !== 'quickCss.css') return;
        clearTimeout(t);
        t = setTimeout(() => send('ym:quickcss-changed', settings.readQuickCss()), 200);
      });
    } catch (_) {

    }
  });
}

module.exports = { install, addPreload };
