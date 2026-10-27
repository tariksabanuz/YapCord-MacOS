'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yapcord-installer-'));
const results = [];
const test = (name, fn) => {
  try { fn(); results.push(true); console.log('  ok   ' + name); } catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 5).join('\n       ')); }
};

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
  head.writeUInt32LE(4, 0); head.writeUInt32LE(8 + json.length + pad, 4); head.writeUInt32LE(4 + json.length + pad, 8); head.writeUInt32LE(json.length, 12);
  return Buffer.concat([head, json, Buffer.alloc(pad), ...chunks]);
}
const PKG = { name: 'yapper-desktop', productName: 'Yapper', version: '1.0.0', main: 'main.js' };
const local = path.join(tmp, 'Local');
const appData = path.join(tmp, 'Roaming');
const yapperDir = path.join(local, 'Programs', 'yapper-desktop');
fs.mkdirSync(path.join(yapperDir, 'resources'), { recursive: true });
fs.mkdirSync(appData, { recursive: true });
fs.writeFileSync(path.join(yapperDir, 'resources', 'app.asar'), makeAsar({ 'package.json': JSON.stringify(PKG), 'main.js': 'x' }));
fs.writeFileSync(path.join(yapperDir, 'Yapper.exe'), Buffer.concat([Buffer.alloc(3000, 7), Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, 6]), Buffer.from('000000'), Buffer.alloc(50)]));
fs.writeFileSync(path.join(yapperDir, 'Uninstall Yapper.exe'), 'x');
const env = { LOCALAPPDATA: local, APPDATA: appData };

const stageDir = path.join(tmp, 'stage');
const { stage, findUnsafeWindowsPathChar } = require(path.join(ROOT, 'tools', 'build-installer.js'));
const pkg = stage(stageDir);
const core = require(path.join(stageDir, 'core.js'));
const payload = core.payloadDir(null, path.join(stageDir, 'payload'));
const tasklist = (running) => () => (running ? '"Yapper.exe","1234","Console","1","90,000 K"\r\n' : 'INFO: No tasks are running which match the specified criteria.\r\n');
const win = { platform: 'win32' };

test('the build script stages a complete installer (window, patch tool, YapCord files, builder config)', () => {
  for (const f of ['main.js', 'preload.js', 'core.js', 'index.html', 'installer.css', 'ui.js', 'yapper-patch.js', 'icon.png', 'package.json']) assert.ok(fs.existsSync(path.join(stageDir, f)), f);
  for (const f of ['src/main/inject.js', 'src/renderer/000-boot.js', 'package.json', 'LICENSE', 'themes']) assert.ok(fs.existsSync(path.join(stageDir, 'payload', f)), 'payload/' + f);
  for (const f of ['installer', 'tools', 'test', 'node_modules', 'dist']) assert.ok(!fs.existsSync(path.join(stageDir, 'payload', f)), 'payload must not contain ' + f);
  assert.strictEqual(pkg.main, 'main.js');
  assert.strictEqual(pkg.version, JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  assert.deepStrictEqual(pkg.build.extraResources, [{ from: 'payload', to: 'payload' }]);
  assert.strictEqual(pkg.build.portable.artifactName, 'YapCord-Installer-${version}.exe');
  assert.ok(/^\d+\.\d+\.\d+/.test(pkg.build.electronVersion));
  for (const f of pkg.build.files) assert.ok(fs.existsSync(path.join(stageDir, f)), 'listed file missing: ' + f);
});

test('the payload is found and reports its version and the update repo', () => {
  assert.ok(payload);
  const info = core.payloadInfo(payload);
  assert.strictEqual(info.version, pkg.version);
  assert.strictEqual(info.repo, 'tariksabanuz/YapCord-Windows');
  assert.strictEqual(core.payloadDir('/nonexistent', '/also/nonexistent') !== null, true, 'falls back to the folder next to the installer');
});

test('scan finds Yapper in %LOCALAPPDATA%\\Programs and knows YapCord is not in it yet', () => {
  const list = core.scan({ env, ...win, run: tasklist(false) });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].dir, yapperDir);
  assert.strictEqual(list[0].patched, false);
  assert.strictEqual(path.basename(list[0].exe), 'Yapper.exe');
  assert.strictEqual(list[0].running, false);
  assert.deepStrictEqual(core.scan({ env: { LOCALAPPDATA: path.join(tmp, 'nothing') } }), []);
});

