'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { extractZip, crc32 } = require('../src/main/unzip');
const { Updater, compareVersions, normaliseRepo, parseVersion } = require('../src/main/updater');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yapcord-upd-'));
let n = 0;
const fresh = () => path.join(tmp, 'd' + n++);

function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const data = Buffer.from(e.data == null ? '' : e.data);
    const method = e.method === 0 ? 0 : 8;
    const comp = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = e.crc == null ? crc32(data) : e.crc;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    chunks.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(e.attr || 0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

function pkgZip({ root = 'YapCord-2.0.0/', version = '2.0.0', name = 'yapcord', omit = [], extra = [] } = {}) {
  const files = {
    'package.json': JSON.stringify({ name, version }),
    'src/main/inject.js': 'module.exports = { install() {} };',
    'src/preload/index.js': '// preload',
    'src/renderer/000-boot.js': "YM.version = '" + version + "';",
    'themes/Mine.theme.css': 'body{}',
    LICENSE: 'GPL',
    'README.md': 'not part of the runtime',
    'tools/yapper-patch.js': '// installer, not part of the runtime',
    '.github/workflows/x.yml': 'x',
  };
  for (const o of omit) delete files[o];
  return makeZip([{ name: root.replace(/\/$/, '') + '/', data: '' }, ...Object.entries(files).map(([k, v]) => ({ name: root + k, data: v })), ...extra]);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const throws = (fn, re) => {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, 'expected an error');
  if (re) assert(re.test(err.message), 'unexpected error: ' + err.message);
};
const rejectsAsync = async (p, re) => {
  let err = null;
  try { await p; } catch (e) { err = e; }
  assert(err, 'expected a rejection');
  if (re) assert(re.test(err.message), 'unexpected error: ' + err.message);
};

test('version numbers compare properly (1.10.0 is newer than 1.9.0); junk never counts as newer', () => {
  assert.strictEqual(compareVersions('1.10.0', '1.9.0'), 1);
  assert.strictEqual(compareVersions('v2.0.0', '1.99.99'), 1);
  assert.strictEqual(compareVersions('1.4.0', '1.4.0'), 0);
  assert.strictEqual(compareVersions('1.3.9', '1.4.0'), -1);
  assert.strictEqual(compareVersions('latest', '1.4.0'), 0);
  assert.strictEqual(compareVersions(undefined, '1.4.0'), 0);
  assert.deepStrictEqual(parseVersion('v1.2.3-beta'), [1, 2, 3]);
  assert.strictEqual(parseVersion('1.2'), null);
});

test('repository names: owner/name, or a pasted GitHub address; anything else is refused', () => {
  assert.strictEqual(normaliseRepo('someone/YapCord'), 'someone/YapCord');
  assert.strictEqual(normaliseRepo(' https://github.com/someone/YapCord.git '), 'someone/YapCord');
  assert.strictEqual(normaliseRepo('github.com/someone/YapCord/releases'), 'someone/YapCord');
  assert.strictEqual(normaliseRepo('https://evil.example/someone/YapCord'), '');
  assert.strictEqual(normaliseRepo('../../etc'), '');
  assert.strictEqual(normaliseRepo('a/b/c'), '');
  assert.strictEqual(normaliseRepo(''), '');
  assert.strictEqual(normaliseRepo(null), '');
});

test('extractZip: unpacks only the allowed names, drops the top folder, keeps the contents byte for byte', () => {
  const dest = fresh();
  const r = extractZip(pkgZip(), dest, { stripRoot: true, allow: ['src', 'themes', 'package.json', 'LICENSE'] });
  assert.strictEqual(r.files, 6);
  assert.deepStrictEqual(fs.readdirSync(dest).sort(), ['LICENSE', 'package.json', 'src', 'themes']);
  assert.strictEqual(fs.readFileSync(path.join(dest, 'src', 'main', 'inject.js'), 'utf8'), 'module.exports = { install() {} };');
  assert.ok(!fs.existsSync(path.join(dest, 'README.md')) && !fs.existsSync(path.join(dest, 'tools')) && !fs.existsSync(path.join(dest, '.github')));
});

test('extractZip: stored (uncompressed) entries work too', () => {
  const dest = fresh();
  extractZip(makeZip([{ name: 'r/package.json', data: '{"a":1}', method: 0 }]), dest, { stripRoot: true });
  assert.strictEqual(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'), '{"a":1}');
});

test('extractZip refuses paths that leave the folder, absolute paths, names with NUL, and mixed top folders', () => {
  for (const bad of ['r/../../evil.txt', 'r/a/../../../evil.txt', '/abs/evil.txt', 'C:/evil.txt', 'r\\..\\..\\evil.txt', 'r/a\0b.txt']) {
    const dest = fresh();
    throws(() => extractZip(makeZip([{ name: 'r/ok.txt', data: '1' }, { name: bad, data: 'x' }]), dest, { stripRoot: bad.startsWith('r') }), /leaves its folder|absolute|invalid name|expected layout/);
    assert.ok(!fs.existsSync(path.join(path.dirname(dest), 'evil.txt')) && !fs.existsSync('/evil.txt'));
  }
  throws(() => extractZip(makeZip([{ name: 'a/x', data: '1' }, { name: 'b/y', data: '2' }]), fresh(), { stripRoot: true }), /expected layout/);
});

test('extractZip ignores symbolic links and refuses damaged, truncated and oversized archives', () => {
  const dest = fresh();
  extractZip(makeZip([{ name: 'r/link', data: '/etc/passwd', attr: (0o120777 << 16) >>> 0 }, { name: 'r/ok.txt', data: 'ok' }]), dest, { stripRoot: true });
  assert.deepStrictEqual(fs.readdirSync(dest), ['ok.txt']);
  throws(() => extractZip(makeZip([{ name: 'r/a.txt', data: 'hello', crc: 1234 }]), fresh(), { stripRoot: true }), /checksum|damaged/);
  const good = makeZip([{ name: 'r/a.txt', data: 'hello world' }]);
  throws(() => extractZip(good.subarray(0, good.length - 30), fresh(), { stripRoot: true }), /not a zip|damaged/);
  throws(() => extractZip(Buffer.from('this is not a zip file at all, just text'), fresh()), /not a zip/);
  throws(() => extractZip(makeZip([{ name: 'r/big.bin', data: Buffer.alloc(5000, 1) }]), fresh(), { stripRoot: true, maxEntry: 1000 }), /too large/);
  throws(() => extractZip(makeZip([{ name: 'r/a', data: Buffer.alloc(900, 1) }, { name: 'r/b', data: Buffer.alloc(900, 1) }]), fresh(), { stripRoot: true, maxTotal: 1500 }), /too large when unpacked/);
  throws(() => extractZip(makeZip([1, 2, 3].map((i) => ({ name: 'r/f' + i, data: 'x' }))), fresh(), { stripRoot: true, maxFiles: 2 }), /too many files/);

  const bomb = makeZip([{ name: 'r/bomb', data: Buffer.alloc(2 * 1024 * 1024, 0) }]);
  const e = fresh();
  throws(() => extractZip(bomb, e, { stripRoot: true, maxEntry: 1024 * 1024 }), /too large/);
});

let server;
let base;
const hits = [];
const mode = { release: 'asset', zip: null, repoStatus: 200, relStatus: 200, zipStatus: 200, version: '2.0.0', zipballHost: null };
function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      hits.push(req.url);
      const json = (o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      const u = req.url;
      if (u === '/repos/someone/YapCord/releases/latest') {
        if (mode.relStatus !== 200) return json({ message: 'x' }, mode.relStatus);
        return json({
          tag_name: 'v' + mode.version, html_url: 'https://github.com/someone/YapCord/releases/tag/v' + mode.version, body: 'Release notes here',
          assets: mode.release === 'asset' ? [{ name: 'readme.txt', browser_download_url: base + '/nope' }, { name: 'YapCord-' + mode.version + '.zip', browser_download_url: base + '/asset.zip' }] : [],
          zipball_url: (mode.zipballHost || base) + '/zipball.zip',
        });
      }
      if (u === '/repos/someone/YapCord') return mode.repoStatus === 200 ? json({ default_branch: 'main' }) : json({ message: 'Not Found' }, mode.repoStatus);
      if (u.startsWith('/repos/someone/YapCord/contents/package.json')) { res.writeHead(200); return res.end(JSON.stringify({ name: 'yapcord', version: mode.version })); }
      if (u === '/repos/someone/YapCord/zipball/main' || u === '/zipball.zip' || u === '/asset.zip') {
        // Real GitHub answers 415 Unsupported Media Type if the api.github.com zipball endpoint is asked
        // for application/octet-stream - only a release asset's own CDN link (/asset.zip here) should get
        // that Accept header; the two zipball-style URLs must get the default application/vnd.github+json.
        const wantsOctetStream = u === '/asset.zip';
        if (req.headers.accept === 'application/octet-stream' && !wantsOctetStream) { res.writeHead(415); return res.end('Unsupported Media Type'); }
        if (wantsOctetStream && req.headers.accept !== 'application/octet-stream') { res.writeHead(415); return res.end('Unsupported Media Type'); }
        if (mode.zipStatus !== 200) { res.writeHead(mode.zipStatus); return res.end('no'); }
        res.writeHead(200, { 'content-type': 'application/zip' });
        return res.end(mode.zip || pkgZip({ version: mode.version }));
      }
      json({ message: 'Not Found' }, 404);
    }).listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port; resolve(); });
  });
}

