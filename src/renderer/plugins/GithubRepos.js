

(function () {
  const RE = /\bhttps?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+?)\/?(?=[\s)>\]]|$)/g;
  const cache = new Map();

  function fmtStars(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  YM.definePlugin({
    name: 'GithubRepos',
    description: 'Shows a small card (stars, description, language) under a message that links a plain github.com/owner/repo URL, fetched live from GitHub\'s public API.',
    authors: ['Equicord (ported to Yapper)'],
    tags: ['Chat', 'Utility'],
    start(ctx) {
      ctx.css(`
        .ym-gh-card{display:flex;gap:8px;align-items:flex-start;margin-top:6px;padding:8px 10px;border-radius:8px;background:var(--bg-2,rgba(127,127,127,.08));border:1px solid var(--border,rgba(127,127,127,.2));max-width:420px;text-decoration:none;color:inherit}
        .ym-gh-card:hover{background:var(--bg-3,rgba(127,127,127,.14))}
        .ym-gh-card svg{flex:0 0 auto;margin-top:2px;opacity:.75}
        .ym-gh-name{font-weight:600;font-size:13px}
        .ym-gh-desc{font-size:12px;opacity:.75;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .ym-gh-meta{font-size:11px;opacity:.65;margin-top:4px;display:flex;gap:10px}
      `);

      async function load(key) {
        if (cache.has(key)) return;
        cache.set(key, 'pending');
        try {
          const res = await fetch('https://api.github.com/repos/' + key, { cache: 'force-cache' });
          if (!res.ok) { cache.set(key, 'error'); return; }
          const j = await res.json();
          cache.set(key, {
            full_name: j.full_name,
            description: j.description || '',
            stars: j.stargazers_count || 0,
            language: j.language || '',
          });
          YM.messages.refresh();
        } catch (_) {
          cache.set(key, 'error');
        }
      }

      function render(key, info) {
        const a = YM.dom.h('a', { class: 'ym-gh-card', href: 'https://github.com/' + key, target: '_blank', rel: 'noopener noreferrer' });
        a.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>' +
          '<div style="min-width:0"><div class="ym-gh-name"></div><div class="ym-gh-desc"></div><div class="ym-gh-meta"></div></div>';
        a.querySelector('.ym-gh-name').textContent = info.full_name;
        const desc = a.querySelector('.ym-gh-desc');
        if (info.description) desc.textContent = info.description; else desc.remove();
        const meta = a.querySelector('.ym-gh-meta');
        meta.append(YM.dom.h('span', {}, '★ ' + fmtStars(info.stars)));
        if (info.language) meta.append(YM.dom.h('span', {}, info.language));
        return a;
      }

      ctx.cleanup(YM.messages.decorate(({ body, message }) => {
        if (!body || !message || typeof message.content !== 'string') return;
        const seen = new Set();
        const keys = [];
        for (const m of message.content.matchAll(RE)) {
          if (/^(marketplace|sponsors|notifications|settings|apps|orgs|topics|trending|collections|about|pricing|features|issues|pulls)$/i.test(m[1])) continue;
          const key = m[1] + '/' + m[2];
          if (seen.has(key)) continue;
          seen.add(key);
          keys.push(key);
          if (keys.length >= 2) break;
        }
        const existing = new Map([...body.querySelectorAll(':scope > .ym-gh-card')].map((n) => [n.dataset.key, n]));
        for (const [key, node] of existing) if (!seen.has(key)) node.remove();
        for (const key of keys) {
          if (existing.has(key)) continue;
          const info = cache.get(key);
          if (info === undefined) { load(key); continue; }
          if (info === 'pending' || info === 'error') continue;
          const node = render(key, info);
          node.dataset.key = key;
          body.append(node);
        }
      }));
      ctx.cleanup(() => document.querySelectorAll('.ym-gh-card').forEach((n) => n.remove()));
    },
  });
})();
