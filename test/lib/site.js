'use strict';

const fs = require('fs');
const path = require('path');
const { buildBundle } = require('../../src/main/bundle');

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright'].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (_) {

    }
  }
  throw new Error('playwright not found (set PLAYWRIGHT_PATH)');
}

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.html': 'text/html' };

function cacheName(url) {
  return url.split('://', 2)[1].replace(/[^A-Za-z0-9._-]+/g, '_').slice(-150);
}

async function openSite({ cacheDir, initial = {}, bundle = true, onConsole, extra, args = [], permissions = [] } = {}) {
  cacheDir = cacheDir || process.env.YM_CACHE_DIR;
  if (!cacheDir || !fs.existsSync(cacheDir)) throw new Error('set YM_CACHE_DIR to the extracted Yapper cache directory');
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...args],
    proxy: { server: 'http://127.0.0.1:9' },
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions });
  const page = await context.newPage();
  const missing = [];
  const consoleLog = [];
  page.on('console', (m) => {
    consoleLog.push({ type: m.type(), text: m.text() });
    if (onConsole) onConsole(m);
  });
  page.on('pageerror', (e) => consoleLog.push({ type: 'pageerror', text: String(e && e.stack || e) }));

  if (extra) await extra(page, context);
  if (bundle) await page.addInitScript(buildBundle(initial));

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const u = new URL(url);
    try {
      if (u.hostname === 'www.yapper.website') {
        const isRoot = u.pathname === '/' || !/\.[a-z0-9]+$/i.test(u.pathname);
        const file = path.join(cacheDir, isRoot ? 'www.yapper.website_' : cacheName(u.origin + u.pathname));
        if (fs.existsSync(file)) {
          const ext = isRoot ? '.html' : path.extname(u.pathname);
          return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: MIME[ext] || 'application/octet-stream' });
        }
        missing.push(u.pathname);
        return route.fulfill({ status: 404, body: '' });
      }
      if (u.hostname === 'api.yapper.website' && u.pathname.startsWith('/rest/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if (u.hostname.endsWith('supabase.co')) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"no session (test)"}' });
      }
      return route.fulfill({ status: 204, body: '' });
    } catch (err) {
      return route.abort().catch(() => {});
    }
  });

  return { browser, context, page, missing, consoleLog, close: () => browser.close() };
}

module.exports = { openSite, loadPlaywright };
