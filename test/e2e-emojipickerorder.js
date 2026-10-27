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
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.Store.setState({
      userId: 'me',
      servers: {
        s1: { id: 's1', name: 'Alpha' },
        s2: { id: 's2', name: 'Bravo' },
        s3: { id: 's3', name: 'Charlie' },
      },
    });
    const section = (name) => `<div class="emoji-section">${name}</div><div class="emoji-grid"><button class="emoji-cell" title=":x:"><img alt="x" src="x.png"></button></div>`;
    const app = document.createElement('div');
    app.id = 'fx-epo';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:10;display:flex;background:#1a1b20;color:#fff';

    app.innerHTML = '<nav class="rail" aria-label="Servers">'
      + '<div class="rail-wrap"><button class="rail-item" data-server="s3" title="Charlie">C</button></div>'
      + '<div class="rail-wrap"><button class="rail-item" data-server="s1" title="Alpha">A</button></div>'
      + '<div class="rail-wrap"><button class="rail-item" data-server="s2" title="Bravo">B</button></div>'
      + '</nav>'
      + '<main class="main" style="flex:1;position:relative">'
      + '<div class="composer"><div class="composer-box">'
      + '<div class="emoji-picker above" style="position:static;top:auto;left:auto;transform:none;height:400px;overflow:auto">'
      + '<div class="emoji-picker-top"><input class="input" placeholder="Find the perfect emoji"></div>'

      + '<div class="emoji-picker-scroll">' + section('Standard') + section('Alpha') + section('Bravo') + section('Charlie') + '</div>'
      + '</div></div></div>'
      + '</main>';
    document.body.append(app);
  });
  await sleep(150);

  const headingsInVisualOrder = () => page.evaluate(() => {
    const scroll = document.querySelector('.emoji-picker-scroll');
    const sections = [...scroll.querySelectorAll('.emoji-section')];
    return sections
      .map((el) => ({ text: el.textContent.trim(), top: el.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top)
      .map((x) => x.text);
  });

  await test('server emoji sections are reordered to match the real server list, in their real visual (not just style-attribute) position', async () => {
    const headings = await headingsInVisualOrder();
    assert.deepStrictEqual(headings, ['Standard', 'Charlie', 'Alpha', 'Bravo'], 'Standard stays pinned first; the three server sections now follow the rail order (Charlie, Alpha, Bravo), not the picker\'s own alphabetical one');
  });

  await test('a server renamed or reordered later updates the picker again, live', async () => {
    await page.evaluate(() => {

      const rail = document.querySelector('nav.rail');
      const wrapOf = (id) => rail.querySelector('[data-server="' + id + '"]').closest('.rail-wrap');
      const [c, a, b] = [wrapOf('s3'), wrapOf('s1'), wrapOf('s2')];
      rail.append(b, c, a);
    });
    await sleep(150);
    assert.deepStrictEqual(await headingsInVisualOrder(), ['Standard', 'Bravo', 'Charlie', 'Alpha']);
  });

  await test('a heading that matches no real server (a typo, or a server this account somehow has no record of) is left exactly where it was', async () => {
    await page.evaluate(() => {
      const scroll = document.querySelector('.emoji-picker-scroll');
      scroll.insertAdjacentHTML('beforeend', '<div class="emoji-section">Mystery Server</div><div class="emoji-grid"></div>');
    });
    await sleep(150);
    const headings = await headingsInVisualOrder();
    assert.strictEqual(headings[headings.length - 1], 'Mystery Server', 'stayed at the end, where it was added - never guessed into a slot');
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('EmojiPickerOrder');
      YM.plugins.setEnabled('EmojiPickerOrder', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('EmojiPickerOrder'), err: YM.plugins.errors.get('EmojiPickerOrder') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
