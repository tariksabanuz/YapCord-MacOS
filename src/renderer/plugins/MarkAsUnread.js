

(function () {
  const ICON_FILLED = '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';
  const ICON_RING = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>';

  function isUnread(id) {
    const s = YM.Store.getState();
    return !!(s && s.unread && s.unread[id] > 0);
  }

  function markUnread(id) {
    const s = YM.Store.getState();
    if (!s) return;
    YM.Store.setState({ unread: { ...(s.unread || {}), [id]: Math.max(1, Number((s.unread || {})[id]) || 1) } });
  }

  function markRead(id) {
    const live = YM.Store.live();
    if (live && typeof live.markRead === 'function') {
      try { live.markRead(id); return; } catch (err) { YM.log.warn('[MarkAsUnread] markRead failed', err); }
    }
    const s = YM.Store.getState();
    if (!s) return;
    const unread = { ...(s.unread || {}) };
    delete unread[id];
    YM.Store.setState({ unread });
  }

  YM.definePlugin({
    name: 'MarkAsUnread',
    description: "A hover button on each chat that marks it unread again as a reminder to come back - or marks a genuinely unread one read. The unread mark you set yourself is local-only (Yapper has no call to push a made-up unread state); a real new message, reload, or opening the chat overrides it.",
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    api: { isUnread, markUnread, markRead },
    start(ctx) {
      const h = YM.dom.h;

      function sync() {
        document.querySelectorAll('.chat-row[data-nav-chan], .channel-row[data-nav-chan]').forEach((row) => {
          const id = row.getAttribute('data-nav-chan');
          let btn = row.querySelector(':scope > .ym-mau-btn');
          if (!btn) {
            btn = h('button', {
              type: 'button', class: 'ym-mau-btn', title: 'Mark as unread',
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                const unread = isUnread(id);
                if (unread) markRead(id); else markUnread(id);
              },
            });
            row.append(btn);
          }
          const unread = isUnread(id);
          btn.innerHTML = unread ? ICON_FILLED : ICON_RING;
          btn.title = unread ? 'Mark as read' : 'Mark as unread';
          btn.classList.toggle('ym-mau-active', unread);
        });
      }

      ctx.css(`
.chat-row .ym-mau-btn,.channel-row .ym-mau-btn{position:absolute;top:50%;right:34px;margin-top:-9px;width:18px;height:18px;border-radius:50%;display:none;align-items:center;justify-content:center;padding:0;border:none;background:transparent;color:var(--text-faint,#8b8d98);cursor:pointer;z-index:1}
.chat-row:hover .ym-mau-btn,.channel-row:hover .ym-mau-btn,.chat-row .ym-mau-btn.ym-mau-active,.channel-row .ym-mau-btn.ym-mau-active{display:flex}
.chat-row .ym-mau-btn:hover,.channel-row .ym-mau-btn:hover{color:var(--text,#e3e5e8)}
.chat-row .ym-mau-btn.ym-mau-active,.channel-row .ym-mau-btn.ym-mau-active{color:var(--accent,#ff6b4a)}
`);
      sync();
      ctx.onMutate(sync);
      ctx.on('store:change', (next, prev) => { if (next.unread !== prev.unread || next.channels !== prev.channels) sync(); });
      ctx.cleanup(() => document.querySelectorAll('.ym-mau-btn').forEach((n) => n.remove()));
    },
  });
})();
