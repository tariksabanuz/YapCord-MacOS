

(function () {
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  YM.definePlugin({
    name: 'UIPolish',
    description: 'Buttons and server icons lift and glow, avatars pop with a gradient ring on hover, the server-list indicator eases, your currently open server gently pulses with your accent colour, the message box glows wider while focused, and a slimmer accent scrollbar.',
    authors: ['YapCord'],
    tags: ['Appearance'],
    alwaysOn: true,
    options: {
      press: { type: 'boolean', default: true, description: 'Buttons and server icons lift and glow on hover, and ease down when pressed' },
      avatarGlow: { type: 'boolean', default: true, description: 'Avatars pop up with a gradient accent ring on hover' },
      rail: { type: 'boolean', default: true, description: 'The server list’s unread/active indicator eases in and out instead of snapping' },
      activeGlow: { type: 'boolean', default: true, description: 'The server icon you currently have open gently pulses with your accent colour' },
      focusGlow: { type: 'boolean', default: true, description: 'A soft, wider accent glow around the message box while it’s focused' },
      scrollbars: { type: 'boolean', default: true, description: 'A slimmer, rounded scrollbar for the chat list and emoji picker, tinted with your accent colour on hover' },
    },
    start(ctx) {
      const css = () => {
        const s = ctx.settings.store;
        let motion = '';
        if (s.press) {
          motion += `.icon-btn,.btn,.rail-item,.send-btn{transition:transform 160ms ${SPRING},box-shadow 160ms ease-out,background-color 160ms ease-out}`;
          motion += '.icon-btn:hover,.btn:hover,.send-btn:hover{transform:translateY(-1px);box-shadow:0 3px 12px color-mix(in srgb,var(--accent) 28%,transparent)}';
          motion += '.rail-item:not(.active):hover{transform:translateY(-1px) scale(1.03)}';
          motion += '.icon-btn:active,.btn:active,.rail-item:active,.send-btn:active{transform:scale(.92)}';
        }
        if (s.avatarGlow) {
          motion += `.avatar{transition:transform 200ms ${SPRING},box-shadow 200ms ease-out;border-radius:50%}`;
          motion += '.avatar:hover{transform:translateY(-2px) scale(1.08);box-shadow:0 6px 16px rgba(0,0,0,.35),0 0 0 3px color-mix(in srgb,var(--accent) 60%,transparent),0 0 18px color-mix(in srgb,var(--accent) 35%,transparent)}';
        }
        if (s.rail) motion += '.rail-pill{transition:height 160ms ease-out,border-radius 160ms ease-out,opacity 160ms ease-out}';
        if (s.activeGlow) {
          motion += '@keyframes ymPolishPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 55%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 0%,transparent)}}';
          motion += '.rail-item.active{animation:ymPolishPulse 2.6s ease-in-out infinite;border-radius:16px!important}';
        }
        if (s.focusGlow) {
          motion += `.composer-box{transition:box-shadow 200ms ${SPRING},border-color 200ms ease-out}`;
          motion += '.composer-box:focus-within{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 50%,transparent),0 4px 20px color-mix(in srgb,var(--accent) 18%,transparent)}';
        }
        let out = motion ? '@media (prefers-reduced-motion:no-preference){' + motion + '}' : '';
        if (s.scrollbars) {
          out +=
            '.sidebar-scroll,.emoji-picker-scroll{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 45%,transparent) transparent}' +
            '.sidebar-scroll::-webkit-scrollbar,.emoji-picker-scroll::-webkit-scrollbar{width:8px}' +
            '.sidebar-scroll::-webkit-scrollbar-track,.emoji-picker-scroll::-webkit-scrollbar-track{background:transparent}' +
            '.sidebar-scroll::-webkit-scrollbar-thumb,.emoji-picker-scroll::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--accent) 35%,transparent);border-radius:8px}' +
            '.sidebar-scroll::-webkit-scrollbar-thumb:hover,.emoji-picker-scroll::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--accent) 60%,transparent)}';
        }
        ctx.css(out);
      };
      css();
      ctx.cleanup(ctx.settings.onChange(css));
    },
  });
})();
