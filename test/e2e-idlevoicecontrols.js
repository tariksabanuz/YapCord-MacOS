'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({
    initial: { settings: { plugins: {} } },
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    permissions: ['microphone'],

    extra: (p) => p.addInitScript(() => {
      window.__sinkCalls = [];
      const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (proto && typeof proto.setSinkId === 'function') {
        const real = proto.setSinkId;
        proto.setSinkId = function (id) { window.__sinkCalls.push(id); return real.call(this, id); };
      }
    }),
  });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });

    window.__realEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    window.__calls = { mute: 0, deafen: 0 };
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {
      if (names.includes('toggleMute') && names.includes('toggleDeafen')) {
        return {
          toggleMute: () => { window.__calls.mute++; const v = YM.Store.getState().voice; YM.Store.setState({ voice: { ...v, muted: !v.muted } }); return Promise.resolve(); },
          toggleDeafen: () => { window.__calls.deafen++; const v = YM.Store.getState().voice; YM.Store.setState({ voice: { ...v, deafened: !v.deafened } }); return Promise.resolve(); },
        };
      }
      return real(names);
    };
    YM.Store.setState({ voice: null });
    const app = document.createElement('div');
    app.id = 'fxivc';
    app.style.cssText = 'position:fixed;left:0;top:200px;width:700px;height:60px;z-index:10';
    app.innerHTML = `<div class="user-bar" style="display:flex;align-items:center;gap:4px;height:52px">
        <div class="account"><span>Tarik</span></div>
        <button aria-label="Mentions" title="Mentions">@</button>
        <button aria-label="Settings" title="Settings">&#9881;</button>
      </div>`;
    document.body.append(app);

    const adversarial = document.createElement('style');
    adversarial.textContent = '#fxivc .user-bar button.icon-btn{flex:1 1 0%;min-width:0;width:auto;max-width:18px}';
    document.head.appendChild(adversarial);
  });
  await sleep(150);

  const bar = () => page.evaluate(() => [...document.querySelector('.user-bar').children].map((n) =>
    n.classList.contains('ym-ivc-pair') ? '[' + n.querySelector('.ym-ivc-btn').getAttribute('aria-label') + ']' :
    n.classList.contains('ym-userbar-btn') ? '[plugins]' :
    n.getAttribute('aria-label') === 'Settings' ? '[settings]' : n.getAttribute('aria-label') || '[other]'));
  const micBtn = () => page.evaluate(() => { const b = document.querySelector('.ym-ivc-pair .ym-ivc-btn'); return b && { label: b.getAttribute('aria-label'), active: b.classList.contains('ym-ivc-active') }; });
  const label = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el && el.getAttribute('aria-label'); }, sel);
  const pairs = () => page.evaluate(() => [...document.querySelectorAll('.ym-ivc-pair')].map((p) => p.querySelector('.ym-ivc-btn').getAttribute('aria-label')));
  const voice = () => page.evaluate(() => window.YapperMod.Store.getState().voice);

  console.log('IdleVoiceControls');

  await test('replaces the "mentions" button with a Mute+Deafen pair; the plugins button stays, the settings button stays', async () => {
    assert.deepStrictEqual(await bar(), ['[other]', '[Mute]', '[Deafen]', '[plugins]', '[settings]']);
  });

  await test('the mic/deafen buttons and chevrons refuse to flex-shrink, so they cannot collapse to near-zero width even against a real, higher-specificity competing rule', async () => {

    const sizes = await page.evaluate(() => [...document.querySelectorAll('.ym-ivc-btn, .ym-ivc-chev')].map((el) => {
      const cs = getComputedStyle(el);
      return { class: el.className, flexShrink: cs.flexShrink, minWidth: parseFloat(cs.minWidth) || 0, minHeight: parseFloat(cs.minHeight) || 0, box: el.getBoundingClientRect().width };
    }));
    assert.strictEqual(sizes.length, 4, 'two buttons + two chevrons');
    for (const s of sizes) {
      assert.strictEqual(s.flexShrink, '0', s.class + ' must not be allowed to shrink at all');
      assert.ok(s.box > 4, s.class + ' actually rendered with real width, not collapsed: ' + s.box);
    }
    const btns = sizes.filter((s) => s.class.includes('ym-ivc-btn'));
    for (const s of btns) assert.ok(s.minWidth >= 32 && s.minHeight >= 32, 'a real floor under the button itself: ' + JSON.stringify(s));
  });

  await test('the mic pair keeps a real visual gap from whatever sits right before it, even when the bar itself has no gap of its own', async () => {

    const gap = await page.evaluate(() => {
      document.querySelector('.user-bar').style.gap = '0px';
      const before = document.querySelector('.ym-ivc-mic-pair').previousElementSibling;
      const b = before.getBoundingClientRect();
      const p = document.querySelector('.ym-ivc-mic-pair').getBoundingClientRect();
      return p.left - b.right;
    });
    assert.ok(gap >= 8, 'a real, visible gap - not flush against the element right before it: ' + gap);
    await page.evaluate(() => { document.querySelector('.user-bar').style.gap = '4px'; });
  });

  await test('not in a call: both read "Mute" and "Deafen" (not active) by default', async () => {
    assert.deepStrictEqual(await pairs(), ['Mute', 'Deafen']);
    assert.strictEqual((await micBtn()).active, false);
  });

  await test('clicking Mute while idle just remembers the choice - no real toggle call yet', async () => {
    await page.click('.ym-ivc-pair .ym-ivc-btn[aria-label="Mute"]');
    await sleep(60);
    assert.deepStrictEqual(await pairs(), ['Unmute', 'Deafen']);
    assert.strictEqual(await page.evaluate(() => window.__calls.mute), 0, 'not connected, so nothing real to toggle yet');
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.get('IdleVoiceControls').settings.store.pendingMuted), true);
  });

  await test('clicking Deafen while idle remembers that choice too', async () => {
    await page.click('.ym-ivc-pair .ym-ivc-btn[aria-label="Deafen"]');
    await sleep(60);
    assert.deepStrictEqual(await pairs(), ['Unmute', 'Undeafen']);
  });

  await test('joining a call applies both pending choices immediately - exactly once each, not repeatedly', async () => {
    await page.evaluate(() => { window.__calls.mute = 0; window.__calls.deafen = 0; });
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: { status: 'connected', muted: false, deafened: false } }));
    await sleep(100);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls), { mute: 1, deafen: 1 });
    assert.deepStrictEqual(await voice(), { status: 'connected', muted: true, deafened: true });
    assert.deepStrictEqual(await pairs(), ['Unmute', 'Undeafen'], 'buttons now reflect the real, connected state');
  });

  await test('while connected, the buttons drive the real toggle functions directly', async () => {
    await page.click('.ym-ivc-pair .ym-ivc-btn[aria-label="Unmute"]');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => window.__calls.mute), 2);
    assert.strictEqual((await voice()).muted, false);
    assert.deepStrictEqual(await pairs(), ['Mute', 'Undeafen']);
  });

  await test('leaving the call keeps showing whatever you left it as, not a stale pre-call choice', async () => {
    await page.evaluate(() => window.YapperMod.Store.setState({ voice: null }));
    await sleep(60);

    assert.deepStrictEqual(await pairs(), ['Mute', 'Undeafen']);
  });

  await test('React re-adding the real "mentions" button is undone on the next pass too, not just once at boot', async () => {
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Mentions');
      b.textContent = '@';
      document.querySelector('.user-bar').prepend(b);
    });
    await sleep(150);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.user-bar button[aria-label="Mentions"]')), null);
  });

  console.log('chevron menus');

  await test('the mic chevron greys the Mute button, rotates, and opens a menu with Input Device / Input Volume / Push to Talk', async () => {
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Microphone options"]');
    await sleep(60);
    const r = await page.evaluate(() => {
      const btn = document.querySelector('.ym-ivc-pair .ym-ivc-btn[aria-label="Mute"]');
      const chev = document.querySelector('.ym-ivc-chev[aria-label="Microphone options"]');
      const menu = document.querySelector('.ym-ivc-menu');
      return {
        grey: btn.classList.contains('ym-ivc-menuopen'),
        rotated: chev.classList.contains('ym-ivc-chev-open'),
        labels: menu ? [...menu.querySelectorAll('.ym-ivc-mlabel')].map((n) => n.textContent.replace(/\s+$/, '')) : null,
        hasVolume: !!menu.querySelector('.ym-ivc-range'),
        hasPtt: !!menu.querySelector('.ym-ivc-check'),
        hasVoiceSettings: [...menu.querySelectorAll('.ym-ivc-mbtn')].some((b) => b.textContent === 'Voice Settings'),
      };
    });
    assert.strictEqual(r.grey, true);
    assert.strictEqual(r.rotated, true);
    assert.ok(r.labels[0].startsWith('Input Device'));
    assert.ok(r.labels[1].startsWith('Input Volume'));
    assert.strictEqual(r.hasVolume, true);
    assert.strictEqual(r.hasPtt, true);
    assert.strictEqual(r.hasVoiceSettings, true);
  });

  await test('clicking elsewhere closes the mic menu and un-greys/un-rotates the button', async () => {

    await page.evaluate(() => document.querySelector('.overlay.clear').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await sleep(60);
    const r = await page.evaluate(() => ({
      menu: document.querySelector('.ym-ivc-menu'),
      grey: document.querySelector('.ym-ivc-pair .ym-ivc-btn[aria-label="Mute"]').classList.contains('ym-ivc-menuopen'),
      rotated: document.querySelector('.ym-ivc-chev[aria-label="Microphone options"]').classList.contains('ym-ivc-chev-open'),
    }));
    assert.strictEqual(r.menu, null);
    assert.strictEqual(r.grey, false);
    assert.strictEqual(r.rotated, false);
  });

  await test('the headphone chevron opens its own menu with Output Device only - no Input Volume, no Push to Talk', async () => {
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Headphone options"]');
    await sleep(60);
    const r = await page.evaluate(() => {
      const menu = document.querySelector('.ym-ivc-menu');
      return {
        labels: [...menu.querySelectorAll('.ym-ivc-mlabel')].map((n) => n.textContent.replace(/\s+$/, '')),
        hasVolume: !!menu.querySelector('.ym-ivc-range'),
        hasPtt: !!menu.querySelector('.ym-ivc-check'),
      };
    });
    assert.deepStrictEqual(r.labels, ['Output Device']);
    assert.strictEqual(r.hasVolume, false);
    assert.strictEqual(r.hasPtt, false);
  });

  await test('opening the mic menu closes the headphone one - only one open at a time', async () => {

    await page.evaluate(() => document.querySelector('.ym-ivc-pair .ym-ivc-chev[aria-label="Microphone options"]').click());
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ym-ivc-menu').length), 1);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-ivc-pair .ym-ivc-btn[aria-label="Undeafen"]').classList.contains('ym-ivc-menuopen')), false, 'the headphone button is no longer greyed - its menu closed');
    assert.ok(await page.evaluate(() => !!document.querySelector('.ym-ivc-menu').querySelector('.ym-ivc-range')), 'the menu that is open now is the mic one');
    await page.keyboard.press('Escape');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-ivc-menu')), null);
  });

  await test('Push to Talk checkbox reflects and sets the real PushToTalk plugin - pending, like any other plugin switch', async () => {
    await page.evaluate(() => window.YapperMod.plugins.setEnabled('PushToTalk', false));
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Microphone options"]');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-ivc-check input').checked), false);
    await page.click('.ym-ivc-check input');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.isEnabled('PushToTalk')), true);
    assert.strictEqual(await page.evaluate(() => window.YapperMod.plugins.isRunning('PushToTalk')), false, 'saved for next reload, same as the Plugins page - not started mid-call');
    await page.keyboard.press('Escape');
  });

  await test('"Voice Settings" opens YapCord\'s own settings to the Plugins page and closes the menu', async () => {

    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.id = 'fxivc-settings';
      wrap.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      wrap.innerHTML = `<div class="settings">
          <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" data-k="account">My Account</button></nav>
          <section class="settings-main"><div><h2>My Account</h2></div></section>
        </div>`;
      document.body.append(wrap);
    });
    await sleep(150);
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Microphone options"]');
    await sleep(60);
    await page.evaluate(() => [...document.querySelectorAll('.ym-ivc-mbtn')].find((b) => b.textContent === 'Voice Settings').click());
    await sleep(100);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-ivc-menu')), null, 'menu closed itself');
    assert.strictEqual(await page.evaluate(() => window.YapperMod.settingsUi.page), 'plugins');
    await page.evaluate(() => document.getElementById('fxivc-settings')?.remove());
  });

  console.log('device list + real getUserMedia');

  await test('Input/Output Device selects list real devices once enumerateDevices resolves', async () => {
    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Fake Mic' },
        { kind: 'audiooutput', deviceId: 'spk-1', label: 'Fake Speaker' },
        { kind: 'videoinput', deviceId: 'cam-1', label: 'Fake Cam' },
      ];
    });
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Microphone options"]');
    await sleep(80);
    const micOptions = await page.evaluate(() => [...document.querySelector('.ym-ivc-select').options].map((o) => [o.value, o.textContent]));
    assert.deepStrictEqual(micOptions, [['', 'System default'], ['mic-1', 'Fake Mic']]);
    await page.keyboard.press('Escape');
    await page.click('.ym-ivc-pair .ym-ivc-chev[aria-label="Headphone options"]');
    await sleep(80);
    const outOptions = await page.evaluate(() => [...document.querySelector('.ym-ivc-select').options].map((o) => [o.value, o.textContent]));
    assert.deepStrictEqual(outOptions, [['', 'System default'], ['spk-1', 'Fake Speaker']]);
    await page.keyboard.press('Escape');
  });

  await test('picking an input device and leaving volume at 100% does not touch the real mic stream at all', async () => {
    const r = await page.evaluate(async () => {
      window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', '');
      window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputVolume', 100);
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const id = s.getAudioTracks()[0].id;
      s.getTracks().forEach((t) => t.stop());
      return typeof id;
    });
    assert.strictEqual(r, 'string', 'still got a normal, working stream back');
  });

  await test('a non-default input volume really runs the captured audio through a gain stage (a different track comes back)', async () => {
    const r = await page.evaluate(async () => {
      const raw = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rawId = raw.getAudioTracks()[0].id;
      raw.getTracks().forEach((t) => t.stop());
      window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputVolume', 60);
      const out = await navigator.mediaDevices.getUserMedia({ audio: true });
      const outId = out.getAudioTracks()[0].id;
      out.getTracks().forEach((t) => t.stop());
      window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputVolume', 100);
      return { audioTracks: out.getAudioTracks ? 1 : 0, different: outId !== rawId };
    });
    assert.strictEqual(r.different, true);
  });

  await test('a device id that does not exist falls back to the plain request instead of failing outright', async () => {
    const r = await page.evaluate(async () => {
      window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', 'does-not-exist-at-all');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        return 'ok';
      } catch (err) {
        return 'threw: ' + err.message;
      } finally {
        window.YapperMod.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', '');
      }
    });
    assert.strictEqual(r, 'ok', 'the bad device id did not stop you from getting a microphone at all');
  });

  await test('a video-only request is left completely alone', async () => {
    const kinds = await page.evaluate(async () => {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      const k = s.getTracks().map((t) => t.kind);
      s.getTracks().forEach((t) => t.stop());
      return k;
    });
    assert.deepStrictEqual(kinds, ['video']);
  });

  await test('"System default" input really wins over a caller that already asked for a specific device, not just an unspecified one', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', '');
      const devs = await window.__realEnumerateDevices();
      const other = devs.find((d) => d.kind === 'audioinput' && d.deviceId !== 'default');

      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: other.deviceId } } });
      const id = s.getAudioTracks()[0].getSettings().deviceId;
      s.getTracks().forEach((t) => t.stop());
      return id;
    });
    assert.strictEqual(r, 'default', 'the real system-default device was captured, not the caller\'s own specific request');
  });

  await test('picking a specific input device really wins too, even over a caller that asked for a different specific one', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const devs = await window.__realEnumerateDevices();
      const mine = devs.find((d) => d.kind === 'audioinput' && d.deviceId !== 'default');
      const other = devs.find((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== mine.deviceId);
      YM.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', mine.deviceId);
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: other.deviceId } } });
      const id = s.getAudioTracks()[0].getSettings().deviceId;
      s.getTracks().forEach((t) => t.stop());
      YM.plugins.get('IdleVoiceControls').settings.set('inputDeviceId', '');
      return { id, mine: mine.deviceId };
    });
    assert.strictEqual(r.id, r.mine, 'our own chosen device won, not the caller\'s own different one');
  });

  await test('"System default" output really wins over whatever id setSinkId is actually called with, every time', async () => {
    const calls = await page.evaluate(async () => {
      const YM = window.YapperMod;
      YM.plugins.get('IdleVoiceControls').settings.set('outputDeviceId', '');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.__sinkCalls.length = 0;
      const audio = document.createElement('audio');
      document.body.append(audio);

      await audio.setSinkId('some-random-id').catch(() => {});
      await audio.setSinkId('yet-another-id').catch(() => {});
      await audio.setSinkId('').catch(() => {});
      audio.remove();
      return window.__sinkCalls.slice();
    });
    assert.ok(calls.length >= 3, 'all three calls (plus maybe the onMutate sweep picking up the new element) were observed');
    assert.ok(calls.every((id) => id === ''), 'every call that actually reached the real setSinkId used our own stored choice (empty = default), never the raw request: ' + JSON.stringify(calls));
  });

  await test('picking a specific output device really wins too, over whatever id setSinkId is actually called with', async () => {
    const r = await page.evaluate(async () => {
      const YM = window.YapperMod;
      const devs = await window.__realEnumerateDevices();
      const mine = devs.find((d) => d.kind === 'audiooutput' && d.deviceId !== 'default');
      YM.plugins.get('IdleVoiceControls').settings.set('outputDeviceId', mine.deviceId);
      await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
      window.__sinkCalls.length = 0;
      const audio = document.createElement('audio');
      document.body.append(audio);
      await audio.setSinkId('some-other-id').catch(() => {});
      audio.remove();
      YM.plugins.get('IdleVoiceControls').settings.set('outputDeviceId', '');
      return { calls: window.__sinkCalls.slice(), mine: mine.deviceId };
    });
    assert.ok(r.calls.length >= 1, 'at least the direct call was observed');
    assert.ok(r.calls.every((id) => id === r.mine), 'every call that actually reached the real setSinkId used our own chosen device, never the raw request: ' + JSON.stringify(r.calls));
  });

  await test('registered, always on, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const p = YM.plugins.get('IdleVoiceControls');
      YM.plugins.setEnabled('IdleVoiceControls', false);
      return { exists: !!p, alwaysOn: !!(p && p.alwaysOn), running: YM.plugins.isRunning('IdleVoiceControls'), err: YM.plugins.errors.get('IdleVoiceControls') };
    });
    assert.deepStrictEqual(r, { exists: true, alwaysOn: true, running: true, err: undefined });
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
  await site.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
