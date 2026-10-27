

(function () {
  YM.definePlugin({
    name: 'MemberCount',
    description: 'Shows the online count and total member count of the server at the top of the member list, with the same green/grey dots Discord uses.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Servers', 'Appearance'],
    alwaysOn: true,
    start(ctx) {
      const h = YM.dom.h;

      function counts() {
        if (!YM.Store.isReady) return null;
        const st = YM.Store.getState();
        const id = st.activeServerId;
        const total = id && st.memberCounts ? st.memberCounts[id] : null;
        if (typeof total !== 'number' || !Number.isFinite(total)) return null;

        const members = Array.isArray(st.serverMembers && st.serverMembers[id]) ? st.serverMembers[id] : [];
        const online = st.online || {};
        const me = st.myStatus === 'invisible' ? null : st.userId;
        let live = 0;
        for (const uid of new Set(members)) if (typeof uid === 'string' && (online[uid] || uid === me)) live++;
        return { online: live, total };
      }

      function render() {
        const c = counts();
        document.querySelectorAll('.side-panel-body').forEach((body) => {
          if (!body.querySelector(':scope > div > .pick-row')) return;
          const el = body.querySelector(':scope > .ym-membercount-row');
          if (!c) { if (el) el.remove(); return; }
          const onlineText = c.online.toLocaleString();
          const totalText = c.total.toLocaleString();
          if (el) {
            const on = el.querySelector('.ym-mc-online .ym-mc-num');
            const tot = el.querySelector('.ym-mc-total .ym-mc-num');
            if (on && on.textContent !== onlineText) on.textContent = onlineText;
            if (tot && tot.textContent !== totalText) tot.textContent = totalText;
            return;
          }
          body.prepend(h('div', { class: 'ym-membercount-row' },
            h('span', { class: 'ym-mc-stat ym-mc-online', title: 'Online in this server' }, h('span', { class: 'ym-mc-dot' }), h('span', { class: 'ym-mc-num' }, onlineText)),
            h('span', { class: 'ym-mc-stat ym-mc-total', title: 'Members in this server' }, h('span', { class: 'ym-mc-dot' }), h('span', { class: 'ym-mc-num' }, totalText))));
        });
      }

      ctx.onMutate(render);
      ctx.on('store:change', (next, prev) => {
        if (next.memberCounts !== prev.memberCounts || next.activeServerId !== prev.activeServerId || next.online !== prev.online || next.serverMembers !== prev.serverMembers || next.myStatus !== prev.myStatus) render();
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-membercount-row').forEach((n) => n.remove()));
      ctx.css(`
.ym-membercount-row{display:flex;gap:14px;padding:8px 12px 4px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.ym-mc-stat{display:inline-flex;align-items:center;gap:6px}
.ym-mc-dot{width:8px;height:8px;border-radius:50%;flex:none;box-sizing:border-box}
.ym-mc-online .ym-mc-dot{background:var(--success,#23a55a)}
.ym-mc-online .ym-mc-num{color:var(--success,#23a55a)}
.ym-mc-total .ym-mc-dot{border:1.5px solid var(--text-muted,#80848e);background:transparent}
.ym-mc-total .ym-mc-num{color:var(--text-muted,#80848e)}
`);
      render();
    },
  });
})();
