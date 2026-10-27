

(function () {
  const MIN_BITRATE = 2500000;
  const MAX_BITRATE = 20000000;
  const BITS_PER_PIXEL = 0.06;

  function sizeOf(track) {
    let s = {};
    try { s = track.getSettings(); } catch (_) {  }
    return { w: s.width || 0, h: s.height || 0, fps: s.frameRate || 0 };
  }

  function limitsFor(track) {
    const { w, h, fps } = sizeOf(track);
    if (!w || !h) return null;
    const rate = fps >= 1 ? Math.round(fps) : 30;
    const bitrate = Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, Math.round(w * h * rate * BITS_PER_PIXEL)));
    return { fps: rate, bitrate };
  }

  function adjustEncoding(enc, limits) {
    const out = { ...(enc || {}) };
    out.maxFramerate = Math.max(Number(out.maxFramerate) || 0, limits.fps);
    out.maxBitrate = Math.max(Number(out.maxBitrate) || 0, limits.bitrate);
    return out;
  }

  function isScreenTrack(track, source) {
    if (!track || track.kind !== 'video') return false;
    let s = {};
    try { s = track.getSettings(); } catch (_) {  }
    if (s.displaySurface) return true;
    return source === 'hint' && /^(detail|motion|text)$/.test(track.contentHint || '');
  }

  const stats = { touched: 0 };

  YM.definePlugin({
    name: 'ScreenShareQuality',
    description: 'Makes the screen share sender deliver the size and frame rate Yapper captured (instead of the video SDK\'s 15 fps / 3 Mbps cap) and lets you pick sharp text or smooth motion. Never asks for more than Yapper captured.',
    authors: ['YapCord'],
    tags: ['Voice', 'Utility'],
    alwaysOn: true,
    api: { adjustEncoding, limitsFor, isScreenTrack, stats },
    options: {
      raiseFramerate: { type: 'boolean', default: true, description: 'Let the sender use the captured frame rate and a fitting bitrate (the video SDK may otherwise cap you at 15 fps / 3 Mbps)' },
      contentHint: {
        type: 'select', default: 'detail', description: 'Optimise for',
        options: [
          { label: 'Sharp text and images (Yapper default)', value: 'detail' },
          { label: 'Smooth motion (games and video)', value: 'motion' },
        ],
      },
    },
    start(ctx) {
      const pcProto = window.RTCPeerConnection && RTCPeerConnection.prototype;
      const senderProto = window.RTCRtpSender && RTCRtpSender.prototype;
      if (!pcProto || typeof pcProto.addTransceiver !== 'function') return;
      const origAdd = pcProto.addTransceiver;

      const wrapAdd = function (trackOrKind, init) {
        try {
          const track = trackOrKind && typeof trackOrKind === 'object' ? trackOrKind : null;
          const limits = isScreenTrack(track, 'hint') ? limitsFor(track) : null;
          if (limits) {
            const s = ctx.settings.store;
            if (s.contentHint === 'motion' || s.contentHint === 'detail') track.contentHint = s.contentHint;
            if (s.raiseFramerate) {
              const encs = init && Array.isArray(init.sendEncodings) && init.sendEncodings.length ? init.sendEncodings : [{}];
              init = { ...(init || {}), sendEncodings: encs.map((e) => adjustEncoding(e, limits)) };
            }
            stats.touched++;
          }
        } catch (err) {
          YM.log.error('ScreenShareQuality hook failed', err);
        }
        return origAdd.call(this, trackOrKind, init);
      };
      pcProto.addTransceiver = wrapAdd;

      let origSet = null;
      let wrapSet = null;
      if (senderProto && typeof senderProto.setParameters === 'function') {
        origSet = senderProto.setParameters;
        wrapSet = function (params) {
          try {
            const track = this.track;
            const limits = ctx.settings.store.raiseFramerate && isScreenTrack(track, 'hint') ? limitsFor(track) : null;
            if (limits && params && Array.isArray(params.encodings) && params.encodings.length) {
              params.encodings = params.encodings.map((e) => ({ ...adjustEncoding(e, limits), active: e.active, rid: e.rid, scaleResolutionDownBy: e.scaleResolutionDownBy }));
              params.encodings.forEach((e) => { for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k]; });
            }
          } catch (err) {
            YM.log.error('ScreenShareQuality sender hook failed', err);
          }
          return origSet.call(this, params);
        };
        senderProto.setParameters = wrapSet;
      }

      ctx.cleanup(() => {
        if (pcProto.addTransceiver === wrapAdd) pcProto.addTransceiver = origAdd;
        if (wrapSet && senderProto.setParameters === wrapSet) senderProto.setParameters = origSet;
      });
    },
  });
})();
