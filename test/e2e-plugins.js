'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const ALL_ON = { MessageLogger: {}, BetterFolders: {}, OnePingPerDM: {}, ReadAllNotificationsButton: {}, NoTrack: {} };
for (const k of Object.keys(ALL_ON)) ALL_ON[k] = { enabled: true };

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log('  ok   ' + name);
  } catch (e) {
    results.push([name, false]);
    console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n       '));
  }
}

(async () => {
  const posts = [];
  const site = await openSite({ initial: { settings: { plugins: ALL_ON } } });
  const { page } = site;
  await page.route('**/rest/v1/rpc/**', (route) => {
    posts.push({ url: route.request().url(), body: route.request().postData() });
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/user_server_folders**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ folders: [{ id: 'F1', name: 'Games', color: '#4a8bff', servers: ['s2', 's3'] }] }) });
  });
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  await page.addStyleTag({ url: 'https://www.yapper.website/_next/static/immutable/chunks/0f4b3p845wx6q.css' }).catch(() => {});

  await page.evaluate(() => {
    const YM = window.YapperMod;
    const iso = (n) => new Date(Date.UTC(2026, 9, 18, 9, n)).toISOString();
    YM.Store.setState({
      userId: 'me',
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' }, u2: { id: 'u2', username: 'sam' } },
      channels: { c1: { id: 'c1', kind: 'dm', server_id: null }, c2: { id: 'c2', kind: 'group', server_id: null }, c3: { id: 'c3', kind: 'text', server_id: 's1', name: 'general' } },
      activeChannelId: 'c1',
      messages: {
        c1: [
          { id: 'm1', channel_id: 'c1', author_id: 'me', content: 'my own message', created_at: iso(1) },
          { id: 'm2', channel_id: 'c1', author_id: 'u2', content: 'old text', created_at: iso(2) },
          { id: 'm3', channel_id: 'c1', author_id: 'u2', content: 'about to vanish', created_at: iso(3) },
          { id: 'm4', channel_id: 'c1', author_id: 'u2', content: 'last one', created_at: iso(4) },
        ],
      },
      unread: {}, mentions: {},
    });
    const main = document.createElement('main');
    main.id = 'fx-main';
    main.style.cssText = 'position:fixed;left:0;top:0;width:600px;z-index:99998;background:#222329;padding:10px';
    main.innerHTML = ['m1', 'm2', 'm3', 'm4'].map((id) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><span class="msg-author">x</span></div><div class="msg-text">${id}</div></div><div class="msg-actions"><button class="icon-btn">more</button></div></div>`).join('');
    document.body.append(main);
  });
  const sleep = (ms) => page.waitForTimeout(ms);

  console.log('MessageLogger');
  await test('edit history is shown for an edited message', async () => {
    await page.evaluate(() => window.YapperMod.Store.api.patchMessages([{ id: 'm2', channel_id: 'c1', content: 'new text', edited_at: '2026-10-18T10:00:00.000Z' }]));
    await sleep(200);
    const txt = await page.evaluate(() => document.querySelector('[data-message-id=m2] .ym-ml-edits')?.textContent);
    assert.strictEqual(txt, 'old text');
  });
  await test('a second edit adds a second history line', async () => {
    await page.evaluate(() => window.YapperMod.Store.api.patchMessages([{ id: 'm2', channel_id: 'c1', content: 'newest text', edited_at: '2026-10-18T10:05:00.000Z' }]));
    await sleep(200);
    const lines = await page.evaluate(() => [...document.querySelectorAll('[data-message-id=m2] .ym-ml-edit')].map((e) => e.textContent));
    assert.deepStrictEqual(lines, ['old text', 'new text']);
  });
  await test('an unedited message gets no history', async () => {
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('[data-message-id=m4] .ym-ml-edits')), false);
  });
  await test('a deleted message comes back flagged, in the right place', async () => {
    await page.evaluate(() => window.YapperMod.Store.api.removeMessage('m3'));
    await sleep(300);
    const r = await page.evaluate(() => {
      const list = window.YapperMod.Store.getState().messages.c1;
      return { ids: list.map((m) => m.id), flagged: list.find((m) => m.id === 'm3')?.__ymDeleted === true };
    });
    assert.deepStrictEqual(r.ids, ['m1', 'm2', 'm3', 'm4']);
    assert.ok(r.flagged);
  });
  await test('the deleted message row is decorated and its actions are hidden', async () => {
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-message-id=m3]');
      return { mark: !!el.querySelector(':scope > .ym-ghost-mark'), tag: el.querySelector('.ym-ml-tag')?.textContent, actions: getComputedStyle(el.querySelector('.msg-actions')).display, color: getComputedStyle(el.querySelector('.msg-text')).color };
    });
    assert.ok(r.mark);
    assert.ok(/Deleted/.test(r.tag));
    assert.strictEqual(r.actions, 'none');
    assert.notStrictEqual(r.color, 'rgb(0, 0, 0)');
  });
  await test('a reload of the channel list that drops the ghost puts it back', async () => {
    await page.evaluate(() => {
      const S = window.YapperMod.Store;
      S.setState((s) => ({ messages: { ...s.messages, c1: s.messages.c1.filter((m) => m.id !== 'm3') } }));
    });
    await sleep(400);
    assert.ok(await page.evaluate(() => window.YapperMod.Store.getState().messages.c1.some((m) => m.id === 'm3')));
  });
  await test('a resync whose freshly-fetched window starts after the ghost still brings it back, not just one that still overlaps it', async () => {

    await page.evaluate(() => {
      const S = window.YapperMod.Store;
      const iso = (n) => new Date(Date.UTC(2026, 9, 18, 9, n)).toISOString();
      S.setState((s) => ({ messages: { ...s.messages, c1: [
        { id: 'm5', channel_id: 'c1', author_id: 'u2', content: 'fresh one', created_at: iso(10) },
        { id: 'm6', channel_id: 'c1', author_id: 'u2', content: 'fresher', created_at: iso(11) },
      ] } }));
    });
    await sleep(400);
    const r = await page.evaluate(() => {
      const list = window.YapperMod.Store.getState().messages.c1;
      return { ids: list.map((m) => m.id), flagged: list.find((m) => m.id === 'm3')?.__ymDeleted === true };
    });
    assert.ok(r.ids.includes('m3'), 'the deleted message should come back even though the fresh window starts after it, same as Vencord\'s own plugin does');
    assert.ok(r.flagged);
  });
  await test('"remove from log" deletes the ghost for good', async () => {
    await page.evaluate(() => document.querySelector('[data-message-id=m3] .ym-ml-tag .ym-link').click());
    await sleep(400);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.Store.getState().messages.c1.some((m) => m.id === 'm3')), false);
  });
  await test('ignoreSelf: my own deleted messages are not kept', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('MessageLogger').settings.set('ignoreSelf', true));
    await page.evaluate(() => window.YapperMod.Store.api.removeMessage('m1'));
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.Store.getState().messages.c1.some((m) => m.id === 'm1')), false);
    await page.evaluate(() => window.YapperMod.plugins.get('MessageLogger').settings.set('ignoreSelf', false));
  });
  await test('stopping the plugin removes every decoration', async () => {
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('MessageLogger', false));
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-ghost-mark,.ym-ml-tag,.ym-ml-edits').length), 0);
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('MessageLogger', true));
  });

  console.log('OnePingPerDM');
  const frame = (id, ch, content = 'hi', author = 'u2') => ({ table: 'messages', operation: 'INSERT', record: { id, channel_id: ch, author_id: author, content } });
  await test('first unread message in a DM pings; the next one does not', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const out = {};
      YM.Store.setState({ unread: {} });
      YM.Events.emit('ws:event', 'message', { table: 'messages', operation: 'INSERT', record: { id: 'n1', channel_id: 'c1', author_id: 'u2', content: 'hi' } });
      const before = YM.media.notificationsBlocked;
      new Notification('a', { tag: 'n1' });
      out.firstBlocked = YM.media.notificationsBlocked - before;
      YM.Store.setState({ unread: { c1: 1 } });
      YM.Events.emit('ws:event', 'message', { table: 'messages', operation: 'INSERT', record: { id: 'n2', channel_id: 'c1', author_id: 'u2', content: 'again' } });
      const b2 = YM.media.notificationsBlocked;
      new Notification('b', { tag: 'n2' });
      out.secondBlocked = YM.media.notificationsBlocked - b2;
      return out;
    });
    assert.strictEqual(r.firstBlocked, 0);
    assert.strictEqual(r.secondBlocked, 1);
  });
  await test('servers are not affected', async () => {
    const blocked = await page.evaluate(() => {
      const YM = window.YapperMod;
      YM.Store.setState({ unread: { c3: 5 } });
      YM.Events.emit('ws:event', 'message', { table: 'messages', operation: 'INSERT', record: { id: 'n3', channel_id: 'c3', author_id: 'u2', content: 'x' } });
      const b = YM.media.notificationsBlocked;
      new Notification('c', { tag: 'n3' });
      return YM.media.notificationsBlocked - b;
    });
    assert.strictEqual(blocked, 0);
  });
  await test('a mention still pings when allowMentions is on', async () => {
    const blocked = await page.evaluate(() => {
      const YM = window.YapperMod;
      YM.plugins.get('OnePingPerDM').settings.set('allowMentions', true);
      YM.Store.setState({ unread: { c1: 3 } });
      YM.Events.emit('ws:event', 'message', { table: 'messages', operation: 'INSERT', record: { id: 'n4', channel_id: 'c1', author_id: 'u2', content: 'hey <@me> look' } });
      const b = YM.media.notificationsBlocked;
      new Notification('d', { tag: 'n4' });
      const r = YM.media.notificationsBlocked - b;
      YM.plugins.get('OnePingPerDM').settings.set('allowMentions', false);
      return r;
    });
    assert.strictEqual(blocked, 0);
  });
  await test('only the message ping is muted, and only for a short window', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const ctx = new AudioContext();
      const buf = (name) => { const b = ctx.createBuffer(1, 441, 44100); YM.media.tagBuffer(b, name); return b; };
      const message = buf('message');
      const leave = buf('leave');
      const play = (b) => { const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); const before = YM.media.soundsBlocked; s.start(); return YM.media.soundsBlocked - before; };
      YM.Store.setState({ unread: { c1: 2 } });
      YM.Events.emit('ws:event', 'message', { table: 'messages', operation: 'INSERT', record: { id: 'n5', channel_id: 'c1', author_id: 'u2', content: 'z' } });
      const out = { messageDuring: play(message), leaveDuring: play(leave) };
      await new Promise((res) => setTimeout(res, 2200));
      out.messageAfter = play(message);
      return out;
    });
    assert.deepStrictEqual(r, { messageDuring: 1, leaveDuring: 0, messageAfter: 0 });
  });

  console.log('NoTrack');
  await test('first-party analytics requests are cancelled, normal requests pass', async () => {
    const r = await page.evaluate(async () => {
      const out = {};
      for (const u of ['https://www.yapper.website/733e0a8345b9f6e4/view', 'https://www.yapper.website/_vercel/insights/event', 'https://o1.ingest.sentry.io/api/1/envelope/']) {
        try { await fetch(u, { method: 'POST', body: '{}' }); out[u] = 'passed'; } catch (e) { out[u] = e.name; }
      }
      out.beacon = navigator.sendBeacon('https://www.yapper.website/baf2ce63e079444d/vitals', 'x');
      const ok = await fetch('https://api.yapper.website/rest/v1/profiles?select=id').then((r) => r.status);
      out.api = ok;
      out.count = window.YapperMod.plugins.get('NoTrack').api.blocked.count;
      return out;
    });
    assert.strictEqual(r['https://www.yapper.website/733e0a8345b9f6e4/view'], 'AbortError');
    assert.strictEqual(r['https://www.yapper.website/_vercel/insights/event'], 'AbortError');
    assert.strictEqual(r['https://o1.ingest.sentry.io/api/1/envelope/'], 'AbortError');
    assert.strictEqual(r.beacon, true);
    assert.strictEqual(r.api, 200);
    assert.ok(r.count >= 4);
  });

  console.log('ReadAllNotificationsButton');
  await page.evaluate(() => {
    const rail = document.createElement('div');
    rail.id = 'fx-app';
    rail.className = 'app';
    rail.style.cssText = 'position:fixed;left:620px;top:0;bottom:0;z-index:99999;display:flex;height:100vh';
    rail.innerHTML = '<nav class="rail" aria-label="Servers"><div class="rail-wrap"><span class="rail-pill on"></span><button class="rail-item active" title="Direct messages">DM</button></div><div class="rail-sep"></div><div class="drag-list bare"></div><div class="rail-wrap"><button class="rail-item add" title="Create a server" aria-label="Create a server">+</button></div></nav><aside class="sidebar" style="width:80px"></aside>';
    document.body.append(rail);
  });
  await test('the Read All button sits right under the Yapper logo, above the separator, with the unread count', async () => {

    const s = await page.evaluate(() => window.YapperMod.Store.getState());
    await page.evaluate((state) => {
      window.YapperMod.Store.setState({
        channels: { ...state.channels, c1: { ...state.channels.c1, server_id: 's1' }, c2: { ...state.channels.c2, server_id: 's1' } },
        unread: { c1: 2, c2: 1 },
        mentions: { c1: 1 },
      });
    }, s);
    await sleep(300);
    const r = await page.evaluate(() => {
      const w = document.querySelector('nav.rail .ym-ra-wrap');
      return {
        exists: !!w,
        prevIsLogo: !!w?.previousElementSibling?.querySelector('button.rail-item[title="Direct messages"]'),
        nextIsSeparator: !!w?.nextElementSibling?.classList.contains('rail-sep'),
        isFirstAfterLogo: w?.parentNode === document.querySelector('nav.rail') && w?.parentNode.children[1] === w,
        text: w?.querySelector('.ym-ra-btn')?.textContent,
        badge: w?.querySelector('.ym-ra-badge')?.textContent,
        hidden: w?.querySelector('.ym-ra-badge')?.hidden,
      };
    });
    assert.ok(r.exists && r.prevIsLogo && r.nextIsSeparator && r.isFirstAfterLogo, JSON.stringify(r));
    assert.strictEqual(r.text, 'Read All');
    assert.strictEqual(r.badge, '2');
    assert.strictEqual(r.hidden, false);
  });
  await test('it comes back under the logo when Yapper re-renders the rail', async () => {
    await page.evaluate(() => {
      const nav = document.querySelector('nav.rail');
      document.querySelector('.ym-ra-wrap').remove();
      const first = nav.firstElementChild;
      const clone = first.cloneNode(true);
      first.replaceWith(clone);
    });
    await sleep(300);
    const ok = await page.evaluate(() => {
      const w = document.querySelectorAll('nav.rail .ym-ra-wrap');
      return w.length === 1 && !!w[0].previousElementSibling?.querySelector('button[title="Direct messages"]') && w[0].nextElementSibling?.classList.contains('rail-sep');
    });
    assert.ok(ok);
  });
  await test('clicking it marks each unread chat as read through Yapper', async () => {
    posts.length = 0;
    await page.evaluate(() => document.querySelector('.ym-ra-btn').click());
    await sleep(1500);
    const st = await page.evaluate(() => ({ unread: window.YapperMod.Store.getState().unread, mentions: window.YapperMod.Store.getState().mentions }));
    assert.deepStrictEqual(st.unread, {});
    assert.deepStrictEqual(st.mentions, {});
    const cids = posts.filter((p) => /mark_read/.test(p.url)).map((p) => JSON.parse(p.body).cid).sort();
    assert.deepStrictEqual(cids, ['c1', 'c2']);

    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.ym-ra-badge')).display), 'none');
  });

  console.log('BetterFolders');

  await page.evaluate(() => {
    const YM = window.YapperMod;
    const rail = document.querySelector('#fx-app nav.rail');
    const list = rail.querySelector('.drag-list');
    const servers = { s1: 'Alpha', s2: 'Beta', s3: 'Gamma', s4: 'Delta' };
    const folders = { F1: { id: 'F1', name: 'Games', color: '#4a8bff', servers: ['s2', 's3'] } };
    const open = new Set();
    const item = (id) => `<div class="rail-wrap"><span class="rail-pill${YM.Store.getState().activeServerId === id ? ' on' : ''}"></span><button class="rail-item${YM.Store.getState().activeServerId === id ? ' active' : ''}" title="${servers[id]}" data-server="${id}">${servers[id][0]}</button></div>`;
    const render = () => {
      list.innerHTML = `<div class="drag-row"><div data-rail-row="s1">${item('s1')}</div></div>` + Object.values(folders).map((f) => open.has(f.id)
        ? `<div class="drag-row"><div data-rail-row="f:${f.id}" class="rail-folder-open" style="--folder:${f.color}"><div class="rail-wrap"><button class="rail-item rail-folder open" title="${f.name}" aria-label="Folder: ${f.name}" aria-expanded="true"><svg width="22" height="22"></svg></button></div><div class="drag-list bare">${f.servers.map((s) => `<div class="drag-row">${item(s)}</div>`).join('')}</div></div></div>`
        : `<div class="drag-row"><div data-rail-row="f:${f.id}" class="rail-wrap"><span class="rail-pill"></span><button class="rail-item rail-folder" title="${f.name}" aria-label="Folder: ${f.name}" aria-expanded="false"><span class="folder-grid"></span></button></div></div>`).join('')
        + `<div class="drag-row"><div data-rail-row="s4">${item('s4')}</div></div>`;
    };
    folders.F2 = { id: 'F2', name: 'Work', color: '#30a46c', servers: ['s5', 's6'] };
    servers.s5 = 'Eps'; servers.s6 = 'Zeta';
    rail.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('rail-folder')) {
        const id = b.closest('[data-rail-row]').dataset.railRow.slice(2);
        open.has(id) ? open.delete(id) : open.add(id);
        render();
      } else if (b.dataset.server) {
        YM.Store.setState({ activeServerId: b.dataset.server });
        render();
      } else if (b.title === 'Direct messages') {
        YM.Store.setState({ activeServerId: null });
      }
    });
    window.__fx = { render, open };
    render();
  });
  const openFolders = () => page.evaluate(() => [...window.__fx.open].sort());
  await test('folder data from Yapper\'s own request is tracked', async () => {
    await page.evaluate(() => fetch('https://api.yapper.website/rest/v1/user_server_folders?select=folders&user_id=eq.me'));
    await sleep(300);
    const f = await page.evaluate(() => window.YapperMod.folders.list());
    assert.deepStrictEqual(f.map((x) => [x.id, x.servers]), [['F1', ['s2', 's3']]]);
  });
  await test('an open folder shows a sidebar with its servers; the main list hides them', async () => {
    await page.evaluate(() => document.querySelector('[data-rail-row="f:F1"] button.rail-folder').click());
    await sleep(300);
    const r = await page.evaluate(() => ({
      sidebarTitles: [...document.querySelectorAll('.ym-bf-sidebar .rail-item:not(.ym-bf-head)')].map((b) => b.title),
      hiddenInRail: getComputedStyle(document.querySelector('.rail-folder-open > .drag-list')).display,
      sidebarIsAfterRail: document.querySelector('nav.rail').nextElementSibling?.classList.contains('ym-bf-sidebar'),
    }));
    assert.deepStrictEqual(r.sidebarTitles, ['Beta', 'Gamma']);
    assert.strictEqual(r.hiddenInRail, 'none');
    assert.ok(r.sidebarIsAfterRail);
  });
  await test('clicking a server in the sidebar navigates through the real rail button', async () => {
    await page.evaluate(() => document.querySelectorAll('.ym-bf-sidebar .rail-item:not(.ym-bf-head)')[1].click());
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.Store.getState().activeServerId), 's3');
    const active = await page.evaluate(() => [...document.querySelectorAll('.ym-bf-sidebar .rail-item.active')].map((b) => b.title));
    assert.deepStrictEqual(active, ['Gamma']);
  });
  await test('closing the folder removes the sidebar', async () => {
    await page.evaluate(() => document.querySelector('.ym-bf-sidebar .ym-bf-head').click());
    await sleep(300);
    assert.deepStrictEqual(await openFolders(), []);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.ym-bf-sidebar')), false);
  });
  await test('closeOthers: opening a second folder closes the first', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('BetterFolders').settings.set('closeOthers', true));
    await page.evaluate(() => document.querySelector('[data-rail-row="f:F1"] button.rail-folder').click());
    await sleep(150);
    await page.evaluate(() => document.querySelector('[data-rail-row="f:F2"] button.rail-folder').click());
    await sleep(400);
    assert.deepStrictEqual(await openFolders(), ['F2']);
    await page.evaluate(() => { window.YapperMod.plugins.get('BetterFolders').settings.set('closeOthers', false); window.__fx.open.clear(); window.__fx.render(); });
  });
  await test('forceOpen: switching to a server inside a closed folder opens it', async () => {
    await page.evaluate(() => { window.YapperMod.plugins.get('BetterFolders').settings.set('forceOpen', true); window.YapperMod.Store.setState({ activeServerId: 's1' }); });
    await sleep(100);
    await page.evaluate(() => window.YapperMod.Store.setState({ activeServerId: 's2' }));
    await sleep(400);
    assert.deepStrictEqual(await openFolders(), ['F1']);
  });
  await test('closeAllFolders: picking a server outside folders closes everything', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('BetterFolders').settings.set('closeAllFolders', true));
    await page.evaluate(() => window.YapperMod.Store.setState({ activeServerId: 's1' }));
    await sleep(400);
    assert.deepStrictEqual(await openFolders(), []);
  });
  await test('closeAllHomeButton: the home button closes all folders', async () => {
    await page.evaluate(() => { const b = window.YapperMod.plugins.get('BetterFolders').settings; b.set('closeAllFolders', false); b.set('closeAllHomeButton', true); document.querySelector('[data-rail-row="f:F1"] button.rail-folder').click(); });
    await sleep(200);
    assert.deepStrictEqual(await openFolders(), ['F1']);
    await page.evaluate(() => document.querySelector('button[title="Direct messages"]').click());
    await sleep(300);
    assert.deepStrictEqual(await openFolders(), []);
  });

  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
  if (errs.length) console.log('console errors from YapperMod:', errs.slice(0, 8));
  await site.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
