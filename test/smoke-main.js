'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const assert = require('assert');
const { EventEmitter } = require('events');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yappermod-smoke-'));
const dataDir = path.join(tmp, 'YapCord');
const TRUSTED_URL = 'https://www.yapper.website/channels/1';

const captured = [];
const realLog = console.log;
const realErr = console.error;
const realWarn = console.warn;
console.log = console.error = console.warn = (...a) => captured.push(a.join(' '));
const out = (s) => process.stdout.write(s + '\n');

const ipcHandlers = new Map();
const ipcListeners = new Map();
const rec = {
  openExternal: [], openPath: [], badge: [], relaunch: 0, exit: [], quit: 0, loginItem: [], switches: [],
  menus: [], appMenu: null, popups: 0, clipboard: [], overlay: [],
};
let netNext = async () => { throw new Error('no network in tests'); };
const dialogNext = { open: { canceled: true, filePaths: [] }, save: { canceled: true } };

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.url = '';
    this.sent = [];
    this.reloadedIgnoringCache = 0;
    this.devtoolsToggled = 0;
    this.session = { setSpellCheckerEnabled() {} };
  }
  getURL() { return this.url; }
  getUserAgent() { return 'Mozilla/5.0 Chrome/140.0 Electron/38.0 YapperMod/0.0.1'; }
  setUserAgent(ua) { this.ua = ua; }
  setWindowOpenHandler(fn) { this.windowOpenHandler = fn; }
  send(...a) { this.sent.push(a); }
  executeJavaScript() { return Promise.resolve(); }
  reload() { this.reloaded = (this.reloaded || 0) + 1; }
  reloadIgnoringCache() { this.reloadedIgnoringCache++; }
  toggleDevTools() { this.devtoolsToggled++; }
  setZoomFactor(f) { this.zoom = f; }
  replaceMisspelling(s) { this.replaced = s; }
}

class FakeBrowserWindow extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = opts;
    this.webContents = new FakeWebContents();
    this.calls = [];
    FakeBrowserWindow.instances.push(this);
  }
  loadURL(url) { this.webContents.url = url; this.calls.push(['loadURL', url]); return Promise.resolve(); }
  loadFile(f, o) { this.calls.push(['loadFile', f, o]); return Promise.resolve(); }
  show() { this.calls.push(['show']); }
  hide() { this.calls.push(['hide']); }
  focus() { this.calls.push(['focus']); }
  restore() { this.calls.push(['restore']); }
  maximize() { this.calls.push(['maximize']); }
  close() { this.calls.push(['close']); }
  removeMenu() {}
  isMinimized() { return false; }
  isMaximized() { return false; }
  isDestroyed() { return false; }
  getBounds() { return { x: 11, y: 22, width: 1111, height: 777 }; }
  setOverlayIcon(img, text) { rec.overlay.push([img, text]); }
  setIcon(img) { this.icons = (this.icons || []).concat([img]); }
}
FakeBrowserWindow.instances = [];

const webRequest = { before: null, headers: null };
const sessionMock = {
  webRequest: {
    onBeforeRequest(filter, cb) { webRequest.before = { filter, cb }; },
    onHeadersReceived(filter, cb) { webRequest.headers = { filter, cb }; },
  },
  setPermissionRequestHandler(fn) { sessionMock.permRequest = fn; },
  setPermissionCheckHandler(fn) { sessionMock.permCheck = fn; },
  setDisplayMediaRequestHandler(fn, opts) { sessionMock.displayMedia = { fn, opts }; },
};

const app = Object.assign(new EventEmitter(), {
  paths: {},
  _name: '',
  setName(n) { this._name = n; },
  getName() { return this._name; },
  setAppUserModelId() {},
  getPath(k) { return this.paths[k] || (k === 'appData' ? tmp : path.join(tmp, k)); },
  setPath(k, v) { this.paths[k] = v; },
  requestSingleInstanceLock() { return true; },
  quit() { rec.quit++; },
  exit(c) { rec.exit.push(c); },
  relaunch() { rec.relaunch++; },
  getVersion() { return '9.9.9'; },
  setBadgeCount(n) { rec.badge.push(n); },
  setLoginItemSettings(o) { rec.loginItem.push(o); },
  disableHardwareAcceleration() { rec.switches.push('no-hw'); },
  commandLine: { appendSwitch(...a) { rec.switches.push(a.join('=')); } },
  whenReady() { return Promise.resolve(); },
});

class FakeTray extends EventEmitter {
  constructor(img) { super(); this.img = img; this.images = []; FakeTray.instances.push(this); }
  setImage(img) { this.images.push(img); this.img = img; }
  isDestroyed() { return false; }
  setToolTip(t) { this.tip = t; }
  setContextMenu(m) { this.menu = m; }
}
FakeTray.instances = [];

const electronMock = {
  app,
  BrowserWindow: FakeBrowserWindow,
  Tray: FakeTray,
  Menu: {
    buildFromTemplate(template) {
      const m = { template, popup() { rec.popups++; } };
      rec.menus.push(m);
      return m;
    },
    setApplicationMenu(m) { rec.appMenu = m; },
  },
  nativeImage: {
    createFromPath(p) {
      return { p, isEmpty: () => !fs.existsSync(p), resize() { return this; } };
    },
    createFromDataURL(u) { return { dataUrl: u }; },
    createFromBuffer(b) { return { buf: b, isEmpty: () => !b || b.length < 4, resize() { return this; }, toPNG() { return Buffer.from('PNG-BYTES'); } }; },
  },
  session: { defaultSession: sessionMock },
  shell: {
    openExternal(u) { rec.openExternal.push(u); return Promise.resolve(); },
    openPath(p) { rec.openPath.push(p); return Promise.resolve(''); },
  },
  dialog: {
    showOpenDialog: async () => dialogNext.open,
    showSaveDialog: async () => dialogNext.save,
  },
  clipboard: { writeText(t) { rec.clipboard.push(t); } },
  net: { fetch: async (url, init) => netNext(url, init) },
  desktopCapturer: { getSources: async () => [] },
  ipcMain: {
    handle(ch, fn) { ipcHandlers.set(ch, fn); },
    on(ch, fn) { ipcListeners.set(ch, fn); },
    removeListener() {},
  },
};

