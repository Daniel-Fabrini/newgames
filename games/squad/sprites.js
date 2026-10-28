// Procedural sprite art for the runner, drawn once with Canvas 2D paths and
// cached on offscreen canvases. Coordinates are world units with the origin
// at the sprite's feet (bottom centre), y growing downwards (negative = up).

const SPR = 3; // pixels per world unit on the cached bitmap

function paint(w, h, fn, pad = 2) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * SPR);
  c.height = Math.ceil((h + pad * 2) * SPR);
  const g = c.getContext('2d');
  g.scale(SPR, SPR);
  g.translate(w / 2 + pad, h + pad);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  fn(g);
  return { c, w: w + pad * 2, h: h + pad * 2, ax: w / 2 + pad, ay: h + pad };
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}
function rad(g, x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}
function shape(g, fill, stroke = 'rgba(12,10,20,.6)', lw = 0.9) {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}
function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}
function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    gg += (255 - gg) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    gg *= 1 + f;
    b *= 1 + f;
  }
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}

// White silhouette for hit flashes.
function flashOf(spr) {
  const c = document.createElement('canvas');
  c.width = spr.c.width;
  c.height = spr.c.height;
  const g = c.getContext('2d');
  g.drawImage(spr.c, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillRect(0, 0, c.width, c.height);
  return { ...spr, c };
}

// ------------------------------------------------------------------ soldier
function soldier(frame, helmet) {
  return paint(18, 29, (g) => {
    const up = frame ? [0, -1.2] : [-1.2, 0];
    // legs + boots
    for (let i = 0; i < 2; i++) {
      const x = i ? 0.6 : -4.4;
      rr(g, x, -10.5 + up[i], 3.8, 9, 1.4);
      shape(g, '#22335a');
      rr(g, x - 0.2, -2.9 + up[i], 4.2, 2.9, 1.1);
      shape(g, '#16161a');
    }
    // arms
    rr(g, -8, -18.5, 3, 8, 1.5);
    shape(g, '#2c55b8');
    rr(g, 4.8, -19, 3, 7, 1.5);
    shape(g, '#2c55b8');
    // torso
    rr(g, -6, -20, 12, 11, 3.2);
    shape(g, lin(g, 0, -20, 0, -9, ['#5b93ff', '#2d5bd0']));
    rr(g, -6, -10.6, 12, 1.8, 0.8);
    shape(g, '#1a2034', null);
    // backpack
    rr(g, -4.2, -18.6, 8.4, 8, 2.2);
    shape(g, lin(g, 0, -18, 0, -10, ['#3c5aa0', '#25386e']));
    rr(g, -4.2, -18.6, 8.4, 2.6, 1.6);
    shape(g, '#4a6bb8', null);
    // rifle (pointing forward = up the screen)
    rr(g, 5.4, -29, 2, 15, 0.8);
    shape(g, lin(g, 5.4, 0, 7.4, 0, ['#55555c', '#1e1e22']), 'rgba(0,0,0,.6)', 0.6);
    rr(g, 5, -17, 2.8, 3.4, 0.8);
    shape(g, '#2a2a2e', null);
    // neck + helmet
    rr(g, -2, -21.5, 4, 2.5, 1);
    shape(g, '#d9a77c', null);
    circle(g, 0, -23, 4.9);
    shape(g, rad(g, -1.6, -25, 0.5, 6, [shade(helmet, 0.35), helmet, shade(helmet, -0.35)]));
    ellipse(g, 0, -21.3, 5.4, 1.5);
    shape(g, shade(helmet, -0.2), 'rgba(0,0,0,.45)', 0.6);
    g.fillStyle = 'rgba(255,255,255,.35)';
    ellipse(g, -1.8, -25.4, 1.6, 1);
    g.fill();
  });
}

// ------------------------------------------------------------------ zombies
const SHIRTS = ['#8e4b4b', '#4b6a8e', '#7d6c3b', '#5c4d80'];
const SKINS = ['#8fbf5a', '#9cae6e', '#77b07f', '#a3b85d'];

function zHead(g, x, y, r, skin, eye = '#ff3b3b') {
  circle(g, x, y, r);
  shape(g, rad(g, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.2, [shade(skin, 0.3), skin, shade(skin, -0.35)]));
  // hair tufts
  g.fillStyle = 'rgba(30,25,20,.7)';
  ellipse(g, x - r * 0.3, y - r * 0.8, r * 0.5, r * 0.25);
  g.fill();
  // eyes
  g.fillStyle = '#1b0d0d';
  ellipse(g, x - r * 0.38, y - r * 0.1, r * 0.3, r * 0.26);
  g.fill();
  ellipse(g, x + r * 0.38, y - r * 0.1, r * 0.3, r * 0.26);
  g.fill();
  g.fillStyle = eye;
  circle(g, x - r * 0.36, y - r * 0.1, r * 0.15);
  g.fill();
  circle(g, x + r * 0.4, y - r * 0.1, r * 0.15);
  g.fill();
  // mouth
  rr(g, x - r * 0.4, y + r * 0.35, r * 0.8, r * 0.3, r * 0.1);
  shape(g, '#3a0f12', null);
  g.fillStyle = '#e8e2c8';
  g.fillRect(x - r * 0.25, y + r * 0.35, r * 0.15, r * 0.12);
  g.fillRect(x + r * 0.08, y + r * 0.35, r * 0.15, r * 0.12);
}

function walker(frame, v, opt = {}) {
  const shirt = opt.shirt || SHIRTS[v % 4];
  const skin = opt.skin || SKINS[v % 4];
  return paint(20, 29, (g) => {
    const up = frame ? [0, -1.2] : [-1.2, 0];
    for (let i = 0; i < 2; i++) {
      const x = i ? 0.8 : -4.6;
      rr(g, x, -11 + up[i], 3.8, 10, 1.2);
      shape(g, opt.pants || '#3c4152');
      rr(g, x - 0.2, -2.4 + up[i], 4.2, 2.4, 1);
      shape(g, '#2a2420');
    }
    // torso with ragged hem
    g.beginPath();
    g.moveTo(-6.2, -20);
    g.lineTo(6.2, -20);
    g.lineTo(6.6, -10);
    g.lineTo(4.4, -8.6);
    g.lineTo(2.6, -10);
    g.lineTo(0.6, -8.4);
    g.lineTo(-1.6, -10);
    g.lineTo(-3.8, -8.8);
    g.lineTo(-6.6, -10);
    g.closePath();
    shape(g, lin(g, 0, -20, 0, -9, [shade(shirt, 0.15), shade(shirt, -0.2)]));
    g.fillStyle = 'rgba(110,10,10,.55)';
    ellipse(g, 2.4, -15, 2, 1.6);
    g.fill();
    ellipse(g, -3, -12.4, 1.2, 1);
    g.fill();
    // arms reaching forward
    const sw = frame ? 0.8 : -0.8;
    rr(g, -9.2, -19.5 + sw, 3.4, 8.5, 1.6);
    shape(g, shade(shirt, -0.1));
    rr(g, 5.8, -19.5 - sw, 3.4, 8.5, 1.6);
    shape(g, shade(shirt, -0.1));
    circle(g, -7.5, -10.6 + sw, 2);
    shape(g, skin);
    circle(g, 7.5, -10.6 - sw, 2);
    shape(g, skin);
    if (opt.vest) {
      rr(g, -5.6, -19.6, 11.2, 9, 2);
      shape(g, lin(g, 0, -19, 0, -10, ['#4a5260', '#262b34']));
      g.strokeStyle = 'rgba(255,255,255,.18)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(-5, -16);
      g.lineTo(5, -16);
      g.moveTo(-5, -13);
      g.lineTo(5, -13);
      g.stroke();
    }
    zHead(g, 0, -24, 5, skin);
    if (opt.helmet) {
      g.beginPath();
      g.arc(0, -24.6, 5.8, Math.PI, 0);
      g.closePath();
      shape(g, lin(g, 0, -30, 0, -24, ['#5b6270', '#2a2f38']));
      rr(g, -4.6, -25.4, 9.2, 2.4, 1);
      shape(g, 'rgba(120,200,255,.55)', 'rgba(0,0,0,.5)', 0.5);
    }
  });
}

function runner(frame, v) {
  const skin = ['#b5c95a', '#c2c76a', '#a6c96b', '#b9b85e'][v % 4];
  return paint(19, 28, (g) => {
    const up = frame ? [0, -2.2] : [-2.2, 0];
    for (let i = 0; i < 2; i++) {
      const x = i ? 0.6 : -3.8;
      rr(g, x, -11 + up[i], 3.2, 10, 1.2);
      shape(g, '#4a3a33');
      rr(g, x - 0.2, -2.2 + up[i], 3.6, 2.2, 1);
      shape(g, '#221c18');
    }
    rr(g, -5, -19.5, 10, 10.5, 2.5);
    shape(g, lin(g, 0, -19, 0, -9, ['#d14a38', '#8f2a20']));
    g.fillStyle = skin;
    rr(g, -2, -19.6, 4, 3, 1);
    g.fill();
    const sw = frame ? 2 : -2;
    rr(g, -8, -19 + sw, 2.8, 8, 1.4);
    shape(g, skin);
    rr(g, 5.2, -19 - sw, 2.8, 8, 1.4);
    shape(g, skin);
    zHead(g, 0.6, -23.6, 4.6, skin, '#ffd23b');
  });
}

function brute(frame, v, giant = false) {
  const skin = giant ? '#5f7f4c' : ['#8c7a9e', '#6d8f4e', '#8d8f6a', '#7c6f8f'][v % 4];
  const W = giant ? 62 : 38;
  const H = giant ? 78 : 48;
  return paint(W, H, (g) => {
    g.scale(W / 38, H / 48);
    const up = frame ? [0, -1.6] : [-1.6, 0];
    for (let i = 0; i < 2; i++) {
      const x = i ? 2 : -10;
      rr(g, x, -16 + up[i], 8, 15, 2.5);
      shape(g, '#3b3348');
      rr(g, x - 0.5, -3.4 + up[i], 9, 3.4, 1.4);
      shape(g, '#221c1a');
    }
    // massive torso
    g.beginPath();
    g.moveTo(-15, -38);
    g.quadraticCurveTo(0, -44, 15, -38);
    g.lineTo(11, -15);
    g.quadraticCurveTo(0, -12, -11, -15);
    g.closePath();
    shape(g, rad(g, -4, -34, 2, 22, [shade(skin, 0.25), skin, shade(skin, -0.35)]));
    // pecs/scars
    g.strokeStyle = 'rgba(40,20,30,.45)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-8, -30);
    g.quadraticCurveTo(0, -27, 8, -30);
    g.moveTo(-4, -22);
    g.lineTo(3, -19);
    g.stroke();
    g.fillStyle = 'rgba(120,10,20,.5)';
    ellipse(g, 5, -24, 3, 2);
    g.fill();
    // torn pants waist
    rr(g, -11, -17, 22, 4, 1.5);
    shape(g, '#2e2838');
    // arms + fists
    const sw = frame ? 1.2 : -1.2;
    for (const s of [-1, 1]) {
      rr(g, s > 0 ? 12 : -19, -38 + sw * s, 7, 18, 3.5);
      shape(g, rad(g, s * 15, -32, 1, 12, [shade(skin, 0.15), shade(skin, -0.25)]));
      circle(g, s * 15.5, -18.5 + sw * s, 4.4);
      shape(g, shade(skin, -0.1));
    }
    // shoulder spikes
    g.fillStyle = '#e8e0c8';
    for (const s of [-1, 1]) {
      poly(g, [s * 12, -40, s * 14, -45, s * 15.5, -39]);
      shape(g, '#efe6cf', 'rgba(0,0,0,.4)', 0.5);
    }
    if (giant) {
      rr(g, -14, -37, 9, 6, 1.5);
      shape(g, lin(g, 0, -37, 0, -31, ['#9aa3ad', '#4d545c']));
      g.strokeStyle = '#8a8f96';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-10, -30);
      g.lineTo(10, -20);
      g.stroke();
    }
    zHead(g, 0, -42, 5.2, shade(skin, 0.1), giant ? '#ffae00' : '#ff3b3b');
  });
}

