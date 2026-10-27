

(function () {

  function parseCombo(s) {
    const parts = String(s || '').toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    const mods = { ctrl: false, shift: false, alt: false, meta: false };
    let key = null;
    for (const p of parts) {
      if (p === 'ctrl' || p === 'control') mods.ctrl = true;
      else if (p === 'shift') mods.shift = true;
      else if (p === 'alt') mods.alt = true;
      else if (p === 'meta' || p === 'cmd' || p === 'win') mods.meta = true;
      else key = p;
    }
    if (!key) return null;
    return { ...mods, key };
  }

  function matches(combo, e) {
    if (!combo) return false;
    return !!e.ctrlKey === combo.ctrl && !!e.shiftKey === combo.shift && !!e.altKey === combo.alt && !!e.metaKey === combo.meta
      && e.key.toLowerCase() === combo.key;
  }

  function nextUnreadRow(fromId) {
    const rows = [...document.querySelectorAll('.chat-row.unread[data-nav-chan], .server-list .unread[data-nav-chan]')];
    if (!rows.length) return null;
    const i = fromId ? rows.findIndex((r) => r.getAttribute('data-nav-chan') === fromId) : -1;
    return rows[(i + 1 + rows.length) % rows.length];
  }

  function focusComposer() {
    const box = document.querySelector('.composer textarea, .composer [contenteditable="true"]');
    if (box) box.focus();
  }

  YM.definePlugin({
    name: 'CustomKeybinds',
    description: "Your own hotkeys for: jump to the next unread chat, swap to the chat you were just in, open YapCord's settings, and focus the message box. Each is off until you set a combo like \"ctrl+j\".",
    authors: ['YapCord'],
    tags: ['Utility'],
    api: { parseCombo, matches, nextUnreadRow, focusComposer },
    options: {
      nextUnread: { type: 'string', default: '', description: 'Jump to next unread chat (e.g. ctrl+j)' },
      lastChannel: { type: 'string', default: '', description: 'Swap to previous chat (e.g. ctrl+shift+j)' },
      openSettings: { type: 'string', default: '', description: 'Open YapCord settings (e.g. ctrl+shift+y)' },
      focusComposer: { type: 'string', default: '', description: 'Focus the message box (e.g. alt+c)' },
    },
    start(ctx) {
      const onKey = (e) => {
        const target = e.target;
        const typing = target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
        const s = ctx.settings.store;
        if (matches(parseCombo(s.openSettings), e)) { e.preventDefault(); YM.Store.openSettings(); return; }
        if (typing && !(e.ctrlKey || e.metaKey || e.altKey)) return;
        if (matches(parseCombo(s.nextUnread), e)) {
          e.preventDefault();
          const row = nextUnreadRow(YM.Store.getState().activeChannelId);
          if (row) row.click();
          return;
        }
        if (matches(parseCombo(s.lastChannel), e)) {
          e.preventDefault();
          const id = YM.Store.getState().lastChannel;
          const row = id && document.querySelector('.chat-row[data-nav-chan="' + CSS.escape(id) + '"]');
          if (row) row.click();
          return;
        }
        if (matches(parseCombo(s.focusComposer), e)) { e.preventDefault(); focusComposer(); }
      };
      document.addEventListener('keydown', onKey, true);
      ctx.cleanup(() => document.removeEventListener('keydown', onKey, true));
    },
  });
})();
