

(function () {
  YM.definePlugin({
    name: 'ProfileEffectScale',
    description: "Scale avatar decorations (ice, rainbow, toxic, ...) up or down on your own screen. Local to you; doesn't change what anyone has equipped. Very large sizes can overlap nearby UI - Yapper's layout doesn't reserve extra room for it.",
    authors: ['YapCord'],
    tags: ['Appearance', 'Customisation'],
    options: {
      scale: { type: 'slider', default: 100, min: 60, max: 180, step: 5, description: 'Decoration size (%)' },
    },
    start(ctx) {
      const apply = () => {
        const pct = Math.max(60, Math.min(180, Number(ctx.settings.store.scale) || 100));
        ctx.css(pct === 100 ? '' : 'img.avatar-deco{transform:scale(' + (pct / 100).toFixed(2) + ')!important}');
      };
      apply();
      ctx.cleanup(ctx.settings.onChange(apply));
    },
  });
})();
