'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const C = require('../src/main/constants');
const { SettingsStore, DEFAULTS, deepMerge } = require('../src/main/settings');
const { parseMeta, safeName, ThemeManager } = require('../src/main/themes');
const { shouldBlock } = require('../src/main/netfilter');
const { buildBundle, buildBundleForExtension, buildBundleForBookmarklet, listFiles } = require('../src/main/bundle');
const { buildUri } = require('../tools/build-bookmarklet');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yappermod-unit-'));

test('every file the app points at exists', () => {
  for (const k of ['PRELOAD', 'PICKER_HTML', 'PICKER_PRELOAD', 'BUNDLED_THEMES_DIR', 'ICON', 'RENDERER_DIR']) {
    assert(fs.existsSync(C[k]), k + ' missing: ' + C[k]);
  }
  assert(fs.existsSync(path.join(ROOT, 'src', 'main', 'offline.html')));
  assert(fs.existsSync(path.join(ROOT, 'build', 'icon.png')));
});

test('package.json is consistent', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(fs.existsSync(path.join(ROOT, pkg.main)), 'main points at a real file');
  assert(pkg.scripts.start && pkg.scripts.test && pkg.scripts.dist);
  const boot = fs.readFileSync(path.join(ROOT, 'src', 'renderer', '000-boot.js'), 'utf8');
  const ymVersion = (boot.match(/YM\.version = '([^']+)'/) || [])[1];
  assert.strictEqual(ymVersion, pkg.version, 'YM.version (' + ymVersion + ') must equal package.json version (' + pkg.version + ')');
  assert(pkg.devDependencies.electron, 'electron is a devDependency');
  assert(!pkg.dependencies, 'no runtime dependencies');
});

test('the product is called YapCord everywhere it is visible (package, exe name, app id)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.productName, 'YapCord');
  assert.strictEqual(pkg.build.productName, 'YapCord');
  assert.strictEqual(pkg.build.appId, 'dev.yapcord.app');
  assert(/^YapCord-.*portable\.exe$/.test(pkg.build.portable.artifactName), pkg.build.portable.artifactName);
});

test('data folder: fresh install uses %APPDATA%\\YapCord', () => {
  const { resolveDataDir } = require('../src/main/datadir');
  const appData = fs.mkdtempSync(path.join(tmp, 'ad-fresh-'));
  assert.deepStrictEqual(resolveDataDir(appData), { dir: path.join(appData, 'YapCord'), migrated: false, legacy: false });
  assert(!fs.existsSync(path.join(appData, 'YapperMod')));
});

test('data folder: an existing YapperMod folder is moved to YapCord with everything in it', () => {
  const { resolveDataDir } = require('../src/main/datadir');
  const appData = fs.mkdtempSync(path.join(tmp, 'ad-move-'));
  const old = path.join(appData, 'YapperMod');
  fs.mkdirSync(path.join(old, 'settings'), { recursive: true });
  fs.mkdirSync(path.join(old, 'themes'), { recursive: true });
  fs.mkdirSync(path.join(old, 'Local Storage'), { recursive: true });
  fs.writeFileSync(path.join(old, 'settings', 'settings.json'), '{"plugins":{"NoTrack":{"enabled":true}}}');
  fs.writeFileSync(path.join(old, 'themes', 'mine.theme.css'), 'a{}');
  fs.writeFileSync(path.join(old, 'Cookies'), 'session');
  const r = resolveDataDir(appData);
  assert.deepStrictEqual(r, { dir: path.join(appData, 'YapCord'), migrated: true, legacy: false });
  assert(!fs.existsSync(old), 'the old folder is gone');
  assert.strictEqual(fs.readFileSync(path.join(r.dir, 'settings', 'settings.json'), 'utf8'), '{"plugins":{"NoTrack":{"enabled":true}}}');
  assert.strictEqual(fs.readFileSync(path.join(r.dir, 'themes', 'mine.theme.css'), 'utf8'), 'a{}');
  assert.strictEqual(fs.readFileSync(path.join(r.dir, 'Cookies'), 'utf8'), 'session', 'the login session comes along');
  assert.strictEqual(resolveDataDir(appData).migrated, false, 'a second start does nothing');
});

test('data folder: when YapCord already exists it is used and the old folder is left alone', () => {
  const { resolveDataDir } = require('../src/main/datadir');
  const appData = fs.mkdtempSync(path.join(tmp, 'ad-both-'));
  fs.mkdirSync(path.join(appData, 'YapCord'));
  fs.mkdirSync(path.join(appData, 'YapperMod'));
  fs.writeFileSync(path.join(appData, 'YapperMod', 'keep.txt'), 'x');
  assert.deepStrictEqual(resolveDataDir(appData), { dir: path.join(appData, 'YapCord'), migrated: false, legacy: false });
  assert(fs.existsSync(path.join(appData, 'YapperMod', 'keep.txt')));
});

test('data folder: if the old folder cannot be moved (old app still running) it is used as it is, nothing is lost', () => {
  const { resolveDataDir } = require('../src/main/datadir');
  const appData = fs.mkdtempSync(path.join(tmp, 'ad-busy-'));
  fs.mkdirSync(path.join(appData, 'YapperMod'));
  const busy = Object.assign({}, fs, { renameSync() { const e = new Error('EBUSY: resource busy or locked'); e.code = 'EBUSY'; throw e; } });
  const r = resolveDataDir(appData, busy);
  assert.strictEqual(r.dir, path.join(appData, 'YapperMod'));
  assert.strictEqual(r.legacy, true);
  assert.strictEqual(r.migrated, false);
  assert(/EBUSY/.test(r.error.message));
  assert(!fs.existsSync(path.join(appData, 'YapCord')), 'no empty YapCord folder that would hide the old data next time');
  assert.strictEqual(resolveDataDir(appData).migrated, true, 'moved on the next start, once the old app is closed');
});

