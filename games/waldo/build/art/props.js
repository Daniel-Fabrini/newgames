// Scenery toolkit (pixel space, y = ground/base line unless noted). Every sprite is inked.
(function () {
  const WA = window.WA;
  const { INK, C, circ, ell, rrect, poly, blob, limb, line, arc, dot, shade, mix } = WA;
  const P = (WA.P = {});
  const setInk = (sz) => (WA.ink = WA.clamp(sz * 0.022, 1.7, 3.4));
  P.setInk = setInk;

  // path-based stripe fill helper: builds the path with fn(), fills with stripes, then inks it
  function stripedPath(g, pathFn, bx, by, bw, bh, c1, c2, n, dir) {
    pathFn();
    WA.stripes(g, bx, by, bw, bh, c1, c2, n, dir);
    pathFn();
    g.lineWidth = WA.ink;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  }
  P.stripedPath = stripedPath;

  // ----- parasols / tents / awnings -----
  P.umbrella = (g, x, y, w, c1 = C.red, c2 = C.white, tilt = 0) => {
    setInk(w);
    const h = w * 0.78;
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    line(g, 0, 0, 0, -h, WA.ink * 3, INK);
    line(g, 0, 0, 0, -h, WA.ink * 1.2, '#cfd3d8');
    const path = () => {
      g.beginPath();
      g.moveTo(-w / 2, -h * 0.62);
      g.quadraticCurveTo(0, -h * 1.55, w / 2, -h * 0.62);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x1 = w / 2 - ((i + 0.5) * w) / n, x2 = w / 2 - ((i + 1) * w) / n;
        g.quadraticCurveTo(x1, -h * 0.5, x2, -h * 0.62);
      }
      g.closePath();
    };
    stripedPath(g, path, -w / 2, -h * 1.2, w, h * 0.7, c1, c2, 12, 'v');
    circ(g, 0, -h * 1.04, w * 0.03, '#f6e28a');
    g.restore();
  };
  // Flat-top "market" canopy on two poles (striped awning, a classic decoy).
  P.awning = (g, x, y, w, h, c1 = C.red, c2 = C.white, drop = 0.28) => {
    setInk(w);
    line(g, x - w / 2 + 3, y, x - w / 2 + 3, y - h, WA.ink * 2.6, INK);
    line(g, x + w / 2 - 3, y, x + w / 2 - 3, y - h, WA.ink * 2.6, INK);
    const top = y - h, ah = h * drop;
    const n = Math.max(4, Math.round(w / 14));
    const path = () => {
      g.beginPath();
      g.moveTo(x - w / 2, top);
      g.lineTo(x + w / 2, top);
      g.lineTo(x + w / 2 + 3, top + ah);
      for (let i = 0; i < n; i++) {
        const xa = x + w / 2 + 3 - (i * (w + 6)) / n, xb = x + w / 2 + 3 - ((i + 1) * (w + 6)) / n;
        g.quadraticCurveTo((xa + xb) / 2, top + ah + ah * 0.55, xb, top + ah);
      }
      g.closePath();
    };
    stripedPath(g, path, x - w / 2 - 4, top, w + 8, ah * 2, c1, c2, n * 1, 'v');
  };
  P.tent = (g, x, y, w, h, c1 = C.red, c2 = C.white, o = {}) => {
    setInk(w);
    const flag = o.flag !== false;
    const path = () => {
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x, y - h);
      g.lineTo(x + w / 2, y);
      g.closePath();
    };
    stripedPath(g, path, x - w / 2, y - h, w, h, c1, c2, o.n || 8, 'v');
    // door
    g.beginPath();
    g.moveTo(x - w * 0.14, y);
    g.lineTo(x, y - h * 0.5);
    g.lineTo(x + w * 0.14, y);
    g.closePath();
    WA.fillInk(g, o.door || '#33212a');
    if (flag) {
      line(g, x, y - h, x, y - h - w * 0.2, WA.ink * 1.3);
      poly(g, [[x, y - h - w * 0.2], [x + w * 0.16, y - h - w * 0.15], [x, y - h - w * 0.1]], o.flagC || C.yellow, WA.ink * 0.8);
    }
  };
  // Circus big top: striped cone + scalloped skirt.
  P.bigtop = (g, x, y, w, h, c1 = C.red, c2 = C.yellow) => {
    setInk(w * 0.6);
    const wallH = h * 0.38;
    const wall = () => {
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w / 2, y - wallH);
      g.lineTo(x + w / 2, y - wallH);
      g.lineTo(x + w / 2, y);
      g.closePath();
    };
    stripedPath(g, wall, x - w / 2, y - wallH, w, wallH, c1, c2, 14, 'v');
    const roof = () => {
      g.beginPath();
      g.moveTo(x - w * 0.56, y - wallH);
      g.quadraticCurveTo(x - w * 0.2, y - h * 0.8, x, y - h);
      g.quadraticCurveTo(x + w * 0.2, y - h * 0.8, x + w * 0.56, y - wallH);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const xa = x + w * 0.56 - (i * w * 1.12) / n, xb = x + w * 0.56 - ((i + 1) * w * 1.12) / n;
        g.quadraticCurveTo((xa + xb) / 2, y - wallH + h * 0.07, xb, y - wallH);
      }
      g.closePath();
    };
    stripedPath(g, roof, x - w * 0.56, y - h, w * 1.12, h, c1, c2, 14, 'v');
    // door
    g.beginPath();
    g.moveTo(x - w * 0.1, y);
    g.lineTo(x - w * 0.1, y - wallH * 0.7);
    g.quadraticCurveTo(x, y - wallH * 1.1, x + w * 0.1, y - wallH * 0.7);
    g.lineTo(x + w * 0.1, y);
    g.closePath();
    WA.fillInk(g, '#33212a');
    line(g, x, y - h, x, y - h - w * 0.14, WA.ink * 1.4);
    poly(g, [[x, y - h - w * 0.14], [x + w * 0.12, y - h - w * 0.1], [x, y - h - w * 0.06]], C.red, WA.ink * 0.8);
  };
  P.beachCabin = (g, x, y, w, h, c1 = C.blue, c2 = C.white) => {
    setInk(w);
    const body = () => {
      g.beginPath();
      g.rect(x - w / 2, y - h, w, h);
    };
    stripedPath(g, body, x - w / 2, y - h, w, h, c1, c2, 8, 'v');
    // peaked roof
    poly(g, [[x - w * 0.56, y - h], [x, y - h - w * 0.3], [x + w * 0.56, y - h]], c1);
    rrect(g, x - w * 0.2, y - h * 0.78, w * 0.4, h * 0.78, 3, '#33212a');
    rrect(g, x - w * 0.22, y - h * 0.8, w * 0.44, h * 0.1, 2, c2);
  };

  // ----- water things -----
  P.sailboat = (g, x, y, w, c1 = C.white, c2 = C.red, hull = '#2f5a9a') => {
    setInk(w);
    const mastH = w * 1.1;
    line(g, x, y - 4, x, y - mastH, WA.ink * 2, INK);
    const sail = () => {
      g.beginPath();
      g.moveTo(x + 2, y - mastH + 4);
      g.quadraticCurveTo(x + w * 0.5, y - w * 0.5, x + w * 0.42, y - w * 0.14);
      g.lineTo(x + 2, y - w * 0.14);
      g.closePath();
    };
    stripedPath(g, sail, x, y - mastH, w * 0.5, mastH, c1, c2, 6, 'h');
    const sail2 = () => {
      g.beginPath();
      g.moveTo(x - 2, y - mastH + 12);
      g.lineTo(x - w * 0.36, y - w * 0.14);
      g.lineTo(x - 2, y - w * 0.14);
      g.closePath();
    };
    sail2();
    WA.fillInk(g, c2);
    g.beginPath();
    g.moveTo(x - w * 0.5, y - w * 0.12);
    g.lineTo(x + w * 0.5, y - w * 0.12);
    g.quadraticCurveTo(x + w * 0.38, y + w * 0.1, x + w * 0.22, y + w * 0.1);
    g.lineTo(x - w * 0.3, y + w * 0.1);
    g.quadraticCurveTo(x - w * 0.42, y + w * 0.08, x - w * 0.5, y - w * 0.12);
    WA.fillInk(g, hull);
    line(g, x - w * 0.46, y - w * 0.04, x + w * 0.44, y - w * 0.04, WA.ink * 1.2, C.white);
  };
  // Rowboat; draws back half only if `part` = 'back', front rim if 'front' (so riders can sit inside).
  P.rowboat = (g, x, y, w, hull = '#b9722f', inner = '#7a4a1e', part = 'all') => {
    setInk(w);
    const h = w * 0.3;
    if (part !== 'front') {
      g.beginPath();
      g.moveTo(x - w / 2, y - h);
      g.lineTo(x + w / 2, y - h);
      g.quadraticCurveTo(x + w * 0.36, y + h * 0.4, x + w * 0.2, y + h * 0.5);
      g.lineTo(x - w * 0.2, y + h * 0.5);
      g.quadraticCurveTo(x - w * 0.36, y + h * 0.4, x - w / 2, y - h);
      g.closePath();
      WA.fillInk(g, inner);
    }
    if (part !== 'back') {
      g.beginPath();
      g.moveTo(x - w / 2, y - h * 0.6);
      g.lineTo(x + w / 2, y - h * 0.6);
      g.quadraticCurveTo(x + w * 0.36, y + h * 0.5, x + w * 0.2, y + h * 0.6);
      g.lineTo(x - w * 0.2, y + h * 0.6);
      g.quadraticCurveTo(x - w * 0.36, y + h * 0.5, x - w / 2, y - h * 0.6);
      g.closePath();
      WA.fillInk(g, hull);
      line(g, x - w * 0.46, y - h * 0.3, x + w * 0.46, y - h * 0.3, WA.ink * 1.4, C.white);
    }
  };
  P.floatDuck = (g, x, y, w, c = C.yellow) => {
    setInk(w);
    WA.sprite(g, x, y, w * 0.9, (gg) => WA.CREATURES.duck(gg, { body: c }), 1);
  };
  P.ring = (g, x, y, w, c1 = C.red, c2 = C.white) => {
    setInk(w);
    g.save();
    g.translate(x, y);
    g.scale(1, 0.55);
    g.beginPath();
    g.arc(0, 0, w / 2, 0, Math.PI * 2);
    g.arc(0, 0, w * 0.24, 0, Math.PI * 2, true);
    WA.stripes(g, -w / 2, -w / 2, w, w, c1, c2, 8, 'd');
    g.beginPath();
    g.arc(0, 0, w / 2, 0, Math.PI * 2);
    g.lineWidth = WA.ink / 0.7;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, w * 0.24, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };
  P.buoy = (g, x, y, w, c1 = C.red, c2 = C.white) => {
    setInk(w);
    const path = () => {
      g.beginPath();
      g.moveTo(x - w * 0.5, y);
      g.quadraticCurveTo(x - w * 0.4, y - w * 0.7, x, y - w * 0.8);
      g.quadraticCurveTo(x + w * 0.4, y - w * 0.7, x + w * 0.5, y);
      g.closePath();
    };
    stripedPath(g, path, x - w / 2, y - w * 0.8, w, w * 0.8, c1, c2, 6, 'h');
    circ(g, x, y - w * 0.9, w * 0.14, C.yellow, WA.ink * 0.8);
  };
  P.beachball = (g, x, y, w, c1 = C.red) => {
    setInk(w * 3);
    circ(g, x, y - w / 2, w / 2, C.white);
    g.save();
    g.beginPath();
    g.arc(x, y - w / 2, w / 2, 0, 7);
    g.clip();
    const cols = [c1, C.yellow, C.blue];
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(x, y - w / 2);
      g.arc(x, y - w / 2, w, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
      g.closePath();
      if (i % 2 === 0) {
        g.fillStyle = cols[(i / 2) | 0];
        g.fill();
      }
    }
    g.restore();
    g.beginPath();
    g.arc(x, y - w / 2, w / 2, 0, 7);
    g.lineWidth = WA.ink;
    g.strokeStyle = INK;
    g.stroke();
  };
  P.surfboard = (g, x, y, h, c = C.yellow, c2 = C.red, lean = 0.1) => {
    setInk(h * 0.6);
    g.save();
    g.translate(x, y);
    g.rotate(lean);
    g.beginPath();
    g.moveTo(0, -h);
    g.quadraticCurveTo(h * 0.2, -h * 0.5, h * 0.12, 0);
    g.lineTo(-h * 0.12, 0);
    g.quadraticCurveTo(-h * 0.2, -h * 0.5, 0, -h);
    g.closePath();
    WA.fillInk(g, c);
    line(g, 0, -h * 0.95, 0, -2, WA.ink * 1.1, c2);
    g.restore();
  };
  // water ripple marks: small curved dashes
  P.ripple = (g, x, y, w, c = 'rgba(255,255,255,0.8)') => {
    g.lineWidth = Math.max(1.6, w * 0.07);
    g.strokeStyle = c;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w / 4, y - w * 0.14, x, y);
    g.quadraticCurveTo(x + w / 4, y + w * 0.14, x + w / 2, y);
    g.stroke();
  };
  P.wave = (g, x, y, w, c1, c2) => {
    // wavy foam edge
    g.beginPath();
    g.moveTo(x, y);
    const n = Math.max(2, Math.round(w / 40));
    for (let i = 0; i < n; i++) {
      g.quadraticCurveTo(x + ((i + 0.5) * w) / n, y - w * 0.04, x + ((i + 1) * w) / n, y);
    }
    g.lineWidth = Math.max(2, w * 0.012);
    g.strokeStyle = c1;
    g.stroke();
  };

  // ----- plants & rocks -----
  P.palm = (g, x, y, h, lean = 0.12, c = C.green) => {
    setInk(h * 0.4);
    const topx = x + lean * h, topy = y - h;
    g.beginPath();
    g.moveTo(x - h * 0.035, y);
    g.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.5, topx - h * 0.025, topy);
    g.lineTo(topx + h * 0.025, topy);
    g.quadraticCurveTo(x + lean * h * 0.2 + h * 0.07, y - h * 0.5, x + h * 0.04, y);
    g.closePath();
    WA.fillInk(g, '#a8763a');
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      line(g, x + lean * h * t * 0.8 - h * 0.035, y - h * t, x + lean * h * t * 0.8 + h * 0.035, y - h * t - 2, WA.ink * 0.8, '#6b4620');
    }
    const fronds = [[-1.0, -0.3], [-0.75, -0.6], [-0.3, -0.85], [0.2, -0.85], [0.7, -0.6], [1.0, -0.25], [-0.9, 0.12], [0.9, 0.15]];
    for (const [dx, dy] of fronds) {
      const ex = topx + dx * h * 0.42, ey = topy + dy * h * 0.3 + h * 0.06;
      g.beginPath();
      g.moveTo(topx, topy);
      g.quadraticCurveTo(topx + dx * h * 0.25, topy + dy * h * 0.5 - h * 0.1, ex, ey);
      g.quadraticCurveTo(topx + dx * h * 0.25, topy + dy * h * 0.5 + h * 0.04, topx, topy + h * 0.01);
      WA.fillInk(g, c);
    }
    circ(g, topx - 2, topy + 4, h * 0.03, '#8a5a2b', WA.ink * 0.8);
    circ(g, topx + 4, topy + 5, h * 0.03, '#8a5a2b', WA.ink * 0.8);
  };
  P.tree = (g, x, y, h, c = C.green, trunk = '#8a5a2b') => {
    setInk(h * 0.5);
    rrect(g, x - h * 0.06, y - h * 0.5, h * 0.12, h * 0.5, h * 0.02, trunk);
    const blobs = [[0, -0.78, 0.3], [-0.2, -0.62, 0.24], [0.2, -0.62, 0.24], [-0.1, -0.92, 0.2], [0.14, -0.88, 0.2]];
    for (const [dx, dy, r] of blobs) circ(g, x + dx * h, y + dy * h, r * h, c);
    for (const [dx, dy, r] of blobs.slice(0, 3)) circ(g, x + dx * h + r * h * 0.2, y + dy * h - r * h * 0.15, r * h * 0.4, shade(c, 0.22), 0.01);
  };
  P.pine = (g, x, y, h, c = '#1f8a4c', snow = false) => {
    setInk(h * 0.5);
    rrect(g, x - h * 0.05, y - h * 0.15, h * 0.1, h * 0.15, 2, '#6a4b2a');
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const by = y - h * 0.12 - t * h * 0.22, w = h * (0.44 - t * 0.08), top = by - h * 0.42 + t * h * 0.1;
      poly(g, [[x - w, by], [x, top], [x + w, by]], c);
      if (snow) {
        g.beginPath();
        g.moveTo(x - w * 0.55, by - (by - top) * 0.45);
        g.lineTo(x, top);
        g.lineTo(x + w * 0.55, by - (by - top) * 0.45);
        g.quadraticCurveTo(x + w * 0.25, by - (by - top) * 0.3, x, by - (by - top) * 0.42);
        g.quadraticCurveTo(x - w * 0.25, by - (by - top) * 0.3, x - w * 0.55, by - (by - top) * 0.45);
        WA.fillInk(g, C.white);
      }
    }
  };
  P.bush = (g, x, y, w, c = '#2fa84f', flowers = null) => {
    setInk(w * 0.8);
    for (const [dx, dy, r] of [[-0.25, -0.22, 0.26], [0.25, -0.22, 0.26], [0, -0.34, 0.3]]) circ(g, x + dx * w, y + dy * w, r * w, c);
    if (flowers) for (let i = 0; i < 5; i++) dot(g, x + (-0.3 + i * 0.15) * w, y - (0.2 + (i % 2) * 0.18) * w, w * 0.04, flowers);
  };
  P.rock = (g, x, y, w, c = '#9aa0a8') => {
    setInk(w * 0.8);
    blob(g, [[x - w * 0.5, y], [x - w * 0.46, y - w * 0.3], [x - w * 0.2, y - w * 0.5], [x + w * 0.2, y - w * 0.46], [x + w * 0.46, y - w * 0.2], [x + w * 0.5, y]], c);
    line(g, x - w * 0.15, y - w * 0.4, x - w * 0.05, y - w * 0.15, WA.ink * 0.8, shade(c, -0.3));
  };
  P.cloud = (g, x, y, w, c = '#ffffff') => {
    setInk(w * 0.35);
    const s = [[-0.3, 0, 0.2], [-0.1, -0.1, 0.26], [0.15, -0.06, 0.22], [0.34, 0.02, 0.16], [0, 0.04, 0.24]];
    const circs = () => {
      g.beginPath();
      for (const [dx, dy, r] of s) {
        g.moveTo(x + (dx + r) * w, y + dy * w * 0.6);
        g.arc(x + dx * w, y + dy * w * 0.6, r * w, 0, Math.PI * 2);
      }
    };
    circs();
    g.lineWidth = WA.ink * 2.2;
    g.strokeStyle = 'rgba(29,20,16,0.7)';
    g.stroke();
    circs();
    g.fillStyle = c;
    g.fill();
  };
  P.sandcastle = (g, x, y, w) => {
    setInk(w);
    const sand = '#e8c37a';
    rrect(g, x - w / 2, y - w * 0.3, w, w * 0.3, 2, sand);
    for (const dx of [-0.32, 0, 0.32]) {
      rrect(g, x + dx * w - w * 0.1, y - w * 0.5 - (dx === 0 ? w * 0.18 : 0), w * 0.2, w * 0.4 + (dx === 0 ? w * 0.18 : 0), 2, sand);
      for (let i = -1; i <= 1; i += 2) rrect(g, x + dx * w + i * w * 0.06 - w * 0.03, y - w * 0.56 - (dx === 0 ? w * 0.18 : 0), w * 0.06, w * 0.06, 1, sand);
    }
    line(g, x, y - w * 0.74, x, y - w * 0.95, WA.ink * 1.1);
    poly(g, [[x, y - w * 0.95], [x + w * 0.16, y - w * 0.9], [x, y - w * 0.85]], C.red, WA.ink * 0.8);
    rrect(g, x - w * 0.05, y - w * 0.18, w * 0.1, w * 0.18, w * 0.05, '#7a5a2b');
  };
  P.towel = (g, x, y, w, c1 = C.red, c2 = C.white, h) => {
    setInk(w);
    h = h || w * 0.34;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x - w * 0.42, y - h);
    g.lineTo(x + w * 0.5, y - h);
    g.lineTo(x + w * 0.42, y);
    g.closePath();
    const path = () => {
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w * 0.42, y - h);
      g.lineTo(x + w * 0.5, y - h);
      g.lineTo(x + w * 0.42, y);
      g.closePath();
    };
    stripedPath(g, path, x - w / 2, y - h, w * 1.0, h, c1, c2, 8, 'v');
  };
  P.sunbed = (g, x, y, w, c1 = C.blue, c2 = C.white) => {
    setInk(w);
    const path = () => {
      g.beginPath();
      g.moveTo(x - w / 2, y - w * 0.1);
      g.lineTo(x + w * 0.18, y - w * 0.1);
      g.lineTo(x + w * 0.5, y - w * 0.34);
      g.lineTo(x + w * 0.4, y - w * 0.4);
      g.lineTo(x + w * 0.1, y - w * 0.2);
      g.lineTo(x - w / 2, y - w * 0.2);
      g.closePath();
    };
    stripedPath(g, path, x - w / 2, y - w * 0.4, w, w * 0.3, c1, c2, 12, 'v');
    line(g, x - w * 0.42, y - w * 0.1, x - w * 0.42, y, WA.ink * 2);
    line(g, x + w * 0.3, y - w * 0.1, x + w * 0.3, y, WA.ink * 2);
  };
  P.lifeguard = (g, x, y, w) => {
    setInk(w);
    const h = w * 1.6;
    line(g, x - w * 0.34, y, x - w * 0.3, y - h * 0.5, WA.ink * 3, INK);
    line(g, x + w * 0.34, y, x + w * 0.3, y - h * 0.5, WA.ink * 3, INK);
    line(g, x - w * 0.34, y, x - w * 0.3, y - h * 0.5, WA.ink * 1.2, '#b88a4a');
    line(g, x + w * 0.34, y, x + w * 0.3, y - h * 0.5, WA.ink * 1.2, '#b88a4a');
    rrect(g, x - w * 0.46, y - h * 0.55, w * 0.92, h * 0.07, 2, '#b88a4a');
    rrect(g, x - w * 0.4, y - h * 0.98, w * 0.8, h * 0.43, 3, C.white);
    const roof = () => {
      g.beginPath();
      g.moveTo(x - w * 0.55, y - h * 0.98);
      g.lineTo(x + w * 0.55, y - h * 0.98);
      g.lineTo(x + w * 0.4, y - h * 1.15);
      g.lineTo(x - w * 0.4, y - h * 1.15);
      g.closePath();
    };
    stripedPath(g, roof, x - w * 0.55, y - h * 1.15, w * 1.1, h * 0.17, C.red, C.white, 6, 'v');
    rrect(g, x - w * 0.28, y - h * 0.88, w * 0.56, h * 0.18, 2, '#9fd3f0', WA.ink * 0.8);
    line(g, x + w * 0.4, y - h * 1.0, x + w * 0.4, y - h * 1.5, WA.ink * 1.2);
    poly(g, [[x + w * 0.4, y - h * 1.5], [x + w * 0.75, y - h * 1.42], [x + w * 0.4, y - h * 1.34]], C.red, WA.ink * 0.8);
  };

  // ----- structures -----
  P.house = (g, x, y, w, h, wall = '#f2c98a', roof = C.red, o = {}) => {
    setInk(w * 0.8);
    rrect(g, x - w / 2, y - h, w, h, 2, wall);
    // windows
    const cols = Math.max(2, Math.round(w / 40)), rows = Math.max(1, Math.round(h / 50));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + ((c + 0.5) * w) / cols, wy = y - h + ((r + 0.5) * (h - 20)) / rows + 4;
        rrect(g, wx - 7, wy - 9, 14, 18, 2, o.glass || '#8fd0ee', WA.ink * 0.9);
        line(g, wx, wy - 9, wx, wy + 9, WA.ink * 0.6);
        line(g, wx - 7, wy, wx + 7, wy, WA.ink * 0.6);
      }
    const rp = () => {
      g.beginPath();
      g.moveTo(x - w * 0.58, y - h);
      g.lineTo(x - w * 0.3, y - h - w * 0.28);
      g.lineTo(x + w * 0.3, y - h - w * 0.28);
      g.lineTo(x + w * 0.58, y - h);
      g.closePath();
    };
    if (o.roofStripes) stripedPath(g, rp, x - w * 0.6, y - h - w * 0.3, w * 1.2, w * 0.3, roof, o.roofStripes, 10, 'v');
    else {
      rp();
      WA.fillInk(g, roof);
    }
    rrect(g, x - 8, y - 26, 16, 26, 2, o.door || '#6a4020', WA.ink * 0.9);
  };
  P.flagpole = (g, x, y, h, c1 = C.red, c2 = C.white, stripes = false) => {
    setInk(h * 0.4);
    line(g, x, y, x, y - h, WA.ink * 3, INK);
    line(g, x, y, x, y - h, WA.ink * 1.2, '#cfd3d8');
    const w = h * 0.34, fh = h * 0.2;
    const path = () => {
      g.beginPath();
      g.moveTo(x, y - h);
      g.quadraticCurveTo(x + w * 0.5, y - h - fh * 0.2, x + w, y - h + fh * 0.1);
      g.lineTo(x + w, y - h + fh * 1.1);
      g.quadraticCurveTo(x + w * 0.5, y - h + fh * 0.8, x, y - h + fh);
      g.closePath();
    };
    if (stripes) stripedPath(g, path, x, y - h - fh * 0.3, w, fh * 1.6, c1, c2, 5, 'h');
    else {
      path();
      WA.fillInk(g, c1);
    }
  };
  P.bunting = (g, x0, y0, x1, y1, n = 8, cols = [C.red, C.yellow, C.blue, C.green, C.white], sag = 0.08) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const pt = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * L * sag];
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const [a, b] = pt(i / 24);
      i ? g.lineTo(a, b) : g.moveTo(a, b);
    }
    g.lineWidth = 1.6;
    g.strokeStyle = INK;
    g.stroke();
    const fs = L / n * 0.55;
    WA.ink = 1.6;
    for (let i = 0; i < n; i++) {
      const [a, b] = pt((i + 0.5) / n);
      poly(g, [[a - fs * 0.5, b], [a + fs * 0.5, b], [a, b + fs * 1.1]], cols[i % cols.length], 1.5);
    }
  };
  P.balloons = (g, x, y, h, cols = [C.red, C.yellow, C.blue, C.pink]) => {
    setInk(h * 0.5);
    cols.forEach((c, i) => {
      const bx = x + (i - (cols.length - 1) / 2) * h * 0.2, by = y - h + (i % 2) * h * 0.08;
      line(g, x, y, bx, by + h * 0.12, WA.ink * 0.5, '#555');
      ell(g, bx, by, h * 0.11, h * 0.14, c);
      poly(g, [[bx, by + h * 0.14], [bx - h * 0.02, by + h * 0.18], [bx + h * 0.02, by + h * 0.18]], c, WA.ink * 0.6);
    });
  };
  P.barrel = (g, x, y, w, c = '#a8672f') => {
    setInk(w);
    g.beginPath();
    g.moveTo(x - w * 0.4, y);
    g.quadraticCurveTo(x - w * 0.56, y - w * 0.45, x - w * 0.4, y - w * 0.9);
    g.lineTo(x + w * 0.4, y - w * 0.9);
    g.quadraticCurveTo(x + w * 0.56, y - w * 0.45, x + w * 0.4, y);
    g.closePath();
    WA.fillInk(g, c);
    for (const t of [0.2, 0.7]) line(g, x - w * 0.5, y - w * t, x + w * 0.5, y - w * t, WA.ink * 1.4, '#3a3a42');
    line(g, x - w * 0.14, y - w * 0.88, x - w * 0.16, y - 2, WA.ink * 0.6, shade(c, -0.3));
    line(g, x + w * 0.14, y - w * 0.88, x + w * 0.16, y - 2, WA.ink * 0.6, shade(c, -0.3));
    ell(g, x, y - w * 0.9, w * 0.4, w * 0.1, shade(c, 0.15), 0, WA.ink * 0.8);
  };
  P.crate = (g, x, y, w, c = '#c88a4a') => {
    setInk(w);
    rrect(g, x - w / 2, y - w * 0.8, w, w * 0.8, 2, c);
    line(g, x - w / 2, y - w * 0.4, x + w / 2, y - w * 0.4, WA.ink * 0.9, shade(c, -0.3));
    line(g, x - w / 2 + 2, y - w * 0.8 + 2, x + w / 2 - 2, y - 2, WA.ink * 0.9, shade(c, -0.25));
    line(g, x + w / 2 - 2, y - w * 0.8 + 2, x - w / 2 + 2, y - 2, WA.ink * 0.9, shade(c, -0.25));
  };
  P.chest = (g, x, y, w) => {
    setInk(w);
    rrect(g, x - w / 2, y - w * 0.5, w, w * 0.5, 3, '#8a4a1e');
    g.beginPath();
    g.moveTo(x - w / 2, y - w * 0.5);
    g.quadraticCurveTo(x, y - w * 0.95, x + w / 2, y - w * 0.5);
    g.closePath();
    WA.fillInk(g, '#a65d2a');
    line(g, x - w * 0.2, y - w * 0.72, x - w * 0.2, y, WA.ink * 1.6, '#f2b81c');
    line(g, x + w * 0.2, y - w * 0.72, x + w * 0.2, y, WA.ink * 1.6, '#f2b81c');
    rrect(g, x - w * 0.07, y - w * 0.58, w * 0.14, w * 0.14, 2, '#f2b81c', WA.ink * 0.8);
    for (let i = 0; i < 4; i++) circ(g, x - w * 0.3 + i * w * 0.2, y - w * 0.52, w * 0.05, '#f9d71c', WA.ink * 0.6);
  };
  P.cannon = (g, x, y, w, flip = 1) => {
    setInk(w);
    g.save();
    g.translate(x, y);
    g.scale(flip, 1);
    g.save();
    g.translate(0, -w * 0.3);
    g.rotate(-0.15);
    rrect(g, -w * 0.5, -w * 0.14, w * 0.95, w * 0.28, w * 0.1, '#3a3f48');
    rrect(g, w * 0.36, -w * 0.18, w * 0.14, w * 0.36, w * 0.04, '#3a3f48');
    circ(g, -w * 0.5, 0, w * 0.1, '#3a3f48');
    g.restore();
    circ(g, -w * 0.1, -w * 0.16, w * 0.17, '#8a5a2b');
    circ(g, -w * 0.1, -w * 0.16, w * 0.06, '#5b3a1e', WA.ink * 0.8);
    rrect(g, -w * 0.4, -w * 0.12, w * 0.7, w * 0.08, 2, '#8a5a2b');
    g.restore();
  };
  P.anchor = (g, x, y, h, c = '#3a3f48') => {
    setInk(h);
    line(g, x, y, x, y - h, WA.ink * 3.2, INK);
    line(g, x, y, x, y - h, WA.ink * 1.4, c);
    arc(g, x, y - h * 0.3, h * 0.38, 0.1, Math.PI - 0.1, WA.ink * 3.6, INK);
    arc(g, x, y - h * 0.3, h * 0.38, 0.1, Math.PI - 0.1, WA.ink * 1.8, c);
    line(g, x - h * 0.2, y - h * 0.86, x + h * 0.2, y - h * 0.86, WA.ink * 3.2, INK);
    line(g, x - h * 0.2, y - h * 0.86, x + h * 0.2, y - h * 0.86, WA.ink * 1.4, c);
    circ(g, x, y - h * 0.97, h * 0.07, null);
  };
  P.lamp = (g, x, y, h, c = '#ffe88a') => {
    setInk(h * 0.5);
    line(g, x, y, x, y - h, WA.ink * 3, INK);
    line(g, x, y, x, y - h, WA.ink * 1.2, '#3a3f48');
    rrect(g, x - h * 0.08, y - h * 1.14, h * 0.16, h * 0.16, h * 0.04, c);
    poly(g, [[x - h * 0.1, y - h * 1.14], [x, y - h * 1.24], [x + h * 0.1, y - h * 1.14]], '#3a3f48');
  };
  P.fence = (g, x0, x1, y, h, c = '#e8d9b0') => {
    setInk(h * 2);
    const n = Math.max(2, Math.round((x1 - x0) / (h * 0.45)));
    const sp = (x1 - x0) / n;
    line(g, x0, y - h * 0.3, x1, y - h * 0.3, WA.ink * 1.4, INK);
    line(g, x0, y - h * 0.65, x1, y - h * 0.65, WA.ink * 1.4, INK);
    for (let i = 0; i <= n; i++) {
      poly(g, [[x0 + i * sp - sp * 0.2, y], [x0 + i * sp - sp * 0.2, y - h * 0.9], [x0 + i * sp, y - h], [x0 + i * sp + sp * 0.2, y - h * 0.9], [x0 + i * sp + sp * 0.2, y]], c, WA.ink * 0.9);
    }
  };
  P.sign = (g, x, y, h, c = '#fffaf0', icon = 'arrow') => {
    setInk(h);
    line(g, x, y, x, y - h, WA.ink * 2.6, INK);
    line(g, x, y, x, y - h, WA.ink * 1.0, '#8a5a2b');
    const w = h * 0.7;
    rrect(g, x - w / 2, y - h * 1.05, w, h * 0.5, 3, c);
    if (icon === 'arrow') poly(g, [[x - w * 0.3, y - h * 0.84], [x + w * 0.1, y - h * 0.84], [x + w * 0.1, y - h * 0.94], [x + w * 0.34, y - h * 0.8], [x + w * 0.1, y - h * 0.66], [x + w * 0.1, y - h * 0.76], [x - w * 0.3, y - h * 0.76]], C.red, WA.ink * 0.5);
    else if (icon === 'star') circ(g, x, y - h * 0.8, w * 0.2, C.yellow, WA.ink * 0.7);
    else if (icon === 'fish') ell(g, x, y - h * 0.8, w * 0.28, w * 0.14, C.blue, 0, WA.ink * 0.6);
  };
  P.ladder = (g, x, y, h, w = 26, c = '#b88a4a') => {
    setInk(h * 0.3);
    line(g, x - w / 2, y, x - w / 2 + 3, y - h, WA.ink * 3.4, INK);
    line(g, x + w / 2, y, x + w / 2 - 3, y - h, WA.ink * 3.4, INK);
    line(g, x - w / 2, y, x - w / 2 + 3, y - h, WA.ink * 1.4, c);
    line(g, x + w / 2, y, x + w / 2 - 3, y - h, WA.ink * 1.4, c);
    for (let t = 0.1; t < 1; t += 0.14) {
      line(g, x - w / 2 + t * 3, y - h * t, x + w / 2 - t * 3, y - h * t, WA.ink * 2.8, INK);
      line(g, x - w / 2 + t * 3, y - h * t, x + w / 2 - t * 3, y - h * t, WA.ink * 1.2, c);
    }
  };

  // generic "scatter" helper: items placed by theme code use these small decor sprites
  P.flowers = (g, x, y, w, cols = [C.red, C.yellow, C.pink, C.white]) => {
    setInk(w);
    for (let i = 0; i < 6; i++) {
      const fx = x + (-0.4 + i * 0.16) * w, fy = y - (i % 2) * w * 0.08;
      line(g, fx, fy, fx, fy - w * 0.14, 1.4, '#1d7a3d');
      circ(g, fx, fy - w * 0.16, w * 0.05, cols[i % cols.length], 1.2);
    }
  };
  P.star5 = (g, x, y, r, c = '#f9d71c') => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    WA.fillInk(g, c, Math.max(1.4, r * 0.1));
  };
  P.kite = (g, x, y, w, c1 = C.red, c2 = C.yellow, tailTo) => {
    setInk(w);
    poly(g, [[x, y - w * 0.6], [x + w * 0.4, y], [x, y + w * 0.6], [x - w * 0.4, y]], c1);
    poly(g, [[x, y - w * 0.6], [x + w * 0.4, y], [x, y]], c2, WA.ink * 0.6);
    poly(g, [[x, y + w * 0.6], [x - w * 0.4, y], [x, y]], c2, WA.ink * 0.6);
    g.beginPath();
    g.moveTo(x, y + w * 0.6);
    g.quadraticCurveTo(x + w * 0.4, y + w * 0.9, x - w * 0.1, y + w * 1.3);
    g.quadraticCurveTo(x - w * 0.4, y + w * 1.6, x + w * 0.1, y + w * 1.9);
    g.lineWidth = WA.ink * 0.8;
    g.strokeStyle = INK;
    g.stroke();
    for (const [dx, dy] of [[0.12, 0.95], [-0.1, 1.35], [0.1, 1.8]]) poly(g, [[x + dx * w - 5, y + dy * w], [x + dx * w + 5, y + dy * w], [x + dx * w, y + dy * w + 8]], dy > 1.3 ? c2 : c1, WA.ink * 0.6);
  };
  P.hotAirBalloon = (g, x, y, w, c1 = C.red, c2 = C.yellow) => {
    setInk(w);
    const path = () => {
      g.beginPath();
      g.moveTo(x - w * 0.14, y - w * 0.32);
      g.bezierCurveTo(x - w * 0.7, y - w * 0.6, x - w * 0.5, y - w * 1.45, x, y - w * 1.45);
      g.bezierCurveTo(x + w * 0.5, y - w * 1.45, x + w * 0.7, y - w * 0.6, x + w * 0.14, y - w * 0.32);
      g.closePath();
    };
    stripedPath(g, path, x - w * 0.6, y - w * 1.45, w * 1.2, w * 1.2, c1, c2, 9, 'v');
    line(g, x - w * 0.12, y - w * 0.32, x - w * 0.1, y - w * 0.14, WA.ink);
    line(g, x + w * 0.12, y - w * 0.32, x + w * 0.1, y - w * 0.14, WA.ink);
    rrect(g, x - w * 0.12, y - w * 0.14, w * 0.24, w * 0.14, 2, '#a8672f');
  };
  P.plane = (g, x, y, w, c = C.white, c2 = C.red) => {
    setInk(w);
    g.save();
    g.translate(x, y);
    poly(g, [[-w * 0.5, -w * 0.02], [-w * 0.46, -w * 0.2], [-w * 0.36, -w * 0.2], [-w * 0.28, -w * 0.02]], c2);
    ell(g, 0, 0, w * 0.5, w * 0.1, c);
    poly(g, [[-w * 0.05, -w * 0.02], [-w * 0.2, -w * 0.3], [-w * 0.1, -w * 0.3], [w * 0.1, -w * 0.02]], c2);
    poly(g, [[-w * 0.05, 0.02], [-w * 0.22, w * 0.2], [-w * 0.12, w * 0.2], [w * 0.1, 0.02]], c2);
    for (let i = 0; i < 5; i++) dot(g, w * (0.08 + i * 0.07), -w * 0.02, w * 0.017, '#2b4a7a');
    g.restore();
  };
})();
