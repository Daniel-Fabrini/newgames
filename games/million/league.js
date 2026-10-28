// Weekly league: 15 players (you + 14 simulated rivals) per division. The
// rivals' scores grow through the calendar week; on Monday the week closes,
// the top 3 move up, the bottom 3 move down (never below Bronze).

import { rng, shuffle } from '../../js/core/ui.js';

export const LEAGUE_SIZE = 15;
export const PROMOTE = 3;
export const RELEGATE = 3;
const DAY = 86400000;

const NAMES = [
  'Ana Paula', 'Bruno S.', 'Carla M.', 'Dudu', 'Fernanda R.', 'Gabriel L.', 'Helena', 'Igor T.', 'Juliana', 'Kaique',
  'Larissa F.', 'Marcos V.', 'Natália', 'Otávio', 'Paulinha', 'Rafael C.', 'Sofia B.', 'Thiago', 'Vitória', 'Wagner',
  'Yasmin', 'Zeca', 'Lúcia', 'Pedro H.', 'Bia', 'Caio N.', 'Duda', 'Enzo', 'Lara', 'Miguel A.',
  'Nina', 'Renata', 'Samuel', 'Tati', 'Valentina', 'Diego M.', 'Camila', 'Lucas G.', 'Mariana', 'Joaquín',
  'Sebastián', 'Martina', 'Emily', 'Jack W.', 'Olivia', 'Mateo', 'Isabela', 'Gustavo', 'Priscila', 'Rodrigo',
];
const COLORS = ['#e8505b', '#f39c3d', '#f3c24a', '#3bceac', '#4d96ff', '#9b6bff', '#ff6fb1', '#2fd27a', '#5ac8fa', '#c97b4a'];

const BASE = [260, 420, 650, 950, 1350, 1850];
export const divBase = (idx) => (idx < BASE.length ? BASE[idx] : Math.round(BASE[BASE.length - 1] * Math.pow(1.22, idx - BASE.length + 1)));

// Monday 00:00 (local time) of the week containing `date`.
export function weekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d;
}

export function weekKey(date = new Date()) {
  const s = weekStart(date);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

export function weekFraction(now = new Date()) {
  const s = weekStart(now).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - s) / (7 * DAY)));
}

export function timeLeft(now = new Date()) {
  const end = weekStart(now);
  end.setDate(end.getDate() + 7);
  return Math.max(0, end.getTime() - now.getTime());
}

export function makeRivals(seed, div) {
  const r = rng(seed);
  const base = divBase(div);
  return shuffle(NAMES, r)
    .slice(0, LEAGUE_SIZE - 1)
    .map((name, i) => {
      const skill = r();
      return {
        name,
        color: COLORS[(i + Math.floor(r() * 10)) % COLORS.length],
        target: Math.round((base * (0.3 + 1.45 * Math.pow(skill, 1.3)) * (0.85 + r() * 0.3)) / 10) * 10,
        shape: 0.65 + r() * 0.9,
        chunk: 30 + Math.floor(r() * 60),
      };
    });
}

// Points a rival has at a fraction of the week, in game-sized chunks.
export function rivalPoints(rv, frac) {
  if (frac >= 1) return rv.target;
  const p = rv.target * Math.pow(Math.max(0, frac), rv.shape);
  return Math.floor(p / rv.chunk) * rv.chunk;
}

export function standings(state, frac) {
  const rows = makeRivals(state.seed, state.div).map((rv) => ({ name: rv.name, color: rv.color, pts: rivalPoints(rv, frac), me: false }));
  rows.push({ name: null, color: '#f3c24a', pts: state.pts, me: true });
  // Ties: you rank above rivals (you earned it this week).
  rows.sort((a, b) => b.pts - a.pts || (a.me ? -1 : b.me ? 1 : 0));
  return rows.map((row, i) => ({ ...row, pos: i + 1 }));
}

const freshWeek = (key, div) => ({ week: key, div, pts: 0, games: 0, seed: (Math.random() * 2 ** 31) >>> 0 });

export function rewardFor(pos, div) {
  const base = pos === 1 ? 200 : pos === 2 ? 140 : pos === 3 ? 100 : pos <= 7 ? 50 : pos <= 12 ? 25 : 10;
  return Math.round(base * (1 + 0.25 * div));
}

// Loads the league, closing the stored week if a new one has started.
// Returns { state, closed } where closed describes last week's result.
export function loadLeague(store, now = new Date()) {
  const key = weekKey(now);
  let state = store.get('league', null);
  let closed = null;
  if (!state || typeof state !== 'object' || typeof state.div !== 'number') {
    state = { ...freshWeek(key, 0), best: 0 };
    store.set('league', state);
    return { state, closed };
  }
  if (state.week !== key) {
    const rows = standings(state, 1);
    const pos = rows.find((r) => r.me).pos;
    let div = state.div;
    let result = 'stay';
    if (state.games === 0) result = 'idle';
    else if (pos <= PROMOTE) {
      div++;
      result = 'up';
    } else if (pos > LEAGUE_SIZE - RELEGATE && div > 0) {
      div--;
      result = 'down';
    }
    const reward = state.games > 0 ? rewardFor(pos, state.div) : 0;
    closed = { pos, from: state.div, to: div, result, reward, pts: state.pts };
    state = { ...freshWeek(key, div), best: Math.max(state.best || 0, div) };
    store.set('league', state);
  }
  return { state, closed };
}

export function addLeagueGame(store, pts) {
  const { state } = loadLeague(store);
  state.pts += pts;
  state.games += 1;
  store.set('league', state);
  return state;
}

// League points for one game: 10 per correct answer + milestone bonuses.
export function matchPoints(correct) {
  let pts = correct * 10;
  if (correct >= 5) pts += 25;
  if (correct >= 10) pts += 60;
  if (correct >= 15) pts += 150;
  if (correct >= 16) pts += 400;
  return pts;
}