const rendererListeners = new Map();
const rec2 = { exposed: {}, executed: [], invoked: [], sendSync: [] };
let preloadEvent = null;
const preloadMock = {
  contextBridge: { exposeInMainWorld(name, api) { rec2.exposed[name] = api; } },
  webFrame: { executeJavaScript(code) { rec2.executed.push(code); return Promise.resolve(); } },
  ipcRenderer: {
    on(ch, fn) { rendererListeners.set(ch, fn); },
    invoke(ch, ...args) {
      rec2.invoked.push([ch, ...args]);
      const h = ipcHandlers.get(ch);
      if (!h) return Promise.reject(new Error('no handler ' + ch));
      return h(preloadEvent, ...args);
    },
    sendSync(ch) {
      rec2.sendSync.push(ch);
      const ev = { ...preloadEvent, returnValue: undefined };
      ipcListeners.get(ch)(ev);
      return ev.returnValue;
    },
  },
};

let mockMode = 'main';
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return mockMode === 'preload' ? preloadMock : electronMock;
  return origLoad.apply(this, arguments);
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const win = () => FakeBrowserWindow.instances[0];
const trustedEvent = () => ({ sender: win().webContents, senderFrame: { url: TRUSTED_URL } });
const invoke = (ch, ...a) => ipcHandlers.get(ch)(trustedEvent(), ...a);
const readSettingsFile = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'settings', 'settings.json'), 'utf8'));
const withPlatform = async (platform, fn) => {
  const orig = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'platform', orig);
  }
};
const rejects = async (p, re) => {
  let err = null;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  assert(err, 'expected a rejection');
  if (re) assert(re.test(err.message), 'unexpected error: ' + err.message);
};

test('main process boots with the mocked electron', async () => {
  require('../src/main/index.js');
  await sleep(50);
  assert.strictEqual(app.getName(), 'YapCord');
  assert.strictEqual(app.paths.userData, dataDir, 'userData must be %APPDATA%/YapCord');
  assert.strictEqual(FakeBrowserWindow.instances.length, 1, 'exactly one window');
  assert(rec.appMenu, 'application menu set');
  assert(fs.existsSync(path.join(dataDir, 'logs', 'main.log')), 'log file created');
  assert(rec.switches.includes('no-proxy-server'), 'Windows proxy auto-detection is skipped by default, before the app is ready');
});

test('window uses the secure web preferences and loads yapper.website', () => {
  const w = win();
  const p = w.opts.webPreferences;
  assert.strictEqual(p.sandbox, true);
  assert.strictEqual(p.contextIsolation, true);
  assert.strictEqual(p.nodeIntegration, false);
  assert(fs.existsSync(p.preload), 'preload file exists: ' + p.preload);
  assert.strictEqual(path.resolve(p.preload), path.join(ROOT, 'src', 'preload', 'index.js'));
  assert(fs.existsSync(w.opts.icon), 'window icon exists');
  assert.deepStrictEqual(w.calls.find((c) => c[0] === 'loadURL'), ['loadURL', 'https://www.yapper.website/']);
  assert(!w.calls.some((c) => c[0] === 'show'), 'stays hidden until ready-to-show');
  w.emit('ready-to-show');
  assert(w.calls.some((c) => c[0] === 'show'), 'shown on ready-to-show');
  assert(/YapCord\/9\.9\.9$/.test(w.webContents.ua) && !/YapperMod\/0\.0\.1/.test(w.webContents.ua) && !/YapperMod/.test(w.webContents.ua), 'user agent tagged once, with the new name');
});

test('tray is created with the real icon', () => {
  assert.strictEqual(FakeTray.instances.length, 1);
  assert(!FakeTray.instances[0].img.isEmpty(), 'tray icon exists');
  assert(FakeTray.instances[0].menu);
});

test('themes are seeded from the bundled folder', async () => {
  const list = await invoke('ym:themes:list');
  const names = list.map((t) => t.name);
  for (const n of ['Midnight', 'Amoled', 'Compact']) assert(names.includes(n), 'missing bundled theme ' + n + ' in ' + names);
  const midnight = list.find((t) => t.name === 'Midnight');
  assert(midnight.author && midnight.author !== 'Unknown', 'theme header parsed');
});

const decide = (url) => new Promise((resolve) => webRequest.before.cb({ url }, resolve));

test('netfilter blocks trackers, keeps Yapper + captcha working', async () => {
  assert(webRequest.before && webRequest.headers, 'both listeners installed');
  assert((await decide('https://o123.ingest.sentry.io/api/1/envelope/')).cancel === true);
  assert((await decide('https://www.google-analytics.com/g/collect')).cancel === true);
  assert((await decide('https://www.yapper.website/733e0a8345b9f6e4/script.js')).cancel === true, 'first-party Vercel analytics');
  assert((await decide('https://www.yapper.website/_vercel/insights/script.js')).cancel === true);
  assert(!(await decide('https://www.yapper.website/_next/static/chunks/app.js')).cancel);
  assert(!(await decide('https://www.yapper.website/')).cancel);
  assert(!(await decide('https://challenges.cloudflare.com/turnstile/v0/api.js')).cancel);
  assert(!(await decide('https://api.yapper.website/rest/v1/messages')).cancel);
  assert(!(await decide('wss://api.yapper.website/realtime')).cancel);
  assert(!(await decide('https://abc.supabase.co/auth/v1/token')).cancel);
});

test('netfilter respects the NoTrack switch and reports stats', async () => {
  await invoke('ym:settings:set', 'plugins.NoTrack.enabled', false);
  assert(!(await decide('https://o1.ingest.sentry.io/x')).cancel, 'tracking allowed when NoTrack is off');
  await invoke('ym:settings:set', 'plugins.NoTrack.enabled', true);
  assert((await decide('https://o1.ingest.sentry.io/x')).cancel === true);
  const info = await invoke('ym:app:info');
  assert(info.netfilter.enabled && info.netfilter.blocked >= 5 && info.netfilter.recent.length > 0);
});

