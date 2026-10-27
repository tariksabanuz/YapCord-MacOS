

(function () {
  const DEFAULT_EMOJI = '❤️';

  function firstEmoji(text) {
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const parts = seg ? [...seg.segment(String(text || ''))].map((x) => x.segment) : Array.from(String(text || ''));
    return parts.find((p) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(p)) || DEFAULT_EMOJI;
  }

  YM.definePlugin({
    name: 'DoubleTapReact',
    description: "Double-click a message's text to react with one emoji straight away, like a double-tap \"like\" on a phone.",
    authors: ['YapCord'],
    tags: ['Chat'],
    alwaysOn: true,
    api: { firstEmoji },
    options: {
      emoji: { type: 'string', default: DEFAULT_EMOJI, description: 'Which emoji a double-click reacts with' },
    },
    start(ctx) {
      const actions = YM.finder.lazy(['toggleReaction', 'sendMessage']);
      const onDblClick = (e) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('a, .mention, .msg-image, .msg-video, .msg-author')) return;
        const textEl = e.target.closest('.msg-text');
        if (!textEl) return;
        const row = textEl.closest('.msg[data-message-id]');
        if (!row) return;
        const mod = actions();
        if (!mod) return;
        const emoji = firstEmoji(ctx.settings.store.emoji);
        Promise.resolve(mod.toggleReaction(row.getAttribute('data-message-id'), emoji)).catch((err) => YM.toast('Could not react: ' + ((err && err.message) || err), { type: 'error' }));
      };
      document.addEventListener('dblclick', onDblClick, true);
      ctx.cleanup(() => document.removeEventListener('dblclick', onDblClick, true));
    },
  });
})();
