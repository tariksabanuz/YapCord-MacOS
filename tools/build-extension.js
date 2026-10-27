#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildBundleForExtension } = require('../src/main/bundle');

const ROOT = path.join(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');

function stage(outDir) {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));
  manifest.version = rootPkg.version;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.cpSync(path.join(EXT_DIR, 'icons'), path.join(outDir, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'injected.js'), buildBundleForExtension());
  return manifest;
}

function zipDir(outDir, zipPath) {
  fs.rmSync(zipPath, { force: true });
  const cmd = process.platform === 'win32' ? 'powershell' : 'zip';
  const r =
    process.platform === 'win32'
      ? spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}"`], { stdio: 'inherit' })
      : spawnSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error((cmd === 'zip' ? 'zip' : 'Compress-Archive') + ' failed (exit ' + r.status + ')');
}

function main(argv) {
  const stageOnlyIdx = argv.indexOf('--stage-only');
  if (stageOnlyIdx !== -1) {
    const outDir = argv[stageOnlyIdx + 1];
    if (!outDir) {
      console.error('--stage-only needs a directory argument');
      return 1;
    }
    const manifest = stage(path.resolve(outDir));
    console.log('Extension staged in ' + outDir + ' (version ' + manifest.version + ')');
    return 0;
  }

  const outDir = path.join(ROOT, 'dist', 'extension-stage');
  const manifest = stage(outDir);
  console.log('Extension staged in ' + path.relative(ROOT, outDir) + ' (version ' + manifest.version + ').');
  console.log('Load it unpacked: chrome://extensions -> Developer mode -> Load unpacked -> pick that folder.');

  if (argv.includes('--zip')) {
    const zipPath = path.join(ROOT, 'dist', 'YapCord-Extension-' + manifest.version + '.zip');
    zipDir(outDir, zipPath);
    console.log('Zipped: ' + path.relative(ROOT, zipPath));
  }
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { stage, zipDir };
