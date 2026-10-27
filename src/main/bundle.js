'use strict';

const fs = require('fs');
const path = require('path');
const { RENDERER_DIR, BUNDLED_THEMES_DIR } = require('./constants');
const { parseMeta } = require('./themes');

function listFiles() {
  const core = fs
    .readdirSync(RENDERER_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => path.join(RENDERER_DIR, f));
  const pluginDir = path.join(RENDERER_DIR, 'plugins');
  let plugins = [];
  try {
    plugins = fs
      .readdirSync(pluginDir)
      .filter((f) => f.endsWith('.js'))
      .sort()
      .map((f) => path.join(pluginDir, f));
  } catch (_) {

  }
  return [...core, ...plugins];
}

function readBundledThemes() {
  let files = [];
  try {
    files = fs.readdirSync(BUNDLED_THEMES_DIR).filter((f) => /\.css$/i.test(f));
  } catch (_) {
    return [];
  }
  return files.sort().map((f) => {
    const css = fs.readFileSync(path.join(BUNDLED_THEMES_DIR, f), 'utf8');
    return { ...parseMeta(css, f), css };
  });
}

let cache = null;

function readSources() {
  if (cache && !process.env.YM_DEV) return cache;
  cache = listFiles().map((file) => ({
    rel: path.relative(RENDERER_DIR, file).replace(/\\/g, '/'),
    src: fs.readFileSync(file, 'utf8'),
  }));
  return cache;
}

function wrap(initialExpr) {
  const out = [];
  out.push(
    "(function(){'use strict';\n" +
      "if (window.__YAPPERMOD_LOADED__) return; window.__YAPPERMOD_LOADED__ = true;\n" +
      'var YM = {}; window.YapperMod = YM; window.YapCord = YM;\n' +
      'YM.initial = ' + initialExpr + ';\n',
  );
  for (const { rel, src } of readSources()) {
    out.push(
      '\n/* ===== ' + rel + ' ===== */\n' +
        'try { (function (YM) {\n' + src + '\n})(YM); } catch (e) { console.error("[YapCord] failed to load ' + rel + '", e); }\n',
    );
  }

  out.push('\ntry { YM.bootstrap.start(); } catch (e) { console.error("[YapCord] bootstrap failed", e); }\n');
  out.push('\n})();\n//# sourceURL=yappermod://bundle.js\n');
  return out.join('');
}

function buildBundle(initial) {
  return wrap(JSON.stringify(initial).replace(/</g, '\\u003c'));
}

function buildBundleForExtension() {
  return wrap(
    '(function () { try { var s = localStorage.getItem("yappermod:fallback-settings"); ' +
      'return { settings: s ? JSON.parse(s) : {}, quickCss: localStorage.getItem("yappermod:quickcss") || "", ' +
      'app: { mode: "extension" }, bundledThemes: ' + JSON.stringify(readBundledThemes()) + ' }; } catch (e) { return {}; } })()',
  );
}

function buildBundleForBookmarklet() {
  return wrap(
    '(function () { try { var s = localStorage.getItem("yappermod:fallback-settings"); ' +
      'return { settings: s ? JSON.parse(s) : {}, quickCss: localStorage.getItem("yappermod:quickcss") || "", ' +
      'app: { mode: "bookmarklet" }, bundledThemes: ' + JSON.stringify(readBundledThemes()) + ' }; } catch (e) { return {}; } })()',
  );
}

module.exports = { buildBundle, buildBundleForExtension, buildBundleForBookmarklet, readBundledThemes, listFiles };
