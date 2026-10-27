

YM.bootstrap = {
  started: false,
  async start() {
    if (YM.bootstrap.started) return;
    YM.bootstrap.started = true;
    YM.Events.emit('boot:start');
    try {
      YM.plugins.startEnabled();
    } catch (err) {
      YM.log.error('could not start plugins', err);
    }
    YM.domReady.then(async () => {
      try {
        await YM.themes.init();
      } catch (err) {
        YM.log.error('could not load themes', err);
      }
      YM.Events.emit('boot:ready');
    });
  },
};

YM.openSettings = (page) => {
  if (YM.settingsUi && YM.settingsUi.open) return YM.settingsUi.open(page);
  YM.toast('Settings are still loading, try again in a second.');
};
if (YM.official) {

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === ',') {
      e.preventDefault();
      YM.openSettings();
    }
  }, true);
}
YM.log.info('YapCord ' + YM.version + ' loaded' + (YM.inApp ? '' : ' (outside the app)'));
