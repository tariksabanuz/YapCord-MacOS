

const T = (YM.themes = {
  available: [],
  applied: new Map(),
  links: new Map(),
  quickCssEl: null,
  previewEl: null,
  previewing: null,
});

const MAX_THEME_BYTES = 4 * 1024 * 1024;

function styleEl(id, text) {
  const el = document.createElement('style');
  el.id = id;
  el.setAttribute('data-yappermod', 'theme');
  el.textContent = text;
  return el;
}

function host() {
  return document.head || document.documentElement;
}

async function applyTheme(fileName) {
  let css = '';
  try {
    css = await YM.native.themes.read(fileName);
  } catch (err) {
    YM.log.warn('could not read theme ' + fileName, err);
  }
  if (typeof css !== 'string' || !css || css.length > MAX_THEME_BYTES) return;

  if (!(YM.settings.get('enabledThemes', []) || []).includes(fileName)) return;
  const existing = T.applied.get(fileName);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const el = styleEl('ym-theme-' + fileName.replace(/[^A-Za-z0-9_-]/g, '_'), css);
  T.applied.set(fileName, el);
  host().appendChild(el);
  keepQuickCssLast();
}

function removeTheme(fileName) {
  const el = T.applied.get(fileName);
  if (el) {
    el.remove();
    T.applied.delete(fileName);
  }
}

function safeHttpUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch (_) {
    return null;
  }
}

function syncLinks() {
  const wanted = new Set((YM.settings.get('themeLinks', []) || []).map(safeHttpUrl).filter(Boolean));
  for (const [url, el] of T.links) {
    if (!wanted.has(url)) {
      el.remove();
      T.links.delete(url);
    }
  }
  for (const url of wanted) {
    if (T.links.has(url)) continue;
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = url;
    el.setAttribute('data-yappermod', 'theme-link');
    T.links.set(url, el);
    host().appendChild(el);
  }
  keepQuickCssLast();
}

function keepQuickCssLast() {
  const el = T.quickCssEl;
  if (el && el.isConnected && el.nextElementSibling) host().appendChild(el);
}

function syncThemes() {
  const enabled = new Set(YM.settings.get('enabledThemes', []) || []);
  for (const fileName of [...T.applied.keys()]) if (!enabled.has(fileName)) removeTheme(fileName);
  for (const fileName of enabled) applyTheme(fileName);
}

async function setQuickCss(css) {
  if (!T.quickCssEl) {
    T.quickCssEl = styleEl('ym-quickcss', '');
    T.quickCssEl.setAttribute('data-yappermod', 'quickcss');
  }
  T.quickCssEl.textContent = YM.settings.get('useQuickCss', true) ? css || '' : '';
  if (!T.quickCssEl.isConnected) host().appendChild(T.quickCssEl);
  else keepQuickCssLast();
}

Object.assign(T, {
  async refresh() {
    try {
      T.available = (await YM.native.themes.list()) || [];
    } catch (err) {
      T.available = [];
      YM.log.warn('could not list themes', err);
    }
    YM.Events.emit('themes:list', T.available);
    return T.available;
  },
  isEnabled: (fileName) => (YM.settings.get('enabledThemes', []) || []).includes(fileName),
  setEnabled(fileName, on) {
    const cur = new Set(YM.settings.get('enabledThemes', []) || []);
    if (on) cur.add(fileName);
    else cur.delete(fileName);
    YM.settings.set('enabledThemes', [...cur]);
    syncThemes();
  },
  addLink(url) {
    const href = safeHttpUrl(url);
    if (!href) return false;
    const cur = YM.settings.get('themeLinks', []) || [];
    if (!cur.includes(href)) YM.settings.set('themeLinks', [...cur, href]);
    syncLinks();
    return true;
  },
  removeLink(url) {
    YM.settings.set('themeLinks', (YM.settings.get('themeLinks', []) || []).filter((u) => u !== url));
    syncLinks();
  },
  async setQuickCss(css) {
    await YM.native.quickCss.set(css);
    await setQuickCss(css);
  },
  async getQuickCss() {
    try {
      return (await YM.native.quickCss.get()) || '';
    } catch (_) {
      return '';
    }
  },
  async importFile() {
    const added = await YM.native.themes.import();
    await T.refresh();
    return added;
  },
  async remove(fileName) {
    T.setEnabled(fileName, false);
    await YM.native.themes.remove(fileName);
    await T.refresh();
  },
  async share(fileName) {
    try {
      return !!(await YM.native.themes.export(fileName));
    } catch (err) {
      YM.log.warn('could not export theme ' + fileName, err);
      return false;
    }
  },

  async previewTheme(fileName) {
    let css = '';
    try {
      css = await YM.native.themes.read(fileName);
    } catch (err) {
      YM.log.warn('could not read theme ' + fileName, err);
    }
    if (!T.previewEl) {
      T.previewEl = styleEl('ym-theme-preview', '');
      T.previewEl.setAttribute('data-yappermod', 'theme-preview');
    }
    T.previewEl.textContent = typeof css === 'string' ? css.slice(0, MAX_THEME_BYTES) : '';
    if (!T.previewEl.isConnected) host().appendChild(T.previewEl);
    T.previewing = fileName;
    keepQuickCssLast();
  },
  stopPreview() {
    if (T.previewEl) T.previewEl.remove();
    T.previewing = null;
  },
  async init() {
    await T.refresh();
    syncThemes();
    syncLinks();
    await setQuickCss(await T.getQuickCss());
  },
});

YM.native.themes.onChange(async (list) => {
  T.available = list || (await YM.native.themes.list());
  YM.Events.emit('themes:list', T.available);
  for (const fileName of T.applied.keys()) applyTheme(fileName);
});
YM.native.quickCss.onChange((css) => setQuickCss(css));
YM.settings.onPath('useQuickCss', async () => setQuickCss(await T.getQuickCss()));
