// Scene painters, part B: stadium, castle courtyard, harbour, zoo, library.

import { lin, rect, rrFill, poly, ellipse, circle, glow, shade, makeTex, fillTex, tree } from './paint.js';
import { sky, sunGlow, clouds, lampItem, stallItem, barrelItem, crateItem, benchItem, item } from './scenery.js';
import { RES, W, H } from './scene.js';
import { WHITE } from './people.js';

// ---------------------------------------------------------------- STADIUM
export const stadium = {
  id: 'stadium',
  caption: 'capStadium',
  horizon: 380,
  front: 1450,
  haze: '#2b4a7a',
  warm: '#fff4d0',
  paint(g, rnd) {
    sky(g, W, '#0c1a33', '#2d4f82', 420);
    // floodlight towers with glow
    for (const x of [70, 1130]) {
      rect(g, x - 5, 90, 10, 300, '#58636f');
      rrFill(g, x - 34, 70, 68, 34, 6, '#3c464f');
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 2; j++) circle(g, x - 24 + i * 10, 80 + j * 14, 3.8, '#fff8dc');
      }
      glow(g, x, 90, 360, '#fff6d6', 0.22);
    }
    // stands: tiers with seat rows and a crowd made of heads
    fillTex(g, 0, 300, W, 360, makeTex(rnd, 'stone', '#44505e', '#2b333d', RES, 64), RES);
    for (let r = 0; r < 9; r++) {
      const y = 320 + r * 36;
      rect(g, 0, y, W, 34, lin(g, 0, y, 0, y + 34, [shade('#35506e', r * 0.02), shade('#263c57', r * 0.02)]));
      for (let x = 0; x < W; x += 6) {
        const hc = ['#e63946', '#f1faee', '#1d3557', '#ffd166', '#2a9d8f', '#8d99ae', '#ff6f91', '#ffffff'][(rnd() * 8) | 0];
        circle(g, x + rnd() * 6, y + 8 + rnd() * 6, 2.6 + rnd() * 1.1, hc);
        if (rnd() < 0.4) rect(g, x + rnd() * 6, y + 16, 5, 4, hc);
      }
    }
    rect(g, 0, 300, W, 16, '#1b2633');
    // ad boards
    for (let x = 0; x < W; x += 80) {
      rrFill(g, x + 4, 650, 72, 26, 4, ['#f1c40f', '#e63946', '#2a9d8f', '#ffffff', '#3a86ff'][(x / 80) % 5]);
    }
    // pitch
    for (let y = 676; y < H; y += 120) rect(g, 0, y, W, 60, '#3a9d4b');
    for (let y = 736; y < H; y += 120) rect(g, 0, y, W, 60, '#44ae55');
    rect(g, 0, 676, W, 5, '#ffffff');
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(600, 1100, 240, 92, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, 1100);
    g.lineTo(W, 1100);
    g.stroke();
    g.beginPath();
    g.ellipse(600, 1400, 360, 120, 0, Math.PI, 0);
    g.stroke();
    circle(g, 600, 1100, 6, '#ffffff');
    // penalty area lines, left side
    g.beginPath();
    g.rect(-30, 900, 240, 380);
    g.stroke();
    const zones = [
      { x0: 0, x1: W, y0: 325, y1: 640, w: 0.5, target: false },
      { x0: 0, x1: W, y0: 720, y1: 1460, w: 1 },
    ];
    const items = [
      item(1400, (gg) => {
        // goal (left side of pitch, behind the players)
        rect(gg, 6, 1000, 6, 120, '#ffffff');
        rect(gg, 6, 1000, 60, 4, '#ffffff');
        rect(gg, 66, 1000, 4, 120, '#ffffff');
      }, { x0: 0, x1: 70, y0: 1000, y1: 1120 }),
      benchItem(1000, 820, 150, '#2c3e50'),
    ];
    const pal = {
      tops: ['#e63946', '#1d3557', '#f1faee', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#6d597a', '#ff006e', '#3a86ff'],
      tops2: [WHITE, '#ffd166'],
      pants: ['#ffffff', '#1d3557', '#222831', '#2a9d8f', '#e63946'],
      props: ['flag', 'megaphone', 'cup', 'camera', 'ticket', 'bread'],
      propC: ['#e63946', '#ffd166', '#2a9d8f', '#ffffff'],
    };
    const overlay = [
      {
        draw: (gg) => {
          // light cones from the towers
          for (const x of [70, 1130]) {
            gg.fillStyle = lin(gg, x, 110, x * 0.5 + 600 * 0.5, 900, ['rgba(255,250,220,0.12)', 'rgba(255,250,220,0)']);
            gg.beginPath();
            gg.moveTo(x - 18, 110);
            gg.lineTo(x + 18, 110);
            gg.lineTo(600 + (600 - x) * 0.9, 900);
            gg.lineTo(600 - (600 - x) * 0.9, 900);
            gg.closePath();
            gg.fill();
          }
        },
      },
    ];
    return { zones, items, overlay, pal, haze: '#2b4a7a', warm: '#fff4d0', skis: false };
  },
};

