
(function () {
  const hex2 = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');

  function colorOf(roleEl) {
    const dot = roleEl.querySelector('.pc-role-dot');
    const bg = (dot && dot.style && dot.style.background) || (dot && getComputedStyle(dot).backgroundColor) || '';
    const hexMatch = /#([0-9a-f]{3,8})\b/i.exec(bg);
    if (hexMatch) return '#' + (hexMatch[1].length === 3 ? hexMatch[1].split('').map((c) => c + c).join('') : hexMatch[1].slice(0, 6));
    const rgbMatch = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(bg);
    if (rgbMatch) return '#' + hex2(+rgbMatch[1]) + hex2(+rgbMatch[2]) + hex2(+rgbMatch[3]);
    return null;
  }

  YM.definePlugin({
    name: 'BetterRoleContext',
    description: "Right-click a role on someone's profile card to copy its colour as a hex code.",
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Utility'],
    api: { colorOf },
    start(ctx) {
      let menu = null;
      const close = () => { if (menu) { menu.remove(); menu = null; } };
      const onContext = (e) => {
        const roleEl = e.target instanceof Element ? e.target.closest('.pc-role') : null;
        if (!roleEl) return;
        const color = colorOf(roleEl);
        if (!color) return;
        e.preventDefault();
        e.stopPropagation();
        close();
        const h = YM.dom.h;
        const x = Math.min(e.clientX, window.innerWidth - 190);
        const y = Math.min(e.clientY, window.innerHeight - 70);
        menu = h('div', { class: 'overlay clear ym-brc-menu', style: { background: 'transparent', animation: 'none', padding: 0 }, onPointerDown: close, onContextMenu: (ev) => { ev.preventDefault(); close(); } },
          h('div', { class: 'ctx-menu', role: 'menu', style: { position: 'fixed', left: x + 'px', top: y + 'px', width: '180px' }, onPointerDown: (ev) => ev.stopPropagation() },
            h('button', { type: 'button', role: 'menuitem', onClick: async () => { close(); YM.toast((await YM.util.copyText(color)) ? 'Copied ' + color + '.' : 'Could not copy.'); } }, h('span', null, 'Copy colour (' + color + ')'))));
        document.body.append(menu);
      };
      document.addEventListener('contextmenu', onContext, true);
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey, true);
      ctx.cleanup(() => {
        document.removeEventListener('contextmenu', onContext, true);
        document.removeEventListener('keydown', onKey, true);
        close();
      });
    },
  });
})();
