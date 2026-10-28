// Validates the question bank: node games/million/tools/validate.mjs [set ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SETS } from '../questions/index.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'questions');
const want = process.argv.slice(2).length ? process.argv.slice(2) : SETS;
const LANGS = ['pt', 'en', 'es'];
let errors = 0;
let warnings = 0;
const seen = new Map();
const err = (where, msg) => {
  errors++;
  console.log(`ERROR ${where}: ${msg}`);
};
const warn = (where, msg) => {
  warnings++;
  console.log(`WARN  ${where}: ${msg}`);
};

for (const set of want) {
  if (!SETS.includes(set)) {
    err(set, 'unknown set (add it to SETS in questions/index.js)');
    continue;
  }
  const file = path.join(dir, `q-${set}.js`);
  if (!fs.existsSync(file)) {
    console.log(`(skip ${set}: q-${set}.js not written yet)`);
    continue;
  }
  const list = (await import(pathToFileURL(file).href)).default;
  if (!Array.isArray(list)) {
    err(set, 'default export must be an array');
    continue;
  }
  const byD = [0, 0, 0, 0, 0];
  list.forEach((item, i) => {
    const w = `${set}#${i}`;
    if (![1, 2, 3, 4].includes(item.d)) err(w, 'd must be 1–4');
    else byD[item.d]++;
    for (const l of LANGS) {
      const q = item.q && item.q[l];
      if (!q || typeof q !== 'string' || !q.trim()) err(w, `q.${l} missing`);
      else {
        if (q.length > 160) warn(w, `q.${l} is long (${q.length} chars)`);
        if (!/[?.:!…]$/.test(q.trim())) warn(w, `q.${l} should end with ? or .`);
        if (l === 'es' && q.trim().endsWith('?') && !q.includes('¿')) err(w, 'es question must open with ¿');
      }
    }
    if (!Array.isArray(item.a) || item.a.length !== 4) err(w, 'a must have exactly 4 options');
    else {
      for (const l of LANGS) {
        const opts = item.a.map((o) => (o && o[l] ? String(o[l]).trim() : ''));
        opts.forEach((o, j) => {
          if (!o) err(w, `a[${j}].${l} missing`);
          else if (o.length > 48) warn(w, `a[${j}].${l} is long (${o.length} chars)`);
        });
        if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) err(w, `options must be distinct in ${l}`);
      }
    }
    if (![0, 1, 2, 3].includes(item.ok)) err(w, 'ok must be 0–3');
    const key = item.q && item.q.en && item.q.en.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) {
      if (seen.has(key)) err(w, `duplicate of ${seen.get(key)}`);
      else seen.set(key, w);
    }
  });
  console.log(`${set}: ${list.length} questions (d1 ${byD[1]}, d2 ${byD[2]}, d3 ${byD[3]}, d4 ${byD[4]})`);
}
console.log(`\n${errors} error(s) · ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