function makeUpdater(over = {}) {
  const runtimeDir = over.runtimeDir || path.join(fresh(), 'runtime');
  fs.mkdirSync(path.dirname(runtimeDir), { recursive: true });
  return new Updater({ currentVersion: '1.14.0', getRepo: () => 'someone/YapCord', mode: 'official', runtimeDir, fetch: (u, i) => fetch(u, i), apiBase: base, hosts: ['127.0.0.1'], ...over });
}
const reset = () => { Object.assign(mode, { release: 'asset', zip: null, repoStatus: 200, relStatus: 200, zipStatus: 200, version: '2.0.0', zipballHost: null }); hits.length = 0; };

test('updater: a newer release is reported, downloaded (the release asset is preferred), checked and put in runtime-next', async () => {
  reset();
  const u = makeUpdater();
  const seen = [];
  u.on('state', (s) => seen.push(s.phase));
  const st = await u.check();
  assert.deepStrictEqual([st.phase, st.latest, st.notes, st.canInstall], ['available', '2.0.0', 'Release notes here', true]);
  const done = await u.install();
  assert.strictEqual(done.phase, 'ready');
  assert.strictEqual(done.latest, '2.0.0');
  assert.ok(hits.includes('/asset.zip') && !hits.includes('/zipball.zip'), 'asset preferred: ' + hits.join(' '));
  const next = u.nextDir;
  assert.ok(next.endsWith('runtime-next'));
  assert.deepStrictEqual(fs.readdirSync(next).sort(), ['LICENSE', 'package.json', 'src', 'themes']);
  assert.ok(!fs.existsSync(next + '.tmp'));
  assert.deepStrictEqual(seen.filter((p, i) => p !== seen[i - 1]), ['checking', 'available', 'downloading', 'ready']);

  const before = hits.length;
  await u.install();
  assert.strictEqual(hits.length, before);
  assert.strictEqual((await u.check()).phase, 'ready');
});

