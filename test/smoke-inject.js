'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { EventEmitter } = require('events');

const ROOT = path.join(__dirname, '..');
const patch = require(path.join(ROOT, 'tools', 'yapper-patch.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yapcord-inject-'));

const captured = [];
const realLog = console.log, realErr = console.error, realWarn = console.warn;
console.log = console.error = console.warn = (...a) => captured.push(a.join(' '));
const out = (s) => process.stdout.write(s + '\n');

function makeAsar(files) {
  const header = { files: {} };
  const chunks = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    header.files[name] = { size: data.length, offset: String(offset) };
    chunks.push(data);
    offset += data.length;
  }
  const json = Buffer.from(JSON.stringify(header));
  const pad = (4 - (json.length % 4)) % 4;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(8 + json.length + pad, 4);
  head.writeUInt32LE(4 + json.length + pad, 8);
  head.writeUInt32LE(json.length, 12);
  return Buffer.concat([head, json, Buffer.alloc(pad), ...chunks]);
}
const YAPPER_PKG = { name: 'yapper-desktop', productName: 'Yapper', version: '1.0.0', description: 'Yapper for Windows', main: 'main.js', private: true, author: 'Yapper', dependencies: { 'electron-updater': '^6.6.2' } };
const ASAR = makeAsar({ 'package.json': JSON.stringify(YAPPER_PKG), 'main.js': "module.exports = 'yapper main';" });
function fuseExe(fuses) {
  const wire = Buffer.from('1' + String.fromCharCode(fuses.length) + fuses, 'binary');
  return Buffer.concat([Buffer.alloc(5000, 7), Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, fuses.length]), Buffer.from(fuses), Buffer.alloc(100)]);
}
let n = 0;
function fakeYapper({ fuses = '000000' } = {}) {
  const dir = path.join(tmp, 'Local', 'Programs', 'yapper-desktop' + n++);
  fs.mkdirSync(path.join(dir, 'resources'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'resources', 'app.asar'), ASAR);
  fs.writeFileSync(path.join(dir, 'resources', 'app-update.yml'), 'owner: x\n');
  fs.writeFileSync(path.join(dir, 'resources', 'elevate.exe'), 'x');
  fs.writeFileSync(path.join(dir, 'Yapper.exe'), fuseExe(fuses));
  fs.writeFileSync(path.join(dir, 'Uninstall Yapper.exe'), 'x'.repeat(10));
  return dir;
}
const appData = path.join(tmp, 'Roaming');
fs.mkdirSync(appData, { recursive: true });
const opts = (installDir) => ({ installDir, sourceRoot: ROOT, appData });

const rec = { order: [], preloads: [], setNames: 0, setPaths: [], loginItems: 0, locks: 0, menus: 0, switches: [] };
const ipcHandlers = new Map();
const ipcListeners = new Map();
class FakeWC extends EventEmitter {
  constructor() { super(); this.url = 'https://www.yapper.website/'; this.sent = []; }
  getURL() { return this.url; }
  send(...a) { this.sent.push(a); }
  replaceMisspelling() {}
}
class FakeWin extends EventEmitter {
  constructor() { super(); this.webContents = new FakeWC(); }
  isDestroyed() { return false; }
  setIcon(img) { this.icon = img; }
}
const appMock = Object.assign(new EventEmitter(), {
  getPath: (k) => (k === 'appData' ? appData : path.join(tmp, k)),
  getVersion: () => '1.0.0',
  setName() { rec.setNames++; },
  setPath(k, v) { rec.setPaths.push([k, v]); },
  setLoginItemSettings() { rec.loginItems++; },
  requestSingleInstanceLock() { rec.locks++; return true; },
  whenReady: () => Promise.resolve(),
  relaunch() { rec.relaunch = (rec.relaunch || 0) + 1; },
  exit() {},
  quit() {},
  commandLine: { appendSwitch(...a) { rec.switches.push(a.join('=')); } },
});
let sessionApi = 'register';
const ses = {
  webRequest: { onBeforeRequest() {}, onHeadersReceived() {} },
  getPreloads: () => ['existing.js'],
};
function setSessionApi(kind) {
  delete ses.registerPreloadScript;
  delete ses.setPreloads;
  if (kind === 'register') ses.registerPreloadScript = (o) => rec.preloads.push(['register', o]);
  else ses.setPreloads = (list) => rec.preloads.push(['set', list]);
}
const electronMock = {
  app: appMock,
  session: { defaultSession: ses },
  shell: { openExternal: () => Promise.resolve(), openPath: () => Promise.resolve('') },
  ipcMain: {
    handle: (ch, fn) => ipcHandlers.set(ch, fn),
    on: (ch, fn) => ipcListeners.set(ch, fn),
    removeListener() {},
  },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showSaveDialog: async () => ({ canceled: true }) },
  nativeImage: { createFromDataURL: () => ({}) },
  net: { fetch: async () => { throw new Error('no network'); } },
  Menu: { buildFromTemplate: (t) => ({ template: t, popup() { rec.menus++; } }), setApplicationMenu() {} },
  clipboard: { writeText() {} },
  BrowserWindow: FakeWin,
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return electronMock;
  if (request === 'original-fs') return fs;
  return origLoad.apply(this, arguments);
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rejects = (fn, re) => {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, 'expected an error');
  if (re) assert(re.test(err.message), 'unexpected error: ' + err.message);
};

