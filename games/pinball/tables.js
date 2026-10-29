// Pinball Pro — table definitions (pure data, no DOM). Coordinates: x right, y down, table 400 x 800 units.
export const W = 400;
export const H = 800;
export const XC = 182; // axis of symmetry of the playfield (between the left wall and the launch-lane wall)
export const LANE_X = 369;
export const BALL_START = { x: LANE_X, y: 768 };
const mx = (x) => 2 * XC - x;

function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Chaikin corner cutting (keeps the end points): rounded ramp rails that the ball follows exactly
function smoothPath(path, iters = 2) {
  let p = path.map((q) => [q[0], q[1]]);
  for (let k = 0; k < iters; k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

function build(opts) {
  const segs = [];
  const wall = (x1, y1, x2, y2, e = 0.42, extra = {}) => segs.push({ x1, y1, x2, y2, e, kind: 'wall', ...extra });
  const poly = (pts, e) => {
    for (let i = 0; i < pts.length - 1; i++) wall(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], e);
  };
  // outer shell: top arc, side walls, launch lane
  poly(arc(200, 200, 186, Math.PI, Math.PI * 2, 56), 0.3);
  wall(14, 200, 14, 805);
  wall(386, 200, 386, 805);
  wall(350, 206, 350, 790);
  wall(350, 777, 386, 777);
  // one-way gate at the top of the launch lane (front side = up/left)
  const gl = Math.hypot(18, 33);
  segs.push({ x1: 386, y1: 183, x2: 353, y2: 201, e: 0.3, kind: 'gate', oneway: [-18 / gl, -33 / gl] });

  // lane guides, in/out-lane dividers, slingshots, aprons (left, then mirrored)
  const slings = [];
  const piv = opts.pivotDX; // flipper pivot distance from the axis
  const py = 702;
  const rest = (30 * Math.PI) / 180;
  for (const side of ['L', 'R']) {
    const m = side === 'L' ? (x) => x : mx;
    const w = (x1, y1, x2, y2, e, ex) => wall(m(x1), y1, m(x2), y2, e, ex);
    w(44, 545, 44, 640, 0.35); // divider between outlane and inlane
    // inlane floor ("apron") down to the flipper pivot
    const ax = XC - piv - 5;
    const ay = py - 9;
    w(44, ay - (ax - 44) * Math.tan(rest), ax, ay, 0.2);
    // slingshot triangle
    const A = [70, 540], B = [70, 615], C = [108, 646];
    const pts = [A, B, C].map(([x, y]) => [m(x), y]);
    wall(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 0.35);
    wall(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 0.35);
    const cen = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
    segs.push({ x1: pts[0][0], y1: pts[0][1], x2: pts[2][0], y2: pts[2][1], e: 0.3, kind: 'sling', id: side === 'L' ? 0 : 1, kick: 560, cen });
    slings.push({ side, pts });
  }

  const flippers = [];
  const mkFlip = (side, x, y, len, rr0, rr1, rst, up, btn) =>
    flippers.push({ side, px: x, py: y, len, r0: rr0, r1: rr1, rest: (rst * Math.PI) / 180, up: (up * Math.PI) / 180, btn, up_speed: 24, down_speed: 13 });
  mkFlip('L', XC - piv, py, 60, 9, 5.5, 30, -26, 'L');
  mkFlip('R', XC + piv, py, 60, 9, 5.5, 30, -26, 'R');
  for (const f of opts.extraFlippers || []) mkFlip(f.side, f.x, f.y, f.len, 8, 5, f.rest, f.up, f.btn);

  // targets
  const drops = [];
  for (const d of opts.drops) {
    for (let i = 0; i < d.n; i++) {
      const y1 = d.y + i * 19;
      const id = drops.length;
      drops.push({ x: d.x, y: y1 + 8.5, face: d.face });
      segs.push({ x1: d.x, y1, x2: d.x, y2: y1 + 17, e: 0.25, kind: 'drop', id });
    }
  }
  const standups = [];
  for (const s of opts.standups) {
    const id = standups.length;
    standups.push(s);
    segs.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, e: 0.3, kind: 'standup', id });
  }
  // lane posts at the top
  const lanes = opts.lanes.map((x, i) => ({ x, y: 88, r: 13, ch: opts.laneLetters[i], color: (opts.laneColors || [])[i] || '#ffffff' }));
  const sp = opts.lanes[1] - opts.lanes[0];
  for (let i = 0; i <= opts.lanes.length; i++) {
    const x = opts.lanes[0] - sp / 2 + i * sp;
    wall(x, 70, x, 104, 0.45);
  }
  for (const g of opts.guides || []) wall(g[0], g[1], g[2], g[3], 0.4);

  return {
    id: opts.id,
    W,
    H,
    theme: opts.theme,
    segs,
    slings,
    bumpers: opts.bumpers.map((b, i) => ({ r: 21, kick: 540, e: 0.5, ...b, id: i })),
    posts: (opts.posts || []).map((p) => ({ r: 5, ...p })),
    flippers,
    drops,
    standups,
    lanes,
    laneLetters: opts.laneLetters,
    spinner: opts.spinner,
    ramps: opts.ramps.map((r) => ({ ...r, path: smoothPath(r.path) })),
    inlanes: [
      { x: 57, y: 596, r: 11, side: 'L' },
      { x: mx(57), y: 596, r: 11, side: 'R' },
    ],
    outlanes: [
      { x: 29, y: 610, r: 13, side: 'L', kickback: opts.kickback === 'L' },
      { x: mx(29), y: 610, r: 13, side: 'R', kickback: opts.kickback === 'R' },
    ],
    drainY: 792,
    launch: BALL_START,
    missions: opts.missions,
    unlock: opts.unlock || null,
    deco: opts.deco || {},
  };
}

