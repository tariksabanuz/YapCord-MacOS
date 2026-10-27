

(function () {
  YM.definePlugin({
    name: 'RestartShortcut',
    description: "Ctrl+R (Cmd+R on Mac) reloads YapCord in place, like Discord's own Ctrl+R - the same soft restart every Reload button in Settings already does, without closing the window.",
    authors: ['YapCord'],
    tags: ['Utility'],
    alwaysOn: true,
    start(ctx) {
      const onKey = (e) => {
        const combo = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r';
        if (!combo) return;
        e.preventDefault();
        e.stopPropagation();
        YM.native.app.reload();
      };
      document.addEventListener('keydown', onKey, true);
      ctx.cleanup(() => document.removeEventListener('keydown', onKey, true));
    },
  });
})();