test('file dialog: accept lists become dialog filters, with an "All files" fallback', () => {
  const { acceptToExtensions, buildFilters, mimeOf } = require('../src/main/filepick');
  assert.deepStrictEqual(acceptToExtensions('.zip, .TXT,.pdf').sort(), ['pdf', 'txt', 'zip']);
  assert.deepStrictEqual(acceptToExtensions('image/png,image/jpeg'), ['png', 'jpg', 'jpeg']);
  assert(acceptToExtensions('image/*,video/*,audio/*').includes('webm'));
  assert.deepStrictEqual(acceptToExtensions('.../evil,.a*b,,'), [], 'garbage is ignored');
  assert.deepStrictEqual(buildFilters(''), [{ name: 'All files', extensions: ['*'] }]);
  const f = buildFilters('.zip,image/png');
  assert.strictEqual(f.length, 2);
  assert.deepStrictEqual(f[0].extensions, ['zip', 'png']);
  assert.deepStrictEqual(f[1], { name: 'All files', extensions: ['*'] });
  assert.strictEqual(mimeOf('C:\\x\\Photo.JPG'), 'image/jpeg');
  assert.strictEqual(mimeOf('setup.exe'), '');
});

test('file dialog: picks files, reads them, caps size and count, survives unreadable files', async () => {
  const { pickFiles, MAX_BYTES } = require('../src/main/filepick');
  const dir = fs.mkdtempSync(path.join(tmp, 'pick-'));
  const a = path.join(dir, 'a.png'); fs.writeFileSync(a, Buffer.from([1, 2, 3]));
  const b = path.join(dir, 'b.txt'); fs.writeFileSync(b, 'hello');
  let seen;
  const dialog = { showOpenDialog: async (_w, o) => { seen = o; return { canceled: false, filePaths: [a, b, path.join(dir, 'missing.zip')] }; } };
  const out = await pickFiles({ dialog, win: null }, { accept: 'image/*', multiple: true });
  assert.deepStrictEqual(seen.properties, ['openFile', 'multiSelections']);
  assert.strictEqual(seen.filters[0].name, 'Files Yapper accepts');
  assert.deepStrictEqual(out.map((f) => [f.name, f.type, f.size, !!f.data, f.error || null]),
    [['a.png', 'image/png', 3, true, null], ['b.txt', 'text/plain', 5, true, null], ['missing.zip', 'application/zip', 0, false, 'unreadable']]);
  assert.deepStrictEqual([...out[0].data], [1, 2, 3]);
  const single = await pickFiles({ dialog, win: null }, { multiple: false });
  assert.strictEqual(single.length, 1, 'a single-file input only gets one file');
  assert.deepStrictEqual(seen.properties, ['openFile']);
  const big = { statSync: () => ({ isFile: () => true, size: MAX_BYTES + 1, mtimeMs: 1 }), readFileSync: () => { throw new Error('must not read'); } };
  const huge = await pickFiles({ dialog, win: null, fsImpl: big }, { multiple: false });
  assert.deepStrictEqual(huge.map((f) => [f.error, !!f.data]), [['too-large', false]]);
  const cancelled = await pickFiles({ dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }, win: null }, {});
  assert.deepStrictEqual(cancelled, []);
});

function readGif(bytes) {
  let p = 6;
  const w = bytes[p] | (bytes[p + 1] << 8), h = bytes[p + 2] | (bytes[p + 3] << 8);
  const flags = bytes[p + 4]; p += 7;
  const gct = []; const gctSize = 2 << (flags & 7);
  if (flags & 0x80) for (let i = 0; i < gctSize; i++) { gct.push([bytes[p], bytes[p + 1], bytes[p + 2]]); p += 3; }
  const frames = []; let gce = null; let loops = null;
  while (bytes[p] !== 0x3b) {
    if (!(p < bytes.length)) throw new Error('GIF ended without a trailer');
    if (bytes[p] === 0x21) {
      const label = bytes[p + 1]; p += 2;
      if (label === 0xf9) { gce = { disposal: (bytes[p + 1] >> 2) & 7, transparent: bytes[p + 1] & 1, delay: bytes[p + 2] | (bytes[p + 3] << 8), tindex: bytes[p + 4] }; }
      if (label === 0xff && bytes[p + 12] === 3) loops = bytes[p + 14] | (bytes[p + 15] << 8);
      while (bytes[p] !== 0) { if (!(p < bytes.length)) throw new Error('bad block'); p += bytes[p] + 1; }
      p++;
    } else if (bytes[p] === 0x2c) {
      p += 10;
      const min = bytes[p++];
      const data = [];
      while (bytes[p] !== 0) { for (let i = 0; i < bytes[p]; i++) data.push(bytes[p + 1 + i]); p += bytes[p] + 1; }
      p++;

      const clear = 1 << min, eoi = clear + 1; let size = min + 1; let table = [];
      const reset = () => { table = []; for (let i = 0; i < clear; i++) table.push([i]); table.push(null, null); size = min + 1; };
      reset();
      const out = []; let acc = 0, bits = 0, di = 0, prev = null;
      while (true) {
        while (bits < size && di < data.length) { acc |= data[di++] << bits; bits += 8; }
        if (bits < size) break;
        const code = acc & ((1 << size) - 1); acc >>>= size; bits -= size;
        if (code === clear) { reset(); prev = null; continue; }
        if (code === eoi) break;
        let entry;
        if (code < table.length) entry = table[code];
        else if (code === table.length && prev) entry = prev.concat(prev[0]);
        else throw new Error('bad LZW code ' + code);
        out.push(...entry);
        if (prev && table.length < 4096) table.push(prev.concat(entry[0]));
        prev = entry;
        if (table.length === (1 << size) && size < 12) size++;
      }
      frames.push({ indices: out, gce });
      gce = null;
    } else throw new Error('unexpected block ' + bytes[p]);
  }
  return { w, h, gct, frames, loops, header: String.fromCharCode(...bytes.slice(0, 6)) };
}

