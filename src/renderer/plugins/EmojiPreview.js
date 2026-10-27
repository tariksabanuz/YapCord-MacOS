

(function () {
  const h = YM.dom.h;

  function findEmoji(img) {
    const s = YM.Store.getState();
    if (!s || !s.emojis) return null;
    const src = img.currentSrc || img.src || '';
    for (const [id, e] of Object.entries(s.emojis)) {
      if (e && e.path && src.includes(e.path)) return { id, ...e };
    }
    return null;
  }

  function openModal(img) {
    const big = h('img', { src: img.currentSrc || img.src, alt: '', style: { width: '96px', height: '96px', objectFit: 'contain', display: 'block', margin: '0 auto 14px' } });

    if (img.classList.contains('std')) {
      return YM.modal.open({
        title: 'Default emoji',
        body: h('div', { style: { textAlign: 'center' } }, big, h('p', { style: { color: 'var(--text-muted,#a6a8b0)', margin: 0 } }, 'A standard emoji - built into every device, not something any one server made.')),
      });
    }

    const emoji = findEmoji(img);
    if (!emoji) {

      YM.toast("Could not find this emoji's details yet - try again once the page has settled.");
      return null;
    }

    const s = YM.Store.getState();
    const server = emoji.server_id && s && s.servers ? s.servers[emoji.server_id] : null;
    const rows = [[h('dt', {}, 'Name'), h('dd', {}, ':' + (emoji.name || '?') + ':')]];
    const buttons = [];
    if (server) {
      rows.push([h('dt', {}, 'From'), h('dd', {}, server.name)]);
      buttons.push({
        label: 'Go to ' + server.name,
        onClick: (close) => {
          close();
          YM.Store.setState({ activeServerId: emoji.server_id });

          YM.toast('Use "Invite People" from this server\'s own menu to invite someone.');
        },
      });
    } else {
      rows.push([h('dt', {}, 'From'), h('dd', {}, "A server you're not in (or it hasn't loaded yet)")]);
    }

    return YM.modal.open({
      title: 'Custom emoji',
      body: h('div', {}, h('div', { style: { textAlign: 'center' } }, big), h('dl', { class: 'ym-kv' }, rows)),
      buttons,
    });
  }

  YM.definePlugin({
    name: 'EmojiPreview',
    description: 'Click any emoji in a message: a custom one shows its name, a bigger preview and which server it\'s from (with a way to jump there); a plain device emoji just says "default emoji".',
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    alwaysOn: true,
    api: { findEmoji },
    start(ctx) {
      const onClick = (e) => {
        if (!(e.target instanceof Element)) return;
        const img = e.target.closest('.msg img.emoji');
        if (!img) return;
        e.preventDefault();
        e.stopPropagation();
        openModal(img);
      };

      document.addEventListener('click', onClick, true);
      ctx.cleanup(() => document.removeEventListener('click', onClick, true));
      ctx.css('.msg img.emoji{cursor:pointer}');
    },
  });
})();
