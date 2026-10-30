// Procedural canyon-level generation (pure, seeded). Units are metres along the
// road (z grows forward) and across it (x in [-ROAD, ROAD]).
//
// A level is a chain of ~42 m segments. Each segment starts a horde wave and
// lays out pickups: a column of blue +N crates in the right lane, plus one
// feature (weapon pedestal, golden statue or power-up ring). Campaign levels end
// with a boss; survival streams segments forever with rising difficulty.
//
// Balance: the generator tracks the squad the player is *expected* to have at
// each point (soldiers, weapon tier, multipliers, heroes) and sizes HP numbers
// from that expected DPS, so numbers stay meaningful at any level.

import { rng } from '../../js/core/ui.js';
import { ZTYPES, STATUES, STATUE_ORDER, WEAPONS, MAX_TIER, weaponDps, bossFor, isMegaLevel } from './data.js';

export const ROAD = 5; // half width of the road (m)
export const LANE_X = 3.95; // crate lane centre (right side)
export const SEG = 42; // segment length (m)

const sat = (x, k) => 1 - Math.exp(-Math.max(0, x) / k);
export const niceV = (v) => {
  v = Math.max(1, v);
  if (v < 30) return Math.round(v);
  if (v < 200) return Math.round(v / 5) * 5;
  if (v < 2000) return Math.round(v / 10) * 10;
  return Math.round(v / 100) * 100;
};

export class Gen {
  // o: { mode: 'campaign'|'endless', level, seed, nom: { startN, dmg, rate } }
  constructor(o) {
    this.mode = o.mode;
    this.level = Math.max(1, o.level || 1);
    this.r = rng((o.seed >>> 0) || 1);
    this.nom = o.nom;
    // expected squad state at the current generation point
    this.En = o.nom.startN;
    this.Et = 0;
    this.Em = 1;
    this.Eh = 0; // hero DPS in "soldier DPS" units
    this.z = 16;
    this.seg = 0;
    this.statues = 0;
    this.statueKind = Math.floor(this.r() * 3);
    if (this.mode === 'campaign') {
      const L = this.level;
      this.segs = 4 + Math.min(3, Math.floor(L / 6));
      this.length = this.z + this.segs * SEG + 10; // boss trigger
    } else {
      this.segs = Infinity;
      this.length = Infinity;
    }
    this.done = false;
  }

  rand(a, b) {
    return a + (b - a) * this.r();
  }
  pick(arr) {
    return arr[Math.floor(this.r() * arr.length)];
  }

  // virtual level (difficulty) at the generation point
  vLevel() {
    return this.mode === 'campaign' ? this.level : 1 + Math.floor(this.z / 70);
  }
  soldierDps() {
    return weaponDps(this.Et) * this.Em * this.nom.dmg * this.nom.rate;
  }
  edps() {
    return (this.En + this.Eh) * this.soldierDps();
  }
  // how hard hordes push relative to the expected DPS (< 1: player keeps up)
  pressure(i, n) {
    const L = this.vLevel();
    const base = L === 1 ? 0.45 : 0.55 + 0.55 * sat(L - 1, 14) + 0.002 * Math.min(L, 200);
    return base * (0.9 + 0.2 * (n > 1 ? i / (n - 1) : 0)) * (this.mode === 'endless' ? 0.95 : 1);
  }

  // Generate content until `toZ`. `w` is the World (spawning API) — survival adapts to it.
  fill(w, toZ) {
    while (!this.done && this.z < toZ) {
      if (this.mode === 'endless' && w) {
        // never let survival snowball: blend expectation with the real squad
        this.En = Math.max(this.nom.startN * 0.8, 0.5 * this.En + 0.5 * w.sq.n);
        this.Et = Math.max(0, Math.min(this.Et, w.sq.tier + 1));
      }
      if (this.seg >= this.segs) {
        this.boss(w, this.z, true);
        this.done = true;
        break;
      }
      if (this.mode === 'endless' && this.seg > 0 && this.seg % 5 === 4) {
        this.boss(w, this.z, false);
        this.z += SEG;
        this.seg++;
        continue;
      }
      this.segment(w, this.z, this.seg);
      this.z += SEG;
      this.seg++;
    }
  }

