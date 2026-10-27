

(function () {
  function unreadChannelIds() {
    const st = YM.Store.getState();
    if (!st) return [];
    const ids = new Set();
    for (const [id, n] of Object.entries(st.unread || {})) if (n > 0) ids.add(id);
    for (const [id, n] of Object.entries(st.mentions || {})) if (n > 0) ids.add(id);
    return [...ids];
  }

  function markAllRead() {
    const ids = unreadChannelIds();
    if (!ids.length) {
      YM.toast('Nothing unread.');
      return 0;
    }
    const live = YM.Store.live();
    if (live && typeof live.markRead === 'function') {
      ids.forEach((id, i) => setTimeout(() => {
        try {
          live.markRead(id);
        } catch (err) {
          YM.log.warn('markRead failed for', id, err);
        }
      }, i * 40));
    } else {

      YM.Store.setState({ unread: {}, mentions: {} });
    }
    YM.toast(`Marked ${YM.util.pluralize(ids.length, 'chat')} as read.`, { type: 'success' });
    return ids.length;
  }

  YM.definePlugin({
    name: 'ReadAllNotificationsButton',
    description: 'Adds a "Read All" button under the logo in the server list that marks all chats as read.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Notifications', 'Servers'],
    alwaysOn: true,
    options: {
      showCount: { type: 'boolean', default: true, description: 'Show how many chats are unread on the button' },
    },
    api: { markAllRead, unreadChannelIds },

    start(ctx) {
      const h = YM.dom.h;
      let btn = null;
      let badge = null;

      function build() {
        badge = h('span', { class: 'rail-badge ym-ra-badge', hidden: true });
        btn = h('div', { class: 'rail-wrap ym-ra-wrap' },
          h('button', {
            class: 'rail-item add ym-ra-btn',
            type: 'button',
            title: 'Mark everything as read',
            'aria-label': 'Mark everything as read',
            onClick: (e) => {
              e.preventDefault();
              markAllRead();
            },
          }, 'Read All'),
          badge);
        return btn;
      }

      function homeWrap(rail) {
        const home = rail.querySelector(':scope > .rail-wrap button.rail-item[title="Direct messages"]');
        return home ? home.closest('.rail-wrap') : null;
      }

      function ensure() {
        const rail = document.querySelector('nav.rail');
        if (!rail) return;
        if (!btn) build();

        const home = homeWrap(rail);
        if (home) {
          if (btn.previousElementSibling !== home || btn.parentNode !== rail) home.after(btn);
        } else if (btn.parentNode !== rail) {
          rail.prepend(btn);
        }
        update();
      }

      function update() {
        if (!btn || !badge) return;
        const n = YM.Store.isReady ? unreadChannelIds().length : 0;
        const show = ctx.settings.store.showCount && n > 0;
        badge.hidden = !show;
        badge.textContent = n > 99 ? '99+' : String(n);
        btn.classList.toggle('ym-ra-has', n > 0);
      }

      ctx.watch('nav.rail', ensure);
      ctx.onMutate(() => {

        if (!btn || !btn.isConnected) return ensure();
        const rail = document.querySelector('nav.rail');
        const home = rail && homeWrap(rail);
        if (home && btn.previousElementSibling !== home) ensure();
        return undefined;
      });
      ctx.on('store:change', (next, prev) => {
        if (next.unread !== prev.unread || next.mentions !== prev.mentions) update();
      });
      ctx.cleanup(ctx.settings.onChange(update));
      ctx.cleanup(() => {
        if (btn) btn.remove();
        btn = badge = null;
      });

      function channelsInFolder(folderId) {
        const st = YM.Store.getState();
        if (!st || !st.channels) return [];
        const folder = YM.folders.list().find((f) => f.id === folderId);
        if (!folder) return [];
        const serverIds = new Set(folder.servers);
        const ids = [];
        for (const [id, c] of Object.entries(st.channels)) if (c && serverIds.has(c.server_id)) ids.push(id);
        return ids;
      }
      let pendingFolder = null;
      const onFolderContext = (e) => {
        const row = e.target instanceof Element ? e.target.closest('button.rail-folder')?.closest('[data-rail-row]') : null;
        const raw = row ? row.getAttribute('data-rail-row') : null;
        pendingFolder = raw && raw.startsWith('f:') ? { id: raw.slice(2), at: Date.now() } : null;
      };
      document.addEventListener('contextmenu', onFolderContext, true);
      ctx.cleanup(() => document.removeEventListener('contextmenu', onFolderContext, true));
      ctx.onMutate(() => {
        document.querySelectorAll('.ctx-menu').forEach((menu) => {
          if (!pendingFolder || Date.now() - pendingFolder.at > 3000 || menu.querySelector('.ym-ra-folder-item')) return;
          const folderId = pendingFolder.id;
          menu.append(h('button', { type: 'button', role: 'menuitem', class: 'ym-ra-folder-item', onClick: () => {
            const overlay = menu.closest('.overlay');
            if (overlay) overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            const ids = channelsInFolder(folderId);
            if (!ids.length) { YM.toast('Nothing unread in this folder.'); return; }
            const live = YM.Store.live();
            if (live && typeof live.markRead === 'function') {
              ids.forEach((id, i) => setTimeout(() => { try { live.markRead(id); } catch (err) { YM.log.warn('markRead failed for', id, err); } }, i * 40));
              YM.toast(`Marked ${YM.util.pluralize(ids.length, 'chat')} as read.`, { type: 'success' });
            }
          } }, h('span', {}, 'Mark as Read')));
        });
        if (!document.querySelector('.ctx-menu') && pendingFolder && Date.now() - pendingFolder.at > 400) pendingFolder = null;
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-ra-folder-item').forEach((n) => n.remove()));
      ctx.css(`
.rail-wrap .rail-item.ym-ra-btn{width:56px;height:28px;border-radius:14px;font-size:11px;font-weight:700;letter-spacing:.01em;white-space:nowrap;color:var(--text-muted)}
.rail-wrap .rail-item.ym-ra-btn:hover{border-radius:10px;color:var(--on-accent,#fff);background:var(--accent)}
.ym-ra-has .rail-item.ym-ra-btn{color:var(--success)}
.ym-ra-has .rail-item.ym-ra-btn:hover{color:var(--on-accent,#fff)}
.ym-ra-badge{background:var(--accent);top:-8px;right:5px;bottom:auto;left:auto}
.ym-ra-badge[hidden]{display:none}
`);
    },
  });
})();
