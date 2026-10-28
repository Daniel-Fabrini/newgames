// Procedural level generation. Campaign levels are fully generated from the
// level number (seeded); survival mode streams segments forever with rising
// difficulty. Everything is sized from an "expected squad" estimate E and a
// nominal per-soldier DPS so numbers stay meaningful at any level.

import { rng } from '../../js/core/ui.js';
import { ZTYPES, bossFor, isMegaLevel } from './data.js';

const sat = (x, k) => 1 - Math.exp(-x / k);
export const niceV = (v) => {
  v = Math.max(1, v);
  if (v < 30) return Math.round(v);
  if (v < 200) return Math.round(v / 5) * 5;
  if (v < 2000) return Math.round(v / 10) * 10;
  return Math.round(v / 100) * 100;
};
const ROADX = 136;

export class Gen {
  // o: { mode: 'campaign'|'endless', level, seed, pNom, E0 }
  constructor(o) {
    this.mode = o.mode;
    this.level = o.level || 1;
    this.r = rng((o.seed >>> 0) || 1);
    this.pNom = o.pNom;
    this.E0 = o.E0;
    this.E = o.E0;
    this.z = 650;
    this.seg = 0;
    this.threats = 0;
    this.crateKind = Math.floor(this.r() * 3);
    if (this.mode === 'campaign') {
      const x = this.level - 1;
      this.x0 = x;
      this.length = Math.round(4600 + 2800 * sat(x, 14) + 10 * Math.min(x, 300));
      this.Eend = this.E0 * (5 + 3 * sat(x, 25)) + 10 + 1.5 * Math.min(x, 400);
      this.spacing = 1 - 0.2 * sat(x, 25);
      this.ease = 0.7 + 0.3 * Math.min(1, x / 6);
    } else {
      this.length = Infinity;
      this.nextBoss = 4600;
      this.ease = 1;
      this.bossCount = 0;
    }
  }

  rand(a, b) {
    return a + (b - a) * this.r();
  }
  pick(arr) {
    return arr[Math.floor(this.r() * arr.length)];
  }

  // Difficulty index and "virtual level" at a given distance.
  xAt(z) {
    return this.mode === 'campaign' ? this.x0 : 1.5 + z / 430;
  }
  vLevel(z) {
    return this.mode === 'campaign' ? this.level : Math.floor(2 + z / 520);
  }
  Etarget(z) {
    if (this.mode === 'campaign') return this.E0 + (this.Eend - this.E0) * Math.min(1, z / this.length);
    return this.E0 * (1.3 + z / 4000) + 4 + z / 450;
  }
  Tk(x) {
    if (this.mode === 'campaign') return (1.4 + 1.6 * sat(x, 18) + 0.006 * x) * this.ease;
    return 1.2 + 0.06 * x;
  }
  lossAfterThreat(x) {
    this.E = Math.max(this.E0 * 0.6, this.E * (1 - (0.06 + 0.1 * sat(x, 20))));
  }

  // Fill the world with segments until `toZ`.
  fill(w, toZ) {
    if (this.mode === 'campaign') {
      if (this.done) return;
      this.campaignLayout(w);
      this.done = true;
      return;
    }
    while (this.z < toZ) {
      // survival adapts to the real squad so it can never snowball forever
      this.E = Math.max(this.E0 * 0.6, 0.4 * this.E + 0.6 * w.sq.n);
      this.pNom = w.lo.dmg * w.lo.rate * w.buff.dmg * w.buff.rate;
      if (this.z >= this.nextBoss) {
        const vL = this.vLevel(this.z);
        this.placeBoss(w, this.z + 200, vL, this.xAt(this.z), true);
        this.z += 1100;
        this.nextBoss = this.z + 4200 + Math.min(2000, this.bossCount * 300);
        this.bossCount++;
        continue;
      }
      const x = this.xAt(this.z);
      if (this.seg % 2 === 0) {
        this.gate(w, this.z, x, 3);
        this.z += this.rand(430, 520) * Math.max(0.75, 1 - x * 0.006);
      } else {
        this.threat(w, this.z, x, this.pickThreat(x, this.vLevel(this.z)));
        this.z += this.rand(560, 660) * Math.max(0.72, 1 - x * 0.006);
      }
      this.seg++;
    }
  }

