'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

async function extra(page) {
  await page.addInitScript(() => {
    window.__calls = [];
    let realYM;
    Object.defineProperty(window, 'YapperMod', {
      configurable: true,
      enumerable: true,
      get() { return realYM; },
      set(ym) {
        realYM = ym;
        Object.defineProperty(ym, 'finder', {
          configurable: true,
          enumerable: true,
          get() { return undefined; },
          set(finderObj) {
            const real = finderObj.findExports.bind(finderObj);
            const fakeMod = { reorderRoles: (...args) => { window.__calls.push(args); return Promise.resolve('ok'); } };
            finderObj.findExports = (names) => (names.includes('reorderRoles') ? fakeMod : real(names));

            Object.defineProperty(ym, 'finder', { value: finderObj, writable: true, configurable: true, enumerable: true });
          },
        });

        Object.defineProperty(window, 'YapperMod', { value: ym, writable: true, configurable: true, enumerable: true });
      },
    });
  });
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: {} } }, extra });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__calls.length = 0;
  });
  await sleep(100);

  const clickReorder = () => page.evaluate(() => window.YapperMod.finder.findExports(['reorderRoles']).reorderRoles('s1', ['r3', 'r1', 'r2']));

  await test('calling the real function now goes through a confirmation instead of saving straight away', async () => {
    const p = clickReorder();
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.ym-modal')), true, 'a confirmation dialog is up');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal h2').textContent), 'Reorder roles?');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Yes, reorder').click());
    const result = await p;
    assert.strictEqual(result, 'ok', 'the real function\'s own result still comes back out to whatever called it');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), [['s1', ['r3', 'r1', 'r2']]], 'whatever arguments Yapper passed went through completely unchanged');
  });

  await test('closing it with Escape is a real cancel - the real function is never called, and nothing hangs', async () => {
    await page.evaluate(() => { window.__calls.length = 0; });
    const p = clickReorder();
    await sleep(100);
    await page.keyboard.press('Escape');
    const result = await p;
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), []);
  });

  await test('the built-in "Close" button is the same real cancel', async () => {
    const p = clickReorder();
    await sleep(100);
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Close').click());
    const result = await p;
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), []);
  });

  await test('turning the setting off skips the question entirely - straight through to the real function, as before', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('RoleReorderConfirm').settings.set('confirm', false));
    const result = await clickReorder();
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.ym-modal')), false, 'no dialog this time');
    assert.strictEqual(result, 'ok');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), [['s1', ['r3', 'r1', 'r2']]]);
    await page.evaluate(() => window.YapperMod.plugins.get('RoleReorderConfirm').settings.set('confirm', true));
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('RoleReorderConfirm');
      YM.plugins.setEnabled('RoleReorderConfirm', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('RoleReorderConfirm'), err: YM.plugins.errors.get('RoleReorderConfirm') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  await site.close();

  async function extraFrozen(page) {
    await page.addInitScript(() => {
      window.__frozenCalls = [];
      let realYM;
      Object.defineProperty(window, 'YapperMod', {
        configurable: true,
        enumerable: true,
        get() { return realYM; },
        set(ym) {
          realYM = ym;
          Object.defineProperty(ym, 'finder', {
            configurable: true,
            enumerable: true,
            get() { return undefined; },
            set(finderObj) {
              const real = finderObj.findExports.bind(finderObj);
              const frozenMod = {};
              Object.defineProperty(frozenMod, 'reorderRoles', {
                value: (...args) => { window.__frozenCalls.push(args); return Promise.resolve('ok'); },
                writable: false,
                configurable: false,
                enumerable: true,
              });
              finderObj.findExports = (names) => (names.includes('reorderRoles') ? frozenMod : real(names));
              Object.defineProperty(ym, 'finder', { value: finderObj, writable: true, configurable: true, enumerable: true });
            },
          });
          Object.defineProperty(window, 'YapperMod', { value: ym, writable: true, configurable: true, enumerable: true });
        },
      });
    });
  }

  const site2 = await openSite({ initial: { settings: { plugins: {} } }, extra: extraFrozen });
  const page2 = site2.page;
  await page2.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page2.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  await page2.waitForTimeout(100);

  await test('a frozen reorderRoles export (writable: false, configurable: false, like the real build) never throws past start() and leaves the real function working unconfirmed', async () => {
    const result = await page2.evaluate(() => window.YapperMod.finder.findExports(['reorderRoles']).reorderRoles('s1', ['r3', 'r1', 'r2']));
    assert.strictEqual(result, 'ok', 'the frozen function still runs fine on its own - nothing here breaks a real reorder');
    assert.deepStrictEqual(await page2.evaluate(() => window.__frozenCalls), [['s1', ['r3', 'r1', 'r2']]], 'called directly, never silently swallowed');
    assert.strictEqual(await page2.evaluate(() => !!document.querySelector('.ym-modal')), false, 'no confirmation - it genuinely could not be installed, and does not pretend otherwise');
    assert.deepStrictEqual(
      await page2.evaluate(() => {
        const YM = window.YapperMod; const p = YM.plugins.get('RoleReorderConfirm');
        return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('RoleReorderConfirm'), err: YM.plugins.errors.get('RoleReorderConfirm') };
      }),
      { exists: true, alwaysOn: true, running: true, err: undefined },
      'still registered, always on and running without error - a property it cannot safely replace is this plugin doing nothing, not this plugin crashing',
    );
    const pageErrors = site2.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200));
    assert.deepStrictEqual(pageErrors, [], 'no uncaught exception reached the page at all');
  });

  await site2.close();

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
