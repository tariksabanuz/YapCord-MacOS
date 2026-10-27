

(function () {
  let dropped = 0;
  YM.definePlugin({
    name: 'SilentTyping',
    description: "Hides your typing indicator from others (the 'is typing...' dots).",
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Privacy', 'Chat'],
    api: { dropped: () => dropped },
    start(ctx) {
      ctx.cleanup(YM.net.onWsSend((data) => {
        if (data.charCodeAt(0) !== 123 || data.indexOf('"typing"') < 0) return undefined;
        try {
          if (JSON.parse(data).type === 'typing') {
            dropped++;
            return false;
          }
        } catch (_) {  }
        return undefined;
      }));
    },
  });
})();
