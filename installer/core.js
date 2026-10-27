'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn: realSpawn } = require('child_process');

let patch;
try { patch = require('./yapper-patch.js'); } catch (_) { patch = require('../tools/yapper-patch.js'); }

function payloadDir(resourcesPath, extra) {
  const candidates = [extra, resourcesPath && path.join(resourcesPath, 'payload'), path.join(__dirname, 'payload'), path.join(__dirname, '..')].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(path.join(c, 'src', 'main', 'inject.js'))) return c;
  return null;
}

function payloadInfo(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return { version: String(pkg.version || ''), repo: String((pkg.yapcord || {}).updateRepo || '') };
  } catch (_) {
    return { version: '', repo: '' };
  }
}

function isRunning(exePath, run = execFileSync, platform = process.platform) {
  if (!exePath || platform !== 'win32') return false;
  const image = path.basename(exePath);
  try {
    const out = String(run('tasklist', ['/FI', 'IMAGENAME eq ' + image, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 8000 }));
    return out.toLowerCase().includes('"' + image.toLowerCase() + '"');
  } catch (_) {
    return false;
  }
}

function describe(dir, { appData, run, platform } = {}) {
  const st = patch.status({ installDir: dir, appData: appData || process.env.APPDATA || '' });
  let exe = null;
  try { exe = patch.findMainExe(dir); } catch (_) {  }
  return { dir, patched: st.patched, runtimePresent: st.runtime, exe, running: isRunning(exe, run, platform) };
}

function scan({ env = process.env, extra = [], appData, run, platform } = {}) {
  const dirs = [];
  const add = (d) => { if (d && !dirs.some((x) => x.toLowerCase() === d.toLowerCase())) dirs.push(d); };
  for (const e of extra) { try { add(patch.findInstallDir(e, {})); } catch (_) {  } }
  if (env.LOCALAPPDATA) {
    for (const n of ['yapper-desktop', 'Yapper', 'yapper']) {
      try { add(patch.findInstallDir(path.join(env.LOCALAPPDATA, 'Programs', n), {})); } catch (_) {  }
    }
  }
  return dirs.map((d) => describe(d, { appData: appData || env.APPDATA, run, platform }));
}

function check(dir, opts) {
  const found = patch.findInstallDir(dir, {});
  return describe(found, opts);
}

function perform(action, dir, { payload, appData, run, platform, log } = {}) {
  const lines = [];
  const say = (s) => { lines.push(s); if (log) log(s); };
  try {
    if (!['install', 'repair', 'uninstall'].includes(action)) throw new patch.PatchError('Unknown action.');
    const installDir = patch.findInstallDir(dir, {});
    let exe = null;
    try { exe = patch.findMainExe(installDir); } catch (_) {  }
    if (isRunning(exe, run, platform)) throw new patch.PatchError('Yapper is still running (also check the system tray next to the clock). Quit it completely (right-click the Yapper icon, then Quit) and try again.');
    appData = appData || process.env.APPDATA || '';
    if (!appData) throw new patch.PatchError('Could not find your AppData folder.');
    say('Found Yapper in ' + installDir);
    if (action === 'uninstall') {
      patch.uninstall({ installDir, appData, log: say });
    } else {
      if (!payload) throw new patch.PatchError('The YapCord files are missing from this installer. Download it again.');
      patch.install({ installDir, sourceRoot: payload, appData, log: say });
    }
    return { ok: true, lines };
  } catch (err) {
    const msg = err instanceof patch.PatchError ? err.message : 'Unexpected error: ' + ((err && err.message) || err);
    say('Failed: ' + msg);
    return { ok: false, lines, error: msg };
  }
}

function launch(dir, spawn = realSpawn) {
  const installDir = patch.findInstallDir(dir, {});
  const exe = patch.findMainExe(installDir);
  if (!exe) throw new patch.PatchError('Could not find the Yapper program in ' + installDir + '.');
  const child = spawn(exe, [], { detached: true, stdio: 'ignore', cwd: installDir });
  if (child && typeof child.unref === 'function') child.unref();
  return exe;
}

module.exports = { payloadDir, payloadInfo, isRunning, describe, scan, check, perform, launch, patch };
