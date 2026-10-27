

(function () {
  YM.definePlugin({
    name: 'FixCodeblockGap',
    description: 'Removes the gap Yapper leaves between a code block and the text right below it in a message.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Appearance', 'Chat'],
    alwaysOn: true,
    start(ctx) {
      ctx.css('.msg-body .md-pre{margin-bottom:0}.msg-body .md-pre+*{margin-top:0}');
    },
  });
})();
