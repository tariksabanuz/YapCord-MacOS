

(function () {
  YM.definePlugin({
    name: 'RoleReorderConfirm',
    description: 'Asks "are you sure?" before a dragged role reorder in Server Settings -> Roles is actually saved - so a drag triggered by accident while scrolling (easy on a touch screen) does not quietly go through.',
    authors: ['YapCord'],
    tags: ['Servers', 'Utility'],
    alwaysOn: true,
    options: {
      confirm: { type: 'boolean', default: true, description: 'Ask before a role reorder is saved' },
    },
    start(ctx) {
      let stopped = false;
      ctx.cleanup(() => { stopped = true; });

      YM.finder.waitFor(['reorderRoles']).then((mod) => {
        if (!mod || stopped) return;
        const real = mod.reorderRoles.bind(mod);
        const wrapped = function (...args) {
          if (!ctx.settings.store.confirm) return real(...args);
          return new Promise((resolve) => {
            let decided = false;
            const { el } = YM.modal.open({
              title: 'Reorder roles?',
              subtitle: 'Make sure this was on purpose - a drag on a touch screen while scrolling through the list can trigger this by accident.',
              buttons: [
                { label: 'Yes, reorder', onClick: (close) => { decided = true; close(); resolve(real(...args)); } },
              ],
            });

            const obs = new MutationObserver(() => {
              if (el.isConnected) return;
              obs.disconnect();
              if (!decided) resolve(undefined);
            });
            obs.observe(document.body, { childList: true });
          });
        };

        let patched = true;
        try {
          mod.reorderRoles = wrapped;
        } catch (err) {
          try {
            Object.defineProperty(mod, 'reorderRoles', { value: wrapped, writable: true, configurable: true, enumerable: true });
          } catch (err2) {
            patched = false;
            ctx.log.warn("could not install the reorder confirmation - Yapper's own reorderRoles export is frozen in this build, so real reorders go through unconfirmed", err2);
          }
        }
        if (patched) ctx.cleanup(() => { if (mod.reorderRoles === wrapped) mod.reorderRoles = real; });
      }).catch((err) => ctx.log.error('reorderRoles lookup failed', err));
    },
  });
})();
