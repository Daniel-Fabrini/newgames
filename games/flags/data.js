// Question sets, answer helpers and question generators (classic sets,
// survival, daily challenge).

import { COUNTRIES } from '../../js/data/countries.js';
import { shuffle, norm, rng } from '../../js/core/ui.js';
import { SIMILAR, SAME_FLAG } from './similar.js';

export const CONTS = ['eu', 'as', 'af', 'na', 'sa', 'oc'];
export const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

// Countries usable in "guess the flag" questions (no duplicated flag images).
export const FLAG_POOL = COUNTRIES.filter((c) => !SAME_FLAG.has(c.code));
// Countries usable in capital questions.
export const CAP_POOL = COUNTRIES.filter((c) => c.capital);

export const poolOf = (kind) => (kind === 'caps' ? CAP_POOL : FLAG_POOL);

// Extra look-alike groups that the pixel comparison misses (same design,
// different colours or orientation).
const GROUPS = [
  'IE CI IT',
  'ID MC PL SG',
  'NL LU PY HR',
  'RU SK SI RS',
  'CO EC VE',
  'HN NI SV GT',
  'SN ML GN CM',
  'GH BO LT ET',
  'EG YE SY IQ SD',
  'JO PS SD KW AE',
  'LR US MY PR CU',
  'JP BD PW LA',
  'NO IS DK SE FI FO',
  'PK DZ TR TN MR',
  'AU NZ FJ TV CK',
  'GB GB-ENG GB-SCT GB-NIR GB-WLS',
  'CN VN HK TW',
  'IN NE NI',
  'GR UY IL',
  'CH DK TO GE',
  'UA KZ PW RW',
  'MK KG',
  'AT LV LB PE CA',
  'HU BG TJ',
  'BE DE UG',
  'QA BH',
  'ZW ZM ZA MZ',
  'KE SS MW',
  'TT KN AG',
];

const LOOK = new Map();
function link(a, b) {
  if (a === b || !BY_CODE.has(a) || !BY_CODE.has(b)) return;
  if (!LOOK.has(a)) LOOK.set(a, new Set());
  LOOK.get(a).add(b);
}
for (const [code, list] of Object.entries(SIMILAR)) for (const o of list.split(' ')) link(code, o);
for (const g of GROUPS) {
  const codes = g.split(' ');
  for (const a of codes) for (const b of codes) link(a, b);
}

export function answerText(c, kind, lang) {
  return kind === 'caps' ? (c.capital ? c.capital[lang] : '') : c.name[lang];
}

// ---------- sets ----------
const ICONS = {
  l1: ['BR', 'JP', 'CA', 'FR'],
  l2: ['KE', 'KZ', 'LK', 'JM'],
  l3: ['GB-SCT', 'PR', 'GL', 'HK'],
  all: ['US', 'BR', 'ZA', 'KR'],
  eu: ['DE', 'IT', 'GR', 'SE'],
  as: ['JP', 'KR', 'IN', 'TR'],
  af: ['ZA', 'NG', 'KE', 'EG'],
  na: ['MX', 'CA', 'US', 'JM'],
  sa: ['BR', 'AR', 'CO', 'CL'],
  oc: ['AU', 'NZ', 'FJ', 'PG'],
};

function iconFor(key, items) {
  const inSet = new Set(items.map((c) => c.code));
  const picks = (ICONS[key] || []).filter((c) => inSet.has(c));
  for (const c of [...items].sort((a, b) => b.area - a.area)) {
    if (picks.length >= 4) break;
    if (!picks.includes(c.code)) picks.push(c.code);
  }
  return picks.map((c) => BY_CODE.get(c));
}

export const SETS = [];
function addSet(s) {
  s.icon = iconFor(s.iconKey, s.items);
  SETS.push(s);
}
for (const n of [1, 2, 3]) {
  addSet({ id: 'l' + n, kind: 'flags', group: 'levels', level: n, iconKey: 'l' + n, items: FLAG_POOL.filter((c) => c.level === n) });
}
addSet({ id: 'all', kind: 'flags', group: 'levels', iconKey: 'all', items: FLAG_POOL.slice() });
for (const cont of CONTS) addSet({ id: cont, kind: 'flags', group: 'conts', cont, iconKey: cont, items: FLAG_POOL.filter((c) => c.cont === cont) });
for (const cont of CONTS) addSet({ id: 'cap-' + cont, kind: 'caps', group: 'caps', cont, iconKey: cont, items: CAP_POOL.filter((c) => c.cont === cont) });

export const SET_BY_ID = new Map(SETS.map((s) => [s.id, s]));

export function setTitle(t, s) {
  if (s.group === 'levels') return s.id === 'all' ? t('allFlags') : t('level', { n: s.level });
  if (s.group === 'conts') return t('cont_' + s.cont);
  return t('capsOf', { cont: t('cont_' + s.cont) });
}

