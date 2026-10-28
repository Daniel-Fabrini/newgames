// Scene painters, part A: beach, station, ski village, medieval market,
// city street, fairground. Each returns the scene description used by scene.js.

import { lin, rect, rrFill, poly, ellipse, circle, glow, shade, makeTex, fillTex, stripedAwning, facade, windowAt, mountain, sparkle, cloud, shadowBlob, bunting, pine, tree } from './paint.js';
import { sky, sunGlow, clouds, hillRow, treeItem, palmItem, pineItem, lampItem, parasolItem, stallItem, barrelItem, crateItem, benchItem, signBoard, item } from './scenery.js';
import { RES, W, H } from './scene.js';
import { WHITE } from './people.js';

// ---------------------------------------------------------------- BEACH
export const beach = {
  id: 'beach',
  caption: 'capBeach',
  horizon: 560,
  front: 1440,
  haze: '#cfe9f4',
  warm: '#ffd27a',
  paint(g, rnd) {
    sky(g, W, '#3d9ee0', '#cdeef9', 640);
    sunGlow(g, 930, 190, 52);
    clouds(g, rnd, 5, 40, 1120, 60, 240, 50, 90, 0.9);
    // far island and headland
    mountain(g, 240, 548, 420, 120, '#6fb0c4');
    mountain(g, 760, 548, 320, 70, '#86c6d6');
    mountain(g, 1080, 548, 260, 150, '#5f9fb4');
    // sea
    rect(g, 0, 470, W, 140, lin(g, 0, 470, 0, 610, ['#1f86c8', '#2ba6dc', '#7ed6ee']));
    fillTex(g, 0, 470, W, 140, makeTex(rnd, 'water', '#2ba6dc', '#e9fbff', RES), RES);
    rect(g, 0, 470, W, 140, 'rgba(40,120,170,0.15)');
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 300 + rnd() * 80;
      const y = 505 + rnd() * 30;
      poly(g, [[x, y - 60], [x, y], [x + 40, y]], '#ffffff');
      poly(g, [[x - 4, y - 46], [x - 4, y], [x - 26, y]], '#f5f7fa');
      rect(g, x - 28, y, 74, 6, '#e9553f');
    }
    // lifeguard tower
    rect(g, 1000, 430, 4, 150, '#e8e0cc');
    rect(g, 1060, 430, 4, 150, '#e8e0cc');
    rect(g, 990, 396, 90, 40, '#f5f1e6');
    rect(g, 984, 380, 102, 18, '#e8553f');
    rect(g, 1000, 410, 16, 14, '#1f5673');
    rect(g, 1036, 410, 16, 14, '#1f5673');
    // wet-sand shoreline foam
    g.beginPath();
    for (let x = 0; x <= W; x += 20) g.lineTo(x, 606 + Math.sin(x * 0.04) * 3);
    g.lineTo(W, 630);
    g.lineTo(0, 630);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fill();
    // sand
    fillTex(g, 0, 620, W, 880, makeTex(rnd, 'sand', '#f2d49c', '#c79f62', RES), RES);
    rect(g, 0, 620, W, 880, lin(g, 0, 620, 0, 1500, ['rgba(255,240,200,0.0)', 'rgba(255,240,200,0.0)', 'rgba(170,110,40,0.12)']));
    // ground decoration (people may stand on these)
    const towels = ['#e8553f', '#2ba6dc', '#ffd166', '#06d6a0', '#ef476f'];
    for (let i = 0; i < 9; i++) {
      const x = 80 + rnd() * 1040;
      const y = 700 + rnd() * 700;
      g.save();
      g.translate(x, y);
      g.rotate((rnd() - 0.5) * 0.25);
      rrFill(g, -34, -14, 68, 28, 3, towels[i % towels.length]);
      rect(g, -34, -4, 68, 3, 'rgba(255,255,255,0.7)');
      g.restore();
    }
    // sandcastle
    const sx = 330;
    const sy = 1010;
    rrFill(g, sx - 60, sy - 60, 120, 60, 6, '#e9c77e');
    rrFill(g, sx - 30, sy - 110, 60, 52, 6, '#eed08c');
    poly(g, [[sx - 34, sy - 108], [sx - 22, sy - 150], [sx - 10, sy - 108]], '#e8553f');
    poly(g, [[sx + 10, sy - 108], [sx + 22, sy - 150], [sx + 34, sy - 108]], '#2ba6dc');
    rect(g, sx - 3, sy - 150, 2, 22, '#5a3a22');
    poly(g, [[sx - 1, sy - 150], [sx + 14, sy - 144], [sx - 1, sy - 138]], '#ffd166');
    // bucket & spade
    rrFill(g, 720, 1170, 40, 36, 4, '#2ba6dc');
    ellipse(g, 740, 1170, 20, 4, shade('#2ba6dc', 0.3));

    const zones = [
      { x0: 0, x1: W, y0: 650, y1: 1460, w: 1 },
      { x0: 0, x1: W, y0: 610, y1: 640, w: 0.2, target: false },
    ];
    const items = [
      palmItem(rnd, 36, 780, 470),
      palmItem(rnd, 1170, 720, 430, '#49a85c'),
      parasolItem(160, 880, 92, '#e8553f', '#fff4e6'),
      parasolItem(560, 760, 78, '#2ba6dc', '#fff4e6'),
      parasolItem(1010, 920, 96, '#ffd166', '#fff4e6'),
      parasolItem(700, 1260, 110, '#06d6a0', '#fff4e6', 140),
    ];
    const pal = {
      tops: ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffffff', '#073b4c', '#f78c6b', '#8ecae6', '#ffb703'],
      tops2: [WHITE, '#fff3c4', '#ffe066'],
      pants: ['#2b2d42', '#e9c46a', '#f4a261', '#264653', '#ffffff', '#90be6d', '#e76f51'],
      props: ['balloon', 'icecream', 'bag', 'cup', 'board', 'bread', 'book', 'ticket'],
      propC: ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ffffff'],
    };
    return { zones, items, overlay: [], pal, haze: '#cfe9f4', warm: '#ffd27a', skis: false };
  },
};

