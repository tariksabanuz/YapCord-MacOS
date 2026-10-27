

(function () {
  YM.definePlugin({
    name: 'SpellcheckGuard',
    description: "Keeps the message box's spellcheck on, so right-clicking a misspelled word always offers real suggestions - the browser's and Electron's own native spellchecker, just guaranteed never to get switched off under you.",
    authors: ['YapCord'],
    tags: ['Utility'],
    alwaysOn: true,
    start(ctx) {
      const pin = (ta) => {
        if (ta.spellcheck !== true) ta.spellcheck = true;
      };

      ctx.watch('.composer textarea', pin);
    },
  });
})();
