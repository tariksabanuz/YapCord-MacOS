

(function () {
  const SETTINGS_KEY = 'pluginData.MessageEncryption';
  const PREFIX = '\u{1F512}ENC1:';
  const SALT_PREFIX = 'YapCord-MessageEncryption-salt:';
  const PBKDF2_ITERATIONS = 150000;
  const h = (...a) => YM.dom.h(...a);

  function allKeys() {
    const v = YM.settings.get(SETTINGS_KEY, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }
  function keyFor(channelId) {
    const v = allKeys()[channelId];
    return typeof v === 'string' && v ? v : null;
  }
  function setKeyFor(channelId, passphrase) {
    const m = allKeys();
    const p = String(passphrase || '').trim();
    if (p) m[channelId] = p;
    else delete m[channelId];
    YM.settings.set(SETTINGS_KEY, m);
  }

  const keyCache = new Map();
  function cryptoKeyFor(channelId, passphrase) {
    const cached = keyCache.get(channelId);
    if (cached && cached.passphrase === passphrase) return cached.promise;
    const enc = new TextEncoder();
    const promise = crypto.subtle.digest('SHA-256', enc.encode(SALT_PREFIX + channelId)).then((saltBuf) =>
      crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']).then((baseKey) =>
        crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: new Uint8Array(saltBuf), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        )));
    keyCache.set(channelId, { passphrase, promise });
    return promise;
  }

  const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

  async function encryptText(channelId, passphrase, text) {
    const key = await cryptoKeyFor(channelId, passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    const packed = new Uint8Array(iv.length + cipher.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(cipher), iv.length);
    return PREFIX + toB64(packed);
  }

  async function decryptText(channelId, content) {
    if (typeof content !== 'string' || !content.startsWith(PREFIX)) return { status: 'not-encrypted' };
    const passphrase = keyFor(channelId);
    if (!passphrase) return { status: 'no-key' };
    try {
      const packed = fromB64(content.slice(PREFIX.length));
      const iv = packed.slice(0, 12);
      const cipher = packed.slice(12);
      const key = await cryptoKeyFor(channelId, passphrase);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return { status: 'ok', text: new TextDecoder().decode(plain) };
    } catch (_) {
      return { status: 'failed' };
    }
  }

  function channelOf(id) {
    const st = YM.Store.isReady ? YM.Store.getState() : null;
    return (st && st.channels && st.channels[id]) || null;
  }
  function label(id) {
    const c = channelOf(id);
    if (!c) return 'this chat';
    if (c.server_id) {
      const st = YM.Store.getState();
      const sv = st.servers && st.servers[c.server_id];
      return '#' + (c.name || 'channel') + (sv ? ' in ' + sv.name : '');
    }
    return c.name || 'this chat';
  }

  function openEditor(channelId) {
    const input = h('input', { class: 'ym-input', type: 'text', spellcheck: 'false', placeholder: 'A passphrase only you and them know', 'aria-label': 'Shared key' });
    input.value = keyFor(channelId) || '';
    return YM.modal.open({
      title: 'Shared key',
      subtitle: label(channelId),
      body: h('div', {}, input, h('div', { class: 'ym-sub-hint', style: { marginTop: '8px' } },
        "Tell whoever you're talking to this exact passphrase some other way - it never goes through Yapper itself. Only the text of a message is scrambled; pictures and files sent alongside it are not.")),
      buttons: [
        { label: 'Save', onClick: (close) => { setKeyFor(channelId, input.value); YM.messages.refresh(); close(); } },
        keyFor(channelId) ? { label: 'Remove key', danger: true, onClick: (close) => { setKeyFor(channelId, ''); YM.messages.refresh(); close(); } } : null,
      ].filter(Boolean),
    });
  }

  function renderManager(box) {
    box.style.flexDirection = 'column';
    box.style.alignItems = 'stretch';
    const list = h('div', { class: 'ym-csi-list' });
    const draw = () => {
      const m = allKeys();
      list.replaceChildren();
      const ids = Object.keys(m).sort((a, b) => label(a).localeCompare(label(b)));
      if (!ids.length) { list.append(h('div', { class: 'hint' }, 'No shared keys yet. Right-click a chat and choose "Set shared key...".')); return; }
      for (const id of ids) {
        list.append(h('div', { class: 'ym-csi-item' },
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'ym-csi-name' }, label(id))),
          h('button', { type: 'button', class: 'ym-btn ym-btn-small', onClick: () => openEditor(id) }, 'Edit'),
          h('button', { type: 'button', class: 'ym-btn ym-btn-small ym-btn-ghost', onClick: () => { setKeyFor(id, ''); YM.messages.refresh(); draw(); } }, 'Remove')));
      }
    };
    const off = YM.settings.onPath(SETTINGS_KEY, draw);
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    box.append(h('div', { class: 'toggle-label' }, 'Shared keys'), list);
    draw();
  }

  function setTextareaValue(ta, value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function wantsHandling(ta) {
    const text = ta.value;
    if (!text.trim() || text.trimStart().startsWith('/')) return null;
    const st = YM.Store.isReady ? YM.Store.getState() : null;
    const channelId = st && st.activeChannelId;
    if (!channelId) return null;
    const passphrase = keyFor(channelId);
    if (!passphrase) return null;
    return { channelId, passphrase, text };
  }

  YM.definePlugin({
    name: 'MessageEncryption',
    description: 'Set a shared key on a chat (right-click it) and your messages there are scrambled before they reach Yapper - unreadable to anyone without that same key, including Yapper itself. Text only; see the Plugins page for its honest limits.',
    authors: ['YapCord'],
    tags: ['Chat', 'Privacy', 'Security'],
    alwaysOn: true,
    api: { encryptText, decryptText, keyFor, setKeyFor, wantsHandling, PREFIX, label },
    options: { manage: { type: 'custom', default: false, render: (box) => renderManager(box) } },
    start(ctx) {
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        ctx.log.warn('Web Crypto is not available here - MessageEncryption cannot scramble anything in this environment.');
        return;
      }
      const sendFn = YM.finder.lazy(['sendMessage', 'deleteMessage']);

      async function doSend(ta, { channelId, passphrase, text }) {
        const mod = sendFn();
        if (!mod || typeof mod.sendMessage !== 'function') {
          YM.toast("Could not find Yapper's send function - this was not sent, encrypted or not.", { type: 'error' });
          return;
        }
        setTextareaValue(ta, '');
        try {
          const encrypted = await encryptText(channelId, passphrase, text);
          await mod.sendMessage(channelId, encrypted, null, null);
        } catch (err) {
          setTextareaValue(ta, text);
          YM.toast('Could not encrypt/send: ' + ((err && err.message) || err), { type: 'error' });
        }
      }

      const onKeydown = (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        const ta = e.target;
        if (!(ta instanceof HTMLTextAreaElement) || !ta.closest('.composer')) return;

        const popup = document.querySelector('.mention-menu[role="listbox"]');
        if (popup && popup.querySelector('[role="option"][aria-selected="true"]')) return;
        const job = wantsHandling(ta);
        if (!job) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        doSend(ta, job);
      };
      const onClick = (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('.composer .send-btn[aria-label="Send"]');
        if (!btn) return;
        const composer = btn.closest('.composer');
        const ta = composer && composer.querySelector('textarea');
        if (!ta) return;
        const job = wantsHandling(ta);
        if (!job) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        doSend(ta, job);
      };
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('click', onClick, true);
      ctx.cleanup(() => {
        document.removeEventListener('keydown', onKeydown, true);
        document.removeEventListener('click', onClick, true);
      });

      ctx.cleanup(YM.messages.decorate(({ el, message, body }) => {
        const mark = el.querySelector(':scope > .ym-enc-mark');
        if (!message || typeof message.content !== 'string' || !message.content.startsWith(PREFIX)) {
          if (mark) mark.remove();
          const old = body && body.querySelector(':scope > .ym-enc-text');
          if (old) old.remove();
          return;
        }
        if (!mark) el.append(h('span', { class: 'ym-enc-mark', hidden: true }));
        if (!body) return;
        let note = body.querySelector(':scope > .ym-enc-text');
        const isNew = !note;
        if (isNew) {
          note = h('div', { class: 'ym-enc-text' }, '\u{1F512} Decrypting…');
          body.append(note);
        }
        decryptText(message.channel_id, message.content).then((result) => {
          if (!note.isConnected) return;
          if (result.status === 'no-key') note.textContent = "\u{1F512} Encrypted message — add this chat's shared key to read it (right-click it).";
          else if (result.status === 'failed') note.textContent = '\u{1F512} Encrypted message — could not decrypt (wrong shared key?).';
          else if (result.status === 'ok') note.textContent = '\u{1F512} ' + result.text;
        });
      }));
      ctx.cleanup(() => document.querySelectorAll('.ym-enc-mark,.ym-enc-text').forEach((n) => n.remove()));
      ctx.css(`
.msg:has(> .ym-enc-mark) > .msg-body > .msg-text{display:none!important}
.ym-enc-text{white-space:pre-wrap;word-break:break-word}
`);

      let pending = null;
      const onContext = (e) => {
        const row = e.target instanceof Element ? e.target.closest('[data-nav-chan]') : null;
        pending = row ? { id: row.getAttribute('data-nav-chan'), at: Date.now() } : null;
      };
      document.addEventListener('contextmenu', onContext, true);
      ctx.cleanup(() => document.removeEventListener('contextmenu', onContext, true));
      ctx.onMutate(() => {
        document.querySelectorAll('.ctx-menu').forEach((menu) => {
          if (!pending || Date.now() - pending.at > 3000 || menu.querySelector('.ym-enc-item')) return;
          const id = pending.id;
          menu.append(h('button', {
            type: 'button', role: 'menuitem', class: 'ym-enc-item', onClick: () => {
              const overlay = menu.closest('.overlay');
              if (overlay) overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              openEditor(id);
            },
          }, h('span', {}, keyFor(id) ? 'Change shared key...' : 'Set shared key...')));
        });
        if (!document.querySelector('.ctx-menu') && pending && Date.now() - pending.at > 400) pending = null;
      });
      ctx.cleanup(() => document.querySelectorAll('.ym-enc-item').forEach((n) => n.remove()));
    },
  });
})();
