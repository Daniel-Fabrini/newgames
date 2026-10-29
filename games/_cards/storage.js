// Helpers over ctx.store (namespaced JSON store with get/set/remove).
//
//   const save = createMatchSave(ctx.store, 'match', { version: 1, validate: (s) => Array.isArray(s.players) });
//   save.save(state); const s = save.load() /* → state | null */; save.clear(); save.exists();
//
//   const stats = createStats(ctx.store, 'stats', { historyMax: 20, better: (a, b) => a > b });
//   stats.record({ result:'win'|'loss'|'draw', score: 120, extra: {...} }); stats.get();
//   → { games, wins, losses, draws, best, streak, bestStreak, history:[{t,result,score,...}] }

export function createMatchSave(store, key, { version = 1, validate = null } = {}) {
  return {
    save(state) {
      try {
        store.set(key, { v: version, savedAt: Date.now(), state });
        return true;
      } catch {
        return false;
      }
    },
    load() {
      try {
        const raw = store.get(key, null);
        if (!raw || raw.v !== version || !raw.state) return null;
        if (validate && !validate(raw.state)) {
          store.remove(key);
          return null;
        }
        return raw.state;
      } catch {
        return null;
      }
    },
    savedAt() {
      const raw = store.get(key, null);
      return raw && raw.v === version ? raw.savedAt : null;
    },
    exists() {
      return this.load() !== null;
    },
    clear() {
      store.remove(key);
    },
  };
}

const EMPTY = () => ({ games: 0, wins: 0, losses: 0, draws: 0, best: null, streak: 0, bestStreak: 0, history: [] });

export function createStats(store, key, { historyMax = 20, better = (a, b) => a > b } = {}) {
  const read = () => {
    const s = store.get(key, null);
    return s && typeof s === 'object' ? { ...EMPTY(), ...s, history: Array.isArray(s.history) ? s.history : [] } : EMPTY();
  };
  return {
    get: read,
    /** entry: { result:'win'|'loss'|'draw', score?:number, ...anything JSON } */
    record(entry) {
      const s = read();
      const result = entry.result === 'win' || entry.result === 'loss' || entry.result === 'draw' ? entry.result : 'draw';
      s.games++;
      if (result === 'win') {
        s.wins++;
        s.streak = s.streak > 0 ? s.streak + 1 : 1;
      } else if (result === 'loss') {
        s.losses++;
        s.streak = s.streak < 0 ? s.streak - 1 : -1;
      } else {
        s.draws++;
        s.streak = 0;
      }
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      if (typeof entry.score === 'number' && (s.best === null || better(entry.score, s.best))) s.best = entry.score;
      s.history.push({ t: Date.now(), ...entry, result });
      if (s.history.length > historyMax) s.history.splice(0, s.history.length - historyMax);
      store.set(key, s);
      return s;
    },
    reset() {
      store.remove(key);
    },
  };
}
