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
    YM.settings.set('pluginData.HideChannels', []);
    YM.Store.setState({
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: {
        c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' },
        c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'spam' },
      },
    });
    const app = document.createElement('div');
    app.id = 'fxhc';
    app.style.cssText = 'position:fixed;left:0;top:0;width:500px;height:400px;z-index:10';
    app.innerHTML = `<div id="menuhost"></div>
      <div class="channel-row" data-nav-chan="c1" style="position:relative"><button class="channel-main">general</button></div>
      <div class="channel-row" data-nav-chan="c2" style="position:relative"><button class="channel-main">spam</button></div>`;
    document.body.append(app);
  });
  await sleep(150);
  const isHidden = (id) => page.evaluate((i) => { const r = document.querySelector(`[data-nav-chan="${i}"]`); return r.style.display === 'none'; }, id);
  const openCtxMenu = () => page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl'; o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Mute</span></button></div>'; document.getElementById('menuhost').append(o); });
  const closeCtxMenu = () => page.evaluate(() => { const o = document.getElementById('ovl'); if (o) o.remove(); });
  const menuLabel = () => page.evaluate(() => document.querySelector('.ctx-menu .ym-hc-item')?.textContent);

  console.log('HideChannels');

  await test('off by default: right-clicking a channel adds no menu item, nothing hidden', async () => {
    await page.click('.channel-row[data-nav-chan="c1"]', { button: 'right' });
    await openCtxMenu();
    await sleep(60);
    assert.strictEqual(await menuLabel(), undefined);
    await closeCtxMenu();
  });

  await test('"Hide channel" appears in the real right-click menu, and hides the row when clicked', async () => {
    await enable('HideChannels');
    await sleep(80);
    await page.click('.channel-row[data-nav-chan="c1"]', { button: 'right' });
    await openCtxMenu();
    await sleep(60);
    assert.strictEqual(await menuLabel(), 'Hide channel');
    await page.click('.ctx-menu .ym-hc-item');
    await closeCtxMenu();
    await sleep(60);
    assert.strictEqual(await isHidden('c1'), true);
    assert.strictEqual(await isHidden('c2'), false, 'only the one you right-clicked');
  });

  await test('an already-hidden channel offers no "Hide channel" item (nothing left to do from there)', async () => {

    await page.evaluate(() => document.querySelector('[data-nav-chan="c1"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    await openCtxMenu();
    await sleep(60);
    assert.strictEqual(await menuLabel(), undefined);
    await closeCtxMenu();
  });

  await test('the hidden list survives a settings read: HideChannels.api.read() has exactly the one id', async () => {
    const ids = await page.evaluate(() => window.YapperMod.plugins.get('HideChannels').api.read());
    assert.deepStrictEqual(ids, ['c1']);
  });

  await test('the options panel lists it with a label, and Unhide brings the row back', async () => {
    const rows = await page.evaluate(() => {
      const b = document.createElement('div'); b.id = 'hcbox'; document.body.append(b);
      const p = window.YapperMod.plugins.get('HideChannels');
      p.options.manage.render(b, p);
      return [...b.querySelectorAll('.ym-hc-row span')].map((n) => n.textContent);
    });
    assert.deepStrictEqual(rows, ['#general in Test Server']);
    await page.click('#hcbox .ym-hc-row button');
    await sleep(60);
    assert.strictEqual(await isHidden('c1'), false);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('HideChannels').api.read()), []);
  });

  await test('switching it off shows every channel again and removes the menu item', async () => {
    await page.evaluate(() => window.YapperMod.settings.set('pluginData.HideChannels', ['c2']));
    await sleep(80);
    assert.strictEqual(await isHidden('c2'), true);
    await disable('HideChannels');
    await sleep(60);
    assert.strictEqual(await isHidden('c2'), false, 'disabling it shows hidden channels again rather than leaving them stuck');
    await page.click('.channel-row[data-nav-chan="c1"]', { button: 'right' });
    await openCtxMenu();
    await sleep(60);
    assert.strictEqual(await menuLabel(), undefined);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
