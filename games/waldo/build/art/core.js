// Core helpers for the offline scene painter (runs inside Chromium, see ../render.mjs).
(function () {
  const WA = (window.WA = window.WA || {});

  // ---------- random ----------
  WA.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.pick = (arr) => arr[(f() * arr.length) | 0];
    f.range = (a0, b0) => a0 + f() * (b0 - a0);
    f.int = (a0, b0) => a0 + ((f() * (b0 - a0 + 1)) | 0);
    f.chance = (p) => f() < p;
    f.weighted = (list) => {
      // list: [[value, weight], ...]
      let tot = 0;
      for (const e of list) tot += e[1];
      let r = f() * tot;
      for (const e of list) {
        r -= e[1];
        if (r <= 0) return e[0];
      }
      return list[list.length - 1][0];
    };
    f.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = (f() * (i + 1)) | 0;
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return f;
  };

  // ---------- colours ----------
  const h2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  WA.rgb = (hex) => {
    const s = hex.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  WA.mix = (a, b, t) => {
    const A = WA.rgb(a), B = WA.rgb(b);
    return '#' + A.map((v, i) => h2(v + (B[i] - v) * t)).join('');
  };
  WA.shade = (c, amt) => (amt >= 0 ? WA.mix(c, '#ffffff', amt) : WA.mix(c, '#140c08', -amt));

  WA.INK = '#1d1410';
  WA.C = {
    red: '#e5352b', red2: '#c42a24', white: '#fffaf0', cream: '#f6e9c8', yellow: '#f9d71c', gold: '#e9a919', orange: '#f28a1e',
    blue: '#2b6fd1', navy: '#233a7a', sky: '#7cc9ee', sky2: '#a9def5', green: '#2fa84f', lime: '#9cd13a', dgreen: '#1d7a3d', teal: '#18a5a5',
    pink: '#f28ab2', hot: '#e8478a', purple: '#7b4bb7', lilac: '#b79ae0', brown: '#8a5a2b', dbrown: '#5b3a1e', tan: '#d9b27a',
    grey: '#9aa0a8', dgrey: '#5d636b', lgrey: '#cfd3d8', black: '#2a2a30', sand: '#f2d8a0', sea: '#4ab3e0', sea2: '#2b8fcf',
  };
  WA.SKIN = ['#fbe0c6', '#f4cba2', '#eab98a', '#d89c6a', '#b97a4b', '#8c5a38', '#6a4128'];
  WA.HAIR = ['#2a1b12', '#3d281a', '#5a3a22', '#8a5a2b', '#c99b5a', '#e8d27a', '#1d1d22', '#b0b4ba', '#f2efe6'];
  WA.GINGER = '#d9531e';
  WA.BRIGHT = ['#e5352b', '#f9d71c', '#2b6fd1', '#2fa84f', '#f28a1e', '#f28ab2', '#7b4bb7', '#18a5a5', '#fffaf0', '#233a7a', '#9cd13a', '#e8478a', '#8a5a2b', '#2a2a30'];

  // ---------- drawing primitives (all take a Canvas 2D ctx `g`) ----------
  // Ink line width is kept in `WA.ink` (units of the current transform).
  WA.ink = 1.5;

  WA.fillInk = function (g, fill, lw) {
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.lineWidth = lw || WA.ink;
    g.strokeStyle = WA.INK;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  };
  WA.circ = (g, x, y, r, fill, lw) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    WA.fillInk(g, fill, lw);
  };
  WA.ell = (g, x, y, rx, ry, fill, rot = 0, lw) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    WA.fillInk(g, fill, lw);
  };
  WA.rrect = (g, x, y, w, h, r, fill, lw, noStroke) => {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    if (noStroke) {
      g.fillStyle = fill;
      g.fill();
    } else WA.fillInk(g, fill, lw);
  };
  WA.poly = (g, pts, fill, lw, noStroke) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (noStroke) {
      g.fillStyle = fill;
      g.fill();
    } else WA.fillInk(g, fill, lw);
  };
  // Smooth closed blob through points (quadratic midpoints).
  WA.blob = (g, pts, fill, lw, noStroke) => {
    const n = pts.length;
    g.beginPath();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m0 = mid(pts[n - 1], pts[0]);
    g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n]);
      g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    g.closePath();
    if (noStroke) {
      g.fillStyle = fill;
      g.fill();
    } else WA.fillInk(g, fill, lw);
  };
  // Inked stroke through points (a limb / rope / pole): outline then fill.
  WA.limb = (g, pts, w, fill, lw) => {
    lw = lw || WA.ink;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = WA.INK;
    g.lineWidth = w + lw * 2;
    g.stroke();
    g.strokeStyle = fill;
    g.lineWidth = w;
    g.stroke();
  };
  WA.line = (g, x0, y0, x1, y1, w, col) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = col || WA.INK;
    g.lineWidth = w || WA.ink;
    g.lineCap = 'round';
    g.stroke();
  };
  WA.arc = (g, x, y, r, a0, a1, w, col) => {
    g.beginPath();
    g.arc(x, y, r, a0, a1);
    g.strokeStyle = col || WA.INK;
    g.lineWidth = w || WA.ink;
    g.lineCap = 'round';
    g.stroke();
  };
  WA.dot = (g, x, y, r, col) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = col || WA.INK;
    g.fill();
  };
  // Stripes clipped to the current path: `dir` 'h' | 'v' | 'd'. Call after path is built.
  WA.stripes = function (g, bx, by, bw, bh, c1, c2, n, dir) {
    g.save();
    g.clip();
    g.fillStyle = c1;
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = c2;
    if (dir === 'v') {
      const s = bw / n;
      for (let i = 0; i < n; i += 2) g.fillRect(bx + i * s, by, s, bh);
    } else if (dir === 'd') {
      const s = (bw + bh) / n;
      g.beginPath();
      for (let i = 0; i < n; i += 2) {
        g.moveTo(bx + i * s, by);
        g.lineTo(bx + (i + 1) * s, by);
        g.lineTo(bx + (i + 1) * s - bh, by + bh);
        g.lineTo(bx + i * s - bh, by + bh);
        g.closePath();
      }
      g.fill();
    } else {
      const s = bh / n;
      for (let i = 0; i < n; i += 2) g.fillRect(bx, by + i * s, bw, s);
    }
    g.restore();
  };

  // seeded noise grid helper for backgrounds
  WA.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  WA.lerp = (a, b, t) => a + (b - a) * t;
})();
