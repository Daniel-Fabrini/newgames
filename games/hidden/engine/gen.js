// Seeded level generation: fills the painted scene's zones with emoji props,
// picks the targets for the mode, keeps look-alikes of the targets out of
// the scene and guarantees every target is mostly visible.

import { rng, shuffle } from '../../../js/core/ui.js';
import { glyph, supported, drawPropMask } from './glyphs.js';
import { lookAlikes, emojiList } from './catalog.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function generateLevel({ seed, theme, kind, zones, W, H, p }) {
  const rnd = rng(seed ^ 0x9e3779b9);
  const R = (a, b) => a + (b - a) * rnd();

  const all = emojiList(theme.items).filter(supported);
  const fill = emojiList(theme.fill).filter(supported);
  const skySet = new Set(emojiList(theme.sky));
  const waterSet = new Set(emojiList(theme.water));
  const wallSet = new Set(emojiList(theme.wall));
  const hasZone = (t) => zones.some((z) => z.t === t);
  const classOf = (ch) => (skySet.has(ch) && hasZone('sky') ? 'sky' : waterSet.has(ch) && hasZone('water') ? 'water' : 'ground');

  // ---- choose the special items
  const used = new Set();
  const pickDistinct = (n, pool) => {
    const out = [];
    let airy = 0;
    for (const ch of shuffle(pool, rnd)) {
      if (out.length >= n) break;
      if ([...lookAlikes(ch)].some((c) => used.has(c))) continue;
      if (classOf(ch) !== 'ground' && airy >= Math.max(1, Math.floor(n / 4))) continue;
      if (classOf(ch) !== 'ground') airy++;
      out.push(ch);
      for (const c of lookAlikes(ch)) used.add(c);
    }
    return out;
  };
  const groundOnly = all.filter((c) => classOf(c) === 'ground');
  let specials = []; // { ch, key, role }
  let goals = [];
  if (kind === 'match') {
    const chs = pickDistinct(p.pairs, all);
    goals = chs.map((ch) => ({ ch, need: 2, found: 0 }));
    chs.forEach((ch, key) => specials.push({ ch, key, role: 'pair' }, { ch, key, role: 'pair' }));
  } else if (kind === 'findall') {
    const chs = pickDistinct(p.groups || 1, groundOnly.length >= 4 ? groundOnly : all);
    goals = chs.map((ch, i) => ({ ch, need: p.copies[i] || p.copies[0], found: 0 }));
    chs.forEach((ch, key) => {
      for (let i = 0; i < goals[key].need; i++) specials.push({ ch, key, role: 'target' });
    });
  } else {
    const chs = pickDistinct(p.targets, all);
    goals = chs.map((ch) => ({ ch, need: 1, found: 0 }));
    chs.forEach((ch, key) => specials.push({ ch, key, role: 'target' }));
  }
  const excluded = new Set();
  for (const g of goals) for (const c of lookAlikes(g.ch)) excluded.add(c);
  const pool = [...all, ...fill].filter((c) => !excluded.has(c));
  const pools = { ground: [], sky: [], water: [], wall: [] };
  for (const ch of pool) {
    const cl = classOf(ch);
    pools[cl].push(ch);
    if (wallSet.has(ch)) pools.wall.push(ch);
  }
  if (!pools.wall.length) pools.wall = pools.ground;
  const fillSet = new Set(fill);

  // ---- zone samplers
  const inHole = (z, x, y) => (z.holes || []).some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);
  const zoneWeight = (z) => {
    if (z.t === 'shelf') return (z.x1 - z.x0) * (z.maxS || 60) * 1.35;
    const area = (z.x1 - z.x0) * (z.y1 - z.y0);
    if (z.t === 'area') return area;
    if (z.t === 'water') return pools.water.length ? area * 0.35 : 0;
    if (z.t === 'sky') return pools.sky.length ? area * (p.skyDensity || 0.05) : 0;
    if (z.t === 'wall') return area * (p.wallDensity || 0.035);
    return 0;
  };
  const sizeFor = (z, y, base) => {
    if (z.t === 'shelf') return Math.min(base, z.maxS || base);
    if (z.t === 'area' || z.t === 'water') return base * lerp(z.s0 || 1, z.s1 || 1, (y - z.y0) / Math.max(1, z.y1 - z.y0));
    if (z.t === 'sky') return base * 0.85;
    return base * 0.85;
  };
  // position for a prop in a zone: returns { x, y (center), base (baseline for z-order) } or null
  const place = (z, ch, s0, fx, fy) => {
    const gl = glyph(ch);
    for (let tries = 0; tries < 8; tries++) {
      const u = tries === 0 && fx !== undefined ? fx : rnd();
      const v = tries === 0 && fy !== undefined ? fy : rnd();
      if (z.t === 'shelf') {
        const s = sizeFor(z, 0, s0);
        const hh = (s * gl.h) / gl.max / 2;
        const ww = (s * gl.w) / gl.max / 2;
        const x = lerp(z.x0 + ww * 0.6, z.x1 - ww * 0.6, u);
        const base = z.y + (z.depth || 0) * v;
        return { x, y: base - hh, s, base };
      }
      const yb = lerp(z.y0, z.y1, v);
      const x = lerp(z.x0, z.x1, u);
      const s = sizeFor(z, yb, s0);
      if (inHole(z, x, yb)) continue;
      if (z.t === 'sky' || z.t === 'wall') return { x, y: yb, s, base: yb };
      const hh = (s * gl.h) / gl.max / 2;
      return { x, y: yb - hh, s, base: yb };
    }
    return null;
  };

  const weighted = zones.map((z) => ({ z, w: zoneWeight(z) })).filter((e) => e.w > 0);
  const zonesOf = (cl) => weighted.filter((e) => (cl === 'sky' ? e.z.t === 'sky' : cl === 'water' ? e.z.t === 'water' : e.z.t === 'shelf' || e.z.t === 'area'));
  const pickZone = (list) => {
    const sum = list.reduce((a, e) => a + e.w, 0);
    let r = rnd() * sum;
    for (const e of list) if ((r -= e.w) <= 0) return e.z;
    return list[list.length - 1].z;
  };

  const props = [];
  const mk = (ch, pos, extra = {}) => {
    let rot = (rnd() - 0.5) * 0.2;
    if (extra.z === 'sky') rot = (rnd() - 0.5) * 0.5;
    else if (!extra.special) {
      const r = rnd();
      if (r < 0.2) rot = (rnd() - 0.5) * 0.7;
      else if (r < 0.27 && extra.zt === 'area') rot = (rnd() < 0.5 ? -1 : 1) * R(1.1, 1.7);
    }
    return {
      ch,
      x: pos.x,
      y: pos.y,
      s: pos.s,
      base: pos.base,
      rot: extra.special ? (rnd() - 0.5) * 0.24 : rot,
      flip: rnd() < 0.4,
      role: extra.role || 'clutter',
      key: extra.key ?? -1,
      alive: true,
      z: 0,
      zt: extra.zt,
    };
  };

  // ---- clutter
  const total = weighted.reduce((a, e) => a + e.w, 0);
  for (const { z, w } of weighted) {
    let n = Math.round((p.count * w) / total);
    const cl = z.t === 'sky' ? 'sky' : z.t === 'water' ? 'water' : z.t === 'wall' ? 'wall' : 'ground';
    const list = pools[cl];
    if (!list.length) continue;
    if (z.t === 'shelf') n = Math.min(n, Math.ceil((z.x1 - z.x0) / ((z.maxS || 60) * 0.42)));
    // jittered grid for even coverage
    let cols = 1, rows = 1;
    if (z.t === 'shelf') cols = n;
    else {
      const ar = (z.x1 - z.x0) / Math.max(1, z.y1 - z.y0);
      cols = Math.max(1, Math.round(Math.sqrt(n * ar)));
      rows = Math.max(1, Math.ceil(n / cols));
    }
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
    for (const [c, r] of shuffle(cells, rnd).slice(0, n)) {
      const ch = list[Math.floor(rnd() * list.length)];
      const filler = fillSet.has(ch);
      let s = lerp(p.sMin, p.sMax, Math.pow(rnd(), 1.25)) * (filler ? 1.25 : 1);
      if (z.t === 'sky') s = R(p.sMin * 0.9, p.sMax * 0.8);
      const fx = Math.min(1, Math.max(0, (c + 0.5 + (rnd() - 0.5) * 1.2) / cols));
      const fy = Math.min(1, Math.max(0, (r + 0.5 + (rnd() - 0.5) * 1.2) / rows));
      const pos = place(z, ch, s, fx, fy);
      if (!pos) continue;
      const pr = mk(ch, pos, { zt: z.t, z: z.t });
      if (filler) pr.base -= 30; // fillers sit a little behind
      props.push(pr);
    }
  }

  // ---- specials: spread out with farthest-point sampling
  const placed = [];
  const tMin = p.tSize[0], tMax = p.tSize[1];
  for (const sp of specials) {
    const cl = classOf(sp.ch);
    let list = zonesOf(cl);
    if (!list.length) list = zonesOf('ground');
    let best = null, bestD = -1;
    for (let i = 0; i < 26; i++) {
      const z = pickZone(list);
      const pos = place(z, sp.ch, R(tMin, tMax));
      if (!pos) continue;
      if (pos.x < 40 || pos.x > W - 40 || pos.y < 40 || pos.y > H - 30) continue;
      let d = Infinity;
      for (const q of placed) d = Math.min(d, Math.hypot(q.x - pos.x, (q.y - pos.y) * 1.2));
      if (placed.length === 0) d = rnd();
      if (d > bestD) {
        bestD = d;
        best = { pos, z };
      }
    }
    if (!best) {
      const z = list[0].z;
      best = { pos: place(z, sp.ch, tMin, 0.5, 0.5) || { x: W / 2, y: H / 2, s: tMin, base: H / 2 }, z };
    }
    const pr = mk(sp.ch, best.pos, { role: sp.role, key: sp.key, special: true, zt: best.z.t, z: best.z.t });
    placed.push(pr);
    props.push(pr);
  }

  // ---- z order: things lower on the screen are in front
  for (const pr of props) {
    pr.z = pr.base + rnd() * 3;
    if (pr.zt === 'wall') pr.z -= 5000;
    if (pr.zt === 'sky') pr.z -= 10000;
  }
  props.sort((a, b) => a.z - b.z);

  // ---- visibility guarantee
  const S = 48;
  const mc = document.createElement('canvas');
  mc.width = mc.height = S;
  const m = mc.getContext('2d', { willReadFrequently: true });
  const count = () => {
    const d = m.getImageData(0, 0, S, S).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
    return n;
  };
  const near = (a, b) => Math.abs(a.x - b.x) < (a.s + b.s) * 0.6 && Math.abs(a.y - b.y) < (a.s + b.s) * 0.6;
  const visible = (t, idx, skip) => {
    const half = t.s * 0.75;
    const k = S / (2 * half);
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, S, S);
    drawPropMask(m, t, k, t.x - half, t.y - half);
    m.setTransform(1, 0, 0, 1, 0, 0);
    const a0 = count();
    if (!a0) return 1;
    m.globalCompositeOperation = 'destination-out';
    for (let j = idx + 1; j < props.length; j++) {
      const q = props[j];
      if (!q.alive || q === skip || !near(t, q)) continue;
      drawPropMask(m, q, k, t.x - half, t.y - half);
    }
    m.setTransform(1, 0, 0, 1, 0, 0);
    return count() / a0;
  };
  const need = p.visible || 0.65;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < props.length; i++) {
      const t = props[i];
      if (t.role === 'clutter' || !t.alive) continue;
      let v = visible(t, i);
      if (v >= need) continue;
      changed = true;
      // remove the clutter right on top of it, closest first
      const occ = [];
      for (let j = i + 1; j < props.length; j++) {
        const q = props[j];
        if (q.alive && q.role === 'clutter' && near(t, q)) occ.push(q);
      }
      occ.sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
      for (const q of occ) {
        q.alive = false;
        v = visible(t, i);
        if (v >= need) break;
      }
      if (v < need) {
        // blocked by another special: bring this one forward
        let zMax = t.z;
        for (let j = i + 1; j < props.length; j++) if (props[j].alive && near(t, props[j])) zMax = Math.max(zMax, props[j].z);
        t.z = zMax + 0.01;
      }
    }
    if (!changed) break;
    for (let i = props.length - 1; i >= 0; i--) if (!props[i].alive) props.splice(i, 1);
    props.sort((a, b) => a.z - b.z);
  }
  for (let i = props.length - 1; i >= 0; i--) if (!props[i].alive) props.splice(i, 1);
  props.forEach((pr, i) => (pr.id = i));
  let minVis = 1;
  props.forEach((pr, i) => {
    if (pr.role !== 'clutter') minVis = Math.min(minVis, visible(pr, i));
  });
  return { props, goals, kind, minVis };
}
