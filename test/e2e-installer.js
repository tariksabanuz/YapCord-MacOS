'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadPlaywright } = require('./lib/site');

const SHOTS = process.env.YM_SHOTS || '';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); } catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       ')); }
}

const FIXTURE = (opts) => `(() => {
  const state = ${JSON.stringify(opts)};
  window.__calls = [];
  let logCb = null;
  const install = (patched) => ({ dir: 'C:\\\\Users\\\\tarik\\\\AppData\\\\Local\\\\Programs\\\\yapper-desktop', patched, runtimePresent: patched, exe: 'C:\\\\Users\\\\tarik\\\\AppData\\\\Local\\\\Programs\\\\yapper-desktop\\\\Yapper.exe', running: false });
  let patched = !!state.patched;
  window.installer = {
    info: async () => ({ version: '1.14.0', repo: state.repo === undefined ? 'tariksabanuz/YapCord' : state.repo, payloadOk: state.payloadOk !== false, installs: state.none ? [] : [install(patched)] }),
    choose: async () => { window.__calls.push(['choose']); return state.pick || { canceled: true }; },
    run: async (action, dir) => {
      window.__calls.push(['run', action, dir]);
      if (logCb) { logCb('Found Yapper in ' + dir); logCb('Done: Yapper now starts with YapCord inside.'); }
      if (state.fail) return { ok: false, lines: [], error: state.fail, install: install(patched) };
      patched = action !== 'uninstall';
      return { ok: true, lines: [], install: install(patched) };
    },
    launch: async (dir) => { window.__calls.push(['launch', dir]); return state.launchFail ? { ok: false, error: state.launchFail } : { ok: true }; },
    openHome: async () => {},
    onLog: (fn) => { logCb = fn; return () => { logCb = null; }; },
  };
})();`;

