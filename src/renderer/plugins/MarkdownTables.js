

(function () {
  const SEP_CELL = /^:?-{3,}:?$/;

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  }

  function parseTables(text) {
    const lines = text.split('\n');
    const tables = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (!lines[i].includes('|') || !lines[i + 1].includes('|')) continue;
      const sepCells = splitRow(lines[i + 1]);
      if (sepCells.length < 2 || !sepCells.every((c) => SEP_CELL.test(c))) continue;
      const header = splitRow(lines[i]);
      if (header.length !== sepCells.length) continue;
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|') && lines[j].trim()) {
        const cells = splitRow(lines[j]);
        if (cells.length !== header.length) break;
        rows.push(cells);
        j++;
      }
      tables.push({ header, rows });
      i = j - 1;
      if (tables.length >= 2) break;
    }
    return tables;
  }

  function buildTable(t) {
    const table = YM.dom.h('table', { class: 'ym-md-table' });
    const thead = YM.dom.h('thead');
    const htr = YM.dom.h('tr');
    for (const h of t.header) htr.append(YM.dom.h('th', {}, h));
    thead.append(htr);
    const tbody = YM.dom.h('tbody');
    for (const row of t.rows) {
      const tr = YM.dom.h('tr');
      for (const c of row) tr.append(YM.dom.h('td', {}, c));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    return table;
  }

  YM.definePlugin({
    name: 'MarkdownTables',
    description: 'Renders a GitHub-style markdown table typed in a message (| a | b | / |---|---|) as a real table underneath it.',
    authors: ['Equicord (ported to Yapper)'],
    tags: ['Chat', 'Appearance'],
    start(ctx) {
      ctx.css(`
        .ym-md-tables{margin-top:6px}
        .ym-md-table{border-collapse:collapse;font-size:12px;max-width:100%}
        .ym-md-table th,.ym-md-table td{border:1px solid var(--border,rgba(127,127,127,.25));padding:4px 8px;text-align:left}
        .ym-md-table th{background:var(--bg-2,rgba(127,127,127,.1));font-weight:600}
      `);
      ctx.cleanup(YM.messages.decorate(({ body, message }) => {
        if (!body || !message || typeof message.content !== 'string' || !message.content.includes('|')) {
          const old = body && body.querySelector(':scope > .ym-md-tables');
          if (old) old.remove();
          return;
        }
        const tables = parseTables(message.content);
        let wrap = body.querySelector(':scope > .ym-md-tables');
        if (!tables.length) { if (wrap) wrap.remove(); return; }
        if (!wrap) { wrap = YM.dom.h('div', { class: 'ym-md-tables' }); body.append(wrap); }
        wrap.innerHTML = '';
        for (const t of tables) wrap.append(buildTable(t));
      }));
      ctx.cleanup(() => document.querySelectorAll('.ym-md-tables').forEach((n) => n.remove()));
    },
  });
})();