// ---------------------------------------------------------------- STATION
export const station = {
  id: 'station',
  caption: 'capStation',
  horizon: 640,
  front: 1450,
  haze: '#9aa9b8',
  warm: '#ffd7a0',
  paint(g, rnd) {
    // glass roof
    rect(g, 0, 0, W, 360, lin(g, 0, 0, 0, 360, ['#1d3b4a', '#2f5d6e', '#5b8e9a']));
    for (let x = 0; x <= W; x += 60) rect(g, x, 0, 3, 360, 'rgba(10,30,40,0.7)');
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 130;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 70, 0);
      g.lineTo(x + 180, 330);
      g.lineTo(x + 110, 330);
      g.closePath();
      g.fillStyle = 'rgba(255,245,210,0.07)';
      g.fill();
    }
    for (let y = 60; y < 360; y += 60) rect(g, 0, y, W, 2, 'rgba(10,30,40,0.6)');
    // back brick wall with arched windows
    fillTex(g, 0, 330, W, 320, makeTex(rnd, 'stone', '#8c5a48', '#5a3328', RES), RES);
    rect(g, 0, 330, W, 320, 'rgba(20,10,10,0.25)');
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 200;
      rrFill(g, x, 360, 110, 190, 55, '#213644');
      rrFill(g, x + 6, 366, 98, 178, 48, lin(g, 0, 366, 0, 544, ['#8fb8c8', '#315068']));
      rect(g, x + 55, 366, 3, 178, '#213644');
      rect(g, x + 6, 440, 98, 3, '#213644');
    }
    // clock
    circle(g, 600, 300, 44, '#f5ecd6');
    circle(g, 600, 300, 44, 'rgba(0,0,0,0)');
    g.lineWidth = 5;
    g.strokeStyle = '#3a2a1c';
    g.beginPath();
    g.arc(600, 300, 44, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(600, 300);
    g.lineTo(600, 272);
    g.moveTo(600, 300);
    g.lineTo(620, 308);
    g.stroke();
    // train in the bay (background)
    rrFill(g, 100, 500, 700, 110, 14, '#b53a2c');
    rrFill(g, 100, 560, 700, 16, 4, '#2e2e38');
    for (let i = 0; i < 6; i++) {
      rrFill(g, 130 + i * 110, 520, 80, 40, 6, '#cfe4ee');
      rect(g, 130 + i * 110 + 38, 520, 4, 40, '#b53a2c');
    }
    rrFill(g, 820, 430, 260, 180, 16, '#2c7a5a');
    rrFill(g, 830, 440, 110, 56, 8, '#8fc8dc');
    circle(g, 880, 552, 26, '#2e2e38');
    circle(g, 1010, 552, 26, '#2e2e38');
    rect(g, 1050, 380, 16, 56, '#2e2e38');
    // rails and sleepers
    rect(g, 0, 620, W, 24, '#4a4a54');
    rect(g, 0, 644, W, 6, '#6f6f7a');
    for (let x = 0; x < W; x += 24) rect(g, x, 618, 10, 34, '#5a3a22');
    // platform
    fillTex(g, 0, 650, W, 850, makeTex(rnd, 'stone', '#cfc6b6', '#9d978a', RES, 128), RES);
    rect(g, 0, 700, W, 16, '#f1c40f');
    for (let x = 0; x < W; x += 40) rect(g, x, 700, 20, 16, '#2e2e38');
    rect(g, 0, 1420, W, 80, 'rgba(0,0,0,0.15)');

    const zones = [
      { x0: 0, x1: W, y0: 740, y1: 1460, w: 1 },
      { x0: 0, x1: W, y0: 716, y1: 740, w: 0.15, target: false },
    ];
    const items = [];
    for (const x of [120, 1060]) {
      items.push(item(1050, (gg) => {
        rect(gg, x - 18, 380, 36, 670, '#7d8794');
        rect(gg, x - 24, 380, 48, 22, '#9aa5b1');
        rect(gg, x - 18, 380, 36, 4, '#4f5a66');
      }, { x0: x - 24, x1: x + 24, y0: 380, y1: 1050 }));
    }
    items.push(benchItem(740, 1290, 150, '#7b5a3a'));
    items.push(benchItem(180, 1230, 150, '#7b5a3a'));
    items.push(benchItem(890, 1370, 150, '#7b5a3a'));
    for (let i = 0; i < 3; i++) {
      const x = 420 + i * 110;
      const y = 1300 + i * 10;
      items.push(item(y, (gg) => {
        rrFill(gg, x - 26, y - 56, 52, 44, 4, '#2a4e7a');
        rrFill(gg, x - 22, y - 52, 44, 36, 3, '#e9e4d6');
        gg.fillStyle = '#2a4e7a';
        gg.fillRect(x - 26, y - 14, 52, 4);
        rect(gg, x - 20, y - 2, 4, 2, '#000');
        rect(gg, x - 20, y - 2, 4, 2, '#000');
      }, { x0: x - 26, x1: x + 26, y0: y - 56, y1: y }));
    }
    // suitcases on carts
    items.push(crateItem(60, 1400, 80, 40, '#a5562b'));
    items.push(crateItem(1080, 1400, 80, 40, '#2f5d8a'));
    // info board (sign with arrow shapes, no text)
    items.push(item(1200, (gg) => {
      signBoard(gg, 470, 1030, 180, 52, '#1e3a5a');
      gg.fillStyle = '#f5ecd6';
      gg.beginPath();
      gg.moveTo(500, 1056);
      gg.lineTo(540, 1046);
      gg.lineTo(540, 1066);
      gg.closePath();
      gg.fill();
      gg.fillRect(540, 1050, 40, 12);
    }, { x0: 468, x1: 652, y0: 1028, y1: 1200 }));
    const pal = {
      tops: ['#2c3e50', '#34495e', '#5d6d7e', '#7b8fa1', '#1b2631', '#b03a2e', '#a04000', '#117864', '#515a5a', '#d6eaf8'],
      tops2: [WHITE, '#e8e0cc'],
      pants: ['#1c2833', '#2c3e50', '#4a235a', '#641e16', '#5d6d7e'],
      props: ['suitcase', 'book', 'cup', 'bag', 'camera', 'flag', 'megaphone', 'ticket'],
      propC: ['#1f1f24', '#8e5a2e', '#c0392b', '#2e86c1'],
    };
    return { zones, items, overlay: [], pal, haze: '#9aa9b8', warm: '#ffd7a0', skis: false };
  },
};

