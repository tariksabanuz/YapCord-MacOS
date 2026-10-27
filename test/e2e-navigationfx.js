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

    document.body.insertAdjacentHTML('beforeend', `
      <nav class="rail" aria-label="Servers" id="fx-nav-rail">
        <div class="drag-list bare">
          <div class="drag-row"><div data-rail-row="s1"><div class="rail-wrap"><span class="rail-pill"></span>
            <button class="rail-item active" title="Alpha" aria-label="Alpha"><span class="server-initials">A</span></button>
          </div></div></div>
          <div class="drag-row"><div data-rail-row="s2"><div class="rail-wrap"><span class="rail-pill"></span>
            <button class="rail-item" title="Beta" aria-label="Beta"><span class="server-initials">B</span></button>
          </div></div></div>
        </div>
      </nav>`);
    YM.Store.setState({ activeServerId: 's1', activeChannelId: 'c1' });
  });
  await sleep(100);

  const pulsing = () => page.evaluate(() => [...document.querySelectorAll('#fx-nav-rail .ym-nav-serverpulse')].map((n) => n.closest('[data-rail-row]')?.getAttribute('data-rail-row')));

  await test('switching servers pulses the new server\'s real rail icon (data-rail-row, not the old unconfirmed data-server)', async () => {
    assert.deepStrictEqual(await pulsing(), [], 'nothing pulsing yet');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeServerId: 's2' }));
    await sleep(30);
    assert.deepStrictEqual(await pulsing(), ['s2'], 'the icon for the server actually switched to is the one that pulses');
  });

  await test('switching back to a server you were already on (no real change) does not re-pulse it', async () => {
    const before = await pulsing();
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c2' }));
    await sleep(30);
    assert.deepStrictEqual(await pulsing(), before, 'no server switch, no new pulse');
  });

  await test('turning the "pulse a server when you switch to it" option off stops it', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('NavigationFX').settings.set('serverSwitch', false));
    await page.evaluate(() => window.YapperMod.Store.setState({ activeServerId: 's1' }));
    await sleep(30);
    assert.deepStrictEqual(await pulsing(), [], 'the option being off is honoured, same as every other NavigationFX switch');
    await page.evaluate(() => window.YapperMod.plugins.get('NavigationFX').settings.set('serverSwitch', true));
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('NavigationFX');
      YM.plugins.setEnabled('NavigationFX', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('NavigationFX'), err: YM.plugins.errors.get('NavigationFX') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
