// Foosball — 8-team knockout bracket logic (pure, serialisable).
import { mulberry } from './physics.js';

export const TEAMS = [
  { id: 'fal', color: '#2f7be4', skill: 0.2, name: { pt: 'Falcões Azuis', en: 'Blue Falcons', es: 'Halcones Azules' } },
  { id: 'lob', color: '#7c8aa5', skill: 0.3, name: { pt: 'Lobos do Norte', en: 'Northern Wolves', es: 'Lobos del Norte' } },
  { id: 'dra', color: '#2fa84f', skill: 0.4, name: { pt: 'Dragões Verdes', en: 'Green Dragons', es: 'Dragones Verdes' } },
  { id: 'cor', color: '#8a5ad6', skill: 0.5, name: { pt: 'Corujas Roxas', en: 'Violet Owls', es: 'Búhos Violetas' } },
  { id: 'tig', color: '#f08a1c', skill: 0.6, name: { pt: 'Tigres Laranja', en: 'Orange Tigers', es: 'Tigres Naranja' } },
  { id: 'tub', color: '#1fb5c9', skill: 0.7, name: { pt: 'Tubarões do Mar', en: 'Sea Sharks', es: 'Tiburones del Mar' } },
  { id: 'urs', color: '#f2f2f2', skill: 0.8, name: { pt: 'Ursos Polares', en: 'Polar Bears', es: 'Osos Polares' } },
];
export const YOU = { id: 'you', color: '#e4372f', skill: 0.5, name: { pt: 'Você', en: 'You', es: 'Tú' } };
export const ROUNDS = ['qf', 'sf', 'final'];

/** New tournament: player + 7 teams drawn at random into a bracket. */
export function createTournament(seed = 1, diff = 0.5) {
  const rnd = mulberry(seed * 131 + 9);
  const ids = [YOU.id, ...TEAMS.map((t) => t.id)];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const mk = (a, b) => ({ a, b, ga: null, gb: null, winner: null });
  const tr = {
    seed,
    diff,
    round: 0,
    teams: ids,
    rounds: [
      [mk(ids[0], ids[1]), mk(ids[2], ids[3]), mk(ids[4], ids[5]), mk(ids[6], ids[7])],
      [mk(null, null), mk(null, null)],
      [mk(null, null)],
    ],
    champion: null,
    eliminated: false,
    rngState: Math.floor(rnd() * 1e9),
  };
  simulateOthers(tr);
  return tr;
}

export const teamOf = (id) => (id === YOU.id ? YOU : TEAMS.find((t) => t.id === id) || null);

/** The player's pending match in the current round, or null (eliminated / finished). */
export function playerMatch(tr) {
  if (tr.eliminated || tr.champion) return null;
  const m = tr.rounds[tr.round]?.find((x) => (x.a === YOU.id || x.b === YOU.id) && !x.winner);
  return m || null;
}

/** AI difficulty (0..1) for an opponent in this tournament round. Rises with the round. */
export function opponentSkill(tr, oppId) {
  const t = teamOf(oppId);
  const roundBoost = [0, 0.1, 0.18][tr.round] || 0;
  const d = (tr.diff - 0.5) * 0.5;
  return Math.max(0.05, Math.min(1, (t ? t.skill : 0.5) * 0.8 + 0.1 + roundBoost + d));
}

function simScore(rnd, sa, sb, goals = 5) {
  // first to `goals`; each goal goes to A with probability weighted by relative skill
  const pa = 0.5 + (sa - sb) * 0.55;
  let a = 0, b = 0;
  while (a < goals && b < goals) (rnd() < pa ? a++ : b++);
  return [a, b];
}

function advance(tr) {
  const cur = tr.rounds[tr.round];
  if (!cur.every((m) => m.winner)) return;
  if (tr.round === 2) {
    tr.champion = cur[0].winner;
    if (tr.champion !== YOU.id) tr.eliminated = true;
    return;
  }
  const next = tr.rounds[tr.round + 1];
  next.forEach((m, i) => {
    m.a = cur[i * 2].winner;
    m.b = cur[i * 2 + 1].winner;
  });
  tr.round++;
  simulateOthers(tr);
}

/** Simulate every match of the current round that does not involve the player. */
export function simulateOthers(tr) {
  const rnd = mulberry(tr.rngState + tr.round * 17);
  for (const m of tr.rounds[tr.round]) {
    if (m.winner || m.a === YOU.id || m.b === YOU.id) continue;
    const [ga, gb] = simScore(rnd, teamOf(m.a).skill, teamOf(m.b).skill);
    m.ga = ga; m.gb = gb;
    m.winner = ga > gb ? m.a : m.b;
  }
  tr.rngState = Math.floor(rnd() * 1e9);
  advance(tr);
}

/** Record the player's result (scores from the player's point of view). */
export function reportPlayer(tr, goalsYou, goalsOpp, youWon) {
  const m = playerMatch(tr);
  if (!m) return false;
  const youA = m.a === YOU.id;
  m.ga = youA ? goalsYou : goalsOpp;
  m.gb = youA ? goalsOpp : goalsYou;
  m.winner = youWon ? YOU.id : youA ? m.b : m.a;
  if (!youWon) tr.eliminated = true;
  advance(tr);
  return true;
}

/** Play out everything once the player is out (so the final is known). */
export function finishAll(tr) {
  let guard = 6;
  while (!tr.champion && guard-- > 0) {
    simulateOthers(tr);
    if (tr.eliminated) continue;
    if (playerMatch(tr)) break;
  }
  return tr;
}

export function opponentOf(tr) {
  const m = playerMatch(tr);
  if (!m) return null;
  return m.a === YOU.id ? m.b : m.a;
}