test('readAsarFile reads a file out of a real .asar; unknown files give null', () => {
  const f = path.join(tmp, 'x.asar');
  fs.writeFileSync(f, ASAR);
  assert.deepStrictEqual(JSON.parse(patch.readAsarFile(f, 'package.json').toString()), YAPPER_PKG);
  assert.strictEqual(patch.readAsarFile(f, 'nope.js'), null);
  fs.writeFileSync(f, Buffer.alloc(40));
  rejects(() => patch.readAsarFile(f, 'package.json'), /not a valid \.asar/);
});

test('readFuses finds the Electron fuse block; "on" for the two fuses that would block the stub', () => {
  const f = path.join(tmp, 'f.exe');
  fs.writeFileSync(f, fuseExe('010001'));
  assert.deepStrictEqual(patch.readFuses(f), { RunAsNode: 'off', EnableCookieEncryption: 'on', EnableNodeOptionsEnvironmentVariable: 'off', EnableNodeCliInspectArguments: 'off', EnableEmbeddedAsarIntegrityValidation: 'off', OnlyLoadAppFromAsar: 'on' });
  fs.writeFileSync(f, Buffer.alloc(3000));
  assert.strictEqual(patch.readFuses(f), null);
});

test('findInstallDir: the usual place, an explicit folder, and a clear message when nothing is found', () => {
  const dir = fakeYapper();
  assert.strictEqual(patch.findInstallDir(dir, {}), dir);
  const local = path.join(tmp, 'LocalOnly');
  fs.mkdirSync(path.join(local, 'Programs', 'yapper-desktop', 'resources'), { recursive: true });
  fs.writeFileSync(path.join(local, 'Programs', 'yapper-desktop', 'resources', 'app.asar'), ASAR);
  assert.strictEqual(patch.findInstallDir('', { LOCALAPPDATA: local }), path.join(local, 'Programs', 'yapper-desktop'));
  rejects(() => patch.findInstallDir('', { LOCALAPPDATA: path.join(tmp, 'empty') }), /Could not find the Yapper app/);
  rejects(() => patch.findInstallDir(path.join(tmp, 'nope'), {}), /no resources.app\.asar/);
});

