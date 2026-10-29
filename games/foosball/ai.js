// Foosball AI. Reads only the (delayed) ball state, drives rods through the same API as a human
// (target x + kick) so slide speed / rod limits are enforced by the simulation itself.
import { T, clamp, mulberry, manX, footY, setRodTarget, kickRod, chargeRod, goalX0, goalX1 } from './physics.js';

export const DIFFS = { easy: 0.12, normal: 0.5, hard: 0.92 };

export function aiParams(skill) {
  const k = clamp(skill, 0, 1);
  return {
    delay: 0.42 - 0.28 * k, // perception delay (s)
    noise: 7.5 - 5.5 * k, // prediction error sd (units)
    vmax: 40 + 86 * k, // max slide speed
    cd: 1.0 - 0.7 * k, // min time between kicks of one rod
    react: 0.3 - 0.24 * k, // time ball must sit in the strike zone before kicking
    aimSkill: 0.15 + 0.8 * k,
  };
}

const gauss = (r) => {
  let a = 0;
  for (let i = 0; i < 4; i++) a += r();
  return (a - 2) * 1.7;
};

function foldX(x) {
  const lo = T.R, hi = T.W - T.R, w = hi - lo;
  let u = (x - lo) % (2 * w);
  if (u < 0) u += 2 * w;
  return lo + (u > w ? 2 * w - u : u);
}

export function createAI(team, skill, seed = 7) {
  const P = aiParams(skill);
  const rnd = mulberry(seed * 977 + team * 31 + 5);
  const hist = [];
  const noise = {};
  const st = {};
  let nextNoise = 0;
  const ai = {
    team, skill, params: P,
    update(s, dt) {
      const now = s.time;
      const b0 = s.ball;
      hist.push({ t: now, x: b0.x, y: b0.y, vx: b0.vx, vy: b0.vy });
      while (hist.length > 2 && hist[1].t <= now - P.delay) hist.shift();
      const b = hist[0];
      if (now >= nextNoise) {
        nextNoise = now + 0.25;
        for (const r of s.rods) if (r.team === team) noise[r.i] = gauss(rnd) * P.noise;
      }
      for (const r of s.rods) {
        if (r.team !== team) continue;
        r.vmax = P.vmax;
        const q = st[r.i] || (st[r.i] = { cd: 0, zone: 0, until: 0, dir: 0 });
        q.cd -= dt;
        // where will the ball cross this rod?
        let px = b.x;
        if (Math.abs(b.vy) > 6) {
          const tt = (r.y - b.y) / b.vy;
          if (tt > 0 && tt < 1.2) px = foldX(b.x + b.vx * tt);
        }
        px = clamp(px + (noise[r.i] || 0), 2, T.W - 2);
        const rel = (b.y - r.y) * r.s; // > 0: ball is ahead of the rod (towards the opponent)
        let target;
        const slow = Math.hypot(b.vx, b.vy) < 25;
        const base = { ...r, x: 0 };
        const nearestMan = (x) => {
          let best = 0, bd = 1e9;
          for (let k = 0; k < r.n; k++) {
            const d = Math.abs(manX(base, k) - x);
            if (d < bd) { bd = d; best = k; }
          }
          return best;
        };
        const windup = slow && rel > -6.5 && rel < 5;
        if (!windup && rel > -4.6 && rel <= 0.6) {
          // fast ball level with the rod: do not shove it sideways, clear the men away from it
          let best = r.x, bd = 1e9;
          for (let c = -r.slide; c <= r.slide + 1e-6; c += 1) {
            let m = 1e9;
            for (let k = 0; k < r.n; k++) m = Math.min(m, Math.abs(manX({ ...r, x: c }, k) - b.x));
            if (m < 5) continue;
            const d = Math.abs(c - r.x);
            if (d < bd) { bd = d; best = c; }
          }
          target = best;
        } else if (windup || (rel > 0.6 && rel < 16)) {
          const best = nearestMan(px);
          target = px - manX(base, best);
          if (windup && r.ph === 0 && s.phase === 'play' && q.cd <= 0) chargeRod(s, r.i);
          // strike?
          const man = manX(r, best);
          const fy = footY(r);
          const dx = Math.abs(man - b.x);
          const ahead = (b.y - fy) * r.s;
          const inZone = dx < 2.7 && ahead > 0.4 && ahead < 9;
          q.zone = inZone ? q.zone + dt : 0;
          if (inZone && q.zone >= P.react && q.cd <= 0 && s.phase === 'play' && r.ph !== 2) {
            const bsp = Math.hypot(b.vx, b.vy);
            let power = r.kind === 'att' ? 0.95 : r.kind === 'mid' ? 0.62 : r.kind === 'def' ? 0.8 : 0.7;
            if (bsp > 120) power = Math.min(power, 0.55);
            power = clamp(power + (rnd() - 0.5) * 0.2 * (1 - P.aimSkill), 0.2, 1);
            if (kickRod(s, r.i, power)) {
              q.cd = P.cd;
              q.zone = 0;
              // shoot at the side away from the keeper by sliding while striking
              if (r.kind === 'att' || r.kind === 'mid') {
                const gx = (goalX0 + goalX1) / 2;
                const dir = b.x > gx ? -1 : 1;
                q.dir = dir * (rnd() < P.aimSkill ? 1 : -1);
                q.until = now + 0.14;
              }
            }
          }
          if (q.until > now) target = r.x + q.dir * 14;
        } else if (r.kind === 'gk') {
          target = T.W / 2 + (px - T.W / 2) * 0.62 - T.W / 2;
        } else {
          target = px - manX(base, nearestMan(px));
        }
        if (r.ph === 1 && !windup) kickRod(s, r.i, 0.3);
        setRodTarget(s, r.i, target);
      }
    },
  };
  return ai;
}
