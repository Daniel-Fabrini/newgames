// Goo Builder — 30 handcrafted levels in 5 worlds. Every level has a verified reference solution in solutions.js
// (stock and star thresholds come from that solution, see tests/plan.mjs).
import SOL from './solutions.js';

const BOT = 1500;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ground = (x0, x1, top) => rect(x0, top, x1, BOT);
const anchorsOn = (xs, top) => xs.map((x) => [x, top - 8]);
const spikes = (x0, y0, x1, y1, dir = 'up') => ({ kind: 'spikes', dir, pts: rect(x0, y0, x1, y1) });

export const WORLDS = [
  { id: 1, key: 'w1', sky: ['#7fd3ff', '#e9fbff'], far: '#a5e4b4', mid: '#6fc77f', soil: ['#7a5230', '#4d321c'], top: '#6fd05a', hazard: 'lava', icon: '🌱' },
  { id: 2, key: 'w2', sky: ['#4a7be0', '#bfe6ff'], far: '#9db8f0', mid: '#7c97e8', soil: ['#5d6f9a', '#37446b'], top: '#e9f4ff', hazard: 'lava', icon: '☁️' },
  { id: 3, key: 'w3', sky: ['#4b1d3b', '#d6683f'], far: '#7a2f46', mid: '#5d2440', soil: ['#4a2f2f', '#2a1a1c'], top: '#ff9440', hazard: 'lava', icon: '🌋' },
  { id: 4, key: 'w4', sky: ['#2d3b4f', '#8aa1b8'], far: '#56687e', mid: '#41526a', soil: ['#5a626e', '#2f353e'], top: '#c9d3df', hazard: 'lava', icon: '⚙️' },
  { id: 5, key: 'w5', sky: ['#1a1030', '#5b3a9a'], far: '#3c2870', mid: '#2e1f5c', soil: ['#3f3358', '#241a38'], top: '#f7d774', hazard: 'lava', icon: '👑' },
];

const defs = [];
const add = (d) => defs.push(d);

// ============================================================= WORLD 1 — Meadow
add({
  id: 'w1l1', world: 1, tutorial: 1, bounds: [0, 80, 720, 880], killY: 880,
  terrain: [ground(-200, 220, 620), ground(480, 920, 620)],
  anchors: anchorsOn([40, 100, 160], 620),
  pipe: { x: 600, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 580], [330, 600], [470, 600], [600, 600]],
  stock: { goo: 16 }, stars: [12, 14],
});
add({
  id: 'w1l2', world: 1, bounds: [0, 80, 720, 880], killY: 880,
  terrain: [ground(-200, 190, 620), ground(540, 920, 620)],
  anchors: anchorsOn([30, 90, 150], 620),
  pipe: { x: 630, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 3,
  plan: [[190, 580], [360, 600], [540, 600], [630, 600]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w1l3', world: 1, bounds: [0, -120, 720, 700], killY: 900,
  terrain: [ground(-200, 920, 640)],
  anchors: anchorsOn([200, 270, 340, 410, 480], 640),
  goal: { type: 'height', y: 190, base: 640 }, need: 2,
  plan: [],
  stock: { goo: 24 }, stars: [18, 21],
});
add({
  id: 'w1l4', world: 1, bounds: [0, 60, 720, 900], killY: 900,
  terrain: [ground(-200, 210, 480), ground(470, 920, 700)],
  anchors: anchorsOn([30, 90, 150], 480),
  pipe: { x: 600, y: 680, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[210, 440], [330, 560], [470, 660], [600, 680]],
  stock: { goo: 20 }, stars: [14, 17],
});
add({
  id: 'w1l5', world: 1, bounds: [0, 60, 720, 900], killY: 900,
  terrain: [ground(-200, 200, 700), ground(450, 920, 480)],
  anchors: anchorsOn([30, 90, 150], 700),
  pipe: { x: 590, y: 460, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 660], [330, 580], [450, 500], [590, 460]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w1l6', world: 1, bounds: [0, 60, 720, 900], killY: 900,
  terrain: [ground(-200, 160, 620), ground(330, 400, 740), ground(570, 920, 620)],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 650, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 3,
  plan: [[160, 590], [365, 700], [570, 590], [650, 600]],
  stock: { goo: 24 }, stars: [18, 21],
});

// ============================================================= WORLD 2 — Sky (balloons)
add({
  id: 'w2l1', world: 2, tutorial: 2, bounds: [0, -420, 720, 700], killY: 900,
  terrain: [ground(-200, 920, 640)],
  anchors: anchorsOn([200, 270, 340, 410, 480], 640),
  goal: { type: 'height', y: -120, base: 640 }, need: 2,
  plan: [],
  stock: { goo: 8, balloon: 6 }, stars: [10, 12],
});
add({
  id: 'w2l2', world: 2, bounds: [0, -20, 720, 760], killY: 900,
  terrain: [ground(-200, 200, 660), ground(420, 920, 380)],
  anchors: anchorsOn([30, 90, 150], 660),
  pipe: { x: 580, y: 360, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 480], [300, 420], [420, 380], [580, 360]],
  stock: { goo: 10, balloon: 6 }, stars: [10, 12],
});
add({
  id: 'w2l3', world: 2, bounds: [0, 80, 760, 880], killY: 900,
  terrain: [ground(-200, 150, 620), ground(600, 960, 620)],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 690, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[150, 580], [375, 560], [600, 600], [690, 600]],
  stock: { goo: 14, balloon: 4 }, stars: [12, 14],
});
add({
  id: 'w2l4', world: 2, bounds: [0, -120, 720, 780], killY: 900,
  terrain: [ground(-200, 180, 720), rect(430, 260, 920, BOT)],
  anchors: anchorsOn([30, 90, 150], 720),
  pipe: { x: 580, y: 240, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 500], [330, 380], [430, 260], [580, 240]],
  stock: { goo: 10, balloon: 8 }, stars: [12, 14],
});
add({
  id: 'w2l5', world: 2, bounds: [0, -520, 720, 700], killY: 900,
  terrain: [ground(-200, 920, 640)],
  anchors: anchorsOn([260, 330, 400, 470], 640),
  goal: { type: 'height', y: -300, base: 640 }, need: 2,
  plan: [],
  stock: { goo: 8, balloon: 9, heavy: 2 }, stars: [14, 16],
});
add({
  id: 'w2l6', world: 2, bounds: [0, -60, 760, 800], killY: 900,
  terrain: [ground(-200, 140, 680), rect(300, 500, 400, BOT), ground(580, 960, 400)],
  anchors: anchorsOn([20, 70, 110], 680),
  pipe: { x: 680, y: 380, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[140, 640], [350, 470], [580, 390], [680, 380]],
  stock: { goo: 12, balloon: 6 }, stars: [14, 16],
});

