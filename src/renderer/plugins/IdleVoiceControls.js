

(function () {
  const h = YM.dom.h;

  const ICON = {
    mic: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M9 21h6"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v4M9 12v-.5M15 9.5V5a3 3 0 0 0-1-2.24M19 10v1a7 7 0 0 1-1.3 4.08M6.7 16.08A7 7 0 0 1 5 11v-1M12 18v3M9 21h6M3 3l18 18"/></svg>',
    deafen: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/></svg>',
    deafenOff: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 13.6-5.7M20 12.6V12a8 8 0 0 0-.7-3.3"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/><path d="M3 3l18 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  };

  YM.definePlugin({
    name: 'IdleVoiceControls',
    description: "Discord-style Mute/Unmute and Deafen/Undeafen buttons in the account bar, visible even before you join a call (not just during one). Mute or deafen yourself ahead of time and it applies the instant you connect. Replaces the \"mentions\" shortcut there; the plugins button stays.",
    authors: ['YapCord'],
    tags: ['Voice', 'Appearance'],
    alwaysOn: true,
    options: {
      pendingMuted: { type: 'boolean', default: false },
      pendingDeafened: { type: 'boolean', default: false },
      inputDeviceId: { type: 'string', default: '' },
      outputDeviceId: { type: 'string', default: '' },
      inputVolume: { type: 'number', default: 100, min: 0, max: 200, step: 5 },
    },
    start(ctx) {
      const toggle = YM.finder.lazy(['toggleMute', 'toggleDeafen']);
      const voice = () => (YM.Store.isReady ? YM.Store.getState() : null)?.voice || null;
      const inCall = () => { const v = voice(); return !!v && v.status === 'connected'; };
      const isMuted = () => { const v = voice(); return inCall() ? !!v.muted : !!ctx.settings.store.pendingMuted; };
      const isDeafened = () => { const v = voice(); return inCall() ? !!v.deafened : !!ctx.settings.store.pendingDeafened; };

      async function setMuted(next) {
        ctx.settings.set('pendingMuted', !!next);
        if (!inCall()) return;
        const v = voice();
        if (!!v.muted === !!next) return;
        const t = toggle();
        if (!t) { YM.toast("Could not find Yapper's own mute button.", { type: 'error' }); return; }
        try { await t.toggleMute(); } catch (err) { YM.log.error('toggleMute failed', err); }
      }
      async function setDeafened(next) {
        ctx.settings.set('pendingDeafened', !!next);
        if (!inCall()) return;
        const v = voice();
        if (!!v.deafened === !!next) return;
        const t = toggle();
        if (!t) { YM.toast("Could not find Yapper's own deafen button.", { type: 'error' }); return; }
        try { await t.toggleDeafen(); } catch (err) { YM.log.error('toggleDeafen failed', err); }
      }

      let wasConnected = inCall();
      ctx.on('store:change', (next, prev) => {
        if (next.voice === prev.voice) return;
        const now = inCall();
        const justConnected = now && !wasConnected;
        wasConnected = now;
        if (justConnected) {
          const t = toggle();
          if (t) {
            const v = voice();
            if (ctx.settings.store.pendingMuted && v && !v.muted) Promise.resolve(t.toggleMute()).catch(() => {});

            const v2 = voice();
            if (ctx.settings.store.pendingDeafened && v2 && !v2.deafened) Promise.resolve(t.toggleDeafen()).catch(() => {});
          }
        }
        render();
      });

      let micWrap = null, micBtn = null, micChevron = null, micIcon = null;
      let deafWrap = null, deafBtn = null, deafChevron = null, deafIcon = null;
      let openMenu = null;

      function chevronBtn(which, onOpen) {
        return h('button', {
          type: 'button', class: 'ym-ivc-chev', 'aria-label': which === 'mic' ? 'Microphone options' : 'Headphone options', title: which === 'mic' ? 'Microphone options' : 'Headphone options',
          html: ICON.chevron,
          onClick: (e) => { e.stopPropagation(); onOpen(); },
        });
      }

      function buildMic() {
        micIcon = h('span', { class: 'ym-ivc-icon', html: ICON.mic });
        micBtn = h('button', { type: 'button', class: 'icon-btn ym-ivc-btn', title: 'Mute', 'aria-label': 'Mute', onClick: () => setMuted(!isMuted()).then(render) }, micIcon);
        micChevron = chevronBtn('mic', () => toggleMenu('mic'));

        micWrap = h('span', { class: 'ym-ivc-pair ym-ivc-mic-pair' }, micBtn, micChevron);
        return micWrap;
      }
      function buildDeafen() {
        deafIcon = h('span', { class: 'ym-ivc-icon', html: ICON.deafen });
        deafBtn = h('button', { type: 'button', class: 'icon-btn ym-ivc-btn', title: 'Deafen', 'aria-label': 'Deafen', onClick: () => setDeafened(!isDeafened()).then(render) }, deafIcon);
        deafChevron = chevronBtn('deafen', () => toggleMenu('deafen'));
        deafWrap = h('span', { class: 'ym-ivc-pair' }, deafBtn, deafChevron);
        return deafWrap;
      }

      function render() {
        if (micBtn) {
          const m = isMuted();
          micBtn.title = m ? 'Unmute' : 'Mute';
          micBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
          micBtn.classList.toggle('ym-ivc-active', m);
          if (micIcon) micIcon.innerHTML = m ? ICON.micOff : ICON.mic;
        }
        if (deafBtn) {
          const d = isDeafened();
          deafBtn.title = d ? 'Undeafen' : 'Deafen';
          deafBtn.setAttribute('aria-label', d ? 'Undeafen' : 'Deafen');
          deafBtn.classList.toggle('ym-ivc-active', d);
          if (deafIcon) deafIcon.innerHTML = d ? ICON.deafenOff : ICON.deafen;
        }
      }

      function mount(bar) {
        if (bar.querySelector('.ym-ivc-pair')) return;

        const mentionsBtn = bar.querySelector('button[aria-label*="mention" i], button[title*="mention" i]');
        const anchor = mentionsBtn || bar.querySelector('.ym-userbar-btn') || null;
        const mic = buildMic();
        const deaf = buildDeafen();
        if (anchor) anchor.before(mic, deaf);
        else bar.append(mic, deaf);
        if (mentionsBtn) mentionsBtn.remove();
        render();
      }

      function sync() {
        document.querySelectorAll('.user-bar').forEach((bar) => {
          mount(bar);

          const stray = bar.querySelector('button[aria-label*="mention" i], button[title*="mention" i]');
          if (stray) stray.remove();
        });
      }

      ctx.watch('.user-bar', sync);
      ctx.onMutate(sync);
      ctx.cleanup(ctx.settings.onChange((key) => { if (key === 'pendingMuted' || key === 'pendingDeafened') render(); }));

      let menuEl = null;
      function closeMenu() {
        if (menuEl) { menuEl.remove(); menuEl = null; }
        if (micBtn) micBtn.classList.remove('ym-ivc-menuopen');
        if (micChevron) micChevron.classList.remove('ym-ivc-chev-open');
        if (deafBtn) deafBtn.classList.remove('ym-ivc-menuopen');
        if (deafChevron) deafChevron.classList.remove('ym-ivc-chev-open');
        openMenu = null;
      }
      function toggleMenu(which) {
        if (openMenu === which) { closeMenu(); return; }
        closeMenu();
        openMenu = which;
        const btn = which === 'mic' ? micBtn : deafBtn;
        const chev = which === 'mic' ? micChevron : deafChevron;
        btn.classList.add('ym-ivc-menuopen');
        chev.classList.add('ym-ivc-chev-open');
        const rect = chev.getBoundingClientRect();
        const body = which === 'mic' ? buildMicMenu() : buildDeafenMenu();

        const left = Math.max(8, Math.min(rect.left - 150, window.innerWidth - 300));
        const inner = h('div', { class: 'ym-ivc-menu', style: { left: left + 'px', top: '-9999px', visibility: 'hidden' }, onPointerDown: (e) => e.stopPropagation() }, body);
        menuEl = h('div', { class: 'overlay clear', style: { background: 'transparent', animation: 'none' }, onPointerDown: closeMenu }, inner);
        document.body.append(menuEl);
        const menuHeight = inner.getBoundingClientRect().height;
        inner.style.top = rect.top - 4 - menuHeight >= 0 ? rect.top - 4 - menuHeight + 'px' : rect.bottom + 4 + 'px';
        inner.style.visibility = 'visible';
      }
      const onDocKey = (e) => { if (e.key === 'Escape') closeMenu(); };
      document.addEventListener('keydown', onDocKey, true);
      ctx.cleanup(() => { document.removeEventListener('keydown', onDocKey, true); closeMenu(); });
      ctx.cleanup(() => document.querySelectorAll('.ym-ivc-pair').forEach((n) => n.remove()));

      const Devices = buildDeviceSupport(ctx);

      function menuLabel(text, hint) {
        return h('div', { class: 'ym-ivc-mlabel' }, text, hint ? h('span', { class: 'ym-ivc-mhint' }, hint) : null);
      }
      function deviceSelect(kind, current, onPick) {
        const sel = h('select', { class: 'ym-ivc-select', onChange: (e) => onPick(e.target.value) });
        Devices.list(kind).then((devices) => {
          sel.replaceChildren(
            h('option', { value: '' }, 'System default'),
            ...devices.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === current }, d.label || (kind === 'audioinput' ? 'Microphone ' : 'Speaker ') + (i + 1))),
          );
        });
        return sel;
      }
      function voiceSettingsBtn() {
        return h('button', { type: 'button', class: 'ym-ivc-mbtn', onClick: () => { closeMenu(); YM.settingsUi.open('plugins'); } }, 'Voice Settings');
      }
      function buildMicMenu() {
        const s = ctx.settings;
        return h('div', {},
          menuLabel('Input Device'),
          deviceSelect('audioinput', s.store.inputDeviceId, (id) => s.set('inputDeviceId', id)),
          menuLabel('Input Volume'),
          h('input', { class: 'ym-ivc-range', type: 'range', min: 0, max: 200, step: 5, value: String(s.store.inputVolume), onInput: (e) => s.set('inputVolume', Number(e.target.value)) }),
          h('label', { class: 'ym-ivc-check' },
            h('input', { type: 'checkbox', checked: YM.plugins.isEnabled('PushToTalk'), onChange: (e) => YM.plugins.requestEnabled('PushToTalk', e.target.checked) }),
            h('span', {}, 'Push to Talk'), h('span', { class: 'ym-ivc-mhint' }, 'Takes effect after you reload.')),
          h('div', { class: 'ym-ivc-msep' }),
          voiceSettingsBtn());
      }
      function buildDeafenMenu() {
        const s = ctx.settings;
        return h('div', {},
          menuLabel('Output Device'),
          deviceSelect('audiooutput', s.store.outputDeviceId, (id) => { s.set('outputDeviceId', id); Devices.applyOutput(id); }),
          h('div', { class: 'ym-ivc-msep' }),
          voiceSettingsBtn());
      }

      ctx.css(`
.ym-ivc-pair{display:inline-flex!important;align-items:stretch;flex:0 0 auto!important;min-width:46px!important;max-width:none!important;width:auto!important;border-radius:8px;overflow:hidden;position:relative;z-index:1}
.ym-ivc-mic-pair{margin-left:14px!important}
.ym-ivc-btn{flex:0 0 auto!important;min-width:32px!important;min-height:32px!important;width:32px!important;height:32px!important;max-width:none!important;display:inline-flex!important;align-items:center;justify-content:center;border-radius:0;position:relative;z-index:1}
.ym-ivc-btn.ym-ivc-active{color:var(--danger,#f04747)}
.ym-ivc-btn.ym-ivc-menuopen{background:var(--bg-hover,rgba(255,255,255,.1));color:var(--text-muted,#a6a8b0)}
.ym-ivc-icon{display:flex!important;flex:0 0 auto!important}
.ym-ivc-chev{display:grid!important;place-items:center;flex:0 0 auto!important;width:14px!important;min-width:14px!important;max-width:none!important;padding:0;color:var(--text-muted,#a6a8b0);border-radius:0;position:relative;z-index:1}
.ym-ivc-chev:hover{color:var(--text,#f2f3f5)}
.ym-ivc-chev svg{transition:transform .15s}
.ym-ivc-chev-open svg{transform:rotate(180deg)}
.ym-ivc-menu{position:fixed;z-index:2147482500;width:260px;background:var(--bg-elev,#222329);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:10px;font-size:13px}
.ym-ivc-mlabel{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted,#a6a8b0);margin:10px 0 6px}
.ym-ivc-mlabel:first-child{margin-top:0}
.ym-ivc-mhint{display:block;font-size:11px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted,#a6a8b0);margin-top:2px}
.ym-ivc-select{width:100%;background:var(--bg-input,#1e1f24);color:var(--text,#f2f3f5);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:7px;padding:6px 8px;font:inherit}
.ym-ivc-range{width:100%;accent-color:var(--accent,#ff6b4a)}
.ym-ivc-check{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;cursor:pointer}
.ym-ivc-check input{margin:0}
.ym-ivc-msep{height:1px;background:var(--border,rgba(255,255,255,.1));margin:10px 0}
.ym-ivc-mbtn{width:100%;padding:8px 10px;border-radius:7px;background:none;color:var(--text,#f2f3f5);font:inherit;text-align:left}
.ym-ivc-mbtn:hover{background:var(--bg-hover,rgba(255,255,255,.06))}
`);

      sync();
    },
  });

  function buildDeviceSupport(ctx) {
    const sessions = new Set();
    let audioCtx = null;
    const getCtx = () => audioCtx || (audioCtx = new AudioContext());

    function list(kind) {
      const md = navigator.mediaDevices;
      if (!md || typeof md.enumerateDevices !== 'function') return Promise.resolve([]);
      return md.enumerateDevices().then((all) => all.filter((d) => d.kind === kind)).catch(() => []);
    }

    function applyGain(rawStream) {
      const wantId = ctx.settings.store.inputDeviceId;
      const vol = Number(ctx.settings.store.inputVolume);
      if (!Number.isFinite(vol) || vol === 100) return rawStream;
      try {
        const ac = getCtx();
        const source = ac.createMediaStreamSource(rawStream);
        const gain = ac.createGain();
        gain.gain.value = Math.max(0, vol) / 100;
        source.connect(gain);
        const dest = ac.createMediaStreamDestination();
        gain.connect(dest);
        ac.resume().catch(() => {});
        const session = { gain, source, dest, rawStream };
        sessions.add(session);
        const outTrack = dest.stream.getAudioTracks()[0];
        const outStream = new MediaStream([outTrack, ...rawStream.getVideoTracks()]);
        const stop = () => {
          sessions.delete(session);
          try { source.disconnect(); } catch (_) {}
          try { gain.disconnect(); } catch (_) {}
        };
        outTrack.addEventListener('ended', stop, { once: true });
        void wantId;
        return outStream;
      } catch (err) {
        ctx.log.warn('input volume effect failed to start, using the raw microphone instead', err);
        return rawStream;
      }
    }

    const devices = navigator.mediaDevices;
    if (devices && typeof devices.getUserMedia === 'function') {
      const original = devices.getUserMedia.bind(devices);
      devices.getUserMedia = async function (constraints) {

        const id = ctx.settings.store.inputDeviceId || 'default';
        let effective = constraints;
        if (constraints && constraints.audio && typeof constraints.audio !== 'object') {
          effective = { ...constraints, audio: { deviceId: { exact: id } } };
        } else if (constraints && constraints.audio && typeof constraints.audio === 'object') {
          effective = { ...constraints, audio: { ...constraints.audio, deviceId: { exact: id } } };
        }
        let stream;
        try {
          stream = await original(effective);
        } catch (err) {

          if (effective === constraints) throw err;
          stream = await original(constraints);
        }
        return constraints && constraints.audio ? applyGain(stream) : stream;
      };
      ctx.cleanup(() => { devices.getUserMedia = original; });
      ctx.cleanup(ctx.settings.onChange((key, value) => {
        if (key !== 'inputVolume') return;
        const g = Math.max(0, Number(value)) / 100;
        sessions.forEach((s) => { s.gain.gain.value = g; });
      }));
    }

    function applyOutput(id) {
      document.querySelectorAll('audio, video').forEach((el) => {
        if (typeof el.setSinkId === 'function') el.setSinkId(id || '').catch(() => {});
      });
    }

    const sinkProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (sinkProto && typeof sinkProto.setSinkId === 'function') {
      const originalSetSinkId = sinkProto.setSinkId;
      sinkProto.setSinkId = function (requestedId) {
        void requestedId;
        return originalSetSinkId.call(this, ctx.settings.store.outputDeviceId || '');
      };
      ctx.cleanup(() => { sinkProto.setSinkId = originalSetSinkId; });
    }

    ctx.onMutate(() => { applyOutput(ctx.settings.store.outputDeviceId); });

    return { list, applyOutput };
  }
})();
