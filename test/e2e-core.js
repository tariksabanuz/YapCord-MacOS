'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: {} } } });
  const { page } = site;
  const bodies = [];
  await page.route('**/rest/v1/user_server_folders**', (route) => {
    const r = route.request();
    if (r.method() !== 'GET') bodies.push(r.postData());
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const wav = (samples) => {
    const b = Buffer.alloc(44 + samples * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
    return b;
  };
  await page.route('**/sounds/**', async (route) => {
    const slow = /message/.test(route.request().url());
    if (slow) await new Promise((r) => setTimeout(r, 150));
    route.fulfill({ status: 200, contentType: 'audio/wav', body: wav(slow ? 4000 : 2000) });
  });
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  console.log('network');
  await test('hooked requests that no hook changed keep their exact bytes', async () => {

    const raw = '{ "folders": [ ],  "n": 1.0, "big": 12345678901234567890, "path": "a\\/b" }';
    await page.evaluate((body) => fetch('https://api.yapper.website/rest/v1/user_server_folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body }), raw);
    assert.strictEqual(bodies[bodies.length - 1], raw);
  });

  await test('a hook that does change the body still gets its change sent', async () => {
    const out = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const off = YM.net.onFetch({ test: (u) => /user_server_folders/.test(u), before(ctx) { ctx.json.marked = true; } });
      await fetch('https://api.yapper.website/rest/v1/user_server_folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ "folders": [] }' });
      off();
      return true;
    });
    assert.ok(out);
    assert.deepStrictEqual(JSON.parse(bodies[bodies.length - 1]), { folders: [], marked: true });
  });

  console.log('source patches');
  await test('patch finders written as /g regexes work every time (no lastIndex leak)', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod;
      YM.patches.register('RegexTest', [{ find: /needle/g, replacement: { match: 'a', replace: 'b' } }]);
      const outs = [];
      for (let i = 0; i < 4; i++) {
        const fn = YM.patches.apply(function () { return 'needle a'; }, ['t' + i]);
        outs.push(fn ? fn() : null);
      }
      const rep = YM.patches.report().filter((p) => p.plugin === 'RegexTest')[0];
      YM.patches.unregister('RegexTest');
      return { outs, applied: rep.applied, failed: rep.failed };
    });
    assert.deepStrictEqual(r.outs, ['needle b', 'needle b', 'needle b', 'needle b']);
    assert.strictEqual(r.applied, 4);
    assert.deepStrictEqual(r.failed, []);
  });

  console.log('plugin lifecycle');
  await test('an async start() that rejects is rolled back: stopped, error shown, nothing left behind', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.definePlugin({
        name: 'ZzRejects',
        async start(ctx) {
          ctx.css('.zz-rejects{color:red}');
          ctx.on('zz:event', () => undefined);
          await Promise.resolve();
          throw new Error('boom');
        },
      });
      YM.plugins.setEnabled('ZzRejects', true);
      await new Promise((r2) => setTimeout(r2, 50));
      return {
        running: YM.plugins.isRunning('ZzRejects'),
        error: String(YM.plugins.errors.get('ZzRejects') && YM.plugins.errors.get('ZzRejects').message),
        css: YM.dom.css.has('plugin-ZzRejects'),
        listener: YM.Events.has('zz:event'),
      };
    });
    assert.deepStrictEqual(r, { running: false, error: 'boom', css: false, listener: false });
  });

  await test('things an async start() registers after the plugin was switched off are undone at once', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      window.__zzLate = 0;
      YM.definePlugin({
        name: 'ZzLate',
        async start(ctx) {
          await new Promise((r2) => setTimeout(r2, 60));
          ctx.css('.zz-late{color:red}');
          ctx.on('zz:late', () => { window.__zzLate++; });
          ctx.interval(() => { window.__zzLate += 100; }, 10);
          ctx.watch('.zz-never', () => { window.__zzLate += 1000; });
          ctx.cleanup(() => { window.__zzCleaned = true; });
        },
      });
      YM.plugins.setEnabled('ZzLate', true);
      YM.plugins.setEnabled('ZzLate', false);
      await new Promise((r2) => setTimeout(r2, 200));
      YM.Events.emit('zz:late');
      const el = document.createElement('div');
      el.className = 'zz-never';
      document.body.append(el);
      await new Promise((r2) => setTimeout(r2, 100));
      return { css: YM.dom.css.has('plugin-ZzLate'), listener: YM.Events.has('zz:late'), counter: window.__zzLate, cleaned: window.__zzCleaned === true, running: YM.plugins.isRunning('ZzLate') };
    });
    assert.deepStrictEqual(r, { css: false, listener: false, counter: 0, cleaned: true, running: false });
  });

  console.log('themes');
  await test('a theme switched off while its file is still being read is not applied', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.native.themes.read = () => new Promise((res) => setTimeout(() => res('body{outline:3px solid red}'), 80));
      YM.themes.setEnabled('slow.theme.css', true);
      YM.themes.setEnabled('slow.theme.css', false);
      await new Promise((r2) => setTimeout(r2, 200));
      const afterOff = { applied: YM.themes.applied.size, el: !!document.getElementById('ym-theme-slow_theme_css') };
      YM.themes.setEnabled('slow.theme.css', true);
      await new Promise((r2) => setTimeout(r2, 200));
      const afterOn = { applied: YM.themes.applied.size, el: !!document.getElementById('ym-theme-slow_theme_css') };
      YM.themes.setEnabled('slow.theme.css', false);
      return { afterOff, afterOn, gone: !document.getElementById('ym-theme-slow_theme_css') };
    });
    assert.deepStrictEqual(r.afterOff, { applied: 0, el: false });
    assert.deepStrictEqual(r.afterOn, { applied: 1, el: true });
    assert.strictEqual(r.gone, true);
  });

  console.log('settings and sounds');
  await test('"Reset to defaults" tells the plugin about every option it changes', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod;
      const plugin = YM.definePlugin({ name: 'ZzReset', options: { a: { type: 'number', default: 1 }, b: { type: 'string', default: 'x' }, c: { type: 'boolean', default: true } } });
      plugin.settings.set('a', 5);
      plugin.settings.set('b', 'changed');
      const seen = {};
      const off = plugin.settings.onChange((k, v) => { seen[k] = v; });
      plugin.settings.resetAll();
      off();
      return { seen, store: { a: plugin.settings.store.a, b: plugin.settings.store.b, c: plugin.settings.store.c }, raw: YM.settings.get('plugins.ZzReset') };
    });
    assert.deepStrictEqual(r.store, { a: 1, b: 'x', c: true });
    assert.deepStrictEqual(r.seen, { a: 1, b: 'x', c: true });
    assert.deepStrictEqual(r.raw, { enabled: false });
  });

  await test('two sounds loading at once keep their own names (message ping vs leave chime)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const ctx = new AudioContext();
      const load = async (name) => {
        const res = await fetch('/sounds/' + name + '.ogg');
        return ctx.decodeAudioData(await res.arrayBuffer());
      };
      const pm = load('message');
      const pl = load('leave');
      const [bm, bl] = await Promise.all([pm, pl]);
      const nameOf = (buf) => { const n = ctx.createBufferSource(); n.buffer = buf; return YM.media.soundOf(n); };
      return { message: nameOf(bm), leave: nameOf(bl), lengths: [bm.length, bl.length] };
    });
    assert.ok(r.lengths[0] === r.lengths[1] * 2, 'the message sound is the longer one (resampled): ' + r.lengths);
    assert.strictEqual(r.message, 'message');
    assert.strictEqual(r.leave, 'leave');
  });

  console.log('file picker (the + button)');
  await test('input.click() on a file input is answered by the own dialog; files arrive with a change event', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.inApp = true;
      const calls = [];
      YM.native.files = { pick: async (o) => { calls.push(o); return [{ name: 'a.png', type: 'image/png', lastModified: 5, size: 3, data: new Uint8Array([1, 2, 3]) }, { name: 'b.txt', type: 'text/plain', lastModified: 6, size: 1, data: new Uint8Array([4]) }]; } };
      const input = document.createElement('input');
      input.type = 'file'; input.hidden = true; input.multiple = true; input.accept = 'image/png,.zip';
      document.body.append(input);
      const seen = [];
      input.addEventListener('change', () => seen.push([...input.files].map((f) => f.name + ':' + f.type + ':' + f.size)));
      let nativeChooser = 0;
      input.addEventListener('cancel', () => nativeChooser++);
      input.click();
      await new Promise((res) => setTimeout(res, 100));
      const single = document.createElement('input');
      single.type = 'file'; document.body.append(single);
      let singleSeen = null;
      single.addEventListener('change', () => { singleSeen = [...single.files].map((f) => f.name); });
      single.click();
      await new Promise((res) => setTimeout(res, 100));
      return { calls, seen, singleSeen, picks: YM.filePicker.picks, busy: YM.filePicker.busy };
    });
    assert.deepStrictEqual(r.calls, [{ accept: 'image/png,.zip', multiple: true }, { accept: '', multiple: false }]);
    assert.deepStrictEqual(r.seen, [['a.png:image/png:3', 'b.txt:text/plain:1']]);
    assert.deepStrictEqual(r.singleSeen, ['a.png'], 'a single-file input only gets the first file');
    assert.strictEqual(r.picks, 2);
    assert.strictEqual(r.busy, false);
  });

  await test('a React-style click on the "+" button reaches the hidden input and its onChange sees the files', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.inApp = true;
      YM.native.files = { pick: async () => [{ name: 'cat.webp', type: 'image/webp', lastModified: 1, size: 2, data: new Uint8Array([7, 7]) }] };
      const box = document.createElement('div');
      const btn = document.createElement('button'); btn.className = 'icon-btn upload-btn';
      const input = document.createElement('input'); input.type = 'file'; input.hidden = true; input.multiple = true;
      box.append(btn, input); document.body.append(box);
      const got = [];
      input.addEventListener('change', (e) => { for (const f of [...e.target.files]) got.push(f.name); e.target.value = ''; });
      btn.addEventListener('click', () => input.click());
      btn.click();
      await new Promise((res) => setTimeout(res, 100));
      return got;
    });
    assert.deepStrictEqual(r, ['cat.webp']);
  });

  await test('cancel does nothing; the switch and "outside the app" leave the browser chooser alone', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const make = () => { const i = document.createElement('input'); i.type = 'file'; document.body.append(i); i.__changes = 0; i.addEventListener('change', () => i.__changes++); return i; };
      const wait = () => new Promise((res) => setTimeout(res, 80));
      const out = { used: 0 };
      YM.inApp = true;
      YM.native.files = { pick: async () => { out.used++; return []; } };
      const a = make(); a.click(); await wait(); out.cancel = a.__changes; out.afterCancel = out.used;
      YM.settings.set('window.ownFilePicker', false);
      make().click(); await wait(); out.afterSwitchOff = out.used;
      YM.settings.set('window.ownFilePicker', true);
      YM.inApp = false;
      make().click(); await wait(); out.afterOutside = out.used;
      return out;
    });
    assert.strictEqual(r.cancel, 0);
    assert.strictEqual(r.afterCancel, 1, 'the dialog was used once');
    assert.strictEqual(r.afterSwitchOff, 1, 'switch off: the dialog is not used');
    assert.strictEqual(r.afterOutside, 1, 'outside the app: the dialog is not used');
  });

  await test('if our dialog breaks, the browser chooser opens instead (user is never left with a dead button)', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      YM.inApp = true;
      YM.native.files = { pick: async () => { throw new Error('dialog broke'); } };
      const b = document.createElement('button'); b.id = 'zz-pick'; b.textContent = 'pick';
      b.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99999;width:80px;height:30px';
      const i = document.createElement('input'); i.type = 'file'; i.hidden = true;
      b.addEventListener('click', () => i.click());
      document.body.append(b, i);
    });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#zz-pick')]);
    assert.ok(chooser, 'the native chooser opened');
    const state = await page.evaluate(() => ({ failures: window.YapperMod.filePicker.failures, busy: window.YapperMod.filePicker.busy }));
    assert.deepStrictEqual(state, { failures: 1, busy: false });
    await page.evaluate(() => { window.YapperMod.inApp = false; document.getElementById('zz-pick').remove(); });
  });

  await test('files picked through the own dialog still go through the upload filters', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.inApp = true;
      YM.native.files = { pick: async () => [{ name: 'photo.png', type: 'image/png', lastModified: 1, size: 2, data: new Uint8Array([1, 2]) }] };
      const off = YM.uploads.addFilter(async (files) => files.map((f) => new File([f], 'renamed-' + f.name, { type: f.type })), { name: 'T' });
      const input = document.createElement('input'); input.type = 'file'; document.body.append(input);
      const names = [];
      input.addEventListener('change', () => names.push(...[...input.files].map((f) => f.name)));
      input.click();
      await new Promise((res) => setTimeout(res, 200));
      off();
      return names;
    });
    assert.deepStrictEqual(r, ['renamed-photo.png']);
  });

  console.log('dom');
  await test('onMutate survives a batch with more than 130,000 mutation records', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;

      let naiveThrows = false;
      try { [].push(...new Array(500000).fill(0)); } catch (_) { naiveThrows = true; }
      const box = document.createElement('div');
      document.body.appendChild(box);
      let seen = 0;
      const off = YM.dom.onMutate((batch) => { seen += batch.length; });
      await new Promise((res) => requestAnimationFrame(() => res()));
      seen = 0;
      for (let i = 0; i < 130000; i++) box.appendChild(document.createElement('i'));
      await new Promise((res) => setTimeout(res, 800));
      off();
      box.remove();
      return { naiveThrows, seen };
    });
    assert.ok(r.seen >= 130000, 'saw ' + r.seen + ' records');
    assert.ok(r.naiveThrows, 'spread of 500k args should throw in this Chromium');
  });

  const bad = site.consoleLog.filter((l) => (l.type === 'error' || l.type === 'pageerror') && /RangeError|call stack|YapCord|YapperMod/i.test(l.text) && !/boom|failed to start|dialog broke|own file dialog failed/.test(l.text));
  await test('no unexpected errors in the console', async () => assert.deepStrictEqual(bad.map((b) => b.text.slice(0, 200)), []));

  await site.close();
  const pass = results.filter(Boolean).length;
  console.log('\n' + pass + '/' + results.length + ' passed');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
