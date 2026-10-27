

(function () {
  const PRESETS = [
    {
      id: 'classic', name: 'Yapper Classic', desc: "Back to Yapper's own look - no accent, font or message-style override.",
      swatch: 'linear-gradient(135deg,#2a2b31,#1b1c21)',
      accent: null, font: null, style: null, radius: 10, avatars: 'round',
    },
    {
      id: 'midnight', name: 'Midnight Violet', desc: 'Deep indigo accent, rounded font, soft message cards.',
      swatch: '#6366f1',
      accent: '#6366f1', font: 'rounded', style: 'cards', radius: 18, avatars: 'round',
    },
    {
      id: 'sunset', name: 'Sunset Coral', desc: 'Warm coral accent, rounded font, chat bubbles.',
      swatch: '#ff6b4a',
      accent: '#ff6b4a', font: 'rounded', style: 'bubbles', radius: 16, avatars: 'round',
    },
    {
      id: 'forest', name: 'Forest', desc: 'Calm green accent, system font, clean divider lines.',
      swatch: '#10b981',
      accent: '#10b981', font: 'system', style: 'lines', radius: 10, avatars: 'soft',
    },
    {
      id: 'cyber', name: 'Neon Cyber', desc: 'Bright cyan accent, monospace font, sharp square avatars.',
      swatch: '#06b6d4',
      accent: '#06b6d4', font: 'mono', style: 'hover', radius: 6, avatars: 'square',
    },
    {
      id: 'rose', name: 'Rose Pastel', desc: 'Soft pink accent, rounded font, extra-round bubbles.',
      swatch: '#ec4899',
      accent: '#ec4899', font: 'rounded', style: 'bubbles', radius: 24, avatars: 'round',
    },
    {
      id: 'ink', name: 'Mono Ink', desc: 'Muted slate accent, serif font, minimal divider lines.',
      swatch: '#64748b',
      accent: '#64748b', font: 'serif', style: 'lines', radius: 4, avatars: 'square',
    },
    {
      id: 'amber', name: 'Amber Glow', desc: 'Golden accent, easy-to-read font, soft cards.',
      swatch: '#f59e0b',
      accent: '#f59e0b', font: 'readable', style: 'cards', radius: 20, avatars: 'round',
    },
  ];

  function drive(name, enabled, values) {
    const p = YM.plugins.get(name);
    if (!p) return;
    if (values) for (const [k, v] of Object.entries(values)) p.settings.set(k, v);
    if (enabled !== null) YM.plugins.setEnabled(name, enabled);
  }

  function apply(preset) {
    if (preset.accent) drive('AccentColor', true, { color: preset.accent });
    else drive('AccentColor', false, null);

    if (preset.font) drive('CustomFont', true, { preset: preset.font });
    else drive('CustomFont', false, null);

    if (preset.style) drive('MessageStyle', true, { style: preset.style });
    else drive('MessageStyle', false, null);

    drive('RoundedCorners', null, { radius: preset.radius, avatars: preset.avatars });

    YM.toast('"' + preset.name + '" applied.');
  }

  function renderGallery(box) {
    const h = YM.dom.h;
    box.style.flexDirection = 'column';
    box.style.alignItems = 'stretch';
    const grid = h('div', { class: 'ym-tp-grid' },
      PRESETS.map((preset) => h('button', { type: 'button', class: 'ym-tp-card', onClick: () => apply(preset) },
        h('span', { class: 'ym-tp-swatch', style: { background: preset.swatch } }),
        h('span', { class: 'ym-tp-body' },
          h('span', { class: 'ym-tp-name' }, preset.name),
          h('span', { class: 'ym-tp-desc' }, preset.desc)))));
    box.append(
      h('div', { class: 'toggle-label' }, 'Pick a look'),
      h('div', { class: 'hint' }, 'One click sets your accent colour, font, corner style and message style together (AccentColor, CustomFont, RoundedCorners, MessageStyle). Each of those still has its own page if you want to adjust just one thing afterwards - picking a preset again any time replaces the last one, nothing stacks.'),
      grid);
  }

  YM.definePlugin({
    name: 'ThemePresets',
    description: 'One click for a whole look: accent colour, font, corner roundness and message style together, instead of tuning each one by hand. Pick a different preset any time.',
    authors: ['YapCord'],
    tags: ['Appearance', 'Customisation'],
    api: { PRESETS, apply },
    options: { gallery: { type: 'custom', default: false, render: (box) => renderGallery(box) } },
    start(ctx) {
      ctx.css(`
.ym-tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:4px}
.ym-tp-card{display:flex;align-items:center;gap:10px;text-align:left;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--bg-input);cursor:pointer;transition:transform 140ms ease-out,box-shadow 140ms ease-out}
.ym-tp-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.25)}
.ym-tp-card:active{transform:scale(.98)}
.ym-tp-swatch{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.12)}
.ym-tp-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.ym-tp-name{font-weight:700;color:var(--text)}
.ym-tp-desc{font-size:12px;color:var(--text-muted);line-height:1.3}
`, 'gallery');
    },
  });
})();
