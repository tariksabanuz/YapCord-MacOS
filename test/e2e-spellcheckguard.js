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

  await page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const main = document.createElement('main');
    main.className = 'main';
    main.innerHTML = '<div class="composer"><div class="composer-box"><textarea spellcheck="false" maxlength="2000"></textarea></div></div>';
    document.body.append(main);
  });
  await sleep(100);

  await test('a message box that starts with spellcheck off is turned back on', async () => {
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer textarea').spellcheck), true);
  });

  await test('a message box torn down and rebuilt later (a channel switch, say) gets the same treatment', async () => {
    await page.evaluate(() => {
      document.querySelector('.composer-box').innerHTML = '<textarea spellcheck="false" maxlength="2000"></textarea>';
    });
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer textarea').spellcheck), true);
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('SpellcheckGuard');
      YM.plugins.setEnabled('SpellcheckGuard', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('SpellcheckGuard'), err: YM.plugins.errors.get('SpellcheckGuard') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
