
(function () {
  YM.definePlugin({
    name: 'VoiceChatDoubleClick',
    description: 'Joins a voice channel only after a double-click (Yapper joins on a single click, which is easy to do by accident).',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Voice'],
    start(ctx) {
      const voice = YM.finder.lazy(['joinVoice', 'leaveVoice']);
      const chat = YM.finder.lazy(['openChannel', 'sendMessage']);

      function voiceChannelOf(button) {
        const s = YM.Store.getState();
        if (!s) return null;
        const row = button.closest('.channel-row');
        if (!row || row.hasAttribute('data-nav-chan')) return null;
        const name = (button.querySelector('.name') || button).textContent.trim();
        const found = Object.values(s.channels).filter((c) => c.kind === 'voice' && c.server_id === s.activeServerId && c.name === name);
        return found.length === 1 ? found[0] : null;
      }

      const onClick = (e) => {
        const button = e.target instanceof Element ? e.target.closest('.sidebar .channel-row .channel-main') : null;
        if (!button) return;
        const channel = voiceChannelOf(button);
        if (!channel) return;
        const s = YM.Store.getState();
        if (s.voice && s.voice.channelId === channel.id) return;
        e.stopPropagation();
        e.preventDefault();
      };
      const onDouble = (e) => {
        const button = e.target instanceof Element ? e.target.closest('.sidebar .channel-row .channel-main') : null;
        if (!button) return;
        const channel = voiceChannelOf(button);
        if (!channel) return;
        const v = voice();
        const c = chat();
        if (!v || !c) { YM.toast('Could not join: the voice functions of Yapper were not found.', { type: 'error' }); return; }
        Promise.resolve(c.openChannel(channel.id)).then(() => v.joinVoice(channel.server_id, channel.id)).catch((err) => YM.toast('Could not join: ' + ((err && err.message) || err), { type: 'error' }));
      };
      document.addEventListener('click', onClick, true);
      document.addEventListener('dblclick', onDouble, true);
      ctx.cleanup(() => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('dblclick', onDouble, true);
      });
    },
  });
})();
