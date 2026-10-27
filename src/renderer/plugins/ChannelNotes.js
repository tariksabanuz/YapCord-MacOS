

(function () {
  const KEY = 'pluginData.ChannelNotes';
  const MAX_LEN = 300;
  const MAX_ITEMS = 500;
  const h = (...a) => YM.dom.h(...a);

  const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  const read = () => {
    const v = YM.settings.get(KEY, {});
    const out = {};
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [id, note] of Object.entries(v)) {
        const c = clean(note);
        if (c && /^[\w-]{1,64}$/.test(id) && Object.keys(out).length < MAX_ITEMS) out[id] = c;
      }
    }
    return out;
  };
  const set = (channelId, note) => {
    const m = read();
    const c = clean(note);
    if (c) m[channelId] = c; else delete m[channelId];
    YM.settings.set(KEY, m);
  };

  function channelOf(id) {
    const st = YM.Store.isReady ? YM.Store.getState() : null;
    return (st && st.channels && st.channels[id]) || null;
  }
  function label(id) {
    const c = channelOf(id);
    if (!c) return 'this channel';
    if (c.server_id) { const st = YM.Store.getState(); const sv = st.servers && st.servers[c.server_id]; return '#' + (c.name || 'channel') + (sv ? ' in ' + sv.name : ''); }
    return c.name || 'this chat';
  }

  function openEditor(channelId) {
    const ta = h('textarea', { class: 'ym-sm-text-in', rows: 4, maxlength: MAX_LEN, placeholder: 'Only you see this note.', 'aria-label': 'Note' });
    ta.value = read()[channelId] || '';
    return YM.modal.open({
      title: 'Channel note',
      subtitle: label(channelId),
      body: h('div', {}, ta, h('div', { class: 'ym-sub-hint', style: { marginTop: '8px' } }, 'Nothing here is sent to Yapper or shown to anyone else.')),
      buttons: [
        { label: 'Save', onClick: (close) => { set(channelId, ta.value); close(); } },
        read()[channelId] ? { label: 'Remove note', danger: true, onClick: (close) => { set(channelId, ''); close(); } } : null,
      ].filter(Boolean),
    });
  }

  function renderManager(box) {
    box.style.flexDirection = 'column';
    box.style.alignItems = 'stretch';
    const list = h('div', { class: 'ym-csi-list' });
    const draw = () => {
      const m = read();
      list.replaceChildren();
      const ids = Object.keys(m).sort((a, b) => label(a).localeCompare(label(b)));
      if (!ids.length) { list.append(h('div', { class: 'hint' }, 'No notes yet. Right-click a channel and choose "Channel note...".')); return; }
      for (const id of ids) {
        list.append(h('div', { class: 'ym-csi-item', style: { alignItems: 'flex-start' } },
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'ym-csi-name' }, label(id)), h('div', { class: 'hint' }, m[id])),
          h('button', { type: 'button', class: 'ym-btn ym-btn-small', onClick: () => openEditor(id) }, 'Edit'),
          h('button', { type: 'button', class: 'ym-btn ym-btn-small ym-btn-ghost', onClick: () => { set(id, ''); draw(); } }, 'Remove')));
      }
    };
    const off = YM.settings.onPath(KEY, draw);
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    box.append(h('div', { class: 'toggle-label' }, 'Your channel notes'), list);
    draw();
  }

  YM.definePlugin({
    name: 'ChannelNotes',
    description: 'Give any channel your own private note, like a sticky note only you see. Yapper has no channel descriptions yet, so this is local to you.',
    authors: ['YapCord'],
    tags: ['Servers', 'Utility'],
    alwaysOn: true,
    api: { read, set, clean, label },
    options: { manage: { type: 'custom', default: false, render: (box) => renderManager(box) } },
    start(ctx) {
      ctx.css('.ym-cn-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent,#ff6b4a);margin-left:6px;vertical-align:middle;flex:none}');

      const sync = () => {
        const m = read();
        document.querySelectorAll('[data-nav-chan]').forEach((row) => {
          const id = row.getAttribute('data-nav-chan');
          const note = m[id];
          const host = row.querySelector('.channel-main') || row;
          let dot = host.querySelector(':scope > .ym-cn-dot');
          if (!note) { if (dot) dot.remove(); row.removeAttribute('title'); return; }
          if (row.getAttribute('title') !== note) row.setAttribute('title', note);
          if (!dot) { dot = h('span', { class: 'ym-cn-dot', title: note }); host.append(dot); }
          else if (dot.getAttribute('title') !== note) dot.setAttribute('title', note);
        });
      };
      sync();
      ctx.onMutate(sync);
      ctx.cleanup(YM.settings.onPath(KEY, sync));
      ctx.cleanup(() => { document.querySelectorAll('.ym-cn-dot').forEach((n) => n.remove()); document.querySelectorAll('[data-nav-chan][title]').forEach((n) => n.removeAttribute('title')); });

      let pending = null;
      const onContext = (e) => {
        const row = e.target instanceof Element ? e.target.closest('[data-nav-chan]') : null;
        pending = row ? { id: row.getAttribute('data-nav-chan'), at: Date.now() } : null;
      };
      document.addEventListener('contextmenu', onContext, true);
      ctx.cleanup(() => document.removeEventListener('contextmenu', onContext, true));
      ctx.onMutate(() => {
        document.querySelectorAll('.ctx-menu').forEach((menu) => {
          if (!pending || Date.now() - pending.at > 3000 || menu.querySelector('.ym-cn-item')) return;
          const id = pending.id;
          menu.append(h('button', { type: 'button', role: 'menuitem', class: 'ym-cn-item', onClick: () => {
            const overlay = menu.closest('.overlay');
            if (overlay) overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            openEditor(id);
          } }, h('span', {}, read()[id] ? 'Edit channel note...' : 'Channel note...')));
        });
        if (!document.querySelector('.ctx-menu') && pending && Date.now() - pending.at > 400) pending = null;
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-cn-item').forEach((n) => n.remove()));
    },
  });
})();
