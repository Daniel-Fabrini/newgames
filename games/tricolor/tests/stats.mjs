// node games/tricolor/tests/stats.mjs — validation report of the real bank
import { validateAll, CAT_IDS, CATEGORIES } from '../questions/index.js';
export function report(res = validateAll(), out = console.log) {
  const s = res.stats;
  out(`Valid questions: ${s.total}   (rejected: ${res.errors.length}, warnings: ${res.warnings.length})`);
  out('\nPer category:');
  for (const c of CAT_IDS) {
    const d = s.catDiff[c] || { 1: 0, 2: 0, 3: 0, 4: 0 };
    out(`  ${c.padEnd(9)} ${String(s.byCat[c]).padStart(4)}   d1:${d[1]} d2:${d[2]} d3:${d[3]} d4:${d[4]}   ${CATEGORIES[c]}`);
  }
  out('\nPer difficulty: ' + [1, 2, 3, 4].map((d) => `d${d}=${s.byDiff[d]}`).join('  '));
  out('Correct-index distribution (A,B,C,D): ' + s.byCorrect.join(', ') + '   shares: ' + s.correctShare.join(' / '));
  out('\nSource domains (questions citing each):');
  Object.entries(s.byDomain).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => out(`  ${String(n).padStart(4)}  ${d}`));
  if (res.errors.length) {
    out('\nERRORS:');
    res.errors.forEach((e) => out(`  ${e.file}#${e.index} ${e.id}: ${e.msgs.join('; ')}`));
  }
  if (res.warnings.length) {
    out('\nWARNINGS:');
    res.warnings.forEach((w) => out(`  ${w.id}: ${w.msg}`));
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const res = validateAll();
  report(res);
  process.exitCode = res.errors.length ? 1 : 0;
}