  campaignLayout(w) {
    const L = this.level;
    const x = this.x0;
    // positions
    const segs = [];
    let z = 650;
    let i = 0;
    while (z < this.length - 380) {
      const kind = i % 2 === 0 ? 'gate' : 'threat';
      segs.push({ z, kind });
      z += (kind === 'gate' ? this.rand(430, 520) : this.rand(570, 670)) * this.spacing;
      i++;
    }
    if (segs[segs.length - 1].kind === 'threat' && segs.length > 3) {
      /* keep: a threat right before the boss is fine */
    }
    // Threat plan
    const threatSegs = segs.filter((s) => s.kind === 'threat');
    let plan;
    if (L === 1) plan = ['horde', 'crate', 'horde', 'crate', 'horde'];
    else plan = threatSegs.map(() => this.pickThreat(x, L));
    const fresh = Object.keys(ZTYPES).find((k) => ZTYPES[k].from === L && L > 1);
    if (fresh && plan.length > 1) plan[1] = fresh === 'brute' || fresh === 'giant' ? fresh : 'fresh:' + fresh;
    let ti = 0;
    let gatesLeft = segs.filter((s) => s.kind === 'gate').length;
    for (const s of segs) {
      if (s.kind === 'gate') {
        this.gate(w, s.z, x, gatesLeft);
        gatesLeft--;
      } else {
        this.threat(w, s.z, x, plan[ti++] || 'horde');
      }
    }
    this.placeBoss(w, this.length, L, x, false);
  }

  pickThreat(x, vL) {
    const opts = [['horde', 4], ['crate', 2]];
    if (vL >= 3) opts.push(['barrels', 1.5]);
    if (vL >= 2) opts.push(['brute', 1.5]);
    if (vL >= 4) opts.push(['runners', 1.2]);
    if (vL >= 26) opts.push(['giant', 1]);
    let tot = 0;
    for (const o of opts) tot += o[1];
    let k = this.r() * tot;
    for (const o of opts) {
      k -= o[1];
      if (k <= 0) return o[0];
    }
    return 'horde';
  }

  // ------------------------------------------------------------ gates
  goodOp(E, need, avoid) {
    const r = this.r();
    if (avoid !== 'x3' && need >= 2.5 && E < 400 && r < 0.4) return { op: 'x', v: 3 };
    if (avoid !== 'x2' && need >= 1.65 && E < 900 && r < 0.6) return { op: 'x', v: 2 };
    return { op: '+', v: niceV(Math.max(3, E * (need - 1) * this.rand(0.85, 1.25))) };
  }
  badOp(E) {
    if (E >= 8 && this.r() < 0.3) return { op: '/', v: 2 };
    return { op: '+', v: -niceV(Math.max(2, E * this.rand(0.25, 0.55))) };
  }
  static apply(n, g) {
    if (!g) return n;
    if (g.op === 'x') return n * g.v;
    if (g.op === '/') return Math.floor(n / g.v);
    return n + g.v;
  }

  stragglers(w, z, x) {
    const E = this.E;
    const n = 2 + Math.floor(this.r() * 3) + Math.min(4, Math.floor(x / 8));
    const types = this.hordeTypes(this.vLevel(z));
    for (let i = 0; i < n; i++) {
      const k = this.pickType(types);
      w.addZombie(k, this.rand(-ROADX, ROADX), z + this.rand(0, 160), E * this.pNom * 0.1 * ZTYPES[k].hpW, Math.max(0.5, E * 0.03 * ZTYPES[k].powW));
    }
  }