// ---------------------------------------------------------------- CASTLE
export const castle = {
  id: 'castle',
  caption: 'capCastle',
  horizon: 700,
  front: 1450,
  haze: '#c8c0b0',
  warm: '#ffb060',
  paint(g, rnd) {
    sky(g, W, '#4f8fd0', '#d4ecf8', 760);
    clouds(g, rnd, 4, 60, 1100, 60, 220, 50, 90, 0.85);
    // distant trees behind the wall
    for (let x = -20; x < W + 40; x += 70) tree(g, rnd, x, 520, 70 + rnd() * 20, shade('#2f6b3a', (rnd() - 0.5) * 0.2), '#3d2a1a');
    // curtain wall with crenellations
    fillTex(g, 0, 470, W, 240, makeTex(rnd, 'stone', '#a79b88', '#6e6453', RES), RES);
    rect(g, 0, 460, W, 16, '#7d7262');
    for (let x = 0; x < W; x += 56) rect(g, x, 430, 30, 32, '#b1a590');
    // towers
    const towers = [[40, 190, 210], [1000, 190, 210], [470, 330, 150]];
    for (const [tx, ty, tw] of towers) {
      fillTex(g, tx, ty, tw, 520, makeTex(rnd, 'stone', '#b0a491', '#6e6453', RES), RES);
      rect(g, tx - 10, ty - 20, tw + 20, 26, '#8d8270');
      for (let x = tx - 10; x < tx + tw + 10; x += 26) rect(g, x, ty - 40, 14, 22, '#8d8270');
      poly(g, [[tx - 14, ty - 40], [tx + tw / 2, ty - 170], [tx + tw + 14, ty - 40]], tx < 400 ? '#8e2f2f' : tx > 900 ? '#2f4a7a' : '#2f6b3a');
      rect(g, tx + tw / 2 - 1.5, ty - 220, 3, 52, '#3a2a1c');
      poly(g, [[tx + tw / 2, ty - 218], [tx + tw / 2 + 26, ty - 208], [tx + tw / 2, ty - 198]], '#f1c40f');
      for (let y = ty + 30; y < ty + 480; y += 90) {
        rrFill(g, tx + tw / 2 - 8, y, 16, 26, 7, '#2a2420');
      }
    }
    // gatehouse arch with portcullis
    rrFill(g, 480, 560, 240, 170, 110, '#2a2420');
    rect(g, 480, 580, 240, 6, '#6e6453');
    for (let x = 500; x < 720; x += 22) rect(g, x, 580, 4, 150, 'rgba(60,50,40,0.7)');
    // banners hung on the wall
    for (const bx of [240, 860]) {
      rect(g, bx - 1.5, 500, 3, 40, '#3a2a1c');
      poly(g, [[bx - 26, 504], [bx + 26, 504], [bx + 26, 580], [bx, 566], [bx - 26, 580]], bx < 500 ? '#8e1b1b' : '#1d3e74');
      circle(g, bx, 530, 6, '#f1c40f');
    }
    // courtyard: cobbles and a royal carpet
    fillTex(g, 0, 700, W, 800, makeTex(rnd, 'stone', '#aaa090', '#746a5a', RES, 128), RES);
    rect(g, 0, 700, W, 800, lin(g, 0, 700, 0, 1500, ['rgba(255,220,160,0)', 'rgba(255,220,160,0)', 'rgba(60,40,20,0.18)']));
    rrFill(g, 500, 700, 200, 800, 4, '#8e2f2f');
    rect(g, 500, 700, 6, 800, '#f1c40f');
    rect(g, 694, 700, 6, 800, '#f1c40f');
    const zones = [
      { x0: 0, x1: W, y0: 730, y1: 1460, w: 1 },
    ];
    const items = [
      item(1220, (gg) => {
        // fountain in the middle of the courtyard
        ellipse(gg, 880, 1220, 110, 30, '#8f8a80');
        ellipse(gg, 880, 1212, 92, 22, '#2e6f96');
        rrFill(gg, 868, 1140, 24, 74, 8, '#9e978d');
        ellipse(gg, 880, 1134, 46, 10, '#9e978d');
        ellipse(gg, 880, 1126, 34, 7, '#2e6f96');
      }, { x0: 770, x1: 990, y0: 1120, y1: 1245 }),
      lampItem(60, 1000, 220, '#2b2b30', '#ffcf7a'),
      lampItem(1140, 1000, 220, '#2b2b30', '#ffcf7a'),
      benchItem(180, 1150, 140, '#6d4a2a'),
      benchItem(850, 900, 120, '#6d4a2a'),
    ];
    for (let i = 0; i < 4; i++) {
      const bx = 110 + i * 300;
      items.push(barrelItem(bx, 1420, 26, '#7b4a25'));
    }
    const pal = {
      tops: ['#8e1b1b', '#1d3e74', '#e0b43b', '#2e6b3b', '#5a3a7a', '#e8e0c4', '#3d3d4a', '#b35a1f'],
      tops2: ['#f4e4b4', '#ffd700'],
      pants: ['#3e2b1a', '#2b2b35', '#4a3320', '#5b1f1f', '#1f3a5a'],
      props: ['flag', 'bread', 'cup', 'basket', 'book', 'fish', 'megaphone'],
      propC: ['#c0392b', '#f1c40f', '#2c3e50', '#8e44ad'],
    };
    return { zones, items, overlay: [], pal, haze: '#c8c0b0', warm: '#ffb060', skis: false };
  },
};