test('CSP is stripped on Yapper pages only (filter restricts to yapper.website)', async () => {
  assert(webRequest.headers.filter.urls.every((u) => /yapper\.website/.test(u)), 'filter only covers yapper.website');
  const res = await new Promise((resolve) =>
    webRequest.headers.cb(
      { responseHeaders: { 'Content-Security-Policy': ["default-src 'self'"], 'content-security-policy-report-only': ['x'], 'X-Other': ['keep'] } },
      resolve,
    ),
  );
  assert(!Object.keys(res.responseHeaders).some((k) => /content-security-policy/i.test(k)));
  assert.deepStrictEqual(res.responseHeaders['X-Other'], ['keep']);
});

test('permissions are only granted to Yapper origins', () => {
  const ask = (permission, url) =>
    new Promise((resolve) => sessionMock.permRequest(win().webContents, permission, resolve, { requestingUrl: url }));
  return Promise.all([
    ask('media', 'https://www.yapper.website/').then((v) => assert.strictEqual(v, true)),
    ask('notifications', 'https://yapper.website/').then((v) => assert.strictEqual(v, true)),
    ask('media', 'https://evil.example/').then((v) => assert.strictEqual(v, false)),
    ask('media', 'https://yapper.website.evil.example/').then((v) => assert.strictEqual(v, false)),
    ask('geolocation', 'https://www.yapper.website/').then((v) => assert.strictEqual(v, false)),
    ask('openExternal', 'https://www.yapper.website/').then((v) => assert.strictEqual(v, false)),
  ]).then(() => {
    assert.strictEqual(sessionMock.permCheck(win().webContents, 'media', 'https://www.yapper.website'), true);
    assert.strictEqual(sessionMock.permCheck(win().webContents, 'media', 'https://evil.example'), false);
  });
});

test('screen-share handler is registered with the custom picker', () => {
  assert(sessionMock.displayMedia && typeof sessionMock.displayMedia.fn === 'function');
  assert.strictEqual(sessionMock.displayMedia.opts.useSystemPicker, false);
  assert(fs.existsSync(path.join(ROOT, 'src', 'main', 'picker', 'picker.html')));
  assert(fs.existsSync(path.join(ROOT, 'src', 'main', 'picker', 'picker-preload.js')));
});

test('navigation: foreign links open in the system browser, never in the app', () => {
  const wc = win().webContents;
  rec.openExternal.length = 0;
  let prevented = 0;
  const nav = (url) => wc.emit('will-navigate', { preventDefault: () => prevented++ }, url);
  nav('https://www.yapper.website/channels/2');
  assert.strictEqual(prevented, 0, 'yapper navigation stays inside');
  nav('https://evil.example/phish');
  assert.strictEqual(prevented, 1);
  assert.deepStrictEqual(rec.openExternal, ['https://evil.example/phish']);
  nav('javascript:alert(1)');
  assert.strictEqual(prevented, 2);
  assert.strictEqual(rec.openExternal.length, 1, 'javascript: is never opened');
  assert.deepStrictEqual(wc.windowOpenHandler({ url: 'https://example.org/' }), { action: 'deny' });
  assert.strictEqual(rec.openExternal.length, 2);
  wc.windowOpenHandler({ url: 'file:///C:/Windows/System32/calc.exe' });
  wc.windowOpenHandler({ url: 'ms-msdt:/id' });
  assert.strictEqual(rec.openExternal.length, 2, 'file: and custom protocols are refused');

  prevented = 0;
  nav('file:///C:/Users/me/evil.html');
  assert.strictEqual(prevented, 1, 'file:// navigation is blocked');
  assert.strictEqual(rec.openExternal.length, 2, 'and never handed to the shell');
  const redirect = (url) => wc.emit('will-redirect', { preventDefault: () => prevented++ }, url);
  redirect('https://www.yapper.website/channels/3');
  assert.strictEqual(prevented, 1, 'redirects inside Yapper are fine');
  redirect('https://evil.example/login');
  assert.strictEqual(prevented, 2, 'redirects to other sites are blocked');
  assert.strictEqual(rec.openExternal[rec.openExternal.length - 1], 'https://evil.example/login');
});

test('context menu only opens http(s)/mailto links', () => {
  const wc = win().webContents;
  rec.openExternal.length = 0;
  rec.menus.length = 0;
  wc.emit('context-menu', {}, {
    misspelledWord: 'helo', dictionarySuggestions: ['hello', 'help'], linkURL: 'https://example.com/a',
    isEditable: true, editFlags: { canCut: true, canCopy: true, canPaste: true },
  });
  const items = rec.menus[0].template;
  assert(items.some((i) => i.label === 'hello') && items.some((i) => i.label === 'Open link in browser'));
  items.find((i) => i.label === 'Open link in browser').click();
  assert.deepStrictEqual(rec.openExternal, ['https://example.com/a']);
  wc.emit('context-menu', {}, { linkURL: 'javascript:alert(1)', isEditable: false, selectionText: '', editFlags: {} });
  rec.menus[1].template.find((i) => i.label === 'Open link in browser').click();
  assert.strictEqual(rec.openExternal.length, 1, 'javascript: link refused');
});

test('context menu: SearchContextMenu adds web/image search only when enabled, only http(s)', async () => {
  const wc = win().webContents;
  const open = (params) => { rec.menus.length = 0; wc.emit('context-menu', {}, { isEditable: false, editFlags: {}, ...params }); return rec.menus[0] ? rec.menus[0].template : []; };
  assert(!open({ selectionText: 'cats' }).some((i) => /Search/.test(i.label || '')), 'off by default');
  await invoke('ym:settings:set', 'plugins.SearchContextMenu.enabled', true);
  rec.openExternal.length = 0;
  const t = open({ selectionText: 'funny cats & dogs', mediaType: 'image', srcURL: 'https://cdn.example.com/a b.png?x=1&y=2' });
  const text = t.find((i) => /^Search Google for/.test(i.label || ''));
  const img = t.find((i) => /^Search image with Google Lens/.test(i.label || ''));
  assert(text && img, 'both entries: ' + JSON.stringify(t.map((i) => i.label)));
  text.click();
  img.click();
  assert.strictEqual(rec.openExternal[0], 'https://www.google.com/search?q=funny%20cats%20%26%20dogs');
  assert.strictEqual(rec.openExternal[1], 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent('https://cdn.example.com/a b.png?x=1&y=2'));
  assert(!open({ mediaType: 'image', srcURL: 'javascript:alert(1)' }).some((i) => /Search image/.test(i.label || '')), 'javascript: image refused');
  assert(!open({ mediaType: 'image', srcURL: 'file:///C:/secret.png' }).some((i) => /Search image/.test(i.label || '')), 'file: image refused');
  assert(!open({ mediaType: 'image', srcURL: 'data:image/png;base64,AAAA' }).some((i) => /Search image/.test(i.label || '')), 'data: image refused');
  await invoke('ym:settings:set', 'plugins.SearchContextMenu.textEngine', 'duckduckgo');
  assert(open({ selectionText: 'x' }).some((i) => /^Search DuckDuckGo for/.test(i.label || '')));
  await invoke('ym:settings:set', 'plugins.SearchContextMenu.enabled', false);
  assert(!open({ selectionText: 'cats' }).some((i) => /Search/.test(i.label || '')), 'off again');
});

