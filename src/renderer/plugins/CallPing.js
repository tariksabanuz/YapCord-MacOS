

(function () {
  const sessions = new Set();
  let OriginalRTCPeerConnection = null;

  async function readRtt(pc) {
    if (!pc || pc.connectionState === 'closed' || typeof pc.getStats !== 'function') return null;
    let report;
    try {
      report = await pc.getStats();
    } catch (_) {
      return null;
    }
    let candidate = null;
    report.forEach((stat) => {
      if (stat.type === 'candidate-pair' && (stat.state === 'succeeded' || stat.nominated) && typeof stat.currentRoundTripTime === 'number') {
        candidate = stat.currentRoundTripTime;
      }
    });
    return candidate === null ? null : Math.round(candidate * 1000);
  }

  async function currentPing() {
    for (const pc of sessions) {
      const ms = await readRtt(pc);
      if (ms !== null) return ms;
    }
    return null;
  }

  function inVoice() {
    const s = YM.Store.getState();
    return !!(s && s.voice && s.voice.channelId);
  }

  YM.definePlugin({
    name: 'CallPing',
    description: "Shows your connection ping (ms) in the user bar while you're in a voice channel, read from the browser's own WebRTC stats. Only visible during a call.",
    authors: ['YapCord'],
    tags: ['Voice', 'Utility'],
    alwaysOn: true,
    api: { currentPing, inVoice },
    options: {
      interval: { type: 'slider', default: 3, min: 1, max: 10, step: 1, description: 'How often to refresh, in seconds' },
    },
    start(ctx) {
      if (typeof window.RTCPeerConnection !== 'function') { ctx.log.warn('no RTCPeerConnection in this browser; CallPing has nothing to read'); return; }
      OriginalRTCPeerConnection = window.RTCPeerConnection;
      class TrackedRTCPeerConnection extends OriginalRTCPeerConnection {
        constructor(...args) {
          super(...args);
          sessions.add(this);
          const drop = () => sessions.delete(this);
          this.addEventListener('connectionstatechange', () => { if (this.connectionState === 'closed' || this.connectionState === 'failed') drop(); });
          this.addEventListener('close', drop);
        }
      }
      window.RTCPeerConnection = TrackedRTCPeerConnection;
      ctx.cleanup(() => { window.RTCPeerConnection = OriginalRTCPeerConnection; sessions.clear(); });

      const h = YM.dom.h;
      let pill = null;
      function ensure() {
        const bar = document.querySelector('.user-bar');
        if (!bar) return;
        if (!pill || !pill.isConnected) {
          pill = h('span', { class: 'ym-cp-pill', title: 'Connection ping' });
          bar.append(pill);
        }
      }
      function clsFor(ms) {
        if (ms === null) return 'ym-cp-unknown';
        if (ms < 100) return 'ym-cp-good';
        if (ms < 250) return 'ym-cp-ok';
        return 'ym-cp-bad';
      }
      async function update() {
        if (!inVoice()) {
          if (pill) { pill.remove(); pill = null; }
          return;
        }
        ensure();
        if (!pill) return;
        const ms = await currentPing();
        pill.textContent = ms === null ? '…' : ms + 'ms';
        pill.className = 'ym-cp-pill ' + clsFor(ms);
      }
      ctx.css(`
.ym-cp-pill{display:inline-flex;align-items:center;padding:0 7px;height:20px;border-radius:10px;font-size:11px;font-weight:700;line-height:20px;background:var(--bg-hover,rgba(255,255,255,.08));white-space:nowrap}
.ym-cp-pill.ym-cp-good{color:var(--success,#3ba55d)}
.ym-cp-pill.ym-cp-ok{color:var(--warning,#faa61a)}
.ym-cp-pill.ym-cp-bad{color:var(--danger,#f04747)}
.ym-cp-pill.ym-cp-unknown{color:var(--text-faint,#8b8d98)}
`);
      update();
      ctx.watch('.user-bar', update);
      ctx.on('store:change', (next, prev) => { if (next.voice !== prev.voice) update(); });
      const tick = () => update();
      let timer = setInterval(tick, Math.max(1, Math.min(10, Number(ctx.settings.store.interval) || 3)) * 1000);
      ctx.cleanup(ctx.settings.onChange((key) => {
        if (key !== 'interval') return;
        clearInterval(timer);
        timer = setInterval(tick, Math.max(1, Math.min(10, Number(ctx.settings.store.interval) || 3)) * 1000);
      }));
      ctx.cleanup(() => clearInterval(timer));
      ctx.cleanup(() => { if (pill) pill.remove(); pill = null; });
    },
  });
})();
