

(function () {
  const MAX_BYTES = 2 * 1024 * 1024;
  const sessions = new Set();
  let audioCtx = null;
  const getCtx = () => audioCtx || (audioCtx = new AudioContext());

  function clipsOf(ctx) {
    const v = ctx.settings.store.clips;
    return YM.util.isObj(v) ? v : {};
  }

  function wrapStream(rawStream) {
    const ac = getCtx();
    const micSource = ac.createMediaStreamSource(rawStream);
    const mixGain = ac.createGain();
    mixGain.gain.value = 1;
    micSource.connect(mixGain);
    const dest = ac.createMediaStreamDestination();
    mixGain.connect(dest);
    ac.resume().catch(() => {});
    const session = { micSource, mixGain, rawStream };
    sessions.add(session);
    const outTrack = dest.stream.getAudioTracks()[0];
    const outStream = new MediaStream([outTrack, ...rawStream.getVideoTracks()]);
    const stop = () => {
      sessions.delete(session);
      try { micSource.disconnect(); } catch (_) {}
      try { mixGain.disconnect(); } catch (_) {}
      rawStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
    };
    outTrack.addEventListener('ended', stop, { once: true });
    return outStream;
  }

  async function play(dataUrl, volume) {
    const ac = getCtx();
    await ac.resume().catch(() => {});
    const buf = await fetch(dataUrl).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b));
    const vol = Math.max(0, Math.min(2, Number(volume) || 1));

    const localSrc = ac.createBufferSource();
    localSrc.buffer = buf;
    const localGain = ac.createGain();
    localGain.gain.value = vol;
    localSrc.connect(localGain);
    localGain.connect(ac.destination);
    localSrc.start();
    if (!sessions.size) { YM.toast('Playing locally - join a voice channel to send it to the call too.'); return; }
    for (const s of sessions) {
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(s.mixGain);
      src.start();
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('could not read file'));
      reader.readAsDataURL(file);
    });
  }

  YM.definePlugin({
    name: 'MiniSoundboard',
    description: 'Play your own short sound clips into a voice call, mixed with your mic (and heard on your own speakers too). Bring your own clips - none are bundled. Settings-based storage, so keep clips short.',
    authors: ['YapCord'],
    tags: ['Voice'],
    api: { play, clipsOf: (ctxLike) => clipsOf({ settings: ctxLike }) },
    options: {
      clips: {
        type: 'custom',
        default: {},
        render(box, plugin) {
          const h = YM.dom.h;
          const draw = () => {
            const clips = clipsOf(plugin);
            const ids = Object.keys(clips);
            box.replaceChildren(
              h('div', { class: 'toggle-label' }, 'Your clips'),
              ids.length
                ? h('div', { class: 'ym-sb-list' }, ids.map((id) => h('div', { class: 'ym-sb-item' },
                  h('span', { class: 'ym-sb-name' }, clips[id].name),
                  h('button', { class: 'ym-btn ym-btn-small', type: 'button', onClick: () => play(clips[id].dataUrl, clips[id].volume) }, 'Play'),
                  h('button', { class: 'ym-btn ym-btn-small ym-btn-ghost', type: 'button', onClick: () => { const next = { ...clips }; delete next[id]; plugin.settings.set('clips', next); } }, 'Remove'))))
                : h('div', { class: 'hint' }, 'No clips yet - add a short audio file below.'),
              h('button', {
                class: 'ym-btn ym-btn-small', type: 'button',
                onClick: () => {
                  const input = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' } });
                  input.addEventListener('change', async () => {
                    const file = input.files && input.files[0];
                    input.remove();
                    if (!file) return;
                    if (file.size > MAX_BYTES) { YM.toast('That clip is over 2MB - trim it down first.', { type: 'error' }); return; }
                    try {
                      const dataUrl = await readFile(file);
                      const id = YM.util.uid();
                      const name = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'Clip';
                      plugin.settings.set('clips', { ...clipsOf(plugin), [id]: { name, dataUrl, volume: 1 } });
                    } catch (err) {
                      YM.toast('Could not read that file.', { type: 'error' });
                    }
                  }, { once: true });
                  document.body.append(input);
                  input.click();
                },
              }, '+ Add sound'),
            );
          };
          draw();
          const off = plugin.settings.onChange((key) => {
            if (!box.isConnected) { off(); return; }
            if (key === 'clips') draw();
          });
        },
      },
    },
    start(ctx) {
      const devices = navigator.mediaDevices;
      if (!devices || typeof devices.getUserMedia !== 'function') { ctx.log.warn('no microphone API in this browser; MiniSoundboard has nothing to mix into'); return; }
      const original = devices.getUserMedia.bind(devices);
      devices.getUserMedia = async function (constraints) {
        const stream = await original(constraints);
        if (!constraints || !constraints.audio) return stream;
        try { return wrapStream(stream); } catch (err) { ctx.log.warn('could not set up mixing, using your raw microphone instead', err); return stream; }
      };
      ctx.cleanup(() => { devices.getUserMedia = original; });

      const h = YM.dom.h;
      let btn = null;
      let menu = null;
      function closeMenu() { if (menu) { menu.remove(); menu = null; } }
      function openMenu() {
        closeMenu();
        const clips = clipsOf(ctx);
        const ids = Object.keys(clips);
        const body = ids.length
          ? h('div', { class: 'ym-sb-menu-list' }, ids.map((id) => h('button', { type: 'button', class: 'ym-sb-menu-item', onClick: () => { play(clips[id].dataUrl, clips[id].volume); closeMenu(); } }, clips[id].name)))
          : h('div', { class: 'ym-sb-menu-empty' }, 'No clips yet - add one in Settings → Plugins → MiniSoundboard.');
        const inner = h('div', { class: 'ym-sb-menu', onPointerDown: (e) => e.stopPropagation() }, body);
        menu = h('div', { class: 'overlay clear', style: { background: 'transparent', animation: 'none' }, onPointerDown: closeMenu }, inner);
        document.body.append(menu);
      }
      function ensureBtn() {
        const bar = document.querySelector('.user-bar');
        if (!bar) return;
        if (!btn || !btn.isConnected) {
          btn = h('button', { type: 'button', class: 'icon-btn ym-sb-btn', title: 'Soundboard', 'aria-label': 'Soundboard', onClick: () => (menu ? closeMenu() : openMenu()) }, '🔊');
          bar.append(btn);
        }
      }
      ensureBtn();
      ctx.watch('.user-bar', ensureBtn);
      ctx.css(`
.ym-sb-btn{font-size:14px}
.ym-sb-menu{position:fixed;bottom:60px;left:16px;min-width:200px;max-width:260px;max-height:300px;overflow:auto;background:var(--bg-float,#1e1f24);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.4);padding:6px;z-index:1000}
.ym-sb-menu-item{display:block;width:100%;text-align:left;padding:7px 10px;border-radius:5px;border:none;background:transparent;color:var(--text,#e3e5e8);cursor:pointer;font-size:13px}
.ym-sb-menu-item:hover{background:var(--bg-hover,rgba(255,255,255,.08))}
.ym-sb-menu-empty{padding:8px 10px;font-size:12px;color:var(--text-faint,#8b8d98);max-width:220px}
.ym-sb-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.ym-sb-item{display:flex;gap:6px;align-items:center}
.ym-sb-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`);
      ctx.cleanup(() => { closeMenu(); if (btn) btn.remove(); btn = null; });
    },
  });
})();
