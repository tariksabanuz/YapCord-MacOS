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
  const setOpt = (n, k, v) => page.evaluate(([a, b, c]) => window.YapperMod.plugins.get(a).settings.set(b, c), [n, k, v]);
  await page.evaluate(() => { for (const n of ['MessageLogger', 'BetterFolders', 'OnePingPerDM', 'ReadAllNotificationsButton', 'NoTrack', 'PetPet']) window.YapperMod.plugins.setEnabled(n, false); });

  await page.evaluate(() => {
    const YM = window.YapperMod;
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    window.__toasts = [];
    window.__calls = { kick: [], ban: [], unban: [], timeout: [], nick: [], vmute: [], vunmute: [], vkick: [], vban: [], vunban: [], msg: [], sent: [] };
    window.__perms = { kick_members: true, ban_members: true, timeout_members: true, manage_nicknames: true };
    window.__flags = { nicknames: true, voice_ban: true };
    window.__voiceChannelOf = {};
    window.__voicePerms = { mute: true, move: true };
    window.__yapperEnterCount = 0;

    const MOCK = {
      kickMember: (sid, uid) => { window.__calls.kick.push([sid, uid]); return Promise.resolve(); },
      banMember: (sid, uid) => { window.__calls.ban.push([sid, uid]); return Promise.resolve(); },
      unbanMember: (sid, uid) => { window.__calls.unban.push([sid, uid]); return Promise.resolve(); },
      timeoutMember: (sid, uid, minutes, why) => { window.__calls.timeout.push([sid, uid, minutes, why]); return Promise.resolve(); },
      setNickname: (sid, uid, nick) => { window.__calls.nick.push([sid, uid, nick]); return Promise.resolve(); },
      loadBans: () => Promise.resolve([{ user_id: 'uBanned', created_at: '2026-01-01T00:00:00Z' }]),
      loadVoiceBans: () => Promise.resolve([{ user_id: 'uVBanned', until: null, reason: '', by: 'me', created_at: '2026-01-01T00:00:00Z' }]),
      hasPerm: (state, sid, perm) => !!(window.__perms && window.__perms[perm]),
      voiceModPerms: () => ({ ...window.__voicePerms }),
      voiceChannelOf: (state, sid, uid) => window.__voiceChannelOf[uid] || null,
      muteInVoice: (cid, uid, minutes) => { window.__calls.vmute.push([cid, uid, minutes]); return Promise.resolve(); },
      unmuteInVoice: (cid, uid) => { window.__calls.vunmute.push([cid, uid]); return Promise.resolve(); },
      kickFromVoice: (cid, uid) => { window.__calls.vkick.push([cid, uid]); return Promise.resolve(); },
      voiceBan: (sid, uid, minutes, reason) => { window.__calls.vban.push([sid, uid, minutes, reason]); return Promise.resolve(minutes); },
      voiceUnban: (sid, uid) => { window.__calls.vunban.push([sid, uid]); return Promise.resolve(); },
      isFlagOn: (flag) => !!(window.__flags && window.__flags[flag]),

      markRead: (id) => { window.__calls.msg.push(['markRead', id]); },
      deleteMessage: () => Promise.resolve(),
      dispatchLive: () => {},
      openDmWith: (uid) => { window.__calls.msg.push(['open', uid]); YM.Store.setState({ activeChannelId: 'dm_' + uid }); return Promise.resolve(); },
      sendMessage: (cid, text) => { window.__calls.sent.push([cid, text]); return Promise.resolve(); },
    };
    const real = YM.finder.findExports.bind(YM.finder);
    YM.finder.findExports = (names) => {

      if (names.every((n) => n in MOCK)) return MOCK;
      return real(names);
    };
    YM.toast = (m, o) => { window.__toasts.push([String(m), (o && o.type) || 'info']); };

    YM.Store.setState({
      userId: 'me', isAdmin: false, isMod: false,
      profiles: {
        me: { id: 'me', username: 'tarik', display_name: 'Tarik' },
        u2: { id: 'u2', username: 'sam', display_name: 'Sammy' },
        u3: { id: 'u3', username: 'alex', display_name: 'Alex' },
        uBanned: { id: 'uBanned', username: 'ghosty', display_name: 'Ghosty' },
        uVBanned: { id: 'uVBanned', username: 'shade', display_name: 'Shade' },
      },
      servers: { s1: { id: 's1', name: 'Test Server' } },
      serverMembers: { s1: ['me', 'u2', 'u3'] },
      channels: { c1: { id: 'c1', kind: 'text', server_id: 's1', name: 'general' } },
      activeServerId: 's1', activeChannelId: 'c1',
      messages: { c1: [] },
    });

    const app = document.createElement('div');
    app.id = 'fx113';
    app.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:760px;z-index:10;display:flex;background:var(--bg-main);color:var(--text)';
    app.innerHTML = `<main class="main" style="flex:1;position:relative">
        <div class="composer" style="width:560px;position:relative"><div class="composer-box"><textarea style="width:300px"></textarea>
          <button class="send-btn" aria-label="Send" disabled>Send</button>
        </div></div>
      </main>`;
    document.body.append(app);
    const ta = app.querySelector('.composer textarea');
    const sendBtn = app.querySelector('.send-btn[aria-label="Send"]');
    ta.addEventListener('input', () => { sendBtn.disabled = !ta.value.trim(); });

    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) window.__yapperEnterCount++; });
  });
  await sleep(150);

  const ta = '.composer textarea';
  const val = () => page.evaluate((s) => document.querySelector(s).value, ta);
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || null);
  const typeAndEnter = async (text) => {
    await page.fill(ta, text);
    await page.focus(ta);
    await page.keyboard.press('Enter');
    await sleep(60);
  };
  const confirmModal = async () => {
    await page.waitForSelector('.ym-modal', { timeout: 2000 });
    await page.evaluate(() => [...document.querySelectorAll('.ym-modal button')].find((b) => b.textContent === 'Do it').click());
    await sleep(60);
  };
  const setPerms = (p) => page.evaluate((p) => Object.assign(window.__perms, p), p);

  console.log('SlashModeration');
  await enable('SlashModeration');
  await sleep(100);

  await test('an ordinary message is left alone and sent through as normal', async () => {
    await typeAndEnter('hello everyone');
    assert.strictEqual(await page.evaluate(() => window.__yapperEnterCount), 1, "Yapper's own Enter handling ran");
  });
  await test('an unrecognised slash word is left alone too', async () => {
    await typeAndEnter('/bogus foo');
    assert.strictEqual(await page.evaluate(() => window.__yapperEnterCount), 2);
  });
  await test('/kick asks "are you sure?" first, never reaches Yapper\'s own Enter handling, and calls the real function', async () => {
    const before = await page.evaluate(() => window.__yapperEnterCount);
    await typeAndEnter('/kick @sam');
    assert.strictEqual(await val(), '', 'the command text itself is cleared, never sent as a message');
    assert.strictEqual(await page.evaluate(() => window.__yapperEnterCount), before, 'the real send handler never saw this Enter');
    assert.ok(await page.evaluate(() => !!document.querySelector('.ym-modal')));
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head h2').textContent), '/kick @sam');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head p').textContent), 'Are you sure?');
    await confirmModal();
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'the dialog closed');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.kick), [['s1', 'u2']]);
    assert.deepStrictEqual(await lastToast(), ['sam was kicked.', 'info']);
  });
  await test('the same works from a click on the Send button, not just Enter', async () => {
    await page.fill(ta, '/ban @alex');
    await page.evaluate(() => { document.querySelector('.send-btn').disabled = false; });
    await page.click('.send-btn[aria-label="Send"]');
    await sleep(60);
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.ban), [['s1', 'u3']]);
    assert.deepStrictEqual(await lastToast(), ['alex was banned.', 'info']);
  });
  await test("turning the confirm option off runs danger commands immediately", async () => {
    await setOpt('SlashModeration', 'confirm', false);
    await typeAndEnter('/ban @sam');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'no dialog this time');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.ban.slice(-1)), [['s1', 'u2']]);
    assert.deepStrictEqual(await lastToast(), ['sam was banned.', 'info']);
    await setOpt('SlashModeration', 'confirm', true);
  });
  await test('non-danger commands (unban, unmute, nick, vunmute, vunban) never show the dialog, confirm option or not', async () => {
    await typeAndEnter('/unmute @sam');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 0, undefined]], 'unmute passes no reason argument at all, unlike mute');
    assert.deepStrictEqual(await lastToast(), ["sam's timeout was lifted.", 'info']);
  });
  await test('/mute: a plain duration, a duration with a reason, and no duration at all (defaults to 60 and the words become the reason)', async () => {
    await typeAndEnter('/mute @sam 10m');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 10, '']]);
    assert.deepStrictEqual(await lastToast(), ['sam is muted for 10 minutes.', 'info']);

    await typeAndEnter('/mute @sam 2h spamming the gif channel');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 120, 'spamming the gif channel']]);
    assert.deepStrictEqual(await lastToast(), ['sam is muted for 2 hours.', 'info']);

    await typeAndEnter('/mute @sam being rude');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 60, 'being rude']]);
    assert.deepStrictEqual(await lastToast(), ['sam is muted for 1 hour.', 'info']);

    await typeAndEnter('/mute @sam');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 60, '']]);
  });
  await test('/nick: sets it, clears it with no name, and refuses when the server has nicknames off', async () => {
    await typeAndEnter('/nick @sam Big Sam');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.nick.slice(-1)), [['s1', 'u2', 'Big Sam']]);
    assert.deepStrictEqual(await lastToast(), ['sam\'s nickname is now "Big Sam".', 'info']);

    await typeAndEnter('/nick @sam');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.nick.slice(-1)), [['s1', 'u2', '']]);
    assert.deepStrictEqual(await lastToast(), ["sam's nickname was cleared.", 'info']);

    await page.evaluate(() => { window.__flags.nicknames = false; });
    const nBefore = await page.evaluate(() => window.__calls.nick.length);
    await typeAndEnter('/nick @sam Nope');
    assert.strictEqual(await page.evaluate(() => window.__calls.nick.length), nBefore, 'setNickname was never called');
    assert.deepStrictEqual(await lastToast(), ["Server nicknames aren't turned on for this server.", 'error']);
    await page.evaluate(() => { window.__flags.nicknames = true; });
  });
  await test('unban by plain username, looked up from the real ban list (they are no longer a member)', async () => {
    await typeAndEnter('/unban ghosty');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.unban), [['s1', 'uBanned']]);
    assert.deepStrictEqual(await lastToast(), ['ghosty was unbanned.', 'info']);
    await typeAndEnter('/unban nobody');
    assert.deepStrictEqual(await lastToast(), ["nobody isn't banned here.", 'error']);
  });
  await test('a danger command checks your permission before it even asks "are you sure?" - missing the role, no dialog at all', async () => {
    await setPerms({ timeout_members: false });
    const before = await page.evaluate(() => window.__calls.timeout.length);
    await typeAndEnter('/mute @sam');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'no dialog - lacking the role is checked first, not after confirming');
    assert.strictEqual(await page.evaluate(() => window.__calls.timeout.length), before, 'never ran');
    assert.deepStrictEqual(await lastToast(), ["You don't have permission to do that here.", 'error']);
    await setPerms({ timeout_members: true });
  });
  await test("voice commands: need a shared voice channel, respect voiceModPerms, and don't need one to voice-ban", async () => {
    await typeAndEnter('/vmute @sam 5m');
    await confirmModal();
    assert.deepStrictEqual(await lastToast(), ["That person isn't in a voice channel with you right now.", 'error']);

    await page.evaluate(() => { window.__voiceChannelOf.u2 = 'vc1'; });
    await typeAndEnter('/vmute @sam 5m');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vmute.slice(-1)), [['vc1', 'u2', 5]]);
    assert.deepStrictEqual(await lastToast(), ['sam is muted in voice for 5 minutes.', 'info']);

    await typeAndEnter('/vunmute @sam');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vunmute), [['vc1', 'u2']]);

    await page.evaluate(() => { window.__voicePerms.move = false; });
    await typeAndEnter('/vkick @sam');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'already sharing a voice channel, so the permission is known up front - no dialog');
    assert.deepStrictEqual(await lastToast(), ["You don't have permission to do that here.", 'error']);
    await page.evaluate(() => { window.__voicePerms.move = true; });
    await typeAndEnter('/vkick @sam');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vkick), [['vc1', 'u2']]);

    await page.evaluate(() => { window.__flags.voice_ban = false; });
    await typeAndEnter('/vban @sam 1h');
    await confirmModal();
    assert.deepStrictEqual(await lastToast(), ["Voice bans aren't turned on for this server.", 'error']);
    await page.evaluate(() => { window.__flags.voice_ban = true; });
    await typeAndEnter('/vban @sam 1h spam');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vban.slice(-1)), [['s1', 'u2', 60, 'spam']]);
    assert.deepStrictEqual(await lastToast(), ['sam is banned from voice for 1 hour.', 'info']);
    await typeAndEnter('/vban @sam permanent');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vban.slice(-1)), [['s1', 'u2', null, '']]);
    assert.deepStrictEqual(await lastToast(), ['sam is banned from voice permanently.', 'info']);
  });
  await test('voice-unban by plain username, looked up from the real voice-ban list', async () => {
    await typeAndEnter('/vunban shade');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.vunban), [['s1', 'uVBanned']]);
    assert.deepStrictEqual(await lastToast(), ['shade can join voice again.', 'info']);
  });
  await test('/timeout is just Discord\'s own name for /mute - same confirm dialog, same real call', async () => {
    await typeAndEnter('/timeout @sam 10m being loud');
    assert.ok(await page.evaluate(() => !!document.querySelector('.ym-modal')), 'still a danger command - same confirm step as /mute');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal-head h2').textContent), '/timeout @sam 10m being loud');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.timeout.slice(-1)), [['s1', 'u2', 10, 'being loud']]);
    assert.deepStrictEqual(await lastToast(), ['sam is muted for 10 minutes.', 'info']);
  });
  await test('/msg opens a DM by username and sends the rest as the message - no server, no permission, no confirm dialog', async () => {
    await typeAndEnter('/msg alex hey are you around');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'not a danger command - runs right away');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.msg), [['open', 'u3']]);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [['dm_u3', 'hey are you around']]);
    assert.deepStrictEqual(await lastToast(), ['Messaged alex.', 'info']);
  });
  await test('/msg with no message just opens the DM', async () => {
    await page.evaluate(() => { window.__calls.msg.length = 0; window.__calls.sent.length = 0; });
    await typeAndEnter('/msg sam');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.msg), [['open', 'u2']]);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [], 'sendMessage was never called');
    assert.deepStrictEqual(await lastToast(), ['Opened your DM with sam.', 'info']);
  });
  await test('/msg refuses an unknown name and messaging yourself, and needs no server-moderation permissions at all', async () => {
    await page.evaluate(() => { window.__calls.msg.length = 0; });
    await setPerms({ kick_members: false, ban_members: false, timeout_members: false, manage_nicknames: false });
    await typeAndEnter('/msg nobody hi');
    assert.deepStrictEqual(await lastToast(), ['Could not find "nobody".', 'error']);
    await typeAndEnter('/msg tarik hi');
    assert.deepStrictEqual(await lastToast(), ["That's you.", 'error']);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.msg), [], 'neither attempt actually opened or sent anything');
    await setPerms({ kick_members: true, ban_members: true, timeout_members: true, manage_nicknames: true });
  });
  await test('Built-In: /shrug, /tableflip and /unflip send the real message with the glyph appended - no confirm, no toast (the sent message speaks for itself)', async () => {
    await page.evaluate(() => { window.YapperMod.Store.setState({ activeChannelId: 'c1' }); window.__calls.sent.length = 0; window.__toasts.length = 0; });
    await typeAndEnter('/shrug dunno');
    await typeAndEnter('/tableflip ugh');
    await typeAndEnter('/unflip ok fine');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [
      ['c1', 'dunno ¯\\_(ツ)_/¯'],
      ['c1', 'ugh (╯°□°)╯︵ ┻━┻'],
      ['c1', 'ok fine ┬─┬ ノ( ゜-゜ノ)'],
    ]);
    assert.deepStrictEqual(await page.evaluate(() => window.__toasts), [], 'nothing popped up - the real message already went out');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.ym-modal')), null, 'not a danger command');
  });
  await test('Built-In: /shrug and /tableflip with no words at all just send the glyph alone', async () => {

    await page.evaluate(() => { window.__calls.sent.length = 0; });
    await typeAndEnter('/shrug ');
    await typeAndEnter('/tableflip ');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [['c1', '¯\\_(ツ)_/¯'], ['c1', '(╯°□°)╯︵ ┻━┻']]);
  });
  await test('Built-In: /spoiler and /me wrap the message, and refuse when there is nothing to wrap', async () => {
    await page.evaluate(() => { window.__calls.sent.length = 0; });
    await typeAndEnter('/spoiler the ending');
    await typeAndEnter('/me waves hello');
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [['c1', '||the ending||'], ['c1', '*waves hello*']]);
    await typeAndEnter('/spoiler ');
    assert.deepStrictEqual(await lastToast(), ['Say what to hide: /spoiler your message', 'error']);
    await typeAndEnter('/me ');
    assert.deepStrictEqual(await lastToast(), ["Say what you're doing: /me your action", 'error']);
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.sent), [['c1', '||the ending||'], ['c1', '*waves hello*']], 'the two refused attempts sent nothing new');
  });

  console.log('SlashModeration: the "/" command-name suggestion popup (same real markup as Yapper\'s own)');
  const menuNames = () => page.evaluate(() => [...document.querySelectorAll('.ym-cmd-menu button[role="option"] span:nth-child(2)')].map((s) => s.textContent));
  const menuOpen = () => page.evaluate(() => !!document.querySelector('.ym-cmd-menu'));

  await test('typing a partial command name suggests every command that starts with it, in the real .mention-menu shape', async () => {
    await page.fill(ta, '/v');
    await sleep(60);
    assert.deepStrictEqual((await menuNames()).sort(), ['vban', 'vkick', 'vmute', 'vunban', 'vunmute'].sort());
    assert.deepStrictEqual(await page.evaluate(() => { const m = document.querySelector('.ym-cmd-menu'); return { cls: m.className, role: m.getAttribute('role') }; }), { cls: 'mention-menu ym-cmd-menu', role: 'listbox' });
  });
  await test('ArrowDown/ArrowUp cycle the highlight; Tab completes the highlighted one with a trailing space', async () => {
    await page.fill(ta, '/vm');
    await sleep(60);
    assert.deepStrictEqual(await menuNames(), ['vmute']);
    await page.focus(ta);
    await page.keyboard.press('Tab');
    await sleep(60);
    assert.strictEqual(await val(), '/vmute ', 'completed to the full command name plus a space, ready for @user');
    assert.strictEqual(await menuOpen(), false, 'the popup closes itself once a space follows the command word - nothing left to suggest');
  });
  await test('Enter picks the highlighted suggestion instead of trying to run an incomplete command', async () => {
    await page.fill(ta, '/ki');
    await sleep(60);
    assert.deepStrictEqual(await menuNames(), ['kick']);
    const before = await page.evaluate(() => window.__calls.kick.length);
    await page.focus(ta);
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.strictEqual(await val(), '/kick ', 'Enter completed the command, it did not run it');
    assert.strictEqual(await page.evaluate(() => window.__calls.kick.length), before, 'nothing ran - there was no @user yet');
  });
  await test('Escape dismisses the popup; an unrecognised word (no match) never opens one', async () => {
    await page.fill(ta, '/ki');
    await sleep(60);
    assert.strictEqual(await menuOpen(), true);
    await page.focus(ta);
    await page.keyboard.press('Escape');
    await sleep(60);
    assert.strictEqual(await menuOpen(), false);
    await page.fill(ta, '/zzz');
    await sleep(60);
    assert.strictEqual(await menuOpen(), false, 'nothing starts with "zzz", so there is nothing to suggest');
    await page.fill(ta, '');
  });

  console.log('SlashModeration: standing aside for a REAL open popup (Yapper\'s own, or anything else sharing that markup), fixed to no longer misfire on an empty one');
  await test("Enter is left alone while a real \"/\" picker is open with something highlighted - it still gets to pick the suggestion, not run the command", async () => {
    await page.fill(ta, '/kick @sam');
    const before = await page.evaluate(() => window.__calls.kick.length);

    await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div class="mention-menu" role="listbox" id="fx-native-popup"><button role="option" aria-selected="true">whatever</button></div>'); });
    await page.focus(ta);
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.strictEqual(await page.evaluate(() => window.__calls.kick.length), before, "SlashModeration's own Enter handling stood aside for the open popup");
    assert.strictEqual(await val(), '/kick @sam', 'the text was left exactly as typed - nothing of ours touched it');
    await page.evaluate(() => { document.getElementById('fx-native-popup')?.remove(); });
    await typeAndEnter('/kick @sam');
    await confirmModal();
    assert.strictEqual(await page.evaluate(() => window.__calls.kick.length), before + 1, 'once the popup is gone, /kick runs normally again');
  });
  await test('an EMPTY "/" picker element (present in the DOM but nothing highlighted) no longer blocks Enter - this used to make /kick, /ban etc. look broken', async () => {
    await page.fill(ta, '/kick @sam');
    const before = await page.evaluate(() => window.__calls.kick.length);

    await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div class="mention-menu" role="listbox" id="fx-empty-popup"></div>'); });
    await page.focus(ta);
    await page.keyboard.press('Enter');
    await sleep(60);
    assert.ok(await page.evaluate(() => !!document.querySelector('.ym-modal')), 'an empty popup element no longer defers - the confirm dialog opened instead, same as with no popup at all');
    await confirmModal();
    assert.deepStrictEqual(await page.evaluate(() => window.__calls.kick.slice(-1)), [['s1', 'u2']]);
    assert.strictEqual(await page.evaluate(() => window.__calls.kick.length), before + 1);
    await page.evaluate(() => { document.getElementById('fx-empty-popup')?.remove(); });
  });

  await test('SlashModeration is registered and always on: runs without errors, and setEnabled(false) cannot stop it', async () => {
    const r = await page.evaluate(() => {
      const YM = window.YapperMod; const n = 'SlashModeration'; const p = YM.plugins.get(n);
      YM.plugins.setEnabled(n, true); const ran = YM.plugins.isRunning(n); const err = YM.plugins.errors.get(n); YM.plugins.setEnabled(n, false);
      return { ok: !!p && ran && !err && YM.plugins.isRunning(n) && !!p.alwaysOn, err: err && String(err.message || err) };
    });
    assert.ok(r.ok, r.err || 'SlashModeration should be running and always on');
    assert.deepStrictEqual(site.consoleLog.filter((m) => m.type === 'pageerror').map((m) => m.text.slice(0, 200)), []);
  });

  await site.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? '\n' + failed + ' of ' + results.length + ' tests FAILED' : '\nall ' + results.length + ' tests passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
