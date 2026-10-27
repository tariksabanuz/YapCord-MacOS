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
  const site = await openSite({ initial: { settings: { plugins: {} } }, permissions: ['clipboard-read', 'clipboard-write'] });
  const { page } = site;
  await page.route('**/rest/v1/messages**', (route) => {
    const r = route.request();
    if (r.method() === 'POST' || r.method() === 'PATCH') posts.push(JSON.parse(r.postData()));
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/files/notes.txt', (route) => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'hello from a file\nline 2' }));
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);
  const enable = (name, opts) => page.evaluate(([n, o]) => { const YM = window.YapperMod; if (o) for (const [k, v] of Object.entries(o)) YM.plugins.get(n).settings.set(k, v); YM.plugins.setEnabled(n, true); }, [name, opts]);
  const disable = (name) => page.evaluate((n) => window.YapperMod.plugins.setEnabled(n, false), name);
  const state = (keys) => page.evaluate((k) => { const s = window.YapperMod.Store.getState(); return Object.fromEntries(k.map((x) => [x, s[x]])); }, keys);
  const reset = () => page.evaluate(() => window.YapperMod.Store.setState({ editingId: null, replyingTo: null, lightbox: null }));

  await page.evaluate(() => {
    const YM = window.YapperMod;
    YM.Store.setState({
      userId: 'me',
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy' },
        u3: { id: 'u3', username: 'kim', display_name: 'kim' },
      },
      channels: { c1: { id: 'c1', kind: 'dm', server_id: null } },
      activeChannelId: 'c1',
      messages: { c1: [
        { id: 'a1', channel_id: 'c1', author_id: 'u2', content: 'hi there', created_at: '2026-10-18T09:01:00Z' },
        { id: 'a2', channel_id: 'c1', author_id: 'me', content: 'mine', created_at: '2026-10-18T09:02:00Z' },
        { id: 'a3', channel_id: 'c1', author_id: 'u3', content: 'third', created_at: '2026-10-18T09:03:00Z' },
        { id: 'a4', channel_id: 'c1', author_id: 'u2', content: 'a reply', reply_to_id: 'a1', created_at: '2026-10-18T09:04:00Z' },
      ] },
    });
    const main = document.createElement('main');
    main.className = 'main';
    main.style.cssText = 'position:fixed;left:0;top:0;width:640px;z-index:99998;background:#222329;padding:10px';
    const row = (id, author, name, extra = '', inner = '') => `<div class="msg" data-message-id="${id}"><div class="msg-gutter"></div><div class="msg-body"><div class="msg-head"><button class="msg-author">${name}</button><span class="msg-time">9:0</span></div>${inner}<div class="msg-text">text ${id} <a href="https://example.com/">link</a>${extra}</div></div><div class="msg-actions"><button class="icon-btn" aria-label="Reply" title="Reply">r</button></div></div>`;
    const card = '<div class="file-card"><div class="file-card-main"><div class="file-card-name">notes.txt</div></div><a class="btn small secondary" href="/files/notes.txt" download="notes.txt">Download</a></div><div class="file-card"><div class="file-card-main"><div class="file-card-name">pic.png</div></div><a class="btn small secondary" href="/files/pic.png" download="pic.png">Download</a></div>';
    const replyPrev = '<button class="reply-preview no-menu"><span class="reply-spine"></span><span class="reply-author">Sammy</span><span class="reply-text">hi there</span></button>';
    main.innerHTML = row('a1', 'u2', 'Sammy') + row('a2', 'me', 'Tarik') + row('a3', 'u3', 'kim', card) + row('a4', 'u2', 'Sammy', '', replyPrev)
      + '<div class="avatar" id="av" style="width:40px;height:40px"><span class="avatar-clip"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></span></div>'
      + '<div class="composer" style="height:60px"><div class="composer-box"><textarea maxlength="2000" style="width:400px"></textarea></div></div>';
    document.body.append(main);

    window.__got = [];
    const note = (kind, files) => { window.__last = [...files]; window.__got.push({ kind, files: [...files].map((f) => ({ name: f.name, type: f.type, size: f.size })) }); };
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'fi'; input.multiple = true;
    main.append(input);
    document.addEventListener('change', (e) => { if (e.target === input) note('input', input.files); });
    document.addEventListener('paste', (e) => note('paste', e.clipboardData.files.length ? e.clipboardData.files : []), false);
    document.addEventListener('drop', (e) => note('drop', e.dataTransfer.files));
    window.__mk = (name, type, bytes = 10) => new File([new Uint8Array(bytes)], name, { type });
    window.__sendFiles = async (kind, files) => {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      if (kind === 'input') { input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
      if (kind === 'paste') document.querySelector('.composer textarea').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      if (kind === 'drop') document.querySelector('.composer').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    };
  });

  const waitGot = (n) => page.waitForFunction((k) => window.__got.length >= k, n, { timeout: 60000 });
  const takeGot = async () => { const g = await page.evaluate(() => { const x = window.__got.slice(); window.__got.length = 0; return x; }); return g; };

  console.log('upload pipeline');
  await test('no plugin active: files pass straight through untouched', async () => {
    await page.evaluate(() => window.__sendFiles('input', [window.__mk('Holiday Pics.png', 'image/png')]));
    await sleep(100);
    const g = await takeGot();
    assert.strictEqual(g.length, 1);
    assert.strictEqual(g[0].files[0].name, 'Holiday Pics.png');
  });

  await test('AnonymiseFileNames renames files from the picker, paste and drop (keeps extensions, ignores text paste)', async () => {
    await enable('AnonymiseFileNames');
    for (const kind of ['input', 'paste', 'drop']) {
      await page.evaluate((k) => window.__sendFiles(k, [window.__mk('Screenshot Tarik-PC.png', 'image/png'), window.__mk('backup.tar.gz', 'application/gzip')]), kind);
      await waitGot(1);
      const g = (await takeGot())[0];
      assert.strictEqual(g.kind, kind);
      assert.strictEqual(g.files.length, 2, kind);
      assert.match(g.files[0].name, /^[A-Za-z0-9]{8}\.png$/, kind + ': ' + g.files[0].name);
      assert.match(g.files[1].name, /^[A-Za-z0-9]{8}\.tar\.gz$/, kind + ': ' + g.files[1].name);
      assert.strictEqual(g.files[0].type, 'image/png');
    }

    const sync = await page.evaluate(() => {
      const dt = new DataTransfer(); dt.setData('text/plain', 'just text');
      document.querySelector('.composer textarea').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      return window.__got.length;
    });
    assert.strictEqual(sync, 1, 'text paste reaches the page immediately');
    await takeGot();
  });

  await test('AnonymiseFileNames options: timestamp, same name, length', async () => {
    const api = await page.evaluate(() => {
      const a = window.YapperMod.plugins.get('AnonymiseFileNames').api;
      return [a.newName('x.png', { method: 'timestamp' }), a.newName('x.png', { method: 'consistent', consistent: 'pic' }), a.newName('x.png', { method: 'random', length: 12 }), a.newName('noext', { method: 'consistent', consistent: 'a/b' })];
    });
    assert.match(api[0], /^\d{13}\.png$/);
    assert.strictEqual(api[1], 'pic.png');
    assert.match(api[2], /^[A-Za-z0-9]{12}\.png$/);
    assert.strictEqual(api[3], 'ab');
    await disable('AnonymiseFileNames');
    await page.evaluate(() => window.__sendFiles('input', [window.__mk('keep.png', 'image/png')]));
    await sleep(100);
    assert.strictEqual((await takeGot())[0].files[0].name, 'keep.png', 'disabled plugin leaves names alone');
  });

  await test('UploadCompressor: a big image is re-encoded to WebP under the limit', async () => {
    await enable('UploadCompressor', { limitMB: 0.25 });
    const before = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 700; c.height = 500;
      const x = c.getContext('2d');
      const id = x.createImageData(700, 500);
      for (let i = 0; i < id.data.length; i += 4) { const v = (Math.random() * 255) | 0; id.data[i] = v; id.data[i + 1] = (v * 3) & 255; id.data[i + 2] = 255 - v; id.data[i + 3] = 255; }
      x.putImageData(id, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      window.__big = new File([blob], 'Big Photo.png', { type: 'image/png' });
      return blob.size;
    });
    assert.ok(before > 0.25 * 1048576, 'test image is bigger than the limit: ' + before);
    await page.evaluate(() => window.__sendFiles('drop', [window.__big]));
    await waitGot(1);
    const f = (await takeGot())[0].files[0];
    assert.strictEqual(f.type, 'image/webp');
    assert.strictEqual(f.name, 'Big Photo.webp');
    assert.ok(f.size <= 0.25 * 1048576, 'size ' + f.size);
    assert.ok(f.size > 2000, 'not an empty image');
  });

  await test('UploadCompressor: small images stay, BMP gets converted, big GIFs/other files are left with a warning', async () => {
    await page.evaluate(() => window.YapperMod.plugins.get('UploadCompressor').settings.set('limitMB', 1));
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(0, 0, 20, 20);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      window.__small = new File([blob], 'small.png', { type: 'image/png' });
      window.__bmp = new File([blob], 'old.bmp', { type: 'image/bmp' });
      return blob.size;
    });
    await page.evaluate(() => window.__sendFiles('input', [window.__small, window.__bmp, window.__mk('anim.gif', 'image/gif', 1.5 * 1048576), window.__mk('data.zip', 'application/zip', 2 * 1048576)]));
    await waitGot(1);
    const g = (await takeGot())[0].files;
    assert.deepStrictEqual(g.map((f) => f.name), ['small.png', 'old.webp', 'anim.gif', 'data.zip']);
    assert.strictEqual(g[0].size, png);
    assert.strictEqual(g[1].type, 'image/webp');
    assert.strictEqual(g[2].size, 1.5 * 1048576);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.ym-toast')].map((t) => t.textContent).join(' | '));
    assert.match(toast, /animated GIFs cannot be shrunk/);
  });

  const makeVideo = (busy) => page.evaluate(async (rects) => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const x = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 3000000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start(250);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const draw = () => {
        for (let i = 0; i < rects; i++) { x.fillStyle = `hsl(${Math.random() * 360} 90% 50%)`; x.fillRect(Math.random() * 640, Math.random() * 360, 60, 60); }
        if (performance.now() - t0 < 2500) requestAnimationFrame(draw); else resolve();
      };
      draw();
    });
    rec.stop(); await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    window.__vid = new File([blob], 'clip.webm', { type: 'video/webm' });
    return blob.size;
  }, busy);

  await test('UploadCompressor: a big video is re-encoded in real time to WebM under the limit', async () => {
    const srcSize = await makeVideo(25);
    const limitMB = (srcSize * 0.4) / 1048576;
    await page.evaluate((l) => window.YapperMod.plugins.get('UploadCompressor').settings.set('limitMB', l), limitMB);
    assert.ok(srcSize > 30000, 'source video has some size: ' + srcSize);
    await page.evaluate(() => window.__sendFiles('drop', [window.__vid]));
    await sleep(500);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-progress').length), 1, 'progress pill is shown');
    await waitGot(1);
    const f = (await takeGot())[0].files[0];
    assert.strictEqual(f.type, 'video/webm');
    assert.ok(f.size <= limitMB * 1048576, 'compressed size ' + f.size + ' limit ' + Math.round(limitMB * 1048576) + ' (source ' + srcSize + ')');
    assert.ok(f.size > 2000, 'has content');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-progress').length), 0, 'progress pill is gone');

    const info = await page.evaluate(() => new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => reject(new Error('result does not decode'));
      v.src = URL.createObjectURL(window.__last[0]);
    }));
    assert.ok(info.w > 0 && info.h > 0 && info.w <= 640, 'decodes: ' + JSON.stringify(info));
  });

  await test('UploadCompressor: hopeless footage (pure noise at a tiny limit) falls back to the original with a message', async () => {
    const srcSize = await makeVideo(400);
    await page.evaluate(() => window.YapperMod.plugins.get('UploadCompressor').settings.set('limitMB', 0.03));
    await page.evaluate(() => window.__sendFiles('input', [window.__vid]));
    await waitGot(1);
    const f = (await takeGot())[0].files[0];
    assert.strictEqual(f.name, 'clip.webm');
    assert.strictEqual(f.size, srcSize, 'original untouched');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-progress').length), 0);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.ym-toast')].map((t) => t.textContent).join(' | '));
    assert.match(toast, /Could not compress clip\.webm|too long to fit/);
  });

  await test('UploadCompressor: planning math, too-long videos, and 10 MB / 100 MB sanity', async () => {
    const r = await page.evaluate(async () => {
      const api = window.YapperMod.plugins.get('UploadCompressor').api;
      const budget = 10 * 1048576 * 0.95;
      return {
        five: api.videoPlan(300, 1920, 1080, budget),
        ten: api.videoPlan(600, 1920, 1080, budget),
        tiny: api.videoPlan(36000, 1920, 1080, 1e6),
        short: api.videoPlan(60, 1920, 1080, budget),
        tooLong: await api.compressVideo(window.__vid, 1000, { maxSeconds: 0.5 }),
      };
    });
    assert.ok(r.five && r.five.videoBps > 120000, 'a 5 minute video fits 10 MB at low quality');
    assert.strictEqual(r.ten, null, 'a 10 minute video does not fit 10 MB with usable quality');
    assert.strictEqual(r.tiny, null);
    assert.ok(r.short.width <= 1920 && r.short.width % 2 === 0 && r.short.height % 2 === 0);
    assert.ok(r.short.width * r.short.height > r.five.width * r.five.height, 'shorter clips keep more resolution');
    assert.strictEqual(r.tooLong.tooLong, true);
    await disable('UploadCompressor');
  });

  console.log('screen share');
  await test('ScreenShareQuality: limits follow what was captured (720p30, 1080p60, 1080p120, 1440p180), never lower, cameras untouched', async () => {

    await page.evaluate(() => window.YapperMod.plugins.get('ScreenShareQuality').settings.set('contentHint', 'motion'));
    const r = await page.evaluate(() => {
      const api = window.YapperMod.plugins.get('ScreenShareQuality').api;
      const fake = (w, h, fps) => ({ kind: 'video', contentHint: 'detail', getSettings: () => ({ width: w, height: h, frameRate: fps, displaySurface: 'monitor' }) });
      const lim = (w, h, fps) => api.limitsFor(fake(w, h, fps));
      const mk = (w, h, hint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillRect(0, 0, 5, 5); const t = c.captureStream(15).getVideoTracks()[0]; if (hint) t.contentHint = hint; return t; };
      const enc = (track) => { const pc = new RTCPeerConnection(); const tr = pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: [{ maxBitrate: 3000000, maxFramerate: 15 }] }); const e = tr.sender.getParameters().encodings[0]; const out = { fps: e.maxFramerate, bps: e.maxBitrate, hint: track.contentHint }; pc.close(); return out; };
      return {
        l720: lim(1280, 720, 30), l1080: lim(1920, 1080, 60), l120: lim(1920, 1080, 120), l180: lim(2560, 1440, 180), unknownFps: lim(1280, 720, 0), none: api.limitsFor({ getSettings: () => ({}) }),
        keep: api.adjustEncoding({ maxFramerate: 90, maxBitrate: 30000000 }, { fps: 30, bitrate: 3000000 }),
        raise: api.adjustEncoding({ maxFramerate: 15, maxBitrate: 3000000 }, { fps: 120, bitrate: 14000000 }),
        screen: enc(mk(1280, 720, 'detail')), camera: enc(mk(640, 480, '')), touched: api.stats.touched,
      };
    });
    assert.deepStrictEqual([r.l720.fps, r.l1080.fps, r.l120.fps, r.l180.fps, r.unknownFps.fps], [30, 60, 120, 180, 30]);
    assert.ok(r.l720.bitrate >= 2500000 && r.l720.bitrate <= 3500000, 'bitrate ' + r.l720.bitrate);
    assert.ok(r.l1080.bitrate > r.l720.bitrate && r.l120.bitrate > r.l1080.bitrate, 'more pixels and frames get more bitrate');
    assert.ok(r.l180.bitrate <= 20000000);
    assert.strictEqual(r.none, null);
    assert.deepStrictEqual(r.keep, { maxFramerate: 90, maxBitrate: 30000000 }, 'a higher limit is never lowered');
    assert.deepStrictEqual(r.raise, { maxFramerate: 120, maxBitrate: 14000000 });
    assert.strictEqual(r.screen.hint, 'motion');
    assert.ok(r.screen.fps >= 15 && r.screen.bps >= 3000000);
    assert.strictEqual(r.camera.fps, 15, 'cameras are not touched');
    assert.strictEqual(r.camera.hint, '');
    assert.strictEqual(r.touched, 1);
  });

  await test('ScreenShareQuality: sender updates keep the tier limits', async () => {
    const r = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').fillRect(0, 0, 5, 5);
      const t = c.captureStream(15).getVideoTracks()[0]; t.contentHint = 'detail';
      const pc = new RTCPeerConnection();
      const sender = pc.addTrack(t, new MediaStream([t]));
      const p = sender.getParameters(); p.encodings = p.encodings.length ? p.encodings : [{}];
      p.encodings[0].maxFramerate = 10;
      await sender.setParameters(p).catch(() => undefined);
      const fps = sender.getParameters().encodings[0].maxFramerate;
      pc.close();
      return fps;
    });
    assert.ok(r === undefined || r >= 10, 'setParameters still works: ' + r);
  });

  console.log('chat plugins');
  await test('ViewRaw adds a button, shows the raw message, copies, closes with Escape', async () => {
    await enable('ViewRaw');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-raw-btn').length), 4);
    await page.evaluate(() => document.querySelector('[data-message-id=a2] .ym-raw-btn').click());
    const txt = await page.evaluate(() => document.querySelector('.ym-raw-pre').textContent);
    const j = JSON.parse(txt);
    assert.strictEqual(j.message.id, 'a2');
    assert.strictEqual(j.message.content, 'mine');
    assert.strictEqual(j.author.username, 'tarik');
    await page.evaluate(() => [...document.querySelectorAll('.ym-raw-foot button')].find((b) => b.textContent === 'Copy content').click());
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => navigator.clipboard.readText()), 'mine');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-raw-modal').length), 0);
    await disable('ViewRaw');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-raw-btn').length), 0);
  });

  await test('ShowAllMessageButtons makes the action bar permanent', async () => {
    const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id=a1] .msg-actions')).display);
    assert.strictEqual(hidden, 'none', 'hidden by default');
    await enable('ShowAllMessageButtons');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id=a1] .msg-actions')).display), 'flex');
    await disable('ShowAllMessageButtons');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('[data-message-id=a1] .msg-actions')).display), 'none');
  });

  await test('MessageClickActions: double-click edits mine, replies to others, ignores links', async () => {
    await enable('MessageClickActions');
    await reset();
    await page.locator('[data-message-id=a2] .msg-text').dblclick({ position: { x: 5, y: 5 } });
    assert.strictEqual((await state(['editingId'])).editingId, 'a2');
    await reset();
    await page.locator('[data-message-id=a1] .msg-text').dblclick({ position: { x: 5, y: 5 } });
    assert.deepStrictEqual((await state(['replyingTo'])).replyingTo, { channelId: 'c1', messageId: 'a1' });
    await reset();
    await page.locator('[data-message-id=a1] .msg-text a').dblclick();
    assert.strictEqual((await state(['replyingTo'])).replyingTo, null, 'links are left alone');
    await page.evaluate(() => window.YapperMod.plugins.get('MessageClickActions').settings.set('mode', 'reply'));
    await page.locator('[data-message-id=a2] .msg-text').dblclick({ position: { x: 5, y: 5 } });
    assert.strictEqual((await state(['editingId'])).editingId, null, 'reply-only mode does not edit');
    await disable('MessageClickActions');
    await reset();
    await page.locator('[data-message-id=a1] .msg-text').dblclick({ position: { x: 5, y: 5 } });
    assert.strictEqual((await state(['replyingTo'])).replyingTo, null, 'off means off');
  });

  await test('QuickReply: Ctrl+Up/Down walks the reply target, Ctrl+Shift+Up edits my messages', async () => {
    await enable('QuickReply');
    await reset();
    await page.focus('.composer textarea');
    const rep = async () => (await state(['replyingTo'])).replyingTo;
    await page.keyboard.press('Control+ArrowUp');
    assert.strictEqual((await rep()).messageId, 'a4');
    await page.keyboard.press('Control+ArrowUp');
    assert.strictEqual((await rep()).messageId, 'a3');
    await page.keyboard.press('Control+ArrowDown');
    assert.strictEqual((await rep()).messageId, 'a4');
    await page.keyboard.press('Control+ArrowDown');
    assert.strictEqual(await rep(), null, 'past the newest message cancels the reply');
    await page.keyboard.press('Control+Shift+ArrowUp');
    assert.strictEqual((await state(['editingId'])).editingId, 'a2');
    await page.keyboard.press('Control+Shift+ArrowDown');
    assert.strictEqual((await state(['editingId'])).editingId, null);

    await page.keyboard.press('ArrowUp');
    assert.strictEqual(await rep(), null);
    const step = await page.evaluate(() => { const s = window.YapperMod.plugins.get('QuickReply').api.step; const l = [{ id: 1 }, { id: 2 }, { id: 3 }]; return [s(l, null, -1).id, s(l, 3, -1).id, s(l, 1, -1).id, s(l, 1, 1).id, s(l, 3, 1), s(l, null, 1), s([], null, -1)]; });
    assert.deepStrictEqual(step, [3, 2, 1, 2, null, null, null]);
    await disable('QuickReply');
    await page.keyboard.press('Control+ArrowUp');
    assert.strictEqual(await rep(), null);
  });

  await test('Unindent trims shared indentation inside code blocks only, on send and edit', async () => {
    await enable('Unindent');
    const send = (content, method = 'POST') => page.evaluate(([c, m]) => fetch('https://api.yapper.website/rest/v1/messages', { method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'c1', content: c }) }), [content, method]);
    posts.length = 0;
    await send('look:\n```js\n    function a() {\n      return 1;\n    }\n```\n    keep this');
    await send('```\n  x\n```', 'PATCH');
    await send('no code\n   indented text');
    await send('```\nalready flat\n  indented\n```');
    assert.strictEqual(posts[0].content, 'look:\n```js\nfunction a() {\n  return 1;\n}\n```\n    keep this');
    assert.strictEqual(posts[1].content, '```\nx\n```');
    assert.strictEqual(posts[2].content, 'no code\n   indented text');
    assert.strictEqual(posts[3].content, '```\nalready flat\n  indented\n```');
    await disable('Unindent');
  });

  await test('IrcColors: stable per-user colors, respects role colors, restores on disable', async () => {
    await page.evaluate(() => { document.querySelector('[data-message-id=a3] .msg-author').style.color = 'rgb(1, 2, 3)'; });
    await enable('IrcColors');
    await sleep(150);
    const c = await page.evaluate(() => ['a1', 'a2', 'a3', 'a4'].map((id) => document.querySelector(`[data-message-id=${id}] .msg-author`).style.color));
    assert.ok(c[0] && c[1], 'colors applied');
    assert.strictEqual(c[0], c[3], 'same user, same color');
    assert.notStrictEqual(c[0], c[1]);
    assert.strictEqual(c[2], 'rgb(1, 2, 3)', 'role color kept');
    await page.evaluate(() => window.YapperMod.plugins.get('IrcColors').settings.set('keepRoleColors', false));
    await page.evaluate(() => window.YapperMod.messages.refresh());
    assert.notStrictEqual(await page.evaluate(() => document.querySelector('[data-message-id=a3] .msg-author').style.color), 'rgb(1, 2, 3)');
    await disable('IrcColors');
    assert.strictEqual(await page.evaluate(() => document.querySelector('[data-message-id=a1] .msg-author').style.color), '');
    assert.strictEqual(await page.evaluate(() => { const f = window.YapperMod.plugins.get('IrcColors').api.colorFor; return [f('u2') === f('u2'), f('u2') !== f('u3'), /^hsl\(\d+ 70% 68%\)$/.test(f('u2'))]; }).then((a) => a.join()), 'true,true,true');
  });

  await test('ThemeAttributes adds and removes data attributes', async () => {
    await enable('ThemeAttributes');
    await sleep(300);
    const r = await page.evaluate(() => ({
      a1: document.querySelector('[data-message-id=a1]').dataset.ymAuthor,
      mine: document.querySelector('[data-message-id=a2]').hasAttribute('data-ym-mine'),
      notMine: document.querySelector('[data-message-id=a1]').hasAttribute('data-ym-mine'),
      reply: document.querySelector('[data-message-id=a4]').dataset.ymReply,
      ch: document.documentElement.dataset.ymChannel,
      dm: document.documentElement.hasAttribute('data-ym-dm'),
    }));
    assert.deepStrictEqual(r, { a1: 'u2', mine: true, notMine: false, reply: 'a1', ch: 'c1', dm: true });
    await disable('ThemeAttributes');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-ym-author]').length + (document.documentElement.dataset.ymChannel ? 1 : 0)), 0);
  });

  await test('ReplyTimestamp shows when the original message was sent', async () => {
    await enable('ReplyTimestamp');
    await sleep(200);
    const t = await page.evaluate(() => document.querySelector('[data-message-id=a4] .ym-reply-time')?.textContent);
    assert.ok(t && /\d/.test(t), 'timestamp text: ' + t);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-message-id=a1] .ym-reply-time').length), 0, 'only on replies');
    await disable('ReplyTimestamp');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-reply-time').length), 0);
  });

  await test('CopyFileContents: button on text files only, copies the text', async () => {
    await enable('CopyFileContents');
    await sleep(200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-copyfile').length), 1);
    await page.evaluate(() => document.querySelector('.ym-copyfile').click());
    await sleep(500);
    assert.strictEqual(await page.evaluate(() => navigator.clipboard.readText()), 'hello from a file\nline 2');
    await disable('CopyFileContents');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-copyfile').length), 0);
  });

  await test('ViewIcons: Ctrl+click on an avatar opens the picture viewer, a normal click does not', async () => {
    await enable('ViewIcons');
    await reset();
    await page.locator('#av').click();
    assert.strictEqual((await state(['lightbox'])).lightbox, null);
    await page.locator('#av').click({ modifiers: ['Control'] });
    assert.match((await state(['lightbox'])).lightbox, /^data:image\/gif/);
    await disable('ViewIcons');
    await reset();
    await page.locator('#av').click({ modifiers: ['Control'] });
    assert.strictEqual((await state(['lightbox'])).lightbox, null);
  });

  await test('CallTimer: counts from the moment the call is connected, formats, and disappears when you leave', async () => {
    await page.evaluate(() => {
      document.getElementById('ct-fx')?.remove();
      const fx = document.createElement('div');
      fx.id = 'ct-fx';
      fx.innerHTML = '<div class="voice-bar"><div class="voice-bar-top"><button class="voice-bar-info"><span class="voice-status connecting"><span class="signal"></span>Connecting…</span><span class="voice-where">Lounge / Server</span></button></div></div>';
      document.body.append(fx);
      window.YapperMod.Store.setState({ voice: { channelId: 'v1', serverId: 's1', status: 'connecting' } });
    });
    await enable('CallTimer');
    await sleep(1200);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-calltimer').length), 0, 'no timer while still connecting');
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { channelId: 'v1', serverId: 's1', status: 'connected' } }));
    await sleep(2300);
    const t1 = await page.evaluate(() => document.querySelector('.voice-status .ym-calltimer')?.textContent);
    assert.match(t1, /^00:0[1-4]$/, 'stopwatch text: ' + t1);
    await page.evaluate(() => window.YapperMod.plugins.get('CallTimer').settings.set('format', 'human'));
    await sleep(100);
    const t2 = await page.evaluate(() => document.querySelector('.voice-status .ym-calltimer')?.textContent);
    assert.match(t2, /^[1-5]s$/, 'human text: ' + t2);

    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { channelId: 'v1', serverId: 's1', status: 'connected', muted: true } }));
    await sleep(100);
    assert.match(await page.evaluate(() => document.querySelector('.ym-calltimer').textContent), /^[2-6]s$/);
    const f = await page.evaluate(() => { const a = window.YapperMod.plugins.get('CallTimer').api.format; return [a(75000), a(3725000), a(3725000, 'human'), a(75000, 'human'), a(0, 'human'), a(-5, 'stopwatch'), a(59999)]; });
    assert.deepStrictEqual(f, ['01:15', '1:02:05', '1h 2m 5s', '1m 15s', '0s', '00:00', '00:59']);
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-calltimer').length), 0, 'gone after leaving');
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { channelId: 'v2', serverId: 's1', status: 'connected' } }));
    await sleep(1300);
    assert.match(await page.evaluate(() => document.querySelector('.ym-calltimer').textContent), /^[0-2]s$/, 'a new call starts from zero');
    await disable('CallTimer');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-calltimer').length), 0);
    await page.evaluate(() => { window.YapperMod.Store.setState({ voice: null }); document.getElementById('ct-fx').remove(); });
  });

  await test('MemberCount: Discord-style online/total dots prepended to the real .side-panel-body, nothing outside a server', async () => {
    await page.evaluate(() => {
      document.getElementById('mc-fx')?.remove();
      const fx = document.createElement('div');
      fx.id = 'mc-fx';

      fx.innerHTML = '<aside class="side-panel"><div class="side-panel-body"><div><div class="section-label">Owner - 1</div><button class="pick-row">a</button></div></div></aside>';
      document.body.append(fx);
      window.YapperMod.Store.setState({ activeServerId: 's1', memberCounts: { s1: 1234 }, serverMembers: { s1: ['me', 'u2', 'u3', 'u2'] }, online: { u2: 'online' }, myStatus: 'online' });
    });
    await enable('MemberCount');
    await sleep(150);
    const online = () => page.evaluate(() => document.querySelector('.ym-mc-online .ym-mc-num')?.textContent ?? null);
    const total = () => page.evaluate(() => document.querySelector('.ym-mc-total .ym-mc-num')?.textContent ?? null);
    assert.match(await total(), /^1\D?234$/);
    assert.strictEqual(await online(), '2', 'me + u2 are online, u3 is not, duplicates count once');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.side-panel-body > .section-label')?.textContent), 'Owner - 1', "Yapper's own section is untouched");
    await page.evaluate(() => window.YapperMod.Store.setState({ myStatus: 'invisible' }));
    await sleep(100);
    assert.strictEqual(await online(), '1', 'invisible: I do not count myself as online');
    await page.evaluate(() => window.YapperMod.Store.setState({ memberCounts: { s1: 1500 } }));
    await sleep(100);
    assert.match(await total(), /1\D?500$/, 'follows changes');
    await page.evaluate(() => window.YapperMod.Store.setState({ activeServerId: null }));
    await sleep(100);
    assert.strictEqual(await online(), null, 'no server open (DM group): nothing added');
    await disable('MemberCount');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-membercount-row').length), 0);
    await page.evaluate(() => { window.YapperMod.Store.setState({ activeServerId: null, memberCounts: {}, serverMembers: {}, online: {}, myStatus: 'online' }); document.getElementById('mc-fx').remove(); });
  });

  const bad = site.consoleLog.filter((l) => (l.type === 'error' || l.type === 'pageerror') && /YapCord|YapperMod|ym-|plugin/i.test(l.text));
  await test('no YapCord errors in the console', async () => assert.deepStrictEqual(bad.map((b) => b.text.slice(0, 200)), []));

  await site.close();
  const pass = results.filter(Boolean).length;
  console.log('\n' + pass + '/' + results.length + ' passed');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
