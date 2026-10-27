

(function () {
  const h = YM.dom.h;

  function textOf(el) { return (el.textContent || '').trim(); }

  function findPage() {
    const heading = [...document.querySelectorAll('h1, h2, h3')].find((n) => textOf(n) === 'Onboarding');
    if (!heading) return null;
    const page = heading.closest('div');
    if (!page) return null;
    const hasQuestions = [...page.querySelectorAll('*')].some((n) => textOf(n) === 'QUESTIONS');
    return hasQuestions || page.querySelector('button') ? page : null;
  }

  function innermostWithText(root, text) {
    const matches = [...root.querySelectorAll('*')].filter((n) => textOf(n) === text);
    return matches.length ? matches[matches.length - 1] : undefined;
  }
  const labelBefore = innermostWithText;

  function section(label, ...content) {
    return h('div', { class: 'ym-ob-section' }, h('div', { class: 'ym-ob-section-label' }, label), ...content);
  }

  function collect(fromEl, toEl) {
    const out = [];
    let n = fromEl;
    while (n && n !== toEl) { const next = n.nextElementSibling; out.push(n); n = next; }
    return out;
  }

  function polish(page) {
    if (!page) return;
    if (page.dataset.ymObDone === 'true') {
      const qContainer = page.querySelector('.ym-ob-questions');
      if (qContainer) numberQuestions(qContainer);
      return;
    }
    const heading = [...page.querySelectorAll('h1, h2, h3')].find((n) => textOf(n) === 'Onboarding');
    const toggleOn = innermostWithText(page, 'Turn on onboarding');
    const startingLabel = labelBefore(page, 'STARTING CHANNEL');
    const questionsLabel = labelBefore(page, 'QUESTIONS');
    const saveBtn = [...page.querySelectorAll('button')].find((n) => n.children.length === 0 && textOf(n) === 'Save');
    if (!heading || !questionsLabel) return;

    page.dataset.ymObDone = 'true';
    page.classList.add('ym-ob-page');

    const toggleRoot = toggleOn ? toggleOn.closest('div').parentElement : null;
    if (toggleRoot && startingLabel && toggleRoot.contains(startingLabel) === false) {
      const toggleRows = collect(toggleRoot, startingLabel);
      if (toggleRows.length) {
        const wrap = section('1 · Turn it on', ...toggleRows);
        startingLabel.before(wrap);
      }
    }

    if (startingLabel && questionsLabel) {
      const rows = collect(startingLabel, questionsLabel);
      if (rows.length) {
        const wrap = section('2 · Where people land', ...rows);
        questionsLabel.before(wrap);
      }
    }

    if (questionsLabel) {
      const rows = collect(questionsLabel, null);
      const tailStart = saveBtn && rows.includes(saveBtn) ? rows.indexOf(saveBtn) : rows.length;
      const body = rows.slice(0, tailStart);
      const tail = rows.slice(tailStart);
      const wrap = section('3 · Questions people answer', ...body);
      wrap.classList.add('ym-ob-questions');
      if (tail.length) tail[0].before(wrap, ...tail);
      else questionsLabel.after(wrap);
      numberQuestions(wrap);
    }
  }

  function directChildContaining(ancestor, el) {
    let n = el;
    while (n && n.parentElement !== ancestor) n = n.parentElement;
    return n;
  }

  function numberQuestions(root) {
    const addAnswerBtns = [...root.querySelectorAll('button')].filter((b) => textOf(b) === 'Add answer');
    addAnswerBtns.forEach((addAnswerBtn, i) => {
      let block = addAnswerBtn.parentElement;
      while (block && root.contains(block) && !innermostWithText(block, 'PEOPLE CAN PICK MORE THAN ONE')) block = block.parentElement;
      if (!block || !root.contains(block)) return;
      block.classList.add('ym-ob-question');
      let head = block.querySelector(':scope > .ym-ob-q-head');
      if (!head) { head = h('div', { class: 'ym-ob-q-head' }, ''); block.prepend(head); }
      head.textContent = `Question ${i + 1}`;

      const pickMoreLeaf = innermostWithText(block, 'PEOPLE CAN PICK MORE THAN ONE');
      const pickMoreRow = pickMoreLeaf ? directChildContaining(block, pickMoreLeaf) : null;
      const addAnswerRow = directChildContaining(block, addAnswerBtn);
      if (pickMoreRow && addAnswerRow) {
        collect(pickMoreRow, addAnswerRow).slice(1).forEach((row) => row.classList.add('ym-ob-answer'));
      }
    });
  }

  YM.definePlugin({
    name: 'OnboardingPolish',
    description: 'Restyles Server Settings > Onboarding into clear numbered sections, and boxes off each question\'s answers, so the page stays readable once you start adding questions.',
    authors: ['YapCord'],
    tags: ['Servers', 'Utility'],
    alwaysOn: true,
    start(ctx) {
      ctx.css(`
        .ym-ob-page { display: flex; flex-direction: column; }
        .ym-ob-section { border: 1px solid var(--border, rgba(255,255,255,.12)); border-radius: 8px; padding: 14px 16px; margin: 10px 0; background: color-mix(in srgb, var(--accent) 3%, transparent); }
        .ym-ob-section-label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; opacity: .65; margin-bottom: 10px; }
        .ym-ob-questions { background: transparent; }
        .ym-ob-question { border: 1px solid var(--border, rgba(255,255,255,.12)); border-radius: 8px; padding: 12px 14px; margin: 10px 0; background: color-mix(in srgb, var(--accent) 2%, transparent); }
        .ym-ob-q-head { font-size: 12px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; opacity: .7; margin-bottom: 8px; }
        .ym-ob-answer { border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); padding-left: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
      `);
      const sync = () => { const page = findPage(); if (page) polish(page); };
      ctx.onMutate(sync);
      sync();
      ctx.cleanup(() => {
        document.querySelectorAll('.ym-ob-page').forEach((n) => { n.classList.remove('ym-ob-page'); delete n.dataset.ymObDone; });
        document.querySelectorAll('.ym-ob-section, .ym-ob-question').forEach((n) => { while (n.firstChild && n.firstChild.classList && (n.firstChild.classList.contains('ym-ob-section-label') || n.firstChild.classList.contains('ym-ob-q-head'))) n.firstChild.remove(); n.replaceWith(...n.childNodes); });
        document.querySelectorAll('.ym-ob-answer').forEach((n) => n.classList.remove('ym-ob-answer'));
      });
    },
  });
})();
