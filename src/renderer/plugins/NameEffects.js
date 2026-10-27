

(function () {
  const validHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  const EFFECTS = {
    rainbow: '.msg-author[data-ym-fx="rainbow"]{background:linear-gradient(90deg,#ff5f6d,#ffc371,#47e891,#4facfe,#b388ff,#ff5f6d);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,4s) linear infinite}',
    gradient: '.msg-author[data-ym-fx="gradient"]{background:linear-gradient(90deg,var(--accent,#ff6b4a),#6c8cff);-webkit-background-clip:text;background-clip:text;color:transparent!important}',
    fire: '.msg-author[data-ym-fx="fire"]{background:linear-gradient(90deg,#ff3d00,#ffb300,#ff3d00);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,3s) linear infinite}',
    ocean: '.msg-author[data-ym-fx="ocean"]{background:linear-gradient(90deg,#00c6ff,#0072ff,#00e5a8,#00c6ff);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,5s) linear infinite}',
    ice: '.msg-author[data-ym-fx="ice"]{background:linear-gradient(90deg,#eafcff,#8fe3ff,#2fb8e0,#8fe3ff,#eafcff);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;text-shadow:0 0 10px rgba(143,227,255,.5);animation:ymFxSlide var(--fx-speed,5s) linear infinite}',
    toxic: '.msg-author[data-ym-fx="toxic"]{background:linear-gradient(90deg,#caff00,#5cff6b,#caff00);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;text-shadow:0 0 8px rgba(165,255,0,.45);animation:ymFxSlide var(--fx-speed,3.5s) linear infinite}',
    aurora: '.msg-author[data-ym-fx="aurora"]{background:linear-gradient(90deg,#00f5d4,#7b61ff,#ff61d2,#00f5d4);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,6s) linear infinite}',
    chrome: '.msg-author[data-ym-fx="chrome"]{background:linear-gradient(90deg,#8d9aa6,#f2f6f9,#aab4bd,#f2f6f9,#8d9aa6);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,5s) linear infinite}',
    glow: '.msg-author[data-ym-fx="glow"]{text-shadow:0 0 8px currentColor,0 0 18px currentColor}',
    neon: '.msg-author[data-ym-fx="neon"]{text-shadow:0 0 4px #fff,0 0 10px currentColor,0 0 22px currentColor;animation:ymFxPulse var(--fx-speed,2.4s) ease-in-out infinite}',
    sparkle: '.msg-author[data-ym-fx="sparkle"]::after{content:" ✦";font-size:.8em;color:#ffd86b;animation:ymFxPulse var(--fx-speed,2s) ease-in-out infinite}',
  };
  const KEYFRAMES = '@keyframes ymFxSlide{to{background-position:200% 0}}@keyframes ymFxPulse{50%{opacity:.55}}';
  const customCss = (c1, c2) => '.msg-author[data-ym-fx="custom"]{background:linear-gradient(90deg,' + (validHex(c1) ? c1 : '#000000') + ',' + (validHex(c2) ? c2 : '#ffffff') + ',' + (validHex(c1) ? c1 : '#000000') + ');background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ymFxSlide var(--fx-speed,5s) linear infinite}';
  const names = (t) => String(t || '').split(/[\n,;]+/).map((x) => x.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);

  YM.definePlugin({
    name: 'NameEffects',
    description: 'Give names in chat an effect: rainbow, gradient, fire, ocean, ice, toxic, aurora, chrome, glow, neon, sparkle, or your own two colours. Only you see it. Choose whose names get it.',
    authors: ['YapCord'],
    tags: ['Appearance', 'Chat', 'Customisation'],
    alwaysOn: true,
    api: { EFFECTS, names, customCss, validHex },
    options: {
      effect: {
        type: 'select', default: 'rainbow', description: 'Effect',
        options: [{ label: 'Rainbow', value: 'rainbow' }, { label: 'Gradient (your accent colour)', value: 'gradient' }, { label: 'Fire', value: 'fire' }, { label: 'Ocean', value: 'ocean' }, { label: 'Ice', value: 'ice' }, { label: 'Toxic', value: 'toxic' }, { label: 'Aurora', value: 'aurora' }, { label: 'Chrome', value: 'chrome' }, { label: 'Glow', value: 'glow' }, { label: 'Neon', value: 'neon' }, { label: 'Sparkle', value: 'sparkle' }, { label: 'Custom (pick two colours)', value: 'custom' }],
      },
      customColors: {
        type: 'custom',
        default: { a: '#000000', b: '#ffffff' },
        render(box, plugin) {
          const h = YM.dom.h;
          box.style.flexDirection = 'column';
          box.style.alignItems = 'stretch';
          const cur = plugin.settings.store.customColors || {};
          const a = validHex(cur.a) ? cur.a : '#000000';
          const b = validHex(cur.b) ? cur.b : '#ffffff';
          const save = (na, nb) => plugin.settings.set('customColors', { a: na, b: nb });
          const inA = h('input', { type: 'color', value: a, 'aria-label': 'First colour', style: { width: '48px', height: '32px', padding: 0, border: 0, background: 'none' }, onInput: (e) => save(e.target.value, inB.value) });
          const inB = h('input', { type: 'color', value: b, 'aria-label': 'Second colour', style: { width: '48px', height: '32px', padding: 0, border: 0, background: 'none' }, onInput: (e) => save(inA.value, e.target.value) });
          box.append(h('div', { class: 'toggle-label' }, 'Custom effect colours'), h('div', { class: 'ym-toolbar' }, inA, inB, h('span', { class: 'hint' }, '(used when Effect is set to "Custom")')));
        },
      },
      who: {
        type: 'select', default: 'list', description: 'Whose names',
        options: [{ label: 'Only the people I list', value: 'list' }, { label: 'My friends', value: 'friends' }, { label: 'Everyone', value: 'all' }, { label: 'Only me', value: 'me' }],
      },
      list: { type: 'string', default: '', description: 'Usernames for "people I list" (separate with commas)' },
      speed: { type: 'slider', default: 4, min: 1, max: 10, step: 1, description: 'Animation time in seconds (lower is faster)' },
    },
    start(ctx) {
      const apply = ({ el, message }) => {
        const author = el.querySelector(':scope > .msg-body > .msg-head > .msg-author:not(.webhook-author)');
        if (!author) return;
        const s = ctx.settings.store;
        const st = YM.Store.getState();
        const id = message && message.author_id;
        const p = id && st && st.profiles[id];
        let on = false;
        if (p && st) {
          if (s.who === 'all') on = true;
          else if (s.who === 'me') on = id === st.userId;
          else if (s.who === 'friends') on = (st.friends || {})[id] === 'accepted';
          else on = names(s.list).includes(String(p.username || '').toLowerCase());
        }
        if (on) { if (author.getAttribute('data-ym-fx') !== s.effect) author.setAttribute('data-ym-fx', s.effect); }
        else if (author.hasAttribute('data-ym-fx')) author.removeAttribute('data-ym-fx');
      };
      const css = () => {
        const s = ctx.settings.store;
        const sp = Math.max(1, Math.min(10, Number(s.speed) || 4));
        const cc = s.customColors || {};
        const rule = s.effect === 'custom' ? customCss(cc.a, cc.b) : (EFFECTS[s.effect] || '');
        ctx.css(':root{--fx-speed:' + sp + 's}' + rule + '@media (prefers-reduced-motion:no-preference){' + KEYFRAMES + '}@media (prefers-reduced-motion:reduce){.msg-author[data-ym-fx]{animation:none!important}}');
      };
      css();
      ctx.cleanup(YM.messages.decorate(apply));
      ctx.cleanup(ctx.settings.onChange(() => { css(); YM.messages.refresh(); }));
      ctx.cleanup(() => document.querySelectorAll('.msg-author[data-ym-fx]').forEach((n) => n.removeAttribute('data-ym-fx')));
    },
  });
})();