test('updater: without a release asset the zipball is used', async () => {
  reset();
  mode.release = 'zipball';
  const u = makeUpdater();
  await u.check();
  assert.strictEqual((await u.install()).phase, 'ready');
  assert.ok(hits.includes('/zipball.zip'));
});

test('updater: same or older version is "Up to Date!"', async () => {
  reset();
  mode.version = '1.14.0';
  const u = makeUpdater();
  assert.strictEqual((await u.check()).phase, 'uptodate');
  mode.version = '1.3.9';
  assert.strictEqual((await u.check()).phase, 'uptodate');
  assert.strictEqual((await u.install()).phase, 'uptodate', 'nothing to install');
});

test('updater: a repository without releases is read from package.json on its default branch', async () => {
  reset();
  mode.relStatus = 404;
  const u = makeUpdater();
  const st = await u.check();
  assert.deepStrictEqual([st.phase, st.latest, st.url], ['available', '2.0.0', 'https://github.com/someone/YapCord']);
  assert.ok(hits.includes('/repos/someone/YapCord') && hits.some((h) => h.startsWith('/repos/someone/YapCord/contents/package.json?ref=main')));
  assert.strictEqual((await u.install()).phase, 'ready');
  assert.ok(hits.includes('/repos/someone/YapCord/zipball/main'));
});

test('updater: unknown repository, missing repository setting, rate limit: clear messages', async () => {
  reset();
  mode.relStatus = 404;
  mode.repoStatus = 404;
  let st = await makeUpdater().check();
  assert.strictEqual(st.phase, 'error');
  assert.ok(/was not found/.test(st.error) && /public/.test(st.error), st.error);
  reset();
  mode.relStatus = 403;
  st = await makeUpdater().check();
  assert.ok(/too many requests/.test(st.error), st.error);
  st = await makeUpdater({ getRepo: () => '' }).check();
  assert.strictEqual(st.phase, 'unconfigured');
  st = await makeUpdater({ getRepo: () => 'not a repo!' }).check();
  assert.strictEqual(st.phase, 'unconfigured');
});