// ---------------------------------------------------------------- SKI
export const ski = {
  id: 'ski',
  caption: 'capSki',
  horizon: 600,
  front: 1450,
  haze: '#dfeaf5',
  warm: '#ffe2b0',
  paint(g, rnd) {
    sky(g, W, '#6d9fd0', '#e9f2fa', 700);
    clouds(g, rnd, 4, 60, 1100, 80, 260, 60, 110, 0.7);
    hillRow(g, rnd, W, 610, 420, ['#8fa9c6', '#9bb3cc', '#8aa2bf'], 5);
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 260 + rnd() * 60;
      mountain(g, x, 620, 340, 250 + rnd() * 120, '#7f98b6', '#f7fbff');
    }
    // snow-covered forest band
    for (let x = -10; x < W + 20; x += 26) {
      pine(g, x, 640 + rnd() * 24, 110 + rnd() * 60, shade('#2d5a4a', (rnd() - 0.5) * 0.2));
    }
    // ground
    fillTex(g, 0, 620, W, 880, makeTex(rnd, 'snow', '#eef4fa', '#b9cde0', RES), RES);
    rect(g, 0, 620, W, 880, lin(g, 0, 620, 0, 1500, ['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(120,150,190,0.12)']));
    // ski tracks
    g.strokeStyle = 'rgba(90,120,160,0.22)';
    g.lineWidth = 6;
    for (const [sx, sy] of [[260, 1500], [880, 1500]]) {
      g.beginPath();
      g.moveTo(sx, sy);
      g.bezierCurveTo(sx - 30, 1200, sx + 60, 1000, sx + 10, 760);
      g.stroke();
    }
    // chalets
    const roofs = ['#7a2e2e', '#2f4a6b', '#4b3b2c'];
    const woods = ['#8b5e3c', '#a57350', '#6c4a2e', '#b58454'];
    let x = 20;
    while (x < W) {
      const w = 120 + rnd() * 90;
      const h = 110 + rnd() * 60;
      const bx = x;
      const base = woods[(rnd() * woods.length) | 0];
      facade(g, rnd, bx, 770 - h, w, h, base, { roof: null, litChance: 0.4, cw: 16, ch: 22 });
      g.beginPath();
      g.moveTo(bx - 14, 770 - h - 6);
      g.lineTo(bx + w / 2, 770 - h - 80);
      g.lineTo(bx + w + 14, 770 - h - 6);
      g.closePath();
      g.fillStyle = roofs[(rnd() * roofs.length) | 0];
      g.fill();
      g.beginPath();
      g.moveTo(bx - 10, 770 - h - 14);
      g.lineTo(bx + w / 2, 770 - h - 84);
      g.lineTo(bx + w + 10, 770 - h - 14);
      g.lineTo(bx + w + 10, 770 - h - 6);
      g.lineTo(bx - 10, 770 - h - 6);
      g.closePath();
      g.fillStyle = '#f5fbff';
      g.fill();
      x += w + 12;
    }
    const zones = [
      { x0: 0, x1: W, y0: 700, y1: 1460, w: 1 },
    ];
    const items = [
      pineItem(rnd, 40, 1210, 320, '#23503f'),
      pineItem(rnd, 130, 1330, 380, '#2a5e49'),
      pineItem(rnd, 1100, 1220, 330, '#23503f'),
      pineItem(rnd, 1170, 1360, 390, '#2a5e49'),
      pineItem(rnd, 1040, 760, 190, '#2f6350'),
      pineItem(rnd, 160, 760, 180, '#2f6350'),
    ];
    // snow piles
    for (let i = 0; i < 6; i++) {
      const sx = rnd() * W;
      const sy = 1000 + rnd() * 450;
      ellipse(g, sx, sy, 40 + rnd() * 40, 10 + rnd() * 8, '#ffffff');
    }
    const overlay = [
      {
        draw: (gg) => {
          for (let i = 0; i < 380; i++) {
            const fx = rnd() * W;
            const fy = rnd() * H;
            gg.globalAlpha = 0.5 + rnd() * 0.5;
            gg.fillStyle = '#ffffff';
            gg.beginPath();
            gg.arc(fx, fy, 0.7 + rnd() * 1.8, 0, Math.PI * 2);
            gg.fill();
          }
          gg.globalAlpha = 1;
        },
      },
    ];
    const pal = {
      tops: ['#e63946', '#f1faee', '#457b9d', '#1d3557', '#ffb703', '#8ac926', '#6a4c93', '#ff595e', '#2a9d8f'],
      tops2: [WHITE, '#ffd166'],
      pants: ['#1d3557', '#3d405b', '#2b2d42', '#222831', '#5c677d'],
      props: ['cup', 'flag', 'bag', 'camera', 'board'],
      propC: ['#e63946', '#ffd166', '#2a9d8f', '#f1faee'],
    };
    return { zones, items, overlay, pal, haze: '#dfeaf5', warm: '#ffe2b0', skis: true };
  },
};

