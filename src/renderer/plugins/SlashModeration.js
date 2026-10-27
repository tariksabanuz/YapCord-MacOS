

(function () {
  const PREFIX = /^\/(\w+)(?:\s+([\s\S]*))?$/;
  const MINUTES_PER = { m: 1, h: 60, d: 1440 };

  const META = [
    { name: 'kick', hint: '@user', desc: 'Kick someone from this server.', danger: true, perm: 'kick_members' },
    { name: 'ban', hint: '@user', desc: 'Ban someone from this server.', danger: true, perm: 'ban_members' },
    { name: 'unban', hint: 'username', desc: "Lift a ban on this server (they're no longer a member, so no @mention).", perm: 'ban_members' },
    { name: 'mute', hint: '@user [time] [reason]', desc: 'Stop someone from chatting for a while (default 1 hour). Time like 10m, 2h, 7d.', danger: true, perm: 'timeout_members' },
    { name: 'unmute', hint: '@user', desc: "Lift someone's timeout early.", perm: 'timeout_members' },
    { name: 'timeout', hint: '@user [time] [reason]', desc: 'Same as /mute - Discord\'s own name for the same action.', danger: true, perm: 'timeout_members' },
    { name: 'nick', hint: '@user [name]', desc: "Change someone's nickname on this server (empty name clears it). Needs Yapper's nicknames feature on for this server.", perm: 'manage_nicknames' },
    { name: 'msg', hint: 'username [message]', desc: "Open a DM with someone (and send it, if you typed one). Doesn't need a server - works anywhere.", needsMods: false },
    { name: 'shrug', hint: '[message]', desc: 'Sends your message (or nothing) with a shrug face at the end: ¯\\_(ツ)_/¯', needsMods: false, group: 'Built-In' },
    { name: 'tableflip', hint: '[message]', desc: 'Sends your message (or nothing) with a table flip at the end: (╯°□°)╯︵ ┻━┻', needsMods: false, group: 'Built-In' },
    { name: 'unflip', hint: '[message]', desc: 'Sends your message (or nothing) with the table put back: ┬─┬ ノ( ゜-゜ノ)', needsMods: false, group: 'Built-In' },
    { name: 'spoiler', hint: 'message', desc: 'Sends your message hidden behind a spoiler tag.', needsMods: false, group: 'Built-In' },
    { name: 'me', hint: 'message', desc: 'Sends your message as an action/narration, like *waves*.', needsMods: false, group: 'Built-In' },
    { name: 'vmute', hint: '@user [time]', desc: 'Mute someone in the voice channel you share (default 10 minutes).', danger: true, voice: true },
    { name: 'vunmute', hint: '@user', desc: 'Unmute someone in the voice channel you share.', voice: true },
    { name: 'vkick', hint: '@user', desc: 'Disconnect someone from the voice channel you share.', danger: true, voice: true },
    { name: 'vban', hint: '@user [time|permanent] [reason]', desc: 'Ban someone from joining voice on this server.', danger: true, voice: true },
    { name: 'vunban', hint: '@user', desc: 'Lift a voice ban on this server.', voice: true },
  ];

  function parseDuration(token, { allowPermanent = false } = {}) {
    if (!token) return undefined;
    const t = token.toLowerCase();
    if (['off', '0', 'remove', 'none'].includes(t)) return 0;
    if (allowPermanent && ['permanent', 'perm', 'forever'].includes(t)) return null;
    const m = /^(\d+)(m|h|d)?$/.exec(t);
    return m ? Number(m[1]) * (MINUTES_PER[m[2] || 'm'] || 1) : undefined;
  }

  function splitFirst(text) {
    const m = /^(\S+)\s*([\s\S]*)$/.exec(text || '');
    return m ? { head: m[1], rest: m[2].trim() } : { head: '', rest: '' };
  }

  function findMember(state, serverId, token) {
    if (!token) return null;
    const name = token.replace(/^@/, '').toLowerCase();
    const ids = (state.serverMembers && state.serverMembers[serverId]) || [];
    const id = ids.find((uid) => ((state.profiles[uid] && state.profiles[uid].username) || '').toLowerCase() === name);
    return id ? { id, username: state.profiles[id].username } : null;
  }

  async function findBanned(loadRows, token) {
    if (!token) return null;
    const name = token.replace(/^@/, '').toLowerCase();
    const rows = await loadRows();
    const state = YM.Store.getState();
    for (const row of rows) {
      const p = state.profiles[row.user_id];
      if (p && (p.username || '').toLowerCase() === name) return { id: row.user_id, username: p.username };
    }
    return null;
  }

  const fmtDuration = (mins) => (mins === null ? 'permanently' : mins === 0 ? 'for 0 minutes (lifted)' : mins % 1440 === 0 ? `for ${mins / 1440} day${mins === 1440 ? '' : 's'}` : mins % 60 === 0 ? `for ${mins / 60} hour${mins === 60 ? '' : 's'}` : `for ${mins} minutes`);

  function setTextareaValue(ta, value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function buildTable(mods) {
    const need = (state, serverId, perm) => {
      if (!YM.Store.isReady || !serverId) throw new Error('Open a server first.');
      if (!mods.hasPerm(state, serverId, perm)) throw new Error("You don't have permission to do that here.");
    };
    const needVoice = (state, serverId, userId, kind) => {
      const channelId = mods.voiceChannelOf(state, serverId, userId);
      if (!channelId) throw new Error("That person isn't in a voice channel with you right now.");
      if (!mods.voiceModPerms(state, serverId, userId)[kind]) throw new Error("You don't have permission to do that here.");
      return channelId;
    };
    const RUN = {
      kick: async (state, serverId, rest) => {
        need(state, serverId, 'kick_members');
        const target = findMember(state, serverId, splitFirst(rest).head);
        if (!target) throw new Error('Say who: /kick @username');
        if (target.id === state.userId) throw new Error("You can't kick yourself.");
        await mods.kickMember(serverId, target.id);
        return `${target.username} was kicked.`;
      },
      ban: async (state, serverId, rest) => {
        need(state, serverId, 'ban_members');
        const target = findMember(state, serverId, splitFirst(rest).head);
        if (!target) throw new Error('Say who: /ban @username');
        if (target.id === state.userId) throw new Error("You can't ban yourself.");
        await mods.banMember(serverId, target.id);
        return `${target.username} was banned.`;
      },
      unban: async (state, serverId, rest) => {
        need(state, serverId, 'ban_members');
        const { head } = splitFirst(rest);
        if (!head) throw new Error('Say who: /unban username');
        const target = await findBanned(() => mods.loadBans(serverId), head);
        if (!target) throw new Error(`${head.replace(/^@/, '')} isn't banned here.`);
        await mods.unbanMember(serverId, target.id);
        return `${target.username} was unbanned.`;
      },
      mute: async (state, serverId, rest) => {
        need(state, serverId, 'timeout_members');
        const { head, rest: afterUser } = splitFirst(rest);
        const target = findMember(state, serverId, head);
        if (!target) throw new Error('Say who: /mute @username [time] [reason]');
        const { head: durTok, rest: reason } = splitFirst(afterUser);
        let minutes = parseDuration(durTok);
        let why = reason;
        if (minutes === undefined) { minutes = 60; why = afterUser; }
        await mods.timeoutMember(serverId, target.id, minutes, (why || '').slice(0, 200));
        return `${target.username} is muted ${fmtDuration(minutes)}.`;
      },
      unmute: async (state, serverId, rest) => {
        need(state, serverId, 'timeout_members');
        const target = findMember(state, serverId, splitFirst(rest).head);
        if (!target) throw new Error('Say who: /unmute @username');
        await mods.timeoutMember(serverId, target.id, 0);
        return `${target.username}'s timeout was lifted.`;
      },
      nick: async (state, serverId, rest) => {
        need(state, serverId, 'manage_nicknames');
        if (!mods.isFlagOn('nicknames', serverId)) throw new Error("Server nicknames aren't turned on for this server.");
        const { head, rest: name } = splitFirst(rest);
        const target = findMember(state, serverId, head);
        if (!target) throw new Error('Say who: /nick @username [new name]');
        await mods.setNickname(serverId, target.id, name);
        return name ? `${target.username}'s nickname is now "${name}".` : `${target.username}'s nickname was cleared.`;
      },
      vmute: async (state, serverId, rest) => {
        const { head, rest: durTok } = splitFirst(rest);
        const target = findMember(state, serverId, head);
        if (!target) throw new Error('Say who: /vmute @username [time]');
        const channelId = needVoice(state, serverId, target.id, 'mute');
        let minutes = parseDuration(durTok);
        if (minutes === undefined) minutes = 10;
        await mods.muteInVoice(channelId, target.id, minutes);
        return `${target.username} is muted in voice ${fmtDuration(minutes)}.`;
      },
      vunmute: async (state, serverId, rest) => {
        const target = findMember(state, serverId, splitFirst(rest).head);
        if (!target) throw new Error('Say who: /vunmute @username');
        const channelId = needVoice(state, serverId, target.id, 'mute');
        await mods.unmuteInVoice(channelId, target.id);
        return `${target.username} can talk in voice again.`;
      },
      vkick: async (state, serverId, rest) => {
        const target = findMember(state, serverId, splitFirst(rest).head);
        if (!target) throw new Error('Say who: /vkick @username');
        const channelId = needVoice(state, serverId, target.id, 'move');
        await mods.kickFromVoice(channelId, target.id);
        return `${target.username} was disconnected from voice.`;
      },
      vban: async (state, serverId, rest) => {
        const { head, rest: afterUser } = splitFirst(rest);
        const target = findMember(state, serverId, head);
        if (!target) throw new Error('Say who: /vban @username [time|permanent] [reason]');
        if (!mods.isFlagOn('voice_ban', serverId)) throw new Error("Voice bans aren't turned on for this server.");
        if (!mods.voiceModPerms(state, serverId, target.id).move) throw new Error("You don't have permission to do that here.");
        const { head: durTok, rest: reason } = splitFirst(afterUser);
        let minutes = parseDuration(durTok, { allowPermanent: true });
        let why = reason;
        if (minutes === undefined) { minutes = null; why = afterUser; }
        await mods.voiceBan(serverId, target.id, minutes, (why || '').slice(0, 200));
        return `${target.username} is banned from voice ${fmtDuration(minutes)}.`;
      },
      vunban: async (state, serverId, rest) => {
        const { head } = splitFirst(rest);
        if (!head) throw new Error('Say who: /vunban @username');
        const target = findMember(state, serverId, head) || (await findBanned(() => mods.loadVoiceBans(serverId), head));
        if (!target) throw new Error(`${head.replace(/^@/, '')} has no voice ban here.`);
        await mods.voiceUnban(serverId, target.id);
        return `${target.username} can join voice again.`;
      },
    };
    RUN.timeout = RUN.mute;

    RUN.msg = async (state, serverId, rest) => {
      const live = YM.Store.live();
      if (!live || typeof live.openDmWith !== 'function') throw new Error("Could not find Yapper's own message function.");
      const { head, rest: text } = splitFirst(rest);
      if (!head) throw new Error('Say who: /msg username [message]');
      const target = YM.people.byName(head);
      if (!target) throw new Error(`Could not find "${head.replace(/^@/, '')}".`);
      if (target.id === state.userId) throw new Error("That's you.");
      await live.openDmWith(target.id);
      if (text && typeof live.sendMessage === 'function') {
        const after = YM.Store.getState();
        if (after && after.activeChannelId) {
          try { await live.sendMessage(after.activeChannelId, text); } catch (_) {  }
        }
      }
      return text ? `Messaged ${target.username}.` : `Opened your DM with ${target.username}.`;
    };

    async function sendExpanded(state, text) {
      const live = YM.Store.live();
      if (!live || typeof live.sendMessage !== 'function') throw new Error("Could not find Yapper's own message function.");
      if (!state.activeChannelId) throw new Error('Open a chat first.');
      await live.sendMessage(state.activeChannelId, text);
      return '';
    }
    RUN.shrug = async (state, serverId, rest) => sendExpanded(state, rest ? `${rest} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯');
    RUN.tableflip = async (state, serverId, rest) => sendExpanded(state, rest ? `${rest} (╯°□°)╯︵ ┻━┻` : '(╯°□°)╯︵ ┻━┻');
    RUN.unflip = async (state, serverId, rest) => sendExpanded(state, rest ? `${rest} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)');
    RUN.spoiler = async (state, serverId, rest) => {
      if (!rest) throw new Error('Say what to hide: /spoiler your message');
      return sendExpanded(state, `||${rest}||`);
    };
    RUN.me = async (state, serverId, rest) => {
      if (!rest) throw new Error("Say what you're doing: /me your action");
      return sendExpanded(state, `*${rest}*`);
    };

    return META.map((m) => ({ ...m, run: RUN[m.name] }));
  }

  const plugin = YM.definePlugin({
    name: 'SlashModeration',
    description: "Type /kick, /ban, /unban, /mute, /unmute, /timeout, /nick or /msg, or /vmute, /vunmute, /vkick, /vban, /vunban for voice, in the message box - the same real actions and the same real permissions as Yapper's own right-click menu, just faster to reach. Also the classic Discord shortcuts: /shrug, /tableflip, /unflip, /spoiler and /me.",
    authors: ['YapCord'],
    tags: ['Servers', 'Utility'],
    alwaysOn: true,
    options: {
      confirm: { type: 'boolean', default: true, description: 'Ask "Are you sure?" before /kick, /ban, /mute, /vmute, /vkick or /vban' },
    },
    start(ctx) {

      const textMods = YM.finder.lazy(['kickMember', 'banMember', 'unbanMember', 'timeoutMember', 'setNickname', 'loadBans']);
      const voiceMods = YM.finder.lazy(['loadVoiceBans', 'voiceModPerms', 'voiceChannelOf', 'muteInVoice', 'unmuteInVoice', 'kickFromVoice', 'voiceBan', 'voiceUnban']);
      const permMods = YM.finder.lazy(['hasPerm']);
      const flagMods = YM.finder.lazy(['isFlagOn']);
      let merged = null;
      const mods = () => {
        if (merged) return merged;
        const a = textMods();
        const b = voiceMods();
        const c = permMods();
        const d = flagMods();
        if (!a || !b || !c || !d) return null;
        return (merged = { ...a, ...b, ...c, ...d });
      };

      plugin.api.ready = () => !!mods();

      let table = null;
      const commands = () => {
        if (table) return table;
        const m = mods();
        return m ? (table = buildTable(m)) : buildTable(null);
      };

      function recognize(text) {
        const m = PREFIX.exec(String(text || '').trim());
        if (!m) return null;
        const cmd = commands().find((c) => c.name === m[1].toLowerCase());
        return cmd ? { cmd, rest: (m[2] || '').trim() } : null;
      }

      async function execute(cmd, rest) {
        if (cmd.needsMods !== false && !mods()) { YM.toast("Could not find Yapper's own moderation functions.", { type: 'error' }); return; }

        cmd = commands().find((c) => c.name === cmd.name) || cmd;
        const state = YM.Store.getState();
        const serverId = state && state.activeServerId;
        try {

          const msg = await cmd.run(state, serverId, rest);
          if (msg) YM.toast(msg);
        } catch (err) {
          YM.toast((err && err.message) || String(err), { type: 'error' });
        }
      }

      function permissionError(cmd, state, serverId, rest) {
        const m = mods();
        if (!m || !YM.Store.isReady || !serverId) return null;
        if (cmd.perm) return m.hasPerm(state, serverId, cmd.perm) ? null : "You don't have permission to do that here.";
        if (cmd.voice) {
          const target = findMember(state, serverId, splitFirst(rest).head);
          if (!target) return null;
          const channelId = m.voiceChannelOf(state, serverId, target.id);
          if (!channelId) return null;
          const kind = cmd.name === 'vmute' || cmd.name === 'vunmute' ? 'mute' : 'move';
          return m.voiceModPerms(state, serverId, target.id)[kind] ? null : "You don't have permission to do that here.";
        }
        return null;
      }

      function runFromText(textarea) {
        const hit = recognize(textarea.value);
        if (!hit) return false;
        setTextareaValue(textarea, '');
        const state = YM.Store.getState();
        const serverId = state && state.activeServerId;
        const permError = permissionError(hit.cmd, state, serverId, hit.rest);
        if (permError) {
          YM.toast(permError, { type: 'error' });
          return true;
        }
        if (ctx.settings.store.confirm && hit.cmd.danger) {
          YM.modal.open({
            title: `/${hit.cmd.name} ${hit.rest}`.trim(),
            subtitle: 'Are you sure?',
            buttons: [{ label: 'Do it', danger: true, onClick: (close) => { close(); execute(hit.cmd, hit.rest); } }],
          });
        } else {
          execute(hit.cmd, hit.rest);
        }
        return true;
      }

      const h = YM.dom.h;
      let menu = null;
      let menuList = [];
      let menuIndex = 0;
      function hideMenu() { if (menu) menu.remove(); menu = null; menuList = []; }

      function matchingCommands(word) {
        const w = word.slice(1).toLowerCase();
        if (!w) return [];
        return commands().filter((c) => c.name.startsWith(w));
      }

      function renderMenu(ta) {
        const composer = ta.closest('.composer');
        if (!composer) return hideMenu();
        const rows = menuList.map((c, i) => h('button', {
          type: 'button', role: 'option', 'aria-selected': i === menuIndex ? 'true' : 'false', class: i === menuIndex ? 'on' : '',
          onMouseDown: (e) => { e.preventDefault(); pickCommand(ta, c); },
        },
          h('span', { class: 'mention-all' }, '/'),
          h('span', {}, c.name),
          h('span', { class: 'hint cmd-desc' }, c.hint ? c.name + ' ' + c.hint : c.desc),
          h('span', { class: 'hint cmd-bot' }, 'YapCord')));
        const next = h('div', { class: 'mention-menu ym-cmd-menu', role: 'listbox' }, h('div', { class: 'emoji-section', style: { padding: '6px 10px 4px' } }, 'Commands'), ...rows);
        if (menu && menu.parentElement === composer) menu.replaceWith(next);
        else { hideMenu(); composer.append(next); }
        menu = next;
        const current = menu.querySelector('button.on');
        if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
      }

      function pickCommand(ta, c) {
        setTextareaValue(ta, '/' + c.name + ' ');
        hideMenu();
        ta.focus();
      }

      function refreshMenu(ta) {
        const m = /^(\/\w*)$/.exec(ta.value);
        const list = m ? matchingCommands(m[1]) : [];
        if (!list.length) return hideMenu();
        menuIndex = Math.min(menuIndex, list.length - 1);
        menuList = list;
        renderMenu(ta);
      }

      const onKeydown = (e) => {
        const ta = e.target;
        if (!(ta instanceof HTMLTextAreaElement) || !ta.closest('.composer')) return;
        if (menu && menuList.length) {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault(); e.stopImmediatePropagation();
            menuIndex = (menuIndex + (e.key === 'ArrowDown' ? 1 : menuList.length - 1)) % menuList.length;
            renderMenu(ta);
            return;
          }
          if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hideMenu(); return; }
          if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && !e.shiftKey)) {
            e.preventDefault(); e.stopImmediatePropagation();
            pickCommand(ta, menuList[menuIndex]);
            return;
          }
        }
        if (e.key !== 'Enter' || e.shiftKey) return;

        const native = document.querySelector('.mention-menu[role="listbox"]');
        if (native && native !== menu && native.querySelector('[role="option"][aria-selected="true"]')) return;
        if (runFromText(ta)) { e.preventDefault(); e.stopImmediatePropagation(); }
      };
      const onInput = (e) => {
        const ta = e.target;
        if (ta instanceof HTMLTextAreaElement && ta.closest('.composer')) refreshMenu(ta);
      };
      const onClick = (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('.composer .send-btn[aria-label="Send"]');
        if (!btn) return;
        const composer = btn.closest('.composer');
        const ta = composer && composer.querySelector('textarea');
        if (!ta) return;
        if (runFromText(ta)) { e.preventDefault(); e.stopImmediatePropagation(); }
      };
      const onFocusOut = (e) => { if (e.target instanceof HTMLTextAreaElement) setTimeout(hideMenu, 120); };
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('input', onInput, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('focusout', onFocusOut, true);
      ctx.cleanup(() => {
        document.removeEventListener('keydown', onKeydown, true);
        document.removeEventListener('input', onInput, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('focusout', onFocusOut, true);
        hideMenu();
      });
    },
  });
})();