test('Install while Yapper is running is refused with a clear message and changes nothing', () => {
  const r = core.perform('install', yapperDir, { payload, appData, ...win, run: tasklist(true) });
  assert.strictEqual(r.ok, false);
  assert.ok(/Yapper is still running/.test(r.error));
  assert.ok(fs.existsSync(path.join(yapperDir, 'resources', 'app.asar')));
  assert.ok(!fs.existsSync(path.join(yapperDir, 'resources', 'app')));
  assert.ok(!fs.existsSync(path.join(appData, 'YapCord')));
  assert.strictEqual(core.describe(yapperDir, { appData, ...win, run: tasklist(true) }).running, true);
});

test('Install puts YapCord in Yapper: runtime copied, app.asar kept as _app.asar, stub in place', () => {
  const lines = [];
  const r = core.perform('install', yapperDir, { payload, appData, ...win, run: tasklist(false), log: (l) => lines.push(l) });
  assert.strictEqual(r.ok, true, r.error);
  assert.ok(lines.some((l) => /Found Yapper/.test(l)) && lines.some((l) => /Done/.test(l)));
  const res = path.join(yapperDir, 'resources');
  assert.ok(fs.existsSync(path.join(res, '_app.asar')) && !fs.existsSync(path.join(res, 'app.asar')));
  assert.ok(fs.existsSync(path.join(res, 'app', 'index.js')));
  const rt = path.join(appData, 'YapCord', 'runtime');
  assert.ok(fs.existsSync(path.join(rt, 'src', 'main', 'inject.js')) && fs.existsSync(path.join(rt, 'LICENSES')));
  const d = core.describe(yapperDir, { appData, ...win, run: tasklist(false) });
  assert.strictEqual(d.patched, true);
  assert.strictEqual(d.runtimePresent, true);
});

test('Repair re-installs over an existing install and drops a stale downloaded update', () => {
  const rt = path.join(appData, 'YapCord', 'runtime');
  fs.mkdirSync(path.join(rt + '-next', 'src', 'main'), { recursive: true });
  fs.writeFileSync(path.join(rt + '-next', 'src', 'main', 'inject.js'), '// old');
  fs.rmSync(path.join(rt, 'src', 'main', 'inject.js'));
  const r = core.perform('repair', yapperDir, { payload, appData, ...win, run: tasklist(false) });
  assert.strictEqual(r.ok, true, r.error);
  assert.ok(fs.existsSync(path.join(rt, 'src', 'main', 'inject.js')), 'runtime restored');
  assert.ok(!fs.existsSync(rt + '-next'), 'stale runtime-next removed');
  assert.ok(fs.existsSync(path.join(yapperDir, 'resources', '_app.asar')));
});

test('an old YapperMod install is removed first, then the new one goes in', () => {
  const res = path.join(yapperDir, 'resources');
  const oldRt = path.join(appData, 'YapperMod', 'runtime');
  fs.mkdirSync(path.join(oldRt, 'src'), { recursive: true });
  fs.writeFileSync(path.join(oldRt, 'src', 'x.js'), '// old');
  fs.writeFileSync(path.join(res, 'app', 'package.json'), JSON.stringify({ name: 'yapper-desktop', main: 'index.js', 'yappermod-stub': true }));
  assert.strictEqual(core.describe(yapperDir, { appData, ...win, run: tasklist(false) }).patched, true, 'old stub is recognised');
  const r = core.perform('install', yapperDir, { payload, appData, ...win, run: tasklist(false) });
  assert.strictEqual(r.ok, true, r.error);
  assert.ok(!fs.existsSync(oldRt), 'old YapperMod runtime removed');
  assert.ok(r.lines.some((l) => /older YapperMod\/YapCord install/.test(l)));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(res, 'app', 'package.json'), 'utf8'))['yapcord-stub'], true);
  assert.ok(fs.existsSync(path.join(res, '_app.asar')));
});

