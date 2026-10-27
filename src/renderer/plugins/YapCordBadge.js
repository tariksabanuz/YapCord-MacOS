

(function () {

  const MARK = '​‌​‍';
  const MAX_BIO = 190;

  function hasMark(profile) {
    return !!(profile && typeof profile.bio === 'string' && profile.bio.includes(MARK));
  }

  const plugin = YM.definePlugin({
    name: 'YapCordBadge',
    description:
      "Lets YapCord users spot each other: adds an invisible marker to your own bio, and shows a small badge next to anyone else's name whose bio carries the same marker. No toggle - it only works both ways.",
    authors: ['YapCord'],
    tags: ['Social'],
    alwaysOn: true,
    options: {

      lastStatus: { type: 'string', default: '', description: 'Set automatically - whether the marker could be added to your bio.' },
    },

    async start(ctx) {
      const S = YM.Store;
      await S.ready;
      if (!YM.plugins.isRunning('YapCordBadge')) return;

      let cachedSaveProfile = null;
      async function getSaveProfile() {
        if (cachedSaveProfile) return cachedSaveProfile;
        const mod = await YM.finder.waitFor(['saveProfile'], { timeout: 15000 });
        if (mod && mod.saveProfile) cachedSaveProfile = mod.saveProfile;
        return cachedSaveProfile;
      }
      let status = 'Checking your bio…';

      function setStatus(text) {
        status = text;
        try { ctx.settings.set('lastStatus', text); } catch (err) { ctx.log.debug('could not persist lastStatus', err); }
      }

      async function ensureMarked() {
        const saveProfile = await getSaveProfile();
        if (!saveProfile) {
          setStatus("Couldn't find Yapper's profile-save function (it may have changed in an update) - nothing was written.");
          return;
        }
        const me = S.me();
        if (!me) {
          setStatus('Not signed in yet.');
          return;
        }
        const bio = typeof me.bio === 'string' ? me.bio : '';
        if (bio.includes(MARK)) {
          setStatus('Your bio already carries the marker - other YapCord users can see it.');
          return;
        }
        if (bio.length + MARK.length > MAX_BIO) {
          setStatus(`Your bio is too full to add the marker without cutting off what you wrote (bios are capped at ${MAX_BIO} characters) - free up a few characters, then retry (YM.plugins.get('YapCordBadge').api.retry() in DevTools).`);
          return;
        }
        try {
          await saveProfile({ username: me.username, bio: bio + MARK, banner_x: me.banner_x, banner_y: me.banner_y });
          setStatus('Added - your bio now carries the marker.');
          YM.messages.refresh();
        } catch (err) {
          ctx.log.warn('could not add the YapCord marker to the bio', err);
          setStatus("Couldn't save that just now - try again later.");
        }
      }

      await ensureMarked();

      ctx.css(
        '.ym-yb-badge{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;' +
        'margin-left:5px;border-radius:50%;flex:0 0 auto;' +
        'background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 85%,#fff),var(--accent) 55%,color-mix(in srgb,var(--accent) 70%,#000));' +
        'color:#fff;font-size:9px;font-weight:800;line-height:1;vertical-align:middle;' +
        'box-shadow:0 1px 3px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.35);' +
        'transition:transform 160ms cubic-bezier(.34,1.56,.64,1)}' +
        '@media (prefers-reduced-motion:no-preference){.ym-yb-badge:hover{transform:scale(1.25)}}',
      );
      const h = YM.dom.h;
      ctx.cleanup(YM.messages.decorate(({ el, id }) => {
        const msg = S.findMessage(id);
        const authorId = msg && msg.author_id;
        const head = el.querySelector(':scope > .msg-body > .msg-head');
        if (!head) return;
        const author = head.querySelector(':scope > .msg-author');
        const existing = head.querySelector(':scope > .ym-yb-badge');
        const show = !!authorId && hasMark(S.profile(authorId));
        if (show && !existing && author) author.after(h('span', { class: 'ym-yb-badge', title: 'Also uses YapCord' }, 'Y'));
        else if (show && !existing && !author) head.append(h('span', { class: 'ym-yb-badge', title: 'Also uses YapCord' }, 'Y'));
        else if (!show && existing) existing.remove();
      }));

      ctx.on('store:change', (next, prev) => {
        if (next.profiles !== prev.profiles) YM.messages.refresh();
      });

      plugin.api = {
        statusText: () => status,
        retry: ensureMarked,
        async removeFromBio() {
          const saveProfile = await getSaveProfile();
          const me = S.me();
          if (!saveProfile || !me) return;
          const bio = typeof me.bio === 'string' ? me.bio : '';
          if (!bio.includes(MARK)) {
            setStatus('Nothing to remove - your bio has no marker.');
            return;
          }
          try {
            await saveProfile({ username: me.username, bio: bio.split(MARK).join(''), banner_x: me.banner_x, banner_y: me.banner_y });
            setStatus('Removed - your bio no longer carries the marker.');
            YM.messages.refresh();
          } catch (err) {
            ctx.log.warn('could not remove the YapCord marker from the bio', err);
            setStatus("Couldn't remove it just now - try again in a moment.");
          }
        },
      };
      ctx.cleanup(() => {
        document.querySelectorAll('.ym-yb-badge').forEach((n) => n.remove());
        plugin.api = null;
      });
    },
  });
})();