test('gif encoder: valid GIF89a, colours and transparency survive, many frames, big noisy frames (LZW table resets)', () => {
  const YM = {};
  loadRenderer('066-gif.js', YM, {});
  const W = 40, H = 30;
  const solid = (r, g, b, a = 255) => { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; } return d; };
  const f1 = solid(250, 10, 10); const f2 = solid(10, 10, 250);
  for (let x = 0; x < 10; x++) for (let y = 0; y < 30; y++) { const i = (y * W + x) * 4; f2[i + 3] = 0; }
  const bytes = YM.gif.encode({ width: W, height: H, frames: [f1, f2], delayMs: 40, loop: 0 });
  const gif = readGif(bytes);
  assert.strictEqual(gif.header, 'GIF89a');
  assert.deepStrictEqual([gif.w, gif.h, gif.frames.length, gif.loops], [W, H, 2, 0]);
  assert.strictEqual(gif.frames[0].gce.delay, 4);
  assert.strictEqual(gif.frames[0].gce.disposal, 2);
  const colour = (frame, x, y) => gif.gct[gif.frames[frame].indices[y * W + x]];
  const near = (c, r, g, b) => Math.abs(c[0] - r) < 16 && Math.abs(c[1] - g) < 16 && Math.abs(c[2] - b) < 16;
  assert(near(colour(0, 20, 15), 250, 10, 10), 'red stays red');
  assert(near(colour(1, 30, 15), 10, 10, 250), 'blue stays blue');
  assert.strictEqual(gif.frames[1].indices[15 * W + 3], 0, 'transparent pixels use index 0');
  assert.strictEqual(gif.frames[1].gce.transparent, 1);
  assert.strictEqual(gif.frames[1].gce.tindex, 0);
  assert.strictEqual(gif.frames[0].gce.transparent, 1, 'every frame of a transparent animation declares index 0');

  const opaque = YM.gif.encode({ width: W, height: H, frames: [f1] });
  const og = readGif(opaque);
  assert.strictEqual(og.frames[0].gce.transparent, 0);
  assert.strictEqual(og.loops, null, 'a single frame has no loop block');

  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const NW = 120, NH = 90;
  const noise = new Uint8ClampedArray(NW * NH * 4);
  for (let i = 0; i < noise.length; i += 4) { noise[i] = rnd() * 255; noise[i + 1] = rnd() * 255; noise[i + 2] = rnd() * 255; noise[i + 3] = 255; }
  const ng = readGif(YM.gif.encode({ width: NW, height: NH, frames: [noise, noise, noise] }));
  assert.strictEqual(ng.frames.length, 3);
  assert.strictEqual(ng.frames[0].indices.length, NW * NH, 'every pixel decoded');
  assert.deepStrictEqual(ng.frames[0].indices, ng.frames[2].indices, 'identical frames decode identically');

  const raw = Array.from({ length: 30000 }, () => Math.floor(rnd() * 256));
  const lz = YM.gif.lzw(Uint8Array.from(raw), 8);
  const body = []; for (let i = 0; i < lz.length; i += 255) { const n = Math.min(255, lz.length - i); body.push(n, ...lz.slice(i, i + n)); }
  const decoded = readGif(Uint8Array.from([71, 73, 70, 56, 57, 97, 200, 0, 150, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 200, 0, 150, 0, 0, 8, ...body, 0, 0x3b]));
  assert.deepStrictEqual(decoded.frames[0].indices, raw);
  assert.throws(() => YM.gif.encode({ width: 2, height: 2, frames: [] }), /no frames/);
  assert.throws(() => YM.gif.encode({ width: 2, height: 2, frames: [new Uint8ClampedArray(3)] }), /does not match/);
});

test('rival guard: only plain "...yapper....exe" names are accepted, never system programs or YapCord itself', () => {
  const { validName, cleanNames, parseTasklist } = require('../src/main/rival');
  for (const ok of ['Yapper.exe', 'yapper.exe', 'Yapper Desktop.exe', 'Yapper-Beta (1).exe']) assert.strictEqual(validName(ok), true, ok);
  for (const bad of ['explorer.exe', 'chrome.exe', 'svchost.exe', 'YapCord.exe', 'yapcord-yapper.exe', '..\\Yapper.exe', 'C:\\x\\Yapper.exe', 'Yapper.exe /F', 'yapper', 'yapper.bat', '', null, undefined, 'Yapper.exe\nexplorer.exe'])
    assert.strictEqual(validName(bad), false, String(bad));
  assert.deepStrictEqual(cleanNames(['Yapper.exe', 'yapper.EXE', 'explorer.exe', 'Yapper 2.exe']), ['Yapper.exe', 'Yapper 2.exe']);
  assert.strictEqual(cleanNames(Array.from({ length: 20 }, (_, i) => 'Yapper' + i + '.exe')).length, 5);
  assert.deepStrictEqual(cleanNames('Yapper.exe'), [], 'not a list');
  const set = parseTasklist('"System","4","Services","0","144 K"\r\n"Yapper.exe","1234","Console","1","90,000 K"\r\nINFO: junk\r\n');
  assert(set.has('yapper.exe') && set.has('system') && set.size === 2);
});