function bloater(frame) {
  return paint(30, 32, (g) => {
    const up = frame ? [0, -1] : [-1, 0];
    for (let i = 0; i < 2; i++) {
      rr(g, i ? 2 : -7, -7 + up[i], 5, 7, 1.5);
      shape(g, '#4b4a3a');
    }
    ellipse(g, 0, -15, 13.5, 11);
    shape(g, rad(g, -4, -19, 1, 15, ['#e2f08a', '#a8c45a', '#5f7a2c']));
    g.strokeStyle = 'rgba(80,30,60,.5)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-8, -18);
    g.quadraticCurveTo(-3, -14, -6, -8);
    g.moveTo(6, -20);
    g.quadraticCurveTo(9, -14, 5, -9);
    g.stroke();
    for (const [x, y, r] of [[-5, -12, 2.2], [4, -16, 2.6], [7, -9, 1.6], [-1, -20, 1.6]]) {
      circle(g, x, y, r);
      shape(g, rad(g, x, y, 0, r, ['#fbffd0', '#d8f05a', '#9ab82e']), 'rgba(60,70,10,.6)', 0.4);
    }
    const sw = frame ? 0.8 : -0.8;
    circle(g, -13, -14 + sw, 2.2);
    shape(g, '#a8c45a');
    circle(g, 13, -14 - sw, 2.2);
    shape(g, '#a8c45a');
    zHead(g, 0, -27, 4.2, '#a9c06a');
  });
}

