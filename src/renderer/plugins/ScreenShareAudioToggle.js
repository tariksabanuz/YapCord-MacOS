

(function () {
  YM.definePlugin({
    name: 'ScreenShareAudioToggle',
    description: 'Makes sure starting a screen share always offers a real choice to include its audio or leave it off - the desktop app already has its own picker for this; this covers the browser extension and bookmarklet, where it makes the browser\'s own native prompt offer that same checkbox.',
    authors: ['YapCord'],
    tags: ['Voice', 'Utility'],
    alwaysOn: true,
    start(ctx) {
      if (YM.inApp) return;
      const md = navigator.mediaDevices;
      if (!md || typeof md.getDisplayMedia !== 'function') return;
      const real = md.getDisplayMedia.bind(md);
      const wrapped = function (constraints) {
        const c = YM.util.isObj(constraints) ? { ...constraints } : {};
        if (!c.audio) c.audio = true;
        return real(c);
      };
      md.getDisplayMedia = wrapped;
      ctx.cleanup(() => {
        if (md.getDisplayMedia === wrapped) md.getDisplayMedia = real;
      });
    },
  });
})();