// ============================================================= WORLD 3 — Spike valley
add({
  id: 'w3l1', world: 3, bounds: [0, 80, 720, 880], killY: 900,
  terrain: [ground(-200, 200, 620), ground(520, 920, 620), rect(200, 790, 520, BOT)],
  hazards: [spikes(200, 760, 520, 790)],
  anchors: anchorsOn([20, 80, 140], 620),
  pipe: { x: 620, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 580], [360, 590], [520, 590], [620, 600]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w3l2', world: 3, bounds: [0, 80, 720, 880], killY: 900,
  terrain: [ground(-200, 180, 640), ground(470, 920, 460)],
  hazards: [spikes(180, 300, 470, 360, 'down'), spikes(180, 790, 470, 830)],
  anchors: anchorsOn([20, 80, 140], 640),
  pipe: { x: 600, y: 440, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[180, 600], [320, 560], [470, 460], [600, 440]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w3l3', world: 3, bounds: [0, 80, 760, 880], killY: 900,
  terrain: [ground(-200, 190, 640), ground(430, 960, 640)],
  hazards: [spikes(470, 616, 590, 640), spikes(190, 790, 430, 830)],
  anchors: anchorsOn([20, 80, 140], 640),
  pipe: { x: 690, y: 620, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[190, 600], [330, 560], [470, 560], [620, 610], [690, 620]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w3l4', world: 3, bounds: [0, 80, 760, 880], killY: 900,
  terrain: [ground(-200, 150, 620), ground(510, 960, 620)],
  hazards: [spikes(150, 780, 510, 830)],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 620, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[150, 580], [330, 570], [510, 590], [620, 600]],
  stock: { goo: 18, heavy: 3 }, stars: [14, 16],
});
add({
  id: 'w3l5', world: 3, bounds: [0, 0, 720, 860], killY: 900,
  terrain: [ground(-200, 170, 700), rect(460, 400, 920, BOT)],
  hazards: [spikes(170, 800, 460, 850)],
  anchors: anchorsOn([30, 90, 140], 700),
  pipe: { x: 590, y: 380, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[170, 640], [320, 560], [440, 440], [590, 380]],
  stock: { goo: 14, stake: 4 }, stars: [12, 14],
});
add({
  id: 'w3l6', world: 3, bounds: [0, 60, 760, 880], killY: 900,
  terrain: [ground(-200, 150, 640), ground(560, 960, 560)],
  hazards: [spikes(150, 790, 560, 840), spikes(150, 330, 560, 400, 'down'), spikes(560, 536, 640, 560)],
  anchors: anchorsOn([20, 80, 130], 640),
  pipe: { x: 700, y: 540, r: 32 }, goal: { type: 'pipe' }, need: 3,
  plan: [[150, 600], [350, 590], [560, 520], [700, 540]],
  stock: { goo: 18, heavy: 3, stake: 2 }, stars: [14, 17],
});

// ============================================================= WORLD 4 — Machines
add({
  id: 'w4l1', world: 4, bounds: [0, 0, 720, 880], killY: 900,
  terrain: [ground(-200, 200, 620), ground(520, 920, 620)],
  pendulums: [{ px: 360, py: 150, len: 380, r: 34, amp: 0.8, period: 3.4, phase: 0 }],
  anchors: anchorsOn([20, 80, 140], 620),
  pipe: { x: 620, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[200, 580], [360, 590], [520, 590], [620, 600]],
  stock: { goo: 24 }, stars: [18, 21],
});
add({
  id: 'w4l2', world: 4, bounds: [0, 0, 720, 880], killY: 900,
  terrain: [ground(-200, 190, 620), ground(540, 920, 620)],
  winds: [{ x: 190, y: 200, w: 350, h: 700, fx: 520, fy: 0, period: 3, phase: 0 }],
  anchors: anchorsOn([20, 80, 140], 620),
  pipe: { x: 630, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[190, 580], [360, 590], [540, 590], [630, 600]],
  stock: { goo: 24 }, stars: [18, 21],
});
add({
  id: 'w4l3', world: 4, bounds: [0, 0, 720, 880], killY: 900,
  terrain: [ground(-200, 170, 640), ground(500, 920, 420)],
  movers: [{ pts: rect(-60, -14, 60, 14), cx: 335, cy: 540, ax: 0, ay: 80, period: 5, phase: 0 }],
  anchors: anchorsOn([20, 80, 130], 640),
  pipe: { x: 620, y: 400, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[170, 600], [335, 540], [500, 440], [620, 400]],
  stock: { goo: 22 }, stars: [16, 19],
});
add({
  id: 'w4l4', world: 4, bounds: [0, 0, 760, 880], killY: 900,
  terrain: [ground(-200, 170, 620), ground(580, 960, 620)],
  pendulums: [{ px: 375, py: 100, len: 375, r: 32, amp: 0.7, period: 3.0, phase: 0.25 }],
  winds: [{ x: 170, y: 100, w: 410, h: 800, fx: 180, fy: 0, period: 4, phase: 0.5 }],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 670, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[170, 580], [375, 590], [580, 590], [670, 600]],
  stock: { goo: 26, heavy: 2 }, stars: [20, 23],
});
add({
  id: 'w4l5', world: 4, bounds: [0, 0, 720, 880], killY: 900,
  terrain: [ground(-200, 190, 620), ground(530, 920, 620)],
  movers: [{ pts: rect(-55, -30, 55, 30), cx: 360, cy: 590, ax: 110, ay: 0, period: 4.6, phase: 0 }],
  anchors: anchorsOn([20, 80, 140], 620),
  pipe: { x: 620, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[190, 580], [360, 540], [530, 590], [620, 600]],
  stock: { goo: 24 }, stars: [18, 21],
});
add({
  id: 'w4l6', world: 4, bounds: [0, 0, 760, 880], killY: 900,
  terrain: [ground(-200, 160, 640), ground(600, 960, 500)],
  movers: [{ pts: rect(-50, -14, 50, 14), cx: 380, cy: 600, ax: 0, ay: 70, period: 4, phase: 0.2 }],
  pendulums: [{ px: 380, py: 80, len: 380, r: 30, amp: 0.65, period: 3.2, phase: 0 }],
  winds: [{ x: 160, y: 200, w: 440, h: 700, fx: 320, fy: 0, period: 5, phase: 0.2 }],
  anchors: anchorsOn([20, 80, 130], 640),
  pipe: { x: 690, y: 480, r: 32 }, goal: { type: 'pipe' }, need: 3,
  plan: [[160, 600], [380, 560], [600, 520], [690, 480]],
  stock: { goo: 26, heavy: 3, balloon: 2 }, stars: [20, 23],
});

