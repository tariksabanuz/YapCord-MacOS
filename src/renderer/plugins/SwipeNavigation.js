

(function () {
  const SWIPE_MIN_DISTANCE = 60;
  const SWIPE_MAX_DURATION = 600;
  const COMMIT_DISTANCE = 15;
  const MAX_VERTICAL_RATIO = 0.5;

  function startedInHorizontalScroller(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.scrollWidth > node.clientWidth + 1) {
        const style = getComputedStyle(node);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  YM.definePlugin({
    name: 'SwipeNavigation',
    description: "Swipe left-to-right anywhere to go back, like Discord's own mobile swipe-back gesture - and, so the two gestures stop firing together, this also takes over Yapper's own swipe-to-reply on messages: reply is reachable only by holding a message and tapping Reply.",
    authors: ['YapCord'],
    tags: ['Mobile', 'Utility'],
    alwaysOn: true,
    start(ctx) {
      let touch = null;

      const onTouchStart = (e) => {
        if (e.touches.length !== 1) { touch = null; return; }
        const t = e.touches[0];
        if (startedInHorizontalScroller(e.target)) { touch = null; return; }
        touch = { x: t.clientX, y: t.clientY, t: Date.now(), committed: false };
      };

      const onTouchMove = (e) => {
        if (!touch) return;
        if (!touch.committed) {
          const t = e.touches[0];
          if (!t) return;
          const dx = t.clientX - touch.x;
          const dy = t.clientY - touch.y;
          if (Math.abs(dx) < COMMIT_DISTANCE) return;
          if (Math.abs(dy) > Math.abs(dx) * MAX_VERTICAL_RATIO) { touch = null; return; }

          touch.committed = true;
        }
        e.stopPropagation();
        e.preventDefault();
      };

      const onTouchEnd = (e) => {
        if (!touch) return;
        const start = touch;
        touch = null;
        if (start.committed) e.stopPropagation();

        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const elapsed = Date.now() - start.t;
        if (elapsed > SWIPE_MAX_DURATION) return;
        const distance = Math.abs(dx);
        if (distance < SWIPE_MIN_DISTANCE) return;
        if (Math.abs(dy) > distance * MAX_VERTICAL_RATIO) return;

        if (dx > 0) history.back();

      };

      const onTouchCancel = () => { touch = null; };

      document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
      document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
      document.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });
      ctx.cleanup(() => {
        document.removeEventListener('touchstart', onTouchStart, { capture: true });
        document.removeEventListener('touchmove', onTouchMove, { capture: true });
        document.removeEventListener('touchend', onTouchEnd, { capture: true });
        document.removeEventListener('touchcancel', onTouchCancel, { capture: true });
      });
    },
  });
})();