test('did-fail-load shows the offline page (but not for aborted loads / subframes)', () => {
  const w = win();
  const before = w.calls.filter((c) => c[0] === 'loadFile').length;
  w.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'https://www.yapper.website/', true);
  w.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://x/', false);
  assert.strictEqual(w.calls.filter((c) => c[0] === 'loadFile').length, before);
  w.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://www.yapper.website/', true);
  const call = w.calls.filter((c) => c[0] === 'loadFile').pop();
  assert(/offline\.html$/.test(call[1]) && fs.existsSync(call[1]));
  assert.strictEqual(call[2].query.u, 'https://www.yapper.website/');
});

test('console-message handler accepts both the old and the new Electron signature', () => {
  const wc = win().webContents;
  wc.emit('console-message', { level: 'error', message: '[YapperMod] new style' });
  wc.emit('console-message', {}, 3, '[YapperMod] old style');
  wc.emit('console-message', {}, 0, 'ordinary page log');
  const log = fs.readFileSync(path.join(dataDir, 'logs', 'main.log'), 'utf8');
  assert(/new style/.test(log) && /old style/.test(log) && !/ordinary page log/.test(log));
});

test('IPC refuses untrusted senders on every channel', async () => {
  const bad = [
    { sender: {}, senderFrame: { url: TRUSTED_URL } },
    { sender: win().webContents, senderFrame: { url: 'https://evil.example/' } },
    { sender: win().webContents, senderFrame: { url: 'https://yapper.website.evil.example/' } },
    { sender: win().webContents, senderFrame: { url: 'http://www.yapper.website/' } },
    { sender: win().webContents, senderFrame: { url: 'file:///C:/x.html' } },
    { sender: win().webContents, senderFrame: { url: 'not a url' } },
  ];
  assert(ipcHandlers.size >= 17, 'handlers registered: ' + ipcHandlers.size);
  for (const [channel, fn] of ipcHandlers) {
    for (const ev of bad) await rejects(fn(ev, 'x', 'y'), /untrusted sender/);
    assert(channel.startsWith('ym:'), 'unexpected channel ' + channel);
  }
  const ev = { sender: {}, senderFrame: { url: TRUSTED_URL }, returnValue: 'unset' };
  ipcListeners.get('ym:get-bundle')(ev);
  assert.strictEqual(ev.returnValue, '', 'bundle is not handed to strangers');
});

test('settings: defaults, set/patch, persistence to disk', async () => {
  const s = await invoke('ym:settings:get');
  for (const p of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton']) {
    assert.strictEqual((s.plugins[p] || {}).enabled, undefined, p + ' is not on by default');
  }
  await invoke('ym:settings:set', 'plugins.MessageLogger.enabled', false);
  await invoke('ym:settings:set', 'plugins.MessageLogger.deleteStyle', 'overlay');
  await invoke('ym:settings:set', 'plugins.OnePingPerDM.enabled', true);
  await invoke('ym:settings:patch', { plugins: { OnePingPerDM: { allowMentions: true } }, enabledThemes: ['Midnight.theme.css'] });
  const now = await invoke('ym:settings:get');
  assert.strictEqual(now.plugins.MessageLogger.enabled, false);
  assert.strictEqual(now.plugins.MessageLogger.deleteStyle, 'overlay');
  assert.strictEqual(now.plugins.OnePingPerDM.enabled, true, 'patch merges, does not clobber a sibling key set just before it');
  assert.strictEqual(now.plugins.OnePingPerDM.allowMentions, true);
  await sleep(400);
  const disk = readSettingsFile();
  assert.strictEqual(disk.plugins.MessageLogger.enabled, false);
  assert.deepStrictEqual(disk.enabledThemes, ['Midnight.theme.css']);
  await invoke('ym:settings:set', 'plugins.MessageLogger.enabled', true);
});

test('settings: prototype pollution is impossible', async () => {
  await invoke('ym:settings:patch', JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}}}'));
  await invoke('ym:settings:set', '__proto__.polluted3', 'yes');
  await invoke('ym:settings:set', 'plugins.__proto__.polluted4', 'yes');
  await invoke('ym:settings:set', 'constructor.prototype.polluted5', 'yes');
  const o = {};
  for (const k of ['polluted', 'polluted2', 'polluted3', 'polluted4', 'polluted5']) assert.strictEqual(o[k], undefined, k + ' leaked');
  assert.strictEqual(({}).constructor.prototype.polluted5, undefined);
});

test('settings: a corrupt settings.json is kept as a copy and defaults load', () => {
  const { SettingsStore } = require('../src/main/settings');
  const d = path.join(tmp, 'corrupt-settings');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'settings.json'), '{ this is not json');
  const s = new SettingsStore(d);
  s.load();
  assert.deepStrictEqual(s.get().plugins, {}, 'defaults loaded (nothing on by default)');
  assert.strictEqual(s.get().window.spellcheck, true, 'defaults loaded');
  assert(fs.readdirSync(d).some((f) => f.startsWith('settings.json.broken-')), 'broken copy kept');
});

test('quick css round trip', async () => {
  await invoke('ym:quickcss:set', 'body{outline:1px solid red}');
  assert.strictEqual(await invoke('ym:quickcss:get'), 'body{outline:1px solid red}');
});