(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.join(__dirname, '..', 'installer', 'index.html');
  const open = async (opts) => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 660 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(FIXTURE(opts));
    await page.goto(url);
    await page.waitForSelector('.install, .empty');
    return { page, ctx, errors };
  };
  const states = (page) => page.evaluate(() => Object.fromEntries(['install', 'repair', 'uninstall', 'launch', 'choose'].map((id) => [id, !document.getElementById(id).disabled])));
  const texts = (page) => page.evaluate(() => ({ result: document.getElementById('result').hidden ? '' : document.getElementById('result').textContent, log: document.getElementById('log').hidden ? '' : document.getElementById('log').textContent, kind: document.getElementById('result').className }));

  await test('shows the Yapper install, the four choices and the official-source notice', async () => {
    const { page, ctx, errors } = await open({});
    const r = await page.evaluate(() => ({
      title: document.querySelector('h1').textContent,
      buttons: [...document.querySelectorAll('.buttons button')].map((b) => b.textContent),
      name: document.querySelector('.install .name').textContent,
      path: document.querySelector('.install .path').title,
      checked: document.querySelector('.install input').checked,
      notice: document.getElementById('notice').textContent,
      foot: document.getElementById('foot').textContent,
    }));
    assert.deepStrictEqual(r.buttons, ['Install', 'Reinstall / Repair', 'Uninstall', 'Start Yapper']);
    assert.strictEqual(r.title, 'YapCord Installer');
    assert.strictEqual(r.name, 'Yapper (YapCord not installed)');
    assert.ok(/Programs.yapper-desktop$/.test(r.path) && r.checked);
    assert.ok(/github\.com\/tariksabanuz\/YapCord/.test(r.notice));
    assert.strictEqual(r.foot, 'YapCord 1.14.0');
    assert.deepStrictEqual(await states(page), { install: true, repair: false, uninstall: false, launch: true, choose: true });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'installer-start.png') });
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await test('Install: runs the install, shows the progress lines and the result, and switches the buttons', async () => {
    const { page, ctx } = await open({});
    await page.click('#install');
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    const t = await texts(page);
    assert.ok(/Done! You can just open Yapper now/.test(t.result) && /ok/.test(t.kind));
    assert.ok(/Found Yapper/.test(t.log) && /Done: Yapper now starts/.test(t.log));
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), [['run', 'install', 'C:\\Users\\tarik\\AppData\\Local\\Programs\\yapper-desktop']]);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.install .name').textContent), 'Yapper (YapCord installed)');
    assert.deepStrictEqual(await states(page), { install: false, repair: true, uninstall: true, launch: true, choose: true });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'installer-done.png') });
    await ctx.close();
  });

  await test('Reinstall / Uninstall work from the installed state', async () => {
    const { page, ctx } = await open({ patched: true });
    assert.deepStrictEqual(await states(page), { install: false, repair: true, uninstall: true, launch: true, choose: true });
    await page.click('#repair');
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    await page.click('#uninstall');
    await page.waitForFunction(() => /Yapper is back to how it was/.test(document.getElementById('result').textContent));
    assert.deepStrictEqual((await page.evaluate(() => window.__calls)).map((c) => c[1]), ['repair', 'uninstall']);
    assert.deepStrictEqual(await states(page), { install: true, repair: false, uninstall: false, launch: true, choose: true });
    await ctx.close();
  });

  await test('an error from the installer is shown in red and the buttons stay as they were', async () => {
    const { page, ctx } = await open({ fail: 'Yapper is still running (also check the system tray next to the clock). Quit it completely and try again.' });
    await page.click('#install');
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    const t = await texts(page);
    assert.ok(/Yapper is still running/.test(t.result) && /err/.test(t.kind));
    assert.deepStrictEqual(await states(page), { install: true, repair: false, uninstall: false, launch: true, choose: true });
    await ctx.close();
  });

  await test('Start Yapper asks the app to start Yapper (and reports a failure)', async () => {
    const a = await open({});
    await a.page.click('#launch');
    await a.page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.deepStrictEqual((await a.page.evaluate(() => window.__calls))[0], ['launch', 'C:\\Users\\tarik\\AppData\\Local\\Programs\\yapper-desktop']);
    assert.ok(/Starting Yapper/.test((await texts(a.page)).result));
    await a.ctx.close();
    const b = await open({ launchFail: 'Could not find the Yapper program.' });
    await b.page.click('#launch');
    await b.page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.ok(/Could not find/.test((await texts(b.page)).result) && /err/.test((await texts(b.page)).kind));
    await b.ctx.close();
  });

  await test('no Yapper found: says so, only "Choose another folder" works; picking a folder adds and selects it', async () => {
    const pick = { ok: true, install: { dir: 'D:\\Apps\\Yapper', patched: false, runtimePresent: false, exe: 'D:\\Apps\\Yapper\\Yapper.exe', running: false } };
    const { page, ctx } = await open({ none: true, pick });
    assert.ok(/Could not find the Yapper app/.test(await page.evaluate(() => document.querySelector('.empty').textContent)));
    assert.deepStrictEqual(await states(page), { install: false, repair: false, uninstall: false, launch: false, choose: true });
    await page.click('#choose');
    await page.waitForSelector('.install');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.install .path').title), 'D:\\Apps\\Yapper');
    assert.deepStrictEqual(await states(page), { install: true, repair: false, uninstall: false, launch: true, choose: true });
    await ctx.close();
  });

  await test('a wrong folder shows the reason; cancelling does nothing; missing files in the installer are reported', async () => {
    const wrong = await open({ none: true, pick: { ok: false, error: 'There is no resources\\app.asar in "D:\\x".' } });
    await wrong.page.click('#choose');
    await wrong.page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.ok(/no resources/.test((await texts(wrong.page)).result));
    await wrong.ctx.close();
    const cancel = await open({ none: true });
    await cancel.page.click('#choose');
    assert.strictEqual((await texts(cancel.page)).result, '');
    await cancel.ctx.close();
    const nopayload = await open({ payloadOk: false, repo: '' });
    await nopayload.page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.ok(/missing from this installer/.test((await texts(nopayload.page)).result));
    assert.ok(/Only download YapCord from its maker/.test(await nopayload.page.evaluate(() => document.getElementById('notice').textContent)));
    await nopayload.ctx.close();
  });

  await test('the page loads nothing from the network and allows no inline script (CSP)', async () => {
    const { page, ctx } = await open({});
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
    assert.ok(/default-src 'none'/.test(csp) && !/unsafe-inline|http/.test(csp));
    await ctx.close();
  });

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