  gate(w, z, x, gatesLeft) {
    this.stragglers(w, z + 230, x);
    const E = this.E;
    const h = Math.max(1, Math.min(3, gatesLeft));
    const tgt = this.Etarget(z + 1100 * h);
    const need = Math.min(3.2, Math.max(this.mode === 'endless' ? 1.08 : 1.18, Math.pow(Math.max(1, tgt) / E, 1 / h)));
    const roll = this.r();
    let A;
    let B;
    let gain;
    const vL = this.vLevel(z);
    const first = !this.gatesMade;
    this.gatesMade = (this.gatesMade || 0) + 1;
    if (first) {
      A = this.goodOp(E, need);
      B = this.goodOp(E, Math.max(1.2, need * this.rand(0.7, 0.9)), A.op === 'x' ? 'x' + A.v : null);
      if (B.op === A.op && B.v === A.v) B = { op: '+', v: niceV(Math.max(2, E * (need - 1) * 0.6)) };
      gain = Math.max(Gen.apply(E, A), Gen.apply(E, B));
    } else if (vL >= 2 && roll < 0.2) {
      // Shootable gate: starts negative and grows +1 per `step` damage.
      const start = -niceV(Math.max(3, E * this.rand(0.2, 0.4)));
      A = { op: '+', v: start, shoot: true, step: this.pNom * (2.4 + 0.8 * sat(x, 20)) };
      B = this.r() < 0.5 ? this.badOp(E) : { op: '+', v: niceV(Math.max(2, E * this.rand(0.2, 0.35))) };
      gain = E * 1.5;
    } else if (vL >= 3 && roll < 0.36) {
      // Guarded gate: a barricade protects the better door.
      A = this.goodOp(E, need);
      B = this.r() < 0.5 ? this.badOp(E) : { op: '+', v: niceV(Math.max(2, E * (need - 1) * 0.4)) };
      gain = Gen.apply(E, A);
      const side = this.r() < 0.5 ? 0 : 1;
      if (side === 1) [A, B] = [B, A];
      w.addObj('wall', side === 0 ? -75 : 75, z - 190, {
        w: 66,
        hp: E * this.pNom * (0.8 + 0.5 * sat(x, 20)),
        power: E * 0.28,
      });
      w.addGate(z, A, B);
      this.E = Math.max(E, gain * 0.95);
      return;
    } else if (roll < 0.7) {
      // Two good doors: think before you choose (+15 or ×2?).
      A = this.goodOp(E, need);
      B = this.goodOp(E, Math.max(1.2, need * this.rand(0.75, 0.95)), A.op === 'x' ? 'x' + A.v : null);
      if (B.op === A.op && B.v === A.v) B = { op: '+', v: niceV(Math.max(2, E * (need - 1) * 0.6)) };
      gain = Math.max(Gen.apply(E, A), Gen.apply(E, B));
    } else {
      A = this.goodOp(E, need);
      B = this.badOp(E);
      gain = Gen.apply(E, A);
    }
    if (this.r() < 0.5) [A, B] = [B, A];
    w.addGate(z, A, B);
    this.E = Math.max(E, gain * 0.95);
  }

  // ------------------------------------------------------------ threats
  hordeTypes(vL) {
    const t = [['walker', 1]];
    if (vL >= 4) t.push(['runner', 0.35]);
    if (vL >= 8) t.push(['armored', 0.3]);
    if (vL >= 13) t.push(['bloater', 0.12]);
    if (vL >= 18) t.push(['crawler', 0.3]);
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
    return 'walker';
  }

  horde(w, z, x, { tk = 1, pow = 1, n = null, cx = null, types = null, spreadZ = 1 } = {}) {
    const E = this.E;
    const vL = this.vLevel(z);
    const count = n || Math.round(Math.min(16 + Math.min(8, x / 10), 4 + 9 * sat(x, 15) + 3 * this.r()));
    const list = [];
    const ty = types || this.hordeTypes(vL);
    for (let i = 0; i < count; i++) list.push(this.pickType(ty));
    let hw = 0;
    let pw = 0;
    for (const k of list) {
      hw += ZTYPES[k].hpW;
      pw += ZTYPES[k].powW;
    }
    const totalHP = E * this.pNom * this.Tk(x) * tk;
    const totalPow = E * (0.45 + 0.25 * sat(x, 20)) * pow;
    const c = cx === null ? this.pick([-70, 0, 70]) + this.rand(-15, 15) : cx;
    const rad = 34 + count * 4;
    for (let i = 0; i < count; i++) {
      const k = list[i];
      const a = this.r() * Math.PI * 2;
      const rr = Math.sqrt(this.r()) * rad;
      const zx = Math.max(-ROADX, Math.min(ROADX, c + Math.cos(a) * rr * 1.3));
      const zz = z + Math.sin(a) * rr * 1.2 * spreadZ;
      w.addZombie(k, zx, zz, (totalHP * ZTYPES[k].hpW) / hw, (totalPow * ZTYPES[k].powW) / pw);
    }
    return c;
  }

