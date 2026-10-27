

(function () {
  const isTyping = (el) => el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
  const MUTE_BTN_SELECTOR = '[aria-label="Mute"], [aria-label="Unmute"]';

  YM.definePlugin({
    name: 'PushToTalk',
    description: "Stay muted in voice calls by default; hold a key to talk, let go to mute again - like push-to-talk in a game. Uses Yapper's own real mute button, just automated.",
    authors: ['YapCord'],
    tags: ['Voice', 'Utility'],
    alwaysOn: true,
    options: {
      enabled: { type: 'boolean', default: false, description: 'Actually use push-to-talk (the plugin itself is always loaded, this is the real on/off switch)' },
      key: { type: 'string', default: 'Backquote', description: 'Key to hold to talk (a KeyboardEvent.code, e.g. Backquote, Space, ControlLeft, KeyV)' },
      muteOnJoin: { type: 'boolean', default: true, description: 'Mute you automatically the moment you join a call, so push-to-talk starts working right away' },
    },
    start(ctx) {
      const toggle = YM.finder.lazy(['toggleMute', 'toggleDeafen']);
      const voice = () => (YM.Store.getState() || {}).voice || null;
      const inCall = () => { const v = voice(); return !!v && v.status === 'connected'; };

      let held = false;
      let weUnmuted = false;
      const setIndicator = (on) => { const r = document.documentElement; if (!r) return; if (on) r.setAttribute('data-ym-ptt', ''); else r.removeAttribute('data-ym-ptt'); };

      const doUnmute = () => {
        const v = voice();
        if (!v || !v.muted) return;
        const t = toggle();
        if (!t) { YM.toast("Could not find Yapper's own mute button.", { type: 'error' }); return; }
        Promise.resolve(t.toggleMute()).catch(() => void 0);
        weUnmuted = true;
        setIndicator(true);
      };
      const doRemute = () => {
        setIndicator(false);
        if (!weUnmuted) return;
        weUnmuted = false;
        const t = toggle();
        if (t) Promise.resolve(t.toggleMute()).catch(() => void 0);
      };

      const onKeyDown = (e) => {
        if (!ctx.settings.store.enabled || held || e.repeat || isTyping(e.target) || e.code !== ctx.settings.store.key) return;
        held = true;
        if (inCall()) doUnmute();
      };
      const onKeyUp = (e) => {
        if (e.code !== ctx.settings.store.key) return;
        held = false;
        doRemute();
      };
      const onBlur = () => { held = false; doRemute(); };
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('blur', onBlur);

      let wasConnected = inCall();
      ctx.on('store:change', () => {
        const now = inCall();
        if (now && !wasConnected && ctx.settings.store.enabled && ctx.settings.store.muteOnJoin) {
          const v = voice();
          if (v && !v.muted) { const t = toggle(); if (t) Promise.resolve(t.toggleMute()).catch(() => void 0); }
        }
        if (!now && wasConnected) { held = false; weUnmuted = false; setIndicator(false); }
        wasConnected = now;
      });

      ctx.css(`
html[data-ym-ptt] ${MUTE_BTN_SELECTOR}{box-shadow:0 0 0 2px var(--accent,#ff6b4a)!important;border-radius:8px}
`);

      ctx.cleanup(() => {
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', onBlur);
        setIndicator(false);
      });
    },
  });
})();
