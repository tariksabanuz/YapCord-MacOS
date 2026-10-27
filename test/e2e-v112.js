'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {

  const site = await openSite({
    initial: { settings: { plugins: {} } },
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    permissions: ['microphone', 'camera'],
  });
  const { page } = site;

  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  const setOpt = (n, k, v) => page.evaluate(([a, b, c]) => window.YapperMod.plugins.get(a).settings.set(b, c), [n, k, v]);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__toasts = [];
    window.__reactCalls = [];
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.includes('toggleReaction') && names.includes('sendMessage')) return { toggleReaction: (id, emoji) => { window.__reactCalls.push([id, emoji]); return Promise.resolve(); }, sendMessage: () => Promise.resolve() };
      if (names.length === 1 && names.includes('jumpToMessage')) return { jumpToMessage: (id) => { window.__jumpCalls = (window.__jumpCalls || []); window.__jumpCalls.push(id); } };
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };
    const now = Date.now();
    YM.Store.setState({
      userId: 'me', isAdmin: false, isMod: false,
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' }, u2: { id: 'u2', username: 'sam', display_name: 'Sammy' } },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' } },
      activeServerId: 's1', activeChannelId: 'c1',
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello there friend', created_at: new Date(now - 90000).toISOString() },
        { id: 'm2', channel_id: 'c1', author_id: 'me', content: 'remember to check this', created_at: new Date(now - 60000).toISOString() },
      ] },
    });
    const row = (id, name, authorId, text) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="msg-time">9:00</span></div><div class="msg-text">${text}</div><div class="reactions" id="reactions-${id}"></div></div></div>`;
    const app = document.createElement('div');
    app.id = 'fx112';
    app.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:760px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<div id="menuhost"></div>
      <main class="main" style="flex:1;position:relative">
        <div id="msgs" style="width:560px">${row('m1', 'Sammy', 'u2', 'hello there friend')}${row('m2', 'Tarik', 'me', 'remember to check this')}</div>
        <div class="composer" style="width:560px"><div class="composer-box"><textarea style="width:300px"></textarea>
          <div class="composer-tools">
            <button class="icon-btn" aria-label="GIF" title="GIF">GIF</button>
            <div class="emoji-picker above" style="display:none;position:static;top:auto;left:auto;transform:none"><div class="emoji-picker-top"><input class="input" placeholder="Find the perfect emoji"></div></div>
          </div>
          <button class="send-btn" aria-label="Send" disabled>Send</button>
        </div></div>
      </main>`;
    document.body.append(app);
    const ta = app.querySelector('.composer textarea');
    const sendBtn = app.querySelector('.send-btn[aria-label="Send"]');
    ta.addEventListener('input', () => { sendBtn.disabled = !ta.value.trim(); });
  });
  await sleep(150);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
  const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const row = (id) => `.msg[data-message-id="${id}"]`;
  const openCtxMenu = () => page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl'; o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Reply</span></button></div>'; document.getElementById('menuhost').append(o); });
  const closeCtxMenu = () => page.evaluate(() => { const o = document.getElementById('ovl'); if (o) o.remove(); });

  console.log('MessageFX');
  await test('a reaction popping in on its own animates, a bulk appearance of several does not', async () => {
    await enable('MessageFX', { speed: 120 });
    await sleep(100);
    await page.evaluate(() => { const d = document.createElement('span'); d.className = 'reaction-wrap'; d.id = 'rw1'; document.getElementById('reactions-m1').append(d); });
    await sleep(60);
    assert.ok(await page.evaluate(() => document.getElementById('rw1').classList.contains('ym-mfx-in')));
    await page.evaluate(() => { for (const i of [2, 3, 4]) { const d = document.createElement('span'); d.className = 'reaction-wrap'; d.id = 'rw' + i; document.getElementById('reactions-m1').append(d); } });
    await sleep(60);
    assert.strictEqual(await count('.reaction-wrap.ym-mfx-in'), 1, 'only the solo one from before is still animating, the bulk group skipped it');
    await sleep(250);
    assert.strictEqual(await count('.reaction-wrap.ym-mfx-in'), 0, 'the class is removed again');
    await page.evaluate(() => document.getElementById('reactions-m1').replaceChildren());
  });
  await test('the send button flourishes on a click or an accepted Enter, not when it is disabled', async () => {
    await page.fill('.composer textarea', 'hi');
    await sleep(60);
    await page.click('.send-btn[aria-label="Send"]');
    await sleep(40);
    assert.ok(await page.evaluate(() => document.querySelector('.send-btn').classList.contains('ym-mfx-send')));
    await sleep(250);
    assert.ok(!(await page.evaluate(() => document.querySelector('.send-btn').classList.contains('ym-mfx-send'))));
    await page.evaluate(() => { document.querySelector('.send-btn').disabled = true; document.querySelector('.composer textarea').value = ''; });
    await page.focus('.composer textarea');
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.ok(!(await page.evaluate(() => document.querySelector('.send-btn').classList.contains('ym-mfx-send'))), 'disabled send button - nothing to flourish');
    await disable('MessageFX');
    assert.strictEqual(await count('.ym-mfx-in,.ym-mfx-send'), 0);
  });

  console.log('MessageReminders');
  await test('the rules: needs a message, a future time, no more than 30 days', async () => {
    await enable('MessageReminders');
    const r = await page.evaluate(() => {
      const a = window.YapperMod.plugins.get('MessageReminders').api; const now = Date.now();
      const v = (o) => { const x = a.validate({ channelId: 'c1', messageId: 'm1', snippet: 'hi', at: now + 60000, ...o }); return x.ok ? 'ok' : x.error; };
      return [v({}), v({ channelId: '' }), v({ at: now - 1000 }), v({ at: now + 31 * 86400000 }), v({ at: NaN })];
    });
    assert.deepStrictEqual(r, ['ok', 'No message to remind you about.', 'Pick a time in the future.', 'You can set a reminder up to 30 days ahead.', 'Pick a date and time.']);
  });
  await test('right-click menu: "Remind me..." opens the editor and saves it', async () => {
    await page.click(row('m2'), { button: 'right' });
    await openCtxMenu();
    await sleep(200);
    const label = await text('.ym-rem-menu');
    assert.ok(label.includes('Remind me'), label);
    await page.evaluate(() => document.querySelector('.ym-rem-menu').click());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p')?.textContent), '"remember to check this"');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'In 10 minutes').click());
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Set reminder').click());
    await sleep(150);
    const stored = await page.evaluate(() => window.YapperMod.settings.get('pluginData.MessageReminders', []));
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].messageId, 'm2');
    assert.strictEqual(stored[0].snippet, 'remember to check this');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'the dialog closed');
    await closeCtxMenu();
  });
  await test('the list in the options shows it and Cancel takes it away', async () => {
    const rows = await page.evaluate(() => { const b = document.createElement('div'); b.id = 'rembox'; document.body.append(b); const p = window.YapperMod.plugins.get('MessageReminders'); p.options.manage.render(b, p); return b.textContent; });
    assert.ok(rows.includes('remember to check this') && rows.includes('#general in Test Server'), rows);
    await page.evaluate(() => [...document.querySelectorAll('#rembox button')].find((b) => b.textContent === 'Cancel').click());
    await sleep(100);
    assert.strictEqual((await page.evaluate(() => window.YapperMod.settings.get('pluginData.MessageReminders', []))).length, 0);
    await page.evaluate(() => document.getElementById('rembox').remove());
  });
  await test('on time it flashes the message (already on that chat) and toasts', async () => {
    await page.evaluate(() => { const now = Date.now(); window.YapperMod.settings.set('pluginData.MessageReminders', [{ id: 'r1', channelId: 'c1', messageId: 'm2', snippet: 'remember to check this', at: now - 2000, created: now - 60000 }]); });
    await page.waitForFunction(() => window.__toasts.some((t) => t[0].includes('remember to check this')), null, { timeout: 9000 });
    assert.strictEqual(await page.evaluate(() => window.YapperMod.settings.get('pluginData.MessageReminders', []).length), 0, 'it was taken off the list once fired');
    assert.ok((await page.evaluate(() => window.__toasts)).some((t) => t[0].includes('remember to check this')));
    assert.ok(await page.evaluate(() => document.querySelector('.msg[data-message-id="m2"]').classList.contains('ym-rem-flash')));
    await disable('MessageReminders');
    assert.strictEqual(await count('.ym-rem-menu'), 0);
  });

  console.log('DoubleTapReact');
  await test('double-clicking a message\'s text reacts with your chosen emoji', async () => {
    await enable('DoubleTapReact', { emoji: '🔥' });
    await sleep(100);
    await page.dblclick(row('m1') + ' .msg-text');
    await sleep(80);
    const calls = await page.evaluate(() => window.__reactCalls);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], ['m1', '🔥']);
    await disable('DoubleTapReact');
  });
  await test('firstEmoji falls back to the heart when the option has no emoji in it', async () => {
    const r = await page.evaluate(() => { const a = window.YapperMod.plugins.get('DoubleTapReact').api; return [a.firstEmoji('🎉 party'), a.firstEmoji('plain text'), a.firstEmoji('')]; });
    assert.deepStrictEqual(r, ['🎉', '❤️', '❤️']);
  });

  console.log('VoiceChanger');
  await test('wrap() turns a raw mic stream into one processed audio track', async () => {
    const r = await page.evaluate(async () => {
      const raw = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rawId = raw.getAudioTracks()[0].id;
      const out = window.YapperMod.plugins.get('VoiceChanger').api.wrap(raw, 45);
      const r = { audioTracks: out.getAudioTracks().length, videoTracks: out.getVideoTracks().length, differentTrack: out.getAudioTracks()[0].id !== rawId };
      out.getTracks().forEach((t) => t.stop());
      return r;
    });
    assert.deepStrictEqual(r, { audioTracks: 1, videoTracks: 0, differentTrack: true });
  });
  await test('enabling it patches getUserMedia for audio requests; disabling restores the raw mic', async () => {
    const baseline = await page.evaluate(async () => { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const label = s.getAudioTracks()[0].label; s.getTracks().forEach((t) => t.stop()); return label; });
    await enable('VoiceChanger', { freq: 45 });
    await sleep(100);
    const patched = await page.evaluate(async () => {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = s.getAudioTracks()[0].label;
      const n = window.YapperMod.plugins.get('VoiceChanger').api.sessionCount();
      s.getTracks().forEach((t) => t.stop());
      return { label, n };
    });
    assert.notStrictEqual(patched.label, baseline, 'the returned track is no longer the raw device track');
    assert.ok(patched.n >= 1);
    await disable('VoiceChanger');
    await sleep(100);
    const restored = await page.evaluate(async () => { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const label = s.getAudioTracks()[0].label; s.getTracks().forEach((t) => t.stop()); return label; });
    assert.strictEqual(restored, baseline, 'back to the raw device once disabled');
  });
  await test('a video-only request is left alone', async () => {
    await enable('VoiceChanger');
    await sleep(100);
    const kinds = await page.evaluate(async () => { const s = await navigator.mediaDevices.getUserMedia({ video: true }); const k = s.getTracks().map((t) => t.kind); s.getTracks().forEach((t) => t.stop()); return k; });
    assert.deepStrictEqual(kinds, ['video']);
    await disable('VoiceChanger');
  });

  await test('all four new plugins are registered and run without errors; MessageFX and DoubleTapReact are always on, the other two are off by default and stop cleanly', async () => {
    const names = ['MessageFX', 'MessageReminders', 'DoubleTapReact', 'VoiceChanger'];
    const r = await page.evaluate((names) => names.map((n) => {
      const YM = window.YapperMod; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      const stillRunning = YM.plugins.isRunning(n);
      const stopsAsExpected = p.alwaysOn ? stillRunning : !stillRunning;
      return { n, ok: !!p && ran && !err && stopsAsExpected && (p.alwaysOn || !p.enabledByDefault), err: err && String(err.message || err) };
    }), names);
    assert.deepStrictEqual(r.filter((x) => !x.ok), []);
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