test('updater: a package that is not YapCord, not newer, incomplete or damaged is refused and leaves nothing behind', async () => {
  const cases = [
    [pkgZip({ name: 'something-else' }), /not a YapCord package/],
    [pkgZip({ version: '1.4.0' }), /not newer/],
    [pkgZip({ version: '1.3.0' }), /not newer/],
    [pkgZip({ omit: ['src/main/inject.js'] }), /incomplete/],
    [pkgZip({ omit: ['package.json'] }), /not a YapCord package/],
    [pkgZip({ extra: [{ name: 'YapCord-2.0.0/src/../../../evil.txt', data: 'x' }] }), /leaves its folder/],
    [Buffer.from('<html>not a zip</html>'), /not a zip/],
  ];
  for (const [zip, re] of cases) {
    reset();
    mode.zip = zip;
    const u = makeUpdater();
    await u.check();
    const st = await u.install();
    assert.strictEqual(st.phase, 'error', String(re));
    assert.ok(re.test(st.error), 'error was: ' + st.error);
    assert.ok(!fs.existsSync(u.nextDir) && !fs.existsSync(u.nextDir + '.tmp'), 'nothing left behind for ' + re);
    assert.ok(!fs.existsSync(path.join(path.dirname(u.runtimeDir), 'evil.txt')));
  }
});

test('updater: a failed download keeps an earlier staged package intact', async () => {
  reset();
  const u = makeUpdater();
  await u.check();
  await u.install();
  assert.strictEqual(u.getState().phase, 'ready');
  mode.version = '2.1.0';
  mode.zipStatus = 500;
  const u2 = makeUpdater({ runtimeDir: u.runtimeDir });
  assert.strictEqual(u2.getState().phase, 'ready', 'a staged package is noticed at start');
  assert.strictEqual(u2.getState().latest, '2.0.0');
  await u2.check();
  assert.strictEqual(u2.getState().phase, 'available');
  await u2.install();
  assert.strictEqual(u2.getState().phase, 'error');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(u.nextDir, 'package.json'), 'utf8')).version, '2.0.0');
  assert.ok(!fs.existsSync(u.nextDir + '.tmp'));
});

test('updater: only GitHub hosts over https are used (a release that points elsewhere is refused)', async () => {
  reset();
  mode.release = 'zipball';
  mode.zipballHost = 'https://evil.example';
  const u = makeUpdater();
  await u.check();
  const st = await u.install();
  assert.strictEqual(st.phase, 'error');
  assert.ok(/Refusing to download from evil\.example/.test(st.error), st.error);

  const real = new Updater({ currentVersion: '1.14.0', getRepo: () => 'a/b', mode: 'standalone', fetch: async () => { throw new Error('no network'); } });
  for (const ok of ['https://api.github.com/x', 'https://codeload.github.com/x', 'https://objects.githubusercontent.com/x', 'https://release-assets.githubusercontent.com/x']) assert.doesNotThrow(() => real._checkUrl(ok), ok);
  for (const bad of ['http://api.github.com/x', 'https://github.com.evil.example/x', 'https://evilgithub.com/x', 'https://githubusercontent.com.evil.example/x', 'ftp://github.com/x', 'file:///etc/passwd', 'nonsense']) assert.throws(() => real._checkUrl(bad), undefined, bad);
});

test('updater: an oversized download is refused before it is read', async () => {
  reset();
  const u = makeUpdater({
    fetch: async (url, init) => {
      if (/asset\.zip$/.test(url)) return { ok: true, status: 200, url, headers: { get: (k) => (k.toLowerCase() === 'content-length' ? String(99 * 1024 * 1024) : null) }, arrayBuffer: async () => { throw new Error('must not be read'); } };
      return fetch(url, init);
    },
  });
  await u.check();
  const st = await u.install();
  assert.strictEqual(st.phase, 'error');
  assert.ok(/larger than expected/.test(st.error), st.error);
});

test('updater: the stand-alone app only checks; it cannot install', async () => {
  reset();
  const u = makeUpdater({ mode: 'standalone', runtimeDir: null });
  const st = await u.check();
  assert.deepStrictEqual([st.phase, st.canInstall, st.url], ['available', false, 'https://github.com/someone/YapCord/releases/tag/v2.0.0']);
  await rejectsAsync(u.install(), /only possible in the official Yapper app/);
});

test('updater: background run honours the "automatically update" switch and installs when it is on', async () => {
  reset();
  let cfg = { auto: false };
  const u = makeUpdater();
  const run = u.start(() => cfg);
  await run();
  assert.strictEqual(u.getState().phase, 'idle', 'off: not even a check');
  assert.strictEqual(hits.length, 0);
  cfg = { auto: true };
  await run();
  assert.strictEqual(u.getState().phase, 'ready');
  await run();
  u.stop();
  assert.strictEqual(u.timers.length, 0);
});

(async () => {
  await startServer();
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ok   ' + t.name);
    } catch (err) {
      failed++;
      console.log('  FAIL ' + t.name + '\n       ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n       '));
    }
  }
  server.close();
  if (failed) {
    console.log('\n' + failed + ' of ' + tests.length + ' tests FAILED');
    process.exit(1);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nall ' + tests.length + ' zip/updater tests passed');
})();
