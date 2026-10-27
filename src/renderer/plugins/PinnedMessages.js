

(function () {
  const rows = new Map();

  function pinnedIn(channelId) {
    const s = YM.Store.getState();
    const list = (s && s.messages && s.messages[channelId]) || [];
    return list.filter((m) => m && m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));
  }

  function nameFor(authorId) {
    const p = YM.Store.profile ? YM.Store.profile(authorId) : null;
    return (p && (p.display_name || p.username)) || 'Unknown';
  }

  function jumpTo(id) {
    const el = rows.get(id);
    if (!el || !el.isConnected) { YM.toast('That message isn’t in view right now - scroll up to load it.'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ym-pm-flash');
    setTimeout(() => el.classList.remove('ym-pm-flash'), 1200);
  }

  const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z"/></svg>';

  function openPanel() {
    const id = YM.Store.getState().activeChannelId;
    if (!id) { YM.toast('Open a chat first.', { type: 'error' }); return; }
    const pins = pinnedIn(id);
    const h = YM.dom.h;
    const body = pins.length
      ? h('div', { class: 'ym-pm-list' }, pins.map((m) => h('div', { class: 'ym-pm-item' },
        h('div', { class: 'ym-pm-head' }, h('b', {}, nameFor(m.author_id)), h('span', { class: 'ym-hint' }, new Date(m.created_at).toLocaleString())),
        h('div', { class: 'ym-pm-text' }, m.content || '(no text)'),
        h('button', { type: 'button', class: 'ym-btn ym-btn-small', onClick: () => { jumpTo(m.id); modal.close(); } }, 'Jump to it'))))
      : h('div', { class: 'hint' }, 'Nothing pinned in what you’ve loaded of this chat yet.');
    const modal = YM.modal.open({ title: 'Pinned in this chat', body, buttons: [] });
  }

  YM.definePlugin({
    name: 'PinnedMessages',
    description: "A button next to the message box that lists the pinned messages you've already loaded in the open chat, with a jump-to button for each.",
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    api: { pinnedIn, jumpTo },
    start(ctx) {
      ctx.css(`.ym-pinned-btn{opacity:.75}.ym-pinned-btn:hover{opacity:1}
.ym-pm-list{display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow:auto}
.ym-pm-item{padding:10px;border-radius:8px;background:var(--bg-elev,#222329);border:1px solid var(--border,rgba(255,255,255,.1))}
.ym-pm-head{display:flex;gap:8px;align-items:baseline;margin-bottom:4px}
.ym-pm-text{font-size:13px;color:var(--text-muted,#9aa0ab);margin-bottom:8px;white-space:pre-wrap;word-break:break-word}
.ym-pm-flash{outline:2px solid var(--accent,#ff6b4a);outline-offset:2px;border-radius:6px;transition:outline-color .8s}`);
      ctx.cleanup(YM.messages.decorate(({ el, id }) => { if (id) rows.set(id, el); }));
      const sync = () => {
        document.querySelectorAll('.composer-tools').forEach((tools) => {
          if (!tools.querySelector('.ym-pinned-btn')) {
            tools.append(YM.dom.h('button', { class: 'icon-btn ym-pinned-btn', type: 'button', title: 'Pinned messages', 'aria-label': 'Pinned messages', html: ICON, onClick: openPanel }));
          }
        });
      };
      sync();
      ctx.onMutate(sync);
      ctx.cleanup(() => { document.querySelectorAll('.ym-pinned-btn').forEach((n) => n.remove()); rows.clear(); });
    },
  });
})();