test('rival guard: asks the Yapper app to close first, ends it if it stays, keeps watching, respects the switch', async () => {
  const { makeRivalGuard } = require('../src/main/rival');
  let tasks = '"Yapper.exe","1","Console","1","1 K"\r\n"YapCord.exe","2","Console","1","1 K"\r\n';
  const calls = [];
  const execFile = (file, args, _o, cb) => {
    calls.push([file, ...args]);
    cb(null, file === 'tasklist' ? tasks : '');
  };
  let cfg = { enabled: true, names: ['Yapper.exe', 'YapCord.exe', 'explorer.exe'] };
  const guard = makeRivalGuard({ execFile, platform: 'win32', ownNames: ['YapCord.exe'], getConfig: () => cfg });
  await guard.check();
  assert.deepStrictEqual(calls.filter((c) => c[0] === 'taskkill'), [['taskkill', '/IM', 'Yapper.exe', '/T']], 'polite close first; own and foreign names never touched');
  await guard.check();
  assert.deepStrictEqual(calls.filter((c) => c[0] === 'taskkill').pop(), ['taskkill', '/IM', 'Yapper.exe', '/T', '/F'], 'still there: ended');
  tasks = '"YapCord.exe","2","Console","1","1 K"\r\n';
  const before = calls.filter((c) => c[0] === 'taskkill').length;
  await guard.check();
  assert.strictEqual(calls.filter((c) => c[0] === 'taskkill').length, before, 'gone: nothing to do');
  tasks = '"Yapper.exe","9","Console","1","1 K"\r\n';
  await guard.check();
  assert.deepStrictEqual(calls.filter((c) => c[0] === 'taskkill').pop(), ['taskkill', '/IM', 'Yapper.exe', '/T'], 'started again: asked politely again');
  cfg = { enabled: false, names: ['Yapper.exe'] };
  const n = calls.length;
  await guard.check();
  assert.strictEqual(calls.length, n, 'switched off: not even a process list is read');
  cfg = { enabled: true };
  await guard.check();
  assert(calls.slice(n).some((c) => c[0] === 'taskkill' && c.includes('Yapper.exe')), 'default name is Yapper.exe');
  assert.deepStrictEqual(Object.keys(guard.stats), ['checks', 'asked', 'ended']);
});

test('rival guard: does nothing outside Windows, survives a failing tasklist, runs on a timer that can be stopped', async () => {
  const { makeRivalGuard } = require('../src/main/rival');
  let calls = 0;
  const execFile = (_f, _a, _o, cb) => { calls++; cb(new Error('boom'), ''); };
  const linux = makeRivalGuard({ execFile, platform: 'linux', getConfig: () => ({ enabled: true }) });
  await linux.check(); linux.start();
  assert.strictEqual(calls, 0);
  const handles = [];
  const timers = { setInterval: (fn, ms) => { handles.push({ fn, ms, cleared: false }); return handles[handles.length - 1]; }, clearInterval: (h) => { h.cleared = true; } };
  const win = makeRivalGuard({ execFile, platform: 'win32', getConfig: () => { throw new Error('settings broke'); }, timers });
  win.start(); win.start();
  assert.strictEqual(handles.length, 1, 'start twice, one timer');
  assert(handles[0].ms >= 2000);
  await win.check();
  await new Promise((res) => setImmediate(res));
  calls = 0;
  const win2 = makeRivalGuard({ execFile, platform: 'win32', getConfig: () => ({ enabled: true }), timers });
  await win2.check();
  assert.strictEqual(calls, 1, 'one failing tasklist, no taskkill after it');
  win.stop();
  assert.strictEqual(handles[0].cleared, true);
});

test('deepMerge merges objects, replaces arrays, ignores dangerous keys', () => {
  assert.deepStrictEqual(deepMerge({ a: { b: 1, c: 2 }, l: [1, 2] }, { a: { b: 9 }, l: [3] }), { a: { b: 9, c: 2 }, l: [3] });
  const merged = deepMerge({}, JSON.parse('{"__proto__":{"x":1},"constructor":{"y":2},"prototype":{"z":3},"ok":1}'));
  assert.deepStrictEqual(Object.keys(merged), ['ok']);
  assert.strictEqual(({}).x, undefined);
  assert.strictEqual(deepMerge({ a: 1 }, 5), 5);
});

