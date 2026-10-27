'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: { ImageZoom: { enabled: true } } } } });
  const { page, consoleLog } = site;

  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    const app = document.createElement('div');
    app.style.cssText = 'position:fixed;left:0;top:0;z-index:10;background:var(--bg-main)';
    app.innerHTML = '<div class="msg-image" style="width:200px;height:150px;display:block"><img id="zoomimg" src="https://example.test/pic.png" style="width:200px;height:150px;display:block"></div>';
    document.body.append(app);
  });

  await test('ImageZoom enabled from saved settings (so it starts at boot, before <body> necessarily exists) does not crash', async () => {
    assert.ok(await page.evaluate(() => window.YapperMod.plugins.isRunning('ImageZoom')), 'started successfully, not left broken by a thrown error');
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.errors.get('ImageZoom')), undefined, 'no start() error recorded');
    const crashed = consoleLog.some((m) => /reading 'append'|Cannot read propert/i.test(m.text));
    assert.ok(!crashed, 'no "Cannot read properties of null (reading \'append\')" in the console');
  });
  await test('the lens still ends up in the document and still works once the page has settled', async () => {
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-iz-lens').length), 1, 'appended exactly once (not skipped, not duplicated)');
    const box = await page.evaluate(() => { const r = document.getElementById('zoomimg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x, box.y);
    await sleep(80);
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.ym-iz-lens')).display), 'none', 'the magnifier actually works, not just "didn\'t crash"');
  });

  await site.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