function crawler(frame) {
  return paint(26, 16, (g) => {
    const sw = frame ? 1.5 : -1.5;
    // back legs
    rr(g, -10, -6, 5, 5, 1.5);
    shape(g, '#3d4152');
    rr(g, 5, -6, 5, 5, 1.5);
    shape(g, '#3d4152');
    // body (seen from front, low)
    ellipse(g, 0, -7, 9, 5);
    shape(g, lin(g, 0, -12, 0, -2, ['#7b8a72', '#4d5946']));
    // arms reaching forward on the ground
    rr(g, -12, -4 + sw * 0.4, 6, 3, 1.4);
    shape(g, '#93a47a');
    rr(g, 6, -4 - sw * 0.4, 6, 3, 1.4);
    shape(g, '#93a47a');
    zHead(g, 0, -6.5, 4.4, '#9fb08a', '#ff5a3b');
  });
}

// ------------------------------------------------------------------ bosses
function boss(id, frame) {
  const B = {
    hulk: [104, 128],
    iron: [112, 132],
    abom: [124, 118],
    queen: [100, 142],
    colossus: [140, 170],
  }[id];
  return paint(B[0], B[1], (g) => {
    const sw = frame ? 1 : -1;
    if (id === 'hulk' || id === 'iron' || id === 'colossus') {
      const sx = B[0] / 104;
      const sy = B[1] / 128;
      g.scale(sx, sy);
      const skin = id === 'hulk' ? '#6f9a52' : id === 'iron' ? '#7d8794' : '#6b6560';
      const pants = id === 'hulk' ? '#4a2f5c' : id === 'iron' ? '#3a3f48' : '#3b3330';
      // legs
      for (const s of [-1, 1]) {
        rr(g, s > 0 ? 6 : -30, -44 + (s * sw > 0 ? -2 : 0), 24, 44, 8);
        shape(g, lin(g, 0, -44, 0, 0, [shade(pants, 0.1), shade(pants, -0.3)]), 'rgba(0,0,0,.6)', 1.5);
        rr(g, s > 0 ? 4 : -32, -9 + (s * sw > 0 ? -2 : 0), 28, 9, 4);
        shape(g, '#2b2420', 'rgba(0,0,0,.6)', 1.2);
      }
      // torso
      g.beginPath();
      g.moveTo(-42, -102);
      g.quadraticCurveTo(0, -122, 42, -102);
      g.lineTo(32, -44);
      g.quadraticCurveTo(0, -36, -32, -44);
      g.closePath();
      shape(g, rad(g, -12, -92, 4, 66, [shade(skin, 0.3), skin, shade(skin, -0.45)]), 'rgba(0,0,0,.6)', 1.6);
      if (id === 'iron') {
        // armor plates and rivets
        for (const [x, y, w, h] of [[-30, -100, 28, 24], [2, -100, 28, 24], [-24, -72, 48, 20]]) {
          rr(g, x, y, w, h, 4);
          shape(g, lin(g, 0, y, 0, y + h, ['#c3cbd5', '#6b7480']), 'rgba(0,0,0,.6)', 1.2);
          g.fillStyle = '#3d434b';
          for (const [px, py] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
            circle(g, px, py, 1.2);
            g.fill();
          }
        }
      } else if (id === 'colossus') {
        g.strokeStyle = '#ff8a1e';
        g.lineWidth = 2.2;
        g.shadowColor = '#ff6a00';
        g.beginPath();
        g.moveTo(-20, -100);
        g.lineTo(-8, -84);
        g.lineTo(-16, -66);
        g.lineTo(-4, -52);
        g.moveTo(18, -98);
        g.lineTo(10, -80);
        g.lineTo(22, -64);
        g.moveTo(-34, -88);
        g.lineTo(-26, -76);
        g.stroke();
        g.strokeStyle = '#ffd36b';
        g.lineWidth = 0.8;
        g.stroke();
      } else {
        g.strokeStyle = 'rgba(30,40,20,.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-20, -86);
        g.quadraticCurveTo(0, -78, 20, -86);
        g.moveTo(-10, -66);
        g.lineTo(10, -60);
        g.moveTo(-8, -56);
        g.lineTo(8, -56);
        g.stroke();
        g.fillStyle = 'rgba(140,20,30,.55)';
        ellipse(g, 14, -70, 6, 4);
        g.fill();
      }
      // belt
      rr(g, -32, -50, 64, 9, 3);
      shape(g, id === 'iron' ? '#2a2e35' : '#3a2a20', 'rgba(0,0,0,.6)', 1.2);
      g.fillStyle = '#c9971c';
      rr(g, -5, -49, 10, 7, 1.5);
      g.fill();
      // arms with huge fists
      for (const s of [-1, 1]) {
        const ay = s * sw * 2;
        g.beginPath();
        g.moveTo(s * 36, -106 + ay);
        g.quadraticCurveTo(s * 60, -96 + ay, s * 52, -52 + ay);
        g.lineTo(s * 38, -54 + ay);
        g.quadraticCurveTo(s * 40, -86 + ay, s * 30, -96 + ay);
        g.closePath();
        shape(g, rad(g, s * 44, -90, 2, 30, [shade(skin, 0.2), shade(skin, -0.35)]), 'rgba(0,0,0,.6)', 1.4);
        circle(g, s * 46, -44 + ay, 13);
        shape(g, id === 'iron' ? lin(g, 0, -56, 0, -32, ['#b7bfc9', '#5d6570']) : id === 'colossus' ? '#58524d' : shade(skin, -0.1), 'rgba(0,0,0,.6)', 1.4);
      }
      // spikes / shoulder
      for (const s of [-1, 1]) {
        if (id === 'iron') {
          ellipse(g, s * 36, -104, 14, 9);
          shape(g, lin(g, 0, -113, 0, -95, ['#d5dbe2', '#6b7480']), 'rgba(0,0,0,.6)', 1.2);
        } else {
          for (let k = 0; k < 3; k++) {
            poly(g, [s * (26 + k * 6), -108 + k * 3, s * (30 + k * 6), -122 + k * 4, s * (34 + k * 6), -106 + k * 3]);
            shape(g, '#eee4cc', 'rgba(0,0,0,.5)', 0.8);
          }
        }
      }
      // head
      if (id === 'iron') {
        rr(g, -13, -128, 26, 24, 9);
        shape(g, lin(g, 0, -128, 0, -104, ['#d5dbe2', '#59616c']), 'rgba(0,0,0,.6)', 1.4);
        rr(g, -10, -118, 20, 5, 2);
        shape(g, '#ff2d2d', null);
        g.fillStyle = 'rgba(255,200,200,.8)';
        g.fillRect(-8, -117, 16, 1.2);
      } else {
        zHead(g, 0, -114, 10, id === 'hulk' ? '#87b067' : '#7a736c', id === 'hulk' ? '#ffd23b' : '#ff7a1e');
      }
    } else if (id === 'abom') {
      const sk = '#8a4a9a';
      for (const s of [-1, 1]) {
        rr(g, s > 0 ? 10 : -32, -30 + (s * sw > 0 ? -2 : 0), 22, 30, 8);
        shape(g, '#4b2a55', 'rgba(0,0,0,.6)', 1.4);
      }
      // tentacles
      for (const s of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          g.beginPath();
          g.moveTo(s * 34, -84 + k * 20);
          g.bezierCurveTo(s * (64 + k * 4), -96 + k * 26 + sw * 4, s * (70 - k * 6), -40 + k * 10, s * (54 - k * 4), -24 + k * 6 - sw * 3);
          g.lineWidth = 9 - k * 2;
          g.strokeStyle = '#2d1633';
          g.stroke();
          g.lineWidth = 6.5 - k * 2;
          g.strokeStyle = k ? '#9b5aab' : '#a865b8';
          g.stroke();
        }
      }
      ellipse(g, 0, -64, 46, 44);
      shape(g, rad(g, -14, -82, 4, 60, ['#c58ad4', sk, '#3e1c47']), 'rgba(0,0,0,.6)', 1.6);
      // eyes
      for (const [x, y, r] of [[-18, -82, 7], [14, -88, 9], [0, -66, 6], [24, -64, 5], [-26, -60, 5]]) {
        circle(g, x, y, r);
        shape(g, '#fff6c8', 'rgba(0,0,0,.6)', 1);
        circle(g, x + r * 0.15, y, r * 0.5);
        shape(g, '#ff9a1e', null);
        circle(g, x + r * 0.2, y, r * 0.22);
        shape(g, '#1a0a0a', null);
      }
      // mouth
      g.beginPath();
      g.ellipse(0, -40, 22, 9, 0, 0, Math.PI * 2);
      shape(g, '#2a0a12', 'rgba(0,0,0,.6)', 1.2);
      g.fillStyle = '#f2ead2';
      for (let k = -18; k <= 14; k += 6) {
        poly(g, [k, -46, k + 3, -40, k + 6, -46]);
        g.fill();
      }
    } else {
      // queen: tall insect-like matriarch
      const sk = '#c9d6b0';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 8, -54);
        g.lineTo(s * 20, -28 + (s * sw > 0 ? -2 : 0));
        g.lineTo(s * 14, 0);
        g.lineWidth = 7;
        g.strokeStyle = '#1f2a1e';
        g.stroke();
        g.lineWidth = 4.5;
        g.strokeStyle = '#3d4a3a';
        g.stroke();
      }
      // abdomen + thorax
      ellipse(g, 0, -64, 22, 20);
      shape(g, rad(g, -6, -70, 2, 26, ['#6f8a5a', '#3d4a3a', '#1f2a1e']), 'rgba(0,0,0,.6)', 1.4);
      ellipse(g, 0, -96, 16, 22);
      shape(g, rad(g, -5, -104, 2, 24, [shade(sk, 0.2), sk, '#6d7a5a']), 'rgba(0,0,0,.6)', 1.4);
      g.strokeStyle = 'rgba(40,50,30,.55)';
      g.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(-12, -108 + k * 7);
        g.quadraticCurveTo(0, -104 + k * 7, 12, -108 + k * 7);
        g.stroke();
      }
      // claws
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 14, -108);
        g.quadraticCurveTo(s * 44, -118 + sw * 3, s * 46, -84);
        g.quadraticCurveTo(s * 40, -70, s * 30, -64 - sw * 2);
        g.lineWidth = 6;
        g.strokeStyle = '#1f2a1e';
        g.stroke();
        g.lineWidth = 3.5;
        g.strokeStyle = sk;
        g.stroke();
      }
      // glow sacs
      for (const [x, y] of [[-10, -64], [10, -62], [0, -52]]) {
        circle(g, x, y, 4.5);
        shape(g, rad(g, x, y, 0, 5, ['#f4ffb0', '#b8f03a', '#5f8a14']), null);
      }
      // head with crown spikes
      ellipse(g, 0, -126, 11, 13);
      shape(g, rad(g, -3, -130, 1, 14, [shade(sk, 0.3), sk, '#7a8a62']), 'rgba(0,0,0,.6)', 1.2);
      for (let k = -2; k <= 2; k++) {
        poly(g, [k * 5 - 2.5, -134, k * 5, -146 + Math.abs(k) * 3, k * 5 + 2.5, -134]);
        shape(g, '#3d4a3a', 'rgba(0,0,0,.5)', 0.8);
      }
      for (const s of [-1, 1]) {
        ellipse(g, s * 4.5, -126, 3, 2.2);
        shape(g, '#c8ff3a', null);
      }
    }
  });
}