test('Uninstall gives Yapper back exactly as it was (and leaves your settings alone)', () => {
  fs.mkdirSync(path.join(appData, 'YapCord', 'settings'), { recursive: true });
  fs.writeFileSync(path.join(appData, 'YapCord', 'settings', 'settings.json'), '{}');
  const r = core.perform('uninstall', yapperDir, { payload, appData, ...win, run: tasklist(false) });
  assert.strictEqual(r.ok, true, r.error);
  const res = path.join(yapperDir, 'resources');
  assert.ok(fs.existsSync(path.join(res, 'app.asar')) && !fs.existsSync(path.join(res, '_app.asar')) && !fs.existsSync(path.join(res, 'app')));
  assert.ok(fs.existsSync(path.join(appData, 'YapCord', 'settings', 'settings.json')));
  assert.strictEqual(core.describe(yapperDir, { appData, ...win, run: tasklist(false) }).patched, false);
});

test('mistakes give a readable message instead of a crash (no payload, bad action, wrong folder, no AppData)', () => {
  const noPayload = core.perform('install', yapperDir, { payload: null, appData, ...win, run: tasklist(false) });
  assert.ok(!noPayload.ok && /missing from this installer/.test(noPayload.error));
  assert.ok(!core.perform('format-c', yapperDir, { payload, appData }).ok);
  const wrong = core.perform('install', path.join(tmp, 'not-yapper'), { payload, appData });
  assert.ok(!wrong.ok && /resources.app\.asar|Yapper/.test(wrong.error));
  assert.throws(() => core.check(path.join(tmp, 'not-yapper')), /Yapper/);
  const old = process.env.APPDATA; delete process.env.APPDATA;
  try { assert.ok(!core.perform('install', yapperDir, { payload, run: tasklist(false), ...win }).ok); } finally { if (old !== undefined) process.env.APPDATA = old; }
  assert.ok(fs.existsSync(path.join(yapperDir, 'resources', 'app.asar')), 'Yapper untouched after all the failures');
});

test('a folder picked by hand is checked and listed; starting Yapper spawns its exe detached', () => {
  const other = path.join(tmp, 'D', 'Yapper');
  fs.mkdirSync(path.join(other, 'resources'), { recursive: true });
  fs.writeFileSync(path.join(other, 'resources', 'app.asar'), makeAsar({ 'package.json': JSON.stringify(PKG) }));
  fs.writeFileSync(path.join(other, 'Yapper.exe'), 'x');
  const d = core.check(other, { appData, ...win, run: tasklist(false) });
  assert.strictEqual(d.dir, other);
  const list = core.scan({ env, extra: [other, other], appData, ...win, run: tasklist(false) });
  assert.deepStrictEqual(list.map((x) => x.dir), [other, yapperDir]);
  let call = null;
  const exe = core.launch(yapperDir, (cmd, args, opts) => { call = { cmd, args, opts }; return { unref() { call.unref = true; } }; });
  assert.strictEqual(exe, path.join(yapperDir, 'Yapper.exe'));
  assert.deepStrictEqual([call.cmd, call.opts.detached, call.opts.stdio, call.unref], [exe, true, 'ignore', true]);
});

test('tasklist trouble never blocks (cannot tell: assume not running); other systems are never "running"', () => {
  assert.strictEqual(core.isRunning(path.join(yapperDir, 'Yapper.exe'), () => { throw new Error('no tasklist'); }, 'win32'), false);
  assert.strictEqual(core.isRunning(path.join(yapperDir, 'Yapper.exe'), tasklist(true), 'linux'), false);
  assert.strictEqual(core.isRunning(null, tasklist(true), 'win32'), false);
});