test('SettingsStore: defaults, patch, setPath, replace, flush and reload', () => {
  const dir = path.join(tmp, 'store');
  const s = new SettingsStore(dir);
  s.load();
  assert(fs.existsSync(path.join(dir, 'quickCss.css')), 'quick css file is created');
  assert.deepStrictEqual(Object.keys(s.get().plugins).sort(), Object.keys(DEFAULTS.plugins).sort());
  let events = 0;
  s.onChange(() => events++);
  s.patch({ plugins: { MessageLogger: { logEdits: false } }, window: { autoStart: true } });
  s.setPath('plugins.NewThing.enabled', true);
  s.setPath('__proto__.bad', 1);
  s.setPath('a.constructor.b', 1);
  s.setPath('', 1);
  s.patch('not an object');
  assert.strictEqual(events, 2);
  assert.strictEqual(s.get().window.closeToTray, false, 'sibling keys survive a patch');
  assert.strictEqual(s.get().window.autoStart, true);
  assert.strictEqual(s.get().plugins.MessageLogger.logEdits, false);
  assert.strictEqual(({}).bad, undefined);
  s.flush();
  const s2 = new SettingsStore(dir);
  s2.load();
  assert.strictEqual(s2.get().plugins.NewThing.enabled, true);
  assert.strictEqual(s2.get().plugins.MessageLogger.logEdits, false);
  s2.replace({ plugins: { OnlyOne: { enabled: true } } });
  assert.strictEqual(s2.get().window.closeToTray, false, 'replace still starts from the defaults');
  assert.strictEqual(s2.get().plugins.OnlyOne.enabled, true);
  s2.flush();
  assert(!fs.existsSync(path.join(dir, 'settings.json.tmp')), 'atomic write leaves no temp file');
});

test('SettingsStore: DEFAULTS are never mutated by a store', () => {
  const before = JSON.stringify(DEFAULTS);
  const s = new SettingsStore(path.join(tmp, 'store2'));
  s.load();
  s.setPath('plugins.NoTrack.enabled', false);
  s.setPath('window.bounds', { x: 1 });
  s.get().enabledThemes.push('x.css');
  assert.strictEqual(JSON.stringify(DEFAULTS), before);
  s.flush();
});

test('quick css read/write', () => {
  const s = new SettingsStore(path.join(tmp, 'store3'));
  s.load();
  assert(/Custom CSS/.test(s.readQuickCss()));
  s.writeQuickCss('a{b:c}');
  assert.strictEqual(s.readQuickCss(), 'a{b:c}');
  s.writeQuickCss(undefined);
  assert.strictEqual(s.readQuickCss(), '');
});

test('parseMeta reads Vencord-style headers', () => {
  const css = '/**\n * @name Fancy Theme\n * @author Me\n * @description Looks fancy\n * @version 2.1.0\n * @unknown ignored\n */\nbody{}';
  const m = parseMeta(css, 'fancy.theme.css');
  assert.strictEqual(m.name, 'Fancy Theme');
  assert.strictEqual(m.author, 'Me');
  assert.strictEqual(m.description, 'Looks fancy');
  assert.strictEqual(m.version, '2.1.0');
  assert.strictEqual(m.unknown, undefined);
  const bare = parseMeta('body{}', 'My Cool.theme.css');
  assert.strictEqual(bare.name, 'My Cool');
  assert.strictEqual(bare.author, 'Unknown');
  assert.strictEqual(parseMeta('\ufeff/* @name Bom */', 'x.css').name, 'Bom');
  assert.strictEqual(parseMeta('body{}\n/* @name Late */', 'late.css').name, 'late', 'header must be first');
  assert.strictEqual(parseMeta('/**\r\n * @name Crlf\r\n */', 'c.css').name, 'Crlf');
});

test('safeName only accepts plain css file names', () => {
  assert.strictEqual(safeName('a.theme.css'), 'a.theme.css');
  assert.strictEqual(safeName('Mixed Case.CSS'), 'Mixed Case.CSS');
  for (const bad of ['../a.css', 'a/b.css', 'a\\b.css', '.hidden.css', 'a.txt', 'a.css.exe', '', null, undefined, '/abs.css', 'C:\\a.css', '..']) {
    assert.strictEqual(safeName(bad), null, JSON.stringify(bad));
  }
});

test('ThemeManager: every bundled theme is copied once, deletions stay deleted, edits are kept', () => {
  const dir = path.join(tmp, 'themes');
  const tm = new ThemeManager(dir);
  tm.ensureDir(C.BUNDLED_THEMES_DIR);
  const names = tm.list().map((t) => t.fileName);
  assert(names.length >= 20, 'bundled themes: ' + names.length);
  assert(tm.remove(names[0]));
  fs.writeFileSync(path.join(dir, names[1]), '/** @name Mine @author me @description edited */ :root{--accent:red}');
  tm.ensureDir(C.BUNDLED_THEMES_DIR);
  assert(!tm.list().some((t) => t.fileName === names[0]), 'deleted bundled theme is not re-seeded');
  assert(/edited/.test(fs.readFileSync(path.join(dir, names[1]), 'utf8')), 'an edited theme is not overwritten');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  assert(!tm.list().some((t) => t.fileName === 'notes.txt'), 'non-css files are not listed');
});