test('install: original kept as _app.asar, stub with Yapper\'s own name and version, runtime copied; nothing else changed', () => {
  const dir = fakeYapper();
  const lines = [];
  patch.install({ ...opts(dir), log: (s) => lines.push(s) });
  const res = path.join(dir, 'resources');
  assert.ok(!fs.existsSync(path.join(res, 'app.asar')));
  assert.ok(fs.readFileSync(path.join(res, '_app.asar')).equals(ASAR), 'the original file is byte for byte the same');
  const pkg = JSON.parse(fs.readFileSync(path.join(res, 'app', 'package.json'), 'utf8'));
  assert.deepStrictEqual([pkg.name, pkg.productName, pkg.version, pkg.main, pkg[patch.MARK]], ['yapper-desktop', 'Yapper', '1.0.0', 'index.js', true]);
  assert.ok(!('dependencies' in pkg), 'no dependencies copied');
  const stub = fs.readFileSync(path.join(res, 'app', 'index.js'), 'utf8');
  assert.ok(/inject\.js/.test(stub) && /_app\.asar/.test(stub));
  for (const f of ['src/main/inject.js', 'src/preload/index.js', 'src/renderer/000-boot.js', 'themes/Amoled.theme.css', 'package.json']) {
    assert.ok(fs.existsSync(path.join(appData, 'YapCord', 'runtime', f)), f);
  }
  assert.ok(fs.existsSync(path.join(res, 'app-update.yml')) && fs.existsSync(path.join(res, 'elevate.exe')));
  assert.ok(fs.readFileSync(path.join(dir, 'Yapper.exe')).length > 5000);
  assert.ok(lines.some((l) => /Done/.test(l)));
  assert.strictEqual(patch.status({ installDir: dir, appData }).patched, true);
});

test('install twice is fine; after a Yapper update (a new app.asar appears) the new one becomes the saved original', () => {
  const dir = fakeYapper();
  patch.install(opts(dir));
  patch.install(opts(dir));
  const res = path.join(dir, 'resources');
  assert.ok(fs.readFileSync(path.join(res, '_app.asar')).equals(ASAR));
  const newer = makeAsar({ 'package.json': JSON.stringify({ ...YAPPER_PKG, version: '1.1.0' }), 'main.js': "module.exports = 'v2';" });
  fs.writeFileSync(path.join(res, 'app.asar'), newer);
  patch.install(opts(dir));
  assert.ok(fs.readFileSync(path.join(res, '_app.asar')).equals(newer));
  assert.ok(!fs.existsSync(path.join(res, 'app.asar')));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(res, 'app', 'package.json'), 'utf8')).version, '1.1.0');
});

test('uninstall: app.asar is back, byte for byte; the stub is gone; the runtime and your data stay', () => {
  const dir = fakeYapper();
  patch.install(opts(dir));
  const lines = [];
  patch.uninstall({ ...opts(dir), log: (s) => lines.push(s) });
  const res = path.join(dir, 'resources');
  assert.ok(fs.readFileSync(path.join(res, 'app.asar')).equals(ASAR));
  assert.ok(!fs.existsSync(path.join(res, '_app.asar')) && !fs.existsSync(path.join(res, 'app')));
  assert.strictEqual(patch.status({ installDir: dir, appData }).patched, false);
  patch.uninstall(opts(dir));
  assert.ok(fs.existsSync(path.join(res, 'app.asar')));
});

test('uninstall after Yapper updated itself: the new app.asar is kept, the old copy is removed', () => {
  const dir = fakeYapper();
  patch.install(opts(dir));
  const res = path.join(dir, 'resources');
  const newer = makeAsar({ 'package.json': JSON.stringify(YAPPER_PKG), 'main.js': '1' });
  fs.writeFileSync(path.join(res, 'app.asar'), newer);
  patch.uninstall(opts(dir));
  assert.ok(fs.readFileSync(path.join(res, 'app.asar')).equals(newer));
  assert.ok(!fs.existsSync(path.join(res, '_app.asar')));
});

test('a Yapper that blocks changes (Electron fuse OnlyLoadAppFromAsar or asar integrity) is refused before anything changes', () => {
  for (const fuses of ['000001', '000010']) {
    const dir = fakeYapper({ fuses });
    rejects(() => patch.install(opts(dir)), /protected against modification/);
    assert.ok(fs.existsSync(path.join(dir, 'resources', 'app.asar')) && !fs.existsSync(path.join(dir, 'resources', 'app')));
  }
});

