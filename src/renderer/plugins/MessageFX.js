

(function () {
  YM.definePlugin({
    name: 'MessageFX',
    description: 'A reaction pops in when it appears on a message, and the send button flourishes when you send. Respects "reduce motion".',
    authors: ['YapCord'],
    tags: ['Appearance', 'Accessibility', 'Chat'],
    alwaysOn: true,
    options: {
      speed: { type: 'slider', default: 220, min: 100, max: 500, step: 20, description: 'Speed in milliseconds (lower is faster)' },
      reactions: { type: 'boolean', default: true, description: 'A reaction pops in when it first appears on a message' },
      send: { type: 'boolean', default: true, description: 'The send button flourishes when a message goes out' },
    },
    start(ctx) {
      const s = () => ctx.settings.store;
      const dur = () => Math.max(100, Math.min(500, Number(s().speed) || 220));
      const css = () => {
        const d = dur();
        let out = '@media (prefers-reduced-motion:no-preference){:root{--ym-mfx-t:' + d + 'ms}'
          + '@keyframes ymMfxPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}'
          + '@keyframes ymMfxSend{0%{transform:scale(1)}35%{transform:scale(.78)}70%{transform:scale(1.22)}100%{transform:scale(1)}}'
          + '.reaction-wrap.ym-mfx-in{animation:ymMfxPop var(--ym-mfx-t) cubic-bezier(.34,1.56,.64,1)}'
          + '.send-btn.ym-mfx-send{animation:ymMfxSend var(--ym-mfx-t) ease-out}'
          + '}';
        ctx.css(out);
      };
      css();
      ctx.cleanup(ctx.settings.onChange(css));

      let batch = [];
      let raf = 0;
      ctx.watch('.reaction-wrap', (el) => {
        if (!s().reactions) return;
        batch.push(el);
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const list = batch; batch = [];
          if (list.length > 2) return;
          for (const e of list) {
            if (!e.isConnected) continue;
            e.classList.add('ym-mfx-in');
            setTimeout(() => e.classList.remove('ym-mfx-in'), dur() + 80);
          }
        });
      });

      const flourish = (btn) => {
        if (!s().send || !btn) return;
        btn.classList.remove('ym-mfx-send');
        void btn.offsetWidth;
        btn.classList.add('ym-mfx-send');
        setTimeout(() => btn.classList.remove('ym-mfx-send'), dur() + 80);
      };
      const onClick = (e) => {
        const btn = e.target instanceof Element ? e.target.closest('.composer .send-btn[aria-label="Send"]') : null;
        if (btn && !btn.disabled) flourish(btn);
      };
      const onKeydown = (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        const ta = e.target;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        const composer = ta.closest('.composer');
        const btn = composer && composer.querySelector('.send-btn[aria-label="Send"]');
        if (btn && !btn.disabled) flourish(btn);
      };
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeydown, true);
      ctx.cleanup(() => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeydown, true);
        if (raf) cancelAnimationFrame(raf);
        document.querySelectorAll('.ym-mfx-in,.ym-mfx-send').forEach((n) => n.classList.remove('ym-mfx-in', 'ym-mfx-send'));
      });
    },
  });
})();
