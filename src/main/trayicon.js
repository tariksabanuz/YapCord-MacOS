'use strict';

function installTrayPatch(o) {
  const log = o.log || { warn() {}, info() {} };
  try {
    const resolve = o.resolve || ((id) => require.resolve(id));
    const cache = o.cache || require.cache;
    const electron = o.electron || require('electron');
    const entry = cache[resolve('electron')];
    if (!entry || !electron || typeof electron.Tray !== 'function') return false;
    const Original = electron.Tray;
    if (Original.__yapcord) return true;
    class YapCordTray extends Original {
      constructor(image, ...rest) {
        const custom = o.icon.trayImage();
        super(custom || image, ...rest);
        o.icon.attachTray(this, image);
      }
    }
    YapCordTray.__yapcord = true;

    const patched = { ...electron, Tray: YapCordTray };
    delete entry.exports;
    entry.exports = patched;
    return true;
  } catch (err) {
    log.warn('could not prepare the tray icon patch:', err && err.message);
    return false;
  }
}

module.exports = { installTrayPatch };