// ============================================================= WORLD 5 — Grand finale
add({
  id: 'w5l1', world: 5, bounds: [0, 80, 800, 880], killY: 900,
  terrain: [ground(-200, 150, 620), ground(520, 1000, 620)],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 640, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[150, 580], [335, 590], [520, 590], [640, 600]],
  stock: { goo: 14, tacky: 8 }, stars: [14, 16],
});
add({
  id: 'w5l2', world: 5, bounds: [0, -520, 720, 700], killY: 900,
  terrain: [ground(-200, 920, 640)],
  anchors: anchorsOn([240, 310, 380, 450], 640),
  goal: { type: 'height', y: -100, base: 640 }, need: 2,
  plan: [],
  stock: { goo: 14, heavy: 4, balloon: 4 }, stars: [18, 21],
});
add({
  id: 'w5l3', world: 5, bounds: [0, 80, 800, 880], killY: 900,
  terrain: [ground(-200, 140, 620), ground(330, 460, 680), ground(650, 1000, 620)],
  hazards: [spikes(140, 780, 330, 830), spikes(460, 780, 650, 830)],
  anchors: anchorsOn([20, 70, 110], 620),
  pipe: { x: 730, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[140, 600], [395, 660], [650, 600], [730, 600]],
  stock: { goo: 24, tacky: 4 }, stars: [18, 21],
});
add({
  id: 'w5l4', world: 5, bounds: [0, -140, 760, 780], killY: 900,
  terrain: [ground(-200, 170, 700), rect(470, 280, 960, BOT)],
  hazards: [spikes(170, 800, 470, 840)],
  anchors: anchorsOn([20, 80, 130], 700),
  pipe: { x: 600, y: 260, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[170, 640], [320, 480], [470, 300], [600, 260]],
  stock: { goo: 16, balloon: 6, stake: 3 }, stars: [16, 18],
});
add({
  id: 'w5l5', world: 5, bounds: [0, 0, 800, 880], killY: 900,
  terrain: [ground(-200, 150, 620), ground(540, 1000, 620)],
  hazards: [spikes(150, 300, 540, 370, 'down')],
  winds: [{ x: 150, y: 200, w: 390, h: 700, fx: 260, fy: 0, period: 3.6, phase: 0 }],
  anchors: anchorsOn([20, 80, 130], 620),
  pipe: { x: 660, y: 600, r: 32 }, goal: { type: 'pipe' }, need: 2,
  plan: [[150, 580], [345, 590], [540, 590], [660, 600]],
  stock: { goo: 24, heavy: 3 }, stars: [18, 21],
});
add({
  id: 'w5l6', world: 5, bounds: [0, 0, 800, 900], killY: 900,
  terrain: [ground(-200, 150, 660), rect(360, 560, 440, BOT), ground(650, 1000, 480)],
  hazards: [spikes(150, 820, 360, 870), spikes(440, 820, 650, 870), spikes(150, 240, 650, 300, 'down')],
  pendulums: [{ px: 550, py: 120, len: 360, r: 30, amp: 0.7, period: 3.4, phase: 0.1 }],
  anchors: anchorsOn([20, 80, 130], 660),
  pipe: { x: 730, y: 460, r: 32 }, goal: { type: 'pipe' }, need: 3,
  plan: [[150, 620], [400, 540], [650, 500], [730, 460]],
  stock: { goo: 30, heavy: 3, balloon: 3, tacky: 3 }, stars: [24, 27],
});

// open playground for sandbox mode
export const SANDBOX = {
  id: 'sandbox', world: 1, sandbox: true, bounds: [-60, -40, 780, 880], killY: 1000,
  terrain: [
    [[-300, 640], [120, 640], [200, 600], [300, 620], [420, 700], [520, 690], [600, 600], [700, 590], [1000, 600], [1000, BOT], [-300, BOT]],
    rect(250, 360, 320, 430),
  ],
  hazards: [],
  anchors: anchorsOn([30, 90, 150, 600, 660], 640).map(([x, y]) => (x > 500 ? [x, 592] : [x, y])),
  goal: null, stock: {},
};

export const LEVELS = defs.map((d, i) => {
  const sol = SOL[d.id];
  const lv = { ...d, index: i, num: ((i % 6) + 1), solution: sol ? sol.sol : null };
  if (sol) {
    lv.stock = { ...sol.stock };
    lv.stars = [...sol.stars];
  }
  return lv;
});

export const levelById = (id) => LEVELS.find((l) => l.id === id);
export const worldLevels = (w) => LEVELS.filter((l) => l.world === w);
