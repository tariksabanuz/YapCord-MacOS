

(function () {
  let originalNotification = null;
  let until = 0;
  let restoreTimer = null;

  function isSnoozed() { return until > Date.now(); }

  function patch() {
    if (originalNotification || typeof window.Notification !== 'function') return;
    originalNotification = window.Notification;
    function Quiet(title, opts) { return { title, opts, close() {} }; }
    Quiet.permission = originalNotification.permission;
    Quiet.requestPermission = (...a) => originalNotification.requestPermission(...a);
    window.Notification = Quiet;
  }

  function unpatch() {
    if (!originalNotification) return;
    window.Notification = originalNotification;
    originalNotification = null;
  }

  const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M3 3l18 18"/></svg>';

  YM.definePlugin({
    name: 'NotificationSnooze',
    description: 'A bell button that pauses Yapper’s desktop notification pop-ups for a while, then turns them back on by itself.',
    authors: ['YapCord'],
    tags: ['Notifications'],
    api: { isSnoozed },
    options: {
      minutes: { type: 'slider', default: 20, min: 5, max: 180, step: 5, description: 'Default snooze length (minutes)' },
    },
    start(ctx) {
      ctx.css('.ym-ns-btn.on{color:var(--accent,#ff6b4a)}');

      const snooze = (minutes) => {
        const ms = Math.max(1, Number(minutes) || 20) * 60000;
        until = Date.now() + ms;
        patch();
        if (restoreTimer) clearTimeout(restoreTimer);
        restoreTimer = setTimeout(() => { until = 0; unpatch(); YM.toast('Notifications are back on.'); paint(); }, ms);
      };
      const cancel = () => {
        until = 0;
        if (restoreTimer) clearTimeout(restoreTimer);
        unpatch();
      };
      const onClick = () => {
        if (isSnoozed()) { cancel(); paint(); YM.toast('Notifications are back on.'); }
        else { snooze(ctx.settings.store.minutes); paint(); YM.toast('Notifications snoozed for ' + ctx.settings.store.minutes + ' minutes.'); }
      };
      const paint = () => {
        const on = isSnoozed();
        document.querySelectorAll('.ym-ns-btn').forEach((btn) => {
          btn.classList.toggle('on', on);
          btn.innerHTML = on ? ICON_ON : ICON_OFF;
          btn.title = on ? 'Notifications snoozed - click to turn back on' : 'Snooze notifications';
        });
      };
      const sync = () => {
        document.querySelectorAll('.user-bar').forEach((bar) => {
          if (!bar.querySelector('.ym-ns-btn')) {
            bar.prepend(YM.dom.h('button', { class: 'icon-btn ym-ns-btn', type: 'button', title: 'Snooze notifications', 'aria-label': 'Snooze notifications', html: ICON_OFF, onClick }));
          }
        });
        paint();
      };
      sync();
      ctx.onMutate(sync);
      ctx.interval(paint, 15000);
      ctx.cleanup(() => { cancel(); document.querySelectorAll('.ym-ns-btn').forEach((n) => n.remove()); });
    },
  });
})();
