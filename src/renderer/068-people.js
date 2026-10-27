

const people = (YM.people = {});
const lazyNames = YM.finder.lazy(['nameColor', 'colorRole', 'nameStyle', 'displayName']);
const lazyUrl = YM.finder.lazy(['publicUrl']);

people.nameColor = (userId, serverId) => {
  const mod = lazyNames();
  const s = YM.Store.getState();
  if (!mod || !s || !userId) return null;
  try {
    return mod.nameColor(s, serverId, userId) || null;
  } catch (_) {
    return null;
  }
};

people.colorRole = (userId, serverId) => {
  const mod = lazyNames();
  const s = YM.Store.getState();
  if (!mod || !s || !userId) return null;
  try {
    return mod.colorRole(s, serverId, userId) || null;
  } catch (_) {
    return null;
  }
};

people.avatarUrl = (profile) => {
  const mod = lazyUrl();
  return profile && profile.avatar_path && mod ? mod.publicUrl('avatars', profile.avatar_path) || null : null;
};

people.byName = (name) => {
  const s = YM.Store.getState();
  if (!s || !name) return null;
  const want = String(name).trim().replace(/^@/, '').toLowerCase();
  if (!want) return null;
  const all = Object.values(s.profiles || {});
  const byUser = all.filter((p) => p && String(p.username || '').toLowerCase() === want);
  if (byUser.length === 1) return byUser[0];
  const byDisplay = all.filter((p) => p && String(p.display_name || '').toLowerCase() === want);
  return byDisplay.length === 1 ? byDisplay[0] : null;
};

people.currentServerId = () => {
  const s = YM.Store.getState();
  if (!s) return null;
  const ch = s.channels[s.activeChannelId];
  return (ch && ch.server_id) || s.activeServerId || null;
};

people.serverIdOf = (el) => {
  const s = YM.Store.getState();
  const servers = (s && s.servers) || {};
  for (const k in el) {
    if (!k.startsWith('__reactFiber$')) continue;
    const fiber = el[k];
    const kids = fiber && fiber.memoizedProps && fiber.memoizedProps.children;
    for (const kid of Array.isArray(kids) ? kids : [kids]) {
      const sv = kid && kid.props && kid.props.server;
      if (sv && sv.id) return sv.id;
    }
    for (let c = fiber && fiber.child, depth = 0; c && depth < 3; c = c.child, depth++) {
      const sv = c.memoizedProps && c.memoizedProps.server;
      if (sv && sv.id) return sv.id;
    }
  }
  const row = el.closest && el.closest('[data-rail-row]');
  if (row && row.dataset.railRow && servers[row.dataset.railRow]) return row.dataset.railRow;
  const title = el.getAttribute && (el.getAttribute('title') || el.getAttribute('aria-label'));
  if (title) {
    const same = Object.values(servers).filter((sv) => sv && sv.name === title);
    if (same.length === 1) return same[0].id;
  }
  return null;
};
