'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');
const { buildUri } = require('../tools/build-bookmarklet');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       ')); }
}

(async () => {

  const site = await openSite({ bundle: false });
  const { page } = site;
  const sleep = (ms) => page.waitForTimeout(ms);
  const decoded = decodeURIComponent(buildUri().slice('javascript:'.length));

  await page.goto('https://www.yapper.website/', { waitUntil: 'load', timeout: 15000 });
  await sleep(500);

  await test('before the tap: nothing of ours is present yet', async () => {
    assert.strictEqual(await page.evaluate(() => !!window.YapperMod), false);
  });

  await test('the tap itself: running the decoded script on the already-loaded page boots the full runtime', async () => {
    const r = await page.evaluate((src) => {

      (0, eval)(src);
      const YM = window.YapperMod;
      return {
        present: !!YM,
        mode: YM && YM.initial.app.mode,
        inApp: YM && YM.inApp,
        pluginCount: YM && YM.plugins.list().length,
        alwaysOnRunning: YM && YM.plugins.list().filter((p) => p.alwaysOn).every((p) => YM.plugins.isRunning(p.name)),
      };
    }, decoded);
    assert.strictEqual(r.present, true);
    assert.strictEqual(r.mode, 'bookmarklet');
    assert.strictEqual(r.inApp, false);
    assert.ok(r.pluginCount >= 33, 'expected at least 33 plugins, got ' + r.pluginCount);
    assert.strictEqual(r.alwaysOnRunning, true, 'always-on plugins still start fine even booted this late');
  });

  await test('no console errors from YapperMod itself booting this late', () => {
    const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
    assert.deepStrictEqual(errs, []);
  });

  await test('DOM-based plugin UI still finds and decorates elements that were already on the page before the tap (dom.watch scans immediately, not just future mutations)', async () => {

    await page.evaluate(() => {
      document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="user-bar"><button class="icon-btn" aria-label="Settings" title="Settings">gear</button></div>
        <div class="overlay"><div class="modal"><div class="settings">
          <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" data-k="account">My Account</button></nav>
          <section class="settings-main"><div><h2>My Account</h2></div></section>
        </div></div></div>`;
      document.body.append(wrap);
    });
    await sleep(300);
    const r = await page.evaluate(() => ({
      quickButton: !!document.querySelector('.user-bar .ym-userbar-btn'),
      navLabel: document.querySelector('.settings-nav .ym-nav-label')?.textContent,
      pageCount: document.querySelectorAll('.settings-nav .ym-nav-btn').length,
    }));
    assert.strictEqual(r.quickButton, true, 'the quick-open button was added to a user-bar that already existed when YapCord booted');
    assert.strictEqual(r.navLabel, 'YapCord');
    assert.ok(r.pageCount >= 6);
  });

  await test('settings and Custom CSS set after the (late) boot still persist to localStorage and are read back correctly - a second tap picks up where the first left off', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.settings.set('plugins.NoTrack.enabled', true);
      await YM.themes.setQuickCss(':root{--ym-bm-test:3}');
      return {
        settingsRaw: localStorage.getItem('yappermod:fallback-settings'),
        css: getComputedStyle(document.documentElement).getPropertyValue('--ym-bm-test').trim(),
      };
    });
    assert.strictEqual(JSON.parse(r.settingsRaw).plugins.NoTrack.enabled, true);
    assert.strictEqual(r.css, '3');
  });

  await test('tapping it again on the same tab is a safe no-op (the loaded guard), and a fresh page load picks up what was saved', async () => {
    const secondTap = await page.evaluate((src) => {
      const before = window.YapperMod;

      (0, eval)(src);
      return window.YapperMod === before;
    }, decoded);
    assert.strictEqual(secondTap, true, 'same YM object - the __YAPPERMOD_LOADED__ guard stopped it from re-running');

    await page.goto('https://www.yapper.website/', { waitUntil: 'load', timeout: 15000 });
    await sleep(300);
    const beforeTap = await page.evaluate(() => !!window.YapperMod);
    assert.strictEqual(beforeTap, false, 'a fresh page load starts clean again - the bookmarklet has to be tapped every time, unlike a real extension');
    await page.evaluate((src) => { (0, eval)(src); }, decoded);
    const r = await page.evaluate(() => ({
      noTrack: window.YapperMod.initial.settings.plugins?.NoTrack?.enabled,
      css: getComputedStyle(document.documentElement).getPropertyValue('--ym-bm-test').trim(),
    }));
    assert.deepStrictEqual(r, { noTrack: true, css: '3' });
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await site.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