const NEON = () =>
  build({
    id: 'neon',
    pivotDX: 70,
    theme: { bg0: '#1a0b3a', bg1: '#08051a', glow: '#ff3da8', glow2: '#35e0ff', rail: '#f5d36a' },
    bumpers: [{ x: 122, y: 218 }, { x: 242, y: 218 }, { x: 182, y: 290 }],
    posts: [{ x: 92, y: 455 }, { x: 272, y: 455 }],
    lanes: [137, 182, 227],
    laneLetters: ['', '', ''],
    laneColors: ['#46d84a', '#3aa8ff', '#ff8a2a'],
    spinner: { x: 182, y: 172, w: 44 },
    drops: [{ x: 344, y: 384, n: 3, face: 'L' }],
    standups: [
      { x1: 18, y1: 455, x2: 18, y2: 473 },
      { x1: 18, y1: 477, x2: 18, y2: 495 },
    ],
    kickback: 'L',
    ramps: [
      {
        entry: { x: 40, y: 410, r: 15 },
        path: [[40, 410], [40, 340], [52, 250], [90, 170], [140, 128], [230, 128], [290, 160], [320, 236], [322, 296]],
        exit: { x: 322, y: 298, vx: 70, vy: 150 },
      },
    ],
    missions: [
      { id: 'discover', type: 'bumperAll', goal: 3 },
      { id: 'catch', type: 'count', ev: 'ramp', goal: 3 },
      { id: 'train', type: 'count', ev: 'bank', goal: 1 },
      { id: 'battle', type: 'count', ev: 'multiball', goal: 1 },
    ],
    deco: { inserts: [[182, 372], [150, 420], [214, 420], [182, 470]] },
  });

const SPACE = () =>
  build({
    id: 'space',
    pivotDX: 68,
    theme: { bg0: '#06183a', bg1: '#02040e', glow: '#58a6ff', glow2: '#b66bff', rail: '#cfe4ff' },
    bumpers: [{ x: 182, y: 232 }, { x: 128, y: 306 }, { x: 236, y: 306 }],
    posts: [{ x: 120, y: 470 }, { x: 244, y: 470 }],
    lanes: [122, 162, 202, 242],
    laneLetters: ['', '', '', ''],
    laneColors: ['#ff4d6d', '#ffd23a', '#5ad8ff', '#b66bff'],
    spinner: { x: 182, y: 388, w: 44 },
    drops: [{ x: 20, y: 330, n: 3, face: 'R' }],
    standups: [
      { x1: 346, y1: 470, x2: 346, y2: 488 },
      { x1: 346, y1: 492, x2: 346, y2: 510 },
      { x1: 172, y1: 150, x2: 192, y2: 150 },
    ],
    guides: [[262, 100, 300, 150], [102, 100, 66, 140]],
    kickback: 'R',
    extraFlippers: [{ side: 'L', x: 20, y: 470, len: 44, rest: 28, up: -30, btn: 'L' }],
    ramps: [
      {
        entry: { x: 328, y: 420, r: 15 },
        path: [[328, 420], [328, 350], [312, 262], [276, 184], [226, 134], [150, 128], [90, 166], [58, 236], [52, 296]],
        exit: { x: 52, y: 300, vx: -35, vy: 160 },
      },
    ],
    missions: [
      { id: 'discover2', type: 'count', ev: 'lanes', goal: 2 },
      { id: 'catch2', type: 'count', ev: 'ramp', goal: 2 },
      { id: 'train2', type: 'count', ev: 'standup', goal: 6 },
      { id: 'battle2', type: 'count', ev: 'multiball', goal: 1 },
    ],
    unlock: { score: 50000, missions: 6 },
    deco: { inserts: [[182, 520], [150, 440], [214, 440], [182, 340]] },
  });

export const TABLE_IDS = ['neon', 'space'];
const FACT = { neon: NEON, space: SPACE };
export function makeTable(id) {
  return (FACT[id] || NEON)();
}
export const UNLOCK = { space: { score: 50000, missions: 6 } };
