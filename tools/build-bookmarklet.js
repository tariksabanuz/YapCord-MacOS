#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildBundleForBookmarklet } = require('../src/main/bundle');

const ROOT = path.join(__dirname, '..');

function buildUri() {
  return 'javascript:' + encodeURIComponent(buildBundleForBookmarklet());
}

function buildHtml(uri, version) {
  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install YapCord (bookmarklet)</title>
<style>
  :root { --bg:#1e1f22; --card:#2b2d31; --text:#dbdee1; --muted:#949ba4; --accent:#5865f2; --accent-text:#fff; }
  @media (prefers-color-scheme: light) { :root { --bg:#f2f3f5; --card:#fff; --text:#2e3338; --muted:#5c6269; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.5; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 14px; }
  .card { background: var(--card); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 10px; }
  .card p, .card li { font-size: 14px; color: var(--text); }
  .card ol, .card ul { margin: 0; padding-left: 20px; }
  .card li { margin-bottom: 8px; }
  .install-btn { display:block; text-align:center; background: var(--accent); color: var(--accent-text) !important; text-decoration:none; font-weight:600; font-size:16px; padding:16px; border-radius:10px; margin: 6px 0 4px; }
  .install-btn:active { opacity: 0.85; }
  .hint { color: var(--muted); font-size: 12px; text-align:center; margin: 0 0 20px; }
  button.copy { background: transparent; border: 1px solid var(--muted); color: var(--text); border-radius: 8px; padding: 10px 14px; font-size: 13px; cursor: pointer; width: 100%; }
  button.copy:active { opacity: 0.8; }
  .ok { color: #23a55a; }
  code { background: rgba(127,127,127,.15); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  .badge { display:inline-block; font-size:11px; color:var(--muted); border:1px solid var(--muted); border-radius:6px; padding:1px 6px; margin-left:6px; vertical-align:middle; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Install YapCord <span class="badge">v${version}</span></h1>
  <p class="sub">The bookmarklet version - works on literally any phone browser (iPhone Safari included), with no extension and nothing to install from a store. One tap re-runs it on the current Yapper tab.</p>

  <a class="install-btn" id="installLink" href="${escAttr(uri)}">\u{1F4F1} Install YapCord</a>
  <p class="hint">On a phone, tapping this link directly may just try to "run" it once instead of saving it - use one of the methods below to save it as a bookmark you can tap again.</p>

  <div class="card">
    <h2>iPhone (recommended method: Shortcuts)</h2>
    <ol>
      <li>Copy the code below (tap "Copy code").</li>
      <li>Open the <b>Shortcuts</b> app → <b>+</b> (new shortcut) → add action <b>"Run JavaScript on Webpage"</b> (under Web / Scripting).</li>
      <li>Paste the copied code into that action's script box. Name the shortcut "YapCord".</li>
      <li>On <code>yapper.website</code>, tap <b>Share</b> → <b>YapCord</b> (scroll to it, or pin it from "Edit Actions"). Do this once per visit/reload.</li>
    </ol>
  </div>

  <div class="card">
    <h2>Any phone: create the bookmark on a desktop browser, let it sync</h2>
    <ol>
      <li>On a computer, open this same page in Chrome or Edge, signed in to the account that syncs to your phone.</li>
      <li>Right-click the <b>Install YapCord</b> button above → <b>"Copy link"</b>, then add a new bookmark yourself and paste it as the URL (dragging the button to the bookmarks bar also works in most desktop browsers).</li>
      <li>Wait for bookmarks to sync, then open that bookmark from your phone's bookmarks while on <code>yapper.website</code>.</li>
    </ol>
  </div>

  <div class="card">
    <h2>Raw code (for the Shortcuts method, or pasting into a bookmark's URL field)</h2>
    <button class="copy" id="copyBtn" type="button">Copy code</button>
    <p class="hint" id="copyStatus">&nbsp;</p>
  </div>

  <div class="card">
    <h2>Good to know</h2>
    <ul>
      <li>It runs <i>after</i> the page has already loaded (a bookmarklet can't hook in as early as a real extension), so a couple of early-boot things - mainly NoTrack blocking the very first requests of a fresh page load - only take effect from the tap onward, not retroactively. Everything else (Plugins page, themes, Custom CSS, the rest of the plugins) works the same either way.</li>
      <li>Tapping it again on the same tab is harmless - it notices it's already loaded and does nothing twice.</li>
      <li>Settings are stored in that browser's own <code>localStorage</code> for <code>yapper.website</code>, separate from the app and the extension.</li>
    </ul>
  </div>
</div>
<script>
(function () {
  var raw = decodeURIComponent(document.getElementById('installLink').href.slice('javascript:'.length));
  document.getElementById('copyBtn').addEventListener('click', function () {
    var status = document.getElementById('copyStatus');
    function done(ok) { status.textContent = ok ? 'Copied.' : 'Could not copy automatically - select and copy the link above by hand.'; status.className = ok ? 'hint ok' : 'hint'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(raw).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement('textarea'); ta.value = raw; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        done(true);
      } catch (e) { done(false); }
    }
  });
})();
</script>
</body>
</html>
`;
}

function stage(outDir, version) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const uri = buildUri();
  fs.writeFileSync(path.join(outDir, 'bookmarklet.txt'), uri);
  fs.writeFileSync(path.join(outDir, 'bookmarklet.html'), buildHtml(uri, version));
  return uri;
}

function main(argv) {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  const stageOnlyIdx = argv.indexOf('--stage-only');
  if (stageOnlyIdx !== -1) {
    const outDir = argv[stageOnlyIdx + 1];
    if (!outDir) {
      console.error('--stage-only needs a directory argument');
      return 1;
    }
    stage(path.resolve(outDir), rootPkg.version);
    console.log('Bookmarklet staged in ' + outDir);
    return 0;
  }

  const outDir = path.join(ROOT, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const uri = buildUri();
  fs.writeFileSync(path.join(outDir, 'YapCord-Bookmarklet.html'), buildHtml(uri, rootPkg.version));
  console.log('Wrote ' + path.relative(ROOT, path.join(outDir, 'YapCord-Bookmarklet.html')) + ' (' + uri.length + ' chars). Open it and follow the instructions on the page.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { buildUri, buildHtml, stage };