test('windows-only settings: autostart + overlay badge', async () => {
  await withPlatform('win32', async () => {
    await invoke('ym:settings:set', 'window.autoStart', true);
    await invoke('ym:settings:set', 'window.startMinimized', true);
    const last = rec.loginItem[rec.loginItem.length - 1];
    assert.deepStrictEqual(last, { openAtLogin: true, args: ['--hidden'] });
    await invoke('ym:settings:set', 'window.autoStart', false);
    await invoke('ym:settings:set', 'window.startMinimized', false);
    rec.overlay.length = 0;
    await invoke('ym:badge', 7, 'data:image/png;base64,AAAA');
    assert.strictEqual(rec.overlay.length, 1);
    assert.strictEqual(rec.overlay[0][1], '7 unread');
    await invoke('ym:badge', 3, 'data:text/html;base64,AAAA');
    assert.strictEqual(rec.overlay[1][0], null);
    await invoke('ym:badge', 0, 'data:image/png;base64,AAAA');
    assert.strictEqual(rec.overlay[2][0], null);
  });
});

test('badge count is clamped', async () => {
  rec.badge.length = 0;
  await invoke('ym:badge', -4);
  await invoke('ym:badge', 123456);
  await invoke('ym:badge', 'abc');
  await invoke('ym:badge', 12);
  assert.deepStrictEqual(rec.badge, [0, 9999, 0, 12]);
});

test('themes: read is confined to the themes folder', async () => {
  assert(/@name/.test(await invoke('ym:themes:read', 'Midnight.theme.css')));
  for (const bad of ['../settings/settings.json', '..\\settings\\settings.json', '/etc/passwd', 'C:\\Windows\\win.ini', '.hidden.css', 'notcss.txt', '', null]) {
    assert.strictEqual(await invoke('ym:themes:read', bad), '', 'must not read ' + bad);
  }
  assert.strictEqual(await invoke('ym:themes:remove', '../YapperMod/settings/settings.json'), false);
  assert.strictEqual(await invoke('ym:themes:remove', '..\\x.css'), false);
  assert(fs.existsSync(path.join(dataDir, 'settings', 'settings.json')));
});

test('themes: import (including duplicate names), non-css refused, remove', async () => {
  const src = path.join(tmp, 'My Theme.theme.css');
  fs.writeFileSync(src, '/**\n * @name My Theme\n * @author Tester\n * @description hi\n */\nbody{color:red}');
  dialogNext.open = { canceled: false, filePaths: [src] };
  assert.deepStrictEqual(await invoke('ym:themes:import'), ['My Theme.theme.css']);
  const again = await invoke('ym:themes:import');
  assert.strictEqual(again.length, 1);
  assert(again[0] !== 'My Theme.theme.css' && /\.theme\.css$/.test(again[0]), 'second import renamed: ' + again[0]);
  const txt = path.join(tmp, 'evil.txt');
  fs.writeFileSync(txt, 'nope');
  dialogNext.open = { canceled: false, filePaths: [txt] };
  assert.deepStrictEqual(await invoke('ym:themes:import'), []);
  dialogNext.open = { canceled: true, filePaths: [] };
  assert.deepStrictEqual(await invoke('ym:themes:import'), []);
  const mine = (await invoke('ym:themes:list')).find((t) => t.fileName === 'My Theme.theme.css');
  assert.strictEqual(mine.name, 'My Theme');
  assert.strictEqual(mine.author, 'Tester');
  assert.strictEqual(await invoke('ym:themes:remove', again[0]), true);
  assert.strictEqual(await invoke('ym:themes:remove', 'My Theme.theme.css'), true);
  assert.strictEqual(await invoke('ym:themes:remove', 'My Theme.theme.css'), false);
});

test('theme and quick-css folder watchers tell the page about changes', async () => {
  const wc = win().webContents;
  wc.sent.length = 0;
  fs.writeFileSync(path.join(dataDir, 'themes', 'Watched.theme.css'), '/** @name Watched */\na{b:c}');
  await invoke('ym:quickcss:set', '/* changed on disk */');
  await sleep(900);
  const channels = wc.sent.map((s) => s[0]);
  assert(channels.includes('ym:themes-changed'), 'themes-changed sent, got ' + channels);
  assert(channels.includes('ym:quickcss-changed'), 'quickcss-changed sent, got ' + channels);
  const payload = wc.sent.find((s) => s[0] === 'ym:themes-changed')[1];
  assert(payload.some((t) => t.name === 'Watched'));
  await invoke('ym:themes:remove', 'Watched.theme.css');
});

test('open-external only opens http(s) and mailto', async () => {
  rec.openExternal.length = 0;
  await invoke('ym:open-external', 'https://example.com/x');
  await invoke('ym:open-external', 'http://example.com/');
  await invoke('ym:open-external', 'mailto:someone@example.com');
  for (const bad of ['file:///C:/Windows/System32/cmd.exe', 'javascript:alert(1)', 'ms-msdt:/x', 'smb://host/share', '\\\\host\\share', 'calc.exe', '']) {
    await rejects(invoke('ym:open-external', bad), /blocked url/);
  }
  assert.deepStrictEqual(rec.openExternal, ['https://example.com/x', 'http://example.com/', 'mailto:someone@example.com']);
});

test('open-path only knows the four app folders', async () => {
  rec.openPath.length = 0;
  for (const k of ['data', 'themes', 'settings', 'logs']) assert.strictEqual(await invoke('ym:open-path', k), '');
  assert.strictEqual(rec.openPath.length, 4);
  assert(rec.openPath.every((p) => p.startsWith(dataDir)));
  for (const bad of ['../..', 'C:\\', '/etc', '', undefined, '__proto__', 'constructor']) await rejects(invoke('ym:open-path', bad), /unknown path/);
});

test('app: info, reload, devtools, relaunch, quit', async () => {
  const info = await invoke('ym:app:info');
  assert.strictEqual(info.version, '9.9.9');
  assert.strictEqual(info.dataDir, dataDir);
  assert.strictEqual(info.themesDir, path.join(dataDir, 'themes'));
  assert(info.logFile.endsWith('main.log'));
  await invoke('ym:app:reload');
  assert.strictEqual(win().webContents.reloadedIgnoringCache, 1);
  assert.strictEqual(await invoke('ym:app:devtools'), true);
  await invoke('ym:settings:set', 'window.devTools', false);
  assert.strictEqual(await invoke('ym:app:devtools'), false);
  assert.strictEqual(win().webContents.devtoolsToggled, 1);
  await invoke('ym:settings:set', 'window.devTools', true);
  await invoke('ym:app:relaunch');
  assert.strictEqual(rec.relaunch, 1);
  assert.deepStrictEqual(rec.exit, [0]);
  await invoke('ym:app:quit');
  assert.strictEqual(rec.quit, 1);
});