// ---------------------------------------------------------------- MARKET
export const market = {
  id: 'market',
  caption: 'capMarket',
  horizon: 600,
  front: 1450,
  haze: '#d7c7a6',
  warm: '#ffc070',
  paint(g, rnd) {
    sky(g, W, '#8fc3e6', '#fde7c2', 620);
    clouds(g, rnd, 3, 100, 1000, 60, 200, 50, 80, 0.8);
    // timber-frame houses
    let x = -20;
    while (x < W) {
      const w = 140 + rnd() * 80;
      const h = 230 + rnd() * 90;
      const base = ['#ecdcbc', '#e4cfa6', '#f2e4c8'][(rnd() * 3) | 0];
      rect(g, x, 600 - h, w, h, base);
      rect(g, x, 600 - h, w, 6, 'rgba(60,35,15,0.5)');
      for (let yy = 600 - h + 22; yy < 600; yy += 52) rect(g, x, yy, w, 5, '#5a3a22');
      for (let xx = x; xx < x + w; xx += 48) rect(g, xx, 600 - h, 5, h, '#5a3a22');
      for (let xx = x + 10; xx < x + w - 20; xx += 46) {
        g.strokeStyle = '#5a3a22';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(xx, 600 - h + 30);
        g.lineTo(xx + 36, 600 - h + 70);
        g.stroke();
      }
      for (let k = 0; k < 2; k++) windowAt(g, x + 16 + k * (w / 2 - 6), 600 - h + 28, 34, 40, rnd() < 0.5, '#5a3a22');
      poly(g, [[x - 14, 600 - h], [x + w / 2, 600 - h - 90], [x + w + 14, 600 - h]], '#9a4a2c');
      for (let r = 0; r < 4; r++) {
        g.strokeStyle = shade('#9a4a2c', -0.2);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 14, 600 - h - r * 8 + 0);
        g.lineTo(x + w + 14, 600 - h - r * 8 + 0);
        g.stroke();
      }
      x += w + 8;
    }
    // hanging sign
    rect(g, 700, 380, 4, 70, '#3a2a1c');
    signBoard(g, 660, 420, 96, 44, '#8e3b26');
    // bunting over the square
    const bunt = ['#c0392b', '#f1c40f', '#27ae60', '#2e86c1', '#f5efe0'];
    bunting(g, 0, 470, W, 500, 30, bunt, 40, 9);
    // cobbled square
    fillTex(g, 0, 600, W, 900, makeTex(rnd, 'cobble', '#b9a88c', '#8c7a66', RES), RES);
    rect(g, 0, 600, W, 900, lin(g, 0, 600, 0, 1500, ['rgba(255,220,160,0)', 'rgba(255,220,160,0)', 'rgba(90,50,20,0.14)']));
    // central well
    ellipse(g, 600, 1000, 80, 22, '#7d7468');
    ellipse(g, 600, 990, 66, 16, '#2d4e62');
    rect(g, 540, 930, 120, 50, '#9a9083');
    rect(g, 530, 900, 10, 80, '#5a3a22');
    rect(g, 660, 900, 10, 80, '#5a3a22');
    rrFill(g, 524, 880, 152, 20, 8, '#8e3b26');
    const zones = [{ x0: 0, x1: W, y0: 640, y1: 1460, w: 1 }];
    const items = [
      stallItem(40, 830, 170, '#c0392b', '#fff4e0', ['#e74c3c', '#e67e22', '#f1c40f', '#e74c3c', '#e67e22']),
      stallItem(930, 820, 180, '#2e86c1', '#f1c40f', ['#27ae60', '#27ae60', '#f1c40f', '#8e44ad', '#2e86c1']),
      stallItem(280, 1220, 160, '#27ae60', '#fff4e0', ['#c0392b', '#e67e22', '#c0392b']),
      stallItem(790, 1250, 170, '#8e44ad', '#f1c40f', ['#f1c40f', '#f1c40f', '#e67e22', '#27ae60']),
      barrelItem(1110, 1120, 22, '#8b5a2b'),
      barrelItem(90, 1330, 24, '#8b5a2b'),
      crateItem(1070, 1290, 70, 44, '#b98146'),
    ];
    const pal = {
      tops: ['#a23b2a', '#2f6d50', '#c9a227', '#3b5b92', '#f2e8cf', '#7a4e2d', '#6b3e8b', '#d07a2c'],
      tops2: [WHITE, '#f2e8cf', '#ffe08a'],
      pants: ['#4b3621', '#5b4636', '#2f3e5c', '#3e2f24', '#6b5844'],
      props: ['basket', 'bread', 'fish', 'bag', 'cup', 'flag', 'book'],
      propC: ['#c0392b', '#f1c40f', '#27ae60', '#8e44ad', '#d35400'],
    };
    return { zones, items, overlay: [], pal, haze: '#d7c7a6', warm: '#ffc070', skis: false };
  },
};

