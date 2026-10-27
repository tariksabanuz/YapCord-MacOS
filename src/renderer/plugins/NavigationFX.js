

(function () {
  YM.definePlugin({
    name: 'NavigationFX',
    description: 'Extra motion for the sidebar: a new DM pops in when it arrives, the chat/channel you open briefly highlights in the list, and switching servers pulses its icon. Respects "reduce motion".',
    authors: ['YapCord'],
    tags: ['Appearance', 'Accessibility', 'Navigation'],
    options: {
      dmArrival: { type: 'boolean', default: true, description: 'Pop a DM\'s row when a new message arrives there' },
      rowOpen: { type: 'boolean', default: true, description: 'Highlight the chat/channel row you just opened' },
      serverSwitch: { type: 'boolean', default: true, description: 'Pulse a server\'s icon when you switch to it' },
    },
    start(ctx) {
      const s = () => ctx.settings.store;

      ctx.css(`@media (prefers-reduced-motion:no-preference){
@keyframes ymNavDmPop{0%{transform:scale(1)}30%{transform:scale(1.08)}60%{transform:scale(.98)}100%{transform:scale(1)}}
@keyframes ymNavRowFlash{from{background:var(--accent,#ff6b4a);color:var(--on-accent,#fff)}}
@keyframes ymNavServerPulse{0%{box-shadow:0 0 0 0 var(--accent,#ff6b4a)}70%{box-shadow:0 0 0 8px rgba(255,107,74,0)}100%{box-shadow:0 0 0 0 rgba(255,107,74,0)}}
.ym-nav-dmpop{animation:ymNavDmPop .5s ease-out}
.ym-nav-rowflash{animation:ymNavRowFlash .6s ease-out}
.ym-nav-serverpulse{animation:ymNavServerPulse .6s ease-out;border-radius:50%}
}`);

      function dmPop(next, prev) {
        if (!s().dmArrival || next.unread === prev.unread) return;
        const channels = next.channels || {};
        for (const [id, n] of Object.entries(next.unread || {})) {
          const prevN = (prev.unread || {})[id] || 0;
          if (!(n > prevN)) continue;
          if (id === next.activeChannelId) continue;
          const ch = channels[id];
          if (!ch || ch.server_id) continue;
          const row = document.querySelector('.chat-row[data-nav-chan="' + CSS.escape(id) + '"]');
          if (!row) continue;
          row.classList.remove('ym-nav-dmpop');
          void row.offsetWidth;
          row.classList.add('ym-nav-dmpop');
          setTimeout(() => row.classList.remove('ym-nav-dmpop'), 550);
        }
      }

      function rowOpenFlash(next, prev) {
        if (!s().rowOpen || next.activeChannelId === prev.activeChannelId || !next.activeChannelId) return;
        const row = document.querySelector('[data-nav-chan="' + CSS.escape(next.activeChannelId) + '"]');
        if (!row) return;
        row.classList.remove('ym-nav-rowflash');
        void row.offsetWidth;
        row.classList.add('ym-nav-rowflash');
        setTimeout(() => row.classList.remove('ym-nav-rowflash'), 650);
      }

      function serverPulse(next, prev) {
        if (!s().serverSwitch || next.activeServerId === prev.activeServerId || !next.activeServerId) return;

        const el = document.querySelector('[data-rail-row="' + CSS.escape(next.activeServerId) + '"] .rail-item');
        if (!el) return;
        el.classList.remove('ym-nav-serverpulse');
        void el.offsetWidth;
        el.classList.add('ym-nav-serverpulse');
        setTimeout(() => el.classList.remove('ym-nav-serverpulse'), 650);
      }

      ctx.on('store:change', (next, prev) => {
        dmPop(next, prev);
        rowOpenFlash(next, prev);
        serverPulse(next, prev);
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-nav-dmpop,.ym-nav-rowflash,.ym-nav-serverpulse').forEach((n) => n.classList.remove('ym-nav-dmpop', 'ym-nav-rowflash', 'ym-nav-serverpulse')));
    },
  });
})();