// ------------------------------------------------------------------ objects
function barrel() {
  return paint(22, 28, (g) => {
    rr(g, -10, -27, 20, 27, 3);
    shape(g, lin(g, -10, 0, 10, 0, ['#8a1f17', '#e0483a', '#c8372d', '#7a1a12']), 'rgba(0,0,0,.65)', 1);
    for (const y of [-21, -8]) {
      rr(g, -10.5, y, 21, 2, 1);
      shape(g, '#5a1610', null);
    }
    ellipse(g, 0, -27, 10, 2.6);
    shape(g, '#a8291f', 'rgba(0,0,0,.5)', 0.6);
    poly(g, [0, -18.5, 5, -10.5, -5, -10.5]);
    shape(g, '#ffd23b', '#2a1d00', 0.7);
    g.fillStyle = '#2a1d00';
    g.fillRect(-0.5, -16.5, 1, 3.4);
    g.fillRect(-0.5, -12.4, 1, 1);
  });
}

function crate(kind) {
  return paint(46, 36, (g) => {
    rr(g, -22, -35, 44, 35, 3);
    shape(g, lin(g, 0, -35, 0, 0, ['#8a9c4a', '#5b6b2c']), 'rgba(0,0,0,.65)', 1.2);
    g.strokeStyle = 'rgba(30,40,10,.55)';
    g.lineWidth = 1;
    for (const y of [-26, -17, -8]) {
      g.beginPath();
      g.moveTo(-21, y);
      g.lineTo(21, y);
      g.stroke();
    }
    for (const [x, y] of [[-22, -35], [16, -35], [-22, -6], [16, -6]]) {
      rr(g, x, y, 6, 6, 1);
      shape(g, '#c9971c', 'rgba(0,0,0,.5)', 0.5);
    }
    // icon plate
    circle(g, 0, -18, 10.5);
    shape(g, rad(g, 0, -21, 1, 12, ['#3a3a40', '#141418']), '#f7d774', 1.4);
    g.fillStyle = '#ffd23b';
    if (kind === 'rate') {
      poly(g, [2, -27, -5, -16.5, -0.5, -16.5, -2.5, -9, 5, -20, 0.5, -20]);
      shape(g, '#ffd23b', '#7a5200', 0.5);
    } else if (kind === 'dmg') {
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const r = k % 2 ? 4 : 8;
        g.lineTo(Math.cos(a) * r, -18 + Math.sin(a) * r);
      }
      g.closePath();
      shape(g, rad(g, 0, -18, 0, 8, ['#fff3b0', '#ff9a1e', '#e0482a']), '#7a2a00', 0.5);
    } else {
      circle(g, 0, -22.5, 3);
      shape(g, '#5b93ff', null);
      rr(g, -4.5, -19.5, 9, 7.5, 2.5);
      shape(g, '#5b93ff', null);
      g.fillStyle = '#fff';
      g.font = '900 7px sans-serif';
      g.textAlign = 'center';
      g.fillText('+', 7.5, -22);
    }
  });
}

