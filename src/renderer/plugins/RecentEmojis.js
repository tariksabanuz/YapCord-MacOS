

(function () {
  const KEY = 'pluginData.RecentEmojis';
  const MAX_ITEMS = 24;
  const h = (...a) => YM.dom.h(...a);

  const isEntry = (x) => x && typeof x === 'object' && typeof x.text === 'string' && typeof x.src === 'string';
  function read() {
    const v = YM.settings.get(KEY, []);
    return Array.isArray(v) ? v.filter(isEntry).slice(0, MAX_ITEMS) : [];
  }
  function write(list) { YM.settings.set(KEY, list.slice(0, MAX_ITEMS)); }

  function textOf(btn) {
    if (btn.classList.contains('std')) {
      const img = btn.querySelector('img');
      return img ? img.getAttribute('alt') : null;
    }
    const title = btn.getAttribute('title');
    return title && title.startsWith(':') && title.endsWith(':') && title.length > 2 ? title : null;
  }

  function insertIntoComposer(text) {
    const ta = document.querySelector('.composer textarea');
    if (!ta) return false;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const pad = before && !/\s$/.test(before) && text.startsWith(':') ? ' ' : '';
    const added = pad + text;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, before + added + after);
    const pos = (before + added).length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    return true;
  }

  YM.definePlugin({
    name: 'RecentEmojis',
    description: 'Shows the emoji you picked most recently at the top of the emoji picker, like Discord\'s "Frequently Used" - no more hunting for the one you always use.',
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    api: { read, write },
    options: {
      clear: { type: 'custom', default: false, render: (box) => renderClear(box) },
    },
    start(ctx) {
      ctx.css(`
.ym-re-section{display:flex;align-items:center;justify-content:space-between}
`);

      const onClick = (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('.emoji-picker .emoji-grid .emoji-cell');
        if (!btn) return;
        const img = btn.querySelector('img');
        const text = textOf(btn);
        if (!text || !img || !img.src) return;
        write([{ text, src: img.src }, ...read().filter((g) => g.text !== text)]);
      };
      document.addEventListener('click', onClick, true);

      const onContext = (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('.ym-re-cell');
        if (!btn) return;
        e.preventDefault();
        write(read().filter((g) => g.text !== btn.getAttribute('data-ym-re-text')));
      };
      document.addEventListener('contextmenu', onContext, true);

      function buildSection(list, sig) {
        const grid = h('div', { class: 'emoji-grid' });
        for (const entry of list) {
          grid.append(h('button', {
            type: 'button',
            class: `emoji-cell ym-re-cell${entry.text.startsWith(':') ? '' : ' std'}`,
            title: entry.text,
            'data-ym-re-text': entry.text,
            onClick: () => insertIntoComposer(entry.text),
          }, h('img', { src: entry.src, alt: entry.text, draggable: 'false' })));
        }
        return h('div', { 'data-ym-recent': sig },
          h('div', { class: 'emoji-section ym-re-section' },
            '\u{1F550} Recent',
            h('span', { class: 'hint', style: { fontWeight: 400, textTransform: 'none', letterSpacing: 0 } }, '· right-click to remove')),
          grid);
      }

      const sync = () => {
        document.querySelectorAll('.emoji-picker.above .emoji-picker-scroll').forEach((scroll) => {
          const existing = scroll.querySelector(':scope > [data-ym-recent]');
          const search = scroll.parentElement && scroll.parentElement.querySelector('.emoji-picker-top input');
          const searching = !!(search && search.value.trim());
          const list = searching ? [] : read();
          const sig = list.map((g) => g.text).join('\u0001');
          if (existing && existing.getAttribute('data-ym-recent') === sig) return;
          if (existing) existing.remove();
          if (list.length) scroll.prepend(buildSection(list, sig));
        });
      };

      const onInput = (e) => { if (e.target instanceof Element && e.target.matches('.emoji-picker-top input')) sync(); };
      document.addEventListener('input', onInput, true);

      sync();
      ctx.onMutate(sync);
      ctx.cleanup(YM.settings.onPath(KEY, sync));

      ctx.cleanup(() => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('contextmenu', onContext, true);
        document.removeEventListener('input', onInput, true);
        document.querySelectorAll('[data-ym-recent]').forEach((n) => n.remove());
      });
    },
  });

  function renderClear(box) {
    const count = h('span', { class: 'hint' }, '');
    const refresh = () => { count.textContent = read().length + ' saved'; };
    refresh();
    const off = YM.settings.onPath(KEY, refresh);
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    box.append(
      h('div', { class: 'toggle-label' }, 'Recently used emoji'),
      h('button', { type: 'button', class: 'btn small', onClick: () => { write([]); YM.toast('Recent emoji cleared.'); } }, 'Clear'),
      count,
    );
  }
})();
