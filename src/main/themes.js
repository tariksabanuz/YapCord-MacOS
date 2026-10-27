'use strict';

const fs = require('fs');
const path = require('path');

const META_KEYS = [
  'name', 'author', 'description', 'version', 'license', 'source', 'website', 'invite', 'authorId', 'authorLink', 'donate', 'patreon',
];

function parseMeta(css, fileName) {
  const meta = {
    fileName,
    name: fileName.replace(/\.theme\.css$/i, '').replace(/\.css$/i, ''),
    author: 'Unknown',
    description: '',
  };
  const text = css.replace(/^﻿/, '');
  const m = text.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const mm = line.match(/^\s*\*?\s*@(\w+)\s+(.*?)\s*$/);
      if (mm && META_KEYS.includes(mm[1])) meta[mm[1]] = mm[2];
    }
  }
  return meta;
}

function safeName(fileName) {
  if (typeof fileName !== 'string') return null;

  if (/[\\/:*?"<>|\u0000-\u001f]/.test(fileName)) return null;
  const base = path.basename(fileName);
  if (!base || base !== fileName || !/\.css$/i.test(base) || base.startsWith('.')) return null;
  return base;
}

const LEGACY_BUNDLED = ['Amoled.theme.css', 'Compact.theme.css', 'Midnight.theme.css'];

class ThemeManager {
  constructor(dir) {
    this.dir = dir;
    this._watchers = [];
  }

  ensureDir(bundledDir) {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!bundledDir || !fs.existsSync(bundledDir)) return;
    const listFile = path.join(this.dir, '.seeded.json');
    const oldMarker = path.join(this.dir, '.seeded');
    let seeded = null;
    try {
      const parsed = JSON.parse(fs.readFileSync(listFile, 'utf8'));
      if (Array.isArray(parsed)) seeded = parsed.filter((x) => typeof x === 'string');
    } catch (_) {

    }
    if (!seeded) seeded = fs.existsSync(oldMarker) ? LEGACY_BUNDLED.slice() : [];
    const known = new Set(seeded);
    let changed = false;
    for (const f of fs.readdirSync(bundledDir).sort()) {
      if (!/\.css$/i.test(f) || known.has(f)) continue;
      const dest = path.join(this.dir, f);
      try {
        if (!fs.existsSync(dest)) fs.copyFileSync(path.join(bundledDir, f), dest);
        known.add(f);
        changed = true;
      } catch (_) {

      }
    }
    if (changed || !fs.existsSync(listFile)) {
      try {
        fs.writeFileSync(listFile, JSON.stringify([...known].sort(), null, 2), 'utf8');
      } catch (_) {

      }
    }
  }

  list() {
    let files = [];
    try {
      files = fs.readdirSync(this.dir).filter((f) => !!safeName(f));
    } catch (_) {
      return [];
    }
    const out = [];
    for (const f of files) {
      try {
        const css = fs.readFileSync(path.join(this.dir, f), 'utf8');
        out.push({ ...parseMeta(css, f), size: css.length });
      } catch (_) {

      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  read(fileName) {
    const safe = safeName(fileName);
    if (!safe) return '';
    try {
      return fs.readFileSync(path.join(this.dir, safe), 'utf8');
    } catch (_) {
      return '';
    }
  }

  importFile(srcPath) {
    const base = path.basename(srcPath);
    if (!/\.css$/i.test(base)) return null;
    let dest = path.join(this.dir, base);
    let i = 1;
    while (fs.existsSync(dest)) {
      dest = path.join(this.dir, base.replace(/(\.theme)?\.css$/i, `-${i++}$&`));
    }
    fs.copyFileSync(srcPath, dest);
    return path.basename(dest);
  }

  remove(fileName) {
    const safe = safeName(fileName);
    if (!safe) return false;
    try {
      fs.unlinkSync(path.join(this.dir, safe));
      return true;
    } catch (_) {
      return false;
    }
  }

  watch(onChange) {
    this.unwatch();
    let timer = null;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 200);
    };
    try {
      this._watchers.push(fs.watch(this.dir, { persistent: false }, fire));
    } catch (_) {

    }
  }

  unwatch() {
    for (const w of this._watchers) {
      try {
        w.close();
      } catch (_) {

      }
    }
    this._watchers = [];
  }
}

module.exports = { ThemeManager, parseMeta, safeName };
