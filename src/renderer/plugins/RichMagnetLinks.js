

(function () {
  const RE = /\bmagnet:\?[^\s<>"]+/g;

  function parseName(magnet) {
    try {
      const q = magnet.slice(magnet.indexOf('?') + 1);
      const params = new URLSearchParams(q);
      return params.get('dn') || '';
    } catch (_) {
      return '';
    }
  }

  YM.definePlugin({
    name: 'RichMagnetLinks',
    description: 'Shows a small card with the torrent name under any magnet: link in a message, instead of just the raw link text.',
    authors: ['Equicord (ported to Yapper)'],
    tags: ['Chat', 'Utility'],
    start(ctx) {
      ctx.css(`
        .ym-magnet-card{display:flex;gap:8px;align-items:center;margin-top:6px;padding:8px 10px;border-radius:8px;background:var(--bg-2,rgba(127,127,127,.08));border:1px solid var(--border,rgba(127,127,127,.2));max-width:420px;text-decoration:none;color:inherit}
        .ym-magnet-card:hover{background:var(--bg-3,rgba(127,127,127,.14))}
        .ym-magnet-card svg{flex:0 0 auto;opacity:.75}
        .ym-magnet-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      `);

      ctx.cleanup(YM.messages.decorate(({ body, message }) => {
        if (!body || !message || typeof message.content !== 'string') return;
        const links = [...new Set((message.content.match(RE) || []).slice(0, 2))];
        const existing = new Map([...body.querySelectorAll(':scope > .ym-magnet-card')].map((n) => [n.dataset.link, n]));
        for (const [link, node] of existing) if (!links.includes(link)) node.remove();
        for (const link of links) {
          if (existing.has(link)) continue;
          const name = parseName(link) || 'Magnet link';
          const a = YM.dom.h('a', { class: 'ym-magnet-card', href: link, title: link });
          a.dataset.link = link;
          a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2a3 3 0 0 1 3 3v6a7 7 0 0 1-14 0V5a3 3 0 0 1 3-3h2v9a2 2 0 0 0 4 0V2h2z"/><path d="M4 14v3a2 2 0 0 0 2 2h2M20 14v3a2 2 0 0 1-2 2h-2"/></svg><span class="ym-magnet-name"></span>';
          a.querySelector('.ym-magnet-name').textContent = name;
          body.append(a);
        }
      }));
      ctx.cleanup(() => document.querySelectorAll('.ym-magnet-card').forEach((n) => n.remove()));
    },
  });
})();
