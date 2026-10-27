

(function () {
  function statusModule() {
    return YM.finder.findExports(['setStatus', 'getState']);
  }

  YM.definePlugin({
    name: 'CustomIdle',
    description: "Set your own delay before Yapper marks you Idle (longer than its fixed 10 minutes), or turn auto-idle off. Doesn't touch Do Not Disturb or Invisible.",
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Utility'],
    api: { statusModule },
    options: {
      mode: {
        type: 'select', default: 'extend', description: 'Behaviour',
        options: [{ label: 'Use a longer delay', value: 'extend' }, { label: 'Never go idle automatically', value: 'never' }],
      },
      minutes: { type: 'slider', default: 30, min: 10, max: 180, step: 5, description: 'Delay in minutes (when using a longer delay)' },
    },
    start(ctx) {
      let lastActivity = Date.now();
      const bump = () => { lastActivity = Date.now(); };
      document.addEventListener('mousemove', bump, true);
      document.addEventListener('keydown', bump, true);
      document.addEventListener('mousedown', bump, true);

      const tick = () => {
        const mod = statusModule();
        if (!mod || typeof mod.setStatus !== 'function' || typeof mod.getState !== 'function') return;
        const state = mod.getState();
        if (state.myStatus !== 'idle') return;
        const s = ctx.settings.store;
        const withinCustomDelay = s.mode === 'never' || Date.now() - lastActivity < Math.max(10, Number(s.minutes) || 30) * 60000;
        if (withinCustomDelay) mod.setStatus('online');
      };
      ctx.interval(tick, 5000);
      ctx.cleanup(() => {
        document.removeEventListener('mousemove', bump, true);
        document.removeEventListener('keydown', bump, true);
        document.removeEventListener('mousedown', bump, true);
      });
    },
  });
})();
