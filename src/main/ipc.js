'use strict';
const fs = require('fs');
const path = require('path');
const { app, ipcMain, shell, dialog, nativeImage, net } = require('electron');
const { SITE_HOSTS, BUNDLED_THEMES_DIR } = require('./constants');
const { safeName } = require('./themes');
const { buildBundle } = require('./bundle');
const { pickFiles } = require('./filepick');
const { fetchImage } = require('./imagefetch');
const log = require('./log');

function isHttpUrl(u) {
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:' || p === 'mailto:';
  } catch (_) {
    return false;
  }
}

function registerIpc(ctx) {
  const { getWindow, settings, themes, netfilter, dataDir } = ctx;

  function trusted(event) {
    const win = getWindow();
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return false;
    try {
      const u = new URL(event.senderFrame ? event.senderFrame.url : event.sender.getURL());
      return u.protocol === 'https:' && SITE_HOSTS.includes(u.hostname);
    } catch (_) {
      return false;
    }
  }

  const handle = (channel, fn) =>
    ipcMain.handle(channel, async (event, ...args) => {
      if (!trusted(event)) throw new Error('untrusted sender');
      try {
        return await fn(event, ...args);
      } catch (err) {
        log.error('ipc ' + channel + ' failed:', err);
        throw err;
      }
    });

  const initialState = () => ({
    settings: settings.get(),
    quickCss: settings.readQuickCss(),
    themes: themes.list(),
    themeCss: Object.fromEntries(
      (settings.get().enabledThemes || []).map((f) => [f, themes.read(f)]).filter(([, css]) => css),
    ),
    app: appInfo(),
  });

  function appInfo() {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      dataDir,
      settingsDir: settings.dir,
      themesDir: themes.dir,
      logFile: log.file,
      mode: ctx.mode || 'standalone',
    };
  }

  ipcMain.on('ym:get-bundle', (event) => {
    if (!trusted(event)) {
      event.returnValue = '';
      return;
    }
    try {
      event.returnValue = buildBundle(initialState());
    } catch (err) {
      log.error('bundle build failed:', err);
      event.returnValue = '';
    }
  });

  handle('ym:settings:get', () => settings.get());
  handle('ym:settings:patch', (_e, partial) => {
    settings.patch(partial);
    ctx.applyWindowSettings();
  });
  handle('ym:settings:set', (_e, dotted, value) => {
    settings.setPath(dotted, value);
    ctx.applyWindowSettings();
  });

  handle('ym:quickcss:get', () => settings.readQuickCss());
  handle('ym:quickcss:set', (_e, css) => settings.writeQuickCss(css));

  handle('ym:themes:list', () => themes.list());
  handle('ym:themes:read', (_e, fileName) => themes.read(fileName));
  handle('ym:themes:remove', (_e, fileName) => themes.remove(fileName));
  handle('ym:themes:import', async () => {
    const win = getWindow();
    const res = await dialog.showOpenDialog(win, {
      title: 'Add a theme',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSS themes', extensions: ['css'] }],
    });
    if (res.canceled) return [];
    const added = [];
    for (const f of res.filePaths) {
      try {
        const name = themes.importFile(f);
        if (name) added.push(name);
      } catch (err) {
        log.error('theme import failed:', err);
      }
    }
    return added;
  });
  handle('ym:themes:export', async (_e, fileName) => {
    const safe = safeName(fileName);
    if (!safe) return false;
    const css = themes.read(safe);
    if (!css) return false;
    const win = getWindow();
    const res = await dialog.showSaveDialog(win, {
      title: 'Share theme',
      defaultPath: safe,
      filters: [{ name: 'CSS themes', extensions: ['css'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, css, 'utf8');
    return true;
  });

  handle('ym:files:pick', async (_e, opts) => {
    const o = opts && typeof opts === 'object' ? opts : {};
    return pickFiles({ dialog, win: getWindow() }, { accept: typeof o.accept === 'string' ? o.accept.slice(0, 2000) : '', multiple: !!o.multiple });
  });

  handle('ym:net:image', (_e, url) => fetchImage({ net }, url));

  handle('ym:open-external', (_e, url) => {
    if (!isHttpUrl(url)) throw new Error('blocked url');
    return shell.openExternal(url);
  });

  handle('ym:open-path', async (_e, which) => {
    const map = { data: dataDir, themes: themes.dir, settings: settings.dir, logs: path.join(dataDir, 'logs') };
    const target = typeof which === 'string' && Object.prototype.hasOwnProperty.call(map, which) ? map[which] : null;
    if (!target) throw new Error('unknown path');
    fs.mkdirSync(target, { recursive: true });
    const err = await shell.openPath(target);
    return err || '';
  });

  handle('ym:app:info', () => ({ ...appInfo(), netfilter: netfilter.stats() }));
  handle('ym:app:relaunch', () => {
    settings.flush();
    app.relaunch();
    app.exit(0);
  });
  handle('ym:app:reload', (event) => event.sender.reloadIgnoringCache());
  handle('ym:app:devtools', (event) => {
    if (settings.get().window.devTools === false) return false;
    event.sender.toggleDevTools();
    return true;
  });
  handle('ym:app:quit', () => {
    app.quit();
  });

  handle('ym:badge', (_e, count, overlayDataUrl) => {
    const n = Math.max(0, Math.min(9999, Number(count) || 0));
    try {
      app.setBadgeCount(n);
    } catch (_) {

    }
    const win = getWindow();
    if (win && process.platform === 'win32') {
      try {
        if (n > 0 && typeof overlayDataUrl === 'string' && overlayDataUrl.startsWith('data:image/png')) {
          win.setOverlayIcon(nativeImage.createFromDataURL(overlayDataUrl), n + ' unread');
        } else {
          win.setOverlayIcon(null, '');
        }
      } catch (_) {

      }
    }
  });

  handle('ym:backup:export', async () => {
    const win = getWindow();
    const themeFiles = {};
    for (const t of themes.list()) themeFiles[t.fileName] = themes.read(t.fileName);
    const payload = {
      format: 'yapcord-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      settings: settings.get(),
      quickCss: settings.readQuickCss(),
      themes: themeFiles,
    };
    const res = await dialog.showSaveDialog(win, {
      title: 'Export YapCord settings',
      defaultPath: 'yapcord-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  });

  handle('ym:backup:import', async () => {
    const win = getWindow();
    const res = await dialog.showOpenDialog(win, {
      title: 'Import YapCord settings',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
    let data;
    try {
      data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
    } catch (_) {
      return { ok: false, reason: 'That file is not valid JSON.' };
    }
    if (!data || !['yapcord-backup', 'yappermod-backup'].includes(data.format) || typeof data.settings !== 'object') {
      return { ok: false, reason: 'That is not a YapCord backup.' };
    }
    settings.replace(data.settings);
    settings.flush();
    if (typeof data.quickCss === 'string') settings.writeQuickCss(data.quickCss);
    if (data.themes && typeof data.themes === 'object') {
      for (const [name, css] of Object.entries(data.themes)) {
        const safe = safeName(name);
        if (safe && typeof css === 'string') {
          try {
            fs.writeFileSync(path.join(themes.dir, safe), css, 'utf8');
          } catch (_) {

          }
        }
      }
    }
    ctx.applyWindowSettings();
    return { ok: true };
  });

  if (ctx.updater) {
    handle('ym:updater:state', () => ctx.updater.getState());
    handle('ym:updater:check', () => ctx.updater.check());
    handle('ym:updater:install', async () => {
      try {
        return await ctx.updater.install();
      } catch (err) {
        return { ...ctx.updater.getState(), phase: 'error', error: (err && err.message) || String(err) };
      }
    });
  }

  handle('ym:ui:zoom', (event, percent) => {
    const n = Number(percent);
    const f = Math.min(2, Math.max(0.5, Number.isFinite(n) ? n / 100 : 1));
    event.sender.setZoomFactor(f);
    return f;
  });

  handle('ym:icon:state', () => (ctx.appIcon ? { has: ctx.appIcon.has(), preview: ctx.appIcon.previewDataUrl() } : { has: false, preview: '' }));
  handle('ym:icon:set', (_e, dataUrl) => {
    if (!ctx.appIcon) throw new Error('not available');
    ctx.appIcon.set(dataUrl);
    return true;
  });
  handle('ym:icon:clear', () => {
    if (ctx.appIcon) ctx.appIcon.clear();
    return true;
  });

  handle('ym:diag:save', async (_e, text) => {
    const win = getWindow();
    const res = await dialog.showSaveDialog(win, {
      title: 'Save diagnostics',
      defaultPath: 'yapcord-diagnostics.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, String(text || ''), 'utf8');
    return true;
  });

  return { initialState, appInfo };
}

module.exports = { registerIpc, isHttpUrl, BUNDLED_THEMES_DIR };