// ---------------------------------------------------------------- STREET
export const street = {
  id: 'street',
  caption: 'capStreet',
  horizon: 650,
  front: 1460,
  haze: '#c8d6e2',
  warm: '#ffe0a0',
  paint(g, rnd) {
    sky(g, W, '#6fb0e6', '#dcedf7', 640);
    // tall buildings with glass and brick
    const cols = ['#7a4a3c', '#5d6d7e', '#8c6a58', '#4a5a6a', '#9c7b64', '#3d4a5c'];
    let x = -10;
    while (x < W) {
      const w = 130 + rnd() * 90;
      const h = 380 + rnd() * 240;
      const base = cols[(rnd() * cols.length) | 0];
      facade(g, rnd, x, 640 - h, w, h, base, { litChance: 0.2, cw: 20, ch: 28, frame: '#dfe6ec' });
      x += w + 6;
    }
    // shopfronts at ground level
    const shops = ['#1f4e79', '#8e2f3a', '#2e6b4f', '#5a3e7a', '#b2741f'];
    x = -10;
    let k = 0;
    while (x < W) {
      const w = 150 + rnd() * 60;
      rect(g, x, 560, w, 80, shade(shops[k % shops.length], -0.1));
      rect(g, x + 10, 580, w - 20, 50, lin(g, 0, 580, 0, 630, ['#ffe9b8', '#ffc978']));
      stripedAwning(g, x + 2, 548, w - 4, 14, shops[k % shops.length], '#f5f1e6', 6);
      x += w + 8;
      k++;
    }
    // road
    rect(g, 0, 650, W, 180, '#3c4046');
    rect(g, 0, 650, W, 22, '#a9a59d');
    rect(g, 0, 812, W, 22, '#a9a59d');
    for (let x2 = 0; x2 < W; x2 += 90) rect(g, x2, 740, 46, 5, '#f5efe0');
    // zebra crossing
    for (let x3 = 900; x3 < 1100; x3 += 26) rect(g, x3, 662, 14, 150, 'rgba(245,240,230,0.8)');
    // paving for the front sidewalk
    fillTex(g, 0, 834, W, 640, makeTex(rnd, 'stone', '#c9c3b6', '#9d978a', RES), RES);
    // trees
    const tr = [];
    for (let i = 0; i < 4; i++) tr.push(treeItem(rnd, 90 + i * 300, 840, 84, '#3f8f4a', '#5a3b22'));
    const items = [...tr];
    items.push(lampItem(260, 1000, 260, '#2b2f36', '#fff1c0'));
    items.push(lampItem(930, 1120, 260, '#2b2f36', '#fff1c0'));
    items.push(item(1150, (gg) => {
      rrFill(gg, 940, 1036, 110, 20, 3, '#e9edf0');
      rect(gg, 960, 1056, 4, 36, '#2b2f36');
      rect(gg, 1030, 1056, 4, 36, '#2b2f36');
    }, { x0: 936, x1: 1054, y0: 1030, y1: 1095 }));
    // cars parked on the road
    const carCols = ['#c0392b', '#f1c40f', '#2e86c1', '#ecf0f1', '#27ae60', '#7f8c8d'];
    for (let i = 0; i < 5; i++) {
      const cx = 60 + i * 240 + rnd() * 40;
      const cy = 745 + rnd() * 6;
      const c = carCols[i % carCols.length];
      items.push(item(cy + 4, (gg) => {
        shadowBlob(gg, cx + 54, cy + 4, 62, 6, 0.32);
        rrFill(gg, cx, cy - 46, 110, 40, 12, c);
        rrFill(gg, cx + 22, cy - 72, 60, 30, 10, shade(c, -0.1));
        rrFill(gg, cx + 26, cy - 68, 52, 22, 7, '#9bd1e8');
        circle(gg, cx + 24, cy - 6, 9, '#1c1c20');
        circle(gg, cx + 88, cy - 6, 9, '#1c1c20');
        circle(gg, cx + 24, cy - 6, 3.5, '#b7b7bd');
        circle(gg, cx + 88, cy - 6, 3.5, '#b7b7bd');
        rrFill(gg, cx + 100, cy - 36, 8, 8, 2, '#fff4b0');
      }, { x0: cx, x1: cx + 112, y0: cy - 74, y1: cy + 4 }));
    }
    const zones = [
      { x0: 0, x1: W, y0: 640, y1: 700, w: 0.6, target: false },
      { x0: 0, x1: W, y0: 840, y1: 1460, w: 1 },
    ];
    const pal = {
      tops: ['#2c3e50', '#e74c3c', '#3498db', '#1abc9c', '#f39c12', '#9b59b6', '#ecf0f1', '#34495e', '#e67e22'],
      tops2: [WHITE, '#34495e'],
      pants: ['#2c3e50', '#34495e', '#1c2833', '#5d6d7e', '#273746', '#7f8c8d'],
      props: ['bag', 'cup', 'book', 'camera', 'umbrella', 'ticket', 'megaphone', 'icecream'],
      propC: ['#2c3e50', '#e74c3c', '#f1c40f', '#ecf0f1', '#1abc9c'],
    };
    return { zones, items, overlay: [], pal, haze: '#c8d6e2', warm: '#ffe0a0', skis: false };
  },
};

