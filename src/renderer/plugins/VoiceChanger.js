

(function () {
  const sessions = new Set();
  let audioCtx = null;
  const getCtx = () => audioCtx || (audioCtx = new AudioContext());

  function wrap(rawStream, freq) {
    const ac = getCtx();
    const source = ac.createMediaStreamSource(rawStream);
    const ring = ac.createGain();
    ring.gain.value = 0;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(ring.gain);
    osc.start();
    source.connect(ring);
    const dest = ac.createMediaStreamDestination();
    ring.connect(dest);
    ac.resume().catch(() => {});

    const session = { osc, ring, source, rawStream };
    sessions.add(session);
    const outTrack = dest.stream.getAudioTracks()[0];
    const outStream = new MediaStream([outTrack, ...rawStream.getVideoTracks()]);
    const stop = () => {
      sessions.delete(session);
      try { osc.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
      try { ring.disconnect(); } catch (_) {}
      rawStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
    };
    outTrack.addEventListener('ended', stop, { once: true });
    return outStream;
  }

  YM.definePlugin({
    name: 'VoiceChanger',
    description: 'A robotic ring-modulation effect on your own mic, so you sound different in calls and voice messages. Experimental: never tested with a real ear.',
    authors: ['YapCord'],
    tags: ['Voice'],
    api: { wrap, sessionCount: () => sessions.size },
    options: {
      freq: { type: 'slider', default: 45, min: 20, max: 200, step: 5, description: 'Robot pitch in Hz (lower is a deeper buzz, higher is more of a warble)' },
    },
    start(ctx) {
      const devices = navigator.mediaDevices;
      if (!devices || typeof devices.getUserMedia !== 'function') { ctx.log.warn('no microphone API in this browser; VoiceChanger has nothing to attach to'); return; }
      const original = devices.getUserMedia.bind(devices);
      const freqNow = () => Math.max(20, Math.min(200, Number(ctx.settings.store.freq) || 45));

      devices.getUserMedia = async function (constraints) {
        const stream = await original(constraints);
        if (!constraints || !constraints.audio) return stream;
        try {
          return wrap(stream, freqNow());
        } catch (err) {
          ctx.log.warn('voice effect failed to start, using your raw microphone instead', err);
          return stream;
        }
      };
      ctx.cleanup(() => { devices.getUserMedia = original; });

      ctx.cleanup(ctx.settings.onChange(() => {
        const f = freqNow();
        sessions.forEach((s) => { s.osc.frequency.value = f; });
      }));
    },
  });
})();
