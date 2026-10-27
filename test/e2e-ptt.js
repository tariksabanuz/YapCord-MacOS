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
  const enable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, true), name);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  const setOpt = (n, k, v) => page.evaluate(([a, b, c]) => window.YapperMod.plugins.get(a).settings.set(b, c), [n, k, v]);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__toggleCalls = 0;
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.includes('toggleMute') && names.includes('toggleDeafen')) {
        return {
          toggleMute: () => { window.__toggleCalls++; const v = YM.Store.getState().voice; YM.Store.setState({ voice: { ...v, muted: !v.muted } }); return Promise.resolve(); },
          toggleDeafen: () => Promise.resolve(),
        };
      }
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts = (window.__toasts || []); window.__toasts.push([String(m), (o && o.type) || 'info']); };
    YM.Store.setState({ voice: null });
    const app = document.createElement('div');
    app.id = 'fxptt';
    app.style.cssText = 'position:fixed;left:0;top:0;width:500px;height:300px;z-index:10';
    app.innerHTML = `<div class="composer"><textarea></textarea></div>
      <button class="vb" aria-label="Mute" title="Mute">Mute</button>`;
    document.body.append(app);
  });
  await sleep(150);
  const voice = () => page.evaluate(() => window.YapperMod.Store.getState().voice);
  const calls = () => page.evaluate(() => window.__toggleCalls || 0);
  const hasIndicator = () => page.evaluate(() => document.documentElement.hasAttribute('data-ym-ptt'));
  const press = (code) => page.keyboard.down(code);
  const release = (code) => page.keyboard.up(code);

  console.log('PushToTalk');

  await test('off by default: holding the key does nothing, even while "in a call"', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: true, deafened: false } }));
    await press('Backquote');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
    await release('Backquote');
    await sleep(60);
  });

  await test('joining a call mutes you automatically (muteOnJoin, default on)', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await sleep(40);
    await enable('PushToTalk');
    await sleep(80);
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: false, deafened: false } }));
    await sleep(80);
    assert.strictEqual((await voice()).muted, true, 'auto-muted on joining, so push-to-talk starts closed');
  });

  await test('holding the configured key unmutes; letting go mutes again', async () => {
    await press('Backquote');
    await sleep(80);
    assert.strictEqual((await voice()).muted, false);
    assert.strictEqual(await hasIndicator(), true);
    await release('Backquote');
    await sleep(80);
    assert.strictEqual((await voice()).muted, true);
    assert.strictEqual(await hasIndicator(), false);
  });

  await test('not in a call: holding the key does not touch mute at all', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await sleep(60);
    const before = await calls();
    await press('Backquote');
    await sleep(60);
    await release('Backquote');
    await sleep(60);
    assert.strictEqual(await calls(), before);
  });

  await test('a different key is ignored entirely', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: true, deafened: false } }));
    await sleep(60);
    await press('KeyB');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
    await release('KeyB');
  });

  await test('typing in the message box is never hijacked, even if it matches the PTT key', async () => {
    await page.click('.composer textarea');
    await page.keyboard.type('`');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer textarea').value), '`');
    assert.strictEqual((await voice()).muted, true, 'typing the key char did not open the mic');
    await page.evaluate(() => { document.querySelector('.composer textarea').value = ''; document.querySelector('.composer textarea').blur(); document.body.focus(); });
  });

  await test('does not fight a mute you set yourself while the key is not held', async () => {
    await page.evaluate(() => { const v = window.YapperMod.Store.getState().voice; window.YapperMod.Store.setState({ voice: { ...v, muted: false } }); });
    await sleep(60);
    assert.strictEqual((await voice()).muted, false, 'manually unmuting outside of PTT is left alone');
  });

  await test('the key is configurable', async () => {
    await page.evaluate(() => { const v = window.YapperMod.Store.getState().voice; window.YapperMod.Store.setState({ voice: { ...v, muted: true } }); });
    await setOpt('PushToTalk', 'key', 'KeyV');
    await sleep(60);
    await press('Backquote');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true, 'old key no longer does anything');
    await release('Backquote');
    await press('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, false);
    await release('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
  });

  await test('losing window focus while held releases the key (no stuck-open mic)', async () => {
    await press('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, false);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
    assert.strictEqual(await hasIndicator(), false);
    await release('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
  });

  await test('leaving the call mid-hold resets cleanly, with no leftover indicator', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: true, deafened: false } }));
    await sleep(60);
    await press('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, false);
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await sleep(60);
    assert.strictEqual(await hasIndicator(), false);
    await release('KeyV');
  });

  await test('switching it off stops it from reacting to the key at all', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: true, deafened: false } }));
    await sleep(60);
    await disable('PushToTalk');
    await sleep(60);
    await press('KeyV');
    await sleep(60);
    assert.strictEqual((await voice()).muted, true);
    await release('KeyV');
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