function wall() {
  return paint(136, 42, (g) => {
    // jersey barrier
    g.beginPath();
    g.moveTo(-66, 0);
    g.lineTo(-62, -14);
    g.lineTo(-56, -30);
    g.lineTo(56, -30);
    g.lineTo(62, -14);
    g.lineTo(66, 0);
    g.closePath();
    shape(g, lin(g, 0, -30, 0, 0, ['#c9c9cf', '#8f8f97']), 'rgba(0,0,0,.65)', 1.2);
    g.save();
    g.clip();
    for (let x = -80; x < 80; x += 14) {
      poly(g, [x, -12, x + 7, -12, x + 13, -24, x + 6, -24]);
      g.fillStyle = '#f2c230';
      g.fill();
    }
    g.fillStyle = 'rgba(20,20,20,.75)';
    g.fillRect(-70, -12, 140, 1.5);
    g.fillRect(-70, -25.5, 140, 1.5);
    g.restore();
    // sandbags on top
    for (let k = 0; k < 8; k++) {
      ellipse(g, -49 + k * 14, -33, 8, 4.4);
      shape(g, lin(g, 0, -37, 0, -29, ['#d6c08a', '#9e8758']), 'rgba(0,0,0,.5)', 0.8);
    }
    for (let k = 0; k < 7; k++) {
      ellipse(g, -42 + k * 14, -39, 8, 4.2);
      shape(g, lin(g, 0, -43, 0, -35, ['#e0cb96', '#a89062']), 'rgba(0,0,0,.5)', 0.8);
    }
  });
}

