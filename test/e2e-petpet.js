'use strict';

const assert = require('assert');
const zlib = require('zlib');
const path = require('path');
const { openSite } = require('./lib/site');

const SHOTS = process.env.YM_SHOTS || '';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

function png(r, g, b) {
  const crc = (buf) => { let c, crcv = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crcv ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return (crcv ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: 8 }, () => Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array.from({ length: 8 }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: { PetPet: { enabled: true } } } } });
  const { page } = site;
  let avatarBlocked = false;
  await page.route('**/avatars/**', (route) => (avatarBlocked ? route.abort('blockedbyclient') : route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png(20, 200, 40) })));
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady && window.YapperMod.plugins.isRunning('PetPet'), null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const fx = document.createElement('div');
    fx.id = 'fx';
    fx.innerHTML = '<div class="composer" style="position:relative;margin-top:300px;padding:0 16px 20px"><div class="composer-box"><button class="icon-btn upload-btn">+</button><input type="file" hidden multiple><textarea rows="1" style="width:420px"></textarea></div></div>';
    document.body.append(fx);
    window.__files = [];
    window.__reached = 0;
    document.querySelector('.composer input[type=file]').addEventListener('change', (e) => { window.__files.push(...e.target.files); });
    document.querySelector('.composer textarea').addEventListener('keydown', () => { window.__reached++; });
    const state = {
      userId: 'me', activeServerId: 's1', activeChannelId: 'c1',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'Alice', display_name: 'Ali the Great', avatar_path: 'u2/avatar.png' },
        u3: { id: 'u3', username: 'bob', display_name: null },
        u4: { id: 'u4', username: 'carol', display_name: 'Carol' },
        far: { id: 'far', username: 'faraway', display_name: 'Far' },
      },
      serverMembers: { s1: ['u2', 'u3'] },
      messages: { c1: [{ author_id: 'u4' }] },
    };
    YM.Store.getState = () => state;
  });
  await sleep(200);

  const type = async (text) => { await page.focus('.composer textarea'); await page.evaluate((t) => { const ta = document.querySelector('.composer textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, text); await sleep(60); };
  const taValue = () => page.evaluate(() => document.querySelector('.composer textarea').value);
  const menuVisible = () => page.evaluate(() => !!document.querySelector('.composer > .ym-cmd-menu'));
  const files = () => page.evaluate(() => window.__files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('.ym-toast')].map((t) => t.textContent));

  console.log('command parsing');
  await test('parseCommand, parseArgs, isPartial and pickProfile', async () => {
    const r = await page.evaluate(() => {
      const p = window.YapperMod.plugins.get('PetPet');
      const people = Object.values(window.YapperMod.Store.getState().profiles);
      const byId = (id) => people.find((x) => x.id === id);
      return {
        a: p.parseCommand('/petpet'), b: p.parseCommand('  /PetPet   @alice  '), c: p.parseCommand('/petpets'), d: p.parseCommand('hello /petpet'), e: p.parseCommand('/petpet a\nb'),
        f: p.parseCommand('/petpet user:@alice delay:30 resolution:64'),
        g: p.parseCommand('/petpet url:https://x.test/a:b.png'),
        h: p.parseCommand('/petpet image:"my pic.png" https://x.test/y.png Ali the Great no-server-pfp:true'),
        partial: ['/', '/p', '/pet', '/PETPE', '/petpet', '/petpets', '/x', 'pet'].map((t) => p.isPartial(t)),
        pick: ['@alice', 'alice', 'ali the', 'ali', 'BOB', 'ar', 'rol', '<@u4>', 'nobody', '', '@'].map((q) => (p.pickProfile(q, people, byId) || {}).id || null),
      };
    });
    assert.deepStrictEqual(r.a, { arg: '', options: [], bare: [] });
    assert.deepStrictEqual(r.b, { arg: '@alice', options: [], bare: ['@alice'] });
    assert.strictEqual(r.c, null); assert.strictEqual(r.d, null); assert.strictEqual(r.e, null);
    assert.deepStrictEqual(r.f.options, [{ name: 'user', value: '@alice' }, { name: 'delay', value: '30' }, { name: 'resolution', value: '64' }]);
    assert.deepStrictEqual(r.g.options, [{ name: 'url', value: 'https://x.test/a:b.png' }]);
    assert.deepStrictEqual(r.h.options, [{ name: 'image', value: 'my pic.png' }, { name: 'no-server-pfp', value: 'true' }]);
    assert.deepStrictEqual(r.h.bare, ['https://x.test/y.png', 'Ali', 'the', 'Great']);
    assert.deepStrictEqual(r.partial, [false, true, true, true, false, false, false, false]);
    assert.deepStrictEqual(r.pick, ['u2', 'u2', 'u2', 'u2', 'u3', 'me', 'u4', 'u4', null, null, null]);
  });

  await test('buildPlan: defaults, limits and "only one of the image options"', async () => {
    const r = await page.evaluate(() => {
      const p = window.YapperMod.plugins.get('PetPet');
      const plan = (t) => p.buildPlan(p.parseCommand(t), { delay: 20, resolution: 128 });
      return {
        none: plan('/petpet'), user: plan('/petpet user:@alice delay:50 resolution:64'), bareUser: plan('/petpet @alice'), bareUrl: plan('/petpet https://a.test/x.png'),
        url: plan('/petpet url:https://a.test/x.png'), image: plan('/petpet image:"a b.png"'),
        fast: plan('/petpet delay:10'), slow: plan('/petpet delay:99999'), nan: plan('/petpet delay:abc'),
        small: plan('/petpet resolution:8'), big: plan('/petpet resolution:5000'),
        two: plan('/petpet user:@alice url:https://a.test/x.png'), http: plan('/petpet url:http://a.test/x.png'), empty: plan('/petpet user:'), ignored: plan('/petpet no-server-pfp:true'),
      };
    });
    assert.deepStrictEqual(r.none, { kind: 'self', value: '', delay: 20, resolution: 128 });
    assert.deepStrictEqual(r.user, { kind: 'user', value: '@alice', delay: 50, resolution: 64 });
    assert.deepStrictEqual(r.bareUser, { kind: 'user', value: '@alice', delay: 20, resolution: 128 });
    assert.deepStrictEqual(r.bareUrl, { kind: 'url', value: 'https://a.test/x.png', delay: 20, resolution: 128 });
    assert.deepStrictEqual(r.url, r.bareUrl);
    assert.deepStrictEqual(r.image, { kind: 'image', value: 'a b.png', delay: 20, resolution: 128 });
    assert.strictEqual(r.fast.error, 'Delay must be at least 20.');
    assert.ok(/at most/.test(r.slow.error), r.slow.error);
    assert.ok(/must be a number/.test(r.nan.error), r.nan.error);
    assert.ok(/from 16 to 512/.test(r.small.error) && /from 16 to 512/.test(r.big.error));
    assert.ok(/only specify one of the image options/.test(r.two.error), r.two.error);
    assert.ok(/https:\/\//.test(r.http.error), r.http.error);
    assert.ok(/Say whose avatar/.test(r.empty.error), r.empty.error);
    assert.strictEqual(r.ignored.kind, 'self');
  });

  console.log('suggestion list');
  await test('typing /pe shows the command in Yapper\'s command-list style; other text hides it', async () => {
    await type('/pe');
    assert.strictEqual(await menuVisible(), true);
    const m = await page.evaluate(() => { const el = document.querySelector('.composer > .ym-cmd-menu'); return { head: el.querySelector('.emoji-section').textContent, name: el.querySelector('button span:nth-child(2)').textContent, prefix: el.querySelector('.mention-all').textContent, bot: el.querySelector('.cmd-bot').textContent, pos: getComputedStyle(el).position }; });
    assert.deepStrictEqual(m, { head: 'Commands', name: 'petpet', prefix: '/', bot: 'YapCord', pos: 'absolute' });
    await type('hello');
    assert.strictEqual(await menuVisible(), false);
    await type('/x');
    assert.strictEqual(await menuVisible(), false);
    await type('');
  });

  await test('Tab and Enter complete "/pe" to "/petpet " without sending; clicking the entry does too', async () => {
    await type('/pe');
    await page.keyboard.press('Tab');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet ');
    await type('/pet');
    const before = await page.evaluate(() => window.__reached);
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet ');
    assert.strictEqual(await page.evaluate(() => window.__reached), before, 'Yapper\'s own Enter handler never saw it');
    await type('/p');
    await page.dispatchEvent('.composer > .ym-cmd-menu button', 'mousedown');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet ');
    await type('');
  });

  const rows = () => page.evaluate(() => [...document.querySelectorAll('.composer > .ym-cmd-menu button')].map((b) => ({ text: b.children[0].textContent, desc: (b.querySelector('.cmd-desc') || {}).textContent || '', on: b.classList.contains('on') })));
  const head = () => page.evaluate(() => (document.querySelector('.composer > .ym-cmd-menu .emoji-section') || {}).textContent || null);

  await test('"/petpet " lists Vencord\'s options (delay, resolution, image, url, user) with their descriptions', async () => {
    await type('/petpet ');
    assert.strictEqual(await head(), 'Options');
    const r = await rows();
    assert.deepStrictEqual(r.map((x) => x.text), ['delay', 'resolution', 'image', 'url', 'user']);
    assert.ok(/Rounded to nearest 10ms/.test(r[0].desc) && /URL to fetch image from/.test(r[3].desc) && /avatar/.test(r[4].desc));
    assert.deepStrictEqual(r.map((x) => x.on), [true, false, false, false, false]);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'petpet-options.png') });
    await type('/petpet r');
    assert.deepStrictEqual((await rows()).map((x) => x.text), ['resolution']);
    await type('/petpet zzz');
    assert.strictEqual(await menuVisible(), false);
    await type('');
  });

  await test('arrow keys move the highlight, Tab picks "user:", then the members are listed and Enter picks one', async () => {
    await type('/petpet ');
    await page.keyboard.press('ArrowUp');
    assert.strictEqual((await rows()).findIndex((x) => x.on), 4);
    await page.keyboard.press('Tab');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet user:');
    assert.strictEqual(await head(), 'Members');
    let r = await rows();
    assert.deepStrictEqual(r.map((x) => x.text), ['Tarik', 'Ali the Great', 'bob', 'Carol']);
    assert.strictEqual(r[1].desc, '@Alice');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'petpet-members.png') });
    await type('/petpet user:@ali');
    assert.deepStrictEqual((await rows()).map((x) => x.text), ['Ali the Great']);
    const before = await page.evaluate(() => window.__reached);
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet user:@Alice ');
    assert.strictEqual(await page.evaluate(() => window.__reached), before);
    assert.strictEqual(await head(), 'Options');
    assert.deepStrictEqual((await rows()).map((x) => x.text), ['delay', 'resolution'], 'the other image options are gone once one is used');
    await type('/petpet user:');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.strictEqual(await taValue(), '/petpet user:@bob ');
    await type('');
  });

  await test('a value option shows its description; Escape closes the list', async () => {
    await type('/petpet delay:');
    assert.strictEqual(await head(), 'Options');
    assert.ok(/The delay between each frame/.test(await page.evaluate(() => document.querySelector('.composer > .ym-cmd-menu .ym-cmd-hint').textContent)));
    await type('/petpet ');
    assert.strictEqual(await menuVisible(), true);
    await page.keyboard.press('Escape');
    assert.strictEqual(await menuVisible(), false);
    await type('/petpet d');
    assert.strictEqual(await menuVisible(), true, 'typing again brings it back');
    await type('');
  });

  console.log('making the GIF');

  const decode = (bytes, which) => page.evaluate(async ({ bytes, which }) => {
    const dec = new ImageDecoder({ data: new Uint8Array(bytes), type: 'image/gif' });
    await dec.tracks.ready;
    const track = dec.tracks.selectedTrack;
    const out = { frames: track.frameCount, loop: track.repetitionCount, shots: [] };
    const cv = document.createElement('canvas');
    for (const i of which) {
      const { image } = await dec.decode({ frameIndex: i });
      cv.width = image.displayWidth; cv.height = image.displayHeight;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(image, 0, 0);
      out.shots.push({ i, w: cv.width, h: cv.height, duration: image.duration, data: Array.from(c.getImageData(0, 0, cv.width, cv.height).data) });
      image.close();
    }
    return out;
  }, { bytes, which });
  const expectedFrame = (rgb, S, i) => page.evaluate(async ({ rgb, S, i }) => {
    const hands = await window.YapperMod.plugins.get('PetPet').getHands();
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d', { willReadFrequently: true });
    const j = i < 5 ? i : 10 - i;
    const width = 0.8 + j * 0.02, height = 0.8 - j * 0.05;
    const x = ((1 - width) * 0.5 + 0.1) * S, y = (1 - height - 0.08) * S;
    c.fillStyle = 'rgb(' + rgb.join(',') + ')';
    c.fillRect(x, y, width * S, height * S);
    c.drawImage(hands[i], 0, 0, S, S);
    return Array.from(c.getImageData(0, 0, S, S).data);
  }, { rgb, S, i });
  const compare = (a, b) => {
    let flips = 0, diff = 0, both = 0;
    for (let p = 0; p < a.length; p += 4) {
      const ao = a[p + 3] >= 128, bo = b[p + 3] >= 128;
      if (ao !== bo) { flips++; continue; }
      if (ao) { both++; diff += Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]); }
    }
    return { flips: flips / (a.length / 4), diff: both ? diff / both / 3 : 0, both };
  };

  let gifBytes = null;
  await test('/petpet user:@alice: Enter makes a GIF, attaches it, clears the box and does not send', async () => {
    await type('/petpet user:@Alice');
    const before = await page.evaluate(() => window.__reached);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length > 0, null, { timeout: 8000 });
    const f = await files();
    assert.deepStrictEqual(f.map((x) => [x.name, x.type]), [['petpet.gif', 'image/gif']]);
    assert.ok(f[0].size > 1000 && f[0].size < 400000, 'size ' + f[0].size);
    assert.strictEqual(await taValue(), '');
    assert.strictEqual(await menuVisible(), false);
    assert.strictEqual(await page.evaluate(() => window.__reached), before, 'the Enter was swallowed');
    assert.ok((await toasts()).some((t) => /petpet ready/.test(t)), (await toasts()).join('|'));
    gifBytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__files[0].arrayBuffer())));
    assert.strictEqual(String.fromCharCode(...gifBytes.slice(0, 6)), 'GIF89a');
    if (SHOTS) require('fs').writeFileSync(path.join(SHOTS, 'petpet-sample.gif'), Buffer.from(gifBytes));
  });

  await test('the GIF is Vencord\'s: 10 frames, 128x128, 20 ms each, loops, same avatar box and hand in every frame', async () => {
    const r = await decode(gifBytes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.strictEqual(r.frames, 10);
    assert.ok(r.loop === Infinity || r.loop === 0, 'loops forever: ' + r.loop);
    for (const s of r.shots) {
      assert.deepStrictEqual([s.w, s.h], [128, 128]);
      assert.strictEqual(s.duration, 20000);
      assert.strictEqual(s.data[3], 0, 'the top-left corner is transparent');
      assert.strictEqual(s.data[(127 * 128 + 127) * 4 + 3], 0, 'the bottom-right corner is transparent');
      const want = await expectedFrame([20, 200, 40], 128, s.i);
      const c = compare(s.data, want);
      assert.ok(c.flips < 0.02, 'frame ' + s.i + ': transparent/opaque pixels that differ: ' + (c.flips * 100).toFixed(2) + '%');
      assert.ok(c.diff < 14, 'frame ' + s.i + ': average colour difference ' + c.diff.toFixed(1));
      assert.ok(c.both > 6000, 'frame ' + s.i + ': picture is there: ' + c.both);
    }

    const green = (shot) => { let n = 0; for (let p = 0; p < shot.data.length; p += 4) if (shot.data[p + 3] > 128 && shot.data[p + 1] > 150 && shot.data[p] < 90 && shot.data[p + 2] < 100) n++; return n; };
    assert.ok(green(r.shots[5]) < green(r.shots[0]) * 0.75, 'fewer avatar pixels when pressed down: ' + green(r.shots[0]) + ' vs ' + green(r.shots[5]));
  });

  await test('no argument pets yourself; a name that is not around shows an error and keeps what was typed', async () => {
    await page.evaluate(() => { window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    await sleep(100);
    assert.ok((await toasts()).some((t) => /petpet ready: press Enter/.test(t)), (await toasts()).join('|'));
    await page.evaluate(() => { window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet user:@faraway');
    await page.keyboard.press('Enter');
    await sleep(300);
    assert.deepStrictEqual(await files(), []);
    assert.strictEqual(await taValue(), '/petpet user:@faraway');
    assert.ok((await toasts()).some((t) => /Could not find "faraway"/.test(t)), (await toasts()).join('|'));
  });

  await test('"/petpet @alice" (without user:) still works', async () => {
    await page.evaluate(() => { window.__files.length = 0; });
    await type('/petpet @alice');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    assert.strictEqual(await taValue(), '');
  });

  await test('wrong values show a message and keep the text; nothing is attached', async () => {
    await page.evaluate(() => { window.__files.length = 0; });
    for (const [text, re] of [
      ['/petpet delay:10', /Delay must be at least 20/],
      ['/petpet resolution:5000', /from 16 to 512/],
      ['/petpet user:@alice url:https://a.test/x.png', /only specify one of the image options/],
      ['/petpet url:http://a.test/x.png', /must start with https/],
      ['/petpet image:nothing.png', /Choose the picture again/],
    ]) {
      await page.evaluate(() => document.querySelectorAll('.ym-toast').forEach((t) => t.remove()));
      await type(text);
      await page.keyboard.press('Enter');
      await sleep(250);
      assert.ok((await toasts()).some((t) => re.test(t)), text + ' -> ' + (await toasts()).join('|'));
      assert.strictEqual(await taValue(), text);
    }
    assert.deepStrictEqual(await files(), []);
  });

  await test('url: a picture from the web becomes the pet; a site that does not allow it gives a clear message', async () => {
    const good = png(220, 30, 30);
    await page.route('https://img.example.test/**', (route) => (route.request().url().includes('/blocked')
      ? route.abort('blockedbyclient')
      : route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: good })));
    await page.evaluate(() => { window.__files.length = 0; });
    await type('/petpet url:https://img.example.test/pic.png resolution:64 delay:60');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__files[0].arrayBuffer())));
    const r = await decode(bytes, [0]);
    assert.deepStrictEqual([r.shots[0].w, r.shots[0].duration], [64, 60000]);
    const c = compare(r.shots[0].data, await expectedFrame([220, 30, 30], 64, 0));
    assert.ok(c.flips < 0.03 && c.diff < 16, JSON.stringify(c));
    await page.evaluate(() => { window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet url:https://img.example.test/blocked.png');
    await page.keyboard.press('Enter');
    await sleep(500);
    assert.deepStrictEqual(await files(), []);
    assert.ok((await toasts()).some((t) => /Could not load that picture/.test(t)), (await toasts()).join('|'));
    assert.strictEqual(await taValue(), '/petpet url:https://img.example.test/blocked.png');
  });

  await test('image: the "image" entry opens the file chooser, the chosen picture becomes the pet', async () => {
    await page.evaluate(() => { window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet i');

    await page.waitForFunction(() => { const b = document.querySelector('.composer > .ym-cmd-menu button.on'); return !!b && /^image/.test(b.children[0].textContent); }, null, { timeout: 5000 });
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
    await page.keyboard.press('Tab');
    const fc = await chooser;
    assert.ok(!fc.isMultiple(), 'one picture');
    await fc.setFiles({ name: 'my pic.png', mimeType: 'image/png', buffer: png(30, 60, 220) });
    await page.waitForFunction(() => document.querySelector('.composer textarea').value === '/petpet image:"my pic.png" ', null, { timeout: 8000 });
    assert.strictEqual(await taValue(), '/petpet image:"my pic.png" ');
    assert.deepStrictEqual((await rows()).map((x) => x.text), ['delay', 'resolution']);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__files[0].arrayBuffer())));
    const r = await decode(bytes, [0, 5]);
    for (const s of r.shots) {
      const c = compare(s.data, await expectedFrame([30, 60, 220], 128, s.i));
      assert.ok(c.flips < 0.02 && c.diff < 14, 'frame ' + s.i + ' ' + JSON.stringify(c));
    }
    assert.strictEqual(await taValue(), '');

    await page.evaluate(() => { window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet image:"my pic.png"');
    await page.keyboard.press('Enter');
    await sleep(250);
    assert.ok((await toasts()).some((t) => /Choose the picture again/.test(t)), (await toasts()).join('|'));
  });

  await test('image: inside the app the own file dialog is used (pictures only, one file)', async () => {
    const pngBytes = Array.from(png(240, 200, 20));
    await page.evaluate((bytes) => {
      const YM = window.YapperMod;
      window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove());
      window.__pickCalls = [];
      YM.inApp = true;
      YM.native.files = { pick: async (opts) => { window.__pickCalls.push(opts); return [{ name: 'sun.png', type: 'image/png', lastModified: 1, size: bytes.length, data: new Uint8Array(bytes) }]; } };
    }, pngBytes);
    await type('/petpet im');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__pickCalls.length === 1, null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.composer textarea').value === '/petpet image:sun.png ', null, { timeout: 8000 });
    assert.deepStrictEqual(await page.evaluate(() => window.__pickCalls), [{ accept: 'image/*', multiple: false }]);
    assert.strictEqual(await taValue(), '/petpet image:sun.png ');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__files[0].arrayBuffer())));
    const r = await decode(bytes, [0]);
    const c = compare(r.shots[0].data, await expectedFrame([240, 200, 20], 128, 0));
    assert.ok(c.flips < 0.02 && c.diff < 14, JSON.stringify(c));
    await page.evaluate(() => { const YM = window.YapperMod; YM.inApp = false; YM.native.files = null; });
  });

  await test('a file host that blocks other sites from reading pictures: the app downloads the avatar itself (and without the app, a letter is used)', async () => {
    avatarBlocked = true;
    const pngBytes = Array.from(png(200, 30, 30));
    await page.evaluate((bytes) => {
      const YM = window.YapperMod;
      window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove());
      window.__nativeCalls = [];
      YM.Store.getState().profiles.u2.avatar_path = 'u2/blocked.png';
      YM.inApp = true;
      YM.native.net = { image: async (url) => { window.__nativeCalls.push(url); return { type: 'image/png', data: new Uint8Array(bytes) }; } };
    }, pngBytes);
    await type('/petpet user:@alice');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    const calls = await page.evaluate(() => window.__nativeCalls);
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__files[0].arrayBuffer())));
    const r = await decode(bytes, [0]);
    const c = compare(r.shots[0].data, await expectedFrame([200, 30, 30], 128, 0));
    assert.strictEqual(calls.length, 1);
    assert.ok(/\/avatars\/u2\/blocked\.png$/.test(calls[0]), calls[0]);
    assert.ok(c.flips < 0.02 && c.diff < 14, 'the downloaded (red) avatar is in the GIF: ' + JSON.stringify(c));
    assert.ok(!(await toasts()).some((t) => /letter/.test(t)));

    await page.evaluate(() => { const YM = window.YapperMod; YM.inApp = false; window.__files.length = 0; document.querySelectorAll('.ym-toast').forEach((t) => t.remove()); });
    await type('/petpet user:@alice');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
    await sleep(100);
    assert.ok((await toasts()).some((t) => /letter/.test(t)), (await toasts()).join('|'));
    avatarBlocked = false;
  });

  await test('settings: size and delay are the defaults, the command options override them', async () => {
    await page.evaluate(() => { const p = window.YapperMod.plugins.get('PetPet'); p.settings.set('size', 80); p.settings.set('delay', 100); window.__files.length = 0; });
    const info = async () => {
      await page.waitForFunction(() => window.__files.length === 1, null, { timeout: 8000 });
      return page.evaluate(async () => {
        const bytes = new Uint8Array(await window.__files[0].arrayBuffer());
        const dec = new ImageDecoder({ data: bytes, type: 'image/gif' });
        await dec.tracks.ready;
        const { image } = await dec.decode({ frameIndex: 0 });
        return { w: image.displayWidth, d: image.duration, n: dec.tracks.selectedTrack.frameCount };
      });
    };
    await type('/petpet user:@bob');
    await page.keyboard.press('Enter');
    assert.deepStrictEqual(await info(), { w: 80, d: 100000, n: 10 });
    await page.evaluate(() => { window.__files.length = 0; });
    await type('/petpet user:@bob resolution:48 delay:30');
    await page.keyboard.press('Enter');
    assert.deepStrictEqual(await info(), { w: 48, d: 30000, n: 10 });
    await page.evaluate(() => { const p = window.YapperMod.plugins.get('PetPet'); p.settings.resetAll(); });
  });

  await test('switching the plugin off removes the command and the pop-up', async () => {
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('PetPet', false));
    await page.evaluate(() => { window.__files.length = 0; });
    await type('/pe');
    assert.strictEqual(await menuVisible(), false);
    await type('/petpet user:@bob');
    const before = await page.evaluate(() => window.__reached);
    await page.keyboard.press('Enter');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => window.__reached), before + 1, 'Enter goes to Yapper again');
    assert.deepStrictEqual(await files(), []);
  });

  const bad = site.consoleLog.filter((l) => (l.type === 'error' || l.type === 'pageerror') && /YapCord|YapperMod|PetPet|RangeError/i.test(l.text));
  await test('no unexpected errors in the console', async () => assert.deepStrictEqual(bad.map((b) => b.text.slice(0, 200)), []));

  await site.close();
  const pass = results.filter(Boolean).length;
  console.log('\n' + pass + '/' + results.length + ' passed');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