test('Yapper still running (file locked): clear message, and app.asar is back where it was', () => {
  const dir = fakeYapper();
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = function (p) {
    if (String(p).endsWith(path.join('app', 'package.json'))) { const e = new Error('locked'); e.code = 'EBUSY'; throw e; }
    return realWrite.apply(this, arguments);
  };
  try {
    rejects(() => patch.install(opts(dir)), /Yapper is still running/);
  } finally {
    fs.writeFileSync = realWrite;
  }
  assert.ok(fs.readFileSync(path.join(dir, 'resources', 'app.asar')).equals(ASAR), 'rolled back');
  assert.ok(!fs.existsSync(path.join(dir, 'resources', 'app')), 'no half-made app folder left behind');
  const real = fs.renameSync;
  fs.renameSync = () => { const e = new Error('busy'); e.code = 'EPERM'; throw e; };
  try {
    rejects(() => patch.install(opts(dir)), /Yapper is still running/);
  } finally {
    fs.renameSync = real;
  }

  const dir2 = fakeYapper();
  patch.install(opts(dir2));
  const realWrite2 = fs.writeFileSync;
  fs.writeFileSync = function (p) {
    if (String(p).endsWith(path.join('app', 'index.js'))) { const e = new Error('locked'); e.code = 'EBUSY'; throw e; }
    return realWrite2.apply(this, arguments);
  };
  try {
    rejects(() => patch.install(opts(dir2)), /Yapper is still running/);
  } finally {
    fs.writeFileSync = realWrite2;
  }
  assert.ok(fs.readFileSync(path.join(dir2, 'resources', 'app.asar')).equals(ASAR), 'Yapper is whole again');
  assert.ok(!fs.existsSync(path.join(dir2, 'resources', 'app')));
});

test('a folder called "app" that is not ours is left alone', () => {
  const dir = fakeYapper();
  fs.mkdirSync(path.join(dir, 'resources', 'app'));
  fs.writeFileSync(path.join(dir, 'resources', 'app', 'package.json'), '{"name":"other"}');
  rejects(() => patch.install(opts(dir)), /does not belong to YapCord/);
  rejects(() => patch.uninstall(opts(dir)), /does not belong to YapCord/);
  assert.ok(fs.existsSync(path.join(dir, 'resources', 'app.asar')));
});

async function runStub(kind, prep) {
  setSessionApi(kind);
  for (const x of ['runtime-next', 'runtime-prev']) fs.rmSync(path.join(appData, 'YapCord', x), { recursive: true, force: true });
  for (const k of Object.keys(rec)) rec[k] = Array.isArray(rec[k]) ? [] : typeof rec[k] === 'number' ? 0 : rec[k];
  rec.order = [];
  ipcHandlers.clear();
  ipcListeners.clear();
  appMock.removeAllListeners();

  const dir = fakeYapper();
  patch.install(opts(dir));
  const res = path.join(dir, 'resources');
  fs.rmSync(path.join(res, '_app.asar'));
  fs.mkdirSync(path.join(res, '_app.asar'));
  fs.writeFileSync(path.join(res, '_app.asar', 'package.json'), JSON.stringify(YAPPER_PKG));
  fs.writeFileSync(path.join(res, '_app.asar', 'main.js'), "globalThis.__yapperMainRan = (globalThis.__order||[]).push('yapper main'); module.exports = 1;");
  globalThis.__order = rec.order;
  delete globalThis.__yapperMainRan;
  if (prep) prep(path.join(appData, 'YapCord'));
  const stubFile = path.join(res, 'app', 'index.js');
  delete require.cache[stubFile];

  const injectFile = path.join(appData, 'YapCord', 'runtime', 'src', 'main', 'inject.js');
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(appData, 'YapCord', 'runtime'))) delete require.cache[k];
  const real = appMock.whenReady;
  appMock.whenReady = () => { rec.order.push('install'); return real(); };
  try {
    require(stubFile);
  } finally {
    appMock.whenReady = real;
  }
  await sleep(50);
  return { dir, injectFile };
}

