// Procedural country questions (capitals, continents, flags, areas) built from
// the shared country table, so the question bank never runs dry.

import { COUNTRIES, flagUrl } from '../../js/data/countries.js';
import { shuffle } from '../../js/core/ui.js';

export const GEN_SET = 'countries';

const CONT = {
  af: { pt: 'África', en: 'Africa', es: 'África' },
  as: { pt: 'Ásia', en: 'Asia', es: 'Asia' },
  eu: { pt: 'Europa', en: 'Europe', es: 'Europa' },
  na: { pt: 'América do Norte', en: 'North America', es: 'América del Norte' },
  sa: { pt: 'América do Sul', en: 'South America', es: 'América del Sur' },
  oc: { pt: 'Oceania', en: 'Oceania', es: 'Oceanía' },
};

// Capitals that are disputed, split or commonly misreported are left out.
const NO_CAPITAL = new Set(['BO', 'BE', 'ZA', 'IL', 'PS', 'EH', 'XK', 'TW', 'SZ', 'LK', 'MO', 'CI', 'BJ', 'SV']);
// Countries straddling continents (or Caribbean/Central America, which many
// players would not call "North America") are skipped in continent questions.
const NO_CONT = new Set(['RU', 'TR', 'CY', 'AM', 'GE', 'AZ', 'KZ', 'EG', 'PA', 'ID', 'TL', 'PG']);
// Flags that are (nearly) identical to another country's.
const NO_FLAG = new Set(['MC', 'TD']);
const LOOKALIKE = [
  ['NL', 'LU'],
  ['ID', 'PL'],
  ['RO', 'AD'],
  ['IE', 'CI'],
  ['AU', 'NZ'],
  ['NO', 'IS'],
  ['SN', 'ML'],
  ['VE', 'EC', 'CO'],
];
const lookalike = (a, b) => LOOKALIKE.some((g) => g.includes(a) && g.includes(b));

const real = COUNTRIES.filter((c) => c.independent && c.level <= 2);
const L1 = real.filter((c) => c.level === 1);
const L2 = real.filter((c) => c.level === 2);

const pickOne = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// Three distractors from `pool`, distinct from `right` by the given label.
function distractors(right, pool, label, rnd, extra = () => true) {
  const used = new Set(['pt', 'en', 'es'].map((l) => label(right)[l].toLowerCase()));
  const out = [];
  for (const c of shuffle(pool, rnd)) {
    if (c.code === right.code || !extra(c)) continue;
    const lab = label(c);
    if (!lab) continue;
    const keys = ['pt', 'en', 'es'].map((l) => lab[l].toLowerCase());
    if (keys.some((k) => used.has(k))) continue;
    keys.forEach((k) => used.add(k));
    out.push(c);
    if (out.length === 3) break;
  }
  return out.length === 3 ? out : null;
}

function build(id, d, q, right, wrong, label, img = null) {
  const a = shuffle([right, ...wrong].map((c) => ({ c, lab: label(c) })));
  return { id: `${GEN_SET}:${id}`, set: GEN_SET, d, q, a: a.map((x) => x.lab), ok: a.findIndex((x) => x.c === right), img };
}

const capOf = (c) => c.capital;
const nameOf = (c) => c.name;
const sameCont = (c) => (o) => o.cont === c.cont;
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// "Panama City" would give the answer away: skip capitals named after the country.
const namesake = (c) => ['pt', 'en', 'es'].some((l) => fold(c.capital[l]).includes(fold(c.name[l])) || fold(c.name[l]).includes(fold(c.capital[l])));
const withCap = (arr) => arr.filter((c) => c.capital && !NO_CAPITAL.has(c.code) && !namesake(c));

function capitalQ(d, rnd) {
  const pool = d === 1 ? withCap(L1) : d === 2 ? withCap(L1.concat(L2.filter((c) => c.area > 150000))) : d === 3 ? withCap(L2.filter((c) => c.area > 20000)) : withCap(L2);
  const c = pickOne(pool, rnd);
  const others = d === 1 ? withCap(L1) : withCap(real);
  const wrong = distractors(c, others, capOf, rnd, d >= 2 ? sameCont(c) : () => true) || distractors(c, others, capOf, rnd);
  if (!wrong) return null;
  const n = c.name;
  return build(`cap:${c.code}`, d, { pt: `${n.pt}: qual é a sua capital?`, en: `${n.en}: what is its capital?`, es: `${n.es}: ¿cuál es su capital?` }, c, wrong, capOf);
}

