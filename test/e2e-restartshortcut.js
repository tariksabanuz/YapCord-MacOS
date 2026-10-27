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
  const reloads = () => page.evaluate(() => window.__reloadCalls);

  await page.evaluate(() => {
    window.__reloadCalls = 0;

    window.YapperMod.native.app.reload = () => { window.__reloadCalls++; };
    const ta = document.createElement('textarea');
    ta.className = 'composer-fake-textarea';
    document.body.append(ta);
  });
  await sleep(100);

  await test('Ctrl+R reloads the app in place, from anywhere on the page', async () => {
    await page.click('body');
    assert.strictEqual(await reloads(), 0);
    await page.keyboard.press('Control+r');
    await sleep(50);
    assert.strictEqual(await reloads(), 1);
  });

  await test('Cmd+R (metaKey) does the same, for Mac', async () => {
    await page.keyboard.press('Meta+r');
    await sleep(50);
    assert.strictEqual(await reloads(), 2);
  });

  await test('still works while actually typing in the message box - never loses the shortcut to "just type the letter"', async () => {
    await page.click('.composer-fake-textarea');
    await page.keyboard.type('a half-typed message');
    await page.keyboard.press('Control+r');
    await sleep(50);
    assert.strictEqual(await reloads(), 3);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer-fake-textarea').value), 'a half-typed message', 'the textarea itself is untouched - this never typed an "r" into it');
  });

  await test('Ctrl+Shift+R (force reload) is deliberately left alone - not this shortcut\'s to take', async () => {
    await page.keyboard.press('Control+Shift+r');
    await sleep(50);
    assert.strictEqual(await reloads(), 3, 'unchanged');
  });

  await test('a plain "r" with no modifier still just types normally', async () => {
    await page.evaluate(() => { document.querySelector('.composer-fake-textarea').value = ''; });
    await page.keyboard.press('r');
    await sleep(50);
    assert.strictEqual(await reloads(), 3, 'unchanged');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer-fake-textarea').value), 'r');
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('RestartShortcut');
      YM.plugins.setEnabled('RestartShortcut', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('RestartShortcut'), err: YM.plugins.errors.get('RestartShortcut') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
