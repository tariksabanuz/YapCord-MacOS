

(function () {
  function railOrder() {
    return [...document.querySelectorAll('nav.rail button.rail-item[data-server]')].map((b) => b.getAttribute('data-server'));
  }

  function groupsOf(scroll) {
    const kids = [...scroll.children];
    const groups = [];
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (el.hasAttribute('data-ym-recent')) { groups.push({ els: [el] }); continue; }
      if (el.classList.contains('emoji-section')) {
        const next = kids[i + 1];
        if (next && next.classList.contains('emoji-grid')) { groups.push({ els: [el, next], heading: el.textContent.trim() }); i++; continue; }
      }
      groups.push({ els: [el] });
    }
    return groups;
  }

  function plan(groups, servers, rank) {
    const slots = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g.heading) continue;
      const match = Object.entries(servers).find(([, sv]) => sv && sv.name === g.heading);
      if (match) { g.serverId = match[0]; slots.push(i); }
    }
    if (slots.length < 2) return null;
    const ranked = slots.filter((i) => rank.has(groups[i].serverId)).sort((a, b) => rank.get(groups[a].serverId) - rank.get(groups[b].serverId));
    const unranked = slots.filter((i) => !rank.has(groups[i].serverId));
    const fill = [...ranked, ...unranked];
    const order = groups.map((_, i) => i);
    slots.forEach((slot, k) => { order[fill[k]] = slot; });
    return order;
  }

  YM.definePlugin({
    name: 'EmojiPickerOrder',
    description: "Orders each server's own emoji section in the picker to match your real server list (top of your list = first), instead of Yapper's own order - easier to find with 20+ servers.",
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    alwaysOn: true,
    api: { groupsOf, plan },
    start(ctx) {

      ctx.css('.emoji-picker-scroll{display:flex!important;flex-direction:column!important}');

      function sync() {
        const s = YM.Store.isReady ? YM.Store.getState() : null;
        if (!s || !s.servers) return;
        const rank = new Map(railOrder().map((id, i) => [id, i]));
        if (!rank.size) return;
        document.querySelectorAll('.emoji-picker.above .emoji-picker-scroll').forEach((scroll) => {
          const groups = groupsOf(scroll);
          const order = plan(groups, s.servers, rank);
          if (!order) return;
          let changed = false;
          groups.forEach((g, i) => {
            const want = String(order[i]);
            for (const el of g.els) if (el.style.order !== want) { el.style.order = want; changed = true; }
          });
          if (changed) ctx.log.debug('reordered', order.length, 'emoji-picker sections to match the server list');
        });
      }
      ctx.onMutate(sync);
      ctx.on('store:change', (next, prev) => { if (next.servers !== prev.servers) sync(); });
    },
  });
})();