test('the stub starts YapCord first and then Yapper\'s own app; the preload is added; Yapper\'s identity and settings are not touched', async () => {
  await runStub('register');
  assert.deepStrictEqual(rec.order, ['install', 'yapper main']);
  assert.strictEqual(rec.preloads.length, 1);
  const [how, o] = rec.preloads[0];
  assert.strictEqual(how, 'register');
  assert.deepStrictEqual(o.type, 'frame');
  assert.strictEqual(o.filePath, path.join(appData, 'YapCord', 'runtime', 'src', 'preload', 'index.js'));
  assert.ok(fs.existsSync(o.filePath));
  assert.deepStrictEqual([rec.setNames, rec.setPaths.length, rec.loginItems, rec.locks], [0, 0, 0, 0], 'no app name, userData path, autostart or single-instance changes');
});

test('older Electron without registerPreloadScript: setPreloads is used and keeps the existing preloads', async () => {
  await runStub('set');
  assert.deepStrictEqual(rec.preloads, [['set', ['existing.js', path.join(appData, 'YapCord', 'runtime', 'src', 'preload', 'index.js')]]]);
});

test('Windows proxy auto-detection is skipped by default, before Yapper\'s own main.js runs (it can hang for 20-30s on some machines)', async () => {
  await runStub('register');
  assert.ok(rec.switches.includes('no-proxy-server'));
  assert.deepStrictEqual(rec.order, ['install', 'yapper main'], 'the switch is set during install(), before Yapper starts');
});

test('turning "Skip Windows proxy detection" off in Settings is kept, and no switch is added', async () => {
  await runStub('register', (dataDir) => {
    fs.mkdirSync(path.join(dataDir, 'settings'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'settings', 'settings.json'), JSON.stringify({ window: { skipProxyDetection: false } }));
  });
  assert.ok(!rec.switches.includes('no-proxy-server'));
});

test('the runtime answers only Yapper\'s own window; the bundle comes from the copied runtime; settings are shared in %APPDATA%\\YapCord', async () => {
  await runStub('register');
  const w = new FakeWin();
  appMock.emit('browser-window-created', {}, w);
  const ok = { sender: w.webContents, senderFrame: { url: 'https://www.yapper.website/c/1' } };
  const info = await ipcHandlers.get('ym:app:info')(ok);
  assert.strictEqual(info.mode, 'official');
  assert.strictEqual(info.version, '1.0.0');
  assert.strictEqual(info.dataDir, path.join(appData, 'YapCord'));
  const ev = { ...ok };
  ipcListeners.get('ym:get-bundle')(ev);
  assert.ok(typeof ev.returnValue === 'string' && ev.returnValue.length > 50000 && /YM\.bootstrap\.start/.test(ev.returnValue), 'the bundle is built from the copied files');
  await ipcHandlers.get('ym:settings:set')(ok, 'plugins.PetPet.enabled', true);
  appMock.emit('before-quit');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(appData, 'YapCord', 'settings', 'settings.json'), 'utf8')).plugins.PetPet.enabled, true);

  const other = new FakeWin();
  let err = null;
  try { await ipcHandlers.get('ym:settings:get')({ sender: other.webContents, senderFrame: { url: 'https://www.yapper.website/' } }); } catch (e) { err = e; }
  assert.ok(err && /untrusted sender/.test(err.message), 'another window');
  err = null;
  try { await ipcHandlers.get('ym:settings:get')({ sender: w.webContents, senderFrame: { url: 'https://evil.example/' } }); } catch (e) { err = e; }
  assert.ok(err && /untrusted sender/.test(err.message), 'another site');

  assert.ok(fs.readdirSync(path.join(appData, 'YapCord', 'themes')).some((f) => /\.theme\.css$/.test(f)));

  assert.ok(w.webContents.listenerCount('context-menu') >= 1);

  w.emit('closed');
  const w2 = new FakeWin();
  appMock.emit('browser-window-created', {}, w2);
  assert.ok(await ipcHandlers.get('ym:settings:get')({ sender: w2.webContents, senderFrame: { url: 'https://www.yapper.website/' } }));
});

