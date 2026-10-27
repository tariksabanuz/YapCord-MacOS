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
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  const setOpt = (n, k, v) => page.evaluate(([a, b, c]) => window.YapperMod.plugins.get(a).settings.set(b, c), [n, k, v]);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__calls = [];
    window.__toasts = [];
    window.__reached = 0;
    window.__failDelete = false;
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.length === 2 && names.includes('deleteMessage') && names.includes('sendMessage')) {
        return {
          deleteMessage: (id) => { window.__calls.push(['delete', id]); return window.__failDelete ? Promise.reject(new Error("You can't delete that message")) : Promise.resolve(); },
          sendMessage: (c, t, f, r) => { window.__calls.push(['send', c, t, f, r]); return Promise.resolve(); },
        };
      }
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };
    YM.Store.setState({
      userId: 'me', isAdmin: false, isMod: false,
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy' },
        u3: { id: 'u3', username: 'kim', display_name: 'Kim' },
      },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' }, d1: { id: 'd1', kind: 'dm', server_id: null, name: 'Sammy' } },
      activeServerId: 's1', activeChannelId: 'c1',
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello', created_at: '2026-10-18T09:01:00Z' },
        { id: 'm2', channel_id: 'c1', author_id: 'me', content: 'my own message', created_at: '2026-10-18T09:02:00Z' },
        { id: 'm3', channel_id: 'c1', author_id: 'u3', content: 'from kim', created_at: '2026-10-18T09:03:00Z' },
      ], d1: [] },
      profileCard: null,
    });
    const row = (id, name) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="verified-badge">v</span><span class="plus-badge">PLUS</span><span class="ubadge">B</span><span class="stag">TAG</span><span class="msg-time">9:00</span></div><div class="msg-text">text ${id}</div></div><div class="msg-actions"><button class="icon-btn" aria-label="Reply">r</button><button class="icon-btn" aria-label="More" title="More"><svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/></svg></button></div></div>`;
    const app = document.createElement('div');
    app.id = 'fx19';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<main class="main" style="flex:1;position:relative">
      <div id="msgs" style="width:560px">${row('m1', 'Sammy')}${row('m2', 'Tarik')}${row('m3', 'Kim')}</div>
      <div class="composer" style="width:560px"><div class="composer-box"><textarea style="width:300px"></textarea><div class="composer-tools"><button class="icon-btn" aria-label="GIF">GIF</button></div></div></div>
      <div class="profile-card" id="pcard" style="display:none"><div class="pc2-head"><div class="profile-card-name">Kim</div><div class="pc2-badges"><span class="ubadge lg">Badge</span></div></div></div>
      <div id="menuhost"></div></main>`;
    document.body.append(app);
    document.getElementById('msgs').addEventListener('click', (e) => { if (e.target.closest('.icon-btn[aria-label="More"]')) window.__reached++; });
  });
  await sleep(150);
  const calls = () => page.evaluate(() => window.__calls.slice());
  const clearCalls = () => page.evaluate(() => { window.__calls.length = 0; window.__toasts.length = 0; window.__reached = 0; });
  const attr = (sel, a) => page.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
  const css = (sel, p) => page.evaluate(([s, x]) => getComputedStyle(document.querySelector(s))[x], [sel, p]);
  const clickMore = async (id, shift = true) => { await page.hover(`.msg[data-message-id="${id}"]`); await page.click(MORE(id), shift ? { modifiers: ['Shift'] } : {}); };
  const MORE = (id) => `.msg[data-message-id="${id}"] .msg-actions .icon-btn[aria-label="More"]`;

  console.log('NameStyle');
  const nameOf = (id) => `.msg[data-message-id="${id}"] .msg-author`;
  await test('colour, font and bold apply to the chosen person only; bad values are thrown away', async () => {
    await enable('NameStyle');
    await page.evaluate(() => window.YapperMod.plugins.get('NameStyle').api.set('u2', { c: '#ff0000', f: 'serif', b: true }));
    await sleep(150);
    assert.strictEqual(await css(nameOf('m1'), 'color'), 'rgb(255, 0, 0)');
    assert.ok(/Georgia/.test(await css(nameOf('m1'), 'fontFamily')));
    assert.strictEqual(await css(nameOf('m1'), 'fontWeight'), '800');
    assert.strictEqual(await attr(nameOf('m3'), 'data-ym-nsc'), null);
    const r = await page.evaluate(() => { const a = window.YapperMod.plugins.get('NameStyle').api; return [a.validEntry({ c: 'red' }), a.validEntry({ c: '#ff0000', f: 'x;color:red' }), a.validEntry({ f: 'mono', b: 1 }), a.validEntry(null), a.validEntry({ c: '#GGGGGG' })]; });
    assert.deepStrictEqual(r, [null, { c: '#ff0000' }, { f: 'mono' }, null, null]);
    const stored = await page.evaluate(() => { window.YapperMod.settings.set('pluginData.NameStyle', { u2: { c: '#00ff00', f: 'evil;}', b: true }, bad: 5, 'x y': { c: '#000000' } }); return window.YapperMod.plugins.get('NameStyle').api.read(); });
    assert.deepStrictEqual(stored, { u2: { c: '#00ff00', b: true } });
    await sleep(100);
    assert.strictEqual(await css(nameOf('m1'), 'color'), 'rgb(0, 255, 0)');
  });
  await test('a name effect keeps priority over the colour', async () => {
    await page.evaluate(() => document.querySelector('.msg[data-message-id="m1"] .msg-author').setAttribute('data-ym-fx', 'rainbow'));
    assert.notStrictEqual(await css(nameOf('m1'), 'color'), 'rgb(0, 255, 0)');
    await page.evaluate(() => document.querySelector('.msg[data-message-id="m1"] .msg-author').removeAttribute('data-ym-fx'));
  });
  await test('right-click menu: "Name style for Kim..." opens the editor and saves colour and font', async () => {
    await page.click('.msg[data-message-id="m3"]', { button: 'right' });
    await page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovl'; o.innerHTML = '<div class="ctx-menu" role="menu"><button><span>Reply</span></button></div>'; document.getElementById('menuhost').append(o); });
    await sleep(250);
    const label = await page.evaluate(() => { const b = document.querySelector('.ctx-menu .ym-ns-menu'); return b && b.textContent; });
    assert.strictEqual(label, 'Name style for Kim...');
    await page.evaluate(() => document.querySelector('.ym-ns-menu').click());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Kim');
    await page.evaluate(() => {
      const c = document.querySelector('.ym-modal input[type=color]'); c.value = '#3366ff'; c.dispatchEvent(new Event('input', { bubbles: true }));
      const f = document.querySelector('.ym-modal select'); f.value = 'mono'; f.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-ns-preview').style.color), 'rgb(51, 102, 255)');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Save').click());
    await sleep(150);
    assert.deepStrictEqual((await page.evaluate(() => window.YapperMod.plugins.get('NameStyle').api.read())).u3, { c: '#3366ff', f: 'mono' });
    assert.strictEqual(await css(nameOf('m3'), 'color'), 'rgb(51, 102, 255)');
    await page.evaluate(() => document.getElementById('ovl').remove());
  });
  await test('profile card button, the list in the options, and removing a style', async () => {
    await page.evaluate(() => { document.getElementById('pcard').style.display = 'block'; window.YapperMod.Store.setState({ profileCard: 'u3' }); });
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.profile-card .ym-ns-btn').length), 1);
    await page.evaluate(() => { document.querySelector('.ym-ns-btn').click(); });
    await sleep(150);
    assert.ok(await page.evaluate(() => !![...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Remove style')), 'knows Kim already has a style');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Close').click());
    const rows = await page.evaluate(() => { const b = document.createElement('div'); b.id = 'nsbox'; document.body.append(b); const p = window.YapperMod.plugins.get('NameStyle'); p.options.manage.render(b, p); return [...b.querySelectorAll('.ym-csi-name')].map((n) => n.textContent); });
    assert.deepStrictEqual(rows, ['Kim', 'Sammy']);
    await page.evaluate(() => [...document.querySelectorAll('#nsbox .ym-btn-ghost')][0].click());
    await sleep(150);
    assert.deepStrictEqual(await page.evaluate(() => [...document.querySelectorAll('#nsbox .ym-csi-name')].map((n) => n.textContent)), ['Sammy']);
    assert.strictEqual(await attr(nameOf('m3'), 'data-ym-nsc'), null);
    await page.evaluate(() => { document.getElementById('nsbox').remove(); document.getElementById('pcard').style.display = 'none'; window.YapperMod.Store.setState({ profileCard: null }); });
  });
  await test('switching it off removes every colour and font', async () => {
    await disable('NameStyle');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-nsc],[data-ym-nsf],[data-ym-nsb]').length), 0);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-ns-btn,.ym-ns-menu').length), 0);
    assert.notStrictEqual(await css(nameOf('m1'), 'color'), 'rgb(0, 255, 0)');
  });

  console.log('HideBadges');
  const shown = (sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).display !== 'none', sel);
  await test('profile badges beside names are hidden; verified, Plus and tags stay until you ask', async () => {
    assert.ok(await shown('.msg-head .ubadge'));
    await enable('HideBadges');
    await sleep(100);
    assert.ok(!(await shown('.msg-head .ubadge')));
    assert.ok(await shown('.msg-head .verified-badge'));
    assert.ok(await shown('.msg-head .plus-badge'));
    assert.ok(await shown('.msg-head .stag'));
    assert.ok(await shown('.profile-card .pc2-badges .ubadge'), 'the profile card keeps its badges');
  });
  await test('each extra switch hides its own label', async () => {
    await setOpt('HideBadges', 'verified', true); await setOpt('HideBadges', 'plus', true); await setOpt('HideBadges', 'tags', true);
    await sleep(100);
    for (const s of ['.msg-head .verified-badge', '.msg-head .plus-badge', '.msg-head .stag']) assert.ok(!(await shown(s)), s);
    await setOpt('HideBadges', 'badges', false);
    await sleep(100);
    assert.ok(await shown('.msg-head .ubadge'));
  });
  await test('the profile card badge row is tidied, and everything comes back when it is off', async () => {
    await page.evaluate(() => { document.getElementById('pcard').style.display = 'block'; });
    assert.strictEqual(await css('.pc2-badges .ubadge.lg', 'borderRadius'), '999px');
    await disable('HideBadges');
    await sleep(100);
    for (const s of ['.msg-head .ubadge', '.msg-head .verified-badge', '.msg-head .plus-badge', '.msg-head .stag']) assert.ok(await shown(s), s);
    assert.notStrictEqual(await css('.pc2-badges .ubadge.lg', 'borderRadius'), '999px');
    await page.evaluate(() => { document.getElementById('pcard').style.display = 'none'; });
  });

  console.log('ScheduleMessage');
  const items = () => page.evaluate(() => window.YapperMod.settings.get('pluginData.ScheduleMessage', []));
  await test('the rules: needs text, a future time, no more than 30 days, and a limit on how many', async () => {
    await enable('ScheduleMessage');
    const r = await page.evaluate(() => {
      const a = window.YapperMod.plugins.get('ScheduleMessage').api; const now = Date.now();
      const v = (o) => { const x = a.validate({ channelId: 'c1', text: 'hi', at: now + 60000, ...o }); return x.ok ? 'ok' : x.error; };
      return [v({}), v({ text: '  ' }), v({ at: now - 1000 }), v({ at: now + 31 * 86400000 }), v({ text: 'x'.repeat(4001) }), v({ channelId: '' }), v({ at: NaN })];
    });
    assert.deepStrictEqual(r, ['ok', 'Write a message first.', 'Pick a time in the future.', 'You can schedule up to 30 days ahead.', 'That message is too long (4000 characters at most).', 'Open a chat first.', 'Pick a date and time.']);
    const s = await page.evaluate(() => { const a = window.YapperMod.plugins.get('ScheduleMessage').api; const n = 1000000; return [a.split([{ at: n + 5 }, { at: n - 1000 }, { at: n - a.LATE_MS - 1 }].map((x, i) => ({ ...x, id: 'i' + i })), n)].map((x) => [x.waiting.length, x.due.length, x.missed.length]); });
    assert.deepStrictEqual(s, [[1, 1, 1]]);
  });
  await test('the clock button next to the message box opens the editor with what you typed, for the chat you are in', async () => {
    await page.fill('.composer textarea', 'see you at six');
    await page.click('.composer .ym-sm-btn');
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'It will be sent to #general in Test Server');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal textarea').value), 'see you at six');
  });
  await test('a time in the past is refused with a message; a good time is saved, the box is emptied, and nothing is sent yet', async () => {
    await clearCalls();
    await page.evaluate(() => { const i = document.querySelector('.ym-modal input[type=datetime-local]'); i.value = '2020-01-01T10:00'; });
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Schedule').click());
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-sm-err').textContent), 'Pick a time in the future.');
    assert.strictEqual((await items()).length, 0);
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'In 1 hour').click());
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Schedule').click());
    await sleep(150);
    const list = await items();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].text, 'see you at six');
    assert.strictEqual(list[0].channelId, 'c1');
    assert.ok(Math.abs(list[0].at - (Date.now() + 3600000)) < 120000);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.composer textarea').value), '');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'the dialog closed');
    assert.deepStrictEqual(await calls(), []);
    assert.ok((await page.evaluate(() => window.__toasts))[0][0].startsWith('Scheduled for'));
  });
  await test('the list in the options shows it and Cancel takes it away', async () => {
    const rows = await page.evaluate(() => { const b = document.createElement('div'); b.id = 'smbox'; document.body.append(b); const p = window.YapperMod.plugins.get('ScheduleMessage'); p.options.manage.render(b, p); return b.textContent; });
    assert.ok(rows.includes('see you at six') && rows.includes('#general in Test Server'), rows);
    await page.evaluate(() => [...document.querySelectorAll('#smbox button')].find((b) => b.textContent === 'Cancel').click());
    await sleep(100);
    assert.strictEqual((await items()).length, 0);
    assert.ok((await page.evaluate(() => document.getElementById('smbox').textContent)).includes('Nothing is scheduled'));
    await page.evaluate(() => document.getElementById('smbox').remove());
  });
  await test('on time it is sent once through Yapper and taken off the list; a chat you lost is reported; missed ones are asked about', async () => {
    await clearCalls();
    await page.evaluate(() => {
      const now = Date.now(); const mk = (id, channelId, text, at) => ({ id, channelId, text, at, created: now - 1000 });
      window.YapperMod.settings.set('pluginData.ScheduleMessage', [
        mk('a', 'c1', 'on time', now - 2000),
        mk('b', 'zzz', 'lost chat', now - 3000),
        mk('c', 'd1', 'missed one', now - 10 * 60 * 1000),
        mk('d', 'c1', 'later', now + 3600000),
      ]);
    });
    await page.waitForFunction(() => window.__calls.length >= 1, null, { timeout: 9000 });
    await sleep(300);
    assert.deepStrictEqual(await calls(), [['send', 'c1', 'on time', null, null]]);
    assert.ok((await page.evaluate(() => window.__toasts)).some((t) => t[1] === 'error' && /no longer see/.test(t[0])), 'lost chat reported');
    const modalText = await page.evaluate(() => { const m = document.querySelector('.ym-modal'); return m && m.textContent; });
    assert.ok(modalText && modalText.includes('Missed scheduled messages') && modalText.includes('missed one'), modalText);
    assert.deepStrictEqual((await items()).map((x) => x.id).sort(), ['c', 'd'], 'sent and lost ones are off the list, the missed one waits for your answer');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Send now').click());
    await sleep(200);
    assert.deepStrictEqual(await calls(), [['send', 'c1', 'on time', null, null], ['send', 'd1', 'missed one', null, null]]);
    assert.deepStrictEqual((await items()).map((x) => x.id), ['d']);
    await sleep(5600);
    assert.strictEqual((await calls()).length, 2, 'nothing is sent twice');
  });
  await test('"Throw away" removes a missed message without sending it', async () => {
    await clearCalls();
    await page.evaluate(() => { const now = Date.now(); window.YapperMod.settings.set('pluginData.ScheduleMessage', [{ id: 'm', channelId: 'c1', text: 'too late', at: now - 3600000, created: now - 7200000 }]); });
    await page.waitForFunction(() => document.querySelector('.ym-modal'), null, { timeout: 9000 });
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Throw away').click());
    await sleep(200);
    assert.deepStrictEqual(await calls(), []);
    assert.strictEqual((await items()).length, 0);
  });
  await test('what you scheduled is in Backup but not in the diagnostics; switching it off removes the button', async () => {
    await page.evaluate(() => { const now = Date.now(); window.YapperMod.settings.set('pluginData.ScheduleMessage', [{ id: 'k', channelId: 'c1', text: 'secret plan 12345', at: now + 3600000, created: now }]); });
    const diag = JSON.stringify(await page.evaluate(() => window.YapperMod.diagnostics()));
    assert.ok(!diag.includes('secret plan 12345'));
    await disable('ScheduleMessage');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sm-btn').length), 0);
    await page.evaluate(() => window.YapperMod.settings.set('pluginData.ScheduleMessage', []));
  });

  await test('all four are registered and run without errors; QuickDelete is always on (cannot be stopped), the other three are off by default and stop cleanly', async () => {
    const r = await page.evaluate(() => ['QuickDelete', 'NameStyle', 'HideBadges', 'ScheduleMessage'].map((n) => {
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
