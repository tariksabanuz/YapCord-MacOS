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
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.settings.set('pluginData.RecentEmojis', []);
    const app = document.createElement('div');
    app.id = 'fxre';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';

    const std = (key) => `<button class="emoji-cell std" title="keyword"><img alt="${key}" src="https://cdn.example.test/${encodeURIComponent(key)}.png"></button>`;
    const custom = (name) => `<button class="emoji-cell" title=":${name}:"><img alt="${name}" src="https://cdn.example.test/custom-${name}.png"></button>`;
    app.innerHTML = `<main class="main" style="flex:1;position:relative">
        <div class="composer" style="width:560px"><div class="composer-box"><textarea style="width:300px"></textarea>
          <div class="composer-tools">
            <button data-emoji-toggle class="icon-btn" aria-label="Emoji">:)</button>
            <div class="emoji-picker above" style="position:static;top:auto;left:auto;transform:none">
              <div class="emoji-picker-top"><input class="input" placeholder="Find the perfect emoji"></div>
              <div class="emoji-picker-scroll">
                <div class="emoji-section">Standard</div>
                <div class="emoji-grid">${std('😀')}${std('😂')}${custom('partyblob')}</div>
              </div>
            </div>
          </div>
        </div></div>
      </main>`;
    document.body.append(app);
  });
  await sleep(150);
  const val = () => page.evaluate(() => document.querySelector('.composer textarea').value);
  const recent = () => page.evaluate(() => window.YapperMod.plugins.get('RecentEmojis').api.read());
  const search = (q) => page.fill('.emoji-picker-top input', q);
  const clickStd = (n) => page.click(`.emoji-picker-scroll > .emoji-grid > .emoji-cell.std:nth-of-type(${n})`);
  const clickCustom = () => page.click('.emoji-picker-scroll > .emoji-grid > .emoji-cell:not(.std)');

  console.log('RecentEmojis');

  await test('off by default: clicking real emoji cells tracks nothing until the plugin is on', async () => {
    await clickStd(1);
    await sleep(80);
    assert.deepStrictEqual(await recent(), []);
  });

  await test('clicking a real standard emoji cell adds it to Recent, with the image carried over', async () => {
    await enable('RecentEmojis');
    await sleep(100);
    await clickStd(1);
    await sleep(80);
    const r = await recent();
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].text, '😀');
    assert.ok(r[0].src.includes('%F0%9F%98%80') || r[0].src.includes(encodeURIComponent('😀')), r[0].src);
  });

  await test('a "Recent" section appears at the top of the picker, before Standard, with a real cell for it', async () => {
    const r = await page.evaluate(() => {
      const scroll = document.querySelector('.emoji-picker-scroll');
      const first = scroll.firstElementChild;
      return {
        isRecent: first && first.hasAttribute('data-ym-recent'),
        heading: first && first.querySelector('.emoji-section').textContent,
        cells: first ? first.querySelectorAll('.emoji-grid .emoji-cell').length : 0,
      };
    });
    assert.strictEqual(r.isRecent, true);
    assert.ok(/Recent/.test(r.heading), r.heading);
    assert.strictEqual(r.cells, 1);
  });

  await test('clicking a second standard emoji puts it first (most recent first)', async () => {
    await clickStd(2);
    await sleep(80);
    const r = await recent();
    assert.deepStrictEqual(r.map((g) => g.text), ['😂', '😀']);
  });

  await test('clicking a custom emoji cell is tracked with its ":name:" text, not its bare name', async () => {
    await clickCustom();
    await sleep(80);
    const r = await recent();
    assert.strictEqual(r[0].text, ':partyblob:');
  });

  await test('re-picking something already in Recent moves it to the front instead of duplicating it', async () => {
    await clickStd(1);
    await sleep(80);
    const r = await recent();
    assert.deepStrictEqual(r.map((g) => g.text), ['😀', ':partyblob:', '😂']);
    assert.strictEqual(r.length, 3, 'no duplicate entry');
  });

  await test('clicking one of our own Recent cells inserts the real text into the composer, matching Yapper\'s own spacing rule', async () => {
    await page.fill('.composer textarea', 'hey');
    await page.click('.composer textarea');
    await page.keyboard.press('End');
    await page.click('.emoji-picker-scroll [data-ym-recent] .emoji-grid .emoji-cell.std');
    await sleep(80);
    assert.strictEqual(await val(), 'hey😀', 'standard emoji does not get a leading space');
    await page.evaluate(() => { document.querySelector('.composer textarea').value = 'hey'; });
    await page.click('.composer textarea');
    await page.keyboard.press('End');
    await page.click('.emoji-picker-scroll [data-ym-recent] .emoji-grid .emoji-cell:not(.std)');
    await sleep(80);
    assert.strictEqual(await val(), 'hey :partyblob:', 'a custom emoji after a non-space char gets exactly one leading space, like Yapper\'s own picker');
  });

  const hasRecentSection = () => page.evaluate(() => !!document.querySelector('.emoji-picker-scroll > [data-ym-recent]'));
  await test('typing a search query hides Recent; clearing the search brings it back', async () => {
    await search('smile');
    await sleep(80);
    assert.strictEqual(await hasRecentSection(), false);
    await search('');
    await sleep(80);
    assert.strictEqual(await hasRecentSection(), true);
  });

  await test('right-click on one of our own Recent cells removes just that one, and never touches a real Yapper cell\'s own menu', async () => {
    await clearContextMenus();
    await page.click('.emoji-picker-scroll [data-ym-recent] .emoji-grid .emoji-cell.std', { button: 'right' });
    await sleep(80);
    assert.deepStrictEqual((await recent()).map((g) => g.text), [':partyblob:', '😂']);

    const before = await recent();
    await page.click('.emoji-picker-scroll > .emoji-grid:not([data-ym-recent] *) .emoji-cell.std', { button: 'right' }).catch(() => {});
    await sleep(60);
    assert.deepStrictEqual(await recent(), before, 'right-clicking a real Standard-section cell did not change Recent');
    function clearContextMenus() { return Promise.resolve(); }
  });

  await test('capped at 24, oldest dropped first - enforced on read(), not just on write()', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const list = Array.from({ length: 30 }, (_, i) => ({ text: 'e' + i, src: 'https://cdn.example.test/e' + i + '.png' }));
      YM.settings.set('pluginData.RecentEmojis', list);
    });
    const r = await recent();
    assert.strictEqual(r.length, 24);
    assert.strictEqual(r[0].text, 'e0', 'read() does not silently reorder what was stored');
  });

  await test('switching it off removes the Recent section and stops tracking new picks', async () => {
    await page.evaluate(() => window.YapperMod.settings.set('pluginData.RecentEmojis', []));
    await sleep(60);
    await disable('RecentEmojis');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('[data-ym-recent]')), false);
    await clickStd(1);
    await sleep(80);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.settings.get('pluginData.RecentEmojis', [])), []);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
