

(function () {
  const rows = new Map();

  function copy(text, label) {
    YM.util.copyText(text).then((ok) => YM.toast(ok ? label + ' copied.' : 'Could not copy.', { type: ok ? 'info' : 'error' }));
  }

  YM.definePlugin({
    name: 'CopyUserURLs',
    description: "Right-click a username or avatar in chat and choose \"Copy user ID\". Yapper has no public profile link to copy instead, so this is the id.",
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Utility'],
    api: { copy },
    start(ctx) {
      ctx.cleanup(YM.messages.decorate(({ el, message }) => { if (message) rows.set(el, message); }));
      let menu = null;
      const close = () => { if (menu) { menu.remove(); menu = null; } };
      const onContext = (e) => {
        const target = e.target instanceof Element ? e.target.closest('.msg-author, .msg-head img, .msg-head .avatar') : null;
        if (!target) return;
        let message = null;
        for (let node = target; node && node !== document.body; node = node.parentElement) {
          if (rows.has(node)) { message = rows.get(node); break; }
        }
        if (!message || !message.author_id) return;
        e.preventDefault();
        e.stopPropagation();
        close();
        const h = YM.dom.h;
        const x = Math.min(e.clientX, window.innerWidth - 200);
        const y = Math.min(e.clientY, window.innerHeight - 70);
        menu = h('div', { class: 'overlay clear ym-cu-menu', style: { background: 'transparent', animation: 'none', padding: 0 }, onPointerDown: close, onContextMenu: (ev) => { ev.preventDefault(); close(); } },
          h('div', { class: 'ctx-menu', role: 'menu', style: { position: 'fixed', left: x + 'px', top: y + 'px', width: '190px' }, onPointerDown: (ev) => ev.stopPropagation() },
            h('button', { type: 'button', role: 'menuitem', onClick: () => { close(); copy(String(message.author_id), 'User ID'); } }, h('span', null, 'Copy user ID'))));
        document.body.append(menu);
      };
      document.addEventListener('contextmenu', onContext, true);
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey, true);
      ctx.cleanup(() => {
        document.removeEventListener('contextmenu', onContext, true);
        document.removeEventListener('keydown', onKey, true);
        close();
        rows.clear();
      });
    },
  });
})();
