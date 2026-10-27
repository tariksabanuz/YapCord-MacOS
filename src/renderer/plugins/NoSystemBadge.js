

(function () {
  YM.definePlugin({
    name: 'NoSystemBadge',
    description: 'Disables the unread count badge on the taskbar/dock icon, so the icon stays plain.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Notifications'],
    alwaysOn: true,
    start(ctx) {
      YM.media.badgeEnabled = false;
      YM.media.setBadge(YM.media.badge);
      ctx.cleanup(() => {
        YM.media.badgeEnabled = true;
        YM.media.setBadge(YM.media.badge);
      });
    },
  });
})();
