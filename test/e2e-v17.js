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
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });
  await page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const app = document.createElement('div');
    app.id = 'fx17';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:600px;z-index:10;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<nav class="rail">
      <div class="rail-wrap"><button class="rail-item add" title="Create a server">+</button></div>
      <div class="rail-wrap"><button class="rail-item add" title="Discover servers">D</button></div>
      <div class="rail-wrap"><a class="rail-item add" href="/download">dl</a></div></nav>
      <div class="composer"><div class="composer-box"><button class="icon-btn" aria-label="GIF">GIF</button><button class="icon-btn" aria-label="Create a poll">P</button><button class="icon-btn" data-emoji-toggle>E</button></div></div>
      <div class="msg" id="m"><div class="avatar" id="av" style="width:32px;height:32px">T</div><div class="msg-body"><div class="msg-text">hello</div></div></div>`;
    document.body.append(app);
  });
  const cs = (sel, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s)).getPropertyValue(p), [sel, prop]);
  const root = (v) => page.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim(), v);

  console.log('Look and feel plugins');
  await test('AccentColor: Yapper\'s accent variables follow your colour, and the text on it stays readable', async () => {
    await enable('AccentColor', { color: '#3b82f6' });
    assert.strictEqual(await root('--accent'), '#3b82f6');
    assert.strictEqual(await root('--on-accent'), '#ffffff');
    await page.evaluate(() => window.YapperMod.plugins.get('AccentColor').settings.set('color', '#fde047'));
    await sleep(80);
    assert.strictEqual(await root('--accent'), '#fde047');
    assert.strictEqual(await root('--on-accent'), '#14151a', 'dark text on a light accent');
    await disable('AccentColor');
    assert.strictEqual(await root('--accent'), '#ff6b4a');
  });
  await test('RoundedCorners: corner size and avatar shape', async () => {
    await enable('RoundedCorners', { radius: 22, avatars: 'square' });
    assert.strictEqual(await root('--radius'), '22px');
    assert.strictEqual(await cs('.composer-box', 'border-top-left-radius'), '22px');
    assert.strictEqual(await cs('#av', 'border-top-left-radius'), '0px');
    await page.evaluate(() => window.YapperMod.plugins.get('RoundedCorners').settings.set('avatars', 'soft'));
    await sleep(80);
    assert.notStrictEqual(await cs('#av', 'border-top-left-radius'), '0px');
    await disable('RoundedCorners');
    assert.strictEqual(await root('--radius'), '10px');
  });
  await test('CustomFont: a preset and your own font name; the size slider', async () => {
    await enable('CustomFont', { preset: 'serif', size: 110 });
    assert.ok(/Georgia/.test(await cs('body', 'font-family')));
    assert.strictEqual(await cs('html', 'font-size'), '17.6px');
    await page.evaluate(() => { const s = window.YapperMod.plugins.get('CustomFont').settings; s.set('preset', 'custom'); s.set('custom', 'Comic Neue"; } body{display:none'); });
    await sleep(80);
    assert.ok(/Comic Neue/.test(await cs('body', 'font-family')));
    assert.notStrictEqual(await cs('#fx17', 'display'), 'none', 'a font name cannot inject CSS');
    await disable('CustomFont');
  });
  await test('HideClutter: only the ticked parts disappear (download and discover by default)', async () => {
    await enable('HideClutter');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('a.rail-item').parentElement).display), 'none');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[title="Discover servers"]').parentElement).display), 'none');
    assert.notStrictEqual(await cs('[aria-label="GIF"]', 'display'), 'none');
    assert.notStrictEqual(await cs('[title="Create a server"]', 'display'), 'none');
    await page.evaluate(() => { const s = window.YapperMod.plugins.get('HideClutter').settings; s.set('gif', true); s.set('poll', true); s.set('emoji', true); });
    await sleep(80);
    for (const sel of ['[aria-label="GIF"]', '[aria-label="Create a poll"]', '[data-emoji-toggle]']) assert.strictEqual(await cs(sel, 'display'), 'none', sel);
    await disable('HideClutter');
    assert.notStrictEqual(await cs('[aria-label="GIF"]', 'display'), 'none');
  });
  await test('MessageStyle: cards, bubbles, lines and hover change only the look of .msg', async () => {
    await enable('MessageStyle', { style: 'cards' });
    assert.notStrictEqual(await cs('#m', 'background-color'), 'rgba(0, 0, 0, 0)');
    await page.evaluate(() => window.YapperMod.plugins.get('MessageStyle').settings.set('style', 'bubbles'));
    await sleep(80);
    assert.strictEqual(await cs('#m', 'border-bottom-left-radius'), '6px');
    await page.evaluate(() => window.YapperMod.plugins.get('MessageStyle').settings.set('style', 'lines'));
    await sleep(80);
    assert.strictEqual(await cs('#m', 'border-bottom-style'), 'solid');
    await disable('MessageStyle');
    assert.strictEqual(await cs('#m', 'border-bottom-style'), 'none');
  });
  await test('BackgroundImage: a picture goes behind the app, kept small, panels turn see-through; removing it restores everything', async () => {
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await enable('BackgroundImage');
    await page.evaluate(() => { const b = document.createElement('div'); b.id = 'bgbox'; document.body.append(b); window.YapperMod.plugins.get('BackgroundImage').options.picture.render(b, window.YapperMod.plugins.get('BackgroundImage')); });
    await page.setInputFiles('#bgbox input[type=file]', { name: 'bg.png', mimeType: 'image/png', buffer: PNG });
    await sleep(500);
    const saved = await page.evaluate(() => window.YapperMod.settings.get('pluginData.BackgroundImage', ''));
    assert.ok(/^data:image\/jpeg;base64,/.test(saved), 'saved as a small jpeg');
    assert.ok(/color-mix/.test(await root('--bg-main')), 'panels see-through');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.body, '::before').position), 'fixed');
    const diag = JSON.stringify(await page.evaluate(() => window.YapperMod.diagnostics()));
    assert.ok(!diag.includes('data:image'), 'picture is not in the diagnostics');
    await page.evaluate(() => window.YapperMod.settings.set('pluginData.BackgroundImage', ''));
    await sleep(100);
    assert.strictEqual(await root('--bg-main'), '#222329');
    await disable('BackgroundImage');
  });

  console.log('Plugins page');
  await test('the page shows a summary, a segmented filter and category chips; chips and filter narrow the list', async () => {
    await page.evaluate(() => { document.getElementById('fx17').remove(); document.querySelectorAll('body > *').forEach((n) => { n.style.display = ''; }); });
    await page.evaluate(() => { const YM = window.YapperMod; const host = document.createElement('div'); host.className = 'ym-panel'; host.id = 'pnl'; host.style.cssText = 'position:fixed;inset:20px;z-index:99;overflow:auto;background:var(--bg-main);padding:20px;width:900px'; document.body.append(host); YM.uiPages.plugins(host); });
    await sleep(200);
    const info = await page.evaluate(() => ({
      summary: document.querySelector('#pnl .ym-summary').textContent,
      seg: [...document.querySelectorAll('#pnl .ym-seg-btn')].map((b) => b.textContent),
      chips: document.querySelectorAll('#pnl .ym-chip-btn').length,
      cards: document.querySelectorAll('#pnl .ym-card').length,
      glyphs: document.querySelectorAll('#pnl .ym-glyph').length,
    }));
    assert.ok(/^\d+ of \d+ switched on$/.test(info.summary), info.summary);
    assert.deepStrictEqual(info.seg, ['All', 'On', 'Off']);
    assert.ok(info.chips >= 8);
    assert.ok(info.cards >= 64 && info.glyphs === info.cards);
    await page.click('#pnl .ym-chip-btn:has-text("Customisation")');
    await sleep(100);
    const names = await page.evaluate(() => [...document.querySelectorAll('#pnl .ym-card-title b')].map((b) => b.textContent));
    for (const n of ['AccentColor', 'CustomFont', 'CustomServerIcons', 'FriendNicknames', 'MessageStyle']) assert.ok(names.includes(n), n);
    assert.ok(!names.includes('MessageLogger'));
    await page.click('#pnl .ym-chip-btn.on');
    await page.click('#pnl .ym-seg-btn[data-v="on"]');
    await sleep(100);
    const on = await page.evaluate(() => document.querySelectorAll('#pnl .ym-card').length);
    assert.ok(on < info.cards);
  });
  await test('new plugins are registered, off by default and start and stop cleanly', async () => {
    const r = await page.evaluate(() => ['AccentColor', 'RoundedCorners', 'CustomFont', 'HideClutter', 'MessageStyle', 'BackgroundImage'].map((n) => {
      const YM = window.YapperMod; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      return { n, ok: !!p && ran && !err && !YM.plugins.isRunning(n) && !p.enabledByDefault, err: err && String(err.message || err) };
    }));
    assert.deepStrictEqual(r.filter((x) => !x.ok), []);
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 160)), []);
  });

  if (process.env.YM_SHOTS) {
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.evaluate(() => { const h = document.getElementById('pnl'); h.style.width = '1000px'; h.style.height = '700px'; for (const n of ['MessageLogger', 'BetterFolders', 'CustomServerIcons']) window.YapperMod.plugins.setEnabled(n, true); });
    await sleep(300);
    await page.screenshot({ path: process.env.YM_SHOTS + '/v17-plugins.png' });
  }
  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