test('ThemeManager: themes added in a later version reach existing users (also from the old "seeded once" marker)', () => {
  const bundled = fs.mkdtempSync(path.join(tmp, 'bundled-'));
  for (const f of ['Amoled.theme.css', 'Compact.theme.css', 'Midnight.theme.css']) fs.writeFileSync(path.join(bundled, f), '/** @name ' + f + ' @author a @description d */ :root{}');

  const dir = path.join(tmp, 'themes-legacy');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, '.seeded'), 'seeded');
  fs.copyFileSync(path.join(bundled, 'Amoled.theme.css'), path.join(dir, 'Amoled.theme.css'));
  fs.copyFileSync(path.join(bundled, 'Midnight.theme.css'), path.join(dir, 'Midnight.theme.css'));

  for (const f of ['Nord.theme.css', 'Dracula.theme.css']) fs.writeFileSync(path.join(bundled, f), '/** @name ' + f + ' @author a @description d */ :root{}');
  const tm = new ThemeManager(dir);
  tm.ensureDir(bundled);
  assert.deepStrictEqual(tm.list().map((t) => t.fileName).sort(), ['Amoled.theme.css', 'Dracula.theme.css', 'Midnight.theme.css', 'Nord.theme.css']);
  assert(!fs.existsSync(path.join(dir, 'Compact.theme.css')), 'the theme the user deleted earlier does not come back');

  assert(tm.remove('Nord.theme.css'));
  fs.writeFileSync(path.join(bundled, 'Gruvbox.theme.css'), '/** @name G @author a @description d */ :root{}');
  new ThemeManager(dir).ensureDir(bundled);
  assert.deepStrictEqual(tm.list().map((t) => t.fileName).sort(), ['Amoled.theme.css', 'Dracula.theme.css', 'Gruvbox.theme.css', 'Midnight.theme.css']);

  fs.writeFileSync(path.join(dir, '.seeded.json'), '{not json');
  fs.writeFileSync(path.join(dir, 'Dracula.theme.css'), '/** @name Mine @author me @description mine */ :root{}');
  new ThemeManager(dir).ensureDir(bundled);
  assert(/Mine/.test(fs.readFileSync(path.join(dir, 'Dracula.theme.css'), 'utf8')));

  const fresh = new ThemeManager(path.join(tmp, 'themes-fresh'));
  fresh.ensureDir(bundled);
  assert.strictEqual(fresh.list().length, 6);

  new ThemeManager(path.join(tmp, 'themes-none')).ensureDir(path.join(tmp, 'does-not-exist'));
});