// ------------------------------------------------------------------ props
function prop(kind, theme) {
  switch (kind) {
    case 'building':
    case 'building_n': {
      const night = kind === 'building_n';
      const wallC = night ? '#3a3448' : ['#9b6a4f', '#7d8a9b', '#a08a6a'][Math.floor(Math.random() * 3)];
      return paint(112, 160, (g) => {
        rr(g, -54, -156, 108, 156, 3);
        shape(g, lin(g, -54, 0, 54, 0, [shade(wallC, 0.15), wallC, shade(wallC, -0.3)]), 'rgba(0,0,0,.6)', 1.4);
        rr(g, -57, -160, 114, 8, 2);
        shape(g, shade(wallC, -0.35), 'rgba(0,0,0,.6)', 1);
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 4; c++) {
            const x = -44 + c * 24;
            const y = -146 + r * 23;
            rr(g, x, y, 15, 14, 1.5);
            const lit = night && Math.random() < 0.35;
            const broken = !night && Math.random() < 0.25;
            shape(g, lit ? lin(g, 0, y, 0, y + 14, ['#ffe9a0', '#ffb84a']) : broken ? '#141418' : lin(g, x, y, x + 15, y + 14, ['#5d7a99', '#23324a']), 'rgba(0,0,0,.6)', 0.8);
            if (!lit && !broken) {
              g.fillStyle = 'rgba(255,255,255,.18)';
              g.fillRect(x + 2, y + 2, 4, 10);
            }
          }
        }
        rr(g, -12, -22, 24, 22, 2);
        shape(g, '#2a2420', 'rgba(0,0,0,.6)', 1);
        // damage hole
        g.fillStyle = 'rgba(20,16,14,.85)';
        ellipse(g, 30, -60, 9, 6);
        g.fill();
      });
    }
    case 'lamp':
      return paint(26, 98, (g) => {
        rr(g, -2, -94, 4, 94, 1.5);
        shape(g, lin(g, -2, 0, 2, 0, ['#6a6f78', '#2c2f35']), 'rgba(0,0,0,.6)', 0.8);
        rr(g, -2, -96, 14, 3, 1.5);
        shape(g, '#3a3e45', 'rgba(0,0,0,.6)', 0.8);
        rr(g, 7, -95, 8, 5, 2);
        shape(g, '#ffe7a0', 'rgba(0,0,0,.6)', 0.8);
        rr(g, -4, -6, 8, 6, 1);
        shape(g, '#2c2f35', null);
      });
    case 'car':
      return paint(76, 36, (g) => {
        const col = ['#7a8b99', '#8c5a3c', '#9b3b3b', '#4a6a5a'][Math.floor(Math.random() * 4)];
        rr(g, -36, -24, 72, 18, 6);
        shape(g, lin(g, 0, -24, 0, -6, [shade(col, 0.2), shade(col, -0.3)]), 'rgba(0,0,0,.65)', 1.2);
        g.beginPath();
        g.moveTo(-22, -24);
        g.lineTo(-14, -35);
        g.lineTo(16, -35);
        g.lineTo(24, -24);
        g.closePath();
        shape(g, shade(col, -0.1), 'rgba(0,0,0,.65)', 1.2);
        poly(g, [-18, -24, -12, -32, 13, -32, 19, -24]);
        shape(g, lin(g, 0, -32, 0, -24, ['#3b4a5c', '#151c26']), null);
        g.fillStyle = 'rgba(30,20,10,.4)';
        ellipse(g, 10, -14, 9, 4);
        g.fill();
        for (const x of [-22, 22]) {
          circle(g, x, -6, 6);
          shape(g, '#18181b', 'rgba(0,0,0,.6)', 1);
          circle(g, x, -6, 2.4);
          shape(g, '#8a8f96', null);
        }
      });
    case 'tree':
      return paint(60, 88, (g) => {
        rr(g, -3.5, -40, 7, 40, 2);
        shape(g, lin(g, -3, 0, 3, 0, ['#7a5434', '#4a3220']), 'rgba(0,0,0,.6)', 0.9);
        for (const [x, y, r, c] of [[-14, -46, 14, '#3f7a34'], [14, -48, 14, '#3a7230'], [0, -62, 18, '#4a8a3a'], [-8, -76, 11, '#57a044'], [9, -72, 12, '#4f9640']]) {
          circle(g, x, y, r);
          shape(g, rad(g, x - r * 0.4, y - r * 0.4, 1, r * 1.2, [shade(c, 0.35), c, shade(c, -0.35)]), 'rgba(10,30,10,.55)', 1);
        }
      });
    case 'cone':
      return paint(14, 18, (g) => {
        poly(g, [-3, -17, 3, -17, 6, -2, -6, -2]);
        shape(g, '#ff7a1a', 'rgba(0,0,0,.6)', 0.7);
        g.fillStyle = '#fff';
        g.fillRect(-4, -11, 8, 3);
        rr(g, -7, -2.5, 14, 2.5, 1);
        shape(g, '#d4561a', null);
      });
    case 'cactus':
      return paint(36, 64, (g) => {
        const c = '#4f9a4a';
        rr(g, -5, -62, 10, 62, 5);
        shape(g, lin(g, -5, 0, 5, 0, [shade(c, 0.25), c, shade(c, -0.35)]), 'rgba(10,40,10,.6)', 1);
        rr(g, -17, -42, 8, 22, 4);
        shape(g, c, 'rgba(10,40,10,.6)', 1);
        rr(g, -17, -24, 14, 7, 3.5);
        shape(g, c, 'rgba(10,40,10,.6)', 1);
        rr(g, 9, -50, 8, 20, 4);
        shape(g, c, 'rgba(10,40,10,.6)', 1);
        rr(g, 3, -32, 14, 7, 3.5);
        shape(g, c, 'rgba(10,40,10,.6)', 1);
        circle(g, 0, -63, 2.5);
        shape(g, '#ff6a9a', null);
      });
    case 'rock':
    case 'snowrock':
      return paint(56, 32, (g) => {
        const c = kind === 'rock' ? '#a0855e' : '#8c96a3';
        poly(g, [-26, 0, -22, -18, -8, -30, 10, -27, 24, -14, 27, 0]);
        shape(g, lin(g, -20, -30, 20, 0, [shade(c, 0.3), c, shade(c, -0.35)]), 'rgba(0,0,0,.55)', 1);
        if (kind === 'snowrock') {
          poly(g, [-22, -18, -8, -30, 10, -27, 22, -15, 8, -19, -6, -16]);
          shape(g, '#f7fbff', null);
        }
      });
    case 'wreck':
      return paint(96, 50, (g) => {
        rr(g, -46, -34, 64, 28, 3);
        shape(g, lin(g, 0, -34, 0, -6, ['#a8643c', '#6a3a22']), 'rgba(0,0,0,.65)', 1.2);
        rr(g, 18, -44, 28, 38, 4);
        shape(g, lin(g, 0, -44, 0, -6, ['#b87048', '#704028']), 'rgba(0,0,0,.65)', 1.2);
        rr(g, 22, -40, 20, 12, 2);
        shape(g, '#1c232c', null);
        g.fillStyle = 'rgba(60,30,10,.5)';
        for (let k = 0; k < 6; k++) {
          circle(g, -40 + k * 11, -20 + (k % 2) * 6, 3);
          g.fill();
        }
        for (const x of [-32, 0, 32]) {
          circle(g, x, -6, 7);
          shape(g, '#1a1a1c', 'rgba(0,0,0,.6)', 1);
        }
      });
    case 'drums':
      return paint(44, 32, (g) => {
        const toxic = theme === 'toxic';
        for (const [x, c] of [[-12, toxic ? '#3f8a2a' : '#3a5a8a'], [10, toxic ? '#c9c92a' : '#8a3a2a'], [-1, toxic ? '#5aa03a' : '#6a6a3a']]) {
          const y = x === -1 ? -10 : 0;
          rr(g, x - 9, y - 22, 18, 22, 2.5);
          shape(g, lin(g, x - 9, 0, x + 9, 0, [shade(c, 0.25), c, shade(c, -0.4)]), 'rgba(0,0,0,.6)', 1);
          ellipse(g, x, y - 22, 9, 2.4);
          shape(g, shade(c, -0.15), 'rgba(0,0,0,.5)', 0.6);
          if (toxic) {
            circle(g, x, y - 12, 3);
            shape(g, '#e6ff5a', null);
          }
        }
      });
    case 'skull':
      return paint(24, 16, (g) => {
        ellipse(g, 0, -8, 8, 6);
        shape(g, '#efe6cf', 'rgba(0,0,0,.5)', 0.8);
        g.strokeStyle = '#efe6cf';
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(-7, -11);
        g.quadraticCurveTo(-13, -14, -11, -6);
        g.moveTo(7, -11);
        g.quadraticCurveTo(13, -14, 11, -6);
        g.stroke();
        g.fillStyle = '#2a2420';
        circle(g, -3, -9, 1.6);
        g.fill();
        circle(g, 3, -9, 1.6);
        g.fill();
      });
    case 'sign':
    case 'hazard':
      return paint(34, 54, (g) => {
        rr(g, -1.6, -40, 3.2, 40, 1);
        shape(g, '#6a5a44', 'rgba(0,0,0,.6)', 0.8);
        if (kind === 'hazard') {
          poly(g, [0, -54, 15, -30, -15, -30]);
          shape(g, '#ffd23b', '#1c1c1c', 1.6);
          circle(g, 0, -38, 4);
          shape(g, '#1c1c1c', null);
        } else {
          rr(g, -15, -52, 30, 14, 2);
          shape(g, lin(g, 0, -52, 0, -38, ['#3a7a4a', '#22553a']), 'rgba(0,0,0,.6)', 1);
          g.fillStyle = 'rgba(255,255,255,.85)';
          g.fillRect(-10, -47, 20, 1.6);
          g.fillRect(-10, -43, 14, 1.6);
        }
      });
    case 'pine':
      return paint(56, 98, (g) => {
        rr(g, -3, -16, 6, 16, 1.5);
        shape(g, '#5a3e28', 'rgba(0,0,0,.6)', 0.8);
        for (let k = 0; k < 4; k++) {
          const y = -16 - k * 19;
          const w = 26 - k * 5;
          poly(g, [-w, y, 0, y - 30, w, y]);
          shape(g, lin(g, 0, y - 30, 0, y, ['#3f7a5a', '#1f4a36']), 'rgba(10,30,20,.6)', 1);
          poly(g, [-w * 0.6, y - 12, 0, y - 30, w * 0.6, y - 12, 0, y - 16]);
          shape(g, '#f7fbff', null);
        }
      });
    case 'fence':
      return paint(64, 24, (g) => {
        for (let k = 0; k < 5; k++) {
          rr(g, -30 + k * 14, -22, 5, 22, 1);
          shape(g, '#8a6a48', 'rgba(0,0,0,.55)', 0.8);
        }
        rr(g, -32, -17, 64, 3.5, 1);
        shape(g, '#7a5a3a', 'rgba(0,0,0,.55)', 0.8);
        rr(g, -32, -8, 64, 3.5, 1);
        shape(g, '#7a5a3a', 'rgba(0,0,0,.55)', 0.8);
        g.fillStyle = '#f7fbff';
        for (let k = 0; k < 5; k++) {
          ellipse(g, -27.5 + k * 14, -22.5, 3.4, 1.6);
          g.fill();
        }
      });
    case 'deadtree':
      return paint(56, 88, (g) => {
        g.strokeStyle = '#2e2620';
        g.lineCap = 'round';
        const br = (x, y, a, l, w) => {
          if (l < 6) return;
          const x2 = x + Math.cos(a) * l;
          const y2 = y + Math.sin(a) * l;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x2, y2);
          g.stroke();
          br(x2, y2, a - 0.45, l * 0.68, w * 0.65);
          br(x2, y2, a + 0.4, l * 0.62, w * 0.65);
        };
        br(0, 0, -Math.PI / 2, 34, 6);
      });
    case 'pipe':
      return paint(76, 44, (g) => {
        rr(g, -36, -30, 72, 14, 7);
        shape(g, lin(g, 0, -30, 0, -16, ['#a0805a', '#5a4028']), 'rgba(0,0,0,.6)', 1.2);
        rr(g, -30, -16, 10, 16, 2);
        shape(g, '#5a4a3a', 'rgba(0,0,0,.6)', 1);
        rr(g, 20, -16, 10, 16, 2);
        shape(g, '#5a4a3a', 'rgba(0,0,0,.6)', 1);
        ellipse(g, 36, -23, 4, 7);
        shape(g, '#1a1a14', 'rgba(0,0,0,.6)', 1);
        g.fillStyle = '#b8f03a';
        ellipse(g, 38, -16, 3, 2);
        g.fill();
      });
    default:
      return null;
  }
}