export function setDesc(t, s) {
  if (s.group === 'levels') return s.id === 'all' ? t('allFlagsDesc') : t('levelDesc' + s.level);
  return '';
}

export function nextSet(s) {
  const same = SETS.filter((x) => x.group === s.group || (s.group !== 'caps' && x.group !== 'caps'));
  const i = same.indexOf(s);
  return i >= 0 && i < same.length - 1 ? same[i + 1] : null;
}

// ---------- options ----------
// Picks n options (the right one included), preferring look-alike flags,
// the same continent and a similar difficulty level.
export function makeOptions(target, kind, n, lang, rnd = Math.random, pool = poolOf(kind)) {
  const look = kind === 'flags' ? LOOK.get(target.code) : null;
  const scored = [];
  for (const c of pool) {
    if (c === target) continue;
    let s = rnd() * 3;
    if (c.cont === target.cont) s += 3;
    if (c.level === target.level) s += 1.2;
    else if (Math.abs(c.level - target.level) === 1) s += 0.5;
    if (look && look.has(c.code)) s += 5;
    scored.push([s, c]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const seen = new Set([norm(answerText(target, kind, lang))]);
  const out = [target];
  let looks = 0;
  for (const [, c] of scored) {
    if (out.length >= n) break;
    const key = norm(answerText(c, kind, lang));
    if (!key || seen.has(key)) continue;
    if (look && look.has(c.code)) {
      if (looks >= 2) continue;
      looks++;
    }
    seen.add(key);
    out.push(c);
  }
  return shuffle(out, rnd);
}

// ---------- survival ----------
// Difficulty grows with the score: more obscure flags and more options.
export const TIERS = [
  { from: 0, mix: { 1: 1 }, n: 4 },
  { from: 10, mix: { 1: 0.4, 2: 0.6 }, n: 4 },
  { from: 25, mix: { 1: 0.15, 2: 0.65, 3: 0.2 }, n: 4 },
  { from: 45, mix: { 2: 0.6, 3: 0.4 }, n: 6 },
  { from: 70, mix: { 1: 0.1, 2: 0.5, 3: 0.4 }, n: 6 },
];

export function tierIndex(score) {
  let i = 0;
  while (i < TIERS.length - 1 && score >= TIERS[i + 1].from) i++;
  return i;
}

export function survivalPicker(kind) {
  const pool = poolOf(kind);
  const used = new Set();
  let count = 0;
  return function pick(score) {
    const tier = TIERS[tierIndex(score)];
    let r = Math.random();
    let level = 1;
    for (const [lv, w] of Object.entries(tier.mix)) {
      level = +lv;
      if ((r -= w) <= 0) break;
    }
    let cands = pool.filter((c) => c.level === level && !used.has(c.code));
    if (!cands.length) cands = pool.filter((c) => !used.has(c.code));
    if (!cands.length) {
      used.clear();
      cands = pool.slice();
    }
    const c = cands[Math.floor(Math.random() * cands.length)];
    used.add(c.code);
    count++;
    const qt = kind === 'flags' && count % 5 === 0 ? 'rev' : 'mc';
    return { c, kind, qt, n: qt === 'rev' ? 4 : tier.n };
  };
}

// ---------- daily challenge ----------
export function todayKey(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayDiff(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

function hashStr(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

// Ten questions, the same for everyone on a given date.
const DAILY_PLAN = [
  { kind: 'flags', qt: 'mc', level: 1, n: 4 },
  { kind: 'flags', qt: 'rev', level: 1, n: 4 },
  { kind: 'caps', qt: 'mc', level: 1, n: 4 },
  { kind: 'flags', qt: 'mc', level: 2, n: 4 },
  { kind: 'flags', qt: 'spell', level: 1, n: 0 },
  { kind: 'flags', qt: 'rev', level: 2, n: 4 },
  { kind: 'caps', qt: 'mc', level: 2, n: 4 },
  { kind: 'flags', qt: 'mc', level: 2, n: 6 },
  { kind: 'flags', qt: 'mc', level: 3, n: 4 },
  { kind: 'caps', qt: 'mc', level: 2, n: 6 },
];

export function dailyQuestions(key) {
  const rnd = rng(hashStr('flags:' + key));
  const used = new Set();
  return DAILY_PLAN.map((p) => {
    const cands = poolOf(p.kind).filter((c) => c.level === p.level && !used.has(c.code));
    const c = cands[Math.floor(rnd() * cands.length)];
    used.add(c.code);
    return { c, kind: p.kind, qt: p.qt, n: p.n, seed: Math.floor(rnd() * 1e9) };
  });
}