test('bundled themes have headers and balanced CSS', () => {
  const files = fs.readdirSync(C.BUNDLED_THEMES_DIR).filter((f) => f.endsWith('.css'));
  assert(files.length >= 20, 'bundled themes: ' + files.length);
  for (const f of files) {
    const css = fs.readFileSync(path.join(C.BUNDLED_THEMES_DIR, f), 'utf8');
    const meta = parseMeta(css, f);
    assert(meta.name && meta.name !== f.replace(/\.theme\.css$/i, '') || /@name/.test(css), f + ' has a @name');
    assert(meta.author !== 'Unknown' && meta.description, f + ' has author + description');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.strictEqual((stripped.match(/\{/g) || []).length, (stripped.match(/\}/g) || []).length, f + ' braces balance');
    assert(!/@import\s+url\(\s*['"]?https?:/i.test(stripped), f + ' makes no remote requests');
  }
});

test('shouldBlock: telemetry hosts, subdomains, first-party analytics, and never Yapper itself', () => {
  const yes = [
    'https://o99.ingest.sentry.io/api/1/envelope/', 'https://www.google-analytics.com/g/collect', 'https://a.b.hotjar.com/x.js',
    'https://vitals.vercel-insights.com/v1/vitals', 'wss://x.posthog.com/ws', 'https://static.cloudflareinsights.com/beacon.min.js',
    'https://www.yapper.website/_vercel/insights/script.js', 'https://www.yapper.website/_vercel/speed-insights/script.js',
    'https://www.yapper.website/733e0a8345b9f6e4/script.js', 'https://www.yapper.website/BAF2CE63E079444D/view',
  ];
  const no = [
    'https://www.yapper.website/', 'https://www.yapper.website/_next/static/chunks/0abc.js', 'https://www.yapper.website/sounds/message.ogg',
    'https://api.yapper.website/rest/v1/messages', 'wss://api.yapper.website/realtime', 'https://x.supabase.co/auth/v1/token',
    'https://challenges.cloudflare.com/turnstile/v0/api.js', 'https://foo.livekit.cloud/rtc', 'https://example.com/', 'notaurl', 'file:///C:/x.html',
    'https://notsentry.io.example.com/', 'https://www.yapper.website/0123456789abcdef/other', 'https://www.yapper.website/abc/script.js',
  ];
  for (const u of yes) assert.strictEqual(shouldBlock(u), true, 'should block ' + u);
  for (const u of no) assert.strictEqual(shouldBlock(u), false, 'should allow ' + u);
});

test('searchItems: engines, truncation, encoding, safety', () => {
  const { searchItems, TEXT_ENGINES, IMAGE_ENGINES } = require('../src/main/search');
  assert.deepStrictEqual(searchItems({ selectionText: 'x' }, undefined), []);
  assert.deepStrictEqual(searchItems({ selectionText: 'x' }, { enabled: false }), []);
  const on = { enabled: true };
  assert.strictEqual(searchItems({ selectionText: '  hi there  ' }, on)[0].url, 'https://www.google.com/search?q=hi%20there');
  assert.strictEqual(searchItems({ selectionText: 'a'.repeat(60) }, on)[0].label, 'Search Google for "' + 'a'.repeat(24) + '…"');
  assert.strictEqual(searchItems({ selectionText: 'x'.repeat(900) }, on)[0].url.length, 'https://www.google.com/search?q='.length + 500);
  assert.deepStrictEqual(searchItems({ selectionText: 'x', isEditable: true }, on), [], 'no search entry while typing');
  assert.strictEqual(searchItems({ selectionText: 'x' }, { ...on, textEngine: '__proto__' })[0].url.startsWith('https://www.google.com/'), true, 'unknown engines fall back');
  assert.strictEqual(searchItems({ selectionText: 'x' }, { ...on, textEngine: 'constructor' })[0].url.startsWith('https://www.google.com/'), true);
  assert.deepStrictEqual(searchItems({ selectionText: 'x' }, { ...on, text: false }), []);
  for (const k of Object.keys(TEXT_ENGINES)) assert(/^https:\/\/[^?]+[?]\w+=?$|^https:\/\/duckduckgo\.com\/\?q=$/.test(TEXT_ENGINES[k][1]) || TEXT_ENGINES[k][1].endsWith('q='), k);
  for (const k of Object.keys(IMAGE_ENGINES)) assert(IMAGE_ENGINES[k][1].startsWith('https://'), k);
  const img = (srcURL, s) => searchItems({ mediaType: 'image', srcURL }, { ...on, ...s });
  assert.strictEqual(img('https://a.b/c.png', { imageEngine: 'tineye' })[0].url, 'https://tineye.com/search?url=' + encodeURIComponent('https://a.b/c.png'));
  assert.strictEqual(img('javascript:alert(1)').length, 0);
  assert.strictEqual(img('data:image/png;base64,AA').length, 0);
  assert.strictEqual(img('blob:https://x/1').length, 0);
  assert.strictEqual(img('https://a.b/c.png', { images: false }).length, 0);
});

test('bundle: file order, compiles, escapes the initial state', () => {
  const files = listFiles().map((f) => path.relative(C.RENDERER_DIR, f).replace(/\\/g, '/'));
  const core = files.filter((f) => !f.startsWith('plugins/'));
  assert.deepStrictEqual(core, [...core].sort(), 'core files load alphabetically');
  assert(files.indexOf('099-bootstrap.js') < files.findIndex((f) => f.startsWith('plugins/')) || true);
  assert(core[0] === '000-boot.js' && core.includes('030-turbopack.js') && core.includes('040-store.js'));
  const bundle = buildBundle({ evil: '</script><script>alert(1)</script>', n: 1 });
  new vm.Script(bundle);
  assert(!bundle.includes('</script>'), 'initial state cannot break out of a script tag');
  assert(bundle.includes('YM.initial = '));
  assert(bundle.trimEnd().endsWith('//# sourceURL=yappermod://bundle.js'));
  assert(bundle.indexOf('YM.bootstrap.start()') > bundle.lastIndexOf('===== plugins/'), 'plugins are defined before bootstrap starts them');
  for (const f of files) assert(bundle.includes('/* ===== ' + f + ' ===== */'), f + ' is in the bundle');
});

test('bundle: the extension build reads its initial state from localStorage itself instead of a baked-in value, is otherwise identical', () => {
  const appBundle = buildBundle({ n: 1 });
  const extBundle = buildBundleForExtension();
  new vm.Script(extBundle);
  assert(extBundle.includes('localStorage.getItem("yappermod:fallback-settings")'));
  assert(extBundle.includes('localStorage.getItem("yappermod:quickcss")'));
  assert(extBundle.includes('mode: "extension"'), 'marks itself as the extension build');
  assert(!extBundle.includes('"n":1'), 'no app-specific initial state baked into the extension build');
  assert(extBundle.trimEnd().endsWith('//# sourceURL=yappermod://bundle.js'));
  assert(extBundle.indexOf('YM.bootstrap.start()') > extBundle.lastIndexOf('===== plugins/'));

  const stripInitial = (s) => s.replace(/YM\.initial = [^\n]*;\n/, 'YM.initial = X;\n');
  assert.strictEqual(stripInitial(extBundle), stripInitial(appBundle));
});

test('bundle: the bookmarklet build is the same thing again (reads localStorage itself), just labelled differently from the extension', () => {
  const extBundle = buildBundleForExtension();
  const bmBundle = buildBundleForBookmarklet();
  new vm.Script(bmBundle);
  assert(bmBundle.includes('localStorage.getItem("yappermod:fallback-settings")'));
  assert(bmBundle.includes('mode: "bookmarklet"'), 'marks itself as the bookmarklet build, not the extension');
  const stripMode = (s) => s.replace(/mode: "[a-z]+"/, 'mode: "X"');
  assert.strictEqual(stripMode(bmBundle), stripMode(extBundle), 'otherwise byte-for-byte the same build as the extension');
});

test('bookmarklet: the javascript: URI round-trips to the exact same script, and is one that the browser can store as a bookmark/shortcut (no raw newlines, starts with javascript:)', () => {
  const uri = buildUri();
  assert(uri.startsWith('javascript:'));
  assert(!/[\r\n]/.test(uri), 'no literal newline in the URI itself - they are all percent-encoded');
  const decoded = decodeURIComponent(uri.slice('javascript:'.length));
  assert.strictEqual(decoded, buildBundleForBookmarklet());
  new vm.Script(decoded);
});

function loadRenderer(relFile, YM, globals) {
  const src = fs.readFileSync(path.join(C.RENDERER_DIR, relFile), 'utf8');
  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {}, debug() {} }, setTimeout, clearTimeout, URL, URLSearchParams, ...globals,
  });
  const fn = vm.runInContext('(function (YM) {\n' + src + '\n})', ctx, { filename: relFile });
  fn(YM);
  return ctx;
}
function loadPlugin(file) {
  const defs = [];
  const sink = () => new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : sink()), apply: () => sink(), construct: () => sink() });
  const YM = new Proxy({ definePlugin: (d) => (defs.push(d), d) }, { get: (t, k) => (k in t ? t[k] : sink()) });
  loadRenderer(path.join('plugins', file), YM, { window: {}, document: {} });
  return defs;
}

