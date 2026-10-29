// Animals, monsters, robots and other non-human sprites. Local space: feet at (0,0),
// facing +x, designed ~100 units tall (or wide for long animals). WA.sprite scales them.
(function () {
  const WA = window.WA;
  const { INK, C, circ, ell, rrect, poly, blob, limb, line, arc, dot, shade } = WA;

  // Draw `fn(g)` at (x,y) scaled so one unit = h/100 px.
  WA.sprite = function (g, x, y, h, fn, flip, noShadow) {
    const k = h / 100;
    g.save();
    g.translate(x, y);
    g.scale((flip || 1) * k, k);
    WA.ink = Math.max(1.8, 1.7 / k);
    fn(g);
    g.restore();
  };
  const shadow = (g, rx = 30, ry = 4) => {
    g.beginPath();
    g.ellipse(0, 0.5, rx, ry, 0, 0, 7);
    g.fillStyle = 'rgba(30,18,8,0.22)';
    g.fill();
  };
  WA.shadow = shadow;

  const CR = (WA.CREATURES = {});

  CR.dog = (g, v = {}) => {
    const b = v.body || '#f4efe4', sp = v.patch || '#8a5a2b', ear = v.ear || sp, col = v.collar === undefined ? C.red : v.collar;
    shadow(g, 42, 5);
    // far legs
    rrect(g, -22, -30, 9, 30, 4, shade(b, -0.12));
    rrect(g, 20, -30, 9, 30, 4, shade(b, -0.12));
    // tail
    limb(g, [[-34, -50], [-46, -62], [-44, -76]], 6, b);
    // body
    ell(g, -2, -44, 38, 21, b);
    if (v.spots) {
      g.save();
      g.beginPath();
      g.ellipse(-2, -44, 38, 21, 0, 0, 7);
      g.clip();
      for (const [sx, sy, sr] of [[-20, -52, 6], [-6, -38, 5], [10, -54, 6], [-28, -40, 4.5], [18, -40, 5], [2, -58, 4]]) dot(g, sx, sy, sr, sp);
      g.restore();
      ell(g, -2, -44, 38, 21, null);
    } else if (sp && !v.noPatch) {
      g.save();
      g.beginPath();
      g.ellipse(-2, -44, 38, 21, 0, 0, 7);
      g.clip();
      ell(g, -14, -52, 17, 12, sp, 0.3, 0.01);
      g.restore();
      ell(g, -2, -44, 38, 21, null);
    }
    // near legs
    rrect(g, -30, -30, 10, 30, 4, b);
    rrect(g, 12, -30, 10, 30, 4, b);
    ell(g, -25, -1, 8, 4, shade(b, -0.05));
    ell(g, 18, -1, 8, 4, shade(b, -0.05));
    // head
    circ(g, 36, -66, 17, b);
    ell(g, 50, -60, 11, 8, b);
    dot(g, 58, -63, 3.6, INK);
    line(g, 52, -53, 55, -52, WA.ink * 0.9);
    if (v.eyePatch) ell(g, 38, -70, 7, 7, v.eyePatch, 0, 0.01);
    dot(g, 41, -70, 2.4, INK);
    // ear
    g.save();
    g.translate(30, -76);
    g.rotate(0.2);
    ell(g, 0, 7, 7, 12, ear);
    g.restore();
    if (col) {
      limb(g, [[26, -54], [38, -52]], 5, col);
      circ(g, 34, -48, 3.2, '#f9d71c', WA.ink * 0.8);
    }
  };

  CR.cat = (g, v = {}) => {
    const b = v.body || '#e69a45', st = v.stripe || shade(b, -0.28);
    shadow(g, 30, 4);
    limb(g, [[-26, -26], [-48, -34], [-50, -62], [-40, -74]], 6, b);
    ell(g, 0, -28, 28, 17, b);
    for (let i = -2; i <= 2; i++) line(g, i * 9, -42, i * 9 + 2, -34, WA.ink * 1.2, st);
    rrect(g, 10, -22, 8, 22, 4, b);
    rrect(g, -22, -22, 8, 22, 4, b);
    circ(g, 28, -48, 14, b);
    poly(g, [[18, -58], [20, -76], [30, -60]], b);
    poly(g, [[30, -60], [38, -75], [40, -54]], b);
    dot(g, 33, -50, 2.2);
    dot(g, 41, -49, 2.2);
    dot(g, 38, -45, 1.6, '#e8478a');
    line(g, 40, -44, 52, -46, WA.ink * 0.5);
    line(g, 40, -43, 52, -41, WA.ink * 0.5);
  };

  CR.gull = (g, v = {}) => {
    ell(g, 0, -40, 24, 12, v.body || C.white);
    ell(g, 21, -50, 9, 8, v.body || C.white);
    poly(g, [[28, -52], [40, -49], [28, -47]], '#f6b92a', WA.ink * 0.8);
    dot(g, 24, -52, 1.6);
    g.beginPath();
    g.moveTo(-8, -44);
    g.quadraticCurveTo(-20, -74, -40, -62);
    g.quadraticCurveTo(-24, -58, -14, -38);
    WA.fillInk(g, v.wing || '#cfd3d8');
    limb(g, [[-4, -30], [-4, -4]], 3, '#f6b92a');
    limb(g, [[5, -30], [5, -4]], 3, '#f6b92a');
    poly(g, [[-22, -40], [-42, -42], [-34, -34]], v.body || C.white);
  };

  CR.parrot = (g, v = {}) => {
    const b = v.body || C.red;
    limb(g, [[-8, -30], [-14, -4], [-20, 6]], 8, v.tail || C.blue);
    ell(g, 0, -48, 14, 24, b, -0.1);
    circ(g, 6, -78, 11, b);
    poly(g, [[12, -82], [24, -76], [14, -70]], '#f6c32a', WA.ink * 0.8);
    circ(g, 8, -80, 3.5, C.white, WA.ink * 0.7);
    dot(g, 9, -80, 1.5);
    g.beginPath();
    g.moveTo(-6, -58);
    g.quadraticCurveTo(-22, -42, -10, -24);
    g.quadraticCurveTo(-4, -40, -6, -58);
    WA.fillInk(g, v.wing || C.yellow);
  };

  CR.fish = (g, v = {}) => {
    const b = v.body || C.orange;
    poly(g, [[-30, -40], [-48, -58], [-48, -22]], v.fin || shade(b, -0.1));
    ell(g, -4, -40, 30, 19, b);
    g.save();
    g.beginPath();
    g.ellipse(-4, -40, 30, 19, 0, 0, 7);
    g.clip();
    g.fillStyle = v.stripe || C.white;
    g.fillRect(-14, -62, 6, 44);
    g.fillRect(2, -62, 6, 44);
    g.restore();
    ell(g, -4, -40, 30, 19, null);
    circ(g, 16, -44, 4.5, C.white, WA.ink * 0.8);
    dot(g, 17, -44, 2);
    poly(g, [[-6, -58], [4, -70], [10, -58]], v.fin || shade(b, -0.1));
  };

  CR.crab = (g, v = {}) => {
    const b = v.body || C.red;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) line(g, s * 12, -12 - i * 3, s * (28 + i * 3), -4 - i * 4, WA.ink * 2.2, INK), line(g, s * 12, -12 - i * 3, s * (28 + i * 3), -4 - i * 4, WA.ink * 0.8, b);
      limb(g, [[s * 22, -26], [s * 36, -40]], 5, b);
      circ(g, s * 38, -46, 8, b);
      poly(g, [[s * 38, -46], [s * 44, -58], [s * 32, -52]], INK, WA.ink * 0.2, true);
    }
    ell(g, 0, -22, 26, 17, b);
    dot(g, -7, -38, 3.2, C.white);
    dot(g, 7, -38, 3.2, C.white);
    line(g, -7, -34, -7, -40, WA.ink);
    line(g, 7, -34, 7, -40, WA.ink);
    arc(g, 0, -24, 8, 0.2, Math.PI - 0.2, WA.ink * 0.9);
  };

  CR.octopus = (g, v = {}) => {
    const b = v.body || C.purple;
    for (let i = 0; i < 6; i++) {
      const x = -26 + i * 10.4;
      limb(g, [[x * 0.7, -30], [x, -12 - (i % 2) * 6], [x + (i % 2 ? 8 : -8), 2]], 7, b);
    }
    ell(g, 0, -56, 28, 32, b);
    circ(g, -9, -56, 7, C.white, WA.ink * 0.9);
    circ(g, 9, -56, 7, C.white, WA.ink * 0.9);
    dot(g, -7, -55, 3);
    dot(g, 11, -55, 3);
    arc(g, 0, -42, 6, 0.2, Math.PI - 0.2, WA.ink);
    for (const [x, y] of [[-14, -72], [4, -78], [16, -68]]) dot(g, x, y, 3, shade(b, 0.3));
  };

  // Chunky friendly/grumpy monsters (the reference is full of them).
  CR.monster = (g, v = {}) => {
    const b = v.body || C.green;
    shadow(g, 36, 5);
    // legs
    rrect(g, -18, -22, 14, 22, 6, shade(b, -0.1));
    rrect(g, 4, -22, 14, 22, 6, shade(b, -0.1));
    if (v.horns) {
      poly(g, [[-22, -78], [-30, -102], [-8, -86]], v.hornC || C.cream);
      poly(g, [[22, -78], [30, -102], [8, -86]], v.hornC || C.cream);
    }
    blob(g, [[-34, -30], [-40, -62], [-24, -92], [0, -98], [26, -90], [40, -62], [34, -28], [0, -16]], b);
    // belly
    ell(g, 0, -46, 20, 22, v.belly || shade(b, 0.4), 0, WA.ink * 0.7);
    // spots
    for (const [x, y] of [[-26, -70], [28, -60], [-30, -48], [-12, -88]]) dot(g, x, y, 3.2, shade(b, -0.25));
    const eyes = v.eyes || 2;
    if (eyes === 1) {
      circ(g, 0, -78, 11, C.white);
      dot(g, 2, -77, 5);
    } else if (eyes === 3) {
      for (const x of [-14, 0, 14]) {
        circ(g, x, x === 0 ? -86 : -78, 7, C.white);
        dot(g, x + 1.5, x === 0 ? -85 : -77, 3.2);
      }
    } else {
      circ(g, -11, -78, 8, C.white);
      circ(g, 11, -78, 8, C.white);
      dot(g, -9, -77, 3.6);
      dot(g, 13, -77, 3.6);
    }
    // mouth with teeth
    if (v.grumpy) {
      line(g, -16, -60, -6, -64, WA.ink * 2);
      line(g, 16, -60, 6, -64, WA.ink * 2);
    }
    g.beginPath();
    g.moveTo(-15, -56);
    g.quadraticCurveTo(0, v.grumpy ? -50 : -40, 15, -56);
    g.quadraticCurveTo(0, -62, -15, -56);
    g.fillStyle = '#7a1f2a';
    g.fill();
    g.lineWidth = WA.ink * 0.9;
    g.strokeStyle = INK;
    g.stroke();
    for (const x of [-9, -3, 3, 9]) poly(g, [[x - 1.8, -57], [x + 1.8, -57], [x, -52]], C.white, WA.ink * 0.5);
    // arms
    limb(g, [[-32, -62], [-48, -48], [-52, -66]], 8, b);
    limb(g, [[32, -62], [48, -48], [50, -70]], 8, b);
  };

  CR.dragon = (g, v = {}) => {
    const b = v.body || C.green, bel = v.belly || '#f1e08a';
    shadow(g, 44, 5);
    // tail
    limb(g, [[-30, -34], [-56, -20], [-74, -34], [-84, -26]], 12, b);
    poly(g, [[-84, -26], [-94, -34], [-90, -18]], v.spike || C.red);
    // wing
    g.beginPath();
    g.moveTo(-8, -66);
    g.quadraticCurveTo(-30, -110, -52, -96);
    g.quadraticCurveTo(-44, -84, -40, -78);
    g.quadraticCurveTo(-36, -70, -22, -60);
    g.closePath();
    WA.fillInk(g, v.wing || C.red);
    // legs
    rrect(g, -14, -26, 14, 26, 6, shade(b, -0.1));
    rrect(g, 12, -26, 14, 26, 6, b);
    ell(g, 0, -46, 36, 24, b);
    ell(g, 6, -40, 22, 16, bel, 0, WA.ink * 0.7);
    // neck+head
    limb(g, [[22, -58], [34, -84], [44, -96]], 13, b);
    ell(g, 54, -98, 17, 12, b);
    dot(g, 58, -102, 3.2, C.white);
    dot(g, 59, -102, 1.6);
    dot(g, 66, -96, 1.6);
    poly(g, [[44, -108], [48, -122], [54, -108]], v.spike || C.red);
    poly(g, [[56, -108], [62, -120], [64, -106]], v.spike || C.red);
    if (v.fire) {
      g.beginPath();
      g.moveTo(68, -96);
      g.quadraticCurveTo(84, -108, 100, -98);
      g.quadraticCurveTo(88, -94, 100, -86);
      g.quadraticCurveTo(84, -88, 68, -90);
      WA.fillInk(g, '#ff8c1a');
    }
    for (let i = 0; i < 4; i++) poly(g, [[-10 + i * 12, -68 + (i % 2)], [-4 + i * 12, -78], [2 + i * 12, -66]], v.spike || C.red, WA.ink * 0.8);
  };

  CR.penguin = (g, v = {}) => {
    shadow(g, 18, 3);
    ell(g, 0, -34, 22, 32, '#26262c');
    ell(g, 3, -30, 14, 24, C.white, 0, WA.ink * 0.7);
    circ(g, 0, -70, 14, '#26262c');
    poly(g, [[8, -72], [20, -68], [8, -64]], C.orange, WA.ink * 0.8);
    dot(g, 5, -74, 2.2, C.white);
    dot(g, 6, -74, 1.1);
    poly(g, [[-20, -48], [-34, -30], [-18, -28]], '#26262c');
    ell(g, -6, -2, 8, 3.2, C.orange);
    ell(g, 10, -2, 8, 3.2, C.orange);
    if (v.scarf) {
      rrect(g, -14, -60, 28, 7, 3, v.scarf);
    }
  };

  CR.monkey = (g, v = {}) => {
    const b = v.body || '#8a5a2b', f = '#e8c79a';
    shadow(g, 22, 3);
    limb(g, [[-16, -30], [-34, -20], [-38, -46], [-30, -56]], 5, b);
    rrect(g, -14, -22, 10, 22, 5, b);
    rrect(g, 4, -22, 10, 22, 5, b);
    ell(g, 0, -44, 20, 26, b);
    ell(g, 3, -42, 11, 16, f, 0, WA.ink * 0.6);
    limb(g, [[-16, -56], [-28, -42], [-22, -30]], 6, b);
    limb(g, [[16, -56], [28, -66], [34, -80]], 6, b);
    circ(g, -2, -78, 15, b);
    circ(g, -17, -78, 6, b);
    circ(g, 13, -78, 6, b);
    ell(g, 0, -75, 10, 9, f, 0, WA.ink * 0.7);
    dot(g, -4, -78, 1.6);
    dot(g, 4, -78, 1.6);
    arc(g, 0, -72, 4, 0.3, Math.PI - 0.3, WA.ink * 0.8);
  };

  CR.snake = (g, v = {}) => {
    const b = v.body || C.green;
    const pts = [];
    for (let i = 0; i <= 14; i++) pts.push([-44 + i * 6.4, -12 + Math.sin(i * 0.9) * 10 - (i > 11 ? (i - 11) * 6 : 0)]);
    limb(g, pts, 10, b);
    g.save();
    g.lineCap = 'butt';
    g.setLineDash([4, 8]);
    g.strokeStyle = v.stripe || C.yellow;
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts) g.lineTo(q[0], q[1]);
    g.stroke();
    g.restore();
    const hd = pts[pts.length - 1];
    ell(g, hd[0] + 4, hd[1] - 4, 9, 6.5, b, -0.5);
    dot(g, hd[0] + 6, hd[1] - 7, 1.5, INK);
    line(g, hd[0] + 11, hd[1] - 5, hd[0] + 19, hd[1] - 7, WA.ink * 0.7, C.red);
  };

  CR.robot = (g, v = {}) => {
    const b = v.body || '#b8c2cc', ac = v.accent || C.red;
    shadow(g, 20, 3);
    rrect(g, -14, -26, 10, 26, 3, '#7a8590');
    rrect(g, 4, -26, 10, 26, 3, '#7a8590');
    limb(g, [[-22, -64], [-34, -48], [-34, -34]], 7, '#7a8590');
    limb(g, [[22, -64], [34, -48], [34, -34]], 7, '#7a8590');
    rrect(g, -22, -70, 44, 48, 6, b);
    rrect(g, -12, -62, 24, 18, 3, '#2b3a4a', 0.5);
    dot(g, -5, -53, 3, '#6fe0ff');
    dot(g, 5, -53, 3, ac);
    for (let i = 0; i < 3; i++) line(g, -10 + i * 10, -38, -10 + i * 10, -30, WA.ink * 0.8);
    rrect(g, -15, -94, 30, 22, 6, b);
    dot(g, -6, -84, 3.6, '#6fe0ff');
    dot(g, 6, -84, 3.6, '#6fe0ff');
    line(g, -5, -76, 5, -76, WA.ink * 0.9);
    line(g, 0, -94, 0, -104, WA.ink * 1.4);
    circ(g, 0, -106, 3, ac, WA.ink * 0.8);
  };

  CR.alien = (g, v = {}) => {
    const b = v.body || '#7ed957';
    shadow(g, 20, 3);
    rrect(g, -9, -26, 7, 26, 3, shade(b, -0.1));
    rrect(g, 3, -26, 7, 26, 3, shade(b, -0.1));
    rrect(g, -16, -66, 32, 44, 12, v.suit || C.purple);
    limb(g, [[-14, -58], [-26, -44]], 5, b);
    limb(g, [[14, -58], [26, -44]], 5, b);
    ell(g, 0, -82, 22, 20, b);
    ell(g, -9, -84, 7, 10, '#1a1a22', -0.5, WA.ink * 0.6);
    ell(g, 9, -84, 7, 10, '#1a1a22', 0.5, WA.ink * 0.6);
    arc(g, 0, -72, 4, 0.3, Math.PI - 0.3, WA.ink * 0.8);
    line(g, -8, -100, -14, -116, WA.ink * 1.3);
    line(g, 8, -100, 14, -116, WA.ink * 1.3);
    circ(g, -14, -117, 3, v.tip || C.yellow, WA.ink * 0.8);
    circ(g, 14, -117, 3, v.tip || C.yellow, WA.ink * 0.8);
  };

  CR.bear = (g, v = {}) => {
    const b = v.body || '#a8672f', f = v.belly || '#e6c08a';
    shadow(g, 30, 4);
    ell(g, -16, -8, 12, 9, b);
    ell(g, 16, -8, 12, 9, b);
    ell(g, 0, -30, 25, 27, b);
    ell(g, 0, -28, 15, 18, f, 0, WA.ink * 0.6);
    limb(g, [[-20, -42], [-34, -32]], 10, b);
    limb(g, [[20, -42], [34, -32]], 10, b);
    circ(g, -17, -76, 9, b);
    circ(g, 17, -76, 9, b);
    circ(g, -17, -76, 4.5, f, WA.ink * 0.6);
    circ(g, 17, -76, 4.5, f, WA.ink * 0.6);
    circ(g, 0, -62, 22, b);
    ell(g, 0, -55, 10, 8, f, 0, WA.ink * 0.7);
    ell(g, 0, -58, 3.6, 2.6, INK);
    dot(g, -8, -66, 2.2);
    dot(g, 8, -66, 2.2);
    arc(g, 0, -54, 3.5, 0.4, Math.PI - 0.4, WA.ink * 0.7);
    if (v.bow !== null) {
      const bc = v.bow || C.red;
      poly(g, [[0, -42], [-11, -48], [-11, -36]], bc, WA.ink * 0.9);
      poly(g, [[0, -42], [11, -48], [11, -36]], bc, WA.ink * 0.9);
      circ(g, 0, -42, 3, shade(bc, -0.2), WA.ink * 0.7);
    }
    if (v.patch) circ(g, 14, -28, 5, v.patch, WA.ink * 0.2);
  };

  CR.duck = (g, v = {}) => {
    const b = v.body || C.yellow;
    ell(g, -4, -22, 28, 17, b);
    poly(g, [[-30, -28], [-40, -40], [-24, -34]], b);
    ell(g, -8, -22, 13, 8, shade(b, -0.1), -0.3, WA.ink * 0.6);
    circ(g, 14, -44, 14, b);
    ell(g, 28, -40, 9, 5, v.beak || C.orange, 0, WA.ink * 0.8);
    dot(g, 18, -48, 2.2);
    if (v.bowc) {
      poly(g, [[10, -30], [0, -36], [0, -24]], v.bowc, WA.ink * 0.8);
      poly(g, [[10, -30], [20, -36], [20, -24]], v.bowc, WA.ink * 0.8);
    }
    if (v.hat) {
      g.beginPath();
      g.moveTo(2, -56);
      g.quadraticCurveTo(14, -76, 26, -56);
      WA.fillInk(g, v.hat);
    }
  };

  CR.swan = (g, v = {}) => {
    ell(g, -4, -22, 30, 17, C.white);
    limb(g, [[14, -30], [24, -50], [20, -70], [30, -76]], 9, C.white);
    ell(g, 34, -76, 9, 7, C.white);
    poly(g, [[40, -76], [50, -73], [40, -71]], C.orange, WA.ink * 0.7);
    dot(g, 34, -78, 1.5);
    g.beginPath();
    g.moveTo(-26, -26);
    g.quadraticCurveTo(-4, -50, 14, -30);
    WA.fillInk(g, '#e6edf2');
  };

  CR.horse = (g, v = {}) => {
    const b = v.body || '#a8672f', m = v.mane || '#2a1b12';
    shadow(g, 46, 5);
    for (const [x, c] of [[-34, shade(b, -0.12)], [30, shade(b, -0.12)], [-22, b], [20, b]]) rrect(g, x - 4, -44, 9, 44, 4, c);
    limb(g, [[-40, -64], [-56, -50], [-54, -28]], 7, m);
    ell(g, -4, -64, 40, 22, b);
    limb(g, [[24, -72], [38, -96], [46, -108]], 16, b);
    ell(g, 54, -108, 19, 11, b, 0.4);
    poly(g, [[38, -112], [40, -126], [48, -114]], b);
    dot(g, 52, -112, 2);
    limb(g, [[28, -98], [34, -92], [40, -100]], 5, m);
    limb(g, [[32, -104], [26, -84], [24, -70]], 5, m);
    if (v.saddle) rrect(g, -14, -88, 26, 10, 4, v.saddle);
  };

  CR.sheep = (g, v = {}) => {
    shadow(g, 28, 4);
    for (const x of [-16, -6, 10, 20]) rrect(g, x - 2.5, -26, 5, 26, 2, '#2e2a28');
    for (const [x, y, r] of [[-16, -42, 13], [0, -48, 15], [16, -42, 13], [-6, -34, 13], [8, -34, 13]]) circ(g, x, y, r, '#f6f1e4');
    ell(g, 28, -48, 10, 9, '#2e2a28');
    dot(g, 32, -50, 1.5, C.white);
  };

  CR.snowman = (g, v = {}) => {
    shadow(g, 24, 4);
    circ(g, 0, -20, 22, C.white);
    circ(g, 0, -52, 16, C.white);
    circ(g, 0, -76, 11, C.white);
    poly(g, [[2, -77], [14, -75], [2, -73]], C.orange, WA.ink * 0.7);
    dot(g, -3, -80, 1.4);
    dot(g, 4, -80, 1.4);
    for (let i = 0; i < 3; i++) dot(g, 0, -56 + i * 8, 1.6);
    rrect(g, -10, -90, 20, 12, 2, v.hat || '#2a2a30');
    rrect(g, -13, -80, 26, 4, 2, v.hat || '#2a2a30');
    rrect(g, -12, -66, 24, 5, 2, v.scarf || C.red);
    limb(g, [[-14, -52], [-30, -64]], 3, '#6a4b2a');
    limb(g, [[14, -52], [30, -64]], 3, '#6a4b2a');
  };

  CR.ufo = (g, v = {}) => {
    ell(g, 0, -44, 18, 16, 'rgba(160,230,255,0.8)');
    dot(g, 0, -50, 4, '#7ed957');
    ell(g, 0, -30, 46, 14, v.body || '#b8c2cc');
    for (const x of [-30, -15, 0, 15, 30]) dot(g, x, -30, 3, [C.yellow, C.red, C.green, C.blue, C.pink][(x / 15 + 2) | 0]);
  };

  CR.chick = (g, v = {}) => {
    shadow(g, 14, 2.5);
    circ(g, 0, -18, 16, v.body || C.yellow);
    circ(g, 10, -34, 9, v.body || C.yellow);
    poly(g, [[17, -35], [25, -33], [17, -31]], C.orange, WA.ink * 0.7);
    dot(g, 12, -37, 1.4);
    limb(g, [[-4, -3], [-4, 4]], 2.5, C.orange);
    limb(g, [[5, -3], [5, 4]], 2.5, C.orange);
  };

  CR.bunny = (g, v = {}) => {
    const b = v.body || C.white;
    shadow(g, 18, 3);
    ell(g, -4, -18, 20, 16, b);
    circ(g, 14, -34, 11, b);
    ell(g, 10, -56, 4, 14, b, 0.1);
    ell(g, 18, -56, 4, 14, b, -0.1);
    ell(g, 10, -56, 1.8, 9, '#f5a6b8', 0.1, 0.01);
    dot(g, 17, -36, 1.5);
    dot(g, 24, -32, 1.6, '#e8478a');
    circ(g, -24, -20, 5, C.white);
  };

  CR.scarecrow = (g) => {
    line(g, 0, 0, 0, -70, WA.ink * 5, INK);
    line(g, 0, 0, 0, -70, WA.ink * 2.4, '#8a5a2b');
    limb(g, [[-30, -58], [30, -58]], 6, '#8a5a2b');
    poly(g, [[-14, -62], [14, -62], [10, -30], [-10, -30]], C.blue);
    circ(g, 0, -74, 10, '#f2d28a');
    rrect(g, -11, -92, 22, 8, 2, '#8a5a2b');
    rrect(g, -16, -85, 32, 4, 2, '#8a5a2b');
  };

  CR.balloonCreature = (g, v = {}) => {
    const b = v.body || C.pink;
    ell(g, 0, -64, 28, 34, b);
    dot(g, -9, -70, 3.5);
    dot(g, 9, -70, 3.5);
    arc(g, 0, -60, 8, 0.2, Math.PI - 0.2, WA.ink);
    poly(g, [[0, -30], [-5, -22], [5, -22]], b);
    line(g, 0, -22, 0, 0, WA.ink * 0.6);
  };
})();