// ---------------------------------------------------------------- HARBOUR
export const harbour = {
  id: 'harbour',
  caption: 'capHarbour',
  horizon: 640,
  front: 1450,
  haze: '#b7d3e0',
  warm: '#ffcf8a',
  paint(g, rnd) {
    sky(g, W, '#4f8fc8', '#ffd9a8', 640);
    sunGlow(g, 420, 430, 40, '#ffe9b0', '#ffd08a');
    clouds(g, rnd, 3, 600, 1150, 80, 220, 50, 80, 0.8);
    // lighthouse
    poly(g, [[1060, 560], [1080, 220], [1110, 220], [1130, 560]], '#f5f1e6');
    for (let y = 300; y < 540; y += 60) poly(g, [[1073 + (560 - y) * 0.0, y], [1131 - (y - 220) * 0.0, y], [1132, y + 24], [1061, y + 24]], '#c0392b');
    rrFill(g, 1074, 180, 42, 40, 6, '#2c3e50');
    glow(g, 1095, 200, 90, '#fff2b0', 0.7);
    rrFill(g, 1088, 190, 14, 22, 3, '#fff8d0');
    poly(g, [[1060, 220], [1095, 160], [1130, 220]], '#c0392b');
    // sea with sun path
    rect(g, 0, 500, W, 150, lin(g, 0, 500, 0, 650, ['#0e4d78', '#1f78a0', '#4aa6c4']));
    fillTex(g, 0, 500, W, 150, makeTex(rnd, 'water', '#1f78a0', '#d8f0ff', RES), RES);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(255,230,170,${0.25 - i * 0.012})`;
      g.fillRect(410 - i * 8, 500 + i * 9, 20 + i * 16, 3);
    }
    // cargo ship on the horizon
    rect(g, 260, 520, 360, 36, '#2c3e50');
    poly(g, [[260, 520], [620, 520], [600, 556], [280, 556]], '#263341');
    rect(g, 540, 470, 60, 50, '#f5f1e6');
    rect(g, 548, 480, 44, 8, '#2c3e50');
    const boxes = ['#e74c3c', '#f1c40f', '#2e86c1', '#27ae60', '#ecf0f1', '#e67e22'];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) rect(g, 300 + c * 38, 484 + r * 0, 36, 36, boxes[(r * 6 + c) % boxes.length]);
    // small sailboats
    for (const [sx, sy] of [[160, 560], [900, 550], [1000, 600]]) {
      poly(g, [[sx, sy - 40], [sx, sy - 2], [sx + 30, sy - 2]], '#fff');
      poly(g, [[sx - 3, sy - 34], [sx - 3, sy - 2], [sx - 22, sy - 2]], '#f5f1e6');
      rect(g, sx - 26, sy - 2, 52, 6, '#c0392b');
    }
    // quay: wooden planks with a stone edge
    rect(g, 0, 640, W, 22, '#4b4f57');
    fillTex(g, 0, 662, W, 838, makeTex(rnd, 'wood', '#8a5a35', '#4b2e18', RES), RES);
    rect(g, 0, 662, W, 838, lin(g, 0, 662, 0, 1500, ['rgba(255,200,130,0)', 'rgba(255,200,130,0)', 'rgba(40,20,5,0.2)']));
    // crane at the left
    rect(g, 60, 300, 12, 360, '#e67e22');
    rect(g, 60, 300, 200, 10, '#e67e22');
    g.strokeStyle = '#e67e22';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(66, 310);
    g.lineTo(230, 500);
    g.lineTo(230, 640);
    g.stroke();
    const zones = [{ x0: 0, x1: W, y0: 690, y1: 1460, w: 1 }];
    const items = [
      crateItem(900, 1200, 110, 80, '#c69a5b'),
      crateItem(1010, 1200, 90, 60, '#8c6239'),
      barrelItem(120, 1000, 26, '#2e6fa0'),
      barrelItem(160, 1010, 26, '#2e6fa0'),
      crateItem(40, 1420, 120, 70, '#c69a5b'),
      item(1450, (gg) => {
        // container stack on the right
        rrFill(gg, 960, 1210, 230, 110, 2, '#2e86c1');
        rrFill(gg, 960, 1100, 230, 110, 2, '#e74c3c');
        rect(gg, 960, 1100, 230, 4, 'rgba(0,0,0,0.2)');
      }, { x0: 958, x1: 1192, y0: 1100, y1: 1450 }),
    ];
    for (let i = 0; i < 3; i++) {
      const x = 380 + i * 220;
      items.push(item(1010 + i * 40, (gg) => {
        rrFill(gg, x - 10, 990 + i * 40, 20, 26, 4, '#4b4f57');
        ellipse(gg, x, 990 + i * 40, 10, 3, '#6b6f78');
      }, { x0: x - 10, x1: x + 10, y0: 980 + i * 40, y1: 1020 + i * 40 }));
    }
    // a moored fishing boat at the quay edge
    items.push(item(780, (gg) => {
      poly(gg, [[300, 700], [520, 700], [500, 730], [320, 730]], '#2e6f8e');
      rect(gg, 300, 700, 220, 4, '#f5f1e6');
      rect(gg, 360, 660, 60, 40, '#f5f1e6');
      rect(gg, 370, 668, 40, 10, '#2e6f8e');
    }, { x0: 300, x1: 520, y0: 660, y1: 735 }));
    const pal = {
      tops: ['#1f3b73', '#f2f2f2', '#c0392b', '#e0a526', '#2f6e6e', '#5b4636', '#3c3c46'],
      tops2: [WHITE, '#1f3b73'],
      pants: ['#2b3a55', '#4a4a52', '#6b5a3e', '#e0d6bd'],
      props: ['bag', 'fish', 'cup', 'basket', 'bread', 'suitcase', 'book'],
      propC: ['#2b2b30', '#c0392b', '#f1c40f', '#8a5a2e'],
    };
    return { zones, items, overlay: [], pal, haze: '#b7d3e0', warm: '#ffcf8a', skis: false };
  },
};

// ---------------------------------------------------------------- ZOO
function animal(g, kind, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (kind === 'elephant') {
    ellipse(g, 0, -60, 70, 44, '#9aa3ad');
    ellipse(g, 66, -92, 34, 30, '#a8b0ba');
    ellipse(g, 46, -110, 20, 30, '#8d959f');
    g.strokeStyle = '#9aa3ad';
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(92, -88);
    g.quadraticCurveTo(110, -60, 96, -30);
    g.stroke();
    for (const lx of [-46, -16, 22, 50]) rrFill(g, lx - 9, -30, 18, 30, 6, '#8d959f');
    circle(g, 78, -98, 3, '#1e1e24');
  } else if (kind === 'giraffe') {
    ellipse(g, 0, -120, 40, 26, '#f0c040');
    for (const [dx, dy] of [[-18, -126], [6, -132], [20, -116], [-6, -110]]) ellipse(g, dx, dy, 7, 5, '#a86b2a');
    g.strokeStyle = '#f0c040';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(30, -120);
    g.lineTo(42, -210);
    g.stroke();
    ellipse(g, 46, -220, 16, 11, '#f0c040');
    circle(g, 56, -226, 2.4, '#1e1e24');
    for (const lx of [-26, -6, 14, 30]) rect(g, lx - 4, -100, 8, 100, '#e6b234');
  } else if (kind === 'zebra') {
    ellipse(g, 0, -70, 60, 34, '#f7f5f0');
    for (let i = -4; i <= 4; i++) rect(g, i * 10 - 2, -100, 4, 60, '#1e1e24');
    g.strokeStyle = '#f7f5f0';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(44, -80);
    g.lineTo(56, -140);
    g.stroke();
    ellipse(g, 62, -150, 20, 15, '#f7f5f0');
    for (const lx of [-40, -18, 18, 40]) rect(g, lx - 4, -40, 8, 40, '#f7f5f0');
  } else if (kind === 'lion') {
    circle(g, 0, -60, 46, '#c0622a');
    circle(g, 58, -80, 28, '#e08a3c');
    ellipse(g, 66, -74, 24, 20, '#f2b064');
    ellipse(g, 26, -98, 14, 9, '#d9873a');
    circle(g, 60, -86, 3, '#1e1e24');
    for (const lx of [-26, -8, 12, 28]) rect(g, lx - 5, -26, 10, 26, '#d9873a');
  } else if (kind === 'flamingo') {
    ellipse(g, 0, -60, 26, 14, '#f56a9a');
    g.strokeStyle = '#f56a9a';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(16, -66);
    g.quadraticCurveTo(34, -110, 22, -132);
    g.stroke();
    ellipse(g, 24, -138, 9, 7, '#f56a9a');
    g.strokeStyle = '#e04f80';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-4, -48);
    g.lineTo(-6, -4);
    g.moveTo(6, -48);
    g.lineTo(8, -4);
    g.stroke();
  } else if (kind === 'penguin') {
    ellipse(g, 0, -34, 18, 32, '#1e1e24');
    ellipse(g, 0, -30, 11, 24, '#f7f5f0');
    circle(g, 0, -62, 12, '#1e1e24');
    poly(g, [[10, -62], [20, -58], [10, -54]], '#f0a020');
  }
  g.restore();
}

export const zoo = {
  id: 'zoo',
  caption: 'capZoo',
  horizon: 650,
  front: 1450,
  haze: '#c7e8d5',
  warm: '#fff0a0',
  paint(g, rnd) {
    sky(g, W, '#6fc4ec', '#eafaff', 640);
    clouds(g, rnd, 4, 40, 1140, 60, 220, 50, 90, 0.9);
    // background trees
    for (let x = -30; x < W + 60; x += 110) tree(g, rnd, x, 560 + rnd() * 20, 110 + rnd() * 30, shade('#2f8a4a', (rnd() - 0.5) * 0.15), '#5a3b22');
    // enclosures: grass, rails and little hills
    fillTex(g, 0, 560, W, 120, makeTex(rnd, 'grass', '#7cc36a', '#3f8f4a', RES), RES);
    for (let x = 0; x < W; x += 56) {
      rect(g, x, 600, 8, 90, '#8b6234');
    }
    rect(g, 0, 612, W, 10, '#a3754a');
    rect(g, 0, 650, W, 8, '#a3754a');
    // the walk
    fillTex(g, 0, 660, W, 840, makeTex(rnd, 'sand', '#e6cfa0', '#b9996a', RES), RES);
    rect(g, 0, 660, W, 840, lin(g, 0, 660, 0, 1500, ['rgba(255,240,200,0)', 'rgba(255,240,200,0)', 'rgba(90,60,20,0.14)']));
    const zones = [{ x0: 0, x1: W, y0: 690, y1: 1460, w: 1 }];
    const items = [];
    const ani = [
      ['elephant', 150, 660, 1.5],
      ['giraffe', 520, 650, 1.3],
      ['zebra', 880, 668, 1.2],
      ['lion', 1080, 610, 0.75],
      ['flamingo', 360, 690, 1.1],
    ];
    for (const [kind, x, y, s] of ani) {
      items.push(item(y, (gg) => animal(gg, kind, x, y, s), { x0: x - 80 * s, x1: x + 90 * s, y0: y - 220 * s, y1: y }));
    }
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 240 + rnd() * 40;
      const y = 1000 + rnd() * 380;
      items.push(item(y, (gg) => animal(gg, 'penguin', x, y, 0.8), { x0: x - 14, x1: x + 14, y0: y - 60, y1: y }));
    }
    items.push(lampItem(40, 1220, 200, '#3d4a2b', '#fff3c4'));
    items.push(lampItem(1160, 1260, 200, '#3d4a2b', '#fff3c4'));
    items.push(benchItem(700, 1420, 150, '#8b6234'));
    items.push(stallItem(230, 1260, 150, '#27ae60', '#fff4e0', ['#f1c40f', '#e74c3c', '#f5b7b1']));
    items.push(stallItem(880, 1080, 140, '#e74c3c', '#fff4e0', ['#f1c40f', '#ecf0f1', '#8e44ad']));
    const pal = {
      tops: ['#e74c3c', '#f1c40f', '#27ae60', '#3498db', '#9b59b6', '#ffffff', '#f39c12', '#1abc9c'],
      tops2: [WHITE, '#ffe066'],
      pants: ['#2c3e50', '#7f8c8d', '#c0a16b', '#34495e', '#2e4053'],
      props: ['balloon', 'icecream', 'camera', 'bag', 'cup', 'book', 'ticket'],
      propC: ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ffffff'],
    };
    return { zones, items, overlay: [], pal, haze: '#c7e8d5', warm: '#fff0a0', skis: false };
  },
};

// ---------------------------------------------------------------- LIBRARY
export const library = {
  id: 'library',
  caption: 'capLibrary',
  horizon: 560,
  front: 1450,
  haze: '#b5a58a',
  warm: '#ffd08a',
  paint(g, rnd) {
    // ceiling with arches
    rect(g, 0, 0, W, 300, lin(g, 0, 0, 0, 300, ['#2a1e15', '#4a3424']));
    for (let x = -40; x < W + 80; x += 240) {
      g.strokeStyle = '#5a4030';
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(x, 300);
      g.quadraticCurveTo(x + 120, 60, x + 240, 300);
      g.stroke();
    }
    // tall windows with light shafts
    for (let x = 80; x < W; x += 260) {
      rrFill(g, x, 110, 90, 180, 40, '#e9d9a6');
      rect(g, x + 42, 110, 6, 180, '#4a3424');
      rect(g, x, 190, 90, 6, '#4a3424');
    }
    // bookshelves covering the back wall
    rect(g, 0, 280, W, 380, '#3a2818');
    const cols = ['#8e2f2f', '#2f5d8a', '#c99a2e', '#2f6b4f', '#5d3a7a', '#7a4a2a', '#d8cba9', '#2c3e50', '#a04a2a'];
    for (let row = 0; row < 6; row++) {
      const y0 = 300 + row * 60;
      rect(g, 0, y0 + 52, W, 8, '#6b4a2e');
      for (let x = 6; x < W - 6; x += 7) {
        const hh = 34 + rnd() * 12;
        const c = cols[(rnd() * cols.length) | 0];
        rect(g, x, y0 + 52 - hh, 5 + rnd() * 1.5, hh, c);
        if (rnd() < 0.3) rect(g, x, y0 + 52 - hh * 0.6, 5, 1.2, 'rgba(255,240,200,0.5)');
      }
    }
    // balcony rail
    rect(g, 0, 560, W, 14, '#6b4a2e');
    for (let x = 0; x < W; x += 18) rect(g, x, 574, 6, 40, '#6b4a2e');
    // floor
    fillTex(g, 0, 600, W, 900, makeTex(rnd, 'wood', '#8c5a34', '#4b2e18', RES), RES);
    rect(g, 0, 600, W, 900, lin(g, 0, 600, 0, 1500, ['rgba(255,200,130,0)', 'rgba(255,200,130,0)', 'rgba(20,8,0,0.25)']));
    // rugs
    rrFill(g, 160, 760, 300, 180, 8, '#7b2a2a');
    rrFill(g, 740, 1040, 340, 220, 8, '#2a4f7b');
    rect(g, 180, 780, 260, 140, 'rgba(241,196,15,0.25)');
    // light shafts
    const overlay = [
      {
        draw: (gg) => {
          for (let x = 60; x < W; x += 260) {
            gg.fillStyle = 'rgba(255,240,200,0.10)';
            gg.beginPath();
            gg.moveTo(x, 290);
            gg.lineTo(x + 90, 290);
            gg.lineTo(x + 260, 1500);
            gg.lineTo(x + 120, 1500);
            gg.closePath();
            gg.fill();
          }
        },
      },
    ];
    const items = [];
    for (const ty of [860, 1220]) {
      for (let x = 60; x < W; x += 380) {
        items.push(item(ty + 24, (gg) => {
          rrFill(gg, x, ty, 260, 46, 4, '#6b4424');
          rrFill(gg, x + 6, ty + 4, 248, 6, 2, '#8b5e34');
          rect(gg, x + 200, ty - 36, 4, 36, '#2a2a2a');
          ellipse(gg, x + 202, ty - 42, 16, 8, '#1f7a4a');
          rrFill(gg, x + 50, ty - 12, 40, 8, 1, '#c0392b');
          rrFill(gg, x + 90, ty - 10, 40, 6, 1, '#2e86c1');
        }, { x0: x, x1: x + 260, y0: ty - 44, y1: ty + 50 }));
      }
    }
    const zones = [
      { x0: 0, x1: W, y0: 690, y1: 1460, w: 1 },
      { x0: 0, x1: W, y0: 610, y1: 650, w: 0.25, target: false },
    ];
    const pal = {
      tops: ['#5d4037', '#2e4a62', '#7b3f61', '#2f5d50', '#8d6e63', '#37474f', '#ad8b4e', '#ffffff'],
      tops2: [WHITE, '#d7ccc8'],
      pants: ['#263238', '#3e2723', '#4e342e', '#37474f', '#1a237e'],
      props: ['book', 'cup', 'bag', 'camera', 'ticket'],
      propC: ['#8e44ad', '#c0392b', '#2c3e50', '#f1c40f'],
    };
    return { zones, items, overlay, pal, haze: '#b5a58a', warm: '#ffd08a', skis: false };
  },
};

