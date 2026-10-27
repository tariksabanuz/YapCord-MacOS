

(function () {
  const KEY = 'pluginData.BackgroundImage';
  const read = () => { const v = YM.settings.get(KEY, ''); return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) ? v : ''; };

  async function shrink(file) {
    if (!file || !/^image\//.test(file.type || '')) throw new Error('That is not a picture.');
    if (file.size > 25 * 1024 * 1024) throw new Error('That picture is too large (over 25 MB).');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    } finally { URL.revokeObjectURL(url); }
  }

  YM.definePlugin({
    name: 'BackgroundImage',
    description: 'Put your own picture behind Yapper. Panels become see-through so it shows; blur and dimming are adjustable.',
    authors: ['YapCord'],
    tags: ['Appearance', 'Customisation'],
    api: { read, shrink },
    options: {
      picture: {
        type: 'custom', default: false,
        render(box) {
          const h = YM.dom.h;
          box.style.flexDirection = 'column';
          box.style.alignItems = 'stretch';
          const prev = h('div', { style: { width: '100%', height: '90px', borderRadius: '10px', background: 'var(--bg-input) center/cover', border: '1px solid var(--border)' } });
          const paint = () => { prev.style.backgroundImage = read() ? 'url("' + read() + '")' : 'none'; clear.disabled = !read(); };
          const input = h('input', { type: 'file', accept: 'image/*', hidden: true, onChange: async () => {
            const f = input.files && input.files[0]; input.value = '';
            if (!f) return;
            try { YM.settings.set(KEY, await shrink(f)); YM.toast('Background saved. Only you see it.'); } catch (e) { YM.toast((e && e.message) || 'Could not use that picture.', { type: 'error' }); }
            paint();
          } });
          const clear = h('button', { type: 'button', class: 'ym-btn ym-btn-small ym-btn-ghost', onClick: () => { YM.settings.set(KEY, ''); paint(); } }, 'Remove picture');
          box.append(h('div', { class: 'toggle-label' }, 'Picture'), prev, h('div', { class: 'ym-toolbar' }, h('button', { type: 'button', class: 'ym-btn ym-btn-small', onClick: () => input.click() }, 'Choose picture...'), clear), input);
          paint();
        },
      },
      dim: { type: 'slider', default: 55, min: 0, max: 90, step: 5, description: 'Dimming in percent (higher = darker, easier to read)' },
      blur: { type: 'slider', default: 6, min: 0, max: 30, step: 1, description: 'Blur in pixels' },
      glass: { type: 'slider', default: 78, min: 40, max: 100, step: 2, description: 'How solid the panels are, in percent' },
    },
    start(ctx) {
      const apply = () => {
        const s = ctx.settings.store;
        const img = read();
        if (!img) { ctx.css('', 'bg'); return; }
        const dim = Math.max(0, Math.min(90, Number(s.dim) || 0)) / 100;
        const blur = Math.max(0, Math.min(30, Number(s.blur) || 0));
        const glass = Math.max(40, Math.min(100, Number(s.glass) || 78));
        ctx.css(`html{background:#000!important}body{background:transparent!important}
body::before{content:"";position:fixed;inset:-40px;z-index:-1;background:linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),url("${img}") center/cover no-repeat;filter:blur(${blur}px);pointer-events:none}
:root{--bg-rail:color-mix(in srgb,#141519 ${glass}%,transparent);--bg-side:color-mix(in srgb,#1b1c21 ${glass}%,transparent);--bg-main:color-mix(in srgb,#222329 ${Math.round(glass * 0.8)}%,transparent)}`, 'bg');
      };
      apply();
      ctx.cleanup(ctx.settings.onChange(apply));
      ctx.cleanup(YM.settings.onPath(KEY, apply));
    },
  });
})();
