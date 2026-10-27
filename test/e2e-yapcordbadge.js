'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const patches = [];
  const site = await openSite({ initial: { settings: { plugins: {} } } });
  const { page } = site;
  await page.route('**/rest/v1/profiles**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const patch = JSON.parse(route.request().postData() || '{}');
    patches.push(patch);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'me', ...patch }) });
  });
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.Store.setState({
      userId: 'me',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik', bio: 'Hey, I like cats', banner_x: 12, banner_y: 34 },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy', bio: 'uses yapcord too​‌​‍' },
        u3: { id: 'u3', username: 'alex', display_name: 'Alex', bio: 'just a regular bio' },
      },
      channels: { c1: { id: 'c1', kind: 'dm', server_id: null } },
      activeChannelId: 'c1',
      messages: { c1: [] },
    });
    const main = document.createElement('main');
    main.id = 'fxyb';
    main.style.cssText = 'position:fixed;left:0;top:0;width:600px;z-index:99998;background:#222329;padding:10px';
    document.body.append(main);
    window.__addRow = (id, authorId, name) => {
      const el = document.createElement('div');
      el.className = 'msg';
      el.dataset.messageId = id;
      el.innerHTML = `<div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><span class="msg-author">${name}</span><span class="msg-time">9:00</span></div><div class="msg-text">hi</div></div>`;
      document.getElementById('fxyb').append(el);
      YM.Store.setState((s) => ({ messages: { ...s.messages, c1: [...s.messages.c1, { id, channel_id: 'c1', author_id: authorId, content: 'hi', created_at: new Date().toISOString() }] } }));
    };
  });

  await sleep(600);

  console.log('YapCordBadge');
  await test('always-on: no entry in the Plugins page, but it is running', async () => {
    const r = await page.evaluate(() => ({ alwaysOn: window.YapperMod.plugins.get('YapCordBadge').alwaysOn, running: window.YapperMod.plugins.isRunning('YapCordBadge') }));
    assert.deepStrictEqual(r, { alwaysOn: true, running: true });
  });
  await test('adds the marker to the end of its bio once signed in, keeping the original text intact', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('YapCordBadge').api.retry());
    await sleep(150);
    const r = await page.evaluate(() => ({ bio: window.YapperMod.Store.getState().profiles.me.bio }));
    assert.strictEqual(patches.length, 1);
    assert.ok(r.bio.startsWith('Hey, I like cats'), 'original text preserved: ' + JSON.stringify(r.bio));
    assert.ok(r.bio.includes('​‌​‍'), 'marker present');
  });
  await test('username and banner position are sent through completely unchanged', async () => {
    assert.strictEqual(patches[0].username, 'tarik');
    assert.strictEqual(patches[0].banner_x, 12);
    assert.strictEqual(patches[0].banner_y, 34);
  });
  await test('does not add it twice: calling it again when the marker is already there is a no-op', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('YapCordBadge').api.retry());
    await sleep(100);
    assert.strictEqual(patches.length, 1, 'retry() did not PATCH the profile again');
  });
  await test('a bio too full to fit the marker is left completely untouched, not truncated', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const st = YM.Store.getState();
      YM.Store.setState({ profiles: { ...st.profiles, me: { ...st.profiles.me, bio: 'x'.repeat(189) } } });
    });
    await page.evaluate(() => window.YapperMod.plugins.get('YapCordBadge').api.retry());
    await sleep(100);
    const r = await page.evaluate(() => ({ bio: window.YapperMod.Store.getState().profiles.me.bio, status: window.YapperMod.plugins.get('YapCordBadge').settings.store.lastStatus }));
    assert.strictEqual(r.bio, 'x'.repeat(189), 'bio left exactly as it was - nothing cut off to make room');
    assert.strictEqual(patches.length, 1, 'no PATCH attempted when there is no room');
    assert.ok(/too full/.test(r.status), 'status explains why: ' + r.status);
  });
  await test('a badge shows next to a message author whose bio already carries the marker', async () => {
    await page.evaluate(() => window.__addRow('m1', 'u2', 'Sammy'));
    await sleep(150);
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-message-id=m1] .msg-head .ym-yb-badge');
      return { present: !!el, title: el && el.title };
    });
    assert.ok(r.present);
    assert.strictEqual(r.title, 'Also uses YapCord');
  });
  await test('no badge for a message author whose bio has no marker', async () => {
    await page.evaluate(() => window.__addRow('m2', 'u3', 'Alex'));
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('[data-message-id=m2] .msg-head .ym-yb-badge')), false);
  });
  await test('a profile gaining the marker later picks up a badge without a new message', async () => {
    await page.evaluate(() => {
      const YM = window.YapperMod;
      const st = YM.Store.getState();
      YM.Store.setState({ profiles: { ...st.profiles, u3: { ...st.profiles.u3, bio: st.profiles.u3.bio + '​‌​‍' } } });
    });
    await sleep(250);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('[data-message-id=m2] .msg-head .ym-yb-badge')), true);
  });
  await test('removeFromBio() takes the marker back out and the own-message badge disappears with it', async () => {

    await page.evaluate(() => {
      const YM = window.YapperMod;
      const st = YM.Store.getState();
      YM.Store.setState({ profiles: { ...st.profiles, me: { ...st.profiles.me, bio: 'Hey, I like cats​‌​‍' } } });
    });
    await page.evaluate(() => window.__addRow('m3', 'me', 'Tarik'));
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('[data-message-id=m3] .msg-head .ym-yb-badge')), true, 'my own messages carry the badge too, same as anyone else\'s');
    await page.evaluate(() => window.YapperMod.plugins.get('YapCordBadge').api.removeFromBio());
    await sleep(250);
    const r = await page.evaluate(() => ({ bio: window.YapperMod.Store.getState().profiles.me.bio, badge: !!document.querySelector('[data-message-id=m3] .msg-head .ym-yb-badge') }));
    assert.strictEqual(r.bio, 'Hey, I like cats', 'marker removed, original text intact');
    assert.strictEqual(r.badge, false);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
