// Build-time tool (not shipped to the APK): beam-search planner that finds a reference solution for a level.
//   node games/goo/tests/plan.mjs w1l1 [w1l2 ...]   -> prints/updates games/goo/tests/found/<id>.json
// Protocol (shared with playSolution in sim.js): before every placement wait until the structure is calm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim, TYPES, TYPE_IDS, playSolution } from '../sim.js';
import { LEVELS } from '../levels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'found');
fs.mkdirSync(outDir, { recursive: true });

function settle(sim, wait = 30, max = 600) {
  let w = 0;
  while (sim.calm < wait && w < max && sim.status === 'play') {
    sim.step();
    w++;
  }
}

function potentialFor(level) {
  const g = level.goal;
  if (g.type === 'height') return (sim) => {
    let y = Infinity;
    for (const n of sim.nodes) if (n.alive && n.conn && !n.fixed) y = Math.min(y, n.y);
    return isFinite(y) ? y : 9999;
  };
  const wp = [...(level.plan || []), [level.pipe.x, level.pipe.y]];
  const tail = new Array(wp.length).fill(0);
  for (let k = wp.length - 2; k >= 0; k--) tail[k] = tail[k + 1] + Math.hypot(wp[k][0] - wp[k + 1][0], wp[k][1] - wp[k + 1][1]);
  return (sim) => {
    let best = 9999;
    for (const n of sim.nodes) {
      if (!n.alive || !n.conn || n.fixed) continue;
      for (let k = 0; k < wp.length; k++) {
        const v = Math.hypot(n.x - wp[k][0], n.y - wp[k][1]) + tail[k];
        if (v < best) best = v;
      }
    }
    return best;
  };
}

export function plan(level, { beam = 4, expand = 10, step = 20, log = console.log, maxDepth = 40, keep = 36, extra = 10 } = {}) {
  const pot = potentialFor(level);
  const root = new Sim(level);
  settle(root);
  let states = [{ snap: root.snapshot(), seq: [], score: pot(root), won: false }];
  const b = level.bounds;
  const types = TYPE_IDS.filter((t) => (level.stock[t] || 0) > 0);
  const total = Object.values(level.stock).reduce((a, c) => a + c, 0);
  const work = new Sim(level);
  for (let depth = 0; depth < Math.min(maxDepth, total); depth++) {
    const children = [];
    for (const st of states) {
      work.restore(st.snap);
      const cands = [];
      for (const type of types) {
        if (work.left[type] <= 0) continue;
        for (let y = b[1] - 100; y < b[3]; y += step) {
          for (let x = b[0] - 40; x < b[2] + 100; x += step) {
            const pv = work.preview(type, x, y);
            if (pv.valid) cands.push({ type, x, y });
          }
        }
      }
      // geometric pre-filter: keep the most promising positions (distance-to-goal of the spot, >=2 links, good spacing)
      const pre = [];
      for (const c of cands) {
        const pv = work.preview(c.type, c.x, c.y);
        const fake = { nodes: [{ alive: true, conn: true, fixed: false, x: pv.x, y: pv.y }] };
        let p = pot(fake);
        if (pv.links.length < 2) p += 60;
        const avg = pv.links.reduce((a, l) => a + l.d, 0) / (pv.links.length || 1);
        p += Math.abs(avg - 100) * 0.4 + (c.type === 'goo' ? 0 : 6);
        pre.push({ c, p });
      }
      pre.sort((a, b2) => a.p - b2.p);
      const top = pre.slice(0, keep).map((q) => q.c);
      for (let i = keep; i < pre.length && top.length < keep + extra; i += Math.max(1, Math.floor((pre.length - keep) / extra))) top.push(pre[i].c);
      const scored = [];
      for (const c of top) {
        work.restore(st.snap);
        const lostBefore = work.lost;
        const strandsBefore = work.strands.length;
        const r = work.place(c.type, c.x, c.y);
        if (!r.ok) continue;
        const nStr = work.strands.length;
        settle(work);
        if (work.lost > lostBefore) continue;
        if (work.status === 'lost') continue;
        if (work.strands.length < nStr) continue; // a strand snapped
        if (work.status === 'play' && work.calm < 30 && !work.dynamic) continue;
        const sc = work.status === 'won' ? -1e6 : pot(work);
        scored.push({ ...c, score: sc, won: work.status === 'won', snap: work.snapshot() });
      }
      scored.sort((a, b2) => a.score - b2.score);
      // prefer distinct types among the top
      for (const s of scored.slice(0, expand)) children.push({ snap: s.snap, seq: [...st.seq, { type: s.type, x: s.x, y: s.y }], score: s.score, won: s.won });
    }
    if (!children.length) return null;
    children.sort((a, b2) => a.score - b2.score || a.seq.length - b2.seq.length);
    const won = children.find((c) => c.won);
    log(`  depth ${depth + 1}: ${children.length} children, best ${children[0].score.toFixed(1)}`);
    if (won) return won.seq;
    // dedupe by score, keep beam
    const next = [];
    const seen = new Set();
    for (const c of children) {
      const key = Math.round(c.score);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(c);
      if (next.length >= beam) break;
    }
    states = next;
  }
  return null;
}

export function finalize(level, seq) {
  const used = {};
  for (const p of seq) used[p.type] = (used[p.type] || 0) + 1;
  const stock = {};
  for (const [t, n] of Object.entries(level.stock)) {
    const u = used[t] || 0;
    stock[t] = Math.min(n, u + (t === 'goo' ? 4 : 2));
    if (stock[t] < 1 && n > 0) stock[t] = 1;
  }
  return { sol: seq, stock, stars: [seq.length, seq.length + 2] };
}

if (process.argv[1] && process.argv[1].endsWith('plan.mjs')) {
  const ids = process.argv.slice(2);
  for (const id of ids) {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) throw new Error('unknown level ' + id);
    const t0 = Date.now();
    console.log('planning', id);
    let seq = null;
    for (const cfg of [{ beam: 3, expand: 6 }, { beam: 5, expand: 10 }, { beam: 8, expand: 14, step: 16 }]) {
      seq = plan(level, cfg);
      if (seq) {
        const res = playSolution(level, seq);
        if (res.sim.status === 'won') break;
        console.log('  plan did not replay as a win:', res.error || res.sim.status);
        seq = null;
      }
    }
    if (!seq) {
      console.log('FAILED', id);
      continue;
    }
    const f = finalize(level, seq);
    fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(f));
    console.log('OK', id, seq.length, 'pieces', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
}