  threat(w, z, x, kind) {
    const E = this.E;
    const P = this.pNom;
    if (kind.startsWith('fresh:')) {
      // Introduce a new enemy type: a horde made mostly of it.
      const k = kind.slice(6);
      this.horde(w, z, x, { types: [[k, 3], ['walker', 1]], n: 8 });
    } else if (kind === 'horde') {
      this.horde(w, z, x, this.level === 1 && this.mode === 'campaign' ? { tk: 0.6, n: 5 + this.threats * 2 } : {});
    } else if (kind === 'brute' || kind === 'giant') {
      const giant = kind === 'giant';
      const cnt = !giant && x >= 12 && this.r() < 0.35 ? 2 : 1;
      for (let i = 0; i < cnt; i++) {
        const bx = cnt === 1 ? this.rand(-50, 50) : i === 0 ? -70 : 70;
        const hp = (E * P * (giant ? 2.6 + sat(x, 30) : 1.5 + 1.1 * sat(x, 20))) / cnt;
        w.addZombie(kind, bx, z + this.rand(-20, 20), hp, (E * (giant ? 0.55 : 0.32)) / cnt);
      }
      this.horde(w, z - 160, x, { tk: 0.35, n: 3 + Math.floor(this.r() * 3), pow: 0.4 });
    } else if (kind === 'runners') {
      const types = [['runner', 1]];
      if (this.vLevel(z) >= 18) types.push(['crawler', 0.6]);
      this.horde(w, z + 200, x, { tk: 0.65, pow: 0.8, n: Math.round(5 + 6 * sat(x, 20)), types, spreadZ: 1.6 });
    } else if (kind === 'barrels') {
      const c = this.horde(w, z, x, { tk: 0.85 });
      const nb = 2 + (this.r() < 0.5 ? 1 : 0);
      for (let i = 0; i < nb; i++) {
        w.addObj('barrel', Math.max(-ROADX, Math.min(ROADX, c + this.rand(-55, 55))), z - 70 + i * 60 + this.rand(-15, 15), {
          w: 11,
          hp: E * P * 0.12,
          power: E * 0.12,
          boom: E * P * 1.0,
        });
      }
    } else if (kind === 'crate') {
      const side = this.r() < 0.5 ? -75 : 75;
      const reward = ['rate', 'dmg', 'troops'][this.crateKind++ % 3];
      w.addObj('crate', side, z, {
        w: 22,
        hp: E * P * (this.level === 1 && this.mode === 'campaign' ? 0.6 : 0.9 + 0.5 * sat(x, 20)),
        power: 0,
        reward,
        amount: reward === 'troops' ? niceV(Math.max(3, E * 0.3)) : reward === 'rate' ? 0.25 : 0.3,
      });
      this.horde(w, z - 230, x, { tk: 0.45, pow: 0.6, cx: side, n: 3 + Math.floor(this.r() * 3) });
    }
    this.threats++;
    this.lossAfterThreat(x);
  }

  placeBoss(w, stopZ, vL, x, endless) {
    const spec = bossFor(vL);
    const mega = !endless && isMegaLevel(vL);
    const E = this.E;
    const Tb = (endless ? 5 + 0.07 * x : 6.5 + 3 * sat(x, 25) + 0.012 * x) * spec.hpMul * (mega ? 1.35 : 1) * this.ease;
    w.addBoss(stopZ, {
      id: spec.id,
      mega,
      hp: E * this.pNom * Tb,
      power: Math.max(1, E * 0.11 * spec.stomp),
      spd: spec.spd,
      r: spec.r * (mega ? 1.2 : 1) * 1.3,
      scale: mega ? 1.2 : 1,
      coin: Math.round((15 + 2 * vL) * (mega ? 2 : 1)),
      minion: spec.minion && {
        ...spec.minion,
        hp: E * this.pNom * 0.12,
        power: Math.max(0.5, E * 0.03),
      },
    });
    this.lossAfterThreat(x);
  }
}
