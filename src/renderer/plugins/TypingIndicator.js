

(function () {
  function isTyping(typingState, channelId) {
    const t = typingState && typingState[channelId];
    if (!t) return false;
    if (Array.isArray(t)) return t.length > 0;
    if (typeof t === 'object') return Object.keys(t).length > 0;
    return !!t;
  }

  YM.definePlugin({
    name: 'TypingIndicator',
    description: "A small dot on a chat's sidebar row when someone is typing there, for chats you don't currently have open.",
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Chat', 'Appearance'],
    api: { isTyping },
    start(ctx) {
      ctx.css('.chat-row[data-ym-typing]::before{content:"";position:absolute;bottom:4px;left:4px;width:7px;height:7px;border-radius:50%;background:var(--accent,#ff6b4a);animation:ymTypingPulse 1s ease-in-out infinite}@keyframes ymTypingPulse{50%{opacity:.35}}');
      const sync = () => {
        const s = YM.Store.getState();
        const active = s && s.activeChannelId;
        document.querySelectorAll('.chat-row[data-nav-chan]').forEach((row) => {
          const id = row.getAttribute('data-nav-chan');
          const on = id && id !== active && isTyping(s && s.typing, id);
          if (row.hasAttribute('data-ym-typing') !== !!on) row.toggleAttribute('data-ym-typing', !!on);
        });
      };
      sync();
      const t = ctx.interval(sync, 2000);
      ctx.cleanup(ctx.on('store:change', sync));
      ctx.onMutate(sync);
      ctx.cleanup(() => document.querySelectorAll('[data-ym-typing]').forEach((n) => n.removeAttribute('data-ym-typing')));
    },
  });
})();