  segment(w, z, i) {
    const L = this.vLevel();
    const nSeg = this.mode === 'campaign' ? this.segs : 6;
    const ii = this.mode === 'campaign' ? i : i % 5;
    // the horde wave starts as the squad enters the segment (before its pickups)
    this.wave(w, z, ii, nSeg);
    // features first: they raise the expectation for the wave of the next segment
    // 1) reinforcements column in the right lane
    const cnt = Math.min(18, 5 + Math.floor(this.r() * 5) + Math.floor(L / 4));
    const v = 1 + Math.floor(L / 12) + (this.r() < 0.15 && L > 3 ? 1 : 0);
    const cz = z + this.rand(5, 12);
    for (let k = 0; k < cnt; k++) w.addCrate(LANE_X, cz + k * 1.55, v);
    this.En += cnt * v * 0.6;
    // 2) one feature
    const order = L === 1 ? ['ring', 'weapon', 'statue', 'ring'] : ['weapon', 'statue', 'ring', 'weapon', 'ring', 'statue'];
    let feat = order[i % order.length];
    if (feat === 'weapon' && this.Et >= MAX_TIER + 2) feat = 'ring';
    if (feat === 'statue' && this.mode === 'campaign' && this.statues >= 2) feat = 'ring';
    const fz = z + this.rand(14, 24);
    const side = this.r() < 0.7 ? -1 : 1;
    if (feat === 'weapon') {
      const x = side < 0 ? -3.3 : 2.2;
      const hp = niceV(this.edps() * (2.4 + 1.2 * sat(L, 20)));
      w.addPickup(x, fz, this.Et + 1, hp);
      this.Et += 1;
    } else if (feat === 'statue') {
      const kind = STATUE_ORDER[(this.statueKind + this.statues) % 3];
      const hp = niceV(this.edps() * (4 + 2.5 * sat(L, 20)));
      w.addStatue(-3.45, fz + 4, kind, hp);
      this.statues++;
      this.Eh += STATUES[kind].dpsK * 0.85;
    } else {
      const rate = this.r() < 0.3 && L > 2;
      const p = rate ? this.pick([20, 25, 30]) : this.pick([20, 30, 30, 40, 50]);
      const x = this.rand(-2.2, 1.6);
      w.addRing(x, fz, rate ? 'rate' : 'dmg', p);
      this.Em *= 1 + (p / 100) * 0.8;
    }
  }

  hordeTypes(L) {
    const t = [['grunt', 1]];
    if (L >= 3) t.push(['shield', 0.3]);
    if (L >= 5) t.push(['runner', 0.25]);
    if (L >= 9) t.push(['elite', 0.18]);
    return t;
  }
  pickType(types) {
    let tot = 0;
    for (const o of types) tot += o[1];
    let k = this.r() * tot;
    for (const o of types) {
      k -= o[1];
      if (k <= 0) return o[0];
    }
    return types[0][0];
  }

  wave(w, z, i, n) {
    const L = this.vLevel();
    let types = this.hordeTypes(L);
    const fresh = Object.keys(ZTYPES).find((k) => ZTYPES[k].from === L && !ZTYPES[k].big && L > 1);
    if (fresh && i === 1 && this.mode === 'campaign') types = [[fresh, 3], ['grunt', 1]];
    let wsum = 0;
    let psum = 0;
    for (const [k, p] of types) {
      wsum += ZTYPES[k].hpW * p;
      psum += p;
    }
    const avgW = wsum / psum;
    // grunts die in exactly `k` expected bullets; the arrival rate (enemies / s) follows
    // the bullets the expected squad puts out, so a grown squad faces hundreds
    const W = WEAPONS[Math.min(this.Et, MAX_TIER)];
    const vis = Math.min(6, W.rate * this.nom.rate);
    const perShot = (this.soldierDps() / vis) * Math.max(1, this.En / 60);
    const bps = Math.min(60, this.En) * vis;
    const k = L < 4 ? 1 : L < 12 ? 2 : 3;
    const hu = perShot * k * 0.97;
    const rate = Math.max(2.5, Math.min(46, (bps * this.pressure(i, n)) / (k * avgW)));
    const dur = 6 + 3 * sat(L - 1, 10) + 0.8 * i;
    const count = Math.round(rate * dur);
    const cx = this.rand(-1.6, 0.4);
    const Rexp = 0.3 + 0.32 * Math.sqrt(Math.min(60, this.En));
    const width = Math.max(1.5, Math.min(3.8, 2.1 * Rexp + this.rand(0, 0.5)));
    const extra = [];
    if (L >= 2 && i >= 1 && (i % 2 === 1 || L >= 8)) extra.push('brute');
    if (L >= 16 && i >= 2 && i % 3 === 2) extra.push('giant');
    w.addWave({ z, count, rate, cx, width, types, hu, extra });
  }

  boss(w, z, final) {
    const L = this.vLevel();
    const spec = bossFor(L);
    const mega = final && this.mode === 'campaign' && isMegaLevel(L);
    const Tb = (7 + 4.5 * sat(L - 1, 20) + 0.015 * Math.min(L, 300)) * spec.hpMul * (mega ? 1.5 : 1) * (this.mode === 'endless' ? 0.8 : 1);
    const hp = niceV(this.edps() * Tb);
    // a short escort wave before the boss
    const rate = Math.max(3, Math.min(30, Math.min(60, this.En) * 1.2));
    const hu = (this.edps() * 0.5) / rate;
    w.addWave({ z, count: Math.round(rate * 5), rate, cx: -0.6, width: 3.2, types: this.hordeTypes(L), hu, extra: [], boss: {
      id: spec.id, spr: spec.spr, final, mega, hp,
      scale: spec.scale * (mega ? 1.2 : 1),
      spd: spec.spd,
      pow: Math.max(2, Math.round(this.En * 0.08 * spec.stomp)),
      coin: Math.round((15 + 2 * L) * (mega ? 2 : 1)),
      minion: spec.minion && { ...spec.minion, hp: hu * ZTYPES[spec.minion.type].hpW },
    } });
  }
}
