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
  await page.addInitScript(() => {
    window.__audios = [];
    const Native = window.Audio;
    window.Audio = function (src) { const a = new Native(src); a.play = () => { window.__audios.push({ src: String(src).slice(0, 20), loop: a.loop, volume: a.volume }); return Promise.resolve(); }; return a; };
    window.__starts = 0;
    const o = window.OscillatorNode && window.OscillatorNode.prototype.start;
    if (o) window.OscillatorNode.prototype.start = function (...a) { window.__starts++; return o.apply(this, a); };
  });
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
    YM.Store.setState({
      userId: 'me',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy' },
        u3: { id: 'u3', username: 'kim', display_name: 'Kim' },
      },
      servers: { s1: { id: 's1', name: 'Test Server' }, s2: { id: 's2', name: 'Other' } },
      friends: { u2: 'accepted' },
      channels: {
        c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' },
        c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'random' },
        c3: { id: 'c3', kind: 'text', server_id: 's2', name: 'chat' },
        d1: { id: 'd1', kind: 'dm', server_id: null, name: 'Sammy' },
      },
      activeServerId: 's1',
      activeChannelId: 'c1',
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'well fuck this', created_at: '2026-10-18T09:01:00Z' },
        { id: 'm2', channel_id: 'c1', author_id: 'u2', content: 'a classy pass of sh1t and F U C K', created_at: '2026-10-18T09:02:00Z' },
        { id: 'm3', channel_id: 'c1', author_id: 'u3', content: 'hello from kim', created_at: '2026-10-18T09:03:00Z' },
        { id: 'm4', channel_id: 'c1', author_id: 'me', content: 'my own fuck', created_at: '2026-10-18T09:04:00Z' },
      ], c2: [], c3: [], d1: [] },
      ringing: null, sounds: true, myStatus: 'online', muted: {}, mutedServers: {},
    });
    const row = (id, name, text) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button></div><div class="msg-text">${text}</div></div></div>`;
    const app = document.createElement('div');
    app.id = 'fx18';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:620px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<nav class="rail" style="width:80px">
        <div class="rail-wrap" style="position:relative"><button class="rail-item" aria-label="Direct messages" title="Direct messages" style="position:relative">DM</button></div>
        <div class="rail-wrap" style="position:relative"><button class="rail-item" id="rb1" title="Test Server" style="position:relative">TS</button></div>
        <div class="rail-wrap" style="position:relative"><button class="rail-item" id="rb2" title="Other" style="position:relative">OT</button></div></nav>
      <aside class="sidebar" style="width:200px"><div class="channel-row" data-nav-chan="c1" style="position:relative"><button class="channel-main">general</button></div><div class="channel-row" data-nav-chan="c2" style="position:relative"><button class="channel-main">random</button></div><button class="chat-row" data-nav-chan="d1" style="position:relative">Sammy</button><div id="menuhost"></div></aside>
      <main class="main" style="flex:1;position:relative"><div id="msgs" style="width:520px">${row('m1', 'Sammy', 'well fuck this')}${row('m2', 'Sammy', 'a classy pass of sh1t and F U C K')}${row('m3', 'Kim', 'hello from kim')}${row('m4', 'Tarik', 'my own fuck')}</div></main>`;
    document.body.append(app);
  });
  await sleep(150);
  const attr = (sel, a) => page.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
  const hl = (name) => page.evaluate((n) => CSS.highlights.has(n) ? CSS.highlights.get(n).size : -1, name);
  const root = (v) => page.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim(), v);

  console.log('WordFilter');
  await test('swear words and look-alikes are covered (blur), whole words only, and your own messages are left alone', async () => {
    await enable('WordFilter');
    await sleep(200);

    assert.strictEqual(await hl('ym-wf-blur'), 3);
    assert.strictEqual(await attr('[data-message-id="m1"]', 'data-ym-wf'), 'blur');
    assert.strictEqual(await attr('[data-message-id="m3"]', 'data-ym-wf'), null);
    assert.strictEqual(await attr('[data-message-id="m4"]', 'data-ym-wf'), null, 'mine');
    const api = await page.evaluate(() => { const a = window.YapperMod.plugins.get('WordFilter').api; const t = (re, x) => { re.lastIndex = 0; return re.test(x); }; const look = a.compile(['ass'], true); const plain = a.compile(['ass'], false); const dash = a.compile(['x-y', 'a.b(c'], true); return [t(look, 'class'), t(look, 'pass'), t(look, 'you ass'), t(look, 'a$$'), t(plain, 'a$$'), t(dash, 'a x-y b'), t(dash, 'a.b(c')]; });
    assert.deepStrictEqual(api, [false, false, true, true, false, true, true]);
  });
  await test('the text itself is never changed (Yapper keeps its own nodes)', async () => {
    assert.strictEqual(await page.evaluate(() => document.querySelector('[data-message-id="m1"] .msg-text').textContent), 'well fuck this');
  });
  await test('modes: bar, and collapsing the whole message; click shows it, click again hides it', async () => {
    await setOpt('WordFilter', 'mode', 'bar');
    await sleep(150);
    assert.strictEqual(await hl('ym-wf-bar'), 3);
    assert.strictEqual(await hl('ym-wf-blur'), 0);
    await setOpt('WordFilter', 'mode', 'hide');
    await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m1"]', 'data-ym-wf'), 'hide');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id="m1"] .msg-text')).display), 'none');
    await page.click('[data-message-id="m1"] .msg-head');
    await sleep(100);
    assert.strictEqual(await attr('[data-message-id="m1"]', 'data-ym-wf-open'), '1');
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id="m1"] .msg-text')).display), 'none');
    await page.click('[data-message-id="m1"] .msg-head');
    await sleep(100);
    assert.strictEqual(await attr('[data-message-id="m1"]', 'data-ym-wf-open'), null);
    await setOpt('WordFilter', 'mode', 'blur');
  });
  await test('your own words and muted users: a custom word is covered; a muted user is collapsed completely', async () => {
    await setOpt('WordFilter', 'words', 'kim, hello');
    await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m3"]', 'data-ym-wf'), 'blur');
    await setOpt('WordFilter', 'users', '@Kim');
    await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m3"]', 'data-ym-wf'), 'hide');
    await setOpt('WordFilter', 'words', ''); await setOpt('WordFilter', 'users', '');
    await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m3"]', 'data-ym-wf'), null);
  });
  await test('desktop notifications with a filtered word are silenced; clean ones pass', async () => {
    const r = await page.evaluate(() => { const before = window.YapperMod.media.notificationsBlocked; new Notification('Sammy', { body: 'what the shit' }); const mid = window.YapperMod.media.notificationsBlocked; new Notification('Sammy', { body: 'hello' }); return [mid - before, window.YapperMod.media.notificationsBlocked - mid]; });
    assert.deepStrictEqual(r, [1, 0]);
  });
  await test('switching it off removes every cover', async () => {
    await disable('WordFilter');
    assert.strictEqual(await hl('ym-wf-blur'), -1);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-wf]').length), 0);
  });

  console.log('ReplyPingDot');
  const dots = () => page.evaluate(() => [...document.querySelectorAll('.ym-rpd')].map((d) => (d.parentElement.getAttribute('data-nav-chan') || d.parentElement.id || d.parentElement.getAttribute('aria-label')) + ':' + d.getAttribute('data-why')).sort());
  const push = (channel, msg) => page.evaluate(([c, m]) => { const s = window.YapperMod.Store.getState(); window.YapperMod.Store.setState({ messages: { ...s.messages, [c]: [...(s.messages[c] || []), m] } }); }, [channel, msg]);
  await test('a reply to you, a ping and a DM each get a dot on the chat and on the server / Home; messages already there do not', async () => {
    await enable('ReplyPingDot');
    assert.deepStrictEqual(await dots(), []);
    await push('c2', { id: 'n1', channel_id: 'c2', author_id: 'u2', content: 'yes!', reply_to_id: 'm4', created_at: '2026-10-18T10:00:00Z' });
    await sleep(150);
    assert.deepStrictEqual(await dots(), ['c2:reply', 'rb1:reply']);
    await push('c3', { id: 'n2', channel_id: 'c3', author_id: 'u3', content: 'hey @tarik look', created_at: '2026-10-18T10:01:00Z' });
    await push('d1', { id: 'n3', channel_id: 'd1', author_id: 'u2', content: 'psst', created_at: '2026-10-18T10:02:00Z' });
    await sleep(150);
    assert.deepStrictEqual(await dots(), ['Direct messages:dm', 'c2:reply', 'd1:dm', 'rb1:reply', 'rb2:ping']);
  });
  await test('no dot for chatter that is not for you, for your own messages, or for muted chats', async () => {
    await push('c2', { id: 'n4', channel_id: 'c2', author_id: 'u3', content: 'just talking', created_at: '2026-10-18T10:03:00Z' });
    await push('c2', { id: 'n5', channel_id: 'c2', author_id: 'me', content: 'to @tarik myself', created_at: '2026-10-18T10:04:00Z' });
    await page.evaluate(() => window.YapperMod.Store.setState({ muted: { c3: true } }));
    await push('c3', { id: 'n6', channel_id: 'c3', author_id: 'u3', content: '@tarik again', reply_to_id: 'zz', created_at: '2026-10-18T10:05:00Z' });
    await sleep(150);
    assert.strictEqual((await dots()).length, 5, 'unchanged');
    const a = await page.evaluate(() => window.YapperMod.plugins.get('ReplyPingDot').api.reasonFor({ id: 'q', channel_id: 'c1', author_id: 'u2', content: 'hi @everyone' }, window.YapperMod.Store.getState(), { ping: true, everyone: false, dm: true }));
    assert.strictEqual(a, null, '@everyone only when asked');
  });
  await test('opening the chat takes its dot (and the server dot when no chat of that server is left)', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'd1', activeServerId: null }));
    await sleep(150);
    assert.deepStrictEqual(await dots(), ['c2:reply', 'rb1:reply', 'rb2:ping'], 'the DM dot and the Home dot are gone, the rest stays');
  });
  await test('switching it off removes the dots', async () => {
    await disable('ReplyPingDot');
    assert.deepStrictEqual(await dots(), []);
  });

  console.log('CustomRingtone');
  const ringing = (on) => page.evaluate((v) => window.YapperMod.Store.setState({ ringing: v ? { channelId: 'd1', from: 'u2' } : null }), on);
  await test('an incoming call plays your tune (repeating) and stops when the call ends or is picked up', async () => {
    await enable('CustomRingtone', { tune: 'marimba', volume: 60 });
    const s0 = await page.evaluate(() => window.__starts);
    await ringing(true);
    await sleep(300);
    const s1 = await page.evaluate(() => window.__starts);
    assert.ok(s1 - s0 >= 6, 'the marimba tune started notes: ' + (s1 - s0));
    await sleep(2100);
    const s2 = await page.evaluate(() => window.__starts);
    assert.ok(s2 - s1 >= 6, 'and repeats: ' + (s2 - s1));
    await ringing(false);
    await sleep(200);
    const s3 = await page.evaluate(() => window.__starts);
    await sleep(2300);
    assert.strictEqual(await page.evaluate(() => window.__starts), s3, 'nothing more after the call ended');
  });
  await test('Yapper\'s own ring sound is silenced during a call, other sounds are not', async () => {
    await ringing(true);
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const ac = new AudioContext();
      const mk = (name) => { const b = ac.createBuffer(1, 100, 8000); YM.media.tagBuffer(b, name); const n = ac.createBufferSource(); n.buffer = b; n.connect(ac.destination); return n; };
      const before = YM.media.soundsBlocked;
      mk('ring').start();
      const afterRing = YM.media.soundsBlocked;
      mk('message').start();
      return [afterRing - before, YM.media.soundsBlocked - afterRing];
    });
    assert.deepStrictEqual(r, [1, 0]);
    await ringing(false);
  });
  await test('Do not disturb and Yapper\'s sound switch are respected', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ myStatus: 'dnd' }));
    const s0 = await page.evaluate(() => window.__starts);
    await ringing(true); await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.__starts), s0);
    await ringing(false);
    await page.evaluate(() => window.YapperMod.Store.setState({ myStatus: 'online', sounds: false }));
    await ringing(true); await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.__starts), s0);
    await ringing(false);
    await page.evaluate(() => window.YapperMod.Store.setState({ sounds: true }));
  });
  await test('your own file: saved small, played on loop at your volume; too-large files are refused', async () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.from([16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0]), Buffer.from('data'), Buffer.from([0, 0, 0, 0])]);
    await page.evaluate(() => { const b = document.createElement('div'); b.id = 'rtbox'; document.body.append(b); const p = window.YapperMod.plugins.get('CustomRingtone'); p.options.file.render(b, p); });
    await page.setInputFiles('#rtbox input[type=file]', { name: 'ring.wav', mimeType: 'audio/wav', buffer: wav });
    await sleep(300);
    assert.ok(/^data:audio\/wav;base64,/.test(await page.evaluate(() => window.YapperMod.settings.get('pluginData.CustomRingtone', ''))));
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('CustomRingtone').settings.store.tune), 'file');
    await ringing(true); await sleep(250);
    const a = await page.evaluate(() => window.__audios);
    assert.strictEqual(a.length, 1);
    assert.strictEqual(a[0].loop, true);
    assert.ok(Math.abs(a[0].volume - 0.6) < 0.01);
    await ringing(false);
    await page.setInputFiles('#rtbox input[type=file]', { name: 'big.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(1_600_000) });
    await sleep(200);
    assert.ok((await page.evaluate(() => window.YapperMod.settings.get('pluginData.CustomRingtone', ''))).length < 200, 'the big file was not saved');
    await page.evaluate(() => document.getElementById('rtbox').remove());
    const diag = JSON.stringify(await page.evaluate(() => window.YapperMod.diagnostics()));
    assert.ok(!diag.includes('data:audio'), 'not in the diagnostics');
    await disable('CustomRingtone');
  });

  console.log('Look');
  await test('NameEffects: the chosen people get the effect, others do not; the effect can change; off removes it', async () => {
    await enable('NameEffects', { effect: 'rainbow', who: 'list', list: 'sam' });
    await sleep(200);
    assert.strictEqual(await attr('[data-message-id="m1"] .msg-author', 'data-ym-fx'), 'rainbow');
    assert.strictEqual(await attr('[data-message-id="m3"] .msg-author', 'data-ym-fx'), null);
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id="m1"] .msg-author')).animationName), 'none');
    await setOpt('NameEffects', 'who', 'friends'); await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m1"] .msg-author', 'data-ym-fx'), 'rainbow');
    await setOpt('NameEffects', 'who', 'me'); await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m1"] .msg-author', 'data-ym-fx'), null);
    assert.strictEqual(await attr('[data-message-id="m4"] .msg-author', 'data-ym-fx'), 'rainbow');
    await setOpt('NameEffects', 'effect', 'glow'); await sleep(150);
    assert.strictEqual(await attr('[data-message-id="m4"] .msg-author', 'data-ym-fx'), 'glow');
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id="m4"] .msg-author')).textShadow), 'none');

    await setOpt('NameEffects', 'who', 'list'); await setOpt('NameEffects', 'list', ''); await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-fx]').length), 0);
  });
  await test('SmoothTransitions: a single new message slides in, a bulk load does not, switching chats fades, menus ease in', async () => {
    await enable('SmoothTransitions');
    await page.evaluate(() => { window.__mk = (id) => { const d = document.createElement('div'); d.className = 'msg'; d.setAttribute('data-message-id', id); d.innerHTML = '<div class="msg-body"><div class="msg-text">x</div></div>'; document.getElementById('msgs').append(d); }; window.__mk('x1'); });
    await sleep(60);
    assert.ok(await page.evaluate(() => document.querySelector('[data-message-id="x1"]').classList.contains('ym-st-in')));
    await page.evaluate(() => { for (const i of [2, 3, 4, 5, 6]) window.__mk('x' + i); });
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-st-in').length), 1, 'only the first one is still animating');
    await sleep(400);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-st-in').length), 0, 'the class is removed again');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c2' }));
    await sleep(40);
    assert.ok(await page.evaluate(() => document.querySelector('main.main').classList.contains('ym-st-switch')));
    await page.evaluate(() => { const m = document.createElement('div'); m.className = 'ctx-menu'; m.id = 'cm'; document.body.append(m); });
    assert.ok(/ymStPop/.test(await page.evaluate(() => getComputedStyle(document.getElementById('cm')).animationName)), 'menus ease in');
    await page.evaluate(() => document.getElementById('cm').remove());
    await setOpt('SmoothTransitions', 'menus', false);
    await sleep(80);
    await page.evaluate(() => { const m = document.createElement('div'); m.className = 'ctx-menu'; m.id = 'cm'; document.body.append(m); });
    assert.ok(!/ymStPop/.test(await page.evaluate(() => getComputedStyle(document.getElementById('cm')).animationName)), 'menus option off');
    await page.evaluate(() => document.getElementById('cm').remove());
    await disable('SmoothTransitions');
    await page.evaluate(() => { document.querySelectorAll('[data-message-id^="x"]').forEach((n) => n.remove()); window.YapperMod.Store.setState({ activeChannelId: 'c1' }); });
  });
  await test('SmoothTransitions respects "reduce motion"', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enable('SmoothTransitions');
    await page.evaluate(() => { const m = document.createElement('div'); m.className = 'ctx-menu'; m.id = 'cm'; document.body.append(m); });
    assert.ok(!/ymStPop/.test(await page.evaluate(() => getComputedStyle(document.getElementById('cm')).animationName)), 'reduced motion');
    await page.evaluate(() => document.getElementById('cm').remove());
    await disable('SmoothTransitions');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  console.log('ServerAccent');
  await test('each server gets its own accent colour while you are in it; DMs and servers without one keep the normal colour', async () => {
    await enable('ServerAccent');
    await page.evaluate(() => { const a = window.YapperMod.plugins.get('ServerAccent').api; a.set('s1', '#22aa66'); a.set('s2', '#aa2266'); });
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#22aa66');
    assert.strictEqual(await root('--on-accent'), '#ffffff');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c3', activeServerId: 's2' }));
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#aa2266');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'd1', activeServerId: null }));
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#ff6b4a', 'DMs: the normal colour');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c1', activeServerId: 's1' }));
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#22aa66');
  });
  await test('it beats the global AccentColor inside a server only', async () => {
    await enable('AccentColor', { color: '#3b82f6' });
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#22aa66');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'd1', activeServerId: null }));
    await sleep(100);
    assert.strictEqual(await root('--accent'), '#3b82f6');
    await disable('AccentColor');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c1', activeServerId: 's1' }));
  });
  await test('"Server colour..." in the right-click menu of a server saves a colour; the list shows every server; suggestions are valid colours', async () => {
    await page.click('#rb2', { button: 'right' });
    await page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl'; o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Mute</span></button></div>'; document.getElementById('menuhost').append(o); });
    await sleep(250);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ctx-menu .ym-sa-item').length), 1);
    await page.evaluate(() => document.querySelector('.ym-sa-item').click());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Other');
    await page.evaluate(() => { const i = document.querySelector('.ym-modal input[type=color]'); i.value = '#336699'; });
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Save').click());
    await sleep(150);
    assert.strictEqual((await page.evaluate(() => window.YapperMod.settings.get('pluginData.ServerAccent', {}))).s2, '#336699');
    await page.evaluate(() => document.getElementById('ovl').remove());
    const rows = await page.evaluate(() => { const b = document.createElement('div'); b.id = 'sabox'; document.body.append(b); const p = window.YapperMod.plugins.get('ServerAccent'); p.options.manage.render(b, p); return [...b.querySelectorAll('.ym-csi-name')].map((n) => n.textContent); });
    assert.deepStrictEqual(rows, ['Other', 'Test Server']);
    await page.evaluate(() => document.getElementById('sabox').remove());
    const sug = await page.evaluate(() => ['a', 'srv-1', 'zzz', '123'].map((x) => window.YapperMod.plugins.get('ServerAccent').api.suggest(x)));
    for (const c of sug) assert.ok(/^#[0-9a-f]{6}$/.test(c), c);
  });
  await test('switching it off puts the normal colour back and keeps your choices', async () => {
    await disable('ServerAccent');
    assert.strictEqual(await root('--accent'), '#ff6b4a');
    assert.strictEqual((await page.evaluate(() => window.YapperMod.settings.get('pluginData.ServerAccent', {}))).s1, '#22aa66');
  });

  await test('all six are registered and run without errors; the four toggleable ones are off by default and stop cleanly, the two always-on ones cannot be stopped', async () => {
    const r = await page.evaluate(() => ['WordFilter', 'ReplyPingDot', 'CustomRingtone', 'NameEffects', 'SmoothTransitions', 'ServerAccent'].map((n) => {
      const YM = window.YapperMod; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      const stillRunning = YM.plugins.isRunning(n);
      const stopsAsExpected = p.alwaysOn ? stillRunning : !stillRunning;
      return { n, ok: !!p && ran && !err && stopsAsExpected && (p.alwaysOn || !p.enabledByDefault), err: err && String(err.message || err) };
    }));
    assert.deepStrictEqual(r.filter((x) => !x.ok), []);
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
