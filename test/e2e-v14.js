'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { openSite } = require('./lib/site');

const SHOTS = process.env.YM_SHOTS || '';
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const deletes = [];
  const site = await openSite({ initial: { settings: { plugins: {} } } });
  const { page } = site;
  await page.route('**/rest/v1/messages**', (route) => {
    const r = route.request();
    if (r.method() === 'DELETE') {
      deletes.push(r.url());
      const id = new URL(r.url()).searchParams.get('id').replace(/^eq\./, '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id, author_id: 'me', attachment_path: null }]) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, true), name);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);

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
      channels: {
        c1: { id: 'c1', kind: 'dm', server_id: null, name: 'Sammy' },
        c2: { id: 'c2', kind: 'dm', server_id: null, name: 'Kim' },
        c3: { id: 'c3', kind: 'dm', server_id: null, name: 'Pat' },
        c4: { id: 'c4', kind: 'dm', server_id: null, name: 'Lee' },
      },
      activeChannelId: 'c1',
      messages: { c1: [
        { id: 'a1', channel_id: 'c1', author_id: 'u2', content: 'hi', created_at: '2026-10-18T09:01:00Z' },
        { id: 'a2', channel_id: 'c1', author_id: 'me', content: 'mine', created_at: '2026-10-18T09:02:00Z' },
        { id: 'a3', channel_id: 'c1', author_id: 'u3', content: 'other', created_at: '2026-10-18T09:03:00Z' },
        { id: 'tmp-9', channel_id: 'c1', author_id: 'me', content: 'sending', pending: true, created_at: '2026-10-18T09:04:00Z' },
      ] },
    });

    const row = (id, author, name) => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"><button class="avatar" style="width:40px;height:40px"></button></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button></div><div class="msg-text">text ${id}</div></div><div class="msg-actions"><button class="icon-btn" aria-label="Reply">r</button></div></div>`;
    const dm = (id, name) => `<button class="chat-row" data-nav-chan="${id}"><span class="chat-row-name">${name}</span></button>`;
    const app = document.createElement('div');
    app.className = 'app';
    app.id = 'fx-app';
    app.style.cssText = 'position:fixed;left:0;top:0;width:820px;height:520px;z-index:10;background:#1a1b20';

    app.innerHTML = '<div class="stage-row" style="display:flex;width:100%;height:100%">'
      + '<nav class="rail" aria-label="Servers"><div class="rail-wrap"><span class="rail-pill on"></span><button class="rail-item big active" aria-label="Direct messages" title="Direct messages"><svg width="24" height="24"><circle cx="12" cy="12" r="10"/></svg><span class="badge">1</span></button></div><div class="rail-sep"></div><div class="rail-wrap"><button class="rail-item" title="Server A">A</button></div></nav>'
      + '<div class="stage" style="display:flex;flex:1;min-width:0">'
      + '<aside class="sidebar"><div class="sidebar-head"><b>Direct messages</b></div><div class="sidebar-scroll"><div class="section-label">Direct messages</div>' + dm('c1', 'Sammy') + dm('c2', 'Kim') + dm('c3', 'Pat') + dm('c4', 'Lee') + '</div></aside>'
      + '<main class="main" style="flex:1;min-width:0;overflow:hidden">' + row('a1', 'u2', 'Sammy') + row('a2', 'me', 'Tarik') + row('a3', 'u3', 'Kim') + row('tmp-9', 'me', 'Tarik') + '</main>'
      + '</div></div>';
    document.body.append(app);
  });
  await sleep(200);

  console.log('PinDMs');
  const rowOrder = () => page.evaluate(() => [...document.querySelectorAll('.sidebar-scroll > *')]
    .map((n) => ({ t: n.getBoundingClientRect().top, id: n.getAttribute('data-nav-chan') || (n.classList.contains('ym-pin-label') ? '[pinned]' : '[label]') }))
    .sort((a, b) => a.t - b.t).map((x) => x.id));
  await test('nothing pinned: Yapper\'s own list, untouched (no extra label, no CSS)', async () => {
    await enable('PinDMs');
    await sleep(300);
    const r = await page.evaluate(() => ({ label: document.querySelectorAll('.ym-pin-label').length, tagged: document.querySelectorAll('[data-ym-dm-list]').length, css: (document.getElementById('ym-style-plugin-PinDMs-order') || {}).textContent }));
    assert.deepStrictEqual(r, { label: 0, tagged: 1, css: '' });
    assert.deepStrictEqual(await rowOrder(), ['[label]', 'c1', 'c2', 'c3', 'c4']);
  });

  const injectCtxMenu = () => page.evaluate(() => {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.id = 'ovl-pindms';
    o.innerHTML = '<div class="ctx-menu" role="menu"><button role="menuitem"><span>Mark as read</span></button></div>';
    document.body.append(o);
  });
  const removeCtxMenu = () => page.evaluate(() => { const o = document.getElementById('ovl-pindms'); if (o) o.remove(); });

  await test('right-click a chat -> Yapper\'s own menu gets "Pin chat" added, which pins it to the top under a "Pinned" heading', async () => {
    await page.click('.chat-row[data-nav-chan="c3"]', { button: 'right' });
    await injectCtxMenu();
    await page.waitForSelector('.ym-pin-menu-item', { timeout: 3000 });
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-pin-menu-item .menu-label').textContent), 'Pin chat');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ctx-menu').firstElementChild.className), 'ym-pin-menu-item', 'added at the top, next to Yapper\'s own items');
    await page.click('.ym-pin-menu-item');
    await sleep(300);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.plugins.get('PinDMs').settings.store.pinned), ['c3']);
    assert.deepStrictEqual(await rowOrder(), ['[pinned]', 'c3', '[label]', 'c1', 'c2', 'c4']);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-pin-label').textContent), 'Pinned');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.chat-row[data-nav-chan="c3"]').hasAttribute('data-ym-pinned')), true);
    await removeCtxMenu();
  });

  await test('pin order follows the order you pinned; the unread/mute buttons of Yapper are not touched', async () => {
    await page.click('.chat-row[data-nav-chan="c4"]', { button: 'right' });
    await injectCtxMenu();
    await page.waitForSelector('.ym-pin-menu-item');
    await page.click('.ym-pin-menu-item');
    await sleep(300);
    assert.deepStrictEqual(await rowOrder(), ['[pinned]', 'c3', 'c4', '[label]', 'c1', 'c2']);
    const dom = await page.evaluate(() => [...document.querySelectorAll('.sidebar-scroll > .chat-row')].map((n) => n.getAttribute('data-nav-chan')));
    assert.deepStrictEqual(dom, ['c1', 'c2', 'c3', 'c4'], 'the DOM order is still Yapper\'s (only CSS reorders)');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'pindms.png'), clip: { x: 0, y: 0, width: 820, height: 520 } });
    await removeCtxMenu();
  });

  await test('right-click a pinned chat offers "Unpin chat"; unpinning the last one removes the heading', async () => {
    await page.click('.chat-row[data-nav-chan="c3"]', { button: 'right' });
    await injectCtxMenu();
    await page.waitForSelector('.ym-pin-menu-item');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-pin-menu-item .menu-label').textContent), 'Unpin chat');
    await page.click('.ym-pin-menu-item');
    await sleep(200);
    assert.deepStrictEqual(await rowOrder(), ['[pinned]', 'c4', '[label]', 'c1', 'c2', 'c3']);
    await removeCtxMenu();
    await page.click('.chat-row[data-nav-chan="c4"]', { button: 'right' });
    await injectCtxMenu();
    await page.waitForSelector('.ym-pin-menu-item');
    await page.click('.ym-pin-menu-item');
    await sleep(200);
    assert.deepStrictEqual(await rowOrder(), ['[label]', 'c1', 'c2', 'c3', 'c4']);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pin-label').length), 0);
    await removeCtxMenu();
  });

  await test('no menu ever appears -> nothing of ours shows either, and the real browser context menu is left alone (no preventDefault)', async () => {
    const prevented = await page.evaluate(() => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector('.chat-row[data-nav-chan="c1"]').dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    assert.strictEqual(prevented, false, 'PinDMs never calls preventDefault any more - Yapper\'s own menu logic decides what happens');
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pin-menu-item').length), 0, 'nothing appended - no .ctx-menu ever showed up to append to');
  });

  await test('a right-click outside the DM list never gets our item, even if a menu happens to open', async () => {
    await page.click('main.main .msg-text', { button: 'right' });
    await injectCtxMenu();
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-pin-menu-item').length), 0);
    await removeCtxMenu();
  });

  await test('the option list shows the names, moves and unpins; bad stored values are ignored', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const p = YM.plugins.get('PinDMs');
      p.settings.set('pinned', ['c1', 'c2', 'c1', '', 7, null, 'c4']);
      const api = p.api;
      const norm = api.normalise(p.settings.store.pinned);
      const box = document.createElement('div');
      document.body.append(box);
      p.options.pinned.render(box, p);
      const names = () => [...box.querySelectorAll('.ym-pin-name')].map((n) => n.textContent);
      const out = { norm, names: names() };
      [...box.querySelectorAll('button')].find((b) => b.title === 'Move down').click();
      out.afterDown = names();
      [...box.querySelectorAll('.ym-pin-item')][0].querySelectorAll('button')[2].click();
      out.afterUnpin = names();
      p.settings.set('pinned', []);
      out.empty = box.querySelector('.hint')?.textContent;
      box.remove();
      return out;
    });
    assert.deepStrictEqual(r.norm, ['c1', 'c2', 'c4']);
    assert.deepStrictEqual(r.names, ['Sammy', 'Kim', 'Lee']);
    assert.deepStrictEqual(r.afterDown, ['Kim', 'Sammy', 'Lee']);
    assert.deepStrictEqual(r.afterUnpin, ['Sammy', 'Lee']);
    assert.ok(/Nothing pinned yet/.test(r.empty));
  });

  await test('cssFor escapes odd ids and unpinning everything removes the label, tags and CSS (PinDMs is always on, so there is no disable to test)', async () => {
    const css = await page.evaluate(() => window.YapperMod.plugins.get('PinDMs').api.cssFor(['a"]{x', 'b']));
    assert.ok(css.includes('data-nav-chan="a\\"]{x"'), css);
    assert.ok(!/data-nav-chan="a"\]/.test(css));
    await page.evaluate(() => window.YapperMod.plugins.get('PinDMs').settings.set('pinned', ['c2']));
    await sleep(200);
    await page.evaluate(() => window.YapperMod.plugins.get('PinDMs').settings.set('pinned', []));
    await sleep(200);
    const r = await page.evaluate(() => ({ label: document.querySelectorAll('.ym-pin-label').length, tag: document.querySelectorAll('[data-ym-pinned]').length, css: (document.getElementById('ym-style-plugin-PinDMs-order') || {}).textContent }));
    assert.deepStrictEqual(r, { label: 0, tag: 0, css: '' });
    assert.deepStrictEqual(await rowOrder(), ['[label]', 'c1', 'c2', 'c3', 'c4']);
  });

  console.log('CustomIcons');
  const HOME = 'button.rail-item[aria-label="Direct messages"]';
  await test('a picture for the Home button replaces the logo (and the badge stays); removing it brings the logo back', async () => {
    await enable('CustomIcons');
    const url = 'data:image/png;base64,' + RED_PNG;
    await page.evaluate((u) => window.YapperMod.plugins.get('CustomIcons').settings.set('homeIcon', u), url);
    await sleep(300);
    const r = await page.evaluate((sel) => {
      const b = document.querySelector(sel);
      const img = b.querySelector('img.ym-home-icon');
      return { img: !!img, src: img && img.getAttribute('src').slice(0, 22), flag: b.hasAttribute('data-ym-home'), svgShown: getComputedStyle(b.querySelector('svg')).display, badge: b.querySelector('.badge').textContent, imgShown: img && getComputedStyle(img).display };
    }, HOME);
    assert.deepStrictEqual(r, { img: true, src: 'data:image/png;base64,', flag: true, svgShown: 'none', badge: '1', imgShown: 'block' });
    await page.evaluate(() => window.YapperMod.plugins.get('CustomIcons').settings.set('homeIcon', ''));
    await sleep(200);
    const back = await page.evaluate((sel) => { const b = document.querySelector(sel); return { img: b.querySelectorAll('img.ym-home-icon').length, flag: b.hasAttribute('data-ym-home'), svg: getComputedStyle(b.querySelector('svg')).display }; }, HOME);
    assert.deepStrictEqual([back.img, back.flag, back.svg !== 'none'], [0, false, true]);
  });

  await test('it survives Yapper re-rendering the button, ignores values that are not pictures, and cleans up on disable', async () => {
    const url = 'data:image/png;base64,' + RED_PNG;
    await page.evaluate((u) => window.YapperMod.plugins.get('CustomIcons').settings.set('homeIcon', u), url);
    await sleep(200);
    await page.evaluate((sel) => { const b = document.querySelector(sel); b.querySelector('img.ym-home-icon').remove(); b.removeAttribute('data-ym-home'); }, HOME);
    await sleep(300);
    assert.strictEqual(await page.evaluate((sel) => document.querySelectorAll(sel + ' img.ym-home-icon').length, HOME), 1, 'put back after a re-render');
    await page.evaluate(() => window.YapperMod.plugins.get('CustomIcons').settings.set('homeIcon', 'javascript:alert(1)'));
    await sleep(200);
    assert.strictEqual(await page.evaluate((sel) => document.querySelectorAll(sel + ' img.ym-home-icon').length, HOME), 0);
    await page.evaluate((u) => window.YapperMod.plugins.get('CustomIcons').settings.set('homeIcon', u), url);
    await sleep(200);
    await disable('CustomIcons');
    const r = await page.evaluate((sel) => ({ img: document.querySelectorAll('img.ym-home-icon').length, flag: document.querySelector(sel).hasAttribute('data-ym-home') }), HOME);
    assert.deepStrictEqual(r, { img: 0, flag: false });
    await page.evaluate(() => window.YapperMod.settings.set('plugins.CustomIcons.homeIcon', ''));
  });

  await test('the option row: choosing a picture file makes a 128 px square PNG and saves it; "Remove" clears it', async () => {
    await enable('CustomIcons');
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'fx-icons';
      box.style.cssText = 'position:fixed;left:830px;top:0;width:500px;z-index:99999;background:#222';
      document.body.append(box);
      const p = window.YapperMod.plugins.get('CustomIcons');
      p.options.homeIcon.render(box, p);
    });
    const input = page.locator('#fx-icons input[type=file]');
    await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(RED_PNG, 'base64') });
    await sleep(600);
    const r = await page.evaluate(async () => {
      const url = window.YapperMod.plugins.get('CustomIcons').settings.store.homeIcon;
      const img = new Image();
      img.src = url;
      await img.decode();
      return { prefix: url.slice(0, 22), w: img.naturalWidth, h: img.naturalHeight, home: document.querySelectorAll('button.rail-item[aria-label="Direct messages"] img.ym-home-icon').length, preview: !!document.querySelector('#fx-icons .ym-icon-preview').getAttribute('src') };
    });
    assert.deepStrictEqual(r, { prefix: 'data:image/png;base64,', w: 128, h: 128, home: 1, preview: true });
    await page.evaluate(() => [...document.querySelectorAll('#fx-icons button')].find((b) => b.textContent === 'Remove').click());
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('CustomIcons').settings.store.homeIcon), '');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('img.ym-home-icon').length), 0);
  });

  await test('a file that is not a picture is refused with a message and nothing is saved', async () => {
    await page.locator('#fx-icons input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await sleep(300);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('CustomIcons').settings.store.homeIcon), '');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.ym-toast-error')].some((t) => /not a picture/.test(t.textContent))));
  });

  await test('the app icon row says it needs the app outside the app, and talks to the main process inside it', async () => {
    const outside = await page.evaluate(() => {
      const p = window.YapperMod.plugins.get('CustomIcons');
      const box = document.createElement('div');
      p.options.appIcon.render(box, p);
      return box.textContent;
    });
    assert.ok(/only be changed inside the app/.test(outside));
    const inside = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const calls = [];
      YM.inApp = true;
      YM.native.icon = { state: async () => ({ preview: '', custom: false }), setApp: async (u) => { calls.push(['set', u.slice(0, 11)]); return { ok: true }; }, clearApp: async () => { calls.push(['clear']); return { ok: true }; } };
      const p = YM.plugins.get('CustomIcons');
      const box = document.createElement('div');
      document.body.append(box);
      p.options.appIcon.render(box, p);
      const input = box.querySelector('input[type=file]');
      const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'a.png', { type: 'image/png' }));
      input.files = dt.files; input.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 400));
      [...box.querySelectorAll('button')].find((b) => /original/.test(b.textContent)).disabled = false;
      [...box.querySelectorAll('button')].find((b) => /original/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 100));
      const text = box.textContent;
      box.remove();
      YM.inApp = false;
      delete YM.native.icon;
      return { calls, text };
    });
    assert.deepStrictEqual(inside.calls, [['set', 'data:image/'], ['clear']]);
    assert.ok(/Back to the original/.test(inside.text));
    await disable('CustomIcons');
  });

  console.log('Layout');
  const rects = () => page.evaluate(() => {
    const L = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width) }; };
    return { rail: L('#fx-app>.stage-row>nav.rail'), sidebar: L('#fx-app>.stage-row>.stage>aside.sidebar'), main: L('#fx-app>.stage-row>.stage>main.main') };
  });
  const sideOf = (r) => ['rail', 'sidebar', 'main'].sort((a, b) => r[a].left - r[b].left);

  await test("default layout: Yapper's own column order, but YapCord's own shipped sizes DO write real override CSS (sidebarWidth, chatText, messageGap and avatarSize all deliberately differ from Yapper's native values - only railIcon happens to match)", async () => {
    const r = await page.evaluate(() => ({ css: (document.getElementById('ym-style-layout') || {}).textContent, cfg: window.YapperMod.layout.get() }));
    assert.deepStrictEqual(r.cfg.order, ['rail', 'sidebar', 'main']);
    assert.deepStrictEqual(sideOf(await rects()), ['rail', 'sidebar', 'main']);
    assert.ok(r.css.includes('aside.sidebar{width:274px}'), 'default sidebarWidth (274) overrides Yapper\'s native 260: ' + r.css);
    assert.ok(r.css.includes('font-size:calc(1em * 0.90)'), 'default chatText (90) overrides Yapper\'s native 100: ' + r.css);
    assert.ok(r.css.includes('margin-top:6px'), 'default messageGap (40, the bottom of its range) overrides Yapper\'s native 100: ' + r.css);
    assert.ok(r.css.includes('.msg-gutter .avatar{width:38px!important;height:38px!important}'), 'default avatarSize (38) overrides Yapper\'s native 40: ' + r.css);
    assert.ok(!r.css.includes('rail{width:'), 'default railIcon (48) happens to equal Yapper\'s native 48, so no rail-size override is written at all');
  });

  await test('servers on the right: the rail moves to the right edge and the border of the channel list flips', async () => {
    await page.evaluate(() => window.YapperMod.layout.set('order', ['sidebar', 'main', 'rail']));
    await sleep(100);
    assert.deepStrictEqual(sideOf(await rects()), ['sidebar', 'main', 'rail']);
    const r = await page.evaluate(() => {
      const css = document.getElementById('ym-style-layout').textContent;
      const rail = document.querySelector('#fx-app>.stage-row>nav.rail').getBoundingClientRect();
      return { css: css.slice(0, 40), railRight: Math.round(rail.right), pill: getComputedStyle(document.querySelector('.rail-pill')).right };
    });
    assert.ok(r.css.startsWith('@media (min-width:761px)'));
    assert.strictEqual(r.railRight, 820);
    assert.strictEqual(r.pill, '-12px');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'layout-rail-right.png'), clip: { x: 0, y: 0, width: 820, height: 520 } });
  });

  await test('Mirrored and "Channels on the right" order the columns as named', async () => {
    await page.evaluate(() => window.YapperMod.layout.set('order', ['main', 'sidebar', 'rail']));
    await sleep(100);
    assert.deepStrictEqual(sideOf(await rects()), ['main', 'sidebar', 'rail']);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#fx-app>.stage-row>.stage>aside.sidebar')).borderLeftWidth), '1px');
    await page.evaluate(() => window.YapperMod.layout.set('order', ['rail', 'main', 'sidebar']));
    await sleep(100);
    assert.deepStrictEqual(sideOf(await rects()), ['rail', 'main', 'sidebar']);
  });

  await test('a narrow window keeps Yapper\'s own column order (the CSS is only for wide windows)', async () => {
    await page.setViewportSize({ width: 700, height: 700 });
    await sleep(100);
    const order = await page.evaluate(() => ['#fx-app>.stage-row>nav.rail', '#fx-app>.stage-row>.stage>aside.sidebar', '#fx-app>.stage-row>.stage>main.main'].map((s) => getComputedStyle(document.querySelector(s)).order));
    assert.deepStrictEqual(order, ['0', '0', '0']);
    await page.setViewportSize({ width: 1400, height: 900 });
    await sleep(100);
  });

  await test('sizes: server icons, list width, chat text, message spacing and avatar size; values are clamped', async () => {
    const r = await page.evaluate(() => {
      const L = window.YapperMod.layout;
      L.reset();
      L.set('railIcon', 60); L.set('sidebarWidth', 320); L.set('chatText', 120); L.set('messageGap', 150); L.set('avatarSize', 56);
      const item = document.querySelector('#fx-app .rail-item:not(.big)').getBoundingClientRect();
      const side = document.querySelector('#fx-app>.stage-row>.stage>aside.sidebar').getBoundingClientRect();

      const avatar = document.querySelector('#fx-app .msg-gutter .avatar').getBoundingClientRect();
      L.set('railIcon', 5); L.set('sidebarWidth', 9999); L.set('zoom', 1);
      return { item: Math.round(item.width), side: Math.round(side.width), avatar: Math.round(avatar.width), fontScale: document.getElementById('ym-style-layout').textContent.includes('font-size:calc(1em * 1.20)'), gap: document.getElementById('ym-style-layout').textContent.includes('margin-top:21px'), clamped: L.get() };
    });
    assert.strictEqual(r.item, 60);
    assert.strictEqual(r.side, 320);
    assert.strictEqual(r.avatar, 56);
    assert.ok(r.fontScale && r.gap);
    assert.deepStrictEqual([r.clamped.railIcon, r.clamped.sidebarWidth, r.clamped.zoom], [36, 420, 70]);
    await page.evaluate(() => window.YapperMod.layout.set('avatarSize', 40));
  });

  await test('reset puts everything back, and the layout is saved to the settings (debounced)', async () => {
    await page.evaluate(() => window.YapperMod.layout.set('order', ['sidebar', 'main', 'rail']));
    await sleep(500);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.settings.get('layout.order')), ['sidebar', 'main', 'rail']);
    await page.evaluate(() => window.YapperMod.layout.reset());
    await sleep(500);

    assert.ok((await page.evaluate(() => document.getElementById('ym-style-layout').textContent)).includes('aside.sidebar{width:274px}'));
    assert.deepStrictEqual(sideOf(await rects()), ['rail', 'sidebar', 'main']);
    assert.deepStrictEqual(await page.evaluate(() => window.YapperMod.settings.get('layout.order')), ['rail', 'sidebar', 'main']);
  });

  await test('hand-edited or old settings fall back to the defaults', async () => {
    const r = await page.evaluate(() => {
      const L = window.YapperMod.layout;
      return [L.normalise(null), L.normalise({ order: ['rail', 'rail', 'main'], railIcon: 'x', zoom: 500 }), L.normalise({ order: ['main', 'rail', 'sidebar'], messageGap: 80.4 })];
    });

    assert.deepStrictEqual(r[0], { order: ['rail', 'sidebar', 'main'], railIcon: 48, sidebarWidth: 274, zoom: 92, chatText: 90, messageGap: 40, avatarSize: 38 });
    assert.deepStrictEqual([r[1].order, r[1].railIcon, r[1].zoom], [['rail', 'sidebar', 'main'], 48, 160]);
    assert.deepStrictEqual([r[2].order, r[2].messageGap], [['main', 'rail', 'sidebar'], 80]);
  });

  await test('the whole-app zoom goes to the app (only touched once you change it)', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const calls = [];
      YM.native.ui = { setZoom: async (z) => { calls.push(z); return z; } };
      YM.layout.set('railIcon', 50);
      const untouched = calls.slice();
      YM.layout.set('zoom', 120);
      YM.layout.set('zoom', 120);
      YM.layout.set('zoom', 100);
      return { untouched, calls };
    });
    assert.deepStrictEqual(r.untouched, []);
    assert.deepStrictEqual(r.calls, [120, 100]);
    await page.evaluate(() => { window.YapperMod.layout.reset(); window.YapperMod.native.ui = null; });
  });

  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.id = 'fx-settings';
    wrap.style.cssText = 'position:fixed;left:830px;top:0;width:560px;height:700px;z-index:20;overflow:auto;background:#222329';
    wrap.innerHTML = `<div class="user-bar"><button class="icon-btn" aria-label="Settings" title="Settings">gear</button></div>
      <div class="overlay" style="position:static;background:none"><div class="modal"><div class="settings">
        <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" data-k="account">My Account</button></nav>
        <section class="settings-main"><div><h2>My Account</h2><p>React-owned account page</p></div></section>
      </div></div></div>`;
    document.body.append(wrap);
  });
  await sleep(400);
  const openPage = async (id) => { await page.evaluate((i) => document.querySelector('.ym-nav-btn[data-ym-page=' + i + ']').click(), id); await sleep(300); };

  await test('Layout page: preset buttons, move arrows and Reset drive the real layout', async () => {
    await openPage('layout');
    const names = await page.evaluate(() => [...document.querySelectorAll('.ym-lay-tile b')].map((b) => b.textContent));
    assert.deepStrictEqual(names, ['Servers', 'Channels & DMs', 'Chat']);
    await page.evaluate(() => [...document.querySelectorAll('.ym-layout button')].find((b) => b.textContent === 'Servers on the right').click());
    await sleep(150);
    assert.deepStrictEqual(sideOf(await rects()), ['sidebar', 'main', 'rail']);
    assert.deepStrictEqual(await page.evaluate(() => [...document.querySelectorAll('.ym-lay-tile b')].map((b) => b.textContent)), ['Channels & DMs', 'Chat', 'Servers']);
    await page.evaluate(() => document.querySelector('button[aria-label="Move Chat left"]').click());
    await sleep(150);
    assert.deepStrictEqual(sideOf(await rects()), ['main', 'sidebar', 'rail']);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-lay-tile button[aria-label="Move Chat left"]').disabled), true, 'the first column cannot move further left');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-layout.png') });
    await page.evaluate(() => [...document.querySelectorAll('.ym-layout button')].find((b) => b.textContent === 'Reset layout').click());
    await sleep(150);
    assert.deepStrictEqual(sideOf(await rects()), ['rail', 'sidebar', 'main']);
  });

  await test('Layout page: a slider changes its value text and the layout at once; the zoom slider only shows inside the app', async () => {
    const text = await page.evaluate(() => document.querySelector('.ym-layout').textContent);
    assert.ok(!/\[object|null|undefined/.test(text), 'no stray text on the page: ' + text.slice(0, 200));
    const r = await page.evaluate(async () => {
      const slider = (label) => document.querySelector('input.ym-range[aria-label="' + label + '"]');
      const s = slider('Channel / DM list width');

      const pctOnLoad = s.style.getPropertyValue('--ym-pct');
      s.value = '300'; s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
      const side = Math.round(document.querySelector('#fx-app>.stage-row>.stage>aside.sidebar').getBoundingClientRect().width);
      const out = [...document.querySelectorAll('.ym-lay-head')].find((h) => /Channel/.test(h.textContent)).querySelector('.ym-lay-val').textContent;
      return { side, out, zoom: !!slider('Whole app size (zoom)'), count: document.querySelectorAll('input.ym-range').length, pctOnLoad, pctAfter: s.style.getPropertyValue('--ym-pct') };
    });
    assert.deepStrictEqual({ side: r.side, out: r.out, zoom: r.zoom, count: r.count }, { side: 300, out: '300 px', zoom: false, count: 4 });
    assert.ok(/^\d+(\.\d+)?%$/.test(r.pctOnLoad), 'slider has a fill percentage on load: ' + r.pctOnLoad);
    assert.strictEqual(r.pctAfter, '45.45%', 'sidebarWidth 300 out of [200,420] fills to 45.45%: ' + r.pctAfter);
    await page.evaluate(() => window.YapperMod.layout.reset());
    await page.evaluate(() => { window.YapperMod.native.ui = { setZoom: async () => 1 }; });
    await openPage('plugins');
    await openPage('layout');
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('input.ym-range[aria-label="Whole app size (zoom)"]')), true);
    await page.evaluate(() => { window.YapperMod.native.ui = null; });
  });

  console.log('Updater (background, no settings page)');
  const mockUpdater = () => page.evaluate(() => {
    const YM = window.YapperMod;
    const listeners = new Set();
    const mock = {
      st: { phase: 'idle', current: YM.version, latest: null, repo: 'someone/YapCord', canInstall: true, lastCheck: 0 },
      calls: [],
      next: null,
      async state() { return { ...mock.st }; },
      async check() { mock.calls.push('check'); mock.st = { ...mock.st, ...(mock.next || { phase: 'uptodate' }), lastCheck: Date.now() }; listeners.forEach((f) => f({ ...mock.st })); return { ...mock.st }; },
      async install() { mock.calls.push('install'); mock.st = { ...mock.st, phase: 'ready' }; listeners.forEach((f) => f({ ...mock.st })); return { ...mock.st }; },
      onState(f) { listeners.add(f); return () => listeners.delete(f); },
      emit(s) { mock.st = { ...mock.st, ...s }; listeners.forEach((f) => f({ ...mock.st })); },
    };
    YM.native.updater = mock;
    window.__upd = mock;
  });

  await test('"update ready" message: once per version, with a Restart button, and not when notifications are off', async () => {
    await mockUpdater();
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const seen = () => [...document.querySelectorAll('.ym-toast')].filter((t) => /is ready/.test(t.textContent)).length;
      const stop = YM.settingsUi.announceUpdates(window.__upd);
      window.__upd.emit({ phase: 'ready', latest: '9.9.9', canInstall: true });
      window.__upd.emit({ phase: 'ready', latest: '9.9.9', canInstall: true });
      const once = seen();
      const btn = !!document.querySelector('.ym-toast .ym-toast-btn');
      window.__upd.emit({ phase: 'ready', latest: '10.0.0', canInstall: true });
      const twoVersions = seen();
      YM.settings.set('updater.notify', false);
      window.__upd.emit({ phase: 'ready', latest: '11.0.0', canInstall: true });
      const quiet = seen();
      YM.settings.set('updater.notify', true);
      stop();
      return { once, btn, twoVersions, quiet };
    });
    assert.deepStrictEqual(r, { once: 1, btn: true, twoVersions: 2, quiet: 2 });
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  const errs = site.consoleLog.filter((l) => l.type === 'error' || l.type === 'pageerror').filter((l) => /YapCord|YapperMod|ym-/.test(l.text));
  if (errs.length) console.log('console errors from YapperMod:', errs.slice(0, 8));
  await site.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
