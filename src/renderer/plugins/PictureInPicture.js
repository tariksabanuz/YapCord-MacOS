

(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/></svg>';

  function supported() {
    return typeof document.pictureInPictureEnabled === 'boolean' ? document.pictureInPictureEnabled : 'pictureInPictureEnabled' in document.createElement('video');
  }

  YM.definePlugin({
    name: 'PictureInPicture',
    description: 'Adds a picture-in-picture button over videos in chat, so you can pop one out into a floating window.',
    authors: ['Vencord (ported to Yapper)'],
    tags: ['Chat', 'Utility'],
    api: { supported },
    start(ctx) {
      if (!supported()) { ctx.log.warn('This browser does not support picture-in-picture; the button will not appear.'); return; }
      ctx.css(`.msg-video-box{position:relative}
.ym-pip-btn{position:absolute;top:6px;right:6px;z-index:5;background:rgba(0,0,0,.55);color:#fff;border-radius:6px;padding:4px;display:flex;opacity:0;transition:opacity .15s;pointer-events:none}
.msg-video-box:hover .ym-pip-btn{opacity:1;pointer-events:auto}`);
      const sync = () => {
        document.querySelectorAll('video.msg-video').forEach((video) => {
          const box = video.closest('.msg-video-box');
          if (!box || box.querySelector('.ym-pip-btn')) return;
          box.append(YM.dom.h('button', {
            class: 'ym-pip-btn', type: 'button', title: 'Picture in picture', 'aria-label': 'Picture in picture', html: ICON,
            onClick: (e) => { e.stopPropagation(); video.requestPictureInPicture().catch((err) => YM.toast('Could not open picture-in-picture: ' + err.message, { type: 'error' })); },
          }));
        });
      };
      sync();
      ctx.onMutate(sync);
      ctx.cleanup(() => document.querySelectorAll('.ym-pip-btn').forEach((n) => n.remove()));
    },
  });
})();
