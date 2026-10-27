

const native = window.YapperNative;

const LS_KEY = 'yappermod:fallback-settings';
const lsRead = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch (_) {
    return {};
  }
};

function setPath(obj, dotted, value) {
  const keys = String(dotted).split('.').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!YM.util.isObj(cur[keys[i]])) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

const THEMES_KEY = 'yappermod:fallback-themes';
const THEMES_HIDDEN_KEY = 'yappermod:fallback-themes-hidden';
const bundledThemes = Array.isArray(YM.initial && YM.initial.bundledThemes) ? YM.initial.bundledThemes : [];
const THEME_META_KEYS = ['name', 'author', 'description', 'version', 'license', 'source', 'website', 'invite', 'authorId', 'authorLink', 'donate', 'patreon'];

function readUserThemes() {
  try {
    const v = JSON.parse(localStorage.getItem(THEMES_KEY) || '{}');
    return YM.util.isObj(v) ? v : {};
  } catch (_) {
    return {};
  }
}
function writeUserThemes(obj) {
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(obj));
  } catch (_) {}
}
function readHidden() {
  try {
    const v = JSON.parse(localStorage.getItem(THEMES_HIDDEN_KEY) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch (_) {
    return new Set();
  }
}
function writeHidden(set) {
  try {
    localStorage.setItem(THEMES_HIDDEN_KEY, JSON.stringify([...set]));
  } catch (_) {}
}

function parseThemeMeta(css, fileName) {
  const meta = { fileName, name: fileName.replace(/\.theme\.css$/i, '').replace(/\.css$/i, ''), author: 'Unknown', description: '' };
  const text = String(css || '').replace(/^﻿/, '');
  const m = text.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const mm = line.match(/^\s*\*?\s*@(\w+)\s+(.*?)\s*$/);
      if (mm && THEME_META_KEYS.includes(mm[1])) meta[mm[1]] = mm[2];
    }
  }
  return meta;
}

const browserThemes = {
  async list() {
    const hidden = readHidden();
    const defaults = bundledThemes.filter((t) => !hidden.has(t.fileName)).map((t) => ({ ...t, size: String(t.css || '').length }));
    const user = readUserThemes();
    const added = Object.keys(user).map((fileName) => ({ ...parseThemeMeta(user[fileName], fileName), size: user[fileName].length }));
    return [...defaults, ...added].sort((a, b) => a.name.localeCompare(b.name));
  },
  async read(fileName) {
    const user = readUserThemes();
    if (Object.prototype.hasOwnProperty.call(user, fileName)) return user[fileName];
    const d = bundledThemes.find((t) => t.fileName === fileName);
    return d ? d.css : '';
  },
  async remove(fileName) {
    const user = readUserThemes();
    if (Object.prototype.hasOwnProperty.call(user, fileName)) {
      delete user[fileName];
      writeUserThemes(user);
      return true;
    }
    if (bundledThemes.some((t) => t.fileName === fileName)) {
      const hidden = readHidden();
      hidden.add(fileName);
      writeHidden(hidden);
      return true;
    }
    return false;
  },

  import() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.css,text/css';

      input.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;width:1px;height:1px;pointer-events:none';
      const taken = (name) => Object.prototype.hasOwnProperty.call(readUserThemes(), name) || bundledThemes.some((t) => t.fileName === name);
      input.addEventListener(
        'change',
        async () => {
          const file = input.files && input.files[0];
          input.remove();
          if (!file) return resolve([]);
          try {
            const text = await file.text();
            let fileName = file.name && /\.css$/i.test(file.name) ? file.name : (file.name || 'theme') + '.css';
            if (taken(fileName)) {
              const m = fileName.match(/^(.*?)(\.theme)?\.css$/i);
              const stem = m ? m[1] : fileName;
              const suffix = m && m[2] ? m[2] : '';
              let i = 1;
              let candidate;
              do {
                candidate = stem + '-' + i++ + suffix + '.css';
              } while (taken(candidate));
              fileName = candidate;
            }
            const user = readUserThemes();
            user[fileName] = text;
            writeUserThemes(user);
            resolve([fileName]);
          } catch (_) {
            resolve([]);
          }
        },
        { once: true },
      );
      document.body.appendChild(input);
      input.click();
    });
  },
  async export(fileName) {
    const user = readUserThemes();
    const css = Object.prototype.hasOwnProperty.call(user, fileName) ? user[fileName] : (bundledThemes.find((t) => t.fileName === fileName) || {}).css;
    if (typeof css !== 'string') return false;
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
      a.download = fileName;
      a.click();
      return true;
    } catch (_) {
      return false;
    }
  },
  onChange: () => () => undefined,
};

const fallback = {
  fallback: true,
  settings: {
    get: async () => lsRead(),
    patch: async (p) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(YM.util.deepMerge(lsRead(), p)));
      } catch (_) {}
    },
    set: async (path, value) => {
      const o = lsRead();
      setPath(o, path, value);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(o));
      } catch (_) {}
    },
  },
  quickCss: {
    get: async () => localStorage.getItem('yappermod:quickcss') || '',
    set: async (css) => {
      try {
        localStorage.setItem('yappermod:quickcss', css);
      } catch (_) {}
    },
    onChange: () => () => undefined,
  },
  themes: browserThemes,
  app: {
    info: async () => ({ version: YM.version, platform: navigator.platform, fallback: true }),
    relaunch: async () => location.reload(),
    reload: async () => location.reload(),
    devtools: async () => false,
    quit: async () => undefined,
  },
  openExternal: async (url) => void window.open(url, '_blank', 'noopener'),

  openPath: async (which) => {
    try {
      YM.toast(which === 'themes' ? "There's no themes folder on this platform - use \"Add theme file\" below, or Preview/Remove right from the list." : "There's no folder to open on this platform.");
    } catch (_) {}
    return '';
  },
  setBadge: async () => undefined,
  backup: { export: async () => false, import: async () => ({ ok: false, reason: 'Not available outside the app.' }) },
  net: null,
  files: null,
  icon: null,
  updater: null,
  ui: null,
  saveDiagnostics: async (text) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'yapcord-diagnostics.json';
    a.click();
    return true;
  },
};

YM.native = native || fallback;
YM.inApp = !!native;
