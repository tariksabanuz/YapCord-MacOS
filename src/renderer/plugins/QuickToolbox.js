

(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>';

  function parseList(s) {
    return String(s || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  }

  YM.definePlugin({
    name: 'QuickToolbox',
    description: 'A second button next to the YapCord icon with instant actions (Reload, DevTools, Relaunch) and on/off switches for plugins you pick.',
    authors: ['YapCord'],
    tags: ['Utility'],
    api: { parseList },
    options: {
      favourites: { type: 'string', default: '', description: 'Plugin names to quick-toggle here, one per line or comma-separated' },
    },
    start(ctx) {
      ctx.css(`.ym-qt-menu{position:fixed;min-width:220px;background:var(--bg-elev,#222329);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:6px;display:flex;flex-direction:column;z-index:2147482500}
.ym-qt-menu button{display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 10px;border-radius:7px;background:none;color:var(--text,#f2f3f5);font:inherit;text-align:left}
.ym-qt-menu button:hover{background:var(--bg-hover,rgba(255,255,255,.06))}
.ym-qt-sep{height:1px;background:var(--border,rgba(255,255,255,.1));margin:4px 2px}
.ym-qt-on{color:var(--accent,#ff6b4a)}`);
      let menu = null;
      const close = () => { if (menu) { menu.remove(); menu = null; } };
      const h = YM.dom.h;
      const action = (label, fn) => h('button', { type: 'button', onClick: () => { close(); fn(); } }, label);
      const toggleRow = (name) => {
        const on = YM.plugins.isEnabled(name);

        return h('button', { type: 'button', onClick: () => { YM.plugins.requestEnabled(name, !on); close(); } }, h('span', null, name), h('span', { class: on ? 'ym-qt-on' : 'ym-hint' }, on ? 'On' : 'Off'));
      };
      const open = (rect) => {
        close();

        const favs = parseList(ctx.settings.store.favourites).filter((n) => { const p = YM.plugins.get(n); return p && !p.alwaysOn; });
        const items = [
          action('Reload', () => YM.native.app.reload()),
          action('Toggle DevTools', () => YM.native.app.devtools()),
          action('Relaunch', () => YM.native.app.relaunch()),
        ];
        if (favs.length) items.push(h('div', { class: 'ym-qt-sep' }), ...favs.map(toggleRow));
        const inner = h('div', { class: 'ym-qt-menu', style: { left: Math.min(rect.left, window.innerWidth - 230) + 'px', top: '-9999px', visibility: 'hidden' }, onPointerDown: (e) => e.stopPropagation() }, ...items);
        menu = h('div', { class: 'overlay clear', style: { background: 'transparent', animation: 'none' }, onPointerDown: close }, inner);
        document.body.append(menu);

        const menuHeight = inner.getBoundingClientRect().height;
        inner.style.top = rect.bottom + 4 + menuHeight <= window.innerHeight ? rect.bottom + 4 + 'px' : Math.max(8, rect.top - 4 - menuHeight) + 'px';
        inner.style.visibility = 'visible';
      };
      const sync = () => {
        document.querySelectorAll('.user-bar').forEach((bar) => {
          if (bar.querySelector('.ym-qt-btn')) return;
          const anchor = bar.querySelector('.ym-userbar-btn');
          const btn = h('button', { class: 'icon-btn ym-qt-btn', type: 'button', title: 'YapCord quick actions', 'aria-label': 'YapCord quick actions', html: ICON, onClick: (e) => open(e.currentTarget.getBoundingClientRect()) });
          if (anchor) anchor.after(btn); else bar.append(btn);
        });
      };
      sync();
      ctx.onMutate(sync);
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey, true);
      ctx.cleanup(() => {
        document.removeEventListener('keydown', onKey, true);
        close();
        document.querySelectorAll('.ym-qt-btn').forEach((n) => n.remove());
      });
    },
  });
})();
