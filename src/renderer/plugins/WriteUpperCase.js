

(function () {
  YM.definePlugin({
    name: 'WriteUpperCase',
    description: 'Sends everything you type in FULL CAPS, automatically.',
    authors: ['Equicord (ported to Yapper)'],
    tags: ['Chat', 'Fun'],
    start(ctx) {
      const handler = (msg) => { msg.content = msg.content.toUpperCase(); };
      ctx.cleanup(YM.messageEvents.addPreSendListener(handler));
    },
  });
})();