const fakeRuntime = (dir, installBody, version = '9.0.0') => {
  fs.mkdirSync(path.join(dir, 'src', 'main'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'yapcord', version }));
  fs.writeFileSync(path.join(dir, 'src', 'main', 'inject.js'), 'module.exports = { install() { ' + installBody + ' } };');
};

test('an update downloaded earlier (runtime-next) becomes the runtime at the next start; the old one is kept as runtime-prev', async () => {
  await runStub('register', (data) => fakeRuntime(path.join(data, 'runtime-next'), "(globalThis.__order || []).push('new version');"));
  assert.deepStrictEqual(rec.order, ['new version', 'yapper main'], 'the NEW runtime started, then Yapper');
  const data = path.join(appData, 'YapCord');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(data, 'runtime', 'package.json'), 'utf8')).version, '9.0.0');
  assert.ok(!fs.existsSync(path.join(data, 'runtime-next')));
  assert.ok(fs.existsSync(path.join(data, 'runtime-prev', 'src', 'main', 'inject.js')), 'the version that worked is still there');
  assert.notStrictEqual(JSON.parse(fs.readFileSync(path.join(data, 'runtime-prev', 'package.json'), 'utf8')).version, '9.0.0');
});

test('a new version that does not start: the previous one is restored and Yapper still starts', async () => {
  await runStub('register', (data) => fakeRuntime(path.join(data, 'runtime-next'), "throw new Error('broken update');"));
  assert.deepStrictEqual(rec.order, ['yapper main'], 'Yapper started anyway');
  const data = path.join(appData, 'YapCord');
  assert.notStrictEqual(JSON.parse(fs.readFileSync(path.join(data, 'runtime', 'package.json'), 'utf8')).version, '9.0.0', 'old runtime is back');
  assert.ok(fs.existsSync(path.join(data, 'runtime', 'src', 'main', 'inject.js')));
  assert.ok(!fs.existsSync(path.join(data, 'runtime-prev')) && !fs.existsSync(path.join(data, 'runtime-next')));
});

test('a half-downloaded runtime-next (no inject.js) is ignored; without a pending update nothing is switched', async () => {
  await runStub('register', (data) => { fs.mkdirSync(path.join(data, 'runtime-next'), { recursive: true }); fs.writeFileSync(path.join(data, 'runtime-next', 'package.json'), '{}'); });
  const data = path.join(appData, 'YapCord');
  assert.deepStrictEqual(rec.order, ['install', 'yapper main']);
  assert.ok(!fs.existsSync(path.join(data, 'runtime-prev')));
  assert.ok(fs.existsSync(path.join(data, 'runtime-next')), 'left alone');
  await runStub('register');
  assert.ok(!fs.existsSync(path.join(data, 'runtime-prev')));
});

test('inside Yapper: the Updater answers (can install), the icon and zoom calls exist, all only for Yapper\'s window', async () => {
  await runStub('register');
  const w = new FakeWin();
  appMock.emit('browser-window-created', {}, w);
  const ok = { sender: w.webContents, senderFrame: { url: 'https://www.yapper.website/' } };
  const st = await ipcHandlers.get('ym:updater:state')(ok);
  assert.deepStrictEqual([st.canInstall, st.phase, typeof st.current], [true, 'idle', 'string']);
  const { defaultRepoForPlatform } = require(path.join(ROOT, 'src', 'main', 'updater.js'));
  const ownPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual((await ipcHandlers.get('ym:updater:check')(ok)).repo, defaultRepoForPlatform(ownPkg, process.platform));
  assert.deepStrictEqual(await ipcHandlers.get('ym:icon:state')(ok), { has: false, preview: '' });
  w.webContents.setZoomFactor = (f) => { w.zoom = f; };
  assert.strictEqual(await ipcHandlers.get('ym:ui:zoom')(ok, 110), 1.1);
  for (const ch of ['ym:updater:state', 'ym:icon:state', 'ym:ui:zoom']) {
    let err = null;
    try { await ipcHandlers.get(ch)({ sender: new FakeWin().webContents, senderFrame: { url: 'https://www.yapper.website/' } }, 100); } catch (e) { err = e; }
    assert.ok(err && /untrusted sender/.test(err.message), ch);
  }
});

