

(function () {
  function diffSeconds(createdAtIso, arrivedMs) {
    const created = new Date(createdAtIso).getTime();
    if (isNaN(created)) return null;
    return Math.max(0, (arrivedMs - created) / 1000);
  }

  YM.definePlugin({
    name: 'MessageLatency',
    description: 'Flags your own messages that took a while to appear after being sent, so a slow connection or a struggling server doesn’t go unnoticed.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Chat', 'Utility'],
    api: { diffSeconds },
    options: {
      threshold: { type: 'slider', default: 4, min: 1, max: 20, step: 1, description: 'Flag messages slower than this many seconds' },
    },
    start(ctx) {
      ctx.css('.ym-ml-tag{margin-left:6px;font-size:11px;color:var(--danger,#e5484d);white-space:nowrap}');
      const known = new Set();
      const arrivedAt = new Map();
      const tagged = new Set();

      function noteSnapshot(s, { isFirstLook }) {
        if (!s || !s.messages) return;
        const now = Date.now();
        for (const list of Object.values(s.messages)) {
          if (!Array.isArray(list)) continue;
          for (const m of list) {
            if (!m || !m.id || known.has(m.id)) continue;
            known.add(m.id);

            if (!isFirstLook) arrivedAt.set(m.id, now);
          }
        }
      }
      noteSnapshot(YM.Store.getState(), { isFirstLook: true });

      ctx.cleanup(ctx.on('store:change', (next, prev) => {
        if (next.messages !== prev.messages) noteSnapshot(next, { isFirstLook: false });
      }));

      ctx.cleanup(YM.messages.decorate(({ el, id, message }) => {
        if (!message || !id || tagged.has(id)) return;
        const s = YM.Store.getState();
        if (!s || message.author_id !== s.userId || message.pending) return;
        const arrived = arrivedAt.get(id);
        if (arrived === undefined) return;
        tagged.add(id);
        const secs = diffSeconds(message.created_at, arrived);
        if (secs === null || secs < ctx.settings.store.threshold) return;
        const time = el.querySelector(':scope .msg-time');
        if (time && !time.parentElement.querySelector('.ym-ml-tag')) {
          time.after(YM.dom.h('span', { class: 'ym-ml-tag', title: 'Took about ' + secs.toFixed(1) + 's to appear after it was sent' }, 'slow (' + Math.round(secs) + 's)'));
        }
      }));
      ctx.cleanup(() => { document.querySelectorAll('.ym-ml-tag').forEach((n) => n.remove()); known.clear(); arrivedAt.clear(); tagged.clear(); });
    },
  });
})();
