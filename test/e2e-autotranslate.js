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
    window.__translateCalls = [];
    window.__flagState = { translate: true };
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.includes('V') && names.includes('q') && names.includes('A') && names.includes('e')) {
        return { V: () => {}, e: (c) => c, A: () => undefined, q: (id, text) => { window.__translateCalls.push([id, text]); return Promise.resolve(); } };
      }
      if (names.includes('flagOn') && names.includes('isFlagOn')) {
        return { flagOn: (state, flag) => !!window.__flagState[flag], isFlagOn: (flag) => !!window.__flagState[flag] };
      }
      return real(names);
    };
    YM.Store.setState({
      userId: 'me',
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: {
        c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' },
        dm1: { id: 'dm1', kind: 'dm', name: null },
      },
      messages: {
        c1: [
          { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'bonjour', created_at: new Date().toISOString() },
        ],
        dm1: [
          { id: 'd1', channel_id: 'dm1', author_id: 'u2', content: 'hola', created_at: new Date().toISOString() },
        ],
      },
    });
  });
  await sleep(150);
  const calls = () => page.evaluate(() => window.__translateCalls);
  const clearCalls = () => page.evaluate(() => { window.__translateCalls = []; });
  const addMessage = (channelId, msg) => page.evaluate(([ch, m]) => {
    const YM = window.YapperMod;
    const st = YM.Store.getState();
    YM.Store.setState({ messages: { ...st.messages, [ch]: [...(st.messages[ch] || []), m] } });
  }, [channelId, msg]);

  console.log('AutoTranslate');

  await test('off by default: a brand new message is never translated', async () => {
    await addMessage('c1', { id: 'm2', channel_id: 'c1', author_id: 'u2', content: 'guten tag' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('turning it on does not retroactively translate the scrollback already loaded for a channel', async () => {
    await enable('AutoTranslate');
    await sleep(100);
    assert.deepStrictEqual(await calls(), [], 'm1 and m2 were already there before AutoTranslate turned on - neither gets translated just from enabling');
  });

  await test('a genuinely new message from someone else, in a server with the translate flag on, gets translated', async () => {
    await clearCalls();
    await addMessage('c1', { id: 'm3', channel_id: 'c1', author_id: 'u2', content: 'wie geht es dir' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), [['m3', 'wie geht es dir']]);
  });

  await test('the same message never gets translated twice, even if the store updates again', async () => {
    await clearCalls();
    await page.evaluate(() => { const st = window.YapperMod.Store.getState(); window.YapperMod.Store.setState({ messages: { ...st.messages } }); });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('your own new message is left alone', async () => {
    await clearCalls();
    await addMessage('c1', { id: 'm4', channel_id: 'c1', author_id: 'me', content: 'ich bin hier' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('a pending (not-yet-sent) message is left alone', async () => {
    await clearCalls();
    await addMessage('c1', { id: 'm5', channel_id: 'c1', author_id: 'u2', content: 'ciao', pending: true });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('a message with no letters (just an emoji/link) is left alone', async () => {
    await clearCalls();
    await addMessage('c1', { id: 'm6', channel_id: 'c1', author_id: 'u2', content: '123 :) 👍' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('a DM has no server, so nothing there is ever translated', async () => {
    await clearCalls();
    await addMessage('dm1', { id: 'd2', channel_id: 'dm1', author_id: 'u2', content: 'como estas' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  await test('a server where the admin has not turned the translate flag on is respected, not bypassed', async () => {
    await clearCalls();
    await page.evaluate(() => { window.__flagState.translate = false; });
    await addMessage('c1', { id: 'm7', channel_id: 'c1', author_id: 'u2', content: 'buenos dias' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
    await page.evaluate(() => { window.__flagState.translate = true; });
  });

  await test('switching it off stops new messages from being translated', async () => {
    await clearCalls();
    await disable('AutoTranslate');
    await sleep(60);
    await addMessage('c1', { id: 'm8', channel_id: 'c1', author_id: 'u2', content: 'guten abend' });
    await sleep(80);
    assert.deepStrictEqual(await calls(), []);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
