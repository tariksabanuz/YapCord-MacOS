'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       ')); }
}

(async () => {
  const wsGot = [];
  const posts = [];
  const site = await openSite({
    initial: { settings: { plugins: {} } },
    extra: (page) => page.routeWebSocket(/api\.yapper\.website\/realtime/, (ws) => { ws.onMessage((m) => wsGot.push(String(m))); }),
  });
  const { page } = site;
  await page.route('**/rest/v1/messages**', (route) => {
    const r = route.request();
    if (r.method() === 'POST' || r.method() === 'PATCH') posts.push(JSON.parse(r.postData()));
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, true), name);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);

  await page.evaluate(() => {
    const YM = window.YapperMod;
    YM.Store.setState({
      userId: 'me',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy', pronouns: 'they/them' },
        u3: { id: 'u3', username: 'kim', display_name: 'kim' },
      },
      channels: { c1: { id: 'c1', kind: 'dm', server_id: null } },
      activeChannelId: 'c1',
      messages: { c1: [
        { id: 'a1', channel_id: 'c1', author_id: 'u2', content: 'hi <@me>', created_at: '2026-10-18T09:01:00Z' },
        { id: 'a2', channel_id: 'c1', author_id: 'me', content: 'mine', created_at: '2026-10-18T09:02:00Z' },
        { id: 'a3', channel_id: 'c1', author_id: 'u3', content: 'pic', created_at: '2026-10-18T09:03:00Z' },
      ] },
    });
    const main = document.createElement('main');
    main.className = 'main';
    main.style.cssText = 'position:fixed;left:0;top:0;width:640px;z-index:99998;background:#222329;padding:10px';
    const row = (id, author, name, extra = '') => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="msg-time">9:0</span></div><div class="msg-text">text ${id}${extra}</div></div><div class="msg-actions"><button class="icon-btn" aria-label="Reply">r</button></div></div>`;
    main.innerHTML = row('a1', 'u2', 'Sammy', ' <span class="md-spoiler">s1</span> <span class="md-spoiler">s2</span>') + row('a2', 'me', 'Tarik') + row('a3', 'u3', 'kim').replace('<div class="msg-text">', '<div class="msg-image"><img alt="" width="40" height="40"></div><div class="msg-text">')
      + '<div class="msg blocked-msg" data-message-id="b1"><span>Blocked message</span><button>Show</button></div>'
      + '<div class="typing-line on"><span class="typing-dots"><i></i><i></i><i></i></span></div>'
      + '<div class="composer" style="height:60px"><div class="composer-box"><textarea maxlength="2000" style="width:400px"></textarea></div></div>';
    main.querySelectorAll('.md-spoiler').forEach((s) => s.addEventListener('click', () => s.classList.add('open')));
    document.body.append(main);
  });

  console.log('privacy / sending');
  await test('SilentTyping drops only typing frames', async () => {
    await enable('SilentTyping');
    await page.evaluate(async () => {
      const ws = new WebSocket('wss://api.yapper.website/realtime');
      await new Promise((r) => (ws.onopen = r));
      ws.send(JSON.stringify({ type: 'typing', channel: 'c1' }));
      ws.send(JSON.stringify({ type: 'typing', channel: 'c1', to: 'u2' }));
      ws.send(JSON.stringify({ type: 'subscribe', topics: ['all'] }));
      ws.send(JSON.stringify({ type: 'message', text: 'about "typing" in text' }));
    });
    await sleep(300);
    assert.deepStrictEqual(wsGot.map((m) => JSON.parse(m).type), ['subscribe', 'message']);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('SilentTyping').api.dropped()), 2);
    await disable('SilentTyping');
  });

  const send = (content, method = 'POST') => page.evaluate(([c, m]) => fetch('https://api.yapper.website/rest/v1/messages', { method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'c1', content: c }) }), [content, method]);

  await test('ClearURLs strips tracking parameters, keeps real ones and punctuation', async () => {
    await enable('ClearURLs');
    posts.length = 0;
    await send('see https://youtu.be/abc?si=XYZ&t=10, and (https://example.com/p?utm_source=a&id=5). Also https://x.com/y?fbclid=zz! Plain https://example.com/a?b=1');
    assert.strictEqual(posts[0].content, 'see https://youtu.be/abc?t=10, and (https://example.com/p?id=5). Also https://x.com/y! Plain https://example.com/a?b=1');
    await disable('ClearURLs');
    posts.length = 0;
    await send('https://example.com/?utm_source=a');
    assert.strictEqual(posts[0].content, 'https://example.com/?utm_source=a');
  });

  await test('TextReplace applies plain and regex rules, skips invalid regex, also on edits', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('TextReplace').settings.set('rules', [
      { find: ':shrug:', replace: '¯\\_(ツ)_/¯', regex: false },
      { find: '\\bteh\\b', replace: 'the', regex: true },
      { find: '([', replace: 'x', regex: true },
    ]));
    await enable('TextReplace');
    posts.length = 0;
    await send('teh cat :shrug: teh');
    await send('teh edit', 'PATCH');
    assert.strictEqual(posts[0].content, 'the cat ¯\\_(ツ)_/¯ the');
    assert.strictEqual(posts[1].content, 'the edit');
    await disable('TextReplace');
  });

  console.log('appearance');
  await test('NoBlockedMessages hides the placeholder', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('.msg.blocked-msg')).display);
    await enable('NoBlockedMessages');
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.msg.blocked-msg')).display);
    assert.notStrictEqual(before, 'none');
    assert.strictEqual(after, 'none');
  });
  await test('NoTypingAnimation stops the dots', async () => {
    await enable('NoTypingAnimation');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.typing-dots i')).animationName), 'none');
  });
  await test('ShowMeYourName + UserMessagesPronouns decorate the header (and only when useful)', async () => {
    await enable('ShowMeYourName');
    await enable('UserMessagesPronouns');
    await sleep(300);
    const r = await page.evaluate(() => ({
      sam: [...document.querySelectorAll('[data-message-id=a1] .msg-head > *')].map((e) => e.className + ':' + e.textContent),
      kim: document.querySelectorAll('[data-message-id=a3] .ym-sm-name,[data-message-id=a3] .ym-pronouns').length,
    }));
    assert.deepStrictEqual(r.sam, ['msg-author:Sammy', 'ym-sm-name:@sam', 'ym-pronouns:they/them', 'msg-time:9:0']);
    assert.strictEqual(r.kim, 0);
    await disable('ShowMeYourName');
    await disable('UserMessagesPronouns');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sm-name,.ym-pronouns').length), 0);
  });
  await test('CharacterCounter shows and colours the count', async () => {
    await enable('CharacterCounter');
    const r = await page.evaluate(async () => {
      const ta = document.querySelector('.composer textarea');
      const out = {};
      const set = async (n) => { ta.value = 'x'.repeat(n); ta.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 50)); const c = document.querySelector('.ym-cc'); return [c.hidden, c.textContent, c.dataset.level]; };
      out.short = await set(100);
      out.half = await set(1100);
      out.high = await set(1850);
      out.over = await set(2100);
      ta.value = ''; await new Promise((r) => setTimeout(r, 450));
      out.cleared = document.querySelector('.ym-cc').hidden;
      return out;
    });
    assert.deepStrictEqual(r, { short: [true, '100 / 2000', 'ok'], half: [false, '1100 / 2000', 'ok'], high: [false, '1850 / 2000', 'high'], over: [false, '2100 / 2000', 'over'], cleared: true });
  });

  console.log('chat tools');
  await test('RevealAllSpoilers opens every spoiler in the message on Ctrl+click', async () => {
    await enable('RevealAllSpoilers');
    await page.click('[data-message-id=a1] .md-spoiler >> nth=0', { modifiers: ['Control'] });
    const open = await page.evaluate(() => [...document.querySelectorAll('.md-spoiler')].map((s) => s.classList.contains('open')));
    assert.deepStrictEqual(open, [true, true]);
  });
  await test('HideMedia hides and restores a message\'s media', async () => {
    await enable('HideMedia');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-message-id=a3] .ym-hm-btn').length), 1);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-message-id=a1] .ym-hm-btn').length), 0);
    await page.evaluate(() => document.querySelector('[data-message-id=a3] .ym-hm-btn').click());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id=a3] .msg-image')).display), 'none');
    await page.evaluate(() => document.querySelector('[data-message-id=a3] .ym-hm-note .ym-link').click());
    await sleep(150);
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id=a3] .msg-image')).display), 'none');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-hm-note').length), 0);
  });
  await test('QuickMention adds @username to the box, not on my own messages', async () => {
    await enable('QuickMention');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-message-id=a2] .ym-qm-btn').length), 0);
    await page.evaluate(() => { const ta = document.querySelector('.composer textarea'); ta.value = 'hey'; document.querySelector('[data-message-id=a1] .ym-qm-btn').click(); });
    const v = await page.evaluate(() => document.querySelector('.composer textarea').value);
    assert.strictEqual(v, 'hey @sam ');
  });

  console.log('sound / system');
  await test('NotificationVolume: 0 mutes, 50 routes through a gain node, 100 leaves it alone', async () => {
    await enable('NotificationVolume');
    const r = await page.evaluate(() => {
      const YM = window.YapperMod;
      const ctx = new AudioContext();
      const msg = ctx.createBuffer(1, 441, 44100); YM.media.tagBuffer(msg, 'message');
      const gains = [];
      const origCreateGain = ctx.createGain.bind(ctx);
      ctx.createGain = () => { const g = origCreateGain(); gains.push(g); return g; };
      const play = () => { const s = ctx.createBufferSource(); s.buffer = msg; s.connect(ctx.destination); const b = YM.media.soundsBlocked; s.start(); return YM.media.soundsBlocked - b; };
      const st = YM.plugins.get('NotificationVolume').settings;
      const out = {};
      st.set('volume', 0); out.zeroBlocked = play();
      st.set('volume', 50); gains.length = 0; out.halfBlocked = play(); out.halfGain = gains.map((g) => g.gain.value);
      st.set('volume', 100); gains.length = 0; out.fullBlocked = play(); out.fullGains = gains.length;
      return out;
    });
    assert.deepStrictEqual(r, { zeroBlocked: 1, halfBlocked: 0, halfGain: [0.5], fullBlocked: 0, fullGains: 0 });
  });
  await test('NoSystemBadge sends 0 to the taskbar while on, and restores the count after', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod;
      const calls = [];
      YM.native.setBadge = (n) => { calls.push(n); };
      YM.media.setBadge(7);
      YM.plugins.setEnabled('NoSystemBadge', true);
      YM.media.setBadge(9);
      YM.plugins.setEnabled('NoSystemBadge', false);
      return calls;
    });
    assert.deepStrictEqual(r, [7, 0, 0, 9]);
  });
  await test('ConsoleShortcuts adds and removes the globals', async () => {
    await enable('ConsoleShortcuts');
    const on = await page.evaluate(() => ({ ym: window.ym === window.YapperMod, user: window.ymState().userId, find: typeof window.ymFind('useStore', 'setState').getState }));
    assert.deepStrictEqual(on, { ym: true, user: 'me', find: 'function' });
    await disable('ConsoleShortcuts');
    assert.strictEqual(await page.evaluate(() => typeof window.ym), 'undefined');
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
  if (errs.length) console.log('console errors from YapperMod:', errs.slice(0, 8));
  await site.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
