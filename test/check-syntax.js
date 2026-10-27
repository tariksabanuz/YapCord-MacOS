'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let bad = 0;

function check(file, wrap) {
  const src = fs.readFileSync(file, 'utf8');
  const code = wrap ? '(function (YM) {\n' + src + '\n})' : src;
  try {
    new vm.Script(code, { filename: path.relative(root, file) });
  } catch (err) {
    bad++;
    console.error('SYNTAX ERROR in ' + path.relative(root, file) + ': ' + err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
  }
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, fn);
    } else if (e.name.endsWith('.js')) fn(p);
  }
}

walk(path.join(root, 'src', 'renderer'), (f) => check(f, true));
walk(path.join(root, 'src', 'main'), (f) => check(f, false));
walk(path.join(root, 'src', 'preload'), (f) => check(f, false));
walk(path.join(root, 'installer'), (f) => check(f, false));
walk(path.join(root, 'tools'), (f) => check(f, false));
walk(path.join(root, 'extension'), (f) => check(f, false));

if (bad) {
  console.error(bad + ' file(s) with syntax errors');
  process.exit(1);
}
console.log('syntax ok');
