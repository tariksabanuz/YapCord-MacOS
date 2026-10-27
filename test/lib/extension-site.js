'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadPlaywright } = require('./site');

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.html': 'text/html' };

function cacheName(url) {
  return url.split('://', 2)[1].replace(/[^A-Za-z0-9._-]+/g, '_').slice(-150);
}

async function openExtensionSite({ cacheDir, extensionDir, onConsole, permissions = [] } = {}) {
  cacheDir = cacheDir || process.env.YM_CACHE_DIR;
  if (!cacheDir || !fs.existsSync(cacheDir)) throw new Error('set YM_CACHE_DIR to the extracted Yapper cache directory');
  if (!extensionDir || !fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
    throw new Error('extensionDir must point at a built extension folder (run tools/build-extension.js first)');
  }
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yapcord-ext-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: fs.existsSync(exe) ? exe : undefined,
    viewport: { width: 1400, height: 900 },
    permissions,
    proxy: { server: 'http://127.0.0.1:9' },
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-extensions-except=' + extensionDir,
      '--load-extension=' + extensionDir,

      '--headless=new',
    ],
  });

  const page = context.pages()[0] || (await context.newPage());
  const consoleLog = [];
  page.on('console', (m) => {
    consoleLog.push({ type: m.type(), text: m.text() });
    if (onConsole) onConsole(m);
  });
  page.on('pageerror', (e) => consoleLog.push({ type: 'pageerror', text: String((e && e.stack) || e) }));

  await context.route('**/*', async (route) => {
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

  return {
    context,
    page,
    consoleLog,
    close: async () => {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

module.exports = { openExtensionSite };