test('installer/main.js (mocked Electron): registers its handlers, answers only its own window, starts and runs an install', () => {
  const Module = require('module');
  const handlers = new Map();
  const sent = [];
  let created = 0;
  let readyCb = null;
  let lastWin = null;
  class FakeWC { constructor() { this.id = 1; } setWindowOpenHandler() {} on() {} send(...a) { sent.push(a); } isDestroyed() { return false; } }
  class FakeWin { constructor(o) { created++; lastWin = this; this.opts = o; this.webContents = new FakeWC(); } removeMenu() {} loadFile(f) { this.file = f; } isDestroyed() { return false; } isMinimized() { return false; } }
  const fakeElectron = {
    app: { requestSingleInstanceLock: () => true, on() {}, whenReady: () => ({ then: (f) => { readyCb = f; } }), quit() {} },
    BrowserWindow: FakeWin, Menu: { setApplicationMenu() {} }, shell: { openExternal() {} },
    dialog: { showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
  };
  const origLoad = Module._load;
  Module._load = function (request, ...rest) { return request === 'electron' ? fakeElectron : origLoad.call(this, request, ...rest); };
  const mainPath = path.join(stageDir, 'main.js');
  const savedLocal = process.env.LOCALAPPDATA; const savedApp = process.env.APPDATA;
  process.env.LOCALAPPDATA = local; process.env.APPDATA = appData;
  try {
    delete require.cache[mainPath];
    require(mainPath);
    assert.deepStrictEqual([...handlers.keys()].sort(), ['installer:choose', 'installer:home', 'installer:info', 'installer:launch', 'installer:run']);
    readyCb();
    assert.strictEqual(created, 1);
    assert.ok(/index\.html$/.test(fakeWin().file));
    const wo = fakeWin().opts.webPreferences;
    assert.deepStrictEqual([wo.contextIsolation, wo.nodeIntegration, wo.sandbox], [true, false, true]);
    const ev = { sender: fakeWin().webContents };
    const strange = { sender: new FakeWC() };
    assert.throws(() => handlers.get('installer:info')(strange), /untrusted sender/);
    const info = handlers.get('installer:info')(ev);
    assert.strictEqual(info.payloadOk, true);
    assert.strictEqual(info.version, pkg.version);
    assert.strictEqual(info.installs.length, 1);
    assert.deepStrictEqual(handlers.get('installer:run')(ev, 42, {}), { ok: false, lines: [], error: 'Invalid request.' });
    const done = handlers.get('installer:run')(ev, 'install', yapperDir);
    assert.strictEqual(done.ok, true, done.error);
    assert.strictEqual(done.install.patched, true);
    assert.ok(sent.some((a) => a[0] === 'installer:log' && /Done/.test(a[1])), 'progress lines are sent to the window');
    assert.strictEqual(handlers.get('installer:run')(ev, 'uninstall', yapperDir).install.patched, false);
  } finally {
    Module._load = origLoad;
    process.env.LOCALAPPDATA = savedLocal; process.env.APPDATA = savedApp;
    if (savedLocal === undefined) delete process.env.LOCALAPPDATA;
    if (savedApp === undefined) delete process.env.APPDATA;
  }
  function fakeWin() { return lastWin; }
});

test('a project path with a Windows-cmd-unsafe character is caught before electron-builder sees it (the "(1)" double-download folder, and friends)', () => {

  assert.strictEqual(findUnsafeWindowsPathChar('C:\\Users\\tarik\\Downloads\\YapCord-1.15.0-full (1)'), '(');
  assert.strictEqual(findUnsafeWindowsPathChar('C:\\Users\\tarik\\Downloads\\YapCord-1.15.0-full'), null);
  assert.strictEqual(findUnsafeWindowsPathChar('C:\\Users\\tarik\\My Projects\\YapCord'), null, 'a plain space alone is not flagged - only cmd.exe-special characters are');
  for (const ch of ['&', '%', '^', '!', '<', '>', '|', '"']) {
    assert.strictEqual(findUnsafeWindowsPathChar('C:\\Users\\tarik\\Weird' + ch + 'Folder'), ch);
  }
});

fs.rmSync(tmp, { recursive: true, force: true });
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} of ${results.length} installer tests FAILED` : `all ${results.length} installer tests passed`);
process.exit(failed ? 1 : 0);
