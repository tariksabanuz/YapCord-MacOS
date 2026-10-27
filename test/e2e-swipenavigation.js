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
    window.__back = 0;
    window.__fwd = 0;
    history.back = () => { window.__back++; };
    history.forward = () => { window.__fwd++; };

    let nextId = 1;
    const mk = (target, x, y) => new Touch({ identifier: window.__gestureId, target, clientX: x, clientY: y });

    window.__swipe = (x1, y1, x2, y2, opts = {}) => {
      const target = opts.target || document.body;
      const steps = opts.steps || 6;
      window.__gestureId = nextId++;
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mk(target, x1, y1)], changedTouches: [mk(target, x1, y1)] }));
      for (let i = 1; i <= steps; i++) {
        const x = x1 + ((x2 - x1) * i) / steps;
        const y = y1 + ((y2 - y1) * i) / steps;
        target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [mk(target, x, y)], changedTouches: [mk(target, x, y)] }));
      }
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(target, x2, y2)] }));
    };

    const scroller = document.createElement('div');
    scroller.className = 'fake-horizontal-scroller';
    scroller.style.overflowX = 'scroll';
    scroller.style.width = '100px';
    const inner = document.createElement('div');
    inner.style.width = '500px';
    inner.style.height = '1px';
    scroller.append(inner);
    document.body.append(scroller);

    const message = document.createElement('div');
    message.className = 'fake-message';
    window.__replyMoves = 0;
    window.__replyEnds = 0;
    message.addEventListener('touchmove', () => { window.__replyMoves++; });
    message.addEventListener('touchend', () => { window.__replyEnds++; });
    document.body.append(message);
  });
  await sleep(100);
  const counts = () => page.evaluate(() => ({ back: window.__back, fwd: window.__fwd }));
  const replyCounts = () => page.evaluate(() => ({ moves: window.__replyMoves, ends: window.__replyEnds }));

  await test('a left-to-right swipe (finger moves right) calls history.back()', async () => {
    await page.evaluate(() => window.__swipe(50, 300, 250, 300));
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 1, fwd: 0 });
  });

  await test('a right-to-left swipe (finger moves left) does nothing - no forward(), no ping-pong back into the channel', async () => {
    await page.evaluate(() => window.__swipe(250, 300, 50, 300));
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 1, fwd: 0 });
  });

  await test('too short a swipe does nothing', async () => {
    await page.evaluate(() => window.__swipe(100, 300, 130, 300));
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 1, fwd: 0 });
  });

  await test('a mostly-vertical drag (scrolling) does nothing', async () => {
    await page.evaluate(() => window.__swipe(100, 100, 180, 400));
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 1, fwd: 0 });
  });

  await test('a swipe starting inside a horizontally-scrollable element is left alone for that element', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('.fake-horizontal-scroller');
      window.__swipe(20, 10, 90, 10, { target: el });
    });
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 1, fwd: 0 });
  });

  await test('a qualifying swipe that starts on a message never reaches that message\'s own touchmove/touchend listeners - Yapper\'s swipe-to-reply cannot fire', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('.fake-message');
      window.__swipe(50, 300, 250, 300, { target: el });
    });
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 2, fwd: 0 }, 'navigation still happened');
    assert.deepStrictEqual(await replyCounts(), { moves: 0, ends: 0 }, "the message's own listeners saw nothing once the swipe committed");
  });

  await test('a short tap/wobble on a message (never crosses the commit distance) still reaches its own listeners untouched - long-press-to-reply still works', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('.fake-message');
      window.__swipe(100, 300, 105, 300, { target: el, steps: 2 });
    });
    await sleep(50);
    assert.deepStrictEqual(await counts(), { back: 2, fwd: 0 }, 'no navigation for a non-swipe touch');
    const r = await replyCounts();
    assert.ok(r.moves > 0 && r.ends > 0, 'the message element still saw its own touch events: ' + JSON.stringify(r));
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('SwipeNavigation');
      YM.plugins.setEnabled('SwipeNavigation', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('SwipeNavigation'), err: YM.plugins.errors.get('SwipeNavigation') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
