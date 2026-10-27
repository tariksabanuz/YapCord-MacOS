

(function () {
  const KEY = 'pluginData.MessageReminders';
  const MAX_ITEMS = 100;
  const MAX_AHEAD = 30 * 24 * 3600 * 1000;
  const SNIPPET_LEN = 160;
  const h = (...a) => YM.dom.h(...a);

  const isItem = (x) => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.channelId === 'string' && typeof x.messageId === 'string' && Number.isFinite(x.at);
  const read = () => {
    const v = YM.settings.get(KEY, []);
    return Array.isArray(v) ? v.filter(isItem).slice(0, MAX_ITEMS).sort((a, b) => a.at - b.at) : [];
  };
  const write = (list) => YM.settings.set(KEY, list.filter(isItem).slice(0, MAX_ITEMS));
  const uid = () => 'rem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  function validate({ channelId, messageId, snippet, at }, now = Date.now()) {
    if (!channelId || !messageId) return { ok: false, error: 'No message to remind you about.' };
    if (!Number.isFinite(at)) return { ok: false, error: 'Pick a date and time.' };
    if (at < now + 5000) return { ok: false, error: 'Pick a time in the future.' };
    if (at > now + MAX_AHEAD) return { ok: false, error: 'You can set a reminder up to 30 days ahead.' };
    if (read().length >= MAX_ITEMS) return { ok: false, error: 'You already have ' + MAX_ITEMS + ' reminders waiting.' };
    return { ok: true, item: { id: uid(), channelId, messageId, snippet: String(snippet || '').slice(0, SNIPPET_LEN), at: Math.round(at), created: now } };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const toLocalInput = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const whenText = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function channelLabel(id) {
    const st = YM.Store.isReady ? YM.Store.getState() : null;
    const c = st && st.channels && st.channels[id];
    if (!c) return 'a chat';
    if (c.server_id) { const sv = st.servers && st.servers[c.server_id]; return '#' + (c.name || 'chat') + (sv ? ' in ' + sv.name : ''); }
    return 'DM with ' + (c.name || 'someone');
  }
  const tomorrow9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); };
  function authorName(message) {
    if (!message) return 'someone';
    const p = YM.Store.profile(message.author_id);
    return (p && (p.display_name || p.username)) || 'someone';
  }

  YM.definePlugin({
    name: 'MessageReminders',
    description: "Right-click a message and pick a time to be reminded about it: a notification, a toast, and a highlight if you're already looking at that chat.",
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    api: { read, validate, toLocalInput, MAX_ITEMS },
    options: {
      manage: { type: 'custom', default: false, render: (box) => renderManager(box) },
    },
    start(ctx) {
      const jump = YM.finder.lazy(['jumpToMessage']);
      const BELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

      const rows = new Map();
      ctx.cleanup(YM.messages.decorate(({ el, id }) => { rows.set(id, el); }));

      const flash = (messageId) => {
        const el = rows.get(messageId);
        if (!el || !el.isConnected) return false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('ym-rem-flash');
        setTimeout(() => el.classList.remove('ym-rem-flash'), 1500);
        return true;
      };

      const fire = (item) => {
        const st = YM.Store.getState();
        const onThisChannel = st && st.activeChannelId === item.channelId;
        const text = item.snippet ? '"' + item.snippet + '"' : 'that message';
        if (onThisChannel) {
          const mod = jump();
          if (mod && mod.jumpToMessage) { try { mod.jumpToMessage(item.messageId); } catch (_) {} }
          flash(item.messageId);
          YM.toast('Reminder: ' + text);
        } else {
          YM.toast('Reminder: ' + text + ' - in ' + channelLabel(item.channelId));
        }
        if (typeof Notification === 'function' && Notification.permission === 'granted') {
          try {
            const n = new Notification('Reminder', { body: text + ' - ' + channelLabel(item.channelId), tag: 'ym-reminder-' + item.id });
            n.onclick = () => { try { window.focus(); } catch (_) {} };
          } catch (_) {  }
        }
      };
      const tick = () => {
        if (!YM.Store.isReady) return;
        const now = Date.now();
        const list = read();
        const due = list.filter((it) => it.at <= now);
        if (!due.length) return;
        write(list.filter((it) => it.at > now));
        due.forEach(fire);
      };
      ctx.interval(tick, 5000);
      ctx.timeout(tick, 1500);

      const openEditor = (channelId, messageId, snippet) => {
        const when = h('input', { type: 'datetime-local', value: toLocalInput(Date.now() + 600000), 'aria-label': 'Remind me at' });
        const err = h('div', { class: 'ym-sm-err', role: 'alert' });
        const preset = (label, ms) => h('button', { type: 'button', class: 'ym-btn ym-btn-small ym-btn-ghost', onClick: () => { when.value = toLocalInput(typeof ms === 'function' ? ms() : Date.now() + ms); } }, label);
        YM.modal.open({
          title: 'Remind me about this message',
          subtitle: snippet ? '"' + snippet + '"' : undefined,
          body: h('div', {},
            h('div', { class: 'ym-toolbar' }, h('label', {}, 'Remind me at '), when),
            h('div', { class: 'ym-toolbar', style: { marginTop: '6px' } }, preset('In 10 minutes', 600000), preset('In 1 hour', 3600000), preset('Tomorrow 9:00', tomorrow9)),
            err),
          buttons: [{ label: 'Set reminder', onClick: (close) => {
            const r = validate({ channelId, messageId, snippet, at: new Date(when.value).getTime() });
            if (!r.ok) { err.textContent = r.error; return; }
            write([...read(), r.item]);
            YM.toast('Reminder set for ' + whenText(r.item.at) + '.');
            close();
          } }],
        });
      };

      let pending = null;
      const onContext = (e) => {
        const row = e.target instanceof Element ? e.target.closest('.msg[data-message-id]') : null;
        const id = row ? row.getAttribute('data-message-id') : null;
        const msg = id ? YM.Store.findMessage(id) : null;
        const st = YM.Store.getState();
        pending = msg && st ? { messageId: id, channelId: st.activeChannelId, snippet: (msg.content || '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LEN) || (authorName(msg) + "'s message"), at: Date.now() } : null;
      };
      document.addEventListener('contextmenu', onContext, true);
      ctx.cleanup(() => document.removeEventListener('contextmenu', onContext, true));
      const ui = () => {
        document.querySelectorAll('.ctx-menu').forEach((menu) => {
          if (!pending || Date.now() - pending.at > 3000 || menu.querySelector('.ym-rem-menu')) return;
          const { messageId, channelId, snippet } = pending;
          menu.append(h('button', { type: 'button', role: 'menuitem', class: 'ym-rem-menu', html: BELL + ' Remind me...', onClick: () => {
            const overlay = menu.closest('.overlay');
            if (overlay) overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            openEditor(channelId, messageId, snippet);
          } }));
        });
        if (!document.querySelector('.ctx-menu') && pending && Date.now() - pending.at > 400) pending = null;
      };
      ctx.onMutate(ui);
      ctx.cleanup(() => document.querySelectorAll('.ym-rem-menu').forEach((n) => n.remove()));

      ctx.css('.ym-rem-menu{display:flex;align-items:center;gap:8px}.ym-rem-menu svg{flex:none}.msg.ym-rem-flash{outline:2px solid var(--accent,#ff6b4a);outline-offset:-2px;border-radius:8px;transition:outline-color .3s}');
    },
  });

  function renderManager(box) {
    box.style.flexDirection = 'column';
    box.style.alignItems = 'stretch';
    const list = h('div', { class: 'ym-csi-list' });
    const draw = () => {
      const items = read();
      list.replaceChildren();
      if (!items.length) { list.append(h('div', { class: 'hint' }, 'Nothing waiting. Right-click a message and choose "Remind me...".')); return; }
      for (const it of items) {
        list.append(h('div', { class: 'ym-csi-item', style: { alignItems: 'flex-start' } },
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'ym-csi-name' }, whenText(it.at) + ' · ' + channelLabel(it.channelId)), it.snippet && h('div', { class: 'hint', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, '"' + it.snippet + '"')),
          h('button', { type: 'button', class: 'ym-btn ym-btn-small ym-btn-ghost', onClick: () => { write(read().filter((x) => x.id !== it.id)); } }, 'Cancel')));
      }
    };
    const off = YM.settings.onPath(KEY, draw);
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    box.append(h('div', { class: 'toggle-label' }, 'Reminders'), h('div', { class: 'hint' }, 'They are checked by YapCord, so YapCord has to be open around that time.'), list);
    draw();
  }
})();
