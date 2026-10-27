

(function () {
  YM.definePlugin({
    name: 'AutoTranslate',
    description: 'Automatically translates new messages from other people to English as they come in, using Yapper\'s own real Translate feature - no setup, no API key.',
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    start(ctx) {
      const translate = YM.finder.lazy(['V', 'e', 'q', 'A']);
      const flags = YM.finder.lazy(['flagOn', 'isFlagOn']);
      const seen = new Map();

      const hasLetters = (s) => /\p{L}/u.test(s || '');

      const initial = YM.Store.isReady ? YM.Store.getState() : null;
      if (initial && initial.messages) {
        for (const [channelId, list] of Object.entries(initial.messages)) {
          if (Array.isArray(list)) seen.set(channelId, new Set(list.map((m) => m.id)));
        }
      }

      ctx.on('store:change', (st) => {
        const t = translate();
        const f = flags();
        if (!t || !f || !st || !st.messages) return;
        for (const channelId of Object.keys(st.messages)) {
          const list = st.messages[channelId];
          if (!Array.isArray(list)) continue;
          let bucket = seen.get(channelId);
          if (!bucket) {

            bucket = new Set();
            seen.set(channelId, bucket);
            for (const m of list) bucket.add(m.id);
            continue;
          }
          const channel = st.channels[channelId];
          const serverId = channel && channel.server_id;
          if (!serverId) continue;
          for (const m of list) {
            if (bucket.has(m.id)) continue;
            bucket.add(m.id);
            if (m.pending || m.author_id === st.userId || !m.content || !hasLetters(m.content)) continue;
            if (!f.isFlagOn('translate', serverId)) continue;
            try { t.q(m.id, m.content); } catch (err) { YM.log.debug('AutoTranslate: could not translate', m.id, err); }
          }
        }
      });

      ctx.cleanup(() => seen.clear());
    },
  });
})();
