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
    window.__calls = [];
    window.__toasts = [];
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.includes('sendMessage')) {
        return { sendMessage: (channelId, text) => { window.__calls.push({ channelId, text }); return Promise.resolve(); } };
      }
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };
    YM.Store.setState({
      userId: 'me',
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' }, u2: { id: 'u2', username: 'sam', display_name: 'Sammy' } },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: {
        c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' },
        c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'random' },
      },
      activeServerId: 's1',
      activeChannelId: 'c1',
      messages: { c1: [], c2: [] },
    });
    const app = document.createElement('div');
    app.id = 'fx-enc';
    app.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:720px;z-index:10;display:flex;background:#1a1b20;color:#fff';
    app.innerHTML = `<aside class="sidebar" style="width:200px">
        <div class="channel-row" data-nav-chan="c1" style="position:relative"><button class="channel-main">general</button></div>
        <div class="channel-row" data-nav-chan="c2" style="position:relative"><button class="channel-main">random</button></div>
        <div id="menuhost"></div>
      </aside>
      <main class="main" style="flex:1;position:relative">
        <div id="msglist"></div>
        <div class="composer"><div class="composer-box"><textarea maxlength="2000"></textarea><button class="send-btn" aria-label="Send">Send</button></div></div>
      </main>`;
    document.body.append(app);

    document.querySelector('textarea').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      const v = e.target.value;
      if (!v.trim()) return;
      window.__calls.push({ channelId: YM.Store.getState().activeChannelId, text: v });
      e.target.value = '';
    });
  });
  await sleep(100);

  const typeAndEnter = async (text) => {
    await page.evaluate(() => { window.__calls.length = 0; });
    await page.click('textarea');
    await page.fill('textarea', text);
    await page.keyboard.press('Enter');
    await sleep(80);
  };
  const lastCall = () => page.evaluate(() => window.__calls.at(-1));
  const taValue = () => page.evaluate(() => document.querySelector('textarea').value);

  await test('no key set on this chat: a normal message is sent exactly as typed, completely untouched', async () => {
    await typeAndEnter('hello there');
    assert.deepStrictEqual(await lastCall(), { channelId: 'c1', text: 'hello there' });
    assert.strictEqual(await taValue(), '');
  });

  await test('"Set shared key..." shows up on a chat with none, saving it from the modal', async () => {
    await page.click('[data-nav-chan="c1"]', { button: 'right' });
    await page.evaluate(() => {
      const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl';
      o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Mute</span></button></div>';
      document.getElementById('menuhost').append(o);
    });
    await sleep(250);
    const label = await page.evaluate(() => document.querySelector('.ctx-menu .ym-enc-item')?.textContent);
    assert.strictEqual(label, 'Set shared key...');
    await page.evaluate(() => document.querySelector('.ym-enc-item').click());
    await sleep(150);
    await page.fill('.ym-modal input', 'tangerine-giraffe-42');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Save').click());
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.keyFor('c1')), 'tangerine-giraffe-42');
    await page.evaluate(() => document.getElementById('ovl')?.remove());
  });

  await test('with a key set, sending scrambles the text - sendMessage never sees the real words', async () => {
    await typeAndEnter('meet at the old pier at midnight');
    const call = await lastCall();
    assert.strictEqual(call.channelId, 'c1');
    assert.ok(call.text.startsWith('\u{1F512}ENC1:'), 'wrapped with the marker prefix');
    assert.ok(!call.text.includes('midnight'), 'the real words never reach sendMessage in the clear');
    assert.strictEqual(await taValue(), '', 'the box is still cleared, same as a normal send');
    const decrypted = await page.evaluate((content) => window.YapperMod.plugins.get('MessageEncryption').api.decryptText('c1', content), call.text);
    assert.deepStrictEqual(decrypted, { status: 'ok', text: 'meet at the old pier at midnight' });
  });

  await test('a message starting with "/" is still sent exactly as typed, even in a chat with a key - commands keep working', async () => {

    await typeAndEnter('/notarealcommand but still starts with a slash');
    assert.deepStrictEqual(await lastCall(), { channelId: 'c1', text: '/notarealcommand but still starts with a slash' });
  });

  await test('the other chat has no key of its own: switching to it sends its messages in the clear', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c2' }));
    await typeAndEnter('nothing secret here');
    assert.deepStrictEqual(await lastCall(), { channelId: 'c2', text: 'nothing secret here' });
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c1' }));
  });

  await test('an incoming encrypted message is shown decrypted, with the raw scrambled text hidden - and your own sent copy reads the same way', async () => {
    const encrypted = await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.encryptText('c1', 'tangerine-giraffe-42', 'see you there'));
    await page.evaluate((content) => {
      const YM = window.YapperMod;
      document.getElementById('msglist').innerHTML = '<div class="msg" data-message-id="e1"><div class="msg-body"><div class="msg-head"><button class="msg-author">Sammy</button></div><div class="msg-text"></div></div></div>';
      YM.Store.setState({ messages: { ...YM.Store.getState().messages, c1: [{ id: 'e1', channel_id: 'c1', author_id: 'u2', content, created_at: '2026-10-21T09:00:00Z' }] } });
    }, encrypted);
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id="e1"] .msg-text')).display), 'none', 'the raw scrambled text itself is hidden');
    assert.strictEqual(await page.evaluate(() => document.querySelector('[data-message-id="e1"] .ym-enc-text').textContent), '\u{1F512} see you there');
  });

  await test('the same encrypted message in a chat with no key shows an honest "add the key" notice, never garbage', async () => {
    const encrypted = await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.encryptText('c2', 'some-other-key', 'top secret plan'));
    await page.evaluate((content) => {
      const YM = window.YapperMod;
      document.getElementById('msglist').innerHTML = '<div class="msg" data-message-id="e2"><div class="msg-body"><div class="msg-head"><button class="msg-author">Sammy</button></div><div class="msg-text"></div></div></div>';
      YM.Store.setState({ messages: { ...YM.Store.getState().messages, c2: [{ id: 'e2', channel_id: 'c2', author_id: 'u2', content, created_at: '2026-10-21T09:00:00Z' }] } });
    }, encrypted);
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('[data-message-id="e2"] .ym-enc-text').textContent), "\u{1F512} Encrypted message — add this chat's shared key to read it (right-click it).");
  });

  await test('a wrong key on an otherwise-real encrypted message shows an honest "could not decrypt" notice, never garbage or a thrown error', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.setKeyFor('c2', 'definitely-the-wrong-key'));
    await page.evaluate(() => window.YapperMod.messages.refresh());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('[data-message-id="e2"] .ym-enc-text').textContent), '\u{1F512} Encrypted message — could not decrypt (wrong shared key?).');
    await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.setKeyFor('c2', ''));
  });

  await test('removing the key (from the options manager) stops scrambling new messages - a clean opt-out', async () => {
    const rows = await page.evaluate(() => {
      const b = document.createElement('div'); b.id = 'encbox'; document.body.append(b);
      const p = window.YapperMod.plugins.get('MessageEncryption');
      p.options.manage.render(b, p);
      return [...b.querySelectorAll('.ym-csi-name')].map((n) => n.textContent);
    });
    assert.deepStrictEqual(rows, ['#general in Test Server']);
    await page.evaluate(() => { [...document.querySelectorAll('#encbox .ym-btn-ghost')].find((b) => b.textContent === 'Remove').click(); document.getElementById('encbox').remove(); });
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('MessageEncryption').api.keyFor('c1')), null);
    await typeAndEnter('back to normal');
    assert.deepStrictEqual(await lastCall(), { channelId: 'c1', text: 'back to normal' });
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('MessageEncryption');
      YM.plugins.setEnabled('MessageEncryption', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('MessageEncryption'), err: YM.plugins.errors.get('MessageEncryption') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
