

const filters = [];
const REPLAY = Symbol('ym-replay');
let seq = 0;

const Uploads = (YM.uploads = {
  addFilter(fn, { order = 50, name = 'filter' } = {}) {
    const entry = { fn, order, name, seq: seq++ };
    filters.push(entry);
    filters.sort((a, b) => a.order - b.order || a.seq - b.seq);
    return () => {
      const i = filters.indexOf(entry);
      if (i >= 0) filters.splice(i, 1);
    };
  },
  count: () => filters.length,

  async run(files, info = {}) {
    let current = Array.from(files);
    for (const f of filters.slice()) {
      try {
        const out = await f.fn(current, info);
        if (Array.isArray(out) && out.every((x) => x instanceof Blob)) current = out;
      } catch (err) {
        YM.log.error('upload filter ' + f.name + ' failed', err);
      }
    }
    return current;
  },

  progress(text, { cancelLabel = 'Skip' } = {}) {
    const h = YM.dom.h;
    const state = { cancelled: false };
    const label = h('span', {}, text);
    const el = h('div', { class: 'ym-progress', role: 'status' }, label, h('button', { type: 'button', class: 'ym-progress-x', onClick: () => { state.cancelled = true; label.textContent = 'Skipping...'; } }, cancelLabel));
    document.body.appendChild(el);
    return {
      get cancelled() { return state.cancelled; },
      update(t) { label.textContent = t; },
      done() { el.remove(); },
    };
  },
});

YM.dom.css.set(
  'uploads',
  `.ym-progress{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:12px;align-items:center;
  padding:8px 8px 8px 14px;border-radius:999px;background:var(--bg-3,#2a2c33);color:var(--text,#f2f3f5);border:1px solid rgba(255,255,255,.1);
  font:500 13px Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)}
.ym-progress-x{border:0;border-radius:999px;padding:4px 12px;background:rgba(255,255,255,.1);color:inherit;font:inherit;cursor:pointer}
.ym-progress-x:hover{background:rgba(255,255,255,.18)}`,
);

function makeList(files) {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f instanceof File ? f : new File([f], 'file', { type: f.type }));
  return dt;
}

function sameFiles(a, b) {
  return a.length === b.length && a.every((f, i) => f === b[i]);
}

document.addEventListener(
  'change',
  (ev) => {
    const input = ev.target;
    if (!filters.length || ev[REPLAY] || !(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    ev.stopImmediatePropagation();
    Uploads.run(files, { source: 'input', target: input }).then((out) => {
      if (!sameFiles(files, out)) {
        try {
          input.files = makeList(out).files;
        } catch (err) {
          YM.log.error('could not replace the selected files', err);
        }
      }
      const again = new Event('change', { bubbles: true });
      again[REPLAY] = true;
      input.dispatchEvent(again);
    });
  },
  true,
);

document.addEventListener(
  'paste',
  (ev) => {
    if (!filters.length || ev[REPLAY]) return;
    const files = Array.from((ev.clipboardData && ev.clipboardData.files) || []);
    if (!files.length) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const target = ev.target;
    Uploads.run(files, { source: 'paste', target }).then((out) => {
      const again = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: makeList(out) });
      again[REPLAY] = true;
      target.dispatchEvent(again);
    });
  },
  true,
);

document.addEventListener(
  'drop',
  (ev) => {
    if (!filters.length || ev[REPLAY]) return;
    const dt = ev.dataTransfer;
    const files = Array.from((dt && dt.files) || []);
    if (!files.length) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const target = ev.target;
    const pos = { clientX: ev.clientX, clientY: ev.clientY };
    Uploads.run(files, { source: 'drop', target }).then((out) => {
      const again = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: makeList(out), ...pos });
      again[REPLAY] = true;
      target.dispatchEvent(again);
    });
  },
  true,
);
