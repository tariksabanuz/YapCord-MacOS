

(function () {
  function cssFor(filter, hue) {
    const h = Math.max(0, Math.min(360, Number(hue) || 0));
    switch (filter) {
      case 'mono': return 'grayscale(1) contrast(1.25)';
      case 'sepia': return 'sepia(.85)';
      case 'invert': return 'invert(1)';
      case 'hue': return 'hue-rotate(' + h + 'deg) saturate(1.35)';
      default: return '';
    }
  }

  YM.definePlugin({
    name: 'AvatarEffects',
    description: 'Recolour the avatar decorations Yapper already shows (ice, rainbow, toxic, ...) with a filter: black & white, sepia, inverted, or your own hue shift. Local to you; doesn’t grant or change anyone’s decoration.',
    authors: ['YapCord'],
    tags: ['Appearance', 'Customisation'],
    alwaysOn: true,
    api: { cssFor },
    options: {
      filter: {
        type: 'select', default: 'none', description: 'Recolour',
        options: [{ label: 'Off', value: 'none' }, { label: 'Black & white', value: 'mono' }, { label: 'Sepia', value: 'sepia' }, { label: 'Inverted', value: 'invert' }, { label: 'Custom hue shift', value: 'hue' }],
      },
      hue: { type: 'slider', default: 200, min: 0, max: 360, step: 5, description: 'Hue shift in degrees (used when Recolour is "Custom hue shift")' },
    },
    start(ctx) {
      const apply = () => {
        const s = ctx.settings.store;
        const rule = cssFor(s.filter, s.hue);
        ctx.css(rule ? 'img.avatar-deco{filter:' + rule + ' !important}' : '');
      };
      apply();
      ctx.cleanup(ctx.settings.onChange(apply));
    },
  });
})();
