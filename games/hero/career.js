// Ball Hero — career structure: clubs, divisions, seasons, story beats,
// opponents and trophies. All club names are invented.

import { COUNTRIES } from '../../js/data/countries.js';
import { careerMoment, HAND } from './levels.js';

export const SEASON_LEN = 10;

export const CLUBS = [
  { id: 'ventura', name: 'Ventura FC', short: 'VEN', colors: ['#2f9e44', '#ffffff'], tier: 4 },
  { id: 'portobelo', name: 'Atlético Portobelo', short: 'ATP', colors: ['#1f5fd6', '#ffffff'], tier: 2 },
  { id: 'aurora', name: 'Real Aurora', short: 'RAU', colors: ['#f3c24a', '#141414'], tier: 1 },
  { id: 'capital', name: 'Dínamo Capital', short: 'DCA', colors: ['#b3122e', '#f5f5f5'], tier: 1 },
  { id: 'kingsbridge', name: 'Kingsbridge Rovers', short: 'KBR', colors: ['#6a1b9a', '#ffd54f'], tier: 0 },
  { id: 'montebello', name: 'Montebello Calcio', short: 'MTB', colors: ['#0d47a1', '#111111'], tier: 0 },
  { id: 'valdoro', name: 'Real Valdoro', short: 'RVD', colors: ['#f4f4f6', '#c9a227'], tier: 0 },
  { id: 'rheinstahl', name: 'Rheinstahl 04', short: 'RHS', colors: ['#d32f2f', '#212121'], tier: 0 },
  { id: 'lumiere', name: 'Olympique Lumière', short: 'OLU', colors: ['#00acc1', '#ffffff'], tier: 0 },
];

// Opponent clubs by tier (invented).
const OPP = {
  4: ['Atlético Serrano', 'União Litoral', 'Esporte Vila Rica', 'Pedra Alta FC', 'Sport Lagoa Funda', 'Campo Belo EC', 'Rio Dourado AC', 'Cruzeiro do Vale'],
  2: ['Sporting Brisamar', 'Inter Monteverde', 'Racing Sol Nascente', 'União Serra Azul', 'Olímpico Ventania', 'Atlético Barra Clara', 'Grêmio Estrela', 'Leões do Planalto'],
  1: ['Dínamo Capital', 'Real Aurora', 'Olímpico Imperial', 'Inter Vale Dourado', 'Athletic Porto Bravo', 'Racing Metrópole', 'Sporting Atlântico', 'Corsários FC'],
  0: ['Kingsbridge Rovers', 'Montebello Calcio', 'Real Valdoro', 'Rheinstahl 04', 'Olympique Lumière', 'AC Serenissima', 'Northgate United', 'Sporting Alvorada', 'Dynamo Borealis', 'Ajaxburg'],
};
const RIVAL = { ventura: 'Atlético Serrano', portobelo: 'Sporting Brisamar', aurora: 'Dínamo Capital', capital: 'Real Aurora', kingsbridge: 'Northgate United', montebello: 'AC Serenissima', valdoro: 'Sporting Alvorada', rheinstahl: 'Dynamo Borealis', lumiere: 'Ajaxburg' };

// Season → club. After the hand-made path the hero moves between elite clubs.
export function clubForSeason(s) {
  if (s < 4) return CLUBS[s];
  const elite = [4, 5, 6, 7, 8];
  const block = Math.floor((s - 4) / 2);
  return CLUBS[elite[block % elite.length]];
}

export function divisionKey(tier) {
  return 'div' + tier;
}

// Competition trophy won by the final of season s.
export function seasonTrophy(s) {
  if (s === 0) return 'regionalCup';
  if (s === 1) return 'nationalCup';
  if (s === 2) return 'league';
  if (s === 3) return 'continental';
  return ['eliteLeague', 'continental', 'superCup', 'clubWorld'][(s - 4) % 4];
}

// International moments: level indices inside a season (from season 3 on).
export function intlInfo(i) {
  const s = Math.floor(i / SEASON_LEN);
  const k = i % SEASON_LEN;
  if (i >= HAND.length) {
    if (k === 4 || k === 5) return { final: k === 5, trophy: s % 2 ? 'nationsCup' : 'worldChamp' };
    return null;
  }
  const L = HAND[i];
  return L.comp === 'intl' ? { final: false } : null;
}

const NATIONS = COUNTRIES.filter((c) => c.level === 1 && c.independent);

