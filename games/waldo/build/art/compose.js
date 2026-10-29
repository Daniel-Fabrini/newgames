// Layout engine: scenery items + zoned crowds + hidden targets + near-miss decoys,
// everything painted back-to-front (sorted by foot line) into one big canvas.
(function () {
  const WA = window.WA;
  const { clamp, lerp } = WA;

  WA.compose = function (theme, opts = {}) {
    const W = theme.W, H = theme.H;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const r = WA.rng(theme.seed);
    const CELL = 12;
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
    const grid = new Uint8Array(GW * GH);

    const S = { g, W, H, r, theme, items: [], zones: [], people: [], targets: {}, crowdCount: 0, decoyCount: 0, grid, GW, GH, CELL };

    // ---- scenery ----
    // key = sort key (foot line); bb optional bbox (x0,y0,x1,y1) of the thing
    S.item = (key, fn, bb) => {
      S.items.push({ key, fn, bb: bb || null });
    };
    S.zone = (z) => {
      z.d = z.d == null ? 1 : z.d;
      z.target = z.target !== false;
      S.zones.push(z);
      return z;
    };
    // mark crowd occupancy so later crowds avoid scenery / or don't
    S.occupy = (x0, y0, x1, y1, v = 3) => {
      for (let cy = Math.max(0, Math.floor(y0 / CELL)); cy <= Math.min(GH - 1, Math.floor(y1 / CELL)); cy++)
        for (let cx = Math.max(0, Math.floor(x0 / CELL)); cx <= Math.min(GW - 1, Math.floor(x1 / CELL)); cx++) {
          const i = cy * GW + cx;
          grid[i] = Math.min(250, grid[i] + v);
        }
    };
    const cover = (x, y, h) => {
      // mean coverage under a person bbox
      const x0 = x - h * 0.26, x1 = x + h * 0.26, y0 = y - h * 0.9, y1 = y - h * 0.1;
      let s = 0, n = 0;
      for (let yy = y0; yy <= y1; yy += (y1 - y0) / 4)
        for (let xx = x0; xx <= x1; xx += (x1 - x0) / 2) {
          const cx = clamp(Math.floor(xx / CELL), 0, GW - 1), cy = clamp(Math.floor(yy / CELL), 0, GH - 1);
          s += grid[cy * GW + cx];
          n++;
        }
      return s / n;
    };
    S.cover = cover;
    const hAtZone = (z, y) => {
      const t = z.y1 > z.y0 ? clamp((y - z.y0) / (z.y1 - z.y0), 0, 1) : 0;
      return lerp(z.hh[0], z.hh[1], t);
    };
    const pickZone = (filter) => {
      const list = S.zones.filter(filter || (() => true));
      let tot = 0;
      const ws = list.map((z) => {
        const w = Math.max(1, (z.x1 - z.x0) * (z.y1 - z.y0)) * (z.pw == null ? 1 : z.pw);
        tot += w;
        return w;
      });
      let q = r() * tot;
      for (let i = 0; i < list.length; i++) {
        q -= ws[i];
        if (q <= 0) return list[i];
      }
      return list[list.length - 1];
    };
    S.pickZone = pickZone;
    // candidate position inside zone, preferring the least covered of K samples
    const samplePos = (z, K = 4, near) => {
      let best = null, bs = 1e9;
      for (let k = 0; k < K; k++) {
        let x, y;
        if (near) {
          x = near.x + (r() * 2 - 1) * near.r;
          y = near.y + (r() * 2 - 1) * near.r * 0.7;
          x = clamp(x, z.x0, z.x1);
          y = clamp(y, z.y0, z.y1);
        } else {
          x = lerp(z.x0, z.x1, r());
          y = lerp(z.y0, z.y1, r());
        }
        const h = hAtZone(z, y);
        const sc = cover(x, y, h) + r() * 0.8;
        if (sc < bs) {
          bs = sc;
          best = { x, y, h };
        }
      }
      return best;
    };

    // ---- persons ----
    S.person = (x, y, h, o = {}) => {
      const p = WA.randomPerson(r, o.outfit || theme.outfit);
      if (o.p) Object.assign(p, o.p);
      const e = { kind: 'person', x, y, h, p, flip: o.flip || (r() < 0.5 ? 1 : -1), d: null, water: !!o.water, extra: o.extra };
      if (o.water) p.clipBelow = -(o.waterLine || 38);
      if (o.lie) p.lie = o.lie;
      S.people.push(e);
      return e;
    };
    // generic drawable (sprite or person drawable) at a spot
    S.thing = (d, x, y, h, o = {}) => {
      const e = { kind: 'drawable', d, x, y, h, flip: o.flip || (r() < 0.5 ? 1 : -1), decoy: !!o.decoy };
      S.people.push(e);
      return e;
    };
    const bbOf = (e) => {
      if (e.kind === 'person') return { x0: e.x - e.h * 0.34, x1: e.x + e.h * 0.34, y0: e.y - e.h * 1.12, y1: e.y };
      const b = WA.drawableBox(e.d, e.h);
      if (e.d.kind === 'person') return { x0: e.x - b.w * 0.8, x1: e.x + b.w * 0.8, y0: e.y - b.h, y1: e.y };
      return { x0: e.x - b.w / 2, x1: e.x + b.w / 2, y0: e.y - b.h, y1: e.y + 2 };
    };

    // ---- theme builds scenery + zones ----
    theme.bg(S);
    theme.layout(S);

    // ---- occlusion masks: what scenery is drawn in front of a given foot line ----
    const SC = 4, BAND = 40, KOFF = 2000;
    const mw = Math.ceil(W / SC), mh = Math.ceil(H / SC);
    const bandOf = (k) => Math.max(0, Math.floor((k + KOFF) / BAND));
    const occMasks = new Map();
    {
      const cv = document.createElement('canvas');
      cv.width = mw;
      cv.height = mh;
      const cg = cv.getContext('2d', { willReadFrequently: true });
      cg.scale(1 / SC, 1 / SC);
      cg.lineJoin = 'round';
      cg.lineCap = 'round';
      const sorted = S.items.slice().sort((a, b) => b.key - a.key);
      const bMax = bandOf(sorted.length ? sorted[0].key : 0);
      const bLo = bandOf(0), bHi = bandOf(H + 200);
      let ip = 0;
      for (let b = bMax; b >= bLo; b--) {
        while (ip < sorted.length && bandOf(sorted[ip].key) >= b) {
          try { sorted[ip].fn(cg); } catch (e) { /* ignore */ }
          ip++;
        }
        if (b <= bHi) {
          const d = cg.getImageData(0, 0, mw, mh).data;
          const m = new Uint8Array(mw * mh);
          for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 40 ? 1 : 0;
          occMasks.set(b, m);
        }
      }
    }
    // fraction of a box covered by scenery drawn after a thing standing at foot line y
    const occFrac = (y, x0, y0, x1, y1) => {
      const m = occMasks.get(bandOf(y) + 1);
      if (!m) return 0;
      let n = 0, c = 0;
      for (let yy = y0; yy < y1; yy += 5)
        for (let xx = x0; xx < x1; xx += 5) {
          const ix = Math.floor(xx / SC), iy = Math.floor(yy / SC);
          if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) continue;
          n++;
          c += m[iy * mw + ix];
        }
      return n ? c / n : 0;
    };

    // ---- crowd ----
    const zoneCount = (z) => {
      if (z.n != null) return Math.round(z.n * (opts.density || 1));
      const area = (z.x1 - z.x0) * (z.y1 - z.y0);
      const hm = (z.hh[0] + z.hh[1]) / 2;
      return Math.round((area / (0.2 * hm * hm)) * z.d * (opts.density || 1));
    };
    for (const z of S.zones) {
      if (z.noCrowd) continue;
      const n = zoneCount(z);
      for (let i = 0; i < n; i++) {
        const pos = samplePos(z, z.K || 5);
        const h = pos.h * lerp(0.88, 1.12, r());
        const o = { outfit: z.outfit ? Object.assign({}, theme.outfit, z.outfit) : null, water: z.water, waterLine: z.waterLine };
        const e = S.person(pos.x, pos.y, h, o);
        if (z.pose) e.p.pose = r.pick(z.pose);
        if (z.fix) z.fix(e, r, S);
        S.occupy(pos.x - h * 0.28, pos.y - h * 0.9, pos.x + h * 0.28, pos.y - h * 0.1, 1);
        e.zone = z;
        S.crowdCount++;
      }
    }

    // ---- targets ----
    const spec = theme.targets || WA.TARGET_IDS;
    const sectors = [];
    const SX = 4;
    for (let sx = 0; sx < SX; sx++) sectors.push({ x0: (sx * W) / SX, x1: ((sx + 1) * W) / SX, y0: 0, y1: H });
    const order = r.shuffle(sectors.concat(sectors));
    const placed = [];
    const clearRects = [];
    const heroPoses = ['stand', 'stand2', 'walk', 'walk2', 'wave', 'cheer', 'point', 'hip', 'dance'];
    spec.forEach((id, idx) => {
      const T = WA.TARGETS[id];
      const sector = order[idx % order.length];
      let best = null, bs = -1e9;
      for (let t = 0; t < 500; t++) {
        const d = id === 'hero' ? T.make(r.pick(heroPoses), r.pick([1, 1, 0.5, 0])) : T.make();
        const isItem = d.kind === 'sprite';
        const z = pickZone((zz) => zz.target && zz.x1 > sector.x0 && zz.x0 < sector.x1 && !zz.water && (!zz.itemsOnly || isItem) && (!zz.peopleOnly || !isItem));
        const x = lerp(Math.max(z.x0, sector.x0), Math.min(z.x1, sector.x1), r());
        const y = lerp(Math.max(z.y0, sector.y0), Math.min(z.y1, sector.y1), r());
        if (x < 90 || x > W - 90 || y < 160 || y > H - 20) continue;
        const h = hAtZone(z, y) * (theme.targetScale || 1);
        const probe = { kind: 'drawable', d, x, y, h };
        const bb = bbOf(probe);
        if (bb.x0 < 30 || bb.x1 > W - 30) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 420)) continue;
        // not under a solid scenery item that is drawn later
        const bh = bb.y1 - bb.y0;
        if (occFrac(y, bb.x0, bb.y0, bb.x1, bb.y1) > 0.2) continue;
        if (occFrac(y, bb.x0, bb.y0, bb.x1, bb.y0 + bh * 0.5) > 0.03) continue;
        const sc = cover(x, y, h) * 1.0 + r() * 1.5 + (id === 'hero' ? 0.5 : 0) * cover(x, y, h);
        if (sc > bs) {
          bs = sc;
          best = { x, y, h, d, bb, z };
        }
      }
      if (!best) throw new Error('no spot for target ' + id + ' in ' + theme.id);
      const e = S.thing(best.d, best.x, best.y, best.h, { flip: r.pick([1, -1]) });
      e.target = id;
      const bb = bbOf(e);
      e.bb = bb;
      placed.push(e);
      // keep the upper part of the target visible: drop crowd members in front covering it
      const cr = { x0: bb.x0 - 2, x1: bb.x1 + 2, y0: bb.y0 - 4, y1: bb.y1 - (bb.y1 - bb.y0) * (best.d.kind === 'person' ? 0.42 : 0.0) };
      clearRects.push(cr);
      S.targets[id] = { x: best.x, y: best.y, h: best.h, bb: [bb.x0, bb.y0, bb.x1, bb.y1], zone: best.z };
    });
    // remove crowd that would hide the keep-clear part
    S.people = S.people.filter((e) => {
      if (e.target || e.keep) return true;
      const b = bbOf(e);
      for (let i = 0; i < clearRects.length; i++) {
        const c = clearRects[i];
        const tgt = placed[i];
        if (e.y > tgt.y - tgt.h * 0.02 && b.x0 < c.x1 && b.x1 > c.x0 && b.y0 < c.y1 && b.y1 > c.y0) return false;
      }
      return true;
    });
    // re-densify around each target (the keep-clear pass left a hole): people beside and behind
    placed.forEach((tgt, ti) => {
      const nFill = tgt.d.kind === 'person' ? 14 : 10;
      for (let i = 0; i < nFill; i++) {
        const z = tgt.zone;
        const hh = tgt.h * r.range(0.85, 1.12);
        const x = tgt.x + (r() * 2 - 1) * tgt.h * 0.9;
        const y = tgt.y + tgt.h * r.range(-0.55, 0.28);
        const b = { x0: x - hh * 0.3, x1: x + hh * 0.3, y0: y - hh * 1.05, y1: y };
        let bad = false;
        for (let k = 0; k < clearRects.length; k++) {
          const c = clearRects[k], q = placed[k];
          if (y > q.y - q.h * 0.02 && b.x0 < c.x1 && b.x1 > c.x0 && b.y0 < c.y1 && b.y1 > c.y0) bad = true;
        }
        if (bad || x < 40 || x > W - 40) continue;
        if (S.items.some((it) => it.bb && it.solid !== false && it.key > y && it.bb.x0 < b.x1 && it.bb.x1 > b.x0 && it.bb.y0 < b.y1 && it.bb.y1 > b.y0 && false)) continue;
        const e = S.person(x, y, hh, { outfit: z && z.outfit ? Object.assign({}, theme.outfit, z.outfit) : null });
        e.keep = false;
        if (z && z.pose) e.p.pose = r.pick(z.pose);
      }
    });
    // blockers: neighbours standing in front, covering the legs of "hidden" targets
    const hideN = theme.hide == null ? 1 : theme.hide;
    placed.forEach((tgt) => {
      if (tgt.d.kind !== 'person') {
        // items hide behind passers-by's legs: nothing special
        return;
      }
      const n = r.chance(hideN) ? r.int(1, 3) : 0;
      for (let i = 0; i < n; i++) {
        const hh = tgt.h * r.range(0.95, 1.12);
        const dx = (r.chance(0.5) ? -1 : 1) * tgt.h * r.range(0.04, 0.32);
        const y = tgt.y + tgt.h * r.range(0.52, 0.72);
        const x = tgt.x + dx;
        const e = S.person(x, y, hh, { outfit: tgt.zone && tgt.zone.outfit ? Object.assign({}, theme.outfit, tgt.zone.outfit) : null });
        e.keep = true;
        const b = bbOf(e);
        // do not let blockers cover each other's targets
        if (placed.some((q) => q !== tgt && q.y < e.y && b.x0 < q.bb.x1 && b.x1 > q.bb.x0 && b.y0 < q.bb.y1 && b.y1 > q.bb.y0)) S.people.pop();
      }
    });

    // ---- decoys ----
    const dcount = Object.assign({ hero: 70, dog: 16, wizard: 16, camera: 18, key: 22, scroll: 22, teddy: 16, duck: 20 }, theme.decoys || {});
    for (const id of spec) {
      const T = WA.TARGETS[id];
      const tg = S.targets[id];
      const n = Math.round(dcount[id] * (opts.decoyK || 1));
      for (let i = 0; i < n; i++) {
        const near = i < n * 0.28 ? { x: tg.x, y: tg.y, r: 380 } : null;
        const dd = T.decoy(r);
        const isItem2 = dd.kind === 'sprite';
        let z = pickZone((zz) => !zz.water && (!zz.itemsOnly || isItem2) && (!near || (zz.x1 > tg.x - near.r && zz.x0 < tg.x + near.r && zz.y1 > tg.y - near.r && zz.y0 < tg.y + near.r)));
        const pos = samplePos(z, 5, near);
        if (!pos) continue;
        const h = pos.h * lerp(0.9, 1.1, r());
        const d = dd;
        const e = S.thing(d, pos.x, pos.y, h, { decoy: true });
        const b = bbOf(e);
        // never cover other targets' clear zones
        let bad = false;
        for (let k = 0; k < clearRects.length; k++) {
          const c = clearRects[k];
          if (e.y > placed[k].y && b.x0 < c.x1 && b.x1 > c.x0 && b.y0 < c.y1 && b.y1 > c.y0) bad = true;
          if (Math.hypot(e.x - placed[k].x, e.y - placed[k].y) < 14) bad = true;
        }
        if (bad) {
          S.people.pop();
          continue;
        }
        S.occupy(b.x0, b.y0, b.x1, b.y1, 1);
        S.decoyCount++;
      }
    }

    // ---- paint ----
    const drawList = [];
    for (const it of S.items) drawList.push({ key: it.key, draw: it.fn });
    for (const e of S.people) {
      drawList.push({
        key: e.sortKey != null ? e.sortKey : e.y,
        draw: (gg) => {
          if (e.kind === 'person') {
            WA.drawPerson(gg, e.p, e.x, e.y, e.h, e.flip);
            if (e.water) WA.P.ripple(gg, e.x, e.y - 38 * e.h / 100, e.h * 0.8, 'rgba(255,255,255,0.85)');
          } else {
            if (e.d.kind === 'sprite') {
              const bb = WA.drawableBox(e.d, e.h);
              WA.sprite(gg, e.x, e.y, e.h * e.d.sizeK, (g2) => {
                if (e.d.item) {
                  g2.beginPath();
                  g2.ellipse(0, 1, 38, 5, 0, 0, 7);
                  g2.fillStyle = 'rgba(30,18,8,0.2)';
                  g2.fill();
                }
                e.d.fn(g2);
              }, e.flip);
            } else WA.drawDrawable(gg, e.d, e.x, e.y, e.h, e.flip);
          }
        },
      });
    }
    drawList.sort((a, b) => a.key - b.key);
    for (const it of drawList) it.draw(g);
    if (theme.fg) theme.fg(S);

    const meta = { id: theme.id, w: W, h: H, crowd: S.crowdCount, decoys: S.decoyCount, targets: {} };
    for (const id of spec) {
      const t = S.targets[id];
      meta.targets[id] = { x: Math.round((t.bb[0] + t.bb[2]) / 2), y: Math.round((t.bb[1] + t.bb[3]) / 2), bb: t.bb.map(Math.round) };
    }
    return { canvas, meta };
  };
})();
