// Question-bank schema + validation (pure module: no DOM, runs in node and in the browser).
// Record format: see TRICOLOR_COMMON.md. Only records passing validateQuestion() are playable.

export const CATEGORIES = {
  fund: 'Fundação e primeiros anos',
  hist: 'História do clube e principais épocas',
  paul: 'Campeonato Paulista',
  bras: 'Campeonato Brasileiro',
  lib: 'Copa Libertadores',
  mundial: 'Mundial de Clubes e competições intercontinentais',
  copas: 'Copa do Brasil e outras competições',
  idolos: 'Jogadores históricos e ídolos',
  tecnicos: 'Treinadores e comissões técnicas',
  morumbi: 'Estádio do Morumbi e a casa tricolor',
  jogos: 'Jogos históricos e grandes decisões',
  recordes: 'Recordes, estatísticas e marcas individuais',
  elencos: 'Plantéis, capitães e gerações marcantes',
  rivais: 'Rivalidades e clássicos',
  cultura: 'Curiosidades, símbolos e cultura do clube',
  outras: 'Futebol feminino e outras modalidades',
};
export const CAT_IDS = Object.keys(CATEGORIES);
export const DIFFICULTIES = [1, 2, 3, 4];

export const LIMITS = { q: 220, a: 60, exp: 600, nearDup: 0.8 };

/** lower-case, no accents / punctuation, single spaces */
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP = new Set(
  'o a os as um uma de do da dos das em no na nos nas por para com que qual quais foi era e ou ao aos se seu sua seus suas pelo pela como quem quando onde qual entre sobre ate ja mais nao sao ser ter tem teve'.split(' '),
);
export function tokens(s) {
  return new Set(normText(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));
}
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** @returns {string[]} list of error messages (empty = valid). Structural checks only (no cross-record). */
export function validateQuestion(q) {
  const e = [];
  if (!q || typeof q !== 'object' || Array.isArray(q)) return ['record is not a plain object'];
  if (!isStr(q.id)) e.push('id missing');
  else if (!/^[a-z0-9]+-\d{3,}$/.test(q.id)) e.push(`id "${q.id}" must look like <catId>-<nnn> (e.g. lib-014)`);
  if (!isStr(q.q)) e.push('q missing');
  else {
    if (q.q.length > LIMITS.q) e.push(`q too long (${q.q.length} > ${LIMITS.q})`);
    if (!q.q.trim().endsWith('?')) e.push("q must end with '?'");
  }
  if (!Array.isArray(q.a) || q.a.length !== 4) e.push('a must be an array of exactly 4 answers');
  else {
    q.a.forEach((x, i) => {
      if (!isStr(x)) e.push(`a[${i}] empty or not a string`);
      else if (x.length > LIMITS.a) e.push(`a[${i}] too long (${x.length} > ${LIMITS.a})`);
    });
    const set = new Set(q.a.map(normText));
    if (set.size !== 4) e.push('answers must be 4 DISTINCT strings');
  }
  if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) e.push('c must be an integer 0-3');
  if (!CAT_IDS.includes(q.cat)) e.push(`cat "${q.cat}" is not one of ${CAT_IDS.join(',')}`);
  if (!DIFFICULTIES.includes(q.d)) e.push('d must be 1, 2, 3 or 4');
  if (!isStr(q.exp)) e.push('exp (explanation) missing');
  else if (q.exp.length > LIMITS.exp) e.push(`exp too long (${q.exp.length} > ${LIMITS.exp})`);
  if (!Array.isArray(q.src) || q.src.length < 1 || q.src.length > 3) e.push('src must be an array of 1-3 sources');
  else
    q.src.forEach((s, i) => {
      if (!s || !isStr(s.n)) e.push(`src[${i}].n (name) missing`);
      if (!s || !isStr(s.u) || !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(s.u.trim())) e.push(`src[${i}].u must be an http(s) URL`);
    });
  if (q.when !== undefined && !isStr(String(q.when))) e.push('when must be a non-empty string when present');
  if (q.ok !== true) e.push('ok must be exactly true (answer confirmed against the cited sources)');
  return e;
}

export function srcDomain(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '?';
  }
}

/**
 * Validates a whole bank. `entries` = [{ file, list }] or a flat array of records.
 * Returns { valid[], errors[{id,file,index,msgs}], dupErrors[], warnings[], stats }.
 */
export function validateBank(entries) {
  const groups = Array.isArray(entries) && entries.length && entries[0] && 'list' in entries[0] ? entries : [{ file: 'bank', list: entries }];
  const valid = [];
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const texts = new Map();
  const pairs = new Map();
  const accepted = [];
  for (const { file, list } of groups) {
    if (!Array.isArray(list)) {
      errors.push({ file, index: -1, id: '?', msgs: ['default export is not an array'] });
      continue;
    }
    list.forEach((q, index) => {
      const msgs = validateQuestion(q);
      const id = q && q.id;
      const where = { file, index, id: id || `#${index}` };
      if (!msgs.length) {
        if (ids.has(q.id)) msgs.push(`duplicate id (also in ${ids.get(q.id)})`);
        const nt = normText(q.q);
        if (texts.has(nt)) msgs.push(`duplicate question text (same as ${texts.get(nt)})`);
        const pk = nt + '|' + q.a.map(normText).sort().join('|');
        if (pairs.has(pk)) msgs.push(`duplicate question+answer set (same as ${pairs.get(pk)})`);
        if (!msgs.length) {
          ids.set(q.id, `${file}#${index}`);
          texts.set(nt, q.id);
          pairs.set(pk, q.id);
          if (q.id.split('-')[0] !== q.cat) warnings.push({ ...where, msg: `id prefix differs from cat "${q.cat}"` });
        }
      }
      if (msgs.length) errors.push({ ...where, msgs });
      else {
        valid.push(q);
        accepted.push(q);
      }
    });
  }
  // near duplicates (token overlap) — warnings; same correct-answer text + high overlap is the strong signal
  const tk = accepted.map((q) => tokens(q.q));
  const nearDup = [];
  for (let i = 0; i < accepted.length; i++)
    for (let j = i + 1; j < accepted.length; j++) {
      const s = jaccard(tk[i], tk[j]);
      if (s >= LIMITS.nearDup) {
        const same = normText(accepted[i].a[accepted[i].c]) === normText(accepted[j].a[accepted[j].c]);
        nearDup.push({ a: accepted[i].id, b: accepted[j].id, sim: +s.toFixed(2), sameAnswer: same });
      }
    }
  for (const n of nearDup) warnings.push({ id: n.a, file: '', index: -1, msg: `near-duplicate of ${n.b} (similarity ${n.sim}${n.sameAnswer ? ', same answer' : ''})` });
  return { valid, errors, warnings, nearDup, stats: bankStats(valid) };
}

export function bankStats(list) {
  const byCat = Object.fromEntries(CAT_IDS.map((c) => [c, 0]));
  const byDiff = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const byCorrect = [0, 0, 0, 0];
  const byDomain = {};
  const catDiff = {};
  for (const q of list) {
    byCat[q.cat]++;
    byDiff[q.d]++;
    byCorrect[q.c]++;
    catDiff[q.cat] = catDiff[q.cat] || { 1: 0, 2: 0, 3: 0, 4: 0 };
    catDiff[q.cat][q.d]++;
    for (const s of new Set(q.src.map((x) => srcDomain(x.u)))) byDomain[s] = (byDomain[s] || 0) + 1;
  }
  const n = list.length || 1;
  return { total: list.length, byCat, byDiff, byCorrect, correctShare: byCorrect.map((x) => +(x / n).toFixed(3)), byDomain, catDiff };
}
