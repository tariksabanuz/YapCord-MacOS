

(function () {
  const h = YM.dom.h;

  function dmInfo(ch) {
    if (!ch || ch.server_id || ch.kind === 'group') return null;
    let profile = null;
    if (Array.isArray(ch.memberIds)) {
      const me = YM.Store.myId();
      const otherId = ch.memberIds.find((id) => id !== me);
      if (otherId) profile = YM.Store.profile(otherId);
    }
    if (!profile && ch.name) profile = YM.people.byName(ch.name);
    return { profile, name: (profile && YM.Store.displayName(profile.id)) || ch.name || 'Unknown chat' };
  }

  function buildIndex() {
    const s = YM.Store.getState();
    if (!s) return [];
    const out = [];
    for (const [id, srv] of Object.entries(s.servers || {})) out.push({ type: 'server', id, label: srv.name || 'Server', group: 'Servers' });
    const dmUserIds = new Set();
    for (const ch of Object.values(s.channels || {})) {
      if (!ch) continue;
      if (ch.server_id) {
        if (ch.kind === 'group') continue;
        const srv = s.servers && s.servers[ch.server_id];
        out.push({ type: 'channel', id: ch.id, serverId: ch.server_id, label: ch.name || 'channel', hint: srv ? srv.name : null, group: 'Channels' });
      } else if (ch.kind === 'group') {
        out.push({ type: 'group', id: ch.id, label: ch.name || 'Group chat', group: 'Direct Messages' });
      } else {
        const info = dmInfo(ch);
        if (info && info.profile) dmUserIds.add(info.profile.id);
        out.push({ type: 'dm', id: ch.id, userId: info && info.profile ? info.profile.id : null, label: (info && info.name) || 'Unknown chat', group: 'Direct Messages' });
      }
    }
    for (const [id, status] of Object.entries(s.friends || {})) {
      if (status !== 'accepted' || dmUserIds.has(id)) continue;
      out.push({ type: 'friend', id, label: YM.Store.displayName(id), group: 'Friends' });
    }
    return out;
  }

  function score(item, q) {
    const label = item.label.toLowerCase();
    if (label === q) return 0;
    if (label.startsWith(q)) return 1;
    if (label.includes(q)) return 2;
    return -1;
  }

  function search(query, index) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return index.slice(0, 40);
    return index
      .map((item) => ({ item, s: score(item, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, 40)
      .map((x) => x.item);
  }

  async function open(item) {
    if (item.type === 'server') {
      const el = document.querySelector('nav.rail button.rail-item[data-server="' + CSS.escape(item.id) + '"]');
      if (el) el.click(); else YM.toast("Couldn't find that server in the sidebar.");
      return;
    }
    const mod = YM.finder.lazy(['openChannel', 'sendMessage'])();
    if (item.type === 'channel') {
      try {
        YM.Store.setState({ activeServerId: item.serverId });
        if (mod) await Promise.resolve(mod.openChannel(item.id));
      } catch (err) { YM.log.warn('[QuickSwitcher] could not open channel', err); }
      return;
    }
    if (item.type === 'group') {
      try { if (mod) await Promise.resolve(mod.openChannel(item.id)); } catch (err) { YM.log.warn('[QuickSwitcher] could not open group chat', err); }
      return;
    }

    const live = YM.Store.live();
    const userId = item.type === 'dm' ? item.userId : item.id;
    if (live && typeof live.openDmWith === 'function' && userId) {
      try { await Promise.resolve(live.openDmWith(userId)); return; } catch (err) { YM.log.warn('[QuickSwitcher] openDmWith failed', err); }
    }
    if (item.type === 'dm' && mod) { try { await Promise.resolve(mod.openChannel(item.id)); } catch (err) { YM.log.warn('[QuickSwitcher] could not open chat', err); } }
  }

  YM.definePlugin({
    name: 'QuickSwitcher',
    description: 'Ctrl+K (Cmd+K on Mac) opens one search box over every server, channel, DM, group chat and friend - pick one to jump straight there.',
    authors: ['YapCord'],
    tags: ['Utility', 'Navigation'],
    start(ctx) {
      let overlay = null;
      let input = null;
      let list = null;
      let results = [];
      let activeIdx = 0;

      function render() {
        const grouped = new Map();
        for (const item of results) {
          if (!grouped.has(item.group)) grouped.set(item.group, []);
          grouped.get(item.group).push(item);
        }
        const rows = [];
        let flatIdx = 0;
        const flat = [];
        for (const [group, items] of grouped) {
          rows.push(h('div', { class: 'ym-qs-group' }, group));
          for (const item of items) {
            const idx = flatIdx++;
            flat.push(item);
            rows.push(h('button', {
              type: 'button', class: 'ym-qs-row' + (idx === activeIdx ? ' ym-qs-active' : ''),
              onMouseEnter: () => { activeIdx = idx; render(); },
              onClick: () => select(idx),
            }, h('span', { class: 'ym-qs-label' }, item.label), item.hint ? h('span', { class: 'ym-qs-hint' }, item.hint) : null));
          }
        }
        list.replaceChildren(...(rows.length ? rows : [h('div', { class: 'ym-qs-empty' }, 'Nothing found.')]));
        list._flat = flat;
      }

      function runSearch() {
        results = search(input.value, buildIndex());
        activeIdx = 0;
        render();
      }

      function select(idx) {
        const item = (list._flat || [])[idx];
        if (!item) return;
        close();
        open(item);
      }

      function close() {
        if (overlay) { overlay.remove(); overlay = null; input = null; list = null; }
        document.removeEventListener('keydown', onModalKey, true);
      }

      function onModalKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, (list._flat || []).length - 1); render(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); render(); return; }
        if (e.key === 'Enter') { e.preventDefault(); select(activeIdx); }
      }

      function openModal() {
        if (overlay) { close(); return; }
        input = h('input', { type: 'text', class: 'ym-qs-input', placeholder: 'Jump to a server, channel, DM or friend...', onInput: runSearch });
        list = h('div', { class: 'ym-qs-list' });
        const box = h('div', { class: 'ym-qs-box', onPointerDown: (e) => e.stopPropagation() }, input, list);
        overlay = h('div', { class: 'overlay clear', style: { background: 'rgba(0,0,0,.5)' }, onPointerDown: close }, box);
        document.body.append(overlay);
        document.addEventListener('keydown', onModalKey, true);
        runSearch();
        setTimeout(() => input.focus(), 0);
      }

      const onGlobalKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          openModal();
        }
      };
      document.addEventListener('keydown', onGlobalKey, true);
      ctx.cleanup(() => { document.removeEventListener('keydown', onGlobalKey, true); close(); });

      ctx.css(`
.ym-qs-box{width:min(520px,90vw);max-height:70vh;margin:10vh auto 0;background:var(--bg-float,#1e1f24);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}
.ym-qs-input{width:100%;box-sizing:border-box;padding:16px;border:none;outline:none;background:transparent;color:var(--text,#e3e5e8);font-size:16px;border-bottom:1px solid var(--border,rgba(255,255,255,.08))}
.ym-qs-list{overflow:auto;padding:6px;max-height:calc(70vh - 56px)}
.ym-qs-group{padding:8px 10px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-faint,#8b8d98)}
.ym-qs-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:8px 10px;border-radius:6px;border:none;background:transparent;color:var(--text,#e3e5e8);cursor:pointer;font-size:14px}
.ym-qs-row.ym-qs-active,.ym-qs-row:hover{background:var(--accent,#ff6b4a);color:var(--on-accent,#fff)}
.ym-qs-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ym-qs-hint{font-size:11px;opacity:.75;flex-shrink:0}
.ym-qs-empty{padding:16px;text-align:center;color:var(--text-faint,#8b8d98);font-size:13px}
`);
    },
  });
})();
