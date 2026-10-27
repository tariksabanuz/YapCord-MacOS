'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const posts = [];
  const requests = [];
  const site = await openSite({ initial: { settings: { plugins: {} } }, permissions: ['clipboard-read', 'clipboard-write'] });
  const { page } = site;
  page.on('request', (r) => requests.push(r.method() + ' ' + r.url()));
  await page.route('**/rest/v1/messages**', (route) => {
    const r = route.request();
    if (r.method() === 'POST' || r.method() === 'PATCH') posts.push(JSON.parse(r.postData()));
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/attachments/**', (route) => route.fulfill({ status: 200, contentType: 'audio/ogg', headers: { 'access-control-allow-origin': '*' }, body: 'OggS-fake-audio' }));
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/emojis/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  const SHOT = process.env.YM_SHOTS || '';

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.Store.setState({
      userId: 'me',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy', avatar_path: 'u2/avatar.png' },
        u3: { id: 'u3', username: 'kim', display_name: 'Kim' },
      },
      servers: { s1: { id: 's1', name: 'Test Server', owner_id: 'me', created_at: '2026-01-02T10:00:00Z', description: 'A place' } },
      serverMembers: { s1: ['me', 'u2', 'u3'] },
      memberCounts: { s1: 3 },
      roles: { s1: [
        { id: 'r2', server_id: 's1', name: 'Mods', color: '#ff0000', position: 5, perms: { kick_members: true, manage_messages: false } },
        { id: 'r1', server_id: 's1', name: 'Fans', color: '#00aa00', position: 2, perms: {} },
      ] },
      memberRoles: { s1: { u2: ['r2'], u3: ['r1'] } },
      emojis: { e1: { id: 'e1', name: 'blob', path: 'e1/blob.png', server_id: 's1' } },
      friends: { u2: 'accepted', u3: 'incoming' },
      online: { u2: 'online' },
      activeServerId: 's1',
      channels: {
        c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' },
        c2: { id: 'c2', kind: 'text', server_id: 's1', name: 'random' },
        v1: { id: 'v1', kind: 'voice', server_id: 's1', name: 'Lounge' },
        d1: { id: 'd1', kind: 'dm', server_id: null, name: 'Sammy', memberIds: ['me', 'u2'] },
      },
      activeChannelId: 'c1',
      voiceMembers: { v1: [{ userId: 'u2', muted: false, deafened: false, sharing: false }] },
      voice: null,
      typing: {},
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello @sam and @kim', created_at: '2026-10-18T09:01:00Z' },
        { id: 'm2', channel_id: 'c1', author_id: 'u2', content: '```js\nconst a = "x"; // note\nfunction go() { return 42; }\n```', created_at: '2026-10-18T09:02:00Z' },
        { id: 'm3', channel_id: 'c1', author_id: 'u3', content: 'voice', attachment_path: 'c1/voice.ogg', voice_secs: 5, created_at: '2026-10-18T09:03:00Z' },
        { id: 'm4', channel_id: 'c1', author_id: 'me', content: 'pics', created_at: '2026-10-18T09:04:00Z' },
      ] },
    });
    const row = (id, author, name, inner) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button></div>${inner}</div><div class="msg-actions"></div></div>`;
    const app = document.createElement('div');
    app.className = 'app';
    app.id = 'fx15';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:640px;z-index:10;display:flex;background:#1a1b20;color:#eee';
    app.innerHTML = `
      <nav class="rail" aria-label="Servers">
        <div class="rail-wrap"><span class="rail-pill"></span><button class="rail-item" title="Direct messages" aria-label="Direct messages">DM</button><span class="rail-badge">3</span></div>
        <div class="rail-sep"></div>
        <div class="rail-wrap"><button class="rail-item rail-folder" title="Folder" aria-label="Folder: Folder"><span class="folder-grid"><span class="folder-mini">A</span><span class="folder-mini">B</span></span></button></div>
        <div class="rail-wrap"><button class="rail-item active" title="Test Server">TS</button></div>
      </nav>
      <aside class="sidebar">
        <button class="sidebar-head server-head"><span class="title">Test Server</span></button>
        <div class="sidebar-scroll">
          <div class="channel-row active" data-nav-chan="c1"><button class="channel-main"><span class="name">general</span></button></div>
          <div><div class="channel-row" id="voicerow"><button class="channel-main" id="voicebtn"><span class="name">Lounge</span></button></div>
            <div class="voice-people"><button class="voice-person"><span class="name">sam</span></button></div></div>
          <button class="chat-row" data-nav-chan="d1"><span class="name">Sammy</span></button>
        </div>
      </aside>
      <main class="main" style="flex:1;min-width:0;position:relative">
        <div style="width:520px">
        ${row('m1', 'u2', 'Sammy', '<div class="msg-text"><span><button class="mention">@sam</button> and <button class="mention">@kim</button> <button class="mention role">@Mods</button></span></div>')}
        ${row('m2', 'u2', 'Sammy', '<div class="msg-text"><span><pre class="md-pre"><code>const a = "x"; // note\nfunction go() { return 42; }</code></pre></span></div>')}
        ${row('m3', 'u3', 'Kim', '<div class="msg-text">voice</div><div class="voice-msg"><button class="voice-play">play</button></div>')}
        ${row('m4', 'me', 'Tarik', '<div class="msg-text">pics <img class="emoji" id="cemoji" style="width:22px;height:22px" src="https://x.supabase.co/storage/v1/object/public/emojis/e1/blob.png" alt=":blob:"></div><div class="msg-album cols-2 n-2" id="album"><span class="msg-album-cell"><button class="msg-image"><img id="img1" style="width:60px;height:40px" src="https://x.supabase.co/storage/v1/object/public/attachments/c1/1700000000000-cat.gif" alt="GIF"></button></span><span class="msg-album-cell"><button class="msg-image"><img src="https://x.supabase.co/storage/v1/object/public/attachments/c1/dog.png" alt=""></button></span></div>')}
        </div>
        <div class="side" style="position:absolute;right:10px;top:330px;width:300px;z-index:5;display:flex;flex-direction:column;gap:6px"><div class="stream-card" id="sc" style="width:200px;height:110px"><img class="stream-thumb" id="thumb" style="width:200px;height:110px" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt=""><div class="stream-meta"></div></div>
        <div class="friends-tabs"><button>Online</button><button>Pending<span class="badge">1</span></button></div>
        <div class="mention-menu" role="listbox"><button role="option" id="optA"><img class="emoji-ac-img" src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f600.svg" alt="grin"> grin</button><button role="option" id="optB"><img class="emoji-ac-img" src="https://x.supabase.co/storage/v1/object/public/emojis/e1/blob.png" alt="blob"> blob</button></div>
        <div class="typing-line on" id="typing" style="position:static"><span class="typing-dots"><i></i><i></i><i></i></span><span><span><b>Sammy</b></span></span></div></div>
        <div class="composer" style="position:absolute;left:0;right:320px;bottom:30px"><div class="composer-box"><textarea style="width:300px;height:40px"></textarea><div class="composer-tools"><button class="icon-btn" title="GIF">GIF</button></div><button class="send-btn">Send</button></div></div>
      </main>`;
    document.body.append(app);
  });
  await sleep(200);

  const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
  const css = (sel, prop, pseudo) => page.evaluate(([s, p, ps]) => getComputedStyle(document.querySelector(s), ps || null).getPropertyValue(p), [sel, prop, pseudo]);

  console.log('Looks (CSS only)');
  await test('PlainFolderIcon: a closed folder shows one folder icon instead of the four small icons', async () => {
    await enable('PlainFolderIcon');
    assert.strictEqual(await css('.folder-grid', 'display'), 'none');
    assert.notStrictEqual(await css('.rail-folder', 'content', '::after'), 'none');
    await disable('PlainFolderIcon');
    assert.notStrictEqual(await css('.folder-grid', 'display'), 'none');
  });

  await test('NoMosaic: an album is stacked, not a square grid', async () => {
    await enable('NoMosaic');
    assert.strictEqual(await css('#album', 'display'), 'flex');
    assert.strictEqual(await css('#album', 'flex-direction'), 'column');
    await disable('NoMosaic');
    assert.notStrictEqual(await css('#album', 'display'), 'flex');
  });

  await test('NoServerEmojis: custom emojis leave the :name suggestions, normal ones stay', async () => {
    await enable('NoServerEmojis');
    assert.strictEqual(await css('#optB', 'display'), 'none');
    assert.notStrictEqual(await css('#optA', 'display'), 'none');
    await disable('NoServerEmojis');
    assert.notStrictEqual(await css('#optB', 'display'), 'none');
  });

  console.log('Chat');
  await test('ImageFilename: tooltip and alt text come from the file name', async () => {
    await enable('ImageFilename');
    await sleep(300);
    const r = await page.evaluate(() => ({ title: document.getElementById('img1').title, alt: document.getElementById('img1').alt, other: document.querySelectorAll('#album img')[1].title }));
    assert.deepStrictEqual(r, { title: 'cat.gif', alt: 'cat.gif', other: 'dog.png' });
    const api = await page.evaluate(() => window.YapperMod.plugins.get('ImageFilename').api.fileName('https://h/x/1700000000000-my%20pic.png?t=1'));
    assert.strictEqual(api, 'my pic.png');
  });

  await test('MentionAvatars: only a data attribute and a CSS variable are set on the mention; role mentions are left alone', async () => {
    await enable('MentionAvatars');
    await sleep(300);
    const r = await page.evaluate(() => [...document.querySelectorAll('.mention')].map((m) => ({ t: m.textContent, av: m.hasAttribute('data-ym-av') })));
    assert.deepStrictEqual(r, [{ t: '@sam', av: true }, { t: '@kim', av: false }, { t: '@Mods', av: false }]);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.mention').className), 'mention');
    assert.strictEqual(await css('.mention[data-ym-av]', 'content', '::before'), '""');
    await disable('MentionAvatars');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-av]').length), 0);
  });

  await test('RoleColorEverywhere: mentions, typing line and voice list get the top role colour', async () => {
    await enable('RoleColorEverywhere');
    await sleep(400);
    const r = await page.evaluate(() => ({
      sam: document.querySelectorAll('.mention')[0].getAttribute('data-ym-rc'),
      kim: document.querySelectorAll('.mention')[1].getAttribute('data-ym-rc'),
      typing: document.querySelector('.typing-line b').getAttribute('data-ym-rc'),
      voice: document.querySelector('.voice-person .name').getAttribute('data-ym-rc'),
    }));
    assert.strictEqual(r.sam, '#ff0000');
    assert.strictEqual(r.kim, '#00aa00');
    assert.strictEqual(r.typing, '#ff0000');
    assert.strictEqual(r.voice, '#ff0000');
    assert.strictEqual(await css('.mention', 'color'), 'rgb(255, 0, 0)');
    await page.evaluate(() => window.YapperMod.plugins.get('RoleColorEverywhere').settings.set('typing', false));
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.typing-line b').hasAttribute('data-ym-rc')), false);
    await disable('RoleColorEverywhere');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-rc]').length), 0);
  });

  await test('TypingTweaks: the person typing gets a small avatar', async () => {
    await enable('TypingTweaks');
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.typing-line b').hasAttribute('data-ym-tav')), true);
    assert.strictEqual(await css('.typing-line b', 'content', '::before'), '""');
    await disable('TypingTweaks');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-tav]').length), 0);
  });

  await test('MoreQuickReactions: the message menu gets extra emojis and one of them reacts', async () => {

    const DEFAULT_EMOJIS = await page.evaluate(() => window.YapperMod.plugins.get('MoreQuickReactions').settings.store.emojis);
    await page.evaluate((v) => window.YapperMod.plugins.get('MoreQuickReactions').settings.set('emojis', v), '😮 🎉 xx');
    await page.evaluate(() => document.querySelector('.msg[data-message-id="m1"] .msg-text').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 100 })));
    await page.evaluate(() => {
      const ov = document.createElement('div');
      ov.className = 'overlay clear';
      ov.innerHTML = '<div class="ctx-menu" role="menu" style="position:fixed;left:300px;top:100px"><div class="quick-reacts"><button aria-label="React 👍">👍</button><button aria-label="React ❤️">❤️</button></div></div>';
      document.body.append(ov);
    });
    await sleep(300);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.quick-reacts button')].map((b) => b.getAttribute('aria-label')));
    assert.deepStrictEqual(labels, ['React 👍', 'React ❤️', 'React 😮', 'React 🎉']);
    const before = requests.length;
    await page.click('.ym-qr-extra');
    await sleep(500);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.overlay.clear .ctx-menu') && document.querySelector('.overlay.clear').dispatchEvent !== undefined), true);
    assert.ok(requests.slice(before).some((r) => /reaction/i.test(r)) || (await page.evaluate(() => Object.keys(window.YapperMod.Store.getState().reactions || {}).length)) > 0, 'a reaction was started: ' + requests.slice(before).join(' | '));
    await page.evaluate(() => document.querySelectorAll('.overlay.clear').forEach((n) => n.remove()));
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('MoreQuickReactions').api.parseList('😮 🎉 abc 👍🏽 🇳🇱')), ['😮', '🎉', '👍🏽', '🇳🇱']);
    await page.evaluate((v) => window.YapperMod.plugins.get('MoreQuickReactions').settings.set('emojis', v), DEFAULT_EMOJIS);
  });

  await test('MoreQuickReactions: registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('MoreQuickReactions');
      YM.plugins.setEnabled('MoreQuickReactions', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('MoreQuickReactions'), err: YM.plugins.errors.get('MoreQuickReactions') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  await test('CopyEmojiMarkdown: right-click a custom emoji -> copy as <:name:id>', async () => {
    await enable('CopyEmojiMarkdown');
    await page.click('#cemoji', { button: 'right' });
    await page.waitForSelector('.ym-ce-menu .ctx-menu');
    await page.click('.ym-ce-menu button:first-child');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => navigator.clipboard.readText()), '<:blob:e1>');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-ce-menu').length), 0);
    await page.click('#cemoji', { button: 'right' });
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-ce-menu').length), 0);
    await disable('CopyEmojiMarkdown');
  });

  await test('VoiceDownload: voice messages get a download button that saves the file', async () => {
    await enable('VoiceDownload');
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.msg[data-message-id="m3"] .ym-vd-btn')), true);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.msg[data-message-id="m1"] .ym-vd-btn')), false);
    await page.hover('.msg[data-message-id="m3"] .msg-author');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('.msg[data-message-id="m3"] .ym-vd-btn')]);
    assert.match(download.suggestedFilename(), /^voice-message-.*\.ogg$/);
    await disable('VoiceDownload');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-vd-btn').length), 0);
  });

  await test('PreviewMessage: a Preview button shows the message rendered, without sending it', async () => {
    await enable('PreviewMessage');
    await sleep(200);
    await page.fill('.composer textarea', '**bold** and `code` @sam\n> quote\n- item');
    const before = posts.length;
    await page.click('.ym-pm-btn');
    await page.waitForSelector('.ym-modal .ym-pm');
    const r = await page.evaluate(() => ({ strong: document.querySelector('.ym-pm strong').textContent, code: document.querySelector('.ym-pm code').textContent, mention: document.querySelector('.ym-pm .mention').textContent, quote: !!document.querySelector('.ym-pm blockquote'), li: document.querySelector('.ym-pm li').textContent, html: document.querySelector('.ym-pm').innerHTML.includes('<script') }));
    assert.deepStrictEqual(r, { strong: 'bold', code: 'code', mention: '@sam', quote: true, li: 'item', html: false });
    assert.strictEqual(posts.length, before);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-modal').length), 0);
    await page.fill('.composer textarea', '<img src=x onerror=alert(1)> ||secret||');
    await page.click('.ym-pm-btn');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pm img').length), 0, 'text is text, never HTML');
    await page.keyboard.press('Escape');
    await page.fill('.composer textarea', '');
    await disable('PreviewMessage');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pm-btn').length), 0);
  });

  await test('CustomCommands: /name is replaced by your text when the message is sent', async () => {
    await enable('CustomCommands', { commands: [{ name: 'shrug', text: 'shrug {args}' }, { name: 'hi', text: 'Hi $1, from {user}' }] });
    const send = (content) => page.evaluate(async (c) => { await fetch('/rest/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'x' + Math.random(), channel_id: 'c1', content: c }) }); }, content);
    await send('/shrug well then');
    await send('/hi bob');
    await send('/unknown stays');
    await send('normal text');
    const got = posts.slice(-4).map((p) => (Array.isArray(p) ? p[0] : p).content);
    assert.deepStrictEqual(got, ['shrug well then', 'Hi bob, from Tarik', '/unknown stays', 'normal text']);
    const api = await page.evaluate(() => window.YapperMod.plugins.get('CustomCommands').api.expand('/A  one two', [{ name: '/a', text: '[$2|$1|{args}|$9]' }], {}));
    assert.strictEqual(api, '[two|one|one two|]');
    await disable('CustomCommands');
  });

  await test('ShikiCodeblocks: keywords, strings, numbers, comments and functions are coloured without touching the markup', async () => {
    await enable('ShikiCodeblocks');
    await sleep(500);
    const r = await page.evaluate(() => {
      const count = (t) => (CSS.highlights.get('ym-c-' + t) ? CSS.highlights.get('ym-c-' + t).size : -1);
      return { kw: count('keyword'), str: count('string'), num: count('number'), com: count('comment'), fn: count('function'), html: document.querySelector('pre.md-pre > code').innerHTML };
    });
    assert.ok(r.kw >= 3, 'const, function, return: ' + r.kw);
    assert.strictEqual(r.str, 1);
    assert.strictEqual(r.num, 1);
    assert.strictEqual(r.com, 1);
    assert.strictEqual(r.fn, 1);
    assert.ok(!r.html.includes('<span'), 'no markup was added');
    const tok = await page.evaluate(() => {
      const api = window.YapperMod.plugins.get('ShikiCodeblocks').api;
      const code = (c, l) => api.tokenize(c, l).map((t) => t.type + ':' + c.slice(t.start, t.end));
      return {
        py: code('def f(x):\n    return x  # c', 'python'),
        json: code('{"a": [1, true]}', 'json'),
        sql: code('SELECT name FROM t', 'sql'),
        html: code('<a href="x">hi</a>', 'html'),
        css: code('a { color: #fff; }', 'css'),
        guess: [api.guess('{"a":1}'), api.guess('<div></div>'), api.guess('SELECT 1'), api.guess('def a():\n  pass'), api.guess('fn main() {}')],
        langs: api.fenceLanguages('x ```js\na``` y ```\nb``` ```py\nc```'),
      };
    });
    assert.deepStrictEqual(tok.py, ['keyword:def', 'function:f', 'keyword:return', 'comment:# c']);
    assert.deepStrictEqual(tok.json, ['prop:"a"', 'number:1', 'keyword:true']);
    assert.deepStrictEqual(tok.sql, ['keyword:SELECT', 'keyword:FROM']);
    assert.deepStrictEqual(tok.html, ['tag:<a', 'attr:href', 'string:"x"', 'tag:</a']);
    assert.deepStrictEqual(tok.css, ['prop:color', 'string:#fff'].slice(0, 1).concat(['number:#fff']));
    assert.deepStrictEqual(tok.guess, ['json', 'html', 'sql', 'py', 'rust']);
    assert.deepStrictEqual(tok.langs, ['js', '', 'py']);
    await disable('ShikiCodeblocks');
    assert.strictEqual(await page.evaluate(() => CSS.highlights.has('ym-c-keyword')), false);
  });

  console.log('Servers and friends');
  await test('ServerListIndicators: shows online friends and the number of servers under the logo', async () => {
    await enable('ServerListIndicators');
    await sleep(300);
    const t = await text('.ym-sli');
    assert.match(t, /1/);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sli-row').length), 2);

    assert.strictEqual(await page.evaluate(() => {
      const rail = document.querySelector('nav.rail');
      const home = rail.querySelector(':scope > .rail-wrap button.rail-item[title="Direct messages"]');
      const anchor = rail.querySelector(':scope > .ym-ra-wrap') || home.closest('.rail-wrap');
      return anchor.nextElementSibling && anchor.nextElementSibling.classList.contains('ym-sli');
    }), true, 'directly after the logo button (and the always-on unread-badge button, if present)');
    await page.evaluate(() => window.YapperMod.Store.setState({ online: { u2: 'online', u3: 'idle' }, friends: { u2: 'accepted', u3: 'accepted' } }));
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sli-row')[0].textContent), '2');
    await page.evaluate(() => window.YapperMod.plugins.get('ServerListIndicators').settings.set('mode', 'servers'));
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sli-row').length), 1);
    await disable('ServerListIndicators');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-sli').length), 0);
    await page.evaluate(() => window.YapperMod.Store.setState({ online: { u2: 'online' }, friends: { u2: 'accepted', u3: 'incoming' } }));
  });

  await test('RelationshipNotifier: a friend that disappears from the list is reported; the first fill and your own clicks are not', async () => {
    await enable('RelationshipNotifier');
    await page.evaluate(() => window.YapperMod.Store.setState({ friends: { u3: 'incoming' } }));
    await sleep(300);
    assert.match(await page.evaluate(() => [...document.querySelectorAll('.ym-toast')].map((t) => t.textContent).join('|')), /Sammy is no longer in your friends list/);
    await page.evaluate(() => { document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); window.YapperMod.Store.setState({ friends: { u2: 'accepted', u3: 'incoming' } }); });
    await page.evaluate(() => {
      const row = document.createElement('div');
      row.className = 'people-row';
      row.innerHTML = '<button id="rm">Remove friend</button>';
      document.body.append(row);
      document.getElementById('rm').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      row.remove();
      window.YapperMod.Store.setState({ friends: { u3: 'incoming' } });
    });
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-toast').length), 0, 'no news without the option; request withdrawn: off by default');
    const d = await page.evaluate(() => window.YapperMod.plugins.get('RelationshipNotifier').api.diff({ a: 'accepted', b: 'incoming', c: 'outgoing' }, { c: 'outgoing' }));
    assert.deepStrictEqual(d, [{ id: 'a', kind: 'removed' }, { id: 'b', kind: 'request-gone' }]);
    await disable('RelationshipNotifier');
    await page.evaluate(() => window.YapperMod.Store.setState({ friends: { u2: 'accepted', u3: 'incoming' } }));
  });

  await test('NoPendingCount: no number on the Friends tab; the Home badge loses the friend requests', async () => {
    await enable('NoPendingCount');
    await sleep(300);
    assert.strictEqual(await css('.friends-tabs .badge', 'display'), 'none');
    assert.strictEqual(await text('nav.rail > .rail-wrap:first-child > .rail-badge'), '2', '3 unread+requests - 1 request');
    await page.evaluate(() => { document.querySelector('nav.rail > .rail-wrap:first-child > .rail-badge').textContent = '1'; });
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelector('nav.rail > .rail-wrap:first-child > .rail-badge').hasAttribute('data-ym-nopending')), true, 'only the request was in it: hidden');
    await disable('NoPendingCount');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-nopending]').length), 0);
    await page.evaluate(() => { document.querySelector('nav.rail > .rail-wrap:first-child > .rail-badge').textContent = '3'; });
  });

  await test('UserVoiceShow: a speaker icon next to people who are in voice, in messages and in your chat list', async () => {
    await enable('UserVoiceShow');
    await sleep(300);
    const r = await page.evaluate(() => ({
      sam: document.querySelector('.msg[data-message-id="m1"] .msg-author').getAttribute('data-ym-voice'),
      kim: document.querySelector('.msg[data-message-id="m3"] .msg-author').hasAttribute('data-ym-voice'),
      dm: document.querySelector('.chat-row[data-nav-chan="d1"]').getAttribute('data-ym-voice'),
    }));
    assert.deepStrictEqual(r, { sam: 'In voice channel: Lounge', kim: false, dm: 'In voice channel: Lounge' });
    assert.strictEqual(await css('.msg[data-message-id="m1"] .msg-author', 'content', '::after'), '"🔊"');
    await page.evaluate(() => window.YapperMod.Store.setState({ voiceMembers: {} }));
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-voice]').length), 0);
    await disable('UserVoiceShow');
    await page.evaluate(() => window.YapperMod.Store.setState({ voiceMembers: { v1: [{ userId: 'u2', muted: false, deafened: false, sharing: false }] } }));
  });

  await test('VcNarrator: announces who joins and leaves the voice channel you are in (not the people already there)', async () => {
    await page.evaluate(() => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: (u) => window.__spoken.push(u.text), cancel() {} } });
    });
    await enable('VcNarrator');
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { channelId: 'v1', serverId: 's1' } }));
    await sleep(100);
    assert.deepStrictEqual(await page.evaluate(() => window.__spoken), [], 'joining yourself is silent');
    await page.evaluate(() => window.YapperMod.Store.setState({ voiceMembers: { v1: [{ userId: 'u2' }, { userId: 'u3' }] } }));
    await page.evaluate(() => window.YapperMod.Store.setState({ voiceMembers: { v1: [{ userId: 'u3' }] } }));
    await sleep(100);
    assert.deepStrictEqual(await page.evaluate(() => window.__spoken), ['Kim joined', 'Sammy left']);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('VcNarrator').api.changes([{ userId: 'a' }], [{ userId: 'b' }])), { joined: ['b'], left: ['a'] });
    await disable('VcNarrator');
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null, voiceMembers: { v1: [{ userId: 'u2' }] } }));
  });

  await test('KeepCurrentChannel: remembers the chat you are in and opens it again after a restart', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: null }));
    await page.evaluate(() => window.YapperMod.plugins.get('KeepCurrentChannel').settings.set('last', { channelId: 'c2', serverId: 's1' }));
    await enable('KeepCurrentChannel');
    await page.waitForFunction(() => window.YapperMod.Store.getState().activeChannelId === 'c2', null, { timeout: 4000 });
    await page.evaluate(() => window.YapperMod.Store.setState({ activeChannelId: 'c1' }));
    await sleep(200);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('KeepCurrentChannel').settings.store.last), { channelId: 'c1', serverId: 's1' });
    await disable('KeepCurrentChannel');
  });

  await test('VoiceChatDoubleClick: a single click does not join, a double-click opens and joins', async () => {
    const calls = await page.evaluate(() => {
      const YM = window.YapperMod;
      window.__calls = [];
      const real = YM.finder.findExports.bind(YM.finder);
      YM.finder.findExports = (names) => {
        if (names.includes('joinVoice')) return { joinVoice: (s, c) => { window.__calls.push(['join', s, c]); return Promise.resolve(); }, leaveVoice() {} };
        if (names.includes('openChannel')) return { openChannel: (c) => { window.__calls.push(['open', c]); return Promise.resolve(); }, sendMessage() {} };
        return real(names);
      };
      window.__reached = 0;
      document.getElementById('voicebtn').addEventListener('click', () => { window.__reached++; });
      return true;
    });
    assert.ok(calls);
    await enable('VoiceChatDoubleClick');
    await page.click('#voicebtn');
    await sleep(150);
    assert.deepStrictEqual(await page.evaluate(() => ({ reached: window.__reached, calls: window.__calls })), { reached: 0, calls: [] }, 'single click: Yapper never sees it');
    await page.dblclick('#voicebtn');
    await sleep(300);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), [['open', 'v1'], ['join', 's1', 'v1']]);
    await page.click('.channel-row[data-nav-chan="c1"] .channel-main');
    await page.evaluate(() => { window.YapperMod.Store.setState({ voice: { channelId: 'v1', serverId: 's1' } }); });
    await page.click('#voicebtn');
    assert.strictEqual(await page.evaluate(() => window.__reached), 1, 'already in that channel: a click passes through');
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await disable('VoiceChatDoubleClick');
    await page.click('#voicebtn');
    assert.strictEqual(await page.evaluate(() => window.__reached), 2, 'plugin off: untouched');
  });

  await test('ServerInfo: "Server info" in the server menu opens a dialog with the facts', async () => {
    await enable('ServerInfo');
    await page.evaluate(() => {
      const ov = document.createElement('div');
      ov.className = 'overlay clear';
      ov.id = 'fxmenu';
      ov.innerHTML = '<div class="ctx-menu server-menu" style="position:fixed;left:100px;top:60px"><button><span>Invite People</span></button></div>';
      document.body.append(ov);
    });
    await sleep(300);
    await page.click('.ym-si-item');
    await page.waitForSelector('.ym-modal .ym-kv');
    const t = await text('.ym-modal .ym-kv');
    assert.match(t, /Test Server/);
    assert.match(t, /Tarik \(@tarik\)/);
    assert.match(t, /Members3/);
    assert.match(t, /Text channels2/);
    assert.match(t, /Voice channels1/);
    assert.match(t, /Roles2/);
    assert.match(t, /Custom emojis1/);
    assert.match(t, /A place/);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-modal').length), 0);
    await page.evaluate(() => document.getElementById('fxmenu').remove());
    await disable('ServerInfo');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-si-item').length), 0);
  });

  await test('PermissionsViewer: effective permissions of a member and the roles of the server', async () => {
    const calc = await page.evaluate(() => {
      const api = window.YapperMod.plugins.get('PermissionsViewer').api;
      const s = window.YapperMod.Store.getState();
      const list = (id) => [...api.effective(s, 's1', id).perms].sort();
      const owner = api.effective(s, 's1', 'me');
      return { owner: owner.owner, ownerCount: owner.perms.size, mod: list('u2'), fan: list('u3'), roles: api.effective(s, 's1', 'u2').roles.map((r) => r.name) };
    });
    assert.strictEqual(calc.owner, true);
    assert.ok(calc.ownerCount >= 24);
    assert.ok(calc.mod.includes('kick_members') && calc.mod.includes('send_messages') && !calc.mod.includes('ban_members'));
    assert.ok(!calc.fan.includes('kick_members') && calc.fan.includes('send_messages'));
    assert.deepStrictEqual(calc.roles, ['Mods']);
    await enable('PermissionsViewer');
    await page.evaluate(() => {
      window.YapperMod.Store.setState({ profileCard: 'u2' });
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML = '<div class="pc2-head"><div class="profile-card-name pc2-name">Sammy</div></div>';
      card.style.cssText = 'position:absolute;right:10px;top:20px;z-index:6;width:260px;background:#2a2b31';
      document.querySelector('#fx15 .main').append(card);
    });
    await sleep(300);
    await page.click('.ym-pv-btn');
    await page.waitForSelector('.ym-modal .ym-perm');
    const t = await page.evaluate(() => ({ title: document.querySelector('.ym-modal h2').textContent, kick: document.querySelector('.ym-perm[title="kick_members"]').className, ban: document.querySelector('.ym-perm[title="ban_members"]').className, chip: document.querySelector('.ym-chip').textContent }));
    assert.deepStrictEqual(t, { title: 'Permissions of Sammy', kick: 'ym-perm danger', ban: 'ym-perm no', chip: 'Mods' });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelectorAll('.profile-card').forEach((n) => n.remove()); window.YapperMod.Store.setState({ profileCard: null }); });
    await disable('PermissionsViewer');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pv-btn,.ym-pv-item').length), 0);
  });

  console.log('Voice and fun');
  await test('BiggerStreamPreview: hovering a stream preview shows a big copy that follows the mouse', async () => {
    await enable('BiggerStreamPreview', { width: 400 });
    await page.hover('#thumb');
    const box = await page.evaluate(() => { const r = document.getElementById('thumb').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await page.mouse.move(box.x + 40, box.y + 30);
    await sleep(200);
    const r = await page.evaluate(() => { const p = document.querySelector('.ym-bsp'); return p ? { src: p.src === document.getElementById('thumb').src, w: p.style.width, left: p.style.left } : null; });
    assert.ok(r && r.src && r.w === '400px', JSON.stringify(r));
    await page.mouse.move(700, 500);
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-bsp').length), 0, 'gone when the mouse leaves the card');
    await disable('BiggerStreamPreview');
  });

  await test('oneko: a cat appears, runs towards the mouse and is click-through; off removes it', async () => {
    await enable('oneko', { speed: 30 });
    await sleep(200);
    assert.strictEqual(await css('.ym-oneko', 'pointer-events'), 'none');
    await page.mouse.move(600, 400);
    await sleep(1200);
    const pos = await page.evaluate(() => document.querySelector('.ym-oneko').style.transform);
    assert.match(pos, /translate\((\d+)px,\s*(\d+)px\)/);
    const [x, y] = pos.match(/\d+/g).map(Number);
    assert.ok(x > 100 && y > 80, 'moved towards the mouse: ' + pos);
    await page.mouse.move(40, 40);
    await sleep(2500);
    const pos2 = await page.evaluate(() => document.querySelector('.ym-oneko').style.transform);
    assert.ok(/scaleX\(-1\)/.test(pos2), 'looks left when running left: ' + pos2);
    const frames = await page.evaluate(() => Object.keys(window.YapperMod.plugins.get('oneko').api.FRAMES));
    assert.deepStrictEqual(frames, ['sit', 'run1', 'run2', 'sleep']);
    if (SHOT) {
      for (const n of ['PlainFolderIcon', 'MentionAvatars', 'RoleColorEverywhere', 'TypingTweaks', 'ShikiCodeblocks', 'ServerListIndicators', 'NoMosaic', 'UserVoiceShow']) await enable(n);
      await sleep(600);
      await page.screenshot({ path: SHOT + '/v15.png', clip: { x: 0, y: 0, width: 900, height: 640 } });
    }
    await disable('oneko');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-oneko').length), 0);
  });

  await test('every new plugin is registered, off by default and starts and stops without errors', async () => {

    const names = ['PlainFolderIcon', 'NoMosaic', 'ImageFilename', 'NoServerEmojis', 'MentionAvatars', 'RoleColorEverywhere', 'TypingTweaks', 'CopyEmojiMarkdown', 'ServerListIndicators', 'RelationshipNotifier', 'KeepCurrentChannel', 'VcNarrator', 'UserVoiceShow', 'VoiceChatDoubleClick', 'ServerInfo', 'PermissionsViewer', 'VoiceDownload', 'BiggerStreamPreview', 'NoPendingCount', 'PreviewMessage', 'CustomCommands', 'ShikiCodeblocks', 'oneko'];
    const r = await page.evaluate((list) => list.map((n) => {
      const YM = window.YapperMod;
      const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true);
      const ran = YM.plugins.isRunning(n);
      const err = YM.plugins.errors.get(n);
      YM.plugins.setEnabled(n, false);
      return { n, exists: !!p, ran, err: err ? String(err.message || err) : null, stopped: !YM.plugins.isRunning(n), byDefault: !!(p && p.enabledByDefault) };
    }), names);
    for (const x of r) {
      assert.strictEqual(x.exists, true, x.n + ' exists');
      assert.strictEqual(x.err, null, x.n + ': ' + x.err);
      assert.strictEqual(x.stopped, true, x.n + ' stops');
      assert.strictEqual(x.byDefault, false, x.n + ' is off by default');
    }
    const bad = site.consoleLog.filter((m) => m.type === 'pageerror' || (m.type === 'error' && /YapCord|plugin/i.test(m.text)));
    assert.deepStrictEqual(bad.map((m) => m.text.slice(0, 160)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
