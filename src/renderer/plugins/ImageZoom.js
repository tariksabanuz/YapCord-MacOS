

(function () {
  YM.definePlugin({
    name: 'ImageZoom',
    description: 'Hover a picture in chat for a magnifier that follows your cursor. Scroll to zoom, Shift+scroll to resize the lens.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Chat', 'Appearance'],
    options: {
      zoom: { type: 'slider', default: 3, min: 1.5, max: 8, step: 0.5, description: 'Starting zoom level' },
      size: { type: 'slider', default: 160, min: 60, max: 320, step: 10, description: 'Starting lens size (pixels)' },
    },
    start(ctx) {
      ctx.css(`.ym-iz-lens{position:fixed;z-index:2147481500;border-radius:50%;pointer-events:none;border:2px solid rgba(255,255,255,.6);box-shadow:0 4px 18px rgba(0,0,0,.45);background-repeat:no-repeat;display:none}
.ym-iz-hovering{cursor:zoom-in}`);
      const lens = YM.dom.h('div', { class: 'ym-iz-lens' });

      if (document.body) document.body.append(lens);
      else YM.domReady.then(() => document.body.append(lens));

      let zoom = ctx.settings.store.zoom;
      let size = ctx.settings.store.size;
      let activeImg = null;

      const hide = () => { lens.style.display = 'none'; if (activeImg) activeImg.classList.remove('ym-iz-hovering'); activeImg = null; };

      const move = (img, clientX, clientY) => {
        const r = img.getBoundingClientRect();
        const x = YM.util.clamp(clientX - r.left, 0, r.width);
        const y = YM.util.clamp(clientY - r.top, 0, r.height);
        const bgW = r.width * zoom;
        const bgH = r.height * zoom;
        lens.style.display = 'block';
        lens.style.width = size + 'px';
        lens.style.height = size + 'px';
        lens.style.left = clientX - size / 2 + 'px';
        lens.style.top = clientY - size / 2 + 'px';
        lens.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
        lens.style.backgroundSize = bgW + 'px ' + bgH + 'px';
        lens.style.backgroundPosition = -(x * zoom - size / 2) + 'px ' + -(y * zoom - size / 2) + 'px';
      };

      const onOver = (e) => {
        const img = e.target instanceof Element ? e.target.closest('.msg-image img') : null;
        if (!img) { hide(); return; }
        activeImg = img;
        img.classList.add('ym-iz-hovering');
        move(img, e.clientX, e.clientY);
      };
      const onMove = (e) => { if (activeImg && activeImg.isConnected) move(activeImg, e.clientX, e.clientY); else hide(); };
      const onWheel = (e) => {
        if (!activeImg) return;
        const target = e.target instanceof Element ? e.target.closest('.msg-image img') : null;
        if (target !== activeImg) return;
        e.preventDefault();
        if (e.shiftKey) size = YM.util.clamp(size - Math.sign(e.deltaY) * 10, 40, 400);
        else zoom = YM.util.clamp(zoom - Math.sign(e.deltaY) * 0.25, 1.2, 10);
        move(activeImg, e.clientX, e.clientY);
      };
      const onOut = (e) => { if (e.target === activeImg) hide(); };
      document.addEventListener('pointerover', onOver, true);
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerout', onOut, true);
      document.addEventListener('wheel', onWheel, { capture: true, passive: false });
      ctx.cleanup(() => {
        document.removeEventListener('pointerover', onOver, true);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerout', onOut, true);
        document.removeEventListener('wheel', onWheel, true);
        hide();
        lens.remove();
      });
    },
  });
})();