function jet() {
  return paint(64, 60, (g) => {
    // top view, nose pointing up
    poly(g, [0, -60, 6, -40, 30, -20, 30, -12, 6, -16, 8, -4, 16, 0, -16, 0, -8, -4, -6, -16, -30, -12, -30, -20, -6, -40]);
    shape(g, lin(g, -30, 0, 30, 0, ['#5d6e80', '#a9b8c8', '#5d6e80']), 'rgba(0,0,0,.7)', 1.2);
    ellipse(g, 0, -42, 3, 7);
    shape(g, lin(g, 0, -50, 0, -34, ['#9ad8ff', '#1d4f9c']), null);
    g.fillStyle = '#c9971c';
    poly(g, [-24, -17, -18, -18, -18, -15]);
    g.fill();
    poly(g, [24, -17, 18, -18, 18, -15]);
    g.fill();
  });
}
function missile() {
  return paint(12, 38, (g) => {
    rr(g, -3.5, -34, 7, 30, 3);
    shape(g, lin(g, -3.5, 0, 3.5, 0, ['#9aa3ad', '#e8edf2', '#7a828c']), 'rgba(0,0,0,.6)', 0.8);
    poly(g, [-3.5, -34, 0, -40, 3.5, -34]);
    shape(g, '#d6342a', 'rgba(0,0,0,.6)', 0.8);
    poly(g, [-3.5, -10, -7, -2, -3.5, -5]);
    shape(g, '#d6342a', null);
    poly(g, [3.5, -10, 7, -2, 3.5, -5]);
    shape(g, '#d6342a', null);
  });
}

