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
  const setOpt = (k, v) => page.evaluate(([key, val]) => window.YapperMod.plugins.get('UIPolish').settings.set(key, val), [k, v]);
  const styleText = () => page.evaluate(() => { const el = document.getElementById('ym-style-plugin-UIPolish'); return el ? el.textContent : null; });

  await page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    document.documentElement.style.setProperty('--accent', '#5865f2');
    const app = document.createElement('div');
    app.id = 'fxup';
    app.style.cssText = 'position:fixed;left:0;top:0;width:500px;height:400px;z-index:10';
    app.innerHTML = `
      <button class="icon-btn" id="btn1" style="width:32px;height:32px">+</button>
      <div class="avatar" id="av1" style="width:40px;height:40px;display:inline-block"></div>
      <span class="rail-pill" id="pill1" style="display:block;width:4px;height:8px"></span>
      <div class="composer-box" id="box1" style="padding:8px"><textarea tabindex="0"></textarea></div>
      <div class="sidebar-scroll" id="sb1" style="height:40px;overflow:auto"></div>
      <div class="emoji-picker-scroll" id="ep1" style="height:40px;overflow:auto"></div>`;
    document.body.append(app);
  });
  await sleep(100);

  console.log('UIPolish');

  await test('alwaysOn: already running with no toggle needed, and every option is on by default', async () => {
    assert.ok(await page.evaluate(() => window.YapperMod.plugins.isRunning('UIPolish')));
    const css = await styleText();
    assert.ok(css && css.includes('prefers-reduced-motion'), 'motion touches are gated by reduce-motion');
    assert.ok(/\.icon-btn[^}]*:active[^{]*\{transform:scale/.test(css), 'press rule present');
    assert.ok(/\.avatar:hover\{[^}]*transform/.test(css), 'avatar hover rule present');
    assert.ok(/\.rail-pill\{[^}]*transition/.test(css), 'rail pill transition present');
    assert.ok(/\.composer-box:focus-within\{[^}]*box-shadow/.test(css), 'focus glow rule present');
    assert.ok(/\.sidebar-scroll::-webkit-scrollbar-thumb/.test(css), 'scrollbar rule present');
  });

  await test('pressing a button actually scales it down, and releasing returns it to normal', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.getElementById('btn1')).transform);
    await page.hover('#btn1');
    await page.mouse.down();
    await sleep(200);
    const pressed = await page.evaluate(() => getComputedStyle(document.getElementById('btn1')).transform);
    await page.mouse.up();
    await sleep(200);
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('btn1')).transform);
    assert.notStrictEqual(pressed, before, 'scaled down while held');
    assert.ok(/matrix\(0\.94,/.test(pressed) || /matrix\(0\.939|0\.94/.test(pressed), 'scaled to .94: ' + pressed);
    assert.strictEqual(after, before, 'back to normal once released');
  });

  await test('hovering an avatar lifts it with a glow, and it lets go on mouse-out', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.getElementById('av1')).boxShadow);
    await page.hover('#av1');
    await sleep(220);
    const hovered = await page.evaluate(() => getComputedStyle(document.getElementById('av1')).boxShadow);
    assert.notStrictEqual(hovered, before);
    await page.mouse.move(490, 390);
    await sleep(220);
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('av1')).boxShadow);
    assert.strictEqual(after, before);
  });

  await test('focusing the message box adds a soft accent glow, blurring removes it', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.getElementById('box1')).boxShadow);
    await page.focus('#box1 textarea');
    await sleep(220);
    const focused = await page.evaluate(() => getComputedStyle(document.getElementById('box1')).boxShadow);
    assert.notStrictEqual(focused, before);
    await page.evaluate(() => document.getElementById('box1').querySelector('textarea').blur());
    await sleep(220);
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('box1')).boxShadow);
    assert.strictEqual(after, before);
  });

  await test('each option only removes its own rule, and leaves the others alone', async () => {
    const checks = [
      ['press', /\.icon-btn[^}]*:active[^{]*\{transform:scale/],
      ['avatarGlow', /\.avatar:hover\{[^}]*transform/],
      ['rail', /\.rail-pill\{[^}]*transition/],
      ['focusGlow', /\.composer-box:focus-within\{[^}]*box-shadow/],
      ['scrollbars', /\.sidebar-scroll::-webkit-scrollbar-thumb/],
    ];
    for (const [key, re] of checks) {
      await setOpt(key, false);
      await sleep(60);
      const css = await styleText();
      assert.ok(!re.test(css), key + ' off: its own rule is gone');
      for (const [otherKey, otherRe] of checks) { if (otherKey !== key) assert.ok(otherRe.test(css), key + ' off should not touch ' + otherKey); }
      await setOpt(key, true);
      await sleep(60);
    }
  });

  await test('"reduce motion" turns off press/avatar/rail/focus, but not the scrollbar recolour', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(80);
    const beforeHover = await page.evaluate(() => getComputedStyle(document.getElementById('av1')).boxShadow);
    await page.hover('#av1');
    await sleep(80);
    const duringHover = await page.evaluate(() => getComputedStyle(document.getElementById('av1')).boxShadow);
    assert.strictEqual(duringHover, beforeHover, 'the avatar glow rule itself does not apply under reduce-motion');
    await page.mouse.move(490, 390);
    await sleep(50);
    const thumb = await page.evaluate(() => getComputedStyle(document.getElementById('sb1'), '::-webkit-scrollbar-thumb').backgroundColor || 'n/a');

    const css = await styleText();
    assert.ok(/\.sidebar-scroll::-webkit-scrollbar-thumb/.test(css), 'scrollbar rule is untouched by reduce-motion: ' + thumb);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sleep(80);
  });

  await test('alwaysOn: cannot be switched off - setEnabled(false) is a no-op, same as SmoothTransitions/MessageFX', async () => {
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('UIPolish', false));
    await sleep(60);
    assert.ok(await page.evaluate(() => window.YapperMod.plugins.isRunning('UIPolish')));
    assert.ok(await page.evaluate(() => !!document.getElementById('ym-style-plugin-UIPolish')));
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
