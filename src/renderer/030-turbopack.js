

const T = (YM.turbo = {
  ctx: null,
  chunksSeen: 0,
  factoriesWrapped: 0,
  runtimeAttached: false,
  hookInstalled: false,
});
const ctxReady = YM.deferred();
T.ready = ctxReady.promise;

function setCtx(ctx) {
  if (T.ctx) return;
  T.ctx = ctx;
  ctxReady.resolve(ctx);
  YM.Events.emit('turbo:ready', ctx);
}

function idsBefore(list, i) {
  const ids = [];
  for (let j = i - 1; j >= 0; j--) {
    const v = list[j];
    if (typeof v === 'number' || (typeof v === 'string' && j > 0)) ids.unshift(v);
    else break;
  }
  return ids;
}

function wrapFactory(orig, ids) {
  const wrapped = function (ctx, mod, exp) {
    if (!T.ctx && ctx && ctx.M instanceof Map) setCtx(ctx);
    let fn = orig;
    if (YM.patches && YM.patches.active()) {
      try {
        fn = YM.patches.apply(orig, ids) || orig;
      } catch (err) {
        YM.log.error('patching module failed', ids, err);
      }
    }
    return fn.apply(this, arguments);
  };
  wrapped.__ym = true;
  wrapped.__orig = orig;
  wrapped.__ids = ids;
  T.factoriesWrapped++;
  return wrapped;
}

function wrapList(list, start) {
  for (let i = start; i < list.length; i++) {
    const item = list[i];
    if (Array.isArray(item)) wrapList(item, 0);
    else if (typeof item === 'function' && !item.__ym) list[i] = wrapFactory(item, idsBefore(list, i));
  }
}

function wrapChunk(chunk) {
  T.chunksSeen++;
  if (Array.isArray(chunk)) {
    try {
      wrapList(chunk, 1);
    } catch (err) {
      YM.log.error('could not wrap chunk', err);
    }
  }
}

function install() {
  if (T.hookInstalled) return;
  const g = globalThis;
  if (g.TURBOPACK && !Array.isArray(g.TURBOPACK) && typeof g.TURBOPACK.push === 'function') {

    const real = g.TURBOPACK.push;
    g.TURBOPACK.push = function (...chunks) {
      chunks.forEach(wrapChunk);
      return real.apply(this, chunks);
    };
    T.hookInstalled = true;
    T.late = true;
    return;
  }

  const pre = Array.isArray(g.TURBOPACK) ? g.TURBOPACK : [];
  pre.forEach(wrapChunk);
  const origPush = Array.prototype.push;
  Object.defineProperty(pre, 'push', {
    configurable: true,
    writable: true,
    enumerable: false,
    value: function (...chunks) {
      chunks.forEach(wrapChunk);
      return origPush.apply(this, chunks);
    },
  });

  let current = pre;
  Object.defineProperty(g, 'TURBOPACK', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set(v) {
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.push === 'function') {

        const real = v.push;
        T.runtimeAttached = true;
        current = {
          push(...chunks) {
            chunks.forEach(wrapChunk);
            return real.apply(v, chunks);
          },
        };
      } else {
        current = v;
      }
    },
  });
  T.hookInstalled = true;
}

try {
  install();
} catch (err) {
  YM.log.error('Turbopack hook failed to install', err);
}

const srcCache = new Map();
const failed = new Map();
const found = new Map();

function hasKeys(ex, names) {
  if (!ex || (typeof ex !== 'object' && typeof ex !== 'function')) return false;
  try {
    for (const n of names) if (!Object.prototype.hasOwnProperty.call(ex, n)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function factorySource(id, factory) {
  let s = srcCache.get(id);
  if (s === undefined) {
    try {
      s = (factory.__orig || factory).toString();
    } catch (_) {
      s = '';
    }
    srcCache.set(id, s);
  }
  return s;
}

const Finder = (YM.finder = {

  findLoaded(names) {
    const ctx = T.ctx;
    if (!ctx || !(ctx.c instanceof Map)) return null;
    for (const rec of ctx.c.values()) {
      if (!rec || rec.error) continue;
      const ex = rec.exports;
      if (hasKeys(ex, names)) return ex;
    }
    return null;
  },

  findIdsBySource(strings, limit = 10) {
    const ctx = T.ctx;
    if (!ctx || !(ctx.M instanceof Map)) return [];
    const out = [];
    for (const [id, factory] of ctx.M) {
      if (typeof factory !== 'function') continue;
      const src = factorySource(id, factory);
      if (strings.every((s) => src.includes(s))) {
        out.push(id);
        if (out.length >= limit) break;
      }
    }
    return out;
  },

  getSource(id) {
    const f = T.ctx && T.ctx.M.get(id);
    return f ? factorySource(id, f) : '';
  },

  require(id) {
    if (!T.ctx) throw new Error('Turbopack context not captured yet');
    return T.ctx.r(id);
  },

  findExports(names) {
    const key = names.join('|');
    const cached = found.get(key);
    if (cached) return cached;
    let ex = Finder.findLoaded(names);
    if (!ex && T.ctx) {
      const quoted = names.map((n) => '"' + n + '"');
      for (const id of Finder.findIdsBySource(quoted, 20)) {
        const last = failed.get(id);
        if (last && Date.now() - last < 2000) continue;
        try {
          const candidate = T.ctx.r(id);
          if (hasKeys(candidate, names)) {
            ex = candidate;
            break;
          }
        } catch (err) {
          failed.set(id, Date.now());
          YM.log.debug('could not instantiate module', id, err);
        }
      }
    }
    if (ex) found.set(key, ex);
    return ex || null;
  },

  waitFor(names, { timeout = 0, interval = 250 } = {}) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        let ex = null;
        try {
          ex = Finder.findExports(names);
        } catch (err) {
          YM.log.debug('finder error', err);
        }
        if (ex) return resolve(ex);
        if (timeout && Date.now() - t0 > timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  },

  lazy(names) {
    let ex = null;
    return () => ex || (ex = Finder.findExports(names));
  },

  stats() {
    const ctx = T.ctx;
    return {
      hookInstalled: T.hookInstalled,
      runtimeAttached: T.runtimeAttached,
      ctxCaptured: !!ctx,
      chunksSeen: T.chunksSeen,
      factoriesWrapped: T.factoriesWrapped,
      factories: ctx && ctx.M ? ctx.M.size : 0,
      instantiated: ctx && ctx.c ? ctx.c.size : 0,
      lateInjection: !!T.late,
    };
  },
});
