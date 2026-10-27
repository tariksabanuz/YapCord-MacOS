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
    window.__status = { myStatus: 'online', autoIdle: true };
    window.__pipCalls = 0;
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.length === 1 && names.includes('sendMessage')) return { sendMessage: (c, t) => { window.__calls.push(['send', c, t]); return Promise.resolve(); } };
      if (names.includes('setStatus') && names.includes('getState')) {
        return { setStatus: (s) => { window.__status.myStatus = s; window.__statusCalls = (window.__statusCalls || 0) + 1; }, getState: () => window.__status };
      }
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
    HTMLVideoElement.prototype.requestPictureInPicture = function () { window.__pipCalls++; return Promise.resolve({}); };
    const now = Date.now();
    YM.Store.setState({
      userId: 'me', isAdmin: false, isMod: false,
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' }, u2: { id: 'u2', username: 'sam', display_name: 'Sammy' } },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' }, c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'random' }, d1: { id: 'd1', kind: 'dm', server_id: null, name: 'Sammy' } },
      activeServerId: 's1', activeChannelId: 'c1', lastChannel: 'c2',
      unread: { c1: 1, c2: 2 },
      typing: { c2: { u2: true } },
      messages: {
        c1: [
          { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello', created_at: new Date(now - 90000).toISOString() },
          { id: 'm2', channel_id: 'c1', author_id: 'me', content: 'pinned plan', created_at: new Date(now - 60000).toISOString(), pinned_at: new Date(now - 30000).toISOString() },
          { id: 'm3', channel_id: 'c1', author_id: 'me', content: 'slow one', created_at: new Date(now - 10000).toISOString() },
        ],
        d1: [],
      },
    });
    const row = (id, name, authorId) => `<div class="msg" data-message-id="${id}" data-author="${authorId}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="msg-time">9:00</span></div><div class="msg-text">text ${id}</div></div></div>`;
    const app = document.createElement('div');
    app.id = 'fx111';
    app.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:760px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<aside class="sidebar" style="width:200px">
        <div class="user-bar" style="display:flex;gap:4px"><button class="icon-btn ym-userbar-btn" aria-label="YapCord">Y</button><button class="icon-btn" aria-label="Settings">S</button></div>
        <div class="channel-row unread" data-nav-chan="c1" style="position:relative"><button class="channel-main">general</button></div>
        <div class="chat-row unread" data-nav-chan="c2" style="position:relative"><button class="channel-main">random</button></div>
        <button class="chat-row" data-nav-chan="d1" style="position:relative">Sammy</button>
      </aside>
      <main class="main" style="flex:1;position:relative">
        <div id="msgs" style="width:560px">${row('m1', 'Sammy', 'u2')}${row('m2', 'Tarik', 'me')}${row('m3', 'Tarik', 'me')}</div>
        <div class="msg-image" style="width:200px;height:150px;display:block"><img id="zoomimg" src="https://example.test/pic.png" style="width:200px;height:150px;display:block"></div>
        <span class="msg-video-box" style="display:inline-block;width:200px;height:120px"><video class="msg-video" id="vid1"></video></span>
        <div class="profile-card"><span class="pc-role"><span class="pc-role-dot" style="background:#ff6b4a"></span>Admin</span></div>
        <div class="msg-body"><pre class="md-pre"><code>const x = 1;</code></pre><p id="aftercode">next line</p></div>
        <div class="composer" style="width:560px"><div class="composer-box"><textarea style="width:300px"></textarea><div class="composer-tools"><button class="icon-btn" aria-label="GIF">GIF</button></div></div></div>
      </main>`;
    document.body.append(app);
  });
  await sleep(150);
  const calls = () => page.evaluate(() => window.__calls.slice());
  const attr = (sel, a) => page.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
  const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const row = (id) => `.msg[data-message-id="${id}"]`;

  console.log('ChatExport');
  await test('exports the loaded messages of the open chat as a downloadable file', async () => {
    await enable('ChatExport');
    await sleep(100);
    assert.strictEqual(await count('.composer-tools .ym-chatexport-btn'), 1);
    const built = await page.evaluate(() => window.YapperMod.plugins.get('ChatExport').api.build('c1', 'md', true));
    assert.ok(built.text.includes('Sammy'));
    assert.ok(built.text.includes('pinned plan'));
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = function () { window.__lastDownload = { href: this.href, download: this.download }; }; });
    await page.click('.composer-tools .ym-chatexport-btn');
    await sleep(100);
    const dl = await page.evaluate(() => window.__lastDownload);
    assert.ok(/\.md$/.test(dl.download));
    const saved = await page.evaluate((href) => fetch(href).then((r) => r.text()), dl.href);
    assert.ok(saved.includes('slow one'));
  });
  await test('switching it off removes the button', async () => {
    await disable('ChatExport');
    assert.strictEqual(await count('.ym-chatexport-btn'), 0);
  });

  console.log('PinnedMessages');
  await test('lists the pinned message already loaded and jumps to it', async () => {
    await enable('PinnedMessages');
    await sleep(100);
    assert.strictEqual(await count('.composer-tools .ym-pinned-btn'), 1);
    await page.click('.composer-tools .ym-pinned-btn');
    await sleep(150);
    assert.strictEqual(await count('.ym-modal .ym-pm-item'), 1);
    assert.ok((await text('.ym-modal .ym-pm-item')).includes('pinned plan'));
    await page.evaluate(() => document.querySelector('.ym-modal .ym-pm-item button').click());
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'jumping closes the panel');
    assert.strictEqual(await attr(row('m2'), 'class').then((c) => (c || '').includes('ym-pm-flash')), true);
  });
  await test('switching it off removes the button', async () => {
    await disable('PinnedMessages');
    assert.strictEqual(await count('.ym-pinned-btn'), 0);
  });

  console.log('JumpToUnread');
  await test('jumps to about where the unread messages start in the open chat', async () => {
    await enable('JumpToUnread');
    await sleep(100);
    assert.strictEqual(await count('.composer-tools .ym-jtu-btn'), 1);
    await page.click('.composer-tools .ym-jtu-btn');
    await sleep(100);
    assert.strictEqual(await attr(row('m3'), 'class').then((c) => (c || '').includes('ym-jtu-flash')), true, 'unread:1 of 3 messages means the last one');
    await disable('JumpToUnread');
    assert.strictEqual(await count('.ym-jtu-btn'), 0);
  });

  console.log('DoNotDisturbSchedule');
  await test('parseHHMM and inWindow are correct, including the overnight case', async () => {
    const r = await page.evaluate(() => { const a = window.YapperMod.plugins.get('DoNotDisturbSchedule').api; return [a.parseHHMM('09:30'), a.parseHHMM('24:00'), a.parseHHMM('bad'), a.inWindow(600, 540, 1020), a.inWindow(100, 540, 1020), a.inWindow(1430, 1380, 60), a.inWindow(30, 1380, 60)]; });
    assert.deepStrictEqual(r, [570, null, null, true, false, true, true]);
  });
  await test('switches to DND while inside the window it is given, and back to Online once outside it', async () => {
    const [inStart, inEnd, outStart, outEnd] = await page.evaluate(() => {
      const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
      const fmt = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
      return [fmt(cur - 2), fmt(cur + 2), fmt(cur + 10), fmt(cur + 20)];
    });
    await page.evaluate(() => { window.__status.myStatus = 'online'; window.__statusCalls = 0; });
    await enable('DoNotDisturbSchedule', { enabled: true, start: inStart, end: inEnd });
    await sleep(5500);
    assert.strictEqual(await page.evaluate(() => window.__status.myStatus), 'dnd');
    await setOpt('DoNotDisturbSchedule', 'start', outStart);
    await setOpt('DoNotDisturbSchedule', 'end', outEnd);
    await sleep(5500);
    assert.strictEqual(await page.evaluate(() => window.__status.myStatus), 'online');
    await disable('DoNotDisturbSchedule');
  });
  await test('never touches a status you picked yourself (dnd already set by hand)', async () => {
    await page.evaluate(() => { window.__status.myStatus = 'dnd'; window.__statusCalls = 0; });
    const [inStart, inEnd] = await page.evaluate(() => { const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes(); const fmt = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }; return [fmt(cur - 2), fmt(cur + 2)]; });
    await enable('DoNotDisturbSchedule', { enabled: true, start: inStart, end: inEnd });
    await sleep(5500);
    assert.strictEqual(await page.evaluate(() => window.__statusCalls), 0, 'already dnd - nothing to do, and it does not try to "restore" it either');
    await disable('DoNotDisturbSchedule');
    await page.evaluate(() => { window.__status.myStatus = 'online'; });
  });

  console.log('NotificationSnooze');
  await test('a bell button pauses desktop pop-ups until you turn it back on', async () => {
    const before = await page.evaluate(() => typeof window.Notification);
    assert.strictEqual(before, 'function');
    await enable('NotificationSnooze', { minutes: 5 });
    await sleep(100);
    assert.strictEqual(await count('.user-bar .ym-ns-btn'), 1);
    await page.click('.user-bar .ym-ns-btn');
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('NotificationSnooze').api.isSnoozed()), true);
    const n = await page.evaluate(() => new window.Notification('hi').title);
    assert.strictEqual(n, 'hi', 'the stand-in Notification still works, it just does nothing visible');
    assert.strictEqual(await attr('.user-bar .ym-ns-btn', 'class').then((c) => c.includes('on')), true);
    await page.click('.user-bar .ym-ns-btn');
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('NotificationSnooze').api.isSnoozed()), false);
    await disable('NotificationSnooze');
    assert.strictEqual(await count('.ym-ns-btn'), 0);
  });

  console.log('CustomKeybinds');
  await test('each configured hotkey runs its own action, and an unset one does nothing', async () => {
    await enable('CustomKeybinds', { nextUnread: 'ctrl+j', lastChannel: 'ctrl+shift+j', focusComposer: 'alt+c' });
    await sleep(100);
    const clicked = await page.evaluate(() => { let n = 0; document.querySelector('.chat-row.unread[data-nav-chan="c2"]').addEventListener('click', () => n++); window.__nextUnreadClicks = () => n; return true; });
    assert.ok(clicked);
    await page.keyboard.press('Control+j');
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => window.__nextUnreadClicks()), 1);
    let lastClicked = 0;
    await page.evaluate(() => { document.querySelector('[data-nav-chan="c2"]').addEventListener('click', () => { window.__lastChClicks = (window.__lastChClicks || 0) + 1; }); });
    await page.keyboard.press('Control+Shift+j');
    await sleep(80);
    lastClicked = await page.evaluate(() => window.__lastChClicks || 0);
    assert.ok(lastClicked >= 1, 'swap-to-last-channel clicked the row for lastChannel (c2)');
    await page.keyboard.press('Alt+c');
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => document.activeElement === document.querySelector('.composer textarea')), true);
    await disable('CustomKeybinds');
  });

  console.log('CopyUserURLs');
  await test('right-click a username in chat to copy their user id', async () => {
    await enable('CopyUserURLs');
    await sleep(100);
    await page.click(row('m1') + ' .msg-author', { button: 'right' });
    await sleep(150);
    assert.strictEqual(await count('.ym-cu-menu .ctx-menu button'), 1);
    await page.evaluate(() => document.querySelector('.ym-cu-menu button').click());
    await sleep(80);
    const toasts = await page.evaluate(() => window.__toasts);
    assert.ok(toasts.some((t) => /User ID copied/.test(t[0])));
    await disable('CopyUserURLs');
  });

  console.log('ImageZoom');
  await test('hovering shows a lens that follows the cursor; scroll zooms, Shift+scroll resizes it', async () => {
    await enable('ImageZoom');
    await sleep(100);
    const box = await page.evaluate(() => { const r = document.getElementById('zoomimg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x, box.y);
    await sleep(80);
    assert.notStrictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.ym-iz-lens')).display), 'none');
    const before = await page.evaluate(() => document.querySelector('.ym-iz-lens').style.backgroundSize);
    await page.mouse.wheel(0, -100);
    await sleep(80);
    const after = await page.evaluate(() => document.querySelector('.ym-iz-lens').style.backgroundSize);
    assert.notStrictEqual(before, after, 'scrolling changed the zoom level');
    await page.mouse.move(0, 0);
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.ym-iz-lens')).display), 'none');
    await disable('ImageZoom');
  });

  console.log('PictureInPicture');
  await test('adds a picture-in-picture button over a video attachment', async () => {
    await enable('PictureInPicture');
    await sleep(100);
    assert.strictEqual(await count('.msg-video-box .ym-pip-btn'), 1);
    await page.evaluate(() => document.querySelector('.ym-pip-btn').click());
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => window.__pipCalls), 1);
    await disable('PictureInPicture');
    assert.strictEqual(await count('.ym-pip-btn'), 0);
  });

  console.log('CustomIdle');
  await test('puts you back Online if Yapper marked you Idle within your own, longer delay', async () => {
    await page.evaluate(() => { window.__status.myStatus = 'idle'; window.__statusCalls = 0; });
    await enable('CustomIdle', { mode: 'extend', minutes: 30 });
    await sleep(5500);
    assert.strictEqual(await page.evaluate(() => window.__status.myStatus), 'online');
    await disable('CustomIdle');
  });
  await test('leaves Do Not Disturb and Invisible alone', async () => {
    await page.evaluate(() => { window.__status.myStatus = 'dnd'; window.__statusCalls = 0; });
    await enable('CustomIdle', { mode: 'never' });
    await sleep(5500);
    assert.strictEqual(await page.evaluate(() => window.__statusCalls), 0);
    await disable('CustomIdle');
    await page.evaluate(() => { window.__status.myStatus = 'online'; });
  });

  console.log('FixCodeblockGap');
  await test('always on (no toggle, cannot be turned off) and already removes the margin below a code block and above whatever follows it', async () => {
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('FixCodeblockGap').alwaysOn), true);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.isRunning('FixCodeblockGap')), true, 'running from boot, never toggled on in this test');
    assert.deepStrictEqual(await page.evaluate(() => [getComputedStyle(document.querySelector('.md-pre')).marginBottom, getComputedStyle(document.getElementById('aftercode')).marginTop]), ['0px', '0px']);
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('FixCodeblockGap', false));
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.isRunning('FixCodeblockGap')), true, 'setEnabled(false) cannot stop it');
  });

  console.log('BetterRoleContext');
  await test('right-click a role to copy its colour', async () => {
    await enable('BetterRoleContext');
    await sleep(100);
    await page.click('.pc-role', { button: 'right' });
    await sleep(150);
    assert.ok((await text('.ym-brc-menu button')).includes('#ff6b4a'));
    await page.evaluate(() => document.querySelector('.ym-brc-menu button').click());
    await sleep(80);
    assert.ok((await page.evaluate(() => window.__toasts)).some((t) => /Copied #ff6b4a/.test(t[0])));
    await disable('BetterRoleContext');
  });

  console.log('QuickToolbox');
  await test('a second button opens Reload/DevTools/Relaunch and your chosen plugins’ switches', async () => {
    await enable('QuickToolbox', { favourites: 'TypingIndicator' });
    await sleep(100);
    assert.strictEqual(await count('.user-bar .ym-qt-btn'), 1);
    await page.click('.user-bar .ym-qt-btn');
    await sleep(100);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.ym-qt-menu button')].map((b) => b.textContent));
    assert.ok(labels.some((l) => l === 'Reload'));
    assert.ok(labels.some((l) => l.includes('TypingIndicator')));
    await page.evaluate(() => [...document.querySelectorAll('.ym-qt-menu button')].find((b) => b.textContent.includes('TypingIndicator')).click());
    await sleep(80);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.isEnabled('TypingIndicator')), true);
    await disable('TypingIndicator');
    await disable('QuickToolbox');
    assert.strictEqual(await count('.ym-qt-btn'), 0);
  });
  await test('an always-on plugin cannot be favourited here either - same rule as the Plugins page, no dead switch to click', async () => {
    await enable('QuickToolbox', { favourites: 'TypingIndicator, FixCodeblockGap' });
    await sleep(100);
    await page.click('.user-bar .ym-qt-btn');
    await sleep(100);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.ym-qt-menu button')].map((b) => b.textContent));
    assert.ok(labels.some((l) => l.includes('TypingIndicator')));
    assert.ok(!labels.some((l) => l.includes('FixCodeblockGap')), 'always-on, so it is left out rather than shown as an unclickable switch');
    await page.keyboard.press('Escape');
    await disable('QuickToolbox');
  });
  await test('opens upward instead of off-screen when the button sits near the bottom of the window (the user-bar usually does)', async () => {
    await enable('QuickToolbox', { favourites: 'TypingIndicator, MessageLatency, CustomIdle' });
    await page.evaluate(() => { document.querySelector('.user-bar').style.cssText += ';position:fixed;bottom:12px;left:0'; });
    await sleep(100);
    await page.click('.user-bar .ym-qt-btn');
    await sleep(100);
    const r = await page.evaluate(() => document.querySelector('.ym-qt-menu').getBoundingClientRect().toJSON());
    const viewport = await page.evaluate(() => window.innerHeight);
    assert.ok(r.top >= 0 && r.bottom <= viewport, `menu must stay fully on screen, got top=${r.top} bottom=${r.bottom} viewport=${viewport}`);
    await page.keyboard.press('Escape');
    await disable('QuickToolbox');
    await page.evaluate(() => { document.querySelector('.user-bar').style.cssText = document.querySelector('.user-bar').style.cssText.replace(/;position:fixed;bottom:12px;left:0/, ''); });
  });

  console.log('TypingIndicator');
  await test('marks a chat as typing in the sidebar, but never the one you have open', async () => {
    await enable('TypingIndicator');
    await sleep(100);
    assert.strictEqual(await attr('[data-nav-chan="c2"]', 'data-ym-typing'), '');
    assert.strictEqual(await attr('[data-nav-chan="c1"]', 'data-ym-typing'), null, 'c1 is the active channel, even though it is unread');
    assert.strictEqual(await attr('[data-nav-chan="d1"]', 'data-ym-typing'), null);
    await disable('TypingIndicator');
    assert.strictEqual(await count('[data-ym-typing]'), 0);
  });

  console.log('MessageLatency');
  await test('flags your own message that genuinely arrives slowly, not an old one it just happens to see first', async () => {
    await enable('MessageLatency', { threshold: 4 });
    await sleep(100);

    assert.strictEqual(await count(row('m2') + ' .ym-ml-tag'), 0, 'm2 was already loaded, not a real arrival');
    assert.strictEqual(await count(row('m3') + ' .ym-ml-tag'), 0, 'm3 likewise');

    await page.evaluate(() => {
      const YM = window.YapperMod;
      const s = YM.Store.getState();
      const m4 = { id: 'm4', channel_id: 'c1', author_id: 'me', content: 'late one', created_at: new Date(Date.now() - 8000).toISOString() };
      YM.Store.setState({ messages: { ...s.messages, c1: [...s.messages.c1, m4] } });
      document.querySelector('#msgs').insertAdjacentHTML('beforeend', '<div class="msg" data-message-id="m4" data-author="me"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">Tarik</button><span class="msg-time">9:01</span></div><div class="msg-text">text m4</div></div></div>');
    });
    await sleep(150);
    assert.strictEqual(await count(row('m4') + ' .ym-ml-tag'), 1, 'm4 just arrived, 8s old - well past the 4s threshold');
    assert.strictEqual(await count(row('m1') + ' .ym-ml-tag'), 0, 'm1 was not sent by me');
    await disable('MessageLatency');
    assert.strictEqual(await count('.ym-ml-tag'), 0);
  });

  await test('all fourteen toggleable new plugins are registered, off by default, and start and stop without errors', async () => {
    const names = ['ChatExport', 'PinnedMessages', 'JumpToUnread', 'DoNotDisturbSchedule', 'NotificationSnooze', 'CustomKeybinds', 'CopyUserURLs', 'ImageZoom', 'PictureInPicture', 'CustomIdle', 'BetterRoleContext', 'QuickToolbox', 'TypingIndicator', 'MessageLatency'];
    const r = await page.evaluate((names) => names.map((n) => {
      const YM = window.YapperMod; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      return { n, ok: !!p && ran && !err && !YM.plugins.isRunning(n) && !p.enabledByDefault, err: err && String(err.message || err) };
    }), names);
    assert.deepStrictEqual(r.filter((x) => !x.ok), []);
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
