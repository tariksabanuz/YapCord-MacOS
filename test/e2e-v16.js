'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: {} } }, permissions: ['clipboard-read', 'clipboard-write'] });
  const { page } = site;
  const requests = [];
  page.on('request', (r) => requests.push(r.method() + ' ' + r.url()));
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack']) window.YapperMod.plugins.setEnabled(n, false); });

  const PROFILES = {
    me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
    u2: { id: 'u2', username: 'sam', display_name: 'Sammy' },
    u3: { id: 'u3', username: 'kim', display_name: 'Kim' },
  };
  await page.evaluate((profiles) => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.Store.setState({
      userId: 'me',
      profiles,
      servers: {
        s1: { id: 's1', name: 'Test Server', owner_id: 'me' },
        s2: { id: 's2', name: 'Other Server', owner_id: 'me' },
        s3: { id: 's3', name: 'Twin', owner_id: 'me' },
        s4: { id: 's4', name: 'Twin', owner_id: 'me' },
      },
      friends: { u2: 'accepted', u3: 'incoming' },
      online: { u2: 'online' },
      activeServerId: 's1',
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' } },
      activeChannelId: 'c1',
      messages: { c1: [
        { id: 'm1', channel_id: 'c1', author_id: 'u2', content: 'hello', created_at: '2026-10-18T09:01:00Z' },
        { id: 'm2', channel_id: 'c1', author_id: 'me', content: 'mine', created_at: '2026-10-18T09:02:00Z' },
      ] },
      profileCard: null,
      isAdmin: false,
      isMod: false,
    });
    const row = (id, name, inner) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button></div>${inner}</div></div>`;
    const app = document.createElement('div');
    app.className = 'app';
    app.id = 'fx16';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:640px;z-index:10;display:flex;background:#1a1b20;color:#eee';
    app.innerHTML = `
      <style>#fx16 .rail-item{width:48px;height:48px;border-radius:24px;border:0;background:#2b2d33;color:#ddd;font-size:14px;display:block;margin:4px}#fx16 .rail-wrap{display:block}</style>
      <nav class="rail" aria-label="Servers" style="width:80px">
        <div class="rail-wrap"><button class="rail-item" title="Direct messages" aria-label="Direct messages"><span class="orig">DM</span></button></div>
        <div class="rail-wrap"><button class="rail-item rail-folder" title="Folder" aria-label="Folder: Folder"><span class="folder-grid"><span class="folder-mini" id="mini1">A</span></span></button></div>
        <div class="rail-wrap"><button class="rail-item active" id="b1" title="Test Server" aria-label="Test Server"><span class="orig">TS</span></button></div>
        <div class="rail-wrap"><button class="rail-item" id="b2" title="Other Server" aria-label="Other Server"><span class="orig">OS</span></button></div>
        <div class="rail-wrap"><button class="rail-item" id="b3" title="Twin" aria-label="Twin"><span class="orig">T1</span></button></div>
        <div class="rail-wrap"><button class="rail-item" id="b4" title="Twin" aria-label="Twin"><span class="orig">T2</span></button></div>
      </nav>
      <div class="ym-bf-sidebar" style="width:80px"><div class="rail-wrap"><button class="rail-item" id="side2" title="Other Server" aria-label="Other Server"><span class="orig">OS</span></button></div></div>
      <aside class="sidebar" style="width:200px"><div id="menuhost"></div></aside>
      <main class="main" style="flex:1;position:relative"><div style="width:520px">
        ${row('m1', 'Sammy', '<div class="msg-text">hello</div>')}
        ${row('m2', 'Tarik', '<div class="msg-text">mine</div>')}
      </div><div id="cardhost" style="position:absolute;right:20px;top:20px;width:300px"></div></main>`;
    document.body.append(app);

    document.getElementById('b4')['__reactFiber$test'] = { memoizedProps: { children: { props: { server: { id: 's4' } } } } };
    document.getElementById('mini1')['__reactFiber$test'] = { memoizedProps: { children: { props: { server: { id: 's2' } } } } };
  }, PROFILES);
  await sleep(200);

  const q = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e; }, sel);
  const layerOf = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s + ' > .ym-csi');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { text: el.textContent, bg: el.style.backgroundImage, color: el.style.backgroundColor, pos: cs.position, orig: getComputedStyle(document.querySelector(s + ' > .orig') || document.body).visibility };
  }, sel);
  const stored = (key) => page.evaluate((k) => window.YapperMod.settings.get(k, null), key);

  console.log('CustomServerIcons');
  await test('an emoji icon covers the real icon of that server only, and the button still works', async () => {
    await enable('CustomServerIcons');
    await page.evaluate(() => { window.__clicked = 0; document.getElementById('b1').addEventListener('click', () => { window.__clicked++; }); });
    const ok = await page.evaluate(() => window.YapperMod.plugins.get('CustomServerIcons').api.setIcon('s1', { t: 'text', text: '🎮', bg: '#336699' }));
    assert.strictEqual(ok, true);
    await sleep(300);
    const l = await layerOf('#b1');
    assert.strictEqual(l.text, '🎮');
    assert.strictEqual(l.color, 'rgb(51, 102, 153)');
    assert.strictEqual(l.pos, 'absolute');
    assert.strictEqual(l.orig, 'hidden', 'the real icon is hidden under it');
    assert.strictEqual(await layerOf('#b2'), null, 'other servers are untouched');
    await page.click('#b1');
    assert.strictEqual(await page.evaluate(() => window.__clicked), 1, 'the layer does not eat clicks');
    assert.ok(await stored('pluginData.CustomServerIcons'), 'kept in the settings');
  });

  await test('the layer is added once, stays when Yapper redraws the button, and is only on your screen (no network)', async () => {
    await page.evaluate(() => { document.getElementById('b1').className = 'rail-item'; document.getElementById('b1').title = 'Test Server'; });
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#b1 > .ym-csi').length), 1);
    const sent = requests.filter((r) => !/^GET /.test(r));
    assert.deepStrictEqual(sent, [], 'nothing was written or sent anywhere');
  });

  await test('a server is found by Yapper\'s own data first: two servers with the same name are told apart', async () => {
    await page.evaluate(() => { const a = window.YapperMod.plugins.get('CustomServerIcons').api; a.setIcon('s4', { t: 'text', text: '4', bg: '#aa3333' }); });
    await sleep(300);
    assert.strictEqual((await layerOf('#b4')).text, '4');
    assert.strictEqual(await layerOf('#b3'), null, 'the other "Twin" has no fibre and its name is not unique, so it is left alone');
  });

  await test('icons inside a closed folder and in the BetterFolders sidebar get their layer too', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('CustomServerIcons').api.setIcon('s2', { t: 'text', text: 'OS', bg: '#228855' }));
    await sleep(300);
    assert.strictEqual((await layerOf('#mini1')).text, 'OS');
    assert.strictEqual((await layerOf('#side2')).text, 'OS');
    assert.strictEqual((await layerOf('#b2')).text, 'OS');
  });

  await test('Home never gets an icon, and nothing else on the page is touched', async () => {
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[aria-label="Direct messages"] > .ym-csi').length), 0);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-csi').length), 5);
  });

  await test('"Custom icon..." appears in the right-click menu of a server and opens that server\'s dialog', async () => {
    await page.click('#b2', { button: 'right' });
    await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.id = 'ovl';
      o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Mark as read</span></button></div>';
      document.getElementById('menuhost').append(o);
    });
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ctx-menu .ym-csi-item-menu').length), 1);
    await page.evaluate(() => document.querySelector('.ym-csi-item-menu').click());
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Other Server');
    await page.evaluate(() => { document.getElementById('ovl').remove(); });
  });

  await test('the dialog: choose a picture -> it is cut to a small square and shown; "Use the original icon" removes it', async () => {
    await page.setInputFiles('.ym-modal input[type=file]', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await sleep(500);
    const e = await stored('pluginData.CustomServerIcons');
    assert.strictEqual(e.s2.t, 'img');
    assert.ok(/^data:image\/(webp|png);base64,/.test(e.s2.src), 'small data picture');
    assert.ok(e.s2.src.length < 20000, 'kept small: ' + e.s2.src.length);
    await sleep(200);
    const l = await layerOf('#b2');
    assert.ok(/^url\("data:image\//.test(l.bg), 'picture layer on the button');
    assert.strictEqual(l.text, '');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Use the original icon').click());
    await sleep(300);
    assert.strictEqual(await layerOf('#b2'), null);
    assert.strictEqual(await layerOf('#side2'), null);
    assert.strictEqual(await layerOf('#mini1'), null);
    assert.strictEqual((await stored('pluginData.CustomServerIcons')).s2, undefined);
    await page.evaluate(() => document.querySelector('.ym-modal').remove());
  });

  await test('the dialog: an emoji/letters icon is limited to three characters and needs some text', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('CustomServerIcons').api.clearIcon('s2'));
    await page.evaluate(() => window.YapperMod.plugins.get('CustomServerIcons').api.serverIdOf(document.getElementById('b2')));
    await page.evaluate(() => { window.YapperMod.plugins.get('CustomServerIcons').api; });

    await page.evaluate(() => { const m = document.createElement('div'); m.className = 'server-menu'; m.id = 'srvmenu'; document.getElementById('menuhost').append(m); });
    await sleep(250);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#srvmenu .ym-csi-item-menu').length), 1);
    await page.evaluate(() => document.querySelector('#srvmenu .ym-csi-item-menu').click());
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Test Server', 'the open server');
    await page.fill('.ym-modal input[type=text]', 'ABCDEF');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Use this').click());
    await sleep(200);
    assert.strictEqual((await stored('pluginData.CustomServerIcons')).s1.text, 'ABC');
    await page.fill('.ym-modal input[type=text]', '   ');
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Use this').click());
    await sleep(150);
    assert.strictEqual((await stored('pluginData.CustomServerIcons')).s1.text, 'ABC', 'an empty text does not replace it');
    await page.evaluate(() => { document.querySelector('.ym-modal').remove(); document.getElementById('srvmenu').remove(); });
  });

  await test('the options list shows every server; Reset takes the icon away; "Reset to defaults" keeps your icons', async () => {
    const box = await page.evaluate(() => {
      const YM = window.YapperMod;
      const def = YM.plugins.get('CustomServerIcons').options.manage;
      const b = document.createElement('div');
      b.id = 'mgr';
      document.getElementById('cardhost').append(b);
      def.render(b, YM.plugins.get('CustomServerIcons'));
      return [...b.querySelectorAll('.ym-csi-name')].map((n) => n.textContent);
    });
    assert.deepStrictEqual(box, ['Other Server', 'Test Server', 'Twin', 'Twin']);
    await page.evaluate(() => window.YapperMod.plugins.get('CustomServerIcons').settings.resetAll());
    assert.ok((await stored('pluginData.CustomServerIcons')).s1, 'icons survive "Reset to defaults"');
    await page.evaluate(() => [...document.querySelectorAll('#mgr .ym-csi-item')].find((r) => r.textContent.includes('Test Server')).querySelector('.ym-btn-ghost').click());
    await sleep(200);
    assert.strictEqual((await stored('pluginData.CustomServerIcons')).s1, undefined);
    await page.evaluate(() => document.getElementById('mgr').remove());
  });

  await test('switching the plugin off removes every layer and gives the real icons back; switching on restores yours', async () => {
    await disable('CustomServerIcons');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-csi').length), 0);
    assert.ok((await stored('pluginData.CustomServerIcons')).s4, 'still saved');
    await enable('CustomServerIcons');
    await sleep(300);
    assert.strictEqual((await layerOf('#b4')).text, '4');
    await disable('CustomServerIcons');
  });

  console.log('FriendNicknames');
  const name = (id) => page.evaluate((i) => window.YapperMod.Store.getState().profiles[i].display_name, id);
  await test('a nickname replaces the display name in Yapper\'s data (so it shows everywhere); the real name is remembered', async () => {
    await enable('FriendNicknames');
    const api = 'window.YapperMod.plugins.get("FriendNicknames").api';
    assert.strictEqual(await page.evaluate((a) => eval(a).setNickname('u2', '  Bestie   Sam '), api), 'Bestie Sam');
    await sleep(200);
    assert.strictEqual(await name('u2'), 'Bestie Sam');
    assert.strictEqual(await page.evaluate((a) => eval(a).realName('u2'), api), 'Sammy');
    assert.strictEqual(await name('u3'), 'Kim', 'others stay as they are');
    assert.strictEqual((await stored('pluginData.FriendNicknames')).u2, 'Bestie Sam');
  });

  await test('changing a nickname keeps the real name (the old nickname is never mistaken for it)', async () => {
    const api = 'window.YapperMod.plugins.get("FriendNicknames").api';
    await page.evaluate((a) => eval(a).setNickname('u2', 'Second'), api);
    await sleep(150);
    assert.strictEqual(await name('u2'), 'Second');
    assert.strictEqual(await page.evaluate((a) => eval(a).realName('u2'), api), 'Sammy');
    await page.evaluate((a) => eval(a).setNickname('u2', 'Bestie Sam'), api);
    await sleep(150);
    assert.strictEqual(await page.evaluate((a) => eval(a).realName('u2'), api), 'Sammy');
    assert.strictEqual(await name('u2'), 'Bestie Sam');
  });

  await test('when Yapper loads the profiles again (real names back), the nickname is put back at once', async () => {
    await page.evaluate((p) => { window.YapperMod.Store.setState({ profiles: JSON.parse(JSON.stringify(p)) }); }, PROFILES);
    await sleep(100);
    assert.strictEqual(await name('u2'), 'Bestie Sam');
    await page.evaluate(() => { const s = window.YapperMod.Store.getState(); window.YapperMod.Store.setState({ profiles: { ...s.profiles, u2: { ...s.profiles.u2, display_name: 'Sammy 2' } } }); });
    await sleep(100);
    assert.strictEqual(await name('u2'), 'Bestie Sam');
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').api.realName('u2')), 'Sammy 2', 'the new real name is the one remembered');
  });

  await test('you cannot give yourself a nickname, and an empty nickname gives the real name back', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').api.setNickname('me', 'Boss'));
    await sleep(150);
    assert.strictEqual(await name('me'), 'Tarik');
    await page.evaluate(() => { window.YapperMod.plugins.get('FriendNicknames').api.setNickname('me', ''); window.YapperMod.plugins.get('FriendNicknames').api.setNickname('u2', ''); });
    await sleep(150);
    assert.strictEqual(await name('u2'), 'Sammy 2');
    assert.strictEqual((await stored('pluginData.FriendNicknames')).u2, undefined);
  });

  await test('a Yapper admin/moderator never gets nicknames written into names they could edit; they come back afterwards', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').api.setNickname('u3', 'K'));
    await sleep(150);
    assert.strictEqual(await name('u3'), 'K');
    await page.evaluate(() => window.YapperMod.Store.setState({ isMod: true }));
    await sleep(150);
    assert.strictEqual(await name('u3'), 'Kim');
    await page.evaluate(() => window.YapperMod.Store.setState({ isMod: false }));
    await sleep(150);
    assert.strictEqual(await name('u3'), 'K');
  });

  await test('switching the plugin off gives every real name back and keeps the nicknames saved', async () => {
    await disable('FriendNicknames');
    await sleep(150);
    assert.strictEqual(await name('u3'), 'Kim');
    assert.strictEqual((await stored('pluginData.FriendNicknames')).u3, 'K');
    await enable('FriendNicknames');
    await sleep(200);
    assert.strictEqual(await name('u3'), 'K');
  });

  await test('the profile card gets a "Nickname" button; Enter in the dialog saves it', async () => {
    await page.evaluate(() => {
      window.YapperMod.Store.setState({ profileCard: 'u2' });
      document.getElementById('cardhost').innerHTML = '<div class="profile-card"><div class="pc2-head"><b>Sammy</b></div></div>';
    });
    await sleep(300);
    const label = await page.evaluate(() => document.querySelector('.profile-card .ym-fn-btn') && document.querySelector('.profile-card .ym-fn-btn').textContent);
    assert.strictEqual(label, 'Nickname');
    await page.click('.profile-card .ym-fn-btn');
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Sammy 2  (@sam)');
    await page.fill('.ym-modal input[type=text]', 'Sam the man');
    await page.press('.ym-modal input[type=text]', 'Enter');
    await sleep(300);
    assert.strictEqual(await q('.ym-modal'), false, 'dialog closed');
    assert.strictEqual(await name('u2'), 'Sam the man');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.profile-card .ym-fn-btn').textContent), 'Change nickname');
    await page.evaluate(() => { window.YapperMod.Store.setState({ profileCard: 'me' }); });
    await sleep(250);
    assert.strictEqual(await q('.profile-card .ym-fn-btn'), false, 'not on your own card');
    await page.evaluate(() => { window.YapperMod.Store.setState({ profileCard: null }); document.getElementById('cardhost').innerHTML = ''; });
  });

  await test('right-click on someone\'s message adds "Nickname for ..."; not on your own message', async () => {
    await page.click('[data-message-id="m1"] .msg-author', { button: 'right' });
    await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.id = 'ovl2';
      o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Reply</span></button></div>';
      document.getElementById('menuhost').append(o);
    });
    await sleep(300);
    const t = await page.evaluate(() => document.querySelector('.ctx-menu .ym-fn-menu') && document.querySelector('.ctx-menu .ym-fn-menu').textContent);
    assert.strictEqual(t, 'Nickname for Sammy 2...');
    await page.evaluate(() => document.getElementById('ovl2').remove());
    await page.click('[data-message-id="m2"] .msg-author', { button: 'right' });
    await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.id = 'ovl3';
      o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Edit</span></button></div>';
      document.getElementById('menuhost').append(o);
    });
    await sleep(300);
    assert.strictEqual(await q('.ctx-menu .ym-fn-menu'), false);
    await page.evaluate(() => document.getElementById('ovl3').remove());
  });

  await test('right-click on a DM in the DM list also adds "Nickname for ..." - the other member, resolved from the channel\'s memberIds', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const s = YM.Store.getState();
      YM.Store.setState({ channels: { ...s.channels, dm1: { id: 'dm1', kind: 'dm', server_id: null, memberIds: ['me', 'u2'] } } });
      const host = document.getElementById('menuhost') || document.body;
      const row = document.createElement('button');
      row.className = 'chat-row';
      row.setAttribute('data-nav-chan', 'dm1');
      row.id = 'dmrow1';
      host.append(row);
    });
    await page.click('#dmrow1', { button: 'right' });
    await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.id = 'ovl4';
      o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Pin DM</span></button></div>';
      document.getElementById('menuhost').append(o);
    });
    await sleep(300);
    const t = await page.evaluate(() => document.querySelector('.ctx-menu .ym-fn-menu') && document.querySelector('.ctx-menu .ym-fn-menu').textContent);
    assert.strictEqual(t, 'Nickname for Sammy 2...');
    await page.evaluate(() => { document.getElementById('ovl4').remove(); document.getElementById('dmrow1').remove(); });
  });

  await test('option "show the real name": (Sammy 2) next to the nickname in messages, only when asked', async () => {
    assert.strictEqual(await q('.ym-fn-real'), false);
    await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').settings.set('showReal', true));
    await sleep(300);
    assert.strictEqual(await text1('[data-message-id="m1"] .ym-fn-real'), '(Sammy 2)');
    assert.strictEqual(await q('[data-message-id="m2"] .ym-fn-real'), false, 'not for yourself');
    await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').settings.set('showReal', false));
    await sleep(300);
    assert.strictEqual(await q('.ym-fn-real'), false);
    async function text1(sel) { return page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel); }
  });

  await test('the options list shows friends and finds anyone by name; typing a nickname + Enter saves it', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const b = document.createElement('div');
      b.id = 'mgr2';
      document.getElementById('cardhost').append(b);
      YM.plugins.get('FriendNicknames').options.manage.render(b, YM.plugins.get('FriendNicknames'));
    });
    const rows = () => page.evaluate(() => [...document.querySelectorAll('#mgr2 .ym-fn-item')].map((r) => r.querySelector('.ym-fn-name b').textContent + '|' + r.querySelector('input').value));
    assert.deepStrictEqual(await rows(), ['Kim|K', 'Sammy 2|Sam the man']);
    await page.fill('#mgr2 input[type=search]', 'kim');
    await sleep(100);
    assert.deepStrictEqual(await rows(), ['Kim|K']);
    await page.fill('#mgr2 .ym-fn-item input', 'Kimmy');
    await page.press('#mgr2 .ym-fn-item input', 'Enter');
    await sleep(250);
    assert.strictEqual((await stored('pluginData.FriendNicknames')).u3, 'Kimmy');
    assert.strictEqual(await name('u3'), 'Kimmy');
    await page.evaluate(() => document.getElementById('mgr2').remove());
  });

  await test('nicknames are kept in the settings (so in Backup), "Reset to defaults" keeps them, and the diagnostics do not list them', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('FriendNicknames').settings.resetAll());
    await sleep(150);
    assert.strictEqual((await stored('pluginData.FriendNicknames')).u3, 'Kimmy');
    const diag = JSON.stringify(await page.evaluate(() => window.YapperMod.diagnostics()));
    assert.ok(!diag.includes('Kimmy') && !diag.includes('Sam the man'), 'no nicknames in the diagnostics');
    assert.ok(!diag.includes('data:image'), 'no pictures in the diagnostics');
  });

  await test('both plugins are registered, off by default, and start and stop without errors', async () => {
    const r = await page.evaluate(() => ['CustomServerIcons', 'FriendNicknames'].map((n) => {
      const YM = window.YapperMod;
      const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, false);
      YM.plugins.setEnabled(n, true);
      const ran = YM.plugins.isRunning(n);
      const err = YM.plugins.errors.get(n);
      YM.plugins.setEnabled(n, false);
      return { n, exists: !!p, ran, err: err ? String(err.message || err) : null, stopped: !YM.plugins.isRunning(n), byDefault: !!(p && p.enabledByDefault) };
    }));
    for (const x of r) {
      assert.strictEqual(x.exists, true, x.n);
      assert.strictEqual(x.err, null, x.n + ': ' + x.err);
      assert.strictEqual(x.ran, true, x.n + ' runs');
      assert.strictEqual(x.stopped, true, x.n + ' stops');
      assert.strictEqual(x.byDefault, false, x.n + ' off by default');
    }
    const bad = site.consoleLog.filter((m) => m.type === 'pageerror' || (m.type === 'error' && /YapCord|plugin/i.test(m.text)));
    assert.deepStrictEqual(bad.map((m) => m.text.slice(0, 160)), []);
  });

  if (process.env.YM_SHOTS) {
    const dir = process.env.YM_SHOTS;
    await enable('CustomServerIcons');
    await enable('FriendNicknames');
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const api = YM.plugins.get('CustomServerIcons').api;
      api.setIcon('s1', { t: 'text', text: '🎮', bg: '#3b5bdb' });
      api.setIcon('s2', { t: 'text', text: 'OS', bg: '#2b8a3e' });
      api.setIcon('s4', { t: 'text', text: 'T2', bg: '#c2255c' });
      document.getElementById('cardhost').innerHTML = '';
      const b = document.createElement('div');
      b.className = 'ym-opt ym-custom';
      b.style.cssText = 'background:#25262c;padding:12px;border-radius:12px;font:14px Inter,system-ui,sans-serif;display:flex';
      document.getElementById('cardhost').append(b);
      YM.plugins.get('CustomServerIcons').options.manage.render(b, YM.plugins.get('CustomServerIcons'));
    });
    await sleep(400);
    await page.screenshot({ path: dir + '/v16-icons.png', clip: { x: 0, y: 0, width: 900, height: 440 } });
    await page.evaluate(() => { window.YapperMod.plugins.get('CustomServerIcons').api.read(); window.YapperMod.plugins.get('CustomServerIcons').api.setIcon('s1', { t: 'text', text: '🎮', bg: '#3b5bdb' }); });
    await page.click('#b2', { button: 'right' });
    await page.evaluate(() => { const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ovlx'; o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Mark as read</span></button></div>'; document.getElementById('menuhost').append(o); });
    await sleep(300);
    await page.evaluate(() => document.querySelector('.ym-csi-item-menu').click());
    await sleep(300);
    await page.screenshot({ path: dir + '/v16-icon-dialog.png' });
    await page.evaluate(() => { document.querySelector('.ym-modal').remove(); document.getElementById('ovlx').remove(); document.getElementById('cardhost').innerHTML = ''; });
    await page.evaluate(() => { const api = window.YapperMod.plugins.get('FriendNicknames').api; api.setNickname('u2', 'Bestie Sam'); });
    await sleep(200);
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const b = document.createElement('div');
      b.className = 'ym-opt ym-custom';
      b.style.cssText = 'background:#25262c;padding:12px;border-radius:12px;font:14px Inter,system-ui,sans-serif;display:flex';
      document.getElementById('cardhost').append(b);
      YM.plugins.get('FriendNicknames').options.manage.render(b, YM.plugins.get('FriendNicknames'));
    });
    await sleep(300);
    await page.screenshot({ path: dir + '/v16-nicknames.png', clip: { x: 0, y: 0, width: 900, height: 440 } });
    await page.evaluate(() => { document.getElementById('cardhost').innerHTML = ''; window.YapperMod.Store.setState({ profileCard: 'u2' }); document.getElementById('cardhost').innerHTML = '<div class="profile-card"><div class="pc2-head"><b>Bestie Sam</b></div></div>'; });
    await sleep(300);
    await page.click('.profile-card .ym-fn-btn');
    await sleep(300);
    await page.screenshot({ path: dir + '/v16-nick-dialog.png' });
  }

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
