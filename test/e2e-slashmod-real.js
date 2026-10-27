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

  console.log('SlashModeration (real build, real YM.finder - no mock)');

  await test('one findExports() call for all sixteen names at once - the old approach - never succeeds against the real build', async () => {

    const names = ['kickMember', 'banMember', 'unbanMember', 'timeoutMember', 'setNickname', 'loadBans', 'loadVoiceBans', 'hasPerm', 'voiceModPerms', 'voiceChannelOf', 'muteInVoice', 'unmuteInVoice', 'kickFromVoice', 'voiceBan', 'voiceUnban', 'isFlagOn'];
    const r = await page.evaluate((names) => window.YapperMod.finder.findExports(names), names);
    assert.strictEqual(r, null, 'no single real module exports all sixteen names - if this ever becomes non-null, Yapper itself changed, not just this test');
  });

  await test("SlashModeration finds Yapper's real moderation functions and reports itself ready", async () => {
    const ready = await page.evaluate(async () => {
      const plugin = window.YapperMod.plugins.get('SlashModeration');
      const t0 = Date.now();
      while (Date.now() - t0 < 5000) {
        if (plugin.api.ready()) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    });
    assert.strictEqual(ready, true, "plugin.api.ready() never became true - /kick etc. would still show \"Could not find Yapper's own moderation functions.\"");
  });

  await test('the four real functions groups it actually found really are callable functions, not placeholders', async () => {
    const r = await page.evaluate(() => {
      const names = ['kickMember', 'banMember', 'unbanMember', 'timeoutMember', 'setNickname', 'loadBans', 'loadVoiceBans', 'hasPerm', 'voiceModPerms', 'voiceChannelOf', 'muteInVoice', 'unmuteInVoice', 'kickFromVoice', 'voiceBan', 'voiceUnban', 'isFlagOn'];
      const textMods = window.YapperMod.finder.findExports(['kickMember', 'banMember', 'unbanMember', 'timeoutMember', 'setNickname', 'loadBans']);
      const voiceMods = window.YapperMod.finder.findExports(['loadVoiceBans', 'voiceModPerms', 'voiceChannelOf', 'muteInVoice', 'unmuteInVoice', 'kickFromVoice', 'voiceBan', 'voiceUnban']);
      const permMods = window.YapperMod.finder.findExports(['hasPerm']);
      const flagMods = window.YapperMod.finder.findExports(['isFlagOn']);
      const merged = { ...(textMods || {}), ...(voiceMods || {}), ...(permMods || {}), ...(flagMods || {}) };
      return names.map((n) => [n, typeof merged[n]]);
    });
    for (const [name, type] of r) assert.strictEqual(type, 'function', `${name} should be a real function, got ${type}`);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
