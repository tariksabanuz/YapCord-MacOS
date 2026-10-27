

(function () {
  const rows = new Map();

  function targetFor(channelId) {
    const s = YM.Store.getState();
    const list = (s && s.messages && s.messages[channelId]) || [];
    const unread = (s && s.unread && s.unread[channelId]) || 0;
    if (!list.length || !unread) return null;
    const idx = Math.max(0, list.length - unread);
    return list[idx] || list[0];
  }

  const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

  YM.definePlugin({
    name: 'JumpToUnread',
    description: "A button next to the message box that jumps to about where your unread messages start in the open chat, counting back from Yapper's own unread count. Approximate, not exact.",
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    api: { targetFor },
    start(ctx) {
      ctx.css(`.ym-jtu-btn{opacity:.75}.ym-jtu-btn:hover{opacity:1}.ym-jtu-btn[disabled]{opacity:.3;cursor:default}
.ym-jtu-flash{outline:2px solid var(--accent,#ff6b4a);outline-offset:2px;border-radius:6px;transition:outline-color .8s}`);
      ctx.cleanup(YM.messages.decorate(({ el, id }) => { if (id) rows.set(id, el); }));
      const onClick = () => {
        const id = YM.Store.getState().activeChannelId;
        if (!id) return;
        const target = targetFor(id);
        if (!target) { YM.toast('Nothing unread here.'); return; }
        const el = rows.get(target.id);
        if (!el || !el.isConnected) { YM.toast('Scroll up a little first so it’s loaded.'); return; }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ym-jtu-flash');
        setTimeout(() => el.classList.remove('ym-jtu-flash'), 1200);
      };
      const sync = () => {
        document.querySelectorAll('.composer-tools').forEach((tools) => {
          if (!tools.querySelector('.ym-jtu-btn')) {
            tools.append(YM.dom.h('button', { class: 'icon-btn ym-jtu-btn', type: 'button', title: 'Jump to unread', 'aria-label': 'Jump to unread', html: ICON, onClick }));
          }
        });
      };
      sync();
      ctx.onMutate(sync);
      ctx.cleanup(() => { document.querySelectorAll('.ym-jtu-btn').forEach((n) => n.remove()); rows.clear(); });
    },
  });
})();