test('files: the own file dialog returns the chosen files, nothing on cancel, and ignores bad options', async () => {
  const f1 = path.join(tmp, 'pick-me.png'); fs.writeFileSync(f1, Buffer.from([9, 8, 7]));
  dialogNext.open = { canceled: false, filePaths: [f1] };
  const got = await invoke('ym:files:pick', { accept: 'image/*', multiple: true });
  assert.deepStrictEqual(got.map((f) => [f.name, f.type, f.size, [...f.data]]), [['pick-me.png', 'image/png', 3, [9, 8, 7]]]);
  dialogNext.open = { canceled: true, filePaths: [] };
  assert.deepStrictEqual(await invoke('ym:files:pick', { accept: '.zip' }), []);
  dialogNext.open = { canceled: false, filePaths: [f1] };
  assert.strictEqual((await invoke('ym:files:pick', 'not an object')).length, 1);
  assert.strictEqual((await invoke('ym:files:pick', { accept: { toString() { throw new Error('x'); } } })).length, 1);
  dialogNext.open = { canceled: true, filePaths: [] };
});

test('net: only pictures from Yapper\'s own file hosts, https, no redirects', async () => {
  const seen = [];
  netNext = async (url, init) => {
    seen.push([url, init.redirect]);
    return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'image/png; charset=x' : null) }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
  };
  const got = await invoke('ym:net:image', 'https://pub-abc123.r2.dev/avatars/u/a.png');
  assert.strictEqual(got.type, 'image/png');
  assert.deepStrictEqual([...got.data], [1, 2, 3]);
  assert.deepStrictEqual(seen, [['https://pub-abc123.r2.dev/avatars/u/a.png', 'error']]);
  assert.strictEqual((await invoke('ym:net:image', 'https://www.yapper.website/x.png')).type, 'image/png');
  for (const bad of ['http://pub-abc.r2.dev/a.png', 'https://evil.example/a.png', 'https://r2.dev/a.png', 'https://pub.r2.dev.evil.example/a.png', 'https://user:pw@pub.r2.dev/a.png', 'https://pub.r2.dev:8443/a.png', 'file:///C:/a.png', 'ftp://pub.r2.dev/a.png', 'not a url', '']) {
    await rejects(invoke('ym:net:image', bad), /blocked url/);
  }
  assert.strictEqual(seen.length, 2, 'blocked urls never reach the network');
  netNext = async () => ({ ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html' : null) }, arrayBuffer: async () => new ArrayBuffer(1) });
  await rejects(invoke('ym:net:image', 'https://pub-x.r2.dev/a'), /not a picture/);
  netNext = async () => ({ ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'image/png' : k.toLowerCase() === 'content-length' ? String(50 * 1024 * 1024) : null) }, arrayBuffer: async () => new ArrayBuffer(1) });
  await rejects(invoke('ym:net:image', 'https://pub-x.r2.dev/a.png'), /too large/);
  netNext = async () => ({ ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) });
  await rejects(invoke('ym:net:image', 'https://pub-x.r2.dev/a.png'), /HTTP 404/);
});

test('backup: export then import restores settings, css and themes', async () => {
  await invoke('ym:settings:set', 'plugins.NoTrack.enabled', true);
  await invoke('ym:settings:set', 'plugins.MessageLogger.logEdits', false);
  await invoke('ym:quickcss:set', '/* my css */');
  const file = path.join(tmp, 'backup.json');
  dialogNext.save = { canceled: false, filePath: file };
  assert.strictEqual(await invoke('ym:backup:export'), true);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data.format, 'yapcord-backup');
  assert.strictEqual(data.settings.plugins.MessageLogger.logEdits, false);
  assert.strictEqual(data.quickCss, '/* my css */');
  assert(data.themes['Midnight.theme.css'], 'themes included');

  await invoke('ym:settings:set', 'plugins.MessageLogger.logEdits', true);
  await invoke('ym:quickcss:set', 'x{}');
  await invoke('ym:themes:remove', 'Midnight.theme.css');
  dialogNext.open = { canceled: false, filePaths: [file] };
  assert.deepStrictEqual(await invoke('ym:backup:import'), { ok: true });
  assert.strictEqual((await invoke('ym:settings:get')).plugins.MessageLogger.logEdits, false);
  assert.strictEqual(await invoke('ym:quickcss:get'), '/* my css */');
  assert(/@name/.test(await invoke('ym:themes:read', 'Midnight.theme.css')), 'theme restored');
  dialogNext.save = { canceled: true };
  assert.strictEqual(await invoke('ym:backup:export'), false);
});

test('backup: rejects garbage and never writes outside the themes folder', async () => {
  const bad1 = path.join(tmp, 'bad1.json');
  fs.writeFileSync(bad1, 'not json at all');
  dialogNext.open = { canceled: false, filePaths: [bad1] };
  assert.strictEqual((await invoke('ym:backup:import')).ok, false);

  const bad2 = path.join(tmp, 'bad2.json');
  fs.writeFileSync(bad2, JSON.stringify({ format: 'something-else', settings: {} }));
  dialogNext.open = { canceled: false, filePaths: [bad2] };
  const r2 = await invoke('ym:backup:import');
  assert.strictEqual(r2.ok, false);
  assert(/not a YapCord backup/.test(r2.reason));

  const evil = path.join(tmp, 'evil-backup.json');
  fs.writeFileSync(evil, JSON.stringify({
    format: 'yappermod-backup', version: 1,
    settings: JSON.parse('{"__proto__":{"pwned":1},"plugins":{"NoTrack":{"enabled":true}}}'),
    quickCss: '',
    themes: { '../escaped.css': 'a{}', '..\\escaped2.css': 'a{}', 'ok.theme.css': 'b{}', 'script.js': 'x', 'nested/x.css': 'a{}' },
  }));
  dialogNext.open = { canceled: false, filePaths: [evil] };
  assert.deepStrictEqual(await invoke('ym:backup:import'), { ok: true });
  assert(!fs.existsSync(path.join(dataDir, 'escaped.css')) && !fs.existsSync(path.join(tmp, 'escaped.css')));
  assert(!fs.existsSync(path.join(dataDir, 'themes', 'script.js')));
  assert(fs.existsSync(path.join(dataDir, 'themes', 'ok.theme.css')));
  assert.strictEqual(({}).pwned, undefined);
  await invoke('ym:themes:remove', 'ok.theme.css');
  dialogNext.open = { canceled: true, filePaths: [] };
  assert.deepStrictEqual(await invoke('ym:backup:import'), { ok: false, reason: 'cancelled' });
});

