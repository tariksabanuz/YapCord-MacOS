'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stage } = require('../tools/build-extension');
const { openExtensionSite } = require('./lib/extension-site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       ')); }
}

(async () => {
  const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yapcord-ext-stage-'));
  stage(extDir);

  const site = await openExtensionSite({ extensionDir: extDir });

  await test('manifest.json is well-formed Manifest V3, Chromium-only, scoped to yapper.website and yapin.gg, no extra permissions', () => {
    const m = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(m.manifest_version, 3);
    assert.strictEqual(m.content_scripts.length, 1);
    const cs = m.content_scripts[0];
    assert.strictEqual(cs.world, 'MAIN');
    assert.strictEqual(cs.run_at, 'document_start');

    assert.deepStrictEqual(cs.matches, ['https://yapper.website/*', 'https://www.yapper.website/*', 'https://yapin.gg/*', 'https://www.yapin.gg/*']);
    assert.strictEqual(cs.js.length, 1);
    assert.ok(!('permissions' in m) || m.permissions.length === 0, 'no host/API permissions requested');
    assert.ok(!('background' in m), 'no background/service-worker needed - everything runs as a page content script');
  });

  await test('on a fresh load (no stored settings) the content script injects the full runtime with empty state', async () => {
    await site.page.goto('https://www.yapper.website/', { waitUntil: 'load', timeout: 15000 });
    await site.page.waitForFunction(() => window.YapperMod && window.YapperMod.Store && window.YapperMod.Store.isReady, null, { timeout: 15000 });
    const r = await site.page.evaluate(() => {
      const YM = window.YapperMod;
      return {
        sameObject: YM === window.YapCord,
        mode: YM.initial.app.mode,
        inApp: YM.inApp,
        initialSettings: YM.initial.settings,
        initialQuickCss: YM.initial.quickCss,
        pluginCount: YM.plugins.list().length,
        alwaysOnRunning: YM.plugins.list().filter((p) => p.alwaysOn).every((p) => YM.plugins.isRunning(p.name)),
      };
    });
    const { pluginCount, ...rest } = r;
    assert.deepStrictEqual(rest, { sameObject: true, mode: 'extension', inApp: false, initialSettings: {}, initialQuickCss: '', alwaysOnRunning: true });
    assert.ok(pluginCount >= 33, 'expected at least 33 plugins, got ' + pluginCount);
  });

  await test('no console errors from YapperMod itself during boot', () => {
    const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
    assert.deepStrictEqual(errs, []);
  });

  await site.page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="user-bar"><button class="icon-btn" aria-label="Settings" title="Settings">gear</button></div>
      <div class="overlay"><div class="modal"><div class="settings">
        <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" data-k="account">My Account</button></nav>
        <section class="settings-main"><div><h2>My Account</h2></div></section>
      </div></div></div>`;
    document.body.append(wrap);
  });
  await site.page.waitForTimeout(300);

  await test('App-only settings (tray, autostart, own file dialog, closing the Yapper app) are skipped with no leftover trace in the extension - no stand-in row on the Plugins page, and the YapCord page shows the short explanation instead of dead toggles', async () => {
    const r = await site.page.evaluate(async () => {
      const YM = window.YapperMod;
      await YM.settingsUi.open('plugins');
      await new Promise((res) => setTimeout(res, 200));
      const pluginsText = document.querySelector('.ym-panel').innerText;
      const cardNames = [...document.querySelectorAll('.ym-card-title b')].map((b) => b.textContent);
      await YM.settingsUi.open('main');
      await new Promise((res) => setTimeout(res, 200));
      const mainText = document.querySelector('.ym-panel').innerText;
      return {
        pages: [...document.querySelectorAll('.settings-nav .ym-nav-btn')].map((b) => b.textContent),
        inApp: YM.inApp,
        cardNames,
        hasHint: /only apply to the YapCord desktop app/.test(mainText),
        appOnlyLabelsOnPluginsPage: ['Close to tray', 'Start with Windows', "Use YapCord's file dialog", 'Close the Yapper app'].filter((l) => pluginsText.includes(l)),
        appOnlyLabelsOnMainPage: ['Close to tray', 'Start with Windows', "Use YapCord's file dialog", 'Close the Yapper app'].filter((l) => mainText.includes(l)),
      };
    });
    assert.ok(r.pages.includes('YapCord'), 'the YapCord page itself is shown everywhere, including the extension');
    assert.strictEqual(r.inApp, false, 'the extension has no Electron preload bridge');
    assert.strictEqual(r.hasHint, true, 'the YapCord page explains that window/tray/startup settings only apply to the desktop app');
    assert.deepStrictEqual(r.appOnlyLabelsOnPluginsPage, [], 'none of the App-only toggle labels leak onto the Plugins page');
    assert.deepStrictEqual(r.appOnlyLabelsOnMainPage, [], 'none of the App-only toggle labels leak onto the YapCord page outside the app');
    for (const name of ['FilePicker', 'Tray', 'Autostart', 'ScreenSharePicker']) assert.ok(!r.cardNames.includes(name), name + ' was never a plugin card to begin with, in the app or out of it');
  });

  await test('settings and Custom CSS saved through the UI persist in localStorage, in the format the fallback expects', async () => {
    const r = await site.page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.settings.set('plugins.NoTrack.enabled', true);
      await YM.themes.setQuickCss(':root{--ym-ext-test:9}');
      await new Promise((res) => setTimeout(res, 400));
      return {
        settingsRaw: localStorage.getItem('yappermod:fallback-settings'),
        quickCssRaw: localStorage.getItem('yappermod:quickcss'),
        appliedCss: getComputedStyle(document.documentElement).getPropertyValue('--ym-ext-test').trim(),
      };
    });
    assert.strictEqual(JSON.parse(r.settingsRaw).plugins.NoTrack.enabled, true);
    assert.strictEqual(r.quickCssRaw, ':root{--ym-ext-test:9}');
    assert.strictEqual(r.appliedCss, '9');
  });

  await test('those same settings are read back as the initial state on the next page load (no app, no background script - just localStorage, which is exactly what reloading the tab or reopening the browser gives you)', async () => {

    await site.page.goto('https://www.yapper.website/', { waitUntil: 'load', timeout: 15000 });
    await site.page.waitForFunction(() => window.YapperMod && window.YapperMod.Store && window.YapperMod.Store.isReady, null, { timeout: 15000 });
    const r = await site.page.evaluate(() => {
      const YM = window.YapperMod;
      return {
        initialNoTrack: YM.initial.settings.plugins && YM.initial.settings.plugins.NoTrack && YM.initial.settings.plugins.NoTrack.enabled,
        noTrackRunning: YM.plugins.isRunning('NoTrack'),
        appliedCss: getComputedStyle(document.documentElement).getPropertyValue('--ym-ext-test').trim(),
      };
    });
    assert.deepStrictEqual(r, { initialNoTrack: true, noTrackRunning: true, appliedCss: '9' });
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await site.close();
  fs.rmSync(extDir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