test('util.deepMerge in the renderer is pollution-safe too', () => {
  const YM = {};
  loadRenderer('000-boot.js', YM, { window: {}, document: { readyState: 'complete', addEventListener() {} }, navigator: {} });
  const m = YM.util.deepMerge({ a: { b: 1 } }, JSON.parse('{"a":{"c":2},"__proto__":{"p":1}}'));
  assert.strictEqual(JSON.stringify(m), '{"a":{"b":1,"c":2}}');
  assert.strictEqual(m.p, undefined);
  assert.strictEqual(({}).p, undefined);
  assert.strictEqual(YM.util.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.strictEqual(new RegExp(YM.util.escapeRegex('a.b*c(d)')).test('a.b*c(d)'), true);
  assert.strictEqual(YM.util.pluralize(1, 'plugin'), '1 plugin');
  assert.strictEqual(YM.util.pluralize(3, 'plugin'), '3 plugins');
  assert.strictEqual(YM.util.clamp(15, 0, 10), 10);
});

test('every plugin file defines exactly one well-formed plugin named after the file', () => {
  const dir = path.join(C.RENDERER_DIR, 'plugins');
  const seen = new Set();
  const OPTION_TYPES = ['boolean', 'string', 'number', 'slider', 'select', 'custom'];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const defs = loadPlugin(f);
    assert.strictEqual(defs.length, 1, f + ' defines ' + defs.length + ' plugins');
    const d = defs[0];
    assert.strictEqual(d.name + '.js', f, 'plugin name must match its file name: ' + f);
    assert(!seen.has(d.name), 'duplicate plugin ' + d.name);
    seen.add(d.name);
    assert(typeof d.description === 'string' && d.description.length > 10, d.name + ' needs a description');
    assert(Array.isArray(d.authors) && d.authors.length, d.name + ' needs authors');
    assert(typeof d.start === 'function' || d.patches, d.name + ' needs start() or patches');
    for (const [key, o] of Object.entries(d.options || {})) {
      assert(OPTION_TYPES.includes(o.type), d.name + '.' + key + ' has unknown option type ' + o.type);
      if (o.type !== 'custom') assert('default' in o, d.name + '.' + key + ' needs a default');
      if (o.type === 'select') assert(Array.isArray(o.options) && o.options.length, d.name + '.' + key + ' select needs options');
      if (o.type === 'custom') assert(typeof o.render === 'function', d.name + '.' + key + ' custom needs render()');
    }
  }
  for (const p of Object.keys(DEFAULTS.plugins)) assert(seen.has(p), 'default-enabled plugin ' + p + ' has no file');
  assert(seen.size >= 19);
});

test('ClearURLs removes tracking parameters but keeps real ones', () => {
  const { clean } = loadPlugin('ClearURLs.js')[0].api;
  assert.strictEqual(clean('look https://example.com/a?utm_source=x&id=5&fbclid=abc#top ok', ''), 'look https://example.com/a?id=5#top ok');
  assert.strictEqual(clean('https://example.com/?utm_medium=1.', ''), 'https://example.com/.', 'keeps trailing punctuation');
  assert.strictEqual(clean('(https://youtu.be/abc?si=TRACK&t=42)', ''), '(https://youtu.be/abc?t=42)');
  assert.strictEqual(clean('https://open.spotify.com/track/1?si=abc', ''), 'https://open.spotify.com/track/1');
  assert.strictEqual(clean('https://example.com/?keep=1', ''), 'https://example.com/?keep=1', 'untouched urls are returned verbatim');
  assert.strictEqual(clean('no links here', ''), 'no links here');
  assert.strictEqual(clean('https://example.com/?mine=1&ok=2', 'MINE, other'), 'https://example.com/?ok=2', 'custom params, case-insensitive');
  assert.strictEqual(clean('http://[bad url', ''), 'http://[bad url', 'invalid urls do not throw');
});

test('TextReplace applies plain and regex rules and survives bad patterns', () => {
  const { applyRules } = loadPlugin('TextReplace.js')[0].api;
  assert.strictEqual(applyRules('shrug and shrug', [{ find: 'shrug', replace: '¯\\_(ツ)_/¯' }]), '¯\\_(ツ)_/¯ and ¯\\_(ツ)_/¯');
  assert.strictEqual(applyRules('a.b', [{ find: '.', replace: '!' }]), 'a!b', 'plain text is not a regex');
  assert.strictEqual(applyRules('foo123', [{ find: '\\d+', replace: '#', regex: true }]), 'foo#');
  assert.strictEqual(applyRules('x', [{ find: '(', replace: '', regex: true }]), 'x', 'invalid regex is skipped');
  assert.strictEqual(applyRules('x', [{ find: '', replace: 'y' }, null, {}]), 'x', 'empty rules are skipped');
  assert.strictEqual(applyRules('x', null), 'x');
  assert.strictEqual(applyRules('cat', [{ find: 'cat', replace: 'dog' }, { find: 'dog', replace: 'cow' }]), 'cow', 'rules apply in order');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('  ok   ' + t.name + '\n');
    } catch (err) {
      failed++;
      process.stdout.write('  FAIL ' + t.name + '\n       ' + String((err && err.stack) || err).split('\n').slice(0, 5).join('\n       ') + '\n');
    }
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (_) {

  }
  process.stdout.write(failed ? '\n' + failed + ' of ' + tests.length + ' unit tests FAILED\n' : '\nall ' + tests.length + ' unit tests passed\n');
  process.exit(failed ? 1 : 0);
})();
