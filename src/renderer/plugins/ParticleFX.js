

(function () {
  const COLORS = ['var(--accent,#6366f1)', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
  const prefersMotion = () => !window.matchMedia || window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  function burst(x, y, { count = 12, spread = 46, size = 6, duration = 650 } = {}) {
    if (!prefersMotion()) return;
    const frag = document.createDocumentFragment();
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const dist = spread * 0.5 + Math.random() * spread;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - spread * 0.25;
      const p = document.createElement('span');
      p.className = 'ym-px-particle';
      const s = size * (0.7 + Math.random() * 0.6);
      p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${COLORS[i % COLORS.length]};--dx:${dx}px;--dy:${dy}px;animation-duration:${duration + Math.random() * 150}ms`;
      frag.appendChild(p);
      nodes.push(p);
    }
    document.body.appendChild(frag);
    for (const p of nodes) p.addEventListener('animationend', () => p.remove(), { once: true });

    setTimeout(() => nodes.forEach((p) => p.isConnected && p.remove()), duration + 400);
  }

  function burstFromElement(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  YM.definePlugin({
    name: 'ParticleFX',
    description: 'A burst of colour when you send a message or react, and a sweep of your accent colour when you switch channels or servers. Respects "reduce motion".',
    authors: ['YapCord'],
    tags: ['Appearance', 'Accessibility', 'Chat'],
    alwaysOn: true,
    api: { burst, burstFromElement },
    options: {
      sendBurst: { type: 'boolean', default: true, description: 'A burst of particles from the send button when a message goes out' },
      reactionBurst: { type: 'boolean', default: true, description: 'A small burst of particles when you add a reaction' },
      channelSweep: { type: 'boolean', default: true, description: 'A sweep of your accent colour across the top when you switch channels or servers' },
      intensity: { type: 'slider', default: 100, min: 50, max: 200, step: 25, description: 'How many particles, in percent' },
    },
    start(ctx) {
      const s = () => ctx.settings.store;
      const count = (base) => Math.max(4, Math.round((base * (Number(s().intensity) || 100)) / 100));

      ctx.css(`
.ym-px-particle{position:fixed;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);animation-name:ymPxFly;animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-fill-mode:forwards;box-shadow:0 0 6px currentColor}
@keyframes ymPxFly{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.15);opacity:0}}
.ym-px-sweep{position:fixed;top:0;left:0;right:0;height:3px;z-index:99998;pointer-events:none;background:linear-gradient(90deg,transparent,var(--accent,#6366f1),transparent);transform:translateX(-100%);animation:ymPxSweep 650ms cubic-bezier(.2,.8,.2,1) forwards}
@keyframes ymPxSweep{to{transform:translateX(100%)}}
`, 'base');

      const onSendClick = (e) => {
        if (!s().sendBurst || !prefersMotion()) return;
        const btn = e.target instanceof Element ? e.target.closest('.composer .send-btn[aria-label="Send"]') : null;
        if (btn && !btn.disabled) burstFromElement(btn, { count: count(14) });
      };
      const onSendKeydown = (e) => {
        if (!s().sendBurst || !prefersMotion() || e.key !== 'Enter' || e.shiftKey) return;
        const ta = e.target;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        const composer = ta.closest('.composer');
        const btn = composer && composer.querySelector('.send-btn[aria-label="Send"]');
        if (btn && !btn.disabled) burstFromElement(btn, { count: count(14) });
      };
      document.addEventListener('click', onSendClick, true);
      document.addEventListener('keydown', onSendKeydown, true);

      const onReactClick = (e) => {
        if (!s().reactionBurst || !prefersMotion()) return;
        const btn = e.target instanceof Element ? e.target.closest('.icon-btn[aria-label="Add reaction"], .reaction-wrap, .emoji-cell') : null;
        if (btn) burstFromElement(btn, { count: count(8), spread: 30, size: 5, duration: 500 });
      };
      document.addEventListener('click', onReactClick, true);

      let sweepTimer = 0;
      const sweep = () => {
        if (!prefersMotion()) return;
        document.querySelectorAll('.ym-px-sweep').forEach((n) => n.remove());
        const bar = document.createElement('div');
        bar.className = 'ym-px-sweep';
        document.body.appendChild(bar);
        clearTimeout(sweepTimer);
        sweepTimer = setTimeout(() => bar.remove(), 750);
      };
      ctx.on('store:change', (st, prev) => {
        if (!s().channelSweep) return;
        if (st.activeChannelId !== prev.activeChannelId || st.activeServerId !== prev.activeServerId) sweep();
      });

      ctx.cleanup(() => {
        document.removeEventListener('click', onSendClick, true);
        document.removeEventListener('keydown', onSendKeydown, true);
        document.removeEventListener('click', onReactClick, true);
        clearTimeout(sweepTimer);
        document.querySelectorAll('.ym-px-particle,.ym-px-sweep').forEach((n) => n.remove());
      });
    },
  });
})();