function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.45)'));
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}
function shadowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.5)');
  gr.addColorStop(0.6, 'rgba(0,0,0,.28)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export class Sprites {
  constructor() {
    this.cache = new Map();
    this.shadow = shadowSprite();
    this.glow = {
      white: glow('rgba(255,255,255,1)'),
      muzzle: glow('rgba(255,214,110,1)'),
      fire: glow('rgba(255,130,40,1)'),
      blue: glow('rgba(110,190,255,1)'),
      green: glow('rgba(200,255,90,1)'),
      red: glow('rgba(255,70,60,1)'),
      lamp: glow('rgba(255,220,150,1)'),
    };
  }
  get(key, make) {
    let s = this.cache.get(key);
    if (!s) {
      s = make();
      this.cache.set(key, s);
    }
    return s;
  }
  soldier(frame, helmet) {
    return this.get(`s${frame}${helmet}`, () => soldier(frame, helmet));
  }
  zombie(type, frame, v, flash) {
    const key = `z${type}${frame}${v}${flash ? 'f' : ''}`;
    return this.get(key, () => {
      if (flash) return flashOf(this.zombie(type, frame, v, false));
      switch (type) {
        case 'runner':
          return runner(frame, v);
        case 'brute':
          return brute(frame, v);
        case 'giant':
          return brute(frame, v, true);
        case 'armored':
          return walker(frame, v, { helmet: true, vest: true, shirt: '#3a4250' });
        case 'bloater':
          return bloater(frame);
        case 'crawler':
          return crawler(frame);
        default:
          return walker(frame, v);
      }
    });
  }
  boss(id, frame, flash) {
    const key = `b${id}${frame}${flash ? 'f' : ''}`;
    return this.get(key, () => (flash ? flashOf(this.boss(id, frame, false)) : boss(id, frame)));
  }
  obj(kind, reward, flash) {
    const key = `o${kind}${reward || ''}${flash ? 'f' : ''}`;
    return this.get(key, () => {
      if (flash) return flashOf(this.obj(kind, reward, false));
      if (kind === 'barrel') return barrel();
      if (kind === 'crate') return crate(reward);
      return wall();
    });
  }
  prop(kind, theme, v = 0) {
    return this.get(`p${kind}${theme}${v}`, () => prop(kind, theme));
  }
  jet() {
    return this.get('jet', jet);
  }
  missile() {
    return this.get('missile', missile);
  }
}

export function drawSpr(ctx, spr, x, y, s, alpha = 1) {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(spr.c, x - spr.ax * s, y - spr.ay * s, spr.w * s, spr.h * s);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
