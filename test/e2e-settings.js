'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { openSite } = require('./lib/site');

const SHOTS = process.env.YM_SHOTS || '';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       ')); }
}

(async () => {
  const on = (n) => ({ [n]: { enabled: true } });
  const site = await openSite({ initial: { settings: { plugins: Object.assign({}, ...['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'NoTrack'].map(on)) } } });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {

    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const wrap = document.createElement('div');
    wrap.id = 'fx';
    wrap.innerHTML = `
      <div class="user-bar"><button class="icon-btn" aria-label="Settings" title="Settings">gear</button><button class="icon-btn" aria-label="Log out">out</button></div>
      <div class="overlay"><div class="modal"><div class="settings">
        <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" data-k="account">My Account</button><button data-k="profile">My Profile</button><div class="settings-nav-label" style="margin-top:14px">App settings</div><button data-k="appearance">Appearance</button><button data-k="advanced">Advanced</button></nav>
        <section class="settings-main"><div><h2>My Account</h2><p>React-owned account page</p></div></section>
      </div></div></div>`;
    document.body.append(wrap);
  });
  await sleep(300);

  await test('nav section and quick button are injected (Backup & Restore hidden outside the app)', async () => {
    const r = await page.evaluate(() => ({
      pages: [...document.querySelectorAll('.settings-nav .ym-nav-btn')].map((b) => b.textContent),
      label: document.querySelector('.settings-nav .ym-nav-label')?.textContent,
      quick: !!document.querySelector('.user-bar .ym-userbar-btn'),
      quickBeforeGear: document.querySelector('.user-bar .ym-userbar-btn')?.nextElementSibling?.getAttribute('aria-label'),
    }));
    assert.deepStrictEqual(r.pages, ['YapCord', 'Plugins', 'Themes', 'Layout', 'Backup & Restore']);
    assert.strictEqual(r.label, 'YapCord Settings');
    assert.ok(r.quick);
    assert.strictEqual(r.quickBeforeGear, 'Settings');
  });

  await test('Plugins page lists every plugin (sorted) and hides the React content', async () => {
    await page.evaluate(() => document.querySelector('.ym-nav-btn[data-ym-page=plugins]').click());
    await sleep(300);
    const r = await page.evaluate(() => ({
      cards: [...document.querySelectorAll('.ym-panel .ym-card-title b')].map((b) => b.textContent),
      reactHidden: getComputedStyle(document.querySelector('.settings-main > div:not(.ym-panel)')).display,
      active: document.querySelector('.ym-nav-btn.active')?.textContent,
      oldActive: getComputedStyle(document.querySelector('.settings-nav button[data-k=account]')).backgroundColor,
    }));
    for (const name of ['BetterFolders', 'MessageLogger', 'NoTrack', 'OnePingPerDM']) {
      assert.ok(r.cards.includes(name), name + ' missing from ' + r.cards);
    }
    assert.ok(!r.cards.includes('ReadAllNotificationsButton'), 'always-on features have no entry in the Plugins page');
    const total = await page.evaluate(() => window.YapperMod.plugins.list().filter((p) => !p.alwaysOn).length);
    assert.ok(total >= 33, 'expected at least 33 toggleable plugins, got ' + total);
    assert.strictEqual(r.cards.length, total, 'all plugins listed');
    assert.deepStrictEqual(r.cards, [...r.cards].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'alphabetical');
    assert.strictEqual(r.reactHidden, 'none');
    assert.strictEqual(r.active, 'Plugins');
    const authorLines = await page.evaluate(() => [...document.querySelectorAll('.ym-panel .ym-card')].filter((c) => /(^|\n)\s*by\s/i.test(c.innerText)).map((c) => c.querySelector('b').textContent));
    assert.deepStrictEqual(authorLines, [], 'plugin cards show only the description, no "by ..." line');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-plugins.png') });
  });

  await test('no "Restart required" notice until a plugin is switched on or off', async () => {
    const r = await page.evaluate(() => { const b = document.querySelector('.ym-panel .ym-restart'); return { exists: !!b, visible: !!b && getComputedStyle(b).display !== 'none' }; });
    assert.deepStrictEqual(r, { exists: true, visible: false });
  });

  await test('toggling a plugin switch saves the choice but does not start/stop it - that waits for a reload', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const wasRunning = YM.plugins.isRunning('OnePingPerDM');
      const card = [...document.querySelectorAll('.ym-card')].find((c) => c.querySelector('b').textContent === 'OnePingPerDM');
      const sw = card.querySelector('.switch');
      sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      const afterOff = { running: YM.plugins.isRunning('OnePingPerDM'), enabled: YM.plugins.isEnabled('OnePingPerDM'), saved: YM.settings.get('plugins.OnePingPerDM.enabled') };
      sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true }));
      const afterOn = { running: YM.plugins.isRunning('OnePingPerDM'), enabled: YM.plugins.isEnabled('OnePingPerDM'), saved: YM.settings.get('plugins.OnePingPerDM.enabled') };
      return { wasRunning, afterOff, afterOn };
    });
    assert.strictEqual(r.wasRunning, true, 'OnePingPerDM was enabled from the start (openSite initial settings)');
    assert.deepStrictEqual(r.afterOff, { running: true, enabled: false, saved: false }, 'still running - only the saved choice and what isEnabled() reports changed');
    assert.deepStrictEqual(r.afterOn, { running: true, enabled: true, saved: true }, 'flipping back never stopped it in between, so there is nothing to restart it into');
  });

  await test('switching a plugin shows the mandatory "Restart required" notice with a working Reload button (no app restart)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      let relaunched = 0;
      let reloaded = 0;
      YM.native.app.relaunch = async () => { relaunched++; };
      YM.native.app.reload = async () => { reloaded++; };
      const b = document.querySelector('.ym-panel .ym-restart');
      const shown = getComputedStyle(b).display !== 'none';
      const text = b.innerText.replace(/\s+/g, ' ').trim();
      b.querySelector('button').click();
      return { shown, text, relaunched, reloaded };
    });
    assert.strictEqual(r.shown, true);
    assert.strictEqual(r.text, 'Restart required Plugin changes take effect after you reload - nothing has changed yet (you stay logged in). Reload');
    assert.strictEqual(r.reloaded, 1);
    assert.strictEqual(r.relaunched, 0, 'the app itself is not restarted');
    const again = await page.evaluate(async () => {
      document.querySelector('.ym-nav-btn[data-ym-page=themes]').click();
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector('.ym-nav-btn[data-ym-page=plugins]').click();
      await new Promise((r) => setTimeout(r, 150));
      const b = document.querySelector('.ym-panel .ym-restart');
      return !!b && getComputedStyle(b).display !== 'none';
    });
    assert.strictEqual(again, true, 'the notice stays after leaving and re-opening the page');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-restart.png') });
  });

  await test('plugin options render and persist (select + boolean + custom)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const card = [...document.querySelectorAll('.ym-card')].find((c) => c.querySelector('b').textContent === 'MessageLogger');
      [...card.querySelectorAll('button')].find((b) => b.textContent === 'Options').click();
      await new Promise((r) => setTimeout(r, 100));
      const c2 = [...document.querySelectorAll('.ym-card')].find((c) => c.querySelector('b').textContent === 'MessageLogger');
      const select = c2.querySelector('select');
      select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true }));
      const rows = c2.querySelectorAll('.toggle-row').length;
      const custom = c2.querySelector('.ym-custom')?.textContent;
      return { style: YM.plugins.get('MessageLogger').settings.store.deleteStyle, rows, custom, cls: document.documentElement.className };
    });
    assert.strictEqual(r.style, 'overlay');
    assert.ok(r.rows >= 4);
    assert.ok(/deleted message/.test(r.custom));
    assert.ok(/ym-ml-overlay/.test(r.cls));
  });

  await test('search filters the list', async () => {
    await page.evaluate(() => { const i = document.querySelector('.ym-panel input[type=search]'); i.value = 'folder'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(100);
    const names = await page.evaluate(() => [...document.querySelectorAll('.ym-panel .ym-card-title b')].map((b) => b.textContent));
    assert.deepStrictEqual(names.slice().sort(), ['BetterFolders', 'PlainFolderIcon']);
  });

  await test('Themes page: apply a theme file on the Local Themes tab', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.native.themes.list = async () => [{ fileName: 'demo.theme.css', name: 'Demo', author: 'me', description: 'A demo theme', version: '1.0' }];
      YM.native.themes.read = async () => ':root{--ym-test:42} body{outline:0}';
      await YM.themes.refresh();
      document.querySelector('.ym-nav-btn[data-ym-page=themes]').click();
      await new Promise((r) => setTimeout(r, 200));
      const localTabOn = document.querySelector('.ym-subtab[data-sub=local]').classList.contains('on');
      const sw = document.querySelector('.ym-panel .ym-card .switch');
      sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const applied = getComputedStyle(document.documentElement).getPropertyValue('--ym-test').trim();
      YM.themes.setEnabled('demo.theme.css', false);
      return { localTabOn, applied, off: getComputedStyle(document.documentElement).getPropertyValue('--ym-test').trim() };
    });
    assert.deepStrictEqual(r, { localTabOn: true, applied: '42', off: '' });
  });

  await test('Themes page: Online Themes tab edits themeLinks through one textarea (one link per line)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      document.querySelector('.ym-subtab[data-sub=online]').click();
      await new Promise((r) => setTimeout(r, 100));
      const ta = document.querySelector('.ym-panel textarea');
      ta.value = 'https://example.com/t.css\njavascript:alert(1)\nhttps://example.com/u.css';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const saved = YM.settings.get('themeLinks', []);
      const link = !!document.querySelector('link[href="https://example.com/t.css"]');

      ta.value = 'https://example.com/t.css';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const afterRemove = YM.settings.get('themeLinks', []);
      const gone = !document.querySelector('link[href="https://example.com/u.css"]');
      YM.themes.removeLink('https://example.com/t.css');
      document.querySelector('.ym-subtab[data-sub=local]').click();
      return { saved, link, afterRemove, gone };
    });
    assert.deepStrictEqual(r.saved, ['https://example.com/t.css', 'https://example.com/u.css'], 'the javascript: line is silently skipped, the two http(s) ones are kept');
    assert.strictEqual(r.link, true);
    assert.deepStrictEqual(r.afterRemove, ['https://example.com/t.css']);
    assert.strictEqual(r.gone, true);
  });

  await test('Themes page: Preview shows a theme without switching it on; Share saves its file', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      window.__exported = null;
      YM.native.themes.export = async (fileName) => { window.__exported = fileName; return true; };
      const before = { css: getComputedStyle(document.documentElement).getPropertyValue('--ym-test').trim(), on: YM.themes.isEnabled('demo.theme.css') };
      const find = (label) => [...document.querySelectorAll('.ym-panel button')].find((b) => b.textContent === label);
      find('Preview').click();
      await new Promise((r) => setTimeout(r, 200));
      const during = { css: getComputedStyle(document.documentElement).getPropertyValue('--ym-test').trim(), on: YM.themes.isEnabled('demo.theme.css'), label: !!find('Stop preview') };
      find('Stop preview').click();
      await new Promise((r) => setTimeout(r, 150));
      const after = { css: getComputedStyle(document.documentElement).getPropertyValue('--ym-test').trim(), backToPreview: !!find('Preview') };
      find('Share...').click();
      await new Promise((r) => setTimeout(r, 100));
      return { before, during, after, exported: window.__exported };
    });
    assert.deepStrictEqual(r, {
      before: { css: '', on: false },
      during: { css: '42', on: false, label: true },
      after: { css: '', backToPreview: true },
      exported: 'demo.theme.css',
    });
  });

  await test('Custom CSS page (reached via the "Edit Custom CSS" quick action, not a nav tab) saves and applies live', async () => {
    const r = await page.evaluate(async () => {
      window.YapperMod.settingsUi.open('quickcss');
      await new Promise((r) => setTimeout(r, 300));
      const ta = document.querySelector('.ym-panel textarea');
      ta.value = ':root{--ym-quick:7}'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 800));
      const v = getComputedStyle(document.documentElement).getPropertyValue('--ym-quick').trim();
      const last = document.head.lastElementChild.id;
      const sw = document.querySelector('.ym-panel .switch'); sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      return { v, last, off: getComputedStyle(document.documentElement).getPropertyValue('--ym-quick').trim() };
    });
    assert.strictEqual(r.v, '7');
    assert.strictEqual(r.last, 'ym-quickcss');
    assert.strictEqual(r.off, '');
  });

  await test('YapCord page: file dialog and "close the Yapper app" switches and the program name are saved', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      await YM.settingsUi.open('main');
      await new Promise((res) => setTimeout(res, 150));
      const panel = document.querySelector('.ym-panel');
      const rows = [...panel.querySelectorAll('.toggle-row')];
      const row = (t) => rows.find((x) => x.querySelector('.toggle-label').textContent === t);
      const file = row("Use YapCord's file dialog");
      const close = row('Close the Yapper app');
      const out = { hasRows: !!file && !!close, fileOn: file.querySelector('input').checked, closeOn: close.querySelector('input').checked };
      file.querySelector('input').checked = false; file.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
      close.querySelector('input').checked = false; close.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
      const name = [...panel.querySelectorAll('.ym-opt')].find((x) => /Program name/.test(x.textContent)).querySelector('input');
      out.nameShown = name.value;
      name.value = ' Yapper.exe , Yapper Beta.exe ,'; name.dispatchEvent(new Event('change', { bubbles: true }));
      out.saved = { file: YM.settings.get('window.ownFilePicker'), close: YM.settings.get('window.closeYapperApp'), names: YM.settings.get('window.yapperAppNames') };
      name.value = ''; name.dispatchEvent(new Event('change', { bubbles: true }));
      out.empty = YM.settings.get('window.yapperAppNames');
      YM.settings.set('window.ownFilePicker', true); YM.settings.set('window.closeYapperApp', true);
      return out;
    });
    assert.deepStrictEqual(r, { hasRows: true, fileOn: true, closeOn: true, nameShown: 'Yapper.exe', saved: { file: false, close: false, names: ['Yapper.exe', 'Yapper Beta.exe'] }, empty: ['Yapper.exe'] });
  });

  await test('number options: empty goes back to the default, values are clamped to min/max', async () => {
    await page.evaluate(() => document.querySelector('.ym-nav-btn[data-ym-page=plugins]').click());
    await sleep(200);
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const card = [...document.querySelectorAll('.ym-card')].find((c) => c.querySelector('b').textContent === 'UploadCompressor');
      [...card.querySelectorAll('button')].find((b) => /Options|Hide options/.test(b.textContent)).click();
      const field = () => {
        const c = [...document.querySelectorAll('.ym-card')].find((x) => x.querySelector('b').textContent === 'UploadCompressor');
        return c.querySelector('input[type=number]');
      };
      const set = (v) => { const f = field(); f.value = v; f.dispatchEvent(new Event('change', { bubbles: true })); return { stored: YM.settings.get('plugins.UploadCompressor.limitMB'), shown: field().value }; };
      const out = { big: set('500'), zero: set('0'), good: set('25'), empty: set(''), junk: set('abc') };
      return out;
    });
    assert.deepStrictEqual(r.big, { stored: 100, shown: '100' });
    assert.deepStrictEqual(r.zero, { stored: 1, shown: '1' });
    assert.deepStrictEqual(r.good, { stored: 25, shown: '25' });
    assert.deepStrictEqual(r.empty, { stored: 10, shown: '10' });
  });

  await test('there is no About & Diagnostics page any more, but window.YapperMod.diagnostics() still works', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const hasAboutBtn = !!document.querySelector('.ym-nav-btn[data-ym-page=about]');
      const d = await YM.diagnostics();
      return { hasAboutBtn, storeReady: d.hooks.storeReady, pluginsCount: d.plugins.length, hasSettingsNav: d.dom['.settings-nav'] === 1 };
    });
    assert.strictEqual(r.hasAboutBtn, false);
    assert.strictEqual(r.storeReady, true);
    assert.ok(r.pluginsCount >= 33);
    assert.strictEqual(r.hasSettingsNav, true);
  });

  await test('picking one of Yapper\'s own tabs hands the panel back', async () => {
    await page.evaluate(() => document.querySelector('.settings-nav button[data-k=profile]').click());
    await sleep(100);
    const r = await page.evaluate(() => ({ panel: !!document.querySelector('.ym-panel'), active: document.querySelector('.settings').classList.contains('ym-active'), react: getComputedStyle(document.querySelector('.settings-main > div')).display }));
    assert.deepStrictEqual(r, { panel: false, active: false, react: 'block' });
  });

  await test('the quick button opens the YapCord page', async () => {
    await page.evaluate(() => document.querySelector('.ym-userbar-btn').click());
    await sleep(400);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-nav-btn.active')?.textContent), 'YapCord');
  });

  await test('backup page renders and export falls back gracefully outside the app', async () => {
    await page.evaluate(() => document.querySelector('.ym-nav-btn[data-ym-page=backup]').click());
    await sleep(200);
    assert.ok(await page.evaluate(() => /Backup/.test(document.querySelector('.ym-panel h2').textContent)));
  });

  await test('inside the official Yapper app: the YapCord page only shows what applies there (no tray, autostart, rival guard or own file dialog; there is no proxy-detection switch to show - it just stays on)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.official = true;
      try {
        await YM.settingsUi.open('main');
        await new Promise((res) => setTimeout(res, 150));
        const panel = document.querySelector('.ym-panel');
        const labels = [...panel.querySelectorAll('.toggle-label')].map((x) => x.textContent);
        return { labels, text: panel.textContent };
      } finally {
        YM.official = false;
      }
    });
    assert.deepStrictEqual(r.labels, ['Enable Custom CSS'], 'nothing that only exists in the stand-alone app (tray, autostart, rival guard, own file dialog) - and no proxy-detection switch any more, in either mode');
    assert.ok(/inside the official Yapper app/.test(r.text) && /Install-in-Yapper\.bat/.test(r.text));
  });

  await test('YM.official comes from the app info the main process puts in the bundle (and is false in the stand-alone app)', async () => {
    assert.strictEqual(await page.evaluate(() => window.YapperMod.official), false);
    await page.evaluate(() => { window.__opened = 0; const o = window.YapperMod.openSettings; window.YapperMod.openSettings = () => { window.__opened++; }; window.__restoreOpen = () => { window.YapperMod.openSettings = o; }; });
    await page.keyboard.press('Control+,');
    assert.strictEqual(await page.evaluate(() => { const n = window.__opened; window.__restoreOpen(); return n; }), 0, 'no shortcut handler in the stand-alone app');
    const official = await openSite({ initial: { settings: {}, app: { mode: 'official', version: '1.0.0' } } });
    try {
      await official.page.goto('https://www.yapper.website/', { waitUntil: 'load' });
      await official.page.waitForFunction(() => window.YapperMod && window.YapperMod.Store, null, { timeout: 15000 });
      assert.strictEqual(await official.page.evaluate(() => window.YapperMod.official), true);

      await official.page.evaluate(() => { window.__opened = 0; window.YapperMod.openSettings = () => { window.__opened++; }; });
      await official.page.keyboard.press('Control+,');
      await official.page.keyboard.press('Control+Shift+,');
      await official.page.keyboard.press(',');
      assert.strictEqual(await official.page.evaluate(() => window.__opened), 1);
    } finally {
      await official.close();
    }
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
  if (errs.length) console.log('console errors from YapperMod:', errs.slice(0, 8));
  await site.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
