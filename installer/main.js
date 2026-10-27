'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const core = require('./core');

const payload = core.payloadDir(process.resourcesPath);
const info = payload ? core.payloadInfo(payload) : { version: '', repo: '' };
const picked = [];
let win = null;

const ownWindow = (e) => !!win && !win.isDestroyed() && e.sender === win.webContents;
const guard = (fn) => (e, ...args) => {
  if (!ownWindow(e)) throw new Error('untrusted sender');
  return fn(e, ...args);
};
const errText = (err) => (err && err.message) || String(err);

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 900, height: 660, minWidth: 720, minHeight: 560, backgroundColor: '#1e262e', title: 'YapCord Installer', autoHideMenuBar: true,
    icon: [path.join(__dirname, 'icon.png'), path.join(__dirname, '..', 'build', 'icon.png')].find((f) => require('fs').existsSync(f)),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('installer:info', guard(() => ({
  version: info.version, repo: info.repo, payloadOk: !!payload,
  installs: core.scan({ extra: picked }),
})));

ipcMain.handle('installer:choose', guard(async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose the Yapper folder (where Yapper.exe is)', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  try {
    const found = core.check(r.filePaths[0]);
    if (!picked.some((p) => p.toLowerCase() === found.dir.toLowerCase())) picked.push(found.dir);
    return { ok: true, install: found };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}));

ipcMain.handle('installer:run', guard((e, action, dir) => {
  if (typeof action !== 'string' || typeof dir !== 'string') return { ok: false, lines: [], error: 'Invalid request.' };
  const res = core.perform(action, dir, { payload, log: (line) => { if (!e.sender.isDestroyed()) e.sender.send('installer:log', line); } });
  let install = null;
  try { install = core.describe(core.patch.findInstallDir(dir, {})); } catch (_) {  }
  return { ...res, install };
}));

ipcMain.handle('installer:launch', guard((e, dir) => {
  try { core.launch(String(dir)); return { ok: true }; } catch (err) { return { ok: false, error: errText(err) }; }
}));

ipcMain.handle('installer:home', guard(() => {
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(info.repo)) shell.openExternal('https://github.com/' + info.repo);
}));

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
