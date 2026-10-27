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

  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  const setOpt = (n, k, v) => page.evaluate(([a, b, c]) => window.YapperMod.plugins.get(a).settings.set(b, c), [n, k, v]);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__calls = [];
    window.__toasts = [];
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.length === 1 && names.includes('sendMessage')) return { sendMessage: (c, t, f, r) => { window.__calls.push(['send', c, t, f ? f.name : null, r]); return Promise.resolve(); } };
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };
    YM.Store.setState({
      userId: 'me', isAdmin: false, isMod: false,
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' }, u2: { id: 'u2', username: 'sam', display_name: 'Sammy' } },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' }, c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'random' }, d1: { id: 'd1', kind: 'dm', server_id: null, name: 'Sammy' } },
      activeServerId: 's1', activeChannelId: 'c1',
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello', created_at: '2026-10-18T09:01:00Z' },
        { id: 'm2', channel_id: 'c1', author_id: 'me', content: 'my own message', created_at: '2026-10-18T09:02:00Z' },
      ], d1: [] },
    });
    const row = (id, name) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="msg-time">9:00</span></div><div class="msg-text">text ${id}</div></div></div>`;
    const app = document.createElement('div');
    app.id = 'fx110';
    app.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:720px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<aside class="sidebar" style="width:200px">
        <div class="channel-row" data-nav-chan="c1" style="position:relative"><button class="channel-main">general</button></div>
        <div class="channel-row" data-nav-chan="c2" style="position:relative"><button class="channel-main">random</button></div>
        <button class="chat-row" data-nav-chan="d1" style="position:relative">Sammy</button>
        <div id="menuhost"></div>
      </aside>
      <main class="main" style="flex:1;position:relative">
        <div id="msgs" style="width:560px">${row('m1', 'Sammy')}${row('m2', 'Tarik')}</div>
        <div class="composer" style="width:560px"><div class="composer-box"><textarea style="width:300px"></textarea><div class="composer-tools"><button class="icon-btn" aria-label="GIF">GIF</button></div></div></div>
        <div class="emoji-picker above" id="gifpicker" style="width:360px;display:flex;flex-direction:column">
          <div style="padding:8px"><input class="input" placeholder="Search GIFs…" /></div>
          <div class="gifgrid" id="gifgrid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>
          <div class="hint">Powered by Tenor</div>
        </div>
        <img class="avatar-deco still deco-ice" id="deco1" src="/deco/still/ice.svg">
        <img class="avatar-deco live deco-ice" id="deco2" src="/deco/ice.svg">
      </main>`;
    document.body.append(app);
  });
  await sleep(150);
  const calls = () => page.evaluate(() => window.__calls.slice());
  const clearCalls = () => page.evaluate(() => { window.__calls.length = 0; window.__toasts.length = 0; });
  const attr = (sel, a) => page.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
  const css = (sel, p) => page.evaluate(([s, x]) => getComputedStyle(document.querySelector(s))[x], [sel, p]);
  const nameOf = (id) => `.msg[data-message-id="${id}"] .msg-author`;

  console.log('ChannelNotes');
  await test('a note gives the channel a dot and a tooltip; other channels are untouched', async () => {
    await enable('ChannelNotes');
    await sleep(100);
    await page.evaluate(() => window.YapperMod.plugins.get('ChannelNotes').api.set('c1', 'Mods only after 10pm'));
    await sleep(150);
    assert.strictEqual(await attr('[data-nav-chan="c1"]', 'title'), 'Mods only after 10pm');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.channel-row[data-nav-chan="c1"] .ym-cn-dot').length), 1);
    assert.strictEqual(await attr('[data-nav-chan="c2"]', 'title'), null);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.channel-row[data-nav-chan="c2"] .ym-cn-dot').length), 0);
  });
  await test('right-click menu: "Channel note..." opens the editor and saves it for a DM too', async () => {
    await page.click('.chat-row[data-nav-chan="d1"]', { button: 'right' });
    await page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl'; o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Mute</span></button></div>'; document.getElementById('menuhost').append(o); });
    await sleep(250);
    const label = await page.evaluate(() => document.querySelector('.ctx-menu .ym-cn-item')?.textContent);
    assert.strictEqual(label, 'Channel note...');
    await page.evaluate(() => document.querySelector('.ym-cn-item').click());
    await sleep(150);
    await page.fill('.ym-modal textarea', 'bring snacks');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Save').click());
    await sleep(150);
    assert.strictEqual(await attr('[data-nav-chan="d1"]', 'title'), 'bring snacks');
    await page.evaluate(() => document.getElementById('ovl')?.remove());
  });
  await test('the list in the options shows both notes and removing one clears its dot', async () => {
    const rows = await page.evaluate(() => { const b = document.createElement('div'); b.id = 'cnbox'; document.body.append(b); const p = window.YapperMod.plugins.get('ChannelNotes'); p.options.manage.render(b, p); return [...b.querySelectorAll('.ym-csi-name')].map((n) => n.textContent).sort(); });
    assert.deepStrictEqual(rows, ['#general in Test Server', 'Sammy']);
    await page.evaluate(() => [...document.querySelectorAll('#cnbox .ym-btn-ghost')].find((b) => b.textContent === 'Remove' && b.closest('.ym-csi-item').textContent.includes('Sammy'))?.click());
    await sleep(100);
    assert.strictEqual(await attr('[data-nav-chan="d1"]', 'title'), null);
    await page.evaluate(() => document.getElementById('cnbox').remove());
  });
  await test('removing the remaining note removes every dot and tooltip (ChannelNotes is always on, so there is no disable to test)', async () => {
    await page.evaluate(() => window.YapperMod.settings.set('pluginData.ChannelNotes', {}));
    await sleep(100);
    assert.strictEqual(await attr('[data-nav-chan="c1"]', 'title'), null);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-cn-dot').length), 0);
  });

  console.log('AvatarEffects');
  await test('recolours every avatar decoration Yapper already shows, still/live alike (always on, black & white by default)', async () => {
    const filt = (sel) => css(sel, 'filter');
    for (const id of ['#deco1', '#deco2']) assert.notStrictEqual(await filt(id), 'none');
    await setOpt('AvatarEffects', 'filter', 'invert');
    await sleep(100);
    assert.ok((await filt('#deco1')).includes('invert'));
    await setOpt('AvatarEffects', 'filter', 'hue');
    await setOpt('AvatarEffects', 'hue', 90);
    await sleep(100);
    assert.ok((await filt('#deco1')).includes('90deg'));
    await setOpt('AvatarEffects', 'filter', 'mono');
  });

  console.log('NameEffects (1.10 additions)');
  await test('the new presets apply the same way the original ones do', async () => {
    await enable('NameEffects', { effect: 'ice', who: 'all' });
    await sleep(150);
    for (const fx of ['ice', 'toxic', 'aurora', 'chrome']) {
      await setOpt('NameEffects', 'effect', fx);
      await sleep(100);
      assert.strictEqual(await attr(nameOf('m1'), 'data-ym-fx'), fx);
      assert.notStrictEqual(await css(nameOf('m1'), 'animationName'), 'none', fx);
    }
  });
  await test('"Custom" uses your own two colours, editable from the options, and black/white is a real choice', async () => {
    const r = await page.evaluate(() => { const a = window.YapperMod.plugins.get('NameEffects').api; return [a.customCss('#000000', '#ffffff'), a.customCss('not-a-colour', '#ffffff')]; });
    assert.ok(r[0].includes('#000000') && r[0].includes('#ffffff'));
    assert.ok(r[1].includes('#000000'), 'an invalid colour falls back to black, never breaking the rule');
    await setOpt('NameEffects', 'effect', 'custom');
    await sleep(100);
    assert.strictEqual(await attr(nameOf('m1'), 'data-ym-fx'), 'custom');
    const boxRows = await page.evaluate(() => {
      const b = document.createElement('div'); b.id = 'nebox'; document.body.append(b);
      const p = window.YapperMod.plugins.get('NameEffects'); p.options.customColors.render(b, p);
      const inputs = [...b.querySelectorAll('input[type=color]')];
      return inputs.map((i) => i.value);
    });
    assert.deepStrictEqual(boxRows, ['#000000', '#ffffff']);
    await page.evaluate(() => { const i = document.querySelector('#nebox input[type=color]'); i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(100);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('NameEffects').settings.store.customColors), { a: '#123456', b: '#ffffff' });
    await page.evaluate(() => document.getElementById('nebox').remove());

    await setOpt('NameEffects', 'who', 'list'); await setOpt('NameEffects', 'list', ''); await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-fx]').length), 0);
  });

  await test('ChannelNotes and AvatarEffects are registered, run without errors, and are always on', async () => {
    const r = await page.evaluate(() => ['ChannelNotes', 'AvatarEffects'].map((n) => {
      const YM = window.YapperMod; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      const stillRunning = YM.plugins.isRunning(n);
      const stopsAsExpected = p.alwaysOn ? stillRunning : !stillRunning;
      return { n, ok: !!p && ran && !err && stopsAsExpected && (p.alwaysOn || !p.enabledByDefault), err: err && String(err.message || err) };
    }));
    assert.deepStrictEqual(r.filter((x) => !x.ok), []);
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