function countryOfCapitalQ(d, rnd) {
  const pool = d <= 2 ? withCap(L1) : withCap(L2.filter((c) => c.area > 15000));
  const c = pickOne(pool, rnd);
  const wrong = distractors(c, real, nameOf, rnd, d >= 2 ? sameCont(c) : () => true);
  if (!wrong) return null;
  const k = c.capital;
  return build(`ofcap:${c.code}`, d, { pt: `${k.pt} é a capital de qual país?`, en: `${k.en} is the capital of which country?`, es: `¿${k.es} es la capital de qué país?` }, c, wrong, nameOf);
}

function continentQ(d, rnd) {
  const pool = (d === 1 ? L1 : L2).filter((c) => !NO_CONT.has(c.code) && (c.cont !== 'na' || ['US', 'CA', 'MX'].includes(c.code)));
  const c = pickOne(pool, rnd);
  const conts = shuffle(Object.keys(CONT).filter((k) => k !== c.cont), rnd).slice(0, 3);
  const fake = (k) => ({ code: k, cont: k });
  const right = fake(c.cont);
  const label = (x) => CONT[x.cont];
  const n = c.name;
  const a = shuffle([right, ...conts.map(fake)], rnd);
  return {
    id: `${GEN_SET}:cont:${c.code}`,
    set: GEN_SET,
    d,
    q: { pt: `${n.pt}: em qual continente fica?`, en: `${n.en}: which continent is it in?`, es: `${n.es}: ¿en qué continente está?` },
    a: a.map(label),
    ok: a.indexOf(right),
    img: null,
  };
}

function flagQ(d, rnd) {
  const ok = (c) => !NO_FLAG.has(c.code);
  const pool = (d === 1 ? L1 : d === 2 ? L1.concat(L2.filter((c) => c.area > 300000)) : L2).filter(ok);
  const c = pickOne(pool, rnd);
  const from = (d === 1 ? L1 : real).filter(ok);
  const guard = (o) => !lookalike(c.code, o.code);
  const wrong = distractors(c, from, nameOf, rnd, d >= 2 ? (o) => guard(o) && o.cont === c.cont : guard) || distractors(c, from, nameOf, rnd, guard);
  if (!wrong) return null;
  return build(
    `flag:${c.code}`,
    d,
    { pt: 'De qual país é esta bandeira?', en: 'Which country does this flag belong to?', es: '¿De qué país es esta bandera?' },
    c,
    wrong,
    nameOf,
    flagUrl(c),
  );
}

function areaQ(d, rnd) {
  const pool = d === 2 ? L1 : real;
  for (let k = 0; k < 12; k++) {
    const c = pickOne(pool, rnd);
    const group = shuffle(pool.filter((o) => o.cont === c.cont && o.code !== c.code), rnd).slice(0, 3);
    if (group.length < 3) continue;
    const four = [c, ...group].sort((a, b) => b.area - a.area);
    if (four[0].area < four[1].area * 1.35) continue;
    const right = four[0];
    return build(
      `area:${four.map((x) => x.code).sort().join('-')}`,
      d,
      { pt: 'Qual destes países tem a maior área territorial?', en: 'Which of these countries has the largest area?', es: '¿Cuál de estos países tiene mayor superficie?' },
      right,
      four.slice(1),
      nameOf,
    );
  }
  return null;
}

const KINDS = {
  1: [capitalQ, capitalQ, flagQ, flagQ, continentQ],
  2: [capitalQ, flagQ, countryOfCapitalQ, continentQ, areaQ],
  3: [capitalQ, flagQ, flagQ, countryOfCapitalQ, areaQ],
  4: [capitalQ, flagQ, countryOfCapitalQ],
};

export function genQuestion(d, rnd = Math.random) {
  const kinds = KINDS[d] || KINDS[2];
  for (let k = 0; k < 6; k++) {
    const q = pickOne(kinds, rnd)(d, rnd);
    if (q) return q;
  }
  return null;
}
