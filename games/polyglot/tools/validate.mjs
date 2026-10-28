#!/usr/bin/env node
// Validates the Polyglot course content (see ../CONTENT.md).
//
//   node games/polyglot/tools/validate.mjs            → registry + every unit marked ready: true
//   node games/polyglot/tools/validate.mjs u11 u12    → registry + these units (even if not ready yet)
//   add --quiet to hide warnings
//
// Exit code 1 when there is at least one ERROR. Fix every ERROR; read every WARN (most are real problems).

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { SECTIONS, UNITS } from '../content/index.js';
import { LANGS6, UI_LANGS, alts, tokenize, canon } from '../corpus.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const unitsDir = path.join(here, '..', 'content', 'units');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const wanted = args.filter((a) => !a.startsWith('--'));

let errors = 0;
let warnings = 0;
const out = [];
function err(where, msg) {
  errors++;
  out.push(`  ERROR ${where}: ${msg}`);
}
function warn(where, msg) {
  warnings++;
  if (!quiet) out.push(`  WARN  ${where}: ${msg}`);
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const short = (s) => (String(s).length > 60 ? String(s).slice(0, 57) + '…' : String(s));

// Characters that should never appear in a given language (catches swapped fields).
const FOREIGN = {
  en: /[ñãõßçäöüœ¿¡]/,
  es: /[ãõßçäöœèêàâôûù]/,
  pt: /[ñßäöüœ¿¡èìòù]/,
  fr: /[ñãõßäöì¿¡]/,
  it: /[ñãõßçäöüœ¿¡âêôû]/,
  de: /[ñãõçœ¿¡èìòù]/,
};

// Checks one "a|b|c" field. kind: 'word' | 'sentence' | 'example' | 'line' | 'title'
function checkField(where, lang, v, kind) {
  if (typeof v !== 'string' || !v.trim()) {
    err(where, `missing/empty "${lang}"`);
    return;
  }
  const raw = v.split('|');
  if (raw.some((a) => !a.trim())) err(where, `"${lang}" has an empty alternative (check "||" or a leading/trailing "|"): ${short(v)}`);
  if (kind !== 'sentence' && kind !== 'word' && raw.length > 1) err(where, `"${lang}": alternatives ("|") are only allowed in words and sentences`);
  for (const a0 of raw) {
    const a = a0.trim();
    if (!a) continue;
    if (a0 !== a) warn(where, `"${lang}" alternative has spaces around "|": ${short(v)}`);
    if (/[’‘“”]/.test(a)) err(where, `"${lang}" uses curly quotes/apostrophes — use straight ' only: ${short(a)}`);
    if (/"/.test(a)) err(where, `"${lang}" contains double quotes: ${short(a)}`);
    if (/ {2,}/.test(a)) err(where, `"${lang}" has double spaces: ${short(a)}`);
    if (/\d/.test(a) && kind !== 'example') warn(where, `"${lang}" contains digits — write numbers as words: ${short(a)}`);
    if (FOREIGN[lang].test(a)) warn(where, `"${lang}" contains letters unusual for this language (fields swapped?): ${short(a)}`);
    if (kind === 'example') continue;
    const toks = tokenize(a);
    if (!toks.length) err(where, `"${lang}" has no words: ${short(a)}`);
    if (kind === 'word' || kind === 'title') {
      if (kind === 'word' && /[.!?]$/.test(a)) warn(where, `word "${lang}" should not end with punctuation: ${a}`);
      continue;
    }
    if (!/[.!?…]$/.test(a)) warn(where, `"${lang}" sentence should end with . ! or ?: ${short(a)}`);
    if (toks.length > 14) warn(where, `"${lang}" is long (${toks.length} words) — keep sentences ≤ 14 words: ${short(a)}`);
    if (lang === 'es') {
      if (/\?/.test(a) && !/¿/.test(a)) err(where, `Spanish question needs ¿: ${short(a)}`);
      if (/!/.test(a) && !/¡/.test(a)) err(where, `Spanish exclamation needs ¡: ${short(a)}`);
    }
    if (lang === 'fr' && /[^ ][?!:;]/.test(a)) warn(where, `French needs a space before ? ! : ; → "${short(a)}"`);
    if (lang !== 'fr' && / [?!:;,.]/.test(a)) warn(where, `"${lang}" has a space before punctuation: ${short(a)}`);
    if (/\b(Mr|Mrs|Dr|Sr|Sra|etc)\./.test(a)) err(where, `"${lang}" abbreviation with a period breaks tokenizing: ${short(a)}`);
  }
}

function check6(where, obj, kind) {
  if (!isObj(obj)) {
    err(where, 'must be an object with en, es, pt, fr, it, de');
    return;
  }
  for (const l of LANGS6) checkField(where, l, obj[l], kind);
}

function check3(where, obj) {
  if (!isObj(obj)) {
    err(where, 'must be an object with pt, en, es');
    return;
  }
  for (const l of UI_LANGS) if (typeof obj[l] !== 'string' || !obj[l].trim()) err(where, `missing/empty "${l}"`);
}

const NOUN_ART = {
  es: /^(el|la|los|las) /,
  pt: /^(o|a|os|as) /,
  fr: /^(le|la|les) |^l'/,
  it: /^(il|lo|la|i|gli|le) |^l'/,
  de: /^(der|die|das) \p{Lu}/u,
};

function checkRegistry() {
  out.push('Registry (content/index.js)');
  const ids = new Set();
  const files = new Set();
  if (!SECTIONS.length) err('SECTIONS', 'empty');
  for (const s of SECTIONS) {
    check3(`section ${s.id} title`, s.title);
    check3(`section ${s.id} desc`, s.desc);
  }
  for (const u of UNITS) {
    const w = `registry ${u.id}`;
    if (!/^u\d{2}$/.test(u.id)) err(w, 'id must look like u01');
    if (ids.has(u.id)) err(w, 'duplicate id');
    ids.add(u.id);
    if (!u.file || !u.file.startsWith(u.id + '-') || !u.file.endsWith('.js')) err(w, `file must be "${u.id}-<topic>.js"`);
    if (files.has(u.file)) err(w, 'duplicate file');
    files.add(u.file);
    if (!SECTIONS.some((s) => s.id === u.section)) err(w, `unknown section ${u.section}`);
    if (!u.emoji) err(w, 'missing emoji');
    check3(`${w} title`, u.title);
    check3(`${w} desc`, u.desc);
    if (u.ready && !existsSync(path.join(unitsDir, u.file))) err(w, `ready: true but content/units/${u.file} does not exist`);
  }
}

async function checkUnit(entry) {
  const file = path.join(unitsDir, entry.file);
  out.push(`\n${entry.id} · ${entry.title.en} (${entry.file})${entry.ready ? '' : '  [not ready]'}`);
  if (!existsSync(file)) {
    err(entry.id, `file content/units/${entry.file} not found`);
    return null;
  }
  let u;
  try {
    u = (await import(pathToFileURL(file).href)).default;
  } catch (e) {
    err(entry.id, 'cannot import: ' + e.message);
    return null;
  }
  if (!isObj(u)) {
    err(entry.id, 'file must `export default { ... }`');
    return null;
  }
  if (u.id !== entry.id) err(entry.id, `id in file is "${u.id}", registry says "${entry.id}"`);
  const known = new Set(['id', 'words', 'sentences', 'tips', 'stories']);
  for (const k of Object.keys(u)) if (!known.has(k)) warn(entry.id, `unknown top-level field "${k}"`);

  // ---- words
  const W = Array.isArray(u.words) ? u.words : [];
  if (!Array.isArray(u.words)) err(entry.id, 'words must be an array');
  if (W.length < 8) err(entry.id, `only ${W.length} words (need at least 8, aim for 12–16)`);
  else if (W.length < 12) warn(entry.id, `${W.length} words — aim for 12–16`);
  const emojis = new Map();
  const prim = Object.fromEntries(LANGS6.map((l) => [l, new Map()]));
  W.forEach((w, i) => {
    const where = `${entry.id} words[${i}] (${short(w && w.en)})`;
    check6(where, w, 'word');
    if (!isObj(w)) return;
    for (const k of Object.keys(w)) if (k !== 'e' && !LANGS6.includes(k)) warn(where, `unknown field "${k}"`);
    if (w.e !== undefined) {
      if (typeof w.e !== 'string' || !w.e.trim() || /[a-z]/i.test(w.e)) err(where, '"e" must be a single emoji');
      else if (emojis.has(w.e)) err(where, `emoji ${w.e} already used by words[${emojis.get(w.e)}] — picture choices would be ambiguous`);
      else emojis.set(w.e, i);
    }
    for (const l of LANGS6) {
      if (typeof w[l] !== 'string') continue;
      const c = canon(alts(w[l])[0] || '', l);
      if (prim[l].has(c)) warn(where, `"${l}" main form "${alts(w[l])[0]}" repeats words[${prim[l].get(c)}] — matching pairs get ambiguous`);
      else prim[l].set(c, i);
    }
    const en = alts(w.en)[0] || '';
    if (/^the /.test(en)) {
      for (const [l, re] of Object.entries(NOUN_ART)) {
        const m = alts(w[l] || '')[0] || '';
        if (!re.test(m)) warn(where, `noun: "${l}" main form should start with its definite article (${m})`);
      }
    }
  });
  if (emojis.size < 5) warn(entry.id, `only ${emojis.size} words have an emoji — picture exercises need at least 5 (aim for 8+)`);

  // ---- sentences
  const S = Array.isArray(u.sentences) ? u.sentences : [];
  if (!Array.isArray(u.sentences)) err(entry.id, 'sentences must be an array');
  if (S.length < 8) err(entry.id, `only ${S.length} sentences (need at least 8, aim for 14–20)`);
  else if (S.length < 12) warn(entry.id, `${S.length} sentences — aim for 14–20`);
  const seen = new Map();
  let keys = 0;
  S.forEach((s, i) => {
    const where = `${entry.id} sentences[${i}] (${short(s && alts(s.en)[0])})`;
    check6(where, s, 'sentence');
    if (!isObj(s)) return;
    for (const k of Object.keys(s)) if (k !== 'key' && !LANGS6.includes(k)) warn(where, `unknown field "${k}"`);
    if (s.key) keys++;
    const c = canon(alts(s.en)[0] || '', 'en');
    if (seen.has(c)) warn(where, `duplicates sentences[${seen.get(c)}]`);
    seen.set(c, i);
    for (const l of LANGS6) {
      const as = alts(s[l]);
      const cs = as.map((a) => canon(a, l));
      cs.forEach((x, j) => {
        if (cs.indexOf(x) !== j) warn(where, `"${l}" alternative "${as[j]}" is the same as another one once punctuation/case/accents/contractions are ignored`);
      });
    }
  });
  if (keys < 3 || keys > 8) warn(entry.id, `${keys} sentences have key: true — mark 3–8 key phrases for the guidebook`);

  // ---- tips
  const T = Array.isArray(u.tips) ? u.tips : [];
  if (!T.length) err(entry.id, 'tips: at least one guidebook tip is required');
  for (const l of LANGS6) {
    const n = T.filter((tp) => !tp.for || tp.for.includes(l)).length;
    if (T.length && n === 0) warn(entry.id, `no tip applies to target "${l}"`);
    if (n > 4) warn(entry.id, `${n} tips apply to target "${l}" — keep it to 1–3`);
  }
  T.forEach((tp, i) => {
    const where = `${entry.id} tips[${i}]`;
    if (!isObj(tp)) return err(where, 'must be an object');
    if (tp.for !== undefined && (!Array.isArray(tp.for) || !tp.for.length || tp.for.some((l) => !LANGS6.includes(l)))) err(where, `"for" must be a non-empty array of ${LANGS6.join(', ')}`);
    check3(`${where} title`, tp.title);
    check3(`${where} body`, tp.body);
    if (isObj(tp.body)) for (const l of UI_LANGS) if (String(tp.body[l] || '').length > 320) warn(where, `body.${l} is long — keep tips short (≤ 3 sentences)`);
    if (tp.examples !== undefined) {
      if (!Array.isArray(tp.examples)) err(where, 'examples must be an array');
      else tp.examples.forEach((ex, j) => check6(`${where} examples[${j}]`, ex, 'example'));
    }
  });

  // ---- stories
  const ST = Array.isArray(u.stories) ? u.stories : [];
  if (!ST.length) err(entry.id, 'stories: at least one story is required');
  let storyLines = 0;
  ST.forEach((st, si) => {
    const where = `${entry.id} stories[${si}]`;
    if (!isObj(st)) return err(where, 'must be an object');
    check6(`${where} title`, st.title, 'title');
    if (!isObj(st.cast) || !Object.keys(st.cast).length) err(where, 'cast must map speaker keys to { name, emoji }');
    else for (const [k, c] of Object.entries(st.cast)) if (!isObj(c) || !c.name || !c.emoji) err(`${where} cast.${k}`, 'needs name and emoji');
    const lines = Array.isArray(st.lines) ? st.lines : [];
    if (!lines.length) return err(where, 'lines must be a non-empty array');
    let spoken = 0;
    let asks = 0;
    let replies = 0;
    lines.forEach((it, li) => {
      const w = `${where} lines[${li}]`;
      if (!isObj(it)) return err(w, 'must be an object');
      if (it.ask !== undefined) {
        asks++;
        if (li === 0) err(w, 'a story cannot start with a question');
        check3(`${w} ask`, it.ask);
        if (!Array.isArray(it.options) || it.options.length < 2 || it.options.length > 4) err(w, 'options must have 2–4 entries');
        else it.options.forEach((o, oi) => check3(`${w} options[${oi}]`, o));
        if (!Number.isInteger(it.answer) || !it.options || it.answer < 0 || it.answer >= it.options.length) err(w, 'answer must be the index of the correct option');
        return;
      }
      if (!it.who || !isObj(st.cast) || !st.cast[it.who]) err(w, `who "${it.who}" is not in cast`);
      if (it.reply !== undefined) {
        replies++;
        if (!Array.isArray(it.reply) || it.reply.length < 2 || it.reply.length > 4) err(w, 'reply must have 2–4 options');
        else it.reply.forEach((o, oi) => check6(`${w} reply[${oi}]`, o, 'line'));
        if (!Number.isInteger(it.answer) || !Array.isArray(it.reply) || it.answer < 0 || it.answer >= it.reply.length) err(w, 'answer must be the index of the correct reply');
        spoken++;
        return;
      }
      check6(w, it, 'line');
      spoken++;
    });
    storyLines += spoken;
    if (spoken < 6) warn(where, `only ${spoken} spoken lines — aim for 8–16 (role-plays 12–20)`);
    if (asks < 1) warn(where, 'add 1–4 comprehension questions (ask)');
    if (replies < 1) warn(where, 'add 1–3 "what does X say?" items (reply)');
  });

  out.push(
    `  ${W.length} words (${emojis.size} with emoji) · ${S.length} sentences (${keys} key) · ${T.length} tips · ${ST.length} stor${ST.length === 1 ? 'y' : 'ies'} (${storyLines} lines)`,
  );
  return { words: W.length, sentences: S.length };
}

checkRegistry();
const targets = wanted.length ? wanted.map((id) => UNITS.find((u) => u.id === id) || { id, file: '?', title: { en: '(not in registry)' } }) : UNITS.filter((u) => u.ready);
let totalW = 0;
let totalS = 0;
for (const entry of targets) {
  if (entry.file === '?') {
    out.push(`\n${entry.id}`);
    err(entry.id, 'not found in content/index.js');
    continue;
  }
  const r = await checkUnit(entry);
  if (r) {
    totalW += r.words;
    totalS += r.sentences;
  }
}
out.push(`\n${targets.length} unit(s) checked · ${totalW} words · ${totalS} sentences · ${errors} error(s) · ${warnings} warning(s)`);
console.log(out.join('\n'));
process.exit(errors ? 1 : 0);