test('diagnostics can be saved', async () => {
  const f = path.join(tmp, 'diag.json');
  dialogNext.save = { canceled: false, filePath: f };
  assert.strictEqual(await invoke('ym:diag:save', '{"hello":"world"}'), true);
  assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"hello":"world"}');
  dialogNext.save = { canceled: true };
  assert.strictEqual(await invoke('ym:diag:save', 'x'), false);
});

test('CustomIcons: the chosen app icon is saved, used on the window and tray only while the plugin is on, and can be removed', async () => {
  const w = win();
  const tray = FakeTray.instances[0];
  assert.deepStrictEqual(await invoke('ym:icon:state'), { has: false, preview: '' });
  await rejects(invoke('ym:icon:set', 'data:text/html;base64,AAAA'), /not a picture/);
  await rejects(invoke('ym:icon:set', 'x'.repeat(5000000)), /too large/);
  await rejects(invoke('ym:icon:set', 12345), /too large|not a picture/);
  const png = 'data:image/png;base64,' + Buffer.from('PNG-SOURCE').toString('base64');
  assert.strictEqual(await invoke('ym:icon:set', png), true);
  const st = await invoke('ym:icon:state');
  assert.strictEqual(st.has, true);
  assert.ok(st.preview.startsWith('data:image/png;base64,'));
  assert.ok(fs.existsSync(path.join(dataDir, 'icons', 'app-icon.png')));

  assert.ok(!/app-icon\.png$/.test(String(w.icons[w.icons.length - 1].p)), 'window keeps the original while the plugin is off');
  await invoke('ym:settings:set', 'plugins.CustomIcons.enabled', true);
  assert.ok(/app-icon\.png$/.test(String(w.icons[w.icons.length - 1].p)), 'window uses the chosen picture');
  assert.ok(/app-icon\.png$/.test(String(tray.images[tray.images.length - 1].p)), 'tray uses the chosen picture');
  await invoke('ym:settings:set', 'plugins.CustomIcons.enabled', false);
  assert.ok(!/app-icon\.png$/.test(String(w.icons[w.icons.length - 1].p)), 'original again after switching the plugin off');
  await invoke('ym:settings:set', 'plugins.CustomIcons.enabled', true);
  assert.strictEqual(await invoke('ym:icon:clear'), true);
  assert.strictEqual((await invoke('ym:icon:state')).has, false);
  assert.ok(!/app-icon\.png$/.test(String(w.icons[w.icons.length - 1].p)), 'original after "back to the original"');
  await invoke('ym:settings:set', 'plugins.CustomIcons.enabled', false);
});

test('page zoom: clamped between 50% and 200%, only for the Yapper window', async () => {
  assert.strictEqual(await invoke('ym:ui:zoom', 125), 1.25);
  assert.strictEqual(win().webContents.zoom, 1.25);
  assert.strictEqual(await invoke('ym:ui:zoom', 900), 2);
  assert.strictEqual(await invoke('ym:ui:zoom', 1), 0.5);
  assert.strictEqual(await invoke('ym:ui:zoom', 'nonsense'), 1);
  await rejects(ipcHandlers.get('ym:ui:zoom')({ sender: {}, senderFrame: { url: TRUSTED_URL } }, 120), /untrusted sender/);
});

test('updater (stand-alone app): checks GitHub, reports a newer version, cannot install by itself, answers only Yapper\'s window', async () => {
  const st0 = await invoke('ym:updater:state');
  assert.strictEqual(st0.current, JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, 'current version comes from package.json, not a number baked into this test');
  assert.strictEqual(st0.canInstall, false);

  const realCheck = (await invoke('ym:updater:check')).repo;
  const { defaultRepoForPlatform } = require(path.join(ROOT, 'src', 'main', 'updater.js'));
  const ownPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(realCheck, defaultRepoForPlatform(ownPkg, process.platform), 'the default repo comes from package.json, picked for this platform');

  const asked = [];
  netNext = async (url, init) => {
    asked.push(url);
    const json = (o, status = 200) => ({ ok: status === 200, status, url, headers: { get: () => null }, json: async () => o, text: async () => JSON.stringify(o) });
    if (/\/releases\/latest$/.test(url)) return json({ tag_name: 'v2.0.0', html_url: 'https://github.com/someone/YapCord/releases/tag/v2.0.0', body: 'New things', assets: [], zipball_url: 'https://api.github.com/repos/someone/YapCord/zipball/v2.0.0' });
    return json({}, 404);
  };
  await invoke('ym:settings:set', 'updater.repo', 'https://github.com/someone/YapCord.git');
  const st = await invoke('ym:updater:check');
  assert.deepStrictEqual([st.phase, st.latest, st.repo, st.notes], ['available', '2.0.0', 'someone/YapCord', 'New things']);
  assert.deepStrictEqual(asked, ['https://api.github.com/repos/someone/YapCord/releases/latest']);
  const inst = await invoke('ym:updater:install');
  assert.strictEqual(inst.phase, 'error');
  assert.ok(/only possible in the official Yapper app/.test(inst.error));
  await rejects(ipcHandlers.get('ym:updater:check')({ sender: {}, senderFrame: { url: TRUSTED_URL } }), /untrusted sender/);
  netNext = async () => { throw new Error('no network in tests'); };
});

test('updater state changes are pushed to the page', () => {
  assert.ok(win().webContents.sent.some((a) => a[0] === 'ym:updater-state' && a[1] && a[1].phase === 'available'), 'ym:updater-state was sent');
});