test('the Tray class is replaced (before Yapper loads) so its tray can start from your picture; unsafe situations change nothing', () => {
  const { installTrayPatch } = require(path.join(ROOT, 'src', 'main', 'trayicon.js'));
  const created = [];
  const attached = [];
  class Tray { constructor(img) { created.push(img); } once() {} }
  const electron = { Tray, app: { name: 'app' } };
  const cache = { '/fake/electron': { exports: electron } };
  const icon = { custom: { id: 'custom' }, trayImage() { return this.custom; }, attachTray(t, orig) { attached.push([t, orig]); } };
  assert.strictEqual(installTrayPatch({ icon, electron, cache, resolve: () => '/fake/electron' }), true);
  const patched = cache['/fake/electron'].exports;
  assert.notStrictEqual(patched.Tray, Tray);
  assert.strictEqual(patched.app, electron.app, 'other exports are kept');
  const t = new patched.Tray('YAPPER-IMG');
  assert.ok(t instanceof Tray, 'still a real Tray');
  assert.deepStrictEqual(created, [icon.custom]);
  assert.deepStrictEqual(attached, [[t, 'YAPPER-IMG']], 'the manager learns Yapper\'s own image (for "back to the original")');
  icon.custom = null;
  new patched.Tray('YAPPER-IMG-2');
  assert.strictEqual(created[1], 'YAPPER-IMG-2', 'no picture chosen: Yapper\'s own image');
  assert.strictEqual(installTrayPatch({ icon, electron: patched, cache, resolve: () => '/fake/electron' }), true, 'a second call changes nothing');
  assert.strictEqual(cache['/fake/electron'].exports, patched);

  const bad = { get Tray() { throw new Error('not ready'); } };
  const cache2 = { '/fake/electron': { exports: bad } };
  assert.strictEqual(installTrayPatch({ icon, electron: bad, cache: cache2, resolve: () => '/fake/electron', log: { warn() {} } }), false);
  assert.strictEqual(cache2['/fake/electron'].exports, bad);
  assert.strictEqual(installTrayPatch({ icon, electron, cache: {}, resolve: () => '/fake/electron' }), false);
  assert.strictEqual(installTrayPatch({ icon, electron: {}, cache, resolve: () => '/fake/electron' }), false);
});

test('if the YapCord files are gone, Yapper still starts normally', async () => {
  const dir = fakeYapper();
  patch.install(opts(dir));
  const res = path.join(dir, 'resources');
  fs.rmSync(path.join(res, '_app.asar'));
  fs.mkdirSync(path.join(res, '_app.asar'));
  fs.writeFileSync(path.join(res, '_app.asar', 'package.json'), JSON.stringify(YAPPER_PKG));
  fs.writeFileSync(path.join(res, '_app.asar', 'main.js'), "globalThis.__ran = true;");
  fs.rmSync(path.join(appData, 'YapCord', 'runtime'), { recursive: true, force: true });
  delete globalThis.__ran;
  const stubFile = path.join(res, 'app', 'index.js');
  delete require.cache[stubFile];
  require(stubFile);
  assert.strictEqual(globalThis.__ran, true);
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      out('  ok   ' + t.name);
    } catch (err) {
      failed++;
      out('  FAIL ' + t.name + '\n       ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n       '));
    }
  }
  console.log = realLog; console.error = realErr; console.warn = realWarn;
  if (failed) {
    out('\n--- captured log ---\n' + captured.slice(-15).join('\n'));
    out('\n' + failed + ' of ' + tests.length + ' tests FAILED');
    process.exit(1);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  out('\nall ' + tests.length + ' inject/installer tests passed');
})();
