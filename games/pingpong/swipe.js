// Swipe analysis: turns a pointer stroke into shot parameters.
//   direction (left/right)  -> aim across the table
//   upward component        -> depth (deep shots), smash when strong
//   stroke speed            -> power
//   up/down ratio           -> topspin (brush up) or backspin (chop down)
//   path bulge              -> sidespin (curve)
// The contact moment is the fastest part of the stroke.
import { clamp } from './logic.js';

export function analyzeSwipe(pts, W, H) {
  // pts: [{x, y, t}] in CSS px and seconds
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const chord = Math.hypot(dx, dy);
  let len = 0;
  let bestSp = 0;
  let bestI = pts.length - 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    len += seg;
    const dt = Math.max(0.008, b.t - a.t);
    const sp = seg / dt;
    if (sp > bestSp) {
      bestSp = sp;
      bestI = i;
    }
  }
  // contact = speed-weighted centre of the stroke (the moment the paddle is fastest on average)
  let wsum = 0;
  let tsum = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const sp = seg / Math.max(0.008, b.t - a.t);
    wsum += sp;
    tsum += sp * (a.t + b.t) / 2;
  }
  const contactT = wsum > 0 ? tsum / wsum : pts[bestI].t;
  const dur = Math.max(0.03, last.t - first.t);
  const avgSp = len / dur;
  const speed = Math.max(avgSp * 0.8 + bestSp * 0.2, 0);
  // path bulge from the chord, sampled in the middle of the stroke
  const mid = pts[Math.floor(pts.length / 2)];
  let dev = 0;
  if (chord > 20) {
    dev = -((mid.x - first.x) * dy - (mid.y - first.y) * dx) / chord;
  }
  const vr = len > 1 ? clamp(dy / len, -1, 1) : 0;
  const shot = {
    aim: clamp(dx / (W * 0.3), -1, 1),
    depth: clamp(-dy / (H * 0.2), 0, 1),
    power: clamp((speed - 260) / 1500, 0.05, 1),
    top: clamp(-vr * 1.7, 0, 1),
    back: clamp(vr * 1.7, 0, 1),
    side: clamp((dev / Math.max(chord, 60)) * 3.2, -1, 1),
    smash: false,
  };
  shot.smash = shot.power > 0.72 && shot.depth > 0.55 && shot.top > 0.2;
  // when the hit is very straight, keep side spin off
  if (Math.abs(shot.side) < 0.12) shot.side = 0;
  return { shot, speed, len, contactT, dur, dx, dy };
}