// ---------------------------------------------------------------- FAIR
export const fair = {
  id: 'fair',
  caption: 'capFair',
  horizon: 640,
  front: 1450,
  haze: '#c9b6d9',
  warm: '#ffb36b',
  paint(g, rnd) {
    sky(g, W, '#2b2f78', '#ff9e7a', 680);
    for (let i = 0; i < 40; i++) sparkle(g, rnd() * W, rnd() * 300, 1 + rnd() * 2, '#fff7e0');
    glow(g, 300, 450, 300, '#ffb36b', 0.25);
    // ferris wheel
    const cx = 290;
    const cy = 420;
    const R = 230;
    g.strokeStyle = '#f4e4a8';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, R - 24, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
      const gc = ['#ff6f91', '#ffc75f', '#00c9a7', '#4d96ff', '#b388ff', '#f9f871'][i % 6];
      rrFill(g, cx + Math.cos(a) * R - 9, cy + Math.sin(a) * R - 6, 18, 16, 3, gc);
    }
    rect(g, cx - 4, cy + R, 8, 190, '#f4e4a8');
    g.strokeStyle = '#f4e4a8';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - 90, 1000);
    g.lineTo(cx, cy + R);
    g.lineTo(cx + 90, 1000);
    g.stroke();
    // carousel canopy (right)
    for (let i = 0; i < 8; i++) {
      poly(g, [[700 + i * 36, 540], [700 + (i + 1) * 36, 540], [700 + (i + 1) * 36 - 6, 470], [700 + i * 36 + 6, 470]], i % 2 ? '#ffd166' : '#ef476f');
    }
    poly(g, [[680, 540], [1000, 540], [940, 470], [740, 470]], '#4d96ff');
    rect(g, 700, 540, 8, 120, '#f4e4a8');
    rect(g, 960, 540, 8, 120, '#f4e4a8');
    rect(g, 820, 430, 4, 40, '#f4e4a8');
    circle(g, 822, 426, 8, '#ffd166');
    // striped tents behind
    for (let i = 0; i < 4; i++) {
      const tx = 120 + i * 260;
      poly(g, [[tx - 90, 640], [tx, 540], [tx + 90, 640]], i % 2 ? '#ef476f' : '#fff4e6');
      poly(g, [[tx - 20, 640], [tx, 540], [tx + 20, 640]], i % 2 ? '#fff4e6' : '#ef476f');
    }
    // grass and path
    fillTex(g, 0, 620, W, 880, makeTex(rnd, 'grass', '#5fae5a', '#2d7a3a', RES), RES);
    rect(g, 0, 620, W, 880, lin(g, 0, 620, 0, 1500, ['rgba(255,190,120,0)', 'rgba(255,190,120,0)', 'rgba(20,50,20,0.25)']));
    g.beginPath();
    g.moveTo(480, 1500);
    g.quadraticCurveTo(540, 1100, 600, 900);
    g.quadraticCurveTo(640, 760, 580, 640);
    g.lineTo(640, 640);
    g.quadraticCurveTo(700, 800, 690, 900);
    g.quadraticCurveTo(650, 1100, 740, 1500);
    g.closePath();
    g.fillStyle = '#e8cf9a';
    g.fill();
    const items = [
      stallItem(930, 1200, 150, '#ef476f', '#fff4e6', ['#ffd166', '#ef476f']),
      stallItem(70, 1040, 150, '#4d96ff', '#fff4e6', ['#f9f871', '#ff6f91']),
      stallItem(940, 800, 140, '#ffc75f', '#ef476f', ['#fff4e6']),
    ];
    for (let i = 0; i < 4; i++) {
      const bx = 280 + i * 180 + rnd() * 40;
      items.push(barrelItem(bx, 1450 - i * 6, 22, '#ffd166'));
    }
    const balloons = [];
    for (let i = 0; i < 6; i++) balloons.push([120 + i * 190 + rnd() * 60, 180 + rnd() * 200, ['#ff6f91', '#ffc75f', '#00c9a7', '#4d96ff', '#b388ff', '#f9f871'][i]]);
    const overlay = [
      {
        draw: (gg) => {
          for (const [bx, by, c] of balloons) {
            gg.beginPath();
            gg.moveTo(bx, by + 36);
            gg.lineTo(bx, by + 70);
            gg.strokeStyle = 'rgba(255,255,255,0.5)';
            gg.lineWidth = 1;
            gg.stroke();
            gg.beginPath();
            gg.ellipse(bx, by, 22, 27, 0, 0, Math.PI * 2);
            gg.fillStyle = c;
            gg.fill();
            circle(gg, bx - 7, by - 9, 4, 'rgba(255,255,255,0.5)');
          }
        },
      },
    ];
    const pal = {
      tops: ['#ff6f91', '#ffc75f', '#f9f871', '#0081cf', '#845ec2', '#00c9a7', '#ff9671', '#ffffff', '#d65db1'],
      tops2: [WHITE, '#ffe08a'],
      pants: ['#2c3e50', '#4b4453', '#1f2a44', '#6d597a', '#355070'],
      props: ['balloon', 'icecream', 'cup', 'camera', 'bag', 'ticket', 'flag'],
      propC: ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ffffff', '#b5179e'],
    };
    return { zones: [{ x0: 0, x1: W, y0: 660, y1: 1460, w: 1 }], items, overlay, pal, haze: '#c9b6d9', warm: '#ffb36b', skis: false };
  },
};

