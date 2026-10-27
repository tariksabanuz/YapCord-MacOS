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

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    YM.Store.setState({
      userId: 'me',
      activeServerId: 's-other',
      profiles: { me: { id: 'me', username: 'tarik', display_name: 'Tarik' } },
      servers: {
        's-mine': { id: 's-mine', name: 'My Own Server', owner_id: 'me', created_at: '2026-01-02T10:00:00Z' },

      },
      emojis: {
        e1: { id: 'e1', name: 'blob', path: 'e1/blob.png', server_id: 's-mine' },
        e2: { id: 'e2', name: 'ghost', path: 'e2/ghost.png', server_id: 's-unknown' },
      },
    });
    const app = document.createElement('div');
    app.id = 'fx-ep';
    app.style.cssText = 'position:fixed;left:0;top:0;width:700px;height:300px;z-index:10;background:#1a1b20';
    app.innerHTML = '<div class="msg" data-message-id="m1"><div class="msg-text">'
      + '<img class="emoji" id="custom1" src="https://x.supabase.co/storage/v1/object/public/emojis/e1/blob.png" alt=":blob:">'
      + '<img class="emoji" id="custom2" src="https://x.supabase.co/storage/v1/object/public/emojis/e2/ghost.png" alt=":ghost:">'
      + '<img class="emoji std" id="std1" src="https://x.supabase.co/storage/v1/object/public/std/1f600.png" alt="\u{1F600}">'
      + '</div></div>';
    document.body.append(app);
  });
  await sleep(150);

  const modalText = () => page.evaluate(() => {
    const card = document.querySelector('.ym-modal-card');
    if (!card) return null;
    return { title: card.querySelector('.ym-modal-head h2').textContent, body: card.querySelector('.ym-modal-body').textContent.replace(/\s+/g, ' ').trim(), buttons: [...card.querySelectorAll('.ym-modal-foot button')].map((b) => b.textContent) };
  });
  const closeModal = () => page.evaluate(() => { const b = document.querySelector('.ym-modal-card .ym-modal-foot button:last-child'); if (b) b.click(); });

  await test('clicking a custom emoji whose server you are in shows its name, a preview and a way to go there', async () => {
    await page.click('#custom1');
    await sleep(100);
    const m = await modalText();
    assert.strictEqual(m.title, 'Custom emoji');
    assert.ok(m.body.includes(':blob:'), 'the real name, colon-wrapped');
    assert.ok(m.body.includes('My Own Server'), 'the real server name, not just its id');
    assert.deepStrictEqual(m.buttons, ['Go to My Own Server', 'Close']);
    await closeModal();
  });

  await test('clicking that "Go to" button switches to the real server and closes the modal', async () => {
    await page.click('#custom1');
    await sleep(100);
    await page.click('.ym-modal-card .ym-modal-foot button:first-child');
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.Store.getState().activeServerId), 's-mine');
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('.ym-modal-card')), false, 'the modal itself closed too');
  });

  await test('a custom emoji from a server you are not a member of is honest about that, with nothing to click', async () => {
    await page.click('#custom2');
    await sleep(100);
    const m = await modalText();
    assert.ok(m.body.includes('ghost'), 'still shows what it actually is');
    assert.ok(/not a member|hasn.t loaded/.test(m.body), 'does not pretend an invite is one click away when it cannot actually produce one');
    assert.deepStrictEqual(m.buttons, ['Close'], 'no fabricated "invite" button');
    await closeModal();
  });

  await test('a plain device/Unicode emoji just says "default emoji" - nothing more to show for it', async () => {
    await page.click('#std1');
    await sleep(100);
    const m = await modalText();
    assert.strictEqual(m.title, 'Default emoji');
    await closeModal();
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('EmojiPreview');
      YM.plugins.setEnabled('EmojiPreview', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('EmojiPreview'), err: YM.plugins.errors.get('EmojiPreview') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
