'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({
    initial: { settings: { plugins: {} } },
    extra: (p) => p.addInitScript(() => {
      window.__gdmCalls = [];
      if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
      navigator.mediaDevices.getDisplayMedia = (c) => {
        window.__gdmCalls.push(c === undefined ? null : JSON.parse(JSON.stringify(c)));
        return Promise.resolve({ getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] });
      };
    }),
  });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  await sleep(100);
  const lastCall = async () => (await page.evaluate(() => window.__gdmCalls)).at(-1);

  await test("a call that never mentioned audio gets audio:true added, video left exactly as asked", async () => {
    await page.evaluate(() => navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 } }));
    assert.deepStrictEqual(await lastCall(), { video: { frameRate: 30 }, audio: true });
  });

  await test('a call that explicitly asked for no audio is upgraded too - the point is the choice exists, not what Yapper happened to ask for', async () => {
    await page.evaluate(() => navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }));
    assert.deepStrictEqual(await lastCall(), { video: true, audio: true });
  });

  await test('a call that already asked for audio is left alone, not doubled up or broken', async () => {
    await page.evaluate(() => navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: true } }));
    assert.deepStrictEqual(await lastCall(), { video: true, audio: { echoCancellation: true } });
  });

  await test('a call made with no arguments at all still gets the ask added', async () => {
    await page.evaluate(() => navigator.mediaDevices.getDisplayMedia());
    assert.deepStrictEqual(await lastCall(), { audio: true });
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('ScreenShareAudioToggle');
      YM.plugins.setEnabled('ScreenShareAudioToggle', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('ScreenShareAudioToggle'), err: YM.plugins.errors.get('ScreenShareAudioToggle') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
