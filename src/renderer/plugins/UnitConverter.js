

(function () {
  const UNITS = [
    { re: /(-?\d+(?:\.\d+)?)\s*°?\s*c\b/gi, conv: (n) => (n * 9) / 5 + 32, suffix: '°F', system: 'imperial' },
    { re: /(-?\d+(?:\.\d+)?)\s*°?\s*f\b/gi, conv: (n) => ((n - 32) * 5) / 9, suffix: '°C', system: 'metric' },
    { re: /(-?\d+(?:\.\d+)?)\s*km\b/gi, conv: (n) => n / 1.60934, suffix: 'mi', system: 'imperial' },
    { re: /(-?\d+(?:\.\d+)?)\s*mi(?:les)?\b/gi, conv: (n) => n * 1.60934, suffix: 'km', system: 'metric' },
    { re: /(-?\d+(?:\.\d+)?)\s*kg\b/gi, conv: (n) => n * 2.20462, suffix: 'lb', system: 'imperial' },
    { re: /(-?\d+(?:\.\d+)?)\s*lbs?\b/gi, conv: (n) => n / 2.20462, suffix: 'kg', system: 'metric' },
    { re: /(-?\d+(?:\.\d+)?)\s*cm\b/gi, conv: (n) => n / 2.54, suffix: 'in', system: 'imperial' },
    { re: /(-?\d+(?:\.\d+)?)\s*ft\b/gi, conv: (n) => n * 30.48, suffix: 'cm', system: 'metric' },
  ];

  function round(n) {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function findConversions(text, mode) {
    const out = [];
    for (const u of UNITS) {
      if (mode !== 'both' && u.system !== mode) continue;
      u.re.lastIndex = 0;
      let m;
      let count = 0;
      while ((m = u.re.exec(text)) && count < 3) {
        count++;
        out.push(round(u.conv(parseFloat(m[1]))) + u.suffix);
      }
      if (out.length >= 4) break;
    }
    return out;
  }

  YM.definePlugin({
    name: 'UnitConverter',
    description: 'Shows a converted value next to units in a message (km↔mi, kg↔lb, °C↔°F, cm↔ft) - never changes the message itself, just adds a small hint under it.',
    authors: ['Equicord (ported to Yapper)'],
    tags: ['Chat', 'Utility'],
    options: {
      show: {
        type: 'select', default: 'both', description: 'Which units to convert',
        options: [
          { label: 'Both ways', value: 'both' },
          { label: 'Metric only (shown in imperial)', value: 'imperial' },
          { label: 'Imperial only (shown in metric)', value: 'metric' },
        ],
      },
    },
    start(ctx) {
      ctx.css('.ym-unit-conv{margin-top:3px;font-size:11px;opacity:.6}');
      ctx.cleanup(YM.messages.decorate(({ body, message }) => {
        if (!body || !message || typeof message.content !== 'string') return;
        let tag = body.querySelector(':scope > .ym-unit-conv');
        const vals = findConversions(message.content, ctx.settings.store.show);
        if (!vals.length) { if (tag) tag.remove(); return; }
        const text = '≈ ' + vals.join(', ');
        if (!tag) { tag = YM.dom.h('div', { class: 'ym-unit-conv' }); body.append(tag); }
        if (tag.textContent !== text) tag.textContent = text;
      }));
      ctx.cleanup(() => document.querySelectorAll('.ym-unit-conv').forEach((n) => n.remove()));
    },
  });
})();
