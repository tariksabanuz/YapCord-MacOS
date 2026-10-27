'use strict';
(function () {
  const api = window.installer;
  const $ = (id) => document.getElementById(id);
  let installs = [];
  let selected = '';
  let busy = false;
  let version = '';

  const nameOf = (i) => 'Yapper (' + (i.patched ? 'YapCord installed' : 'YapCord not installed') + ')';

  function current() { return installs.find((i) => i.dir === selected) || null; }

  function showResult(ok, text) {
    const el = $('result');
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'result ' + (ok ? 'ok' : 'err');
  }

  function drawInstalls() {
    const box = $('installs');
    box.replaceChildren();
    if (!installs.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Could not find the Yapper app. Click "Choose another folder..." and pick the folder that contains Yapper.exe (usually in AppData\\Local\\Programs).';
      box.append(e);
      return;
    }
    for (const i of installs) {
      const label = document.createElement('label');
      label.className = 'install';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'install';
      radio.value = i.dir;
      radio.checked = i.dir === selected;
      radio.addEventListener('change', () => { selected = i.dir; refresh(); });
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = nameOf(i);
      const path = document.createElement('span');
      path.className = 'path';
      path.title = i.dir;
      const bdi = document.createElement('bdi');
      bdi.textContent = i.dir;
      path.append(bdi);
      label.append(radio, name, path);
      box.append(label);
    }
  }

  function refresh() {
    drawInstalls();
    const i = current();
    $('install').disabled = busy || !i || i.patched;
    $('repair').disabled = busy || !i || !i.patched;
    $('uninstall').disabled = busy || !i || !i.patched;
    $('launch').disabled = busy || !i || !i.exe;
    $('choose').disabled = busy;
  }

  function merge(install) {
    if (!install) return;
    const k = installs.findIndex((x) => x.dir.toLowerCase() === install.dir.toLowerCase());
    if (k >= 0) installs[k] = install; else installs.push(install);
    selected = install.dir;
  }

  function addLog(line) {
    const log = $('log');
    log.hidden = false;
    log.textContent += (log.textContent ? '\n' : '') + line;
    log.scrollTop = log.scrollHeight;
  }

  async function run(action) {
    const i = current();
    if (!i || busy) return;
    busy = true;
    showResult(true, '');
    $('log').textContent = '';
    $('log').hidden = true;
    refresh();
    let res;
    try { res = await api.run(action, i.dir); } catch (err) { res = { ok: false, error: String((err && err.message) || err) }; }
    busy = false;
    if (res.install) merge(res.install);
    refresh();
    if (res.ok) {
      showResult(true, action === 'uninstall'
        ? 'Done. YapCord has been removed from Yapper; Yapper is back to how it was.'
        : 'Done! You can just open Yapper now. You stay logged in. The settings are in Yapper under the gear icon, in the "YapCord" section.');
    } else {
      showResult(false, res.error || 'Something went wrong.');
    }
  }

  async function init() {
    $('foot').textContent = 'YapCord Installer';
    let info;
    try { info = await api.info(); } catch (err) { showResult(false, 'Cannot start the installer: ' + ((err && err.message) || err)); return; }
    version = info.version || '';
    installs = info.installs || [];
    selected = (installs[0] || {}).dir || '';
    $('notice').textContent = info.repo
      ? 'github.com/' + info.repo + ' is the only official place to get YapCord. If you got this program from anywhere else, delete it and download it again.'
      : 'Only download YapCord from its maker. If you got this program from anywhere else, delete it.';
    $('foot').textContent = 'YapCord ' + version + (info.payloadOk ? '' : ' (files missing from this program)');
    if (!info.payloadOk) showResult(false, 'The YapCord files are missing from this installer. Download it again.');
    refresh();
  }

  $('install').addEventListener('click', () => run('install'));
  $('repair').addEventListener('click', () => run('repair'));
  $('uninstall').addEventListener('click', () => run('uninstall'));
  $('launch').addEventListener('click', async () => {
    const i = current();
    if (!i) return;
    const r = await api.launch(i.dir);
    showResult(!!(r && r.ok), r && r.ok ? 'Starting Yapper...' : (r && r.error) || 'Could not start Yapper.');
  });
  $('choose').addEventListener('click', async () => {
    const r = await api.choose();
    if (!r || r.canceled) return;
    if (!r.ok) { showResult(false, r.error || 'That is not the Yapper folder.'); return; }
    showResult(true, '');
    merge(r.install);
    refresh();
  });
  api.onLog(addLog);
  init();
})();