export function opponentFor(i, heroCountry) {
  const intl = intlInfo(i);
  if (intl) {
    const pool = NATIONS.filter((c) => c.code !== heroCountry);
    return { kind: 'nation', country: pool[(i * 37 + 11) % pool.length] };
  }
  const s = Math.floor(i / SEASON_LEN);
  const club = clubForSeason(s);
  const lvl = i < HAND.length ? HAND[i] : null;
  if (lvl && (lvl.story === 'derby' || lvl.story === 'bigDerby')) return { kind: 'club', name: RIVAL[club.id] };
  const pool = OPP[club.tier].filter((n) => n !== club.name);
  return { kind: 'club', name: pool[(i * 7 + s * 3) % pool.length] };
}

// The story card shown before a level (or null).
export function storyFor(i) {
  const s = Math.floor(i / SEASON_LEN);
  const k = i % SEASON_LEN;
  if (i < HAND.length) {
    const L = HAND[i];
    if (L.story) return { key: L.story };
    return null;
  }
  if (k === 0) {
    const prev = clubForSeason(s - 1);
    const cur = clubForSeason(s);
    return { key: prev.id !== cur.id ? 'transfer' : 'seasonStart' };
  }
  if (k === 4) return { key: 'intlWindow' };
  if (k === 5) return { key: 'intlFinal' };
  if (k === 9) return { key: 'final' };
  if (k === 7) return { key: 'derbyGen' };
  return null;
}

export function levelMeta(i, heroCountry) {
  const s = Math.floor(i / SEASON_LEN);
  const k = i % SEASON_LEN;
  const club = clubForSeason(s);
  const intl = intlInfo(i);
  const final = k === SEASON_LEN - 1;
  return {
    i,
    season: s,
    k,
    club,
    intl,
    final,
    trophy: final ? seasonTrophy(s) : intl && intl.final ? intl.trophy : null,
    opp: opponentFor(i, heroCountry),
    story: storyFor(i),
    ...careerMoment(i),
  };
}

// ------------------------------------------------------------------ kits
const OPP_KITS = [
  { shirt: '#d7263d', shirt2: '#ffffff', shorts: '#ffffff', socks: '#d7263d' },
  { shirt: '#1f5fd6', shirt2: '#ffffff', shorts: '#0d2a6b', socks: '#1f5fd6' },
  { shirt: '#f4f4f6', shirt2: '#1b1b1f', shorts: '#1b1b1f', socks: '#f4f4f6' },
  { shirt: '#1b1b1f', shirt2: '#e9e9ee', shorts: '#1b1b1f', socks: '#1b1b1f' },
  { shirt: '#2f9e44', shirt2: '#ffffff', shorts: '#ffffff', socks: '#2f9e44' },
  { shirt: '#ff7a1a', shirt2: '#1b1b1f', shorts: '#1b1b1f', socks: '#ff7a1a' },
  { shirt: '#6a1b9a', shirt2: '#ffd54f', shorts: '#6a1b9a', socks: '#6a1b9a' },
  { shirt: '#7fc8ff', shirt2: '#ffffff', shorts: '#ffffff', socks: '#7fc8ff' },
  { shirt: '#7a1630', shirt2: '#f3c24a', shorts: '#7a1630', socks: '#7a1630' },
];

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDist(a, b) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

export function opponentKit(seed, ours) {
  const order = OPP_KITS.map((k, j) => ({ k, j: (j * 5 + seed) % OPP_KITS.length })).sort((a, b) => a.j - b.j);
  for (const { k } of order) if (colorDist(k.shirt, ours.shirt) > 150 && colorDist(k.shirt, ours.shorts) > 60) return { ...k, pattern: 'plain', numColor: '#fff' };
  return { ...OPP_KITS[2], pattern: 'plain' };
}

export function keeperKit(ours, theirs) {
  const opts = [
    { shirt: '#c6ff3d', shirt2: '#1b1b1f', shorts: '#1b1b1f', socks: '#c6ff3d', gloves: '#ffffff' },
    { shirt: '#ff4fa3', shirt2: '#1b1b1f', shorts: '#1b1b1f', socks: '#ff4fa3', gloves: '#ffffff' },
    { shirt: '#22d3ee', shirt2: '#0b3b4a', shorts: '#0b3b4a', socks: '#22d3ee', gloves: '#ffe066' },
    { shirt: '#ff9f1c', shirt2: '#1b1b1f', shorts: '#1b1b1f', socks: '#ff9f1c', gloves: '#ffffff' },
  ];
  for (const k of opts) if (colorDist(k.shirt, ours.shirt) > 140 && colorDist(k.shirt, theirs.shirt) > 140) return k;
  return opts[0];
}

export function dailyOpponent(day, s) {
  const tier = clubForSeason(s).tier;
  const pool = OPP[tier];
  return pool[Number(String(day).slice(-3)) % pool.length];
}
