// Tiny persistent key/value store on top of localStorage. Every call is
// wrapped in try/catch because storage can be unavailable (private mode,
// sandboxed previews); the in-memory map keeps the session working anyway.

const memory = new Map();

function safeGet(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return memory.get(k);
  }
}

function safeSet(k, v) {
  memory.set(k, v);
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable — memory copy is enough for this session */
  }
}

function safeRemove(k) {
  memory.delete(k);
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

const PREFIX = 'ng:';

export function createStore(namespace) {
  const key = (k) => `${PREFIX}${namespace}:${k}`;
  return {
    get(k, fallback = null) {
      const v = safeGet(key(k));
      return v === undefined ? (memory.has(key(k)) ? memory.get(key(k)) : fallback) : v;
    },
    set(k, v) {
      safeSet(key(k), v);
    },
    remove(k) {
      safeRemove(key(k));
    },
    // Read-modify-write helper: store.update('stats', s => ({...s, wins: s.wins + 1}), {wins: 0})
    update(k, fn, fallback = null) {
      const next = fn(this.get(k, fallback));
      this.set(k, next);
      return next;
    },
  };
}

// Removes every key of the app (or of one namespace).
export function clearAll(namespace = '') {
  const prefix = PREFIX + (namespace ? namespace + ':' : '');
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
