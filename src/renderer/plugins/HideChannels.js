

(function () {
  const KEY = 'pluginData.HideChannels';
  const MAX_ITEMS = 500;
  const h = (...a) => YM.dom.h(...a);

  function read() {
    const v = YM.settings.get(KEY, []);
    return Array.isArray(v) ? [...new Set(v.filter((id) => typeof id === 'string' && id))].slice(0, MAX_ITEMS) : [];
  }
  function write(ids) { YM.settings.set(KEY, [...new Set(ids)].slice(0, MAX_ITEMS)); }
  function hide(id) { if (!read().includes(id)) write([...read(), id]); }
  function unhide(id) { write(read().filter((x) => x !== id)); }

  function channelOf(id) {
    const st = YM.Store.isReady ? YM.Store.getState() : null;
    return (st && st.channels && st.channels[id]) || null;
  }
  function label(id) {
    const c = channelOf(id);
    if (!c) return id;
    if (c.server_id) {
      const st = YM.Store.getState();
      const sv = st.servers && st.servers[c.server_id];
      return '#' + (c.name || 'channel') + (sv ? ' in ' + sv.name : '');
    }
    return c.name || 'this chat';
  }

  YM.definePlugin({
    name: 'HideChannels',
    description: 'Right-click a channel to hide it from your own sidebar. Only you see it hidden; bring it back any time from this plugin\'s options.',
    authors: ['YapCord'],
    tags: ['Servers', 'Utility'],
    alwaysOn: true,
    api: { read, write, hide, unhide, label },
    options: {
      manage: { type: 'custom', default: false, render: (box) => renderManager(box) },
    },
    start(ctx) {
      const sync = () => {
        const hidden = new Set(read());
        document.querySelectorAll('[data-nav-chan]').forEach((row) => {
          const id = row.getAttribute('data-nav-chan');
          const should = hidden.has(id);
          const already = row.hasAttribute('data-ym-hc-hidden');
          if (should === already) return;
          if (should) { row.setAttribute('data-ym-hc-hidden', ''); row.style.display = 'none'; }
          else { row.removeAttribute('data-ym-hc-hidden'); row.style.display = ''; }
        });
      };
      sync();
      ctx.onMutate(sync);
      ctx.cleanup(YM.settings.onPath(KEY, sync));
      ctx.cleanup(() => {
        document.querySelectorAll('[data-ym-hc-hidden]').forEach((row) => { row.removeAttribute('data-ym-hc-hidden'); row.style.display = ''; });
      });

      let pending = null;
      const onContext = (e) => {
        const row = e.target instanceof Element ? e.target.closest('[data-nav-chan]') : null;
        pending = row ? { id: row.getAttribute('data-nav-chan'), at: Date.now() } : null;
      };
      document.addEventListener('contextmenu', onContext, true);
      ctx.cleanup(() => document.removeEventListener('contextmenu', onContext, true));
      ctx.onMutate(() => {
        document.querySelectorAll('.ctx-menu').forEach((menu) => {
          if (!pending || Date.now() - pending.at > 3000 || menu.querySelector('.ym-hc-item')) return;
          const id = pending.id;
          if (read().includes(id)) return;
          menu.append(h('button', { type: 'button', role: 'menuitem', class: 'ym-hc-item', onClick: () => {
            const overlay = menu.closest('.overlay');
            if (overlay) overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            hide(id);
            YM.toast('Channel hidden. Bring it back from HideChannels’ options any time.');
          } }, h('span', {}, 'Hide channel')));
        });
        if (!document.querySelector('.ctx-menu') && pending && Date.now() - pending.at > 400) pending = null;
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-hc-item').forEach((n) => n.remove()));
    },
  });

  function renderManager(box) {
    const list = h('div', { class: 'ym-hc-list' });
    const redraw = () => {
      const ids = read();
      list.replaceChildren(
        ids.length
          ? h('div', {}, ...ids.map((id) => h('div', { class: 'ym-hc-row', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' } },
              h('span', {}, label(id)),
              h('button', { type: 'button', class: 'btn small', onClick: () => unhide(id) }, 'Unhide'),
            )))
          : h('div', { class: 'hint' }, 'No hidden channels.'),
      );
    };
    redraw();
    const off = YM.settings.onPath(KEY, redraw);
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    box.append(h('div', { class: 'toggle-label' }, 'Hidden channels'), list);
  }
})();
