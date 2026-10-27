#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAYLOAD_ITEMS = ['src', 'themes', 'build', 'package.json', 'LICENSE', 'LICENSES'];
const INSTALLER_FILES = ['main.js', 'preload.js', 'core.js', 'index.html', 'installer.css', 'ui.js'];

function electronVersion() {
  try { return require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version; } catch (_) {  }
  const range = (require(path.join(ROOT, 'package.json')).devDependencies || {}).electron || '38.0.0';
  return String(range).replace(/^[^\d]*/, '');
}

function stage(outDir) {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of INSTALLER_FILES) fs.copyFileSync(path.join(ROOT, 'installer', f), path.join(outDir, f));
  fs.copyFileSync(path.join(ROOT, 'tools', 'yapper-patch.js'), path.join(outDir, 'yapper-patch.js'));
  fs.copyFileSync(path.join(ROOT, 'build', 'icon.png'), path.join(outDir, 'icon.png'));
  for (const name of PAYLOAD_ITEMS) {
    const from = path.join(ROOT, name);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(outDir, 'payload', name), { recursive: true });
  }
  const pkg = {
    name: 'yapcord-installer',
    productName: 'YapCord Installer',
    version: rootPkg.version,
    description: 'Puts YapCord inside the official Yapper app',
    main: 'main.js',
    author: rootPkg.author || 'YapCord contributors',
    license: rootPkg.license || 'GPL-3.0-or-later',
    private: true,
    build: {
      appId: 'dev.yapcord.installer',
      productName: 'YapCord Installer',
      electronVersion: electronVersion(),
      directories: { output: path.join(ROOT, 'dist'), buildResources: 'build' },
      files: [...INSTALLER_FILES, 'yapper-patch.js', 'icon.png', 'package.json'],
      extraResources: [{ from: 'payload', to: 'payload' }],
      win: { icon: 'icon.png', target: ['portable'] },
      portable: { artifactName: 'YapCord-Installer-${version}.exe', unpackDirName: 'YapCord-Installer-' + Date.now().toString(36) },
    },
  };
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2));
  return pkg;
}

const WINDOWS_SHELL_UNSAFE = /[()&%^!<>|"]/;
function findUnsafeWindowsPathChar(p) {
  const m = p.match(WINDOWS_SHELL_UNSAFE);
  return m ? m[0] : null;
}

function main(argv) {
  if (process.platform === 'win32') {
    const bad = findUnsafeWindowsPathChar(ROOT);
    if (bad) {
      console.error(
        '\nThis folder\'s path contains a character ("' + bad + '") that Windows\' own command line breaks on ' +
        'when building the installer - usually the "(1)" Windows adds when a .zip is extracted a second time ' +
        'without removing the first copy.\n\n  ' + ROOT + '\n\nMove or rename this folder so its path has no ' +
        'parentheses (and ideally no spaces either), e.g. C:\\YapCord, then run `npm run dist:installer` again ' +
        'from there. (If you only need YapCord working inside Yapper and not a separate installer .exe, ' +
        '`node tools\\yapper-patch.js install` does not need any of this and works from here as-is.)',
      );
      return 1;
    }
  }
  const outDir = path.join(ROOT, 'dist', 'installer-stage');
  const pkg = stage(outDir);
  console.log('Installer folder ready in ' + outDir + ' (version ' + pkg.version + ')');
  if (argv.includes('--stage-only')) return 0;
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(cmd, ['--yes', 'electron-builder', '--projectDir', outDir, '--win', 'portable'], { stdio: 'inherit', shell: process.platform === 'win32', cwd: ROOT });
  if (r.status !== 0) {
    console.error('\nelectron-builder failed. Check that you have internet (it downloads its parts) and try again.');
    return r.status || 1;
  }
  console.log('\nDone: dist\\YapCord-Installer-' + pkg.version + '.exe');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { stage, electronVersion, findUnsafeWindowsPathChar };
