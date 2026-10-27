'use strict';

const { openSite } = require('./lib/site');

(async () => {
  const site = await openSite({ initial: { settings: {} } });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const YM = window.YapperMod;
    if (!YM) return { error: 'bundle not loaded' };
    return {
      turbo: YM.finder.stats(),
      storeReady: YM.Store.isReady,
      state: YM.Store.isReady ? Object.keys(YM.Store.getState()).slice(0, 60) : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('missing assets:', site.missing.slice(0, 20));
  const errs = site.consoleLog.filter((l) => /YapCord|YapperMod|pageerror/.test(l.text) || l.type === 'pageerror');
  console.log('console (ym/errors):', errs.slice(0, 20));
  await site.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