test('bundle is valid JS, carries the initial state and starts the plugins last', () => {
  const ev = { ...trustedEvent(), returnValue: undefined };
  ipcListeners.get('ym:get-bundle')(ev);
  const bundle = ev.returnValue;
  assert(typeof bundle === 'string' && bundle.length > 50000, 'bundle size ' + (bundle && bundle.length));
  new vm.Script(bundle, { filename: 'yappermod-bundle.js' });
  for (const p of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) {
    assert(bundle.includes(p), 'plugin ' + p + ' in bundle');
  }
  assert(bundle.lastIndexOf('YM.bootstrap.start') > bundle.lastIndexOf('definePlugin'), 'bootstrap runs after all plugins');
  assert(!/require\(['"]electron['"]\)/.test(bundle), 'no node/electron access in the page bundle');
});

test('second instance focuses the existing window', () => {
  const w = win();
  const n = w.calls.filter((c) => c[0] === 'show').length;
  app.emit('second-instance');
  assert(w.calls.filter((c) => c[0] === 'show').length > n);
  assert(w.calls.some((c) => c[0] === 'focus'));
});

test('window bounds are remembered', async () => {
  win().emit('resize');
  await sleep(750);
  await invoke('ym:settings:get');
  assert.deepStrictEqual(
    { ...(await invoke('ym:settings:get')).window.bounds },
    { x: 11, y: 22, width: 1111, height: 777, maximized: false },
  );
});

test('close-to-tray hides instead of closing; real quit closes', async () => {
  await invoke('ym:settings:set', 'window.closeToTray', true);
  let prevented = 0;
  win().calls.length = 0;
  win().emit('close', { preventDefault: () => prevented++ });
  assert.strictEqual(prevented, 1);
  assert(win().calls.some((c) => c[0] === 'hide'));
  app.emit('before-quit');
  win().emit('close', { preventDefault: () => prevented++ });
  assert.strictEqual(prevented, 1, 'no interception while quitting');
});

function loadPreload(location, isTop = true) {
  for (const k of Object.keys(require.cache)) if (k.endsWith(path.join('src', 'preload', 'index.js'))) delete require.cache[k];
  rec2.exposed = {};
  rec2.executed.length = 0;
  rec2.sendSync.length = 0;
  const w = {};
  w.top = isTop ? w : {};
  global.window = w;
  global.location = location;
  mockMode = 'preload';
  try {
    require('../src/preload/index.js');
  } finally {
    mockMode = 'main';
    delete global.window;
    delete global.location;
  }
}

test('preload exposes YapperNative on Yapper (top frame) and injects the bundle', async () => {
  preloadEvent = trustedEvent();
  loadPreload({ protocol: 'https:', hostname: 'www.yapper.website' });
  const api = rec2.exposed.YapperNative;
  assert(api, 'YapperNative exposed');
  assert.deepStrictEqual(Object.keys(api).sort(), ['app', 'backup', 'files', 'icon', 'net', 'openExternal', 'openPath', 'quickCss', 'saveDiagnostics', 'setBadge', 'settings', 'themes', 'ui', 'updater']);
  assert.deepStrictEqual(rec2.sendSync, ['ym:get-bundle']);
  assert.strictEqual(rec2.executed.length, 1, 'bundle injected into the main world');
  new vm.Script(rec2.executed[0]);

  assert.strictEqual((await api.settings.get()).plugins.NoTrack.enabled, true);
  await api.settings.set('plugins.NoTrack.hello', 'world');
  assert.strictEqual((await api.settings.get()).plugins.NoTrack.hello, 'world');
  await api.quickCss.set('a{b:c}');
  assert.strictEqual(await api.quickCss.get(), 'a{b:c}');
  assert((await api.themes.list()).length >= 3);
  assert.strictEqual((await api.app.info()).version, '9.9.9');
  await rejects(api.openExternal('file:///etc/passwd'), /blocked url/);
  await api.setBadge('5', 'data:image/png;base64,AAAA');

  let got = null;
  const off = api.themes.onChange((l) => (got = l));
  rendererListeners.get('ym:themes-changed')({}, [{ name: 'X' }]);
  assert.deepStrictEqual(got, [{ name: 'X' }]);
  off();
  got = null;
  rendererListeners.get('ym:themes-changed')({}, [{ name: 'Y' }]);
  assert.strictEqual(got, null, 'unsubscribe works');
  let css = null;
  api.quickCss.onChange((c) => (css = c));
  rendererListeners.get('ym:quickcss-changed')({}, 'a{}');
  assert.strictEqual(css, 'a{}');
  assert.doesNotThrow(() => api.themes.onChange('not a function')(), 'bad callbacks are ignored');
  rendererListeners.get('ym:themes-changed')({}, []);
});

test('preload does nothing on other sites, look-alike hosts or sub-frames', () => {
  preloadEvent = trustedEvent();
  const cases = [
    [{ protocol: 'https:', hostname: 'evil.example' }, true],
    [{ protocol: 'https:', hostname: 'yapper.website.evil.example' }, true],
    [{ protocol: 'https:', hostname: 'notyapper.website' }, true],
    [{ protocol: 'http:', hostname: 'www.yapper.website' }, true],
    [{ protocol: 'file:', hostname: '' }, true],
    [{ protocol: 'https:', hostname: 'www.yapper.website' }, false],
  ];
  for (const [loc, top] of cases) {
    loadPreload(loc, top);
    assert.strictEqual(rec2.exposed.YapperNative, undefined, JSON.stringify(loc) + ' top=' + top + ' must not get the API');
    assert.strictEqual(rec2.executed.length, 0);
    assert.strictEqual(rec2.sendSync.length, 0);
  }
  loadPreload({ protocol: 'https:', hostname: 'yapper.website' });
  assert(rec2.exposed.YapperNative, 'apex domain works too');
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
  console.log = realLog;
  console.error = realErr;
  console.warn = realWarn;
  if (failed) {
    out('\n--- captured app output ---');
    out(captured.slice(-30).join('\n'));
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (_) {

  }
  out(failed ? '\n' + failed + ' of ' + tests.length + ' smoke tests FAILED' : '\nall ' + tests.length + ' main/preload smoke tests passed');
  process.exit(failed ? 1 : 0);
})();
