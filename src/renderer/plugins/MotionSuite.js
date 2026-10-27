

(function () {
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  const BIG = [

    ['.ym-panel', 'ymMsSlideRight .34s ' + EASE],

    ['.ym-nav-btn.active', 'ymMsPop .3s ' + SPRING],

    ['.ym-cmd-menu,.ym-cmdm-popup', 'ymMsPop .22s ' + EASE],
    ['.ym-sb-menu', 'ymMsPop .2s ' + EASE],
    ['.ym-qt-menu', 'ymMsPop .2s ' + EASE],
    ['.ym-rem-menu', 'ymMsPop .2s ' + EASE],
    ['.ym-pin-list', 'ymMsPop .22s ' + EASE],
    ['.ym-ivc-menu', 'ymMsDown .2s ' + EASE],
    ['.ym-qs-box', 'ymMsDown .22s ' + EASE],

    ['.ym-raw-modal', 'ymMsSlideRight .3s ' + EASE],

    ['.ym-ob-page', 'ymMsSlideRight .3s ' + EASE],
    ['.ym-ob-section', 'ymMsUp .24s ' + EASE],

    ['.folder-grid', 'ymMsUp .22s ' + EASE],
    ['.folder-mini', 'ymMsPop .2s ' + EASE],
  ];

  const SMALL = {

    buttons: [
      ['.ym-sb-btn,.ym-pv-btn,.ym-ns-btn,.ym-ivc-mbtn,.ym-ra-btn,.ym-fn-btn,.ym-pinned-btn,.ym-chatexport-btn,.ym-jtu-btn,.ym-nav-btn,.ym-qr-extra', `transition:transform .14s ${SPRING},background-color .14s ease-out,box-shadow .14s ease-out`],
      ['.ym-sb-btn:hover,.ym-pv-btn:hover,.ym-ns-btn:hover,.ym-ivc-mbtn:hover,.ym-ra-btn:hover,.ym-fn-btn:hover,.ym-pinned-btn:hover,.ym-chatexport-btn:hover,.ym-jtu-btn:hover,.ym-nav-btn:hover,.ym-qr-extra:hover', 'transform:translateY(-1px)'],
      ['.ym-sb-btn:active,.ym-pv-btn:active,.ym-ns-btn:active,.ym-ivc-mbtn:active,.ym-ra-btn:active,.ym-fn-btn:active,.ym-pinned-btn:active,.ym-chatexport-btn:active,.ym-jtu-btn:active,.ym-nav-btn:active,.ym-qr-extra:active', 'transform:scale(.93)'],
      ['.ym-qt-on', `animation:ymMsPop .22s ${SPRING}`],
      ['.ym-pip-btn', `transition:opacity .15s,transform .15s ${SPRING}`],
      ['.ym-pip-btn:hover', 'transform:scale(1.12)'],
    ],

    badges: [
      ['.badge,.ym-ra-badge,.ym-yb-badge', `animation:ymMsPop .26s ${SPRING}`],
      ['.ym-cn-dot,.rail-badge,.ym-sli-dot', `animation:ymMsPop .3s ${SPRING}`],
      ['.ym-cp-pill', 'transition:background-color .2s ease-out,color .2s ease-out,transform .2s ' + EASE],
      ['.ym-cp-good,.ym-cp-ok,.ym-cp-bad,.ym-cp-unknown', `animation:ymMsPop .22s ${SPRING}`],
      ['.ym-sli-unit', 'transition:opacity .15s ease-out'],
    ],

    rows: [
      ['.ym-csi-row,.ym-sm-row,.ym-pm-item,.ym-tr-row,.ym-sli-row,.ym-cmdm-item,.ym-fn-item,.ym-sb-item', 'transition:transform .14s ' + EASE + ',background-color .14s ease-out'],
      ['.ym-csi-row:hover,.ym-sm-row:hover,.ym-pm-item:hover,.ym-tr-row:hover,.ym-cmdm-item:hover,.ym-fn-item:hover,.ym-sb-item:hover', 'transform:translateX(3px)'],
      ['.ym-cmdm-group', 'transition:opacity .15s ease-out'],
      ['.ym-csi-item,.ym-csi-prev', `transition:transform .15s ${SPRING}`],
      ['.ym-csi-item:hover,.ym-csi-prev:hover', 'transform:scale(1.04)'],
    ],

    marks: [

      ['.ym-enc-mark,.ym-ghost-mark,.ym-hm-mark,.ym-pronouns,.ym-home-icon,.ym-membercount,.ym-icon-preview', `animation:ymMsFadeUp .22s ${EASE}`],
      ['.ym-link', 'transition:opacity .15s ease-out'],
      ['.ym-link:hover', 'opacity:.82'],
    ],

    message: [
      ['.msg-linkimgs,.msg-image img', `animation:ymMsFadeUp .22s ${EASE}`],
      ['.msg-album-cell', `transition:transform .16s ${SPRING}`],
      ['.msg-album-cell:hover', 'transform:scale(1.015)'],
      ['.emoji-cell,.emoji-ac-img', `transition:transform .14s ${SPRING}`],
      ['.emoji-cell:hover,.emoji-ac-img:hover', 'transform:scale(1.18)'],
      ['.mention', 'transition:background-color .15s ease-out'],
      ['.msg-audio', 'transition:background-color .15s ease-out'],
    ],

    inputs: [
      ['.input', 'transition:box-shadow .16s ease-out,border-color .16s ease-out'],
      ['.input:focus', 'box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 45%,transparent)'],
      ['.ym-cmd-hint,.ym-sub-hint,.ym-reply-time,.ym-calltimer', `animation:ymMsFadeUp .18s ${EASE}`],
    ],

    reveal: [
      ['.md-spoiler', 'transition:filter .22s ease-out,background-color .22s ease-out'],
    ],

    extra: [

      ['.blocked-msg', `animation:ymMsFadeUp .2s ${EASE}`],

      ['.quick-reacts', `animation:ymMsPop .18s ${SPRING}`],

      ['.msg-video-box', 'transition:box-shadow .16s ease-out'],
      ['.msg-video-box:hover', 'box-shadow:0 4px 16px rgba(0,0,0,.3)'],

      ['.friends-tabs button', 'transition:color .15s ease-out,border-color .15s ease-out'],

      ['.rail-folder,.ym-bf-folder,.ym-bf-head', 'transition:background-color .15s ease-out'],

      ['.ym-bsp', `animation:ymMsFadeUp .22s ${EASE}`],

      ['.ym-ivc-select,.ym-ivc-range', 'transition:box-shadow .16s ease-out'],
      ['.ym-ivc-check', `animation:ymMsPop .2s ${SPRING}`],
      ['.ym-ivc-active', `animation:ymMsPop .22s ${SPRING}`],

      ['.ym-iz-lens', `animation:ymMsPop .18s ${EASE}`],

      ['.ym-mau-btn', 'transition:transform .14s ' + SPRING + ',background-color .14s ease-out'],
      ['.ym-mau-btn:hover', 'transform:translateY(-1px)'],
      ['.ym-mau-active', `animation:ymMsPop .2s ${SPRING}`],

      ['.ym-ml-tag,.ym-ml-edits', `animation:ymMsFadeUp .18s ${EASE}`],

      ['.ym-pin-item', 'transition:transform .14s ' + EASE + ',background-color .14s ease-out'],
      ['.ym-pin-item:hover', 'transform:translateX(3px)'],

      ['.ym-qs-row', 'transition:transform .14s ' + EASE + ',background-color .14s ease-out'],
      ['.ym-qs-row:hover', 'transform:translateX(3px)'],
      ['.ym-qs-active', `animation:ymMsPop .18s ${SPRING}`],
      ['.ym-qs-input', 'transition:box-shadow .16s ease-out,border-color .16s ease-out'],

      ['.ym-ra-has', `animation:ymMsPop .2s ${SPRING}`],

      ['.ym-raw-card', `animation:ymMsFadeUp .2s ${EASE}`],
      ['.ym-re-section', `animation:ymMsFadeUp .2s ${EASE}`],

      ['.ym-sb-menu-item', 'transition:transform .14s ' + EASE + ',background-color .14s ease-out'],
      ['.ym-sb-menu-item:hover', 'transform:translateX(3px)'],

      ['.ym-sm-err', `animation:ymMsFadeUp .2s ${EASE}`],

      ['.ym-tp-swatch', `transition:transform .16s ${SPRING}`],
      ['.ym-tp-swatch:hover', 'transform:scale(1.15)'],

      ['.ym-fn-av', `transition:transform .15s ${SPRING}`],
      ['.ym-fn-av:hover', 'transform:scale(1.08)'],
    ],
  };

  YM.definePlugin({
    name: 'MotionSuite',
    description: 'A slide-in for every YapCord-built panel and menu (the Settings page chief among them - it now slides in from the right instead of just appearing), plus hover, press and reveal motion for 100+ smaller pieces across every plugin\'s own UI that never had any. Respects "reduce motion" throughout.',
    authors: ['YapCord'],
    tags: ['Appearance', 'Accessibility'],
    alwaysOn: true,
    options: {
      panels: { type: 'boolean', default: true, description: 'Settings, popup menus, the onboarding wizard and folders slide/pop in instead of just appearing' },
      buttons: { type: 'boolean', default: true, description: 'YapCord’s own buttons (soundboard, idle-voice, jump-to-unread, nav, and more) lift on hover and ease down when pressed' },
      badges: { type: 'boolean', default: true, description: 'Badges, pills and status dots pop in instead of snapping into view' },
      rows: { type: 'boolean', default: true, description: 'Rows in YapCord’s own lists and menus nudge sideways on hover' },
      marks: { type: 'boolean', default: true, description: 'Small marks and icons (encryption, ghost-reads, pronouns, and more) fade in; chevrons rotate smoothly' },
      message: { type: 'boolean', default: true, description: 'Link previews and album images fade in; emoji cells lift slightly on hover' },
      inputs: { type: 'boolean', default: true, description: 'Text fields ease their focus ring in; hints fade up instead of appearing instantly' },
      reveal: { type: 'boolean', default: true, description: 'Spoilers un-blur smoothly on click instead of switching instantly' },
      extra: { type: 'boolean', default: true, description: 'Everything else: quick-reacts, ImageZoom’s lens, Quick Switcher rows, pinned DMs, the soundboard menu, theme swatches, and more' },
    },
    start(ctx) {
      const build = () => {
        const s = ctx.settings.store;
        const motion = [];
        if (s.panels) for (const [sel, anim] of BIG) motion.push(`${sel}{animation:${anim}}`);
        if (s.buttons) for (const [sel, decl] of SMALL.buttons) motion.push(`${sel}{${decl}}`);
        if (s.badges) for (const [sel, decl] of SMALL.badges) motion.push(`${sel}{${decl}}`);
        if (s.rows) for (const [sel, decl] of SMALL.rows) motion.push(`${sel}{${decl}}`);
        if (s.marks) for (const [sel, decl] of SMALL.marks) motion.push(`${sel}{${decl}}`);
        if (s.message) for (const [sel, decl] of SMALL.message) motion.push(`${sel}{${decl}}`);
        if (s.inputs) for (const [sel, decl] of SMALL.inputs) motion.push(`${sel}{${decl}}`);
        if (s.extra) for (const [sel, decl] of SMALL.extra) motion.push(`${sel}{${decl}}`);

        let out = '@media (prefers-reduced-motion:no-preference){'
          + '@keyframes ymMsSlideRight{from{opacity:0;transform:translateX(26px)}}'
          + '@keyframes ymMsDown{from{opacity:0;transform:translateY(-8px)}}'
          + '@keyframes ymMsUp{from{opacity:0;transform:translateY(8px)}}'
          + '@keyframes ymMsFadeUp{from{opacity:0;transform:translateY(3px)}}'
          + '@keyframes ymMsPop{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}'
          + motion.join('')
          + '}';

        if (s.reveal) for (const [sel, decl] of SMALL.reveal) out += `${sel}{${decl}}`;
        ctx.css(out);
      };
      build();
      ctx.cleanup(ctx.settings.onChange(build));
    },
  });
})();
