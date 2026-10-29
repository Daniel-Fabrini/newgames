// Inked cartoon people. A person is a plain description object `p` drawn by
// WA.drawPerson(g, p, x, y, H, flip): feet at (x, y), figure ~H px tall.
(function () {
  const WA = window.WA;
  const { INK, C, circ, ell, rrect, poly, blob, limb, line, arc, dot, shade, mix } = WA;

  // poses: arms [shoulderAngle, elbowBend] measured from straight down towards +x;
  // legs [hipAngle, kneeBend]. R = near side, L = far side.
  const POSES = {
    stand: { R: [0.1, 0.12], L: [-0.1, -0.1], r: [0.05, 0], l: [-0.05, 0] },
    stand2: { R: [0.18, 0.05], L: [-0.2, -0.05], r: [0.12, 0], l: [-0.1, 0] },
    hip: { R: [0.7, -1.9], L: [-0.15, -0.1], r: [0.08, 0], l: [-0.08, 0] },
    walk: { R: [-0.5, -0.3], L: [0.5, 0.35], r: [0.42, -0.25], l: [-0.42, 0.6], lean: 0.05 },
    walk2: { R: [0.5, 0.3], L: [-0.5, -0.3], r: [-0.4, 0.55], l: [0.42, -0.25], lean: 0.05 },
    run: { R: [-1.0, -1.0], L: [1.0, 1.0], r: [0.9, -0.95], l: [-0.7, 1.1], lean: 0.2 },
    wave: { R: [2.7, 0.35], L: [-0.15, -0.1], r: [0.06, 0], l: [-0.06, 0] },
    wave2: { R: [2.5, -0.5], L: [-0.15, -0.1], r: [0.1, 0], l: [-0.1, 0] },
    cheer: { R: [2.75, 0.2], L: [-2.75, -0.2], r: [0.15, 0], l: [-0.15, 0] },
    point: { R: [1.5, 0.05], L: [-0.15, -0.1], r: [0.06, 0], l: [-0.06, 0] },
    hold: { R: [1.0, 0.9], L: [0.9, 1.0], r: [0.06, 0], l: [-0.06, 0] },
    hold2: { R: [0.5, 1.9], L: [-0.2, -0.1], r: [0.06, 0], l: [-0.06, 0] },
    dance: { R: [2.5, 0.4], L: [-0.5, -1.2], r: [0.25, 0.2], l: [-0.35, 0.8], lean: -0.08 },
    kick: { R: [-0.8, -0.5], L: [0.8, 0.5], r: [1.1, -0.2], l: [-0.1, 0.1], lean: -0.1 },
    sit: { R: [0.5, 1.1], L: [0.3, 1.2], r: [1.5, -1.45], l: [1.4, -1.4] },
    sitground: { R: [0.9, 0.7], L: [0.2, 0.2], r: [1.38, 0.2], l: [1.3, 0.28] },
    sitread: { R: [1.0, 1.2], L: [1.0, 1.1], r: [1.5, -1.45], l: [1.4, -1.4] },
    crouch: { R: [0.9, 0.9], L: [0.7, 1.0], r: [1.15, -1.5], l: [1.0, -1.4], lean: 0.25 },
    arms: { R: [2.2, 0.2], L: [-2.2, -0.2], r: [0.3, 0], l: [-0.3, 0] },
    tug: { R: [1.2, 0.2], L: [1.1, 0.2], r: [0.6, -0.1], l: [-0.5, 0.2], lean: -0.3 },
    carry: { R: [1.1, 1.5], L: [1.0, 1.5], r: [0.4, -0.3], l: [-0.4, 0.5], lean: -0.04 },
  };
  WA.POSES = POSES;
  WA.POSE_COMMON = ['stand', 'stand', 'stand', 'stand2', 'walk', 'walk', 'walk2', 'walk2', 'wave', 'cheer', 'point', 'hold', 'hip', 'dance', 'run', 'hold2'];

  function skinShade(p) {
    return shade(p.skin, -0.14);
  }

  // ---------- hair ----------
  function hairBack(g, p, hx, hy, R) {
    const c = p.hairC;
    const s = p.hairS;
    if (s === 'long' || s === 'longwave') {
      WA.rrect(g, hx - R * 1.12, hy - R * 0.9, R * 2.24, R * 3.0, R * 0.9, c);
    } else if (s === 'bob') {
      WA.rrect(g, hx - R * 1.15, hy - R * 0.9, R * 2.3, R * 2.0, R * 0.8, c);
    } else if (s === 'afro') {
      circ(g, hx - R * 0.1, hy - R * 0.25, R * 1.5, c);
    } else if (s === 'ponytail') {
      limb(g, [[hx - R * 0.9, hy - R * 0.1], [hx - R * 1.9, hy + R * 0.3], [hx - R * 1.7, hy + R * 1.6]], R * 0.7, c);
    } else if (s === 'pigtails') {
      circ(g, hx - R * 1.15, hy + R * 0.6, R * 0.55, c);
      circ(g, hx + R * 1.15, hy + R * 0.6, R * 0.55, c);
    } else if (s === 'braid') {
      limb(g, [[hx - R * 0.9, hy], [hx - R * 1.3, hy + R * 1.1], [hx - R * 1.0, hy + R * 2.2]], R * 0.55, c);
      circ(g, hx - R * 1.0, hy + R * 2.3, R * 0.35, p.hairC2 || C.red);
    } else if (s === 'curly' || s === 'curls') {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.75 + i * 0.19);
        circ(g, hx + Math.cos(a) * R * 1.0, hy + Math.sin(a) * R * 0.95, R * 0.42, c);
      }
    } else if (s === 'bun') {
      circ(g, hx - R * 0.4, hy - R * 1.25, R * 0.5, c);
    } else if (s === 'mohawk') {
      poly(g, [[hx - R * 0.9, hy - R * 0.5], [hx - R * 0.6, hy - R * 1.9], [hx - R * 0.15, hy - R * 1.1], [hx + R * 0.2, hy - R * 2.0], [hx + R * 0.5, hy - R * 1.0], [hx + R * 0.9, hy - R * 1.7], [hx + R * 1.0, hy - R * 0.5]], c);
    } else if (s === 'spiky') {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1 + i / 8);
        pts.push([hx + Math.cos(a) * R * 1.05, hy + Math.sin(a) * R * 0.9]);
        const a2 = Math.PI * (1 + (i + 0.5) / 8);
        if (i < 8) pts.push([hx + Math.cos(a2) * R * 1.6, hy + Math.sin(a2) * R * 1.55]);
      }
      poly(g, pts, c);
    }
  }
  function hairFront(g, p, hx, hy, R, f) {
    const s = p.hairS;
    if (s === 'bald') {
      // ring of hair at back
      g.save();
      g.beginPath();
      g.ellipse(hx, hy, R * 0.97, R, 0, 0, Math.PI * 2);
      g.clip();
      g.beginPath();
      g.moveTo(hx - R * 1.2, hy - R * 0.1);
      g.lineTo(hx - R * 0.6, hy - R * 0.1);
      g.lineTo(hx - R * 0.5, hy + R * 0.5);
      g.lineTo(hx - R * 1.2, hy + R * 0.6);
      g.closePath();
      g.fillStyle = p.hairC;
      g.fill();
      g.restore();
      return;
    }
    if (s === 'mohawk' || s === 'spiky') return;
    g.save();
    g.beginPath();
    g.ellipse(hx, hy, R * 0.97, R, 0, 0, Math.PI * 2);
    g.clip();
    g.beginPath();
    g.moveTo(hx - R * 1.2, hy + R * 0.45);
    g.lineTo(hx - R * 1.2, hy - R * 1.3);
    g.lineTo(hx + R * 1.3, hy - R * 1.3);
    g.lineTo(hx + R * 1.3, hy - R * 0.15);
    g.quadraticCurveTo(hx + R * (0.35 * f + 0.4), hy - R * 0.62, hx - R * (0.1 + 0.2 * (1 - f)), hy - R * 0.2);
    if (s === 'sidepart') g.lineTo(hx - R * 0.3, hy - R * 0.05);
    g.lineTo(hx - R * 0.55, hy + R * 0.45);
    g.closePath();
    g.fillStyle = p.hairC;
    g.fill();
    g.lineWidth = WA.ink * 0.85;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
    if (s === 'curls' || s === 'curly') {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.05 + i * 0.18);
        circ(g, hx + Math.cos(a) * R * 1.0, hy + Math.sin(a) * R * 0.92, R * 0.36, p.hairC);
      }
    }
    if (s === 'fringe') {
      for (let i = 0; i < 4; i++) circ(g, hx + R * (-0.5 + i * 0.5), hy - R * 0.55, R * 0.3, p.hairC);
    }
  }

  // ---------- hats ----------
  function hatDraw(g, p, hx, hy, R, f, fl) {
    const h = p.hat;
    if (!h || h.t === 'none') return;
    const c = h.c || C.red, c2 = h.c2 || shade(c, -0.3);
    const top = hy - R;
    switch (h.t) {
      case 'bobble':
      case 'beanie': {
        // knitted cap: dome + folded band (+ pom)
        g.beginPath();
        g.moveTo(hx - R * 1.04, hy - R * 0.28);
        g.bezierCurveTo(hx - R * 1.15, top - R * 0.85, hx + R * 1.15, top - R * 0.85, hx + R * 1.04, hy - R * 0.28);
        g.closePath();
        WA.fillInk(g, c);
        if (h.knit) {
          g.save();
          g.clip();
          g.strokeStyle = shade(c, -0.25);
          g.lineWidth = WA.ink * 0.5;
          for (let i = -4; i <= 4; i++) {
            g.beginPath();
            g.moveTo(hx + i * R * 0.25, hy - R * 2);
            g.lineTo(hx + i * R * 0.33, hy - R * 0.3);
            g.stroke();
          }
          g.restore();
        }
        if (h.stripes) {
          g.beginPath();
          g.moveTo(hx - R * 1.04, hy - R * 0.28);
          g.bezierCurveTo(hx - R * 1.15, top - R * 0.85, hx + R * 1.15, top - R * 0.85, hx + R * 1.04, hy - R * 0.28);
          g.closePath();
          WA.stripes(g, hx - R * 1.2, top - R * 0.7, R * 2.4, R * 1.5, c, h.stripes, 6, 'h');
          g.beginPath();
          g.moveTo(hx - R * 1.04, hy - R * 0.28);
          g.bezierCurveTo(hx - R * 1.15, top - R * 0.85, hx + R * 1.15, top - R * 0.85, hx + R * 1.04, hy - R * 0.28);
          g.closePath();
          g.lineWidth = WA.ink;
          g.strokeStyle = INK;
          g.stroke();
        }
        rrect(g, hx - R * 1.12, hy - R * 0.62, R * 2.24, R * 0.5, R * 0.22, h.band || c2);
        if (h.t === 'bobble') circ(g, hx + (h.off || 0) * R, top - R * 0.85, R * 0.4, h.pom || c);
        break;
      }
      case 'cap': {
        g.beginPath();
        g.moveTo(hx - R * 1.04, hy - R * 0.2);
        g.bezierCurveTo(hx - R * 1.1, top - R * 0.55, hx + R * 1.1, top - R * 0.55, hx + R * 1.04, hy - R * 0.2);
        g.closePath();
        WA.fillInk(g, c);
        const vx = fl ? 1 : 1;
        poly(g, [[hx + R * 0.7 * vx, hy - R * 0.5], [hx + R * 1.9 * vx, hy - R * 0.2], [hx + R * 1.8 * vx, hy - R * 0.02], [hx + R * 0.6 * vx, hy - R * 0.2]], c2);
        circ(g, hx, top - R * 0.2, R * 0.12, c2, WA.ink * 0.6);
        break;
      }
      case 'sun': {
        ell(g, hx, hy - R * 0.55, R * 2.0, R * 0.45, c);
        g.beginPath();
        g.moveTo(hx - R * 1.0, hy - R * 0.5);
        g.bezierCurveTo(hx - R * 1.1, top - R * 0.9, hx + R * 1.1, top - R * 0.9, hx + R * 1.0, hy - R * 0.5);
        g.closePath();
        WA.fillInk(g, c);
        rrect(g, hx - R * 1.0, hy - R * 0.85, R * 2.0, R * 0.3, R * 0.1, c2);
        break;
      }
      case 'straw': {
        ell(g, hx, hy - R * 0.6, R * 1.9, R * 0.4, '#e8cf7a');
        g.beginPath();
        g.moveTo(hx - R * 0.95, hy - R * 0.6);
        g.bezierCurveTo(hx - R * 1.0, top - R * 0.8, hx + R * 1.0, top - R * 0.8, hx + R * 0.95, hy - R * 0.6);
        g.closePath();
        WA.fillInk(g, '#e8cf7a');
        rrect(g, hx - R * 0.98, hy - R * 0.95, R * 1.96, R * 0.3, R * 0.1, c);
        break;
      }
      case 'top': {
        ell(g, hx, hy - R * 0.7, R * 1.45, R * 0.28, c);
        rrect(g, hx - R * 0.85, top - R * 1.5, R * 1.7, R * 1.45, R * 0.15, c);
        rrect(g, hx - R * 0.87, hy - R * 1.15, R * 1.74, R * 0.28, R * 0.05, c2);
        break;
      }
      case 'cowboy': {
        g.beginPath();
        g.moveTo(hx - R * 2.0, hy - R * 0.85);
        g.quadraticCurveTo(hx - R * 1.1, hy - R * 0.35, hx, hy - R * 0.5);
        g.quadraticCurveTo(hx + R * 1.1, hy - R * 0.35, hx + R * 2.0, hy - R * 0.85);
        g.quadraticCurveTo(hx + R * 1.3, hy - R * 0.9, hx + R * 1.0, hy - R * 0.75);
        g.lineTo(hx + R * 1.0, top - R * 0.4);
        g.quadraticCurveTo(hx, top - R * 0.2, hx - R * 1.0, top - R * 0.4);
        g.lineTo(hx - R * 1.0, hy - R * 0.75);
        g.quadraticCurveTo(hx - R * 1.3, hy - R * 0.9, hx - R * 2.0, hy - R * 0.85);
        WA.fillInk(g, c);
        break;
      }
      case 'pirate': {
        g.beginPath();
        g.moveTo(hx - R * 2.0, hy - R * 0.4);
        g.quadraticCurveTo(hx - R * 1.4, top - R * 1.1, hx, top - R * 0.7);
        g.quadraticCurveTo(hx + R * 1.4, top - R * 1.1, hx + R * 2.0, hy - R * 0.4);
        g.quadraticCurveTo(hx, hy - R * 0.9, hx - R * 2.0, hy - R * 0.4);
        WA.fillInk(g, c);
        circ(g, hx, top - R * 0.05, R * 0.3, '#fff', WA.ink * 0.5);
        break;
      }
      case 'bandana': {
        g.beginPath();
        g.moveTo(hx - R * 1.03, hy - R * 0.2);
        g.bezierCurveTo(hx - R * 1.1, top - R * 0.6, hx + R * 1.1, top - R * 0.6, hx + R * 1.03, hy - R * 0.2);
        g.quadraticCurveTo(hx, hy - R * 0.62, hx - R * 1.03, hy - R * 0.2);
        WA.fillInk(g, c);
        if (h.dots) for (let i = 0; i < 5; i++) dot(g, hx - R * 0.7 + i * R * 0.35, top - R * 0.1 + (i % 2) * R * 0.2, R * 0.1, h.dots);
        poly(g, [[hx - R * 0.95, hy - R * 0.35], [hx - R * 1.7, hy - R * 0.1], [hx - R * 1.4, hy - R * 0.5]], c);
        poly(g, [[hx - R * 0.95, hy - R * 0.3], [hx - R * 1.6, hy + R * 0.2], [hx - R * 1.2, hy - R * 0.05]], c);
        break;
      }
      case 'chef': {
        circ(g, hx - R * 0.6, top - R * 0.5, R * 0.55, c);
        circ(g, hx + R * 0.6, top - R * 0.5, R * 0.55, c);
        circ(g, hx, top - R * 0.85, R * 0.65, c);
        rrect(g, hx - R * 0.95, hy - R * 1.2, R * 1.9, R * 0.9, R * 0.15, c);
        break;
      }
      case 'crown': {
        poly(g, [[hx - R * 0.9, hy - R * 0.4], [hx - R * 1.0, top - R * 0.9], [hx - R * 0.5, top - R * 0.3], [hx, top - R * 1.0], [hx + R * 0.5, top - R * 0.3], [hx + R * 1.0, top - R * 0.9], [hx + R * 0.9, hy - R * 0.4]], '#f5c518');
        dot(g, hx, hy - R * 0.8, R * 0.14, C.red);
        break;
      }
      case 'party': {
        poly(g, [[hx - R * 0.7, hy - R * 0.55], [hx + R * 0.1, top - R * 2.0], [hx + R * 0.8, hy - R * 0.5]], c);
        dot(g, hx + R * 0.1, top - R * 2.05, R * 0.2, c2);
        WA.line(g, hx - R * 0.5, hy - R * 0.7, hx + R * 0.6, hy - R * 0.7, WA.ink * 0.8, c2);
        break;
      }
      case 'wizard': {
        ell(g, hx, hy - R * 0.55, R * 1.7, R * 0.4, c);
        g.beginPath();
        g.moveTo(hx - R * 1.0, hy - R * 0.5);
        g.quadraticCurveTo(hx - R * 0.5, top - R * 1.0, hx - R * 0.35, top - R * 2.4);
        g.quadraticCurveTo(hx + R * 0.1, top - R * 3.2, hx + R * 0.8, top - R * 2.5);
        g.quadraticCurveTo(hx + R * 0.7, top - R * 1.2, hx + R * 1.0, hy - R * 0.5);
        g.closePath();
        WA.fillInk(g, c);
        const star = (x, y, r) => {
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const rr = i % 2 ? r * 0.45 : r;
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.closePath();
          g.fillStyle = c2;
          g.fill();
        };
        star(hx - R * 0.1, top - R * 0.9, R * 0.35);
        star(hx + R * 0.1, top - R * 1.7, R * 0.28);
        star(hx + R * 0.45, top - R * 0.5, R * 0.2);
        rrect(g, hx - R * 1.0, hy - R * 0.85, R * 2.0, R * 0.3, R * 0.1, c2);
        break;
      }
      case 'helmet': {
        g.beginPath();
        g.moveTo(hx - R * 1.1, hy + R * 0.5);
        g.lineTo(hx - R * 1.1, hy - R * 0.2);
        g.bezierCurveTo(hx - R * 1.2, top - R * 0.7, hx + R * 1.2, top - R * 0.7, hx + R * 1.1, hy - R * 0.2);
        g.lineTo(hx + R * 1.1, hy + R * 0.5);
        g.closePath();
        WA.fillInk(g, c);
        rrect(g, hx + R * 0.05, hy - R * 0.3, R * 1.0, R * 0.28, R * 0.1, INK, 0.1, true);
        line(g, hx, top - R * 0.4, hx, hy - R * 0.4, WA.ink, shade(c, -0.4));
        if (h.plume) {
          g.beginPath();
          g.moveTo(hx, top - R * 0.45);
          g.bezierCurveTo(hx - R * 0.8, top - R * 1.9, hx - R * 1.8, top - R * 1.0, hx - R * 1.5, hy - R * 0.2);
          g.bezierCurveTo(hx - R * 1.4, top - R * 1.0, hx - R * 0.5, top - R * 1.1, hx, top - R * 0.45);
          WA.fillInk(g, h.plume);
        }
        break;
      }
      case 'viking': {
        g.beginPath();
        g.moveTo(hx - R * 1.06, hy - R * 0.1);
        g.bezierCurveTo(hx - R * 1.15, top - R * 0.7, hx + R * 1.15, top - R * 0.7, hx + R * 1.06, hy - R * 0.1);
        g.closePath();
        WA.fillInk(g, c);
        poly(g, [[hx - R * 1.0, hy - R * 0.6], [hx - R * 2.0, top - R * 0.7], [hx - R * 1.5, hy - R * 0.2]], '#f3ead2');
        poly(g, [[hx + R * 1.0, hy - R * 0.6], [hx + R * 2.0, top - R * 0.7], [hx + R * 1.5, hy - R * 0.2]], '#f3ead2');
        break;
      }
      case 'hard': {
        g.beginPath();
        g.moveTo(hx - R * 1.1, hy - R * 0.3);
        g.bezierCurveTo(hx - R * 1.2, top - R * 0.8, hx + R * 1.2, top - R * 0.8, hx + R * 1.1, hy - R * 0.3);
        g.closePath();
        WA.fillInk(g, c);
        rrect(g, hx - R * 1.35, hy - R * 0.5, R * 2.7, R * 0.3, R * 0.14, c);
        line(g, hx, top - R * 0.5, hx, hy - R * 0.5, WA.ink * 0.9, shade(c, -0.3));
        break;
      }
      case 'santa': {
        g.beginPath();
        g.moveTo(hx - R * 1.05, hy - R * 0.3);
        g.bezierCurveTo(hx - R * 1.2, top - R * 1.2, hx + R * 0.2, top - R * 1.5, hx + R * 1.5, hy - R * 1.0);
        g.lineTo(hx + R * 1.05, hy - R * 0.3);
        g.closePath();
        WA.fillInk(g, C.red);
        rrect(g, hx - R * 1.15, hy - R * 0.65, R * 2.3, R * 0.45, R * 0.2, C.white);
        circ(g, hx + R * 1.5, hy - R * 1.0, R * 0.32, C.white);
        break;
      }
      case 'fez': {
        poly(g, [[hx - R * 0.8, hy - R * 0.4], [hx - R * 0.6, top - R * 0.9], [hx + R * 0.6, top - R * 0.9], [hx + R * 0.8, hy - R * 0.4]], c);
        line(g, hx, top - R * 0.9, hx + R * 1.1, hy - R * 0.2, WA.ink, '#f5c518');
        break;
      }
      case 'turban': {
        ell(g, hx, hy - R * 0.55, R * 1.15, R * 0.8, c);
        g.save();
        g.beginPath();
        g.ellipse(hx, hy - R * 0.55, R * 1.15, R * 0.8, 0, 0, Math.PI * 2);
        g.clip();
        for (let i = -3; i <= 3; i++) line(g, hx + i * R * 0.35 - R * 0.6, hy - R * 1.5, hx + i * R * 0.35 + R * 0.6, hy - R * 0.1, WA.ink * 0.5, shade(c, -0.35));
        g.restore();
        circ(g, hx, hy - R * 1.2, R * 0.16, '#f5c518');
        break;
      }
      case 'sailor': {
        g.beginPath();
        g.moveTo(hx - R * 1.1, hy - R * 0.2);
        g.bezierCurveTo(hx - R * 1.1, top - R * 0.5, hx + R * 1.1, top - R * 0.5, hx + R * 1.1, hy - R * 0.2);
        g.closePath();
        WA.fillInk(g, C.white);
        rrect(g, hx - R * 1.15, hy - R * 0.65, R * 2.3, R * 0.5, R * 0.2, c);
        break;
      }
      case 'swimcap': {
        g.beginPath();
        g.moveTo(hx - R * 1.0, hy);
        g.bezierCurveTo(hx - R * 1.1, top - R * 0.45, hx + R * 1.1, top - R * 0.45, hx + R * 1.0, hy);
        g.quadraticCurveTo(hx, hy - R * 0.6, hx - R * 1.0, hy);
        WA.fillInk(g, c);
        break;
      }
      case 'hood': {
        g.beginPath();
        g.ellipse(hx - R * 0.15, hy - R * 0.05, R * 1.25, R * 1.25, 0, 0, Math.PI * 2);
        WA.fillInk(g, c);
        break;
      }
      case 'headband': {
        rrect(g, hx - R * 1.0, hy - R * 0.65, R * 2.0, R * 0.32, R * 0.12, c);
        break;
      }
      case 'flower': {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          circ(g, hx + R * 0.1 + Math.cos(a) * R * 0.28, top - R * 0.1 + Math.sin(a) * R * 0.28, R * 0.2, c, WA.ink * 0.6);
        }
        circ(g, hx + R * 0.1, top - R * 0.1, R * 0.14, '#f9d71c', WA.ink * 0.6);
        break;
      }
      case 'headphones': {
        arc(g, hx, hy - R * 0.1, R * 1.12, Math.PI * 1.02, Math.PI * 1.98, WA.ink * 2.4, INK);
        arc(g, hx, hy - R * 0.1, R * 1.12, Math.PI * 1.02, Math.PI * 1.98, WA.ink * 1.2, c);
        circ(g, hx - R * 1.05, hy + R * 0.1, R * 0.35, c);
        circ(g, hx + R * 1.05, hy + R * 0.1, R * 0.35, c);
        break;
      }
      case 'astro': {
        // glass bubble drawn over the head
        g.beginPath();
        g.arc(hx, hy, R * 1.3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200,238,255,0.16)';
        g.fill();
        g.lineWidth = WA.ink * 1.6;
        g.strokeStyle = INK;
        g.stroke();
        g.lineWidth = WA.ink * 0.9;
        g.strokeStyle = '#fff';
        g.beginPath();
        g.arc(hx, hy, R * 1.22, Math.PI * 1.15, Math.PI * 1.45);
        g.stroke();
        break;
      }
    }
  }

  // ---------- glasses / facial hair ----------
  function glassesDraw(g, p, hx, hy, R, f) {
    const t = p.glasses;
    if (!t) return;
    const ex1 = hx + f * 2.2 - 3.0, ex2 = hx + f * 2.2 + 3.0, ey = hy - R * 0.02;
    const col = p.glassC || '#2a1a0e';
    const lw = WA.ink * 0.85;
    if (t === 'round') {
      g.lineWidth = lw * 1.05;
      g.strokeStyle = col;
      for (const ex of [ex1, ex2]) {
        g.beginPath();
        g.arc(ex, ey, 2.9, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fill();
        g.stroke();
      }
      line(g, ex1 + 2.9, ey, ex2 - 2.9, ey, lw, col);
      line(g, ex1 - 2.9, ey, hx - R * 0.97, ey - 0.8, lw, col);
    } else if (t === 'square') {
      g.lineWidth = lw * 1.1;
      g.strokeStyle = col;
      for (const ex of [ex1, ex2]) {
        g.beginPath();
        g.rect(ex - 2.8, ey - 2.2, 5.6, 4.4);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fill();
        g.stroke();
      }
      line(g, ex1 + 2.8, ey, ex2 - 2.8, ey, lw, col);
    } else if (t === 'sun') {
      for (const ex of [ex1, ex2]) {
        g.beginPath();
        g.rect(ex - 2.9, ey - 2.1, 5.8, 4.2);
        g.fillStyle = p.sunC || '#141418';
        g.fill();
      }
      line(g, ex1 + 2.9, ey - 1, ex2 - 2.9, ey - 1, lw, INK);
      line(g, ex1 - 2.9, ey - 1, hx - R * 0.97, ey - 1, lw, INK);
    } else if (t === 'goggles') {
      line(g, hx - R * 1.0, ey, hx + R * 1.0, ey, WA.ink * 1.6, p.glassC || '#333');
      for (const ex of [ex1, ex2]) {
        circ(g, ex, ey, 3.3, 'rgba(160,220,255,0.8)', lw);
      }
    } else if (t === 'mono') {
      g.lineWidth = lw;
      g.strokeStyle = '#c9971c';
      g.beginPath();
      g.arc(ex2, ey, 3.2, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
      g.stroke();
    } else if (t === 'patch') {
      line(g, hx - R * 0.97, ey - 2.4, hx + R * 0.97, ey - 0.6, WA.ink * 0.9, INK);
      g.beginPath();
      g.ellipse(ex2, ey, 3.1, 2.7, 0, 0, Math.PI * 2);
      g.fillStyle = '#141418';
      g.fill();
    } else if (t === 'heart') {
      for (const ex of [ex1, ex2]) {
        g.beginPath();
        g.moveTo(ex, ey + 2.4);
        g.bezierCurveTo(ex - 4.5, ey - 1, ex - 1.5, ey - 4, ex, ey - 1.4);
        g.bezierCurveTo(ex + 1.5, ey - 4, ex + 4.5, ey - 1, ex, ey + 2.4);
        g.fillStyle = '#e8478a';
        g.fill();
        g.lineWidth = lw;
        g.strokeStyle = INK;
        g.stroke();
      }
    }
  }
  function beardDraw(g, p, hx, hy, R, f) {
    const b = p.beard;
    if (!b) return;
    const c = b.c;
    if (b.t === 'full') {
      g.beginPath();
      g.moveTo(hx - R * 0.98, hy - R * 0.05);
      g.quadraticCurveTo(hx - R * 1.1, hy + R * 1.35, hx + R * 0.1, hy + R * 1.4);
      g.quadraticCurveTo(hx + R * 1.1, hy + R * 1.3, hx + R * 0.98, hy - R * 0.1);
      g.quadraticCurveTo(hx + R * 0.5, hy + R * 0.45, hx, hy + R * 0.35);
      g.quadraticCurveTo(hx - R * 0.5, hy + R * 0.45, hx - R * 0.98, hy - R * 0.05);
      WA.fillInk(g, c);
    } else if (b.t === 'goatee') {
      g.beginPath();
      g.moveTo(hx + f * 3 - R * 0.35, hy + R * 0.55);
      g.quadraticCurveTo(hx + f * 3, hy + R * 1.45, hx + f * 3 + R * 0.35, hy + R * 0.55);
      WA.fillInk(g, c);
    } else if (b.t === 'long') {
      g.beginPath();
      g.moveTo(hx - R * 0.99, hy - R * 0.1);
      g.quadraticCurveTo(hx - R * 1.3, hy + R * 1.8, hx - R * 0.2, hy + R * 3.2);
      g.quadraticCurveTo(hx + R * 0.7, hy + R * 3.6, hx + R * 1.2, hy + R * 2.6);
      g.quadraticCurveTo(hx + R * 1.4, hy + R * 1.4, hx + R * 0.99, hy - R * 0.1);
      g.quadraticCurveTo(hx + R * 0.3, hy + R * 0.5, hx - R * 0.99, hy - R * 0.1);
      WA.fillInk(g, c);
    }
  }
  function mustacheDraw(g, p, hx, hy, R, f) {
    if (!p.must) return;
    const nx = hx + f * 4.5;
    g.beginPath();
    g.moveTo(nx - 4.5, hy + R * 0.35);
    g.quadraticCurveTo(nx - 2.5, hy + R * 0.12, nx, hy + R * 0.38);
    g.quadraticCurveTo(nx + 2.5, hy + R * 0.12, nx + 4.5, hy + R * 0.35);
    g.quadraticCurveTo(nx + 2.5, hy + R * 0.7, nx, hy + R * 0.48);
    g.quadraticCurveTo(nx - 2.5, hy + R * 0.7, nx - 4.5, hy + R * 0.35);
    WA.fillInk(g, p.must, WA.ink * 0.7);
  }

  // ---------- clothing ----------
  function torsoPath(g, p, g0) {
    const { sw, ww, sY, hipY } = g0;
    g.beginPath();
    g.moveTo(-sw + 3, sY);
    g.lineTo(sw - 3, sY);
    g.quadraticCurveTo(sw, sY, sw, sY + 3);
    g.lineTo(ww + g0.belly, (sY + hipY) / 2 + 3);
    g.quadraticCurveTo(ww + g0.belly * 0.4, hipY - 2, ww, hipY + 1);
    g.lineTo(-ww, hipY + 1);
    g.quadraticCurveTo(-ww - g0.belly * 0.4, hipY - 2, -ww - g0.belly, (sY + hipY) / 2 + 3);
    g.lineTo(-sw, sY + 3);
    g.quadraticCurveTo(-sw, sY, -sw + 3, sY);
    g.closePath();
  }

  function paintTop(g, p, g0) {
    const t = p.top;
    const { sw, ww, sY, hipY } = g0;
    const bx = -sw - 4, bw = 2 * sw + 8, by = sY, bh = hipY - sY + 2;
    torsoPath(g, p, g0);
    const pat = t.pat;
    if (pat === 'hstripe') {
      WA.stripes(g, bx, by, bw, bh, t.c, t.c2, t.n || 9, 'h');
    } else if (pat === 'vstripe') {
      WA.stripes(g, bx, by, bw, bh, t.c, t.c2, 10, 'v');
    } else if (pat === 'diag') {
      WA.stripes(g, bx, by, bw, bh, t.c, t.c2, 10, 'd');
    } else {
      g.fillStyle = t.c;
      g.fill();
      g.save();
      torsoPath(g, p, g0);
      g.clip();
      if (pat === 'dots') {
        g.fillStyle = t.c2;
        for (let yy = sY + 3; yy < hipY; yy += 6)
          for (let xx = -sw + ((((yy - sY) / 6) | 0) % 2 ? 6 : 3); xx < sw; xx += 6) {
            g.beginPath();
            g.arc(xx, yy, 1.4, 0, 7);
            g.fill();
          }
      } else if (pat === 'plaid') {
        g.strokeStyle = t.c2;
        g.lineWidth = 1.7;
        for (let xx = -sw; xx < sw; xx += 6) {
          g.beginPath();
          g.moveTo(xx, sY);
          g.lineTo(xx, hipY);
          g.stroke();
        }
        for (let yy = sY + 2; yy < hipY; yy += 6) {
          g.beginPath();
          g.moveTo(-sw, yy);
          g.lineTo(sw, yy);
          g.stroke();
        }
      } else if (pat === 'jacket') {
        g.fillStyle = t.c2;
        g.fillRect(-3.2, sY, 6.4, bh);
        g.strokeStyle = INK;
        g.lineWidth = WA.ink * 0.7;
        g.beginPath();
        g.moveTo(-3.2, sY);
        g.lineTo(-3.2, hipY);
        g.moveTo(3.2, sY);
        g.lineTo(3.2, hipY);
        g.stroke();
      } else if (pat === 'suit') {
        g.fillStyle = C.white;
        g.beginPath();
        g.moveTo(-3.5, sY);
        g.lineTo(3.5, sY);
        g.lineTo(0, sY + 13);
        g.closePath();
        g.fill();
        g.fillStyle = t.c2;
        g.fillRect(-1.2, sY + 2, 2.4, 14);
      } else if (pat === 'logo') {
        g.fillStyle = t.c2;
        g.beginPath();
        g.arc(0, (sY + hipY) / 2, 5, 0, 7);
        g.fill();
      } else if (pat === 'armor') {
        g.fillStyle = shade(t.c, 0.25);
        g.fillRect(-sw, sY, 6, bh);
        g.strokeStyle = t.c2;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-sw, sY + 2);
        g.lineTo(sw, hipY - 3);
        g.stroke();
      } else if (pat === 'apron') {
        g.fillStyle = t.c2;
        g.fillRect(-sw * 0.7, sY + 8, sw * 1.4, bh);
      } else if (pat === 'band') {
        g.fillStyle = t.c2;
        g.fillRect(-sw, sY + 10, 2 * sw, 6);
      } else if (pat === 'spacesuit') {
        g.fillStyle = shade(t.c, -0.1);
        g.fillRect(-sw * 0.6, sY + 6, sw * 1.2, 11);
        dot(g, -3, sY + 11, 1.6, C.red);
        dot(g, 3, sY + 11, 1.6, C.blue);
      } else if (pat === 'swim') {
        // bare chest (c = skin); optional bikini band in c2
        if (t.bikini) {
          g.fillStyle = t.bikini;
          g.fillRect(-sw, sY + 5, 2 * sw, 8);
        }
      }
      g.restore();
    }
    g.lineWidth = WA.ink;
    g.strokeStyle = INK;
    torsoPath(g, p, g0);
    g.stroke();
    // collar / neck hole
    if (pat !== 'swim' && p.collar !== false) {
      g.beginPath();
      g.ellipse(0, sY + 0.5, 3.8, 1.8, 0, 0, Math.PI);
      g.fillStyle = p.skin;
      g.fill();
      g.lineWidth = WA.ink * 0.7;
      g.stroke();
    }
  }

  // ---------- props held in hands ----------
  const PROPS = {
    balloons(g, x, y, ang, p) {
      const cols = Array.isArray(p.propC) ? p.propC : [p.propC || C.red, C.yellow, C.blue, C.pink].slice(0, 3);
      const base = [x, y];
      cols.forEach((c, i) => {
        const bx = x + (i - (cols.length - 1) / 2) * 7, by = y - 34 - (i % 2) * 6;
        line(g, x, y, bx, by + 6, WA.ink * 0.5, '#444');
        ell(g, bx, by, 5, 6.3, c);
        poly(g, [[bx, by + 6], [bx - 1.5, by + 8], [bx + 1.5, by + 8]], c, WA.ink * 0.6);
      });
    },
    flag(g, x, y, ang, p) {
      const c = p.propC || C.red;
      line(g, x, y + 6, x, y - 36, WA.ink * 1.8, INK);
      line(g, x, y + 6, x, y - 36, WA.ink * 0.8, '#d9b27a');
      g.beginPath();
      g.moveTo(x, y - 36);
      g.quadraticCurveTo(x + 8, y - 40, x + 14, y - 34);
      g.quadraticCurveTo(x + 8, y - 28, x + 14, y - 22);
      g.quadraticCurveTo(x + 8, y - 28, x, y - 24);
      g.closePath();
      WA.fillInk(g, c);
    },
    icecream(g, x, y, ang) {
      poly(g, [[x - 2.5, y - 6], [x + 2.5, y - 6], [x, y + 3]], '#e3b565', WA.ink * 0.8);
      circ(g, x, y - 8, 3.4, '#f28ab2', WA.ink * 0.8);
      circ(g, x + 0.5, y - 12, 2.5, '#fff3c4', WA.ink * 0.8);
    },
    sword(g, x, y, ang, p) {
      line(g, x, y + 3, x + 2, y - 30, WA.ink * 3.4, INK);
      line(g, x, y + 3, x + 2, y - 30, WA.ink * 1.5, '#dfe5ea');
      line(g, x - 4, y - 2, x + 4, y - 2, WA.ink * 2.4, INK);
      line(g, x - 4, y - 2, x + 4, y - 2, WA.ink * 1, '#c9971c');
    },
    shield(g, x, y, ang, p) {
      g.beginPath();
      g.moveTo(x - 7, y - 9);
      g.lineTo(x + 7, y - 9);
      g.lineTo(x + 7, y + 1);
      g.quadraticCurveTo(x + 6, y + 9, x, y + 12);
      g.quadraticCurveTo(x - 6, y + 9, x - 7, y + 1);
      g.closePath();
      WA.fillInk(g, p.propC || C.blue);
      line(g, x, y - 9, x, y + 12, WA.ink * 1.4, C.white);
      line(g, x - 7, y - 2, x + 7, y - 2, WA.ink * 1.4, C.white);
    },
    bucket(g, x, y) {
      poly(g, [[x - 4, y - 5], [x + 4, y - 5], [x + 3, y + 3], [x - 3, y + 3]], C.red, WA.ink * 0.8);
      arc(g, x, y - 5, 4, Math.PI, 0, WA.ink * 0.7);
    },
    shovel(g, x, y) {
      line(g, x - 1, y + 4, x + 3, y - 26, WA.ink * 2.4, INK);
      line(g, x - 1, y + 4, x + 3, y - 26, WA.ink * 0.9, '#a77a3d');
      poly(g, [[x - 5, y - 24], [x + 3, y - 26], [x + 7, y - 17], [x - 3, y - 15]], C.grey, WA.ink * 0.8);
    },
    camera(g, x, y, ang, p) {
      rrect(g, x - 5.5, y - 4, 11, 8, 1.4, '#2b2b30', WA.ink * 0.8);
      rrect(g, x - 5.5, y - 4, 11, 2.6, 1, '#c9cdd3', WA.ink * 0.5);
      circ(g, x + 0.5, y + 0.4, 3, '#18222e', WA.ink * 0.7);
      circ(g, x + 0.5, y + 0.4, 1.5, '#7fb3e0', WA.ink * 0.3);
      dot(g, x + 3.5, y - 5.2, 1, '#ffd23c');
    },
    scroll(g, x, y, ang, p) {
      WA.rrect(g, x - 3.2, y - 8, 6.4, 16, 3, '#f1dfae', WA.ink * 0.8);
      line(g, x - 3.2, y - 6, x + 3.2, y - 6, WA.ink * 0.6);
      line(g, x - 3.2, y + 6, x + 3.2, y + 6, WA.ink * 0.6);
    },
    map(g, x, y) {
      rrect(g, x - 6, y - 7, 12, 14, 1.5, '#f1dfae', WA.ink * 0.8);
      line(g, x - 3, y - 3, x + 3, y + 3, WA.ink * 0.6, C.red);
      line(g, x + 3, y - 3, x - 3, y + 3, WA.ink * 0.6, C.red);
    },
    mug(g, x, y) {
      rrect(g, x - 3.5, y - 5, 7, 8, 1.5, '#f6f1e4', WA.ink * 0.7);
      arc(g, x + 3.8, y - 1, 2.4, -1.5, 1.5, WA.ink * 0.8);
      rrect(g, x - 3.5, y - 7, 7, 3, 1.5, '#fffaf0', WA.ink * 0.5);
    },
    book(g, x, y, ang, p) {
      rrect(g, x - 6, y - 5, 12, 10, 1, p.propC || C.dgreen, WA.ink * 0.8);
      line(g, x - 5, y + 3.2, x + 5, y + 3.2, WA.ink * 0.7, '#f6f1e4');
    },
    torch(g, x, y) {
      line(g, x, y + 5, x, y - 16, WA.ink * 2.4, INK);
      line(g, x, y + 5, x, y - 16, WA.ink * 0.9, '#8a5a2b');
      g.beginPath();
      g.moveTo(x - 3.5, y - 16);
      g.quadraticCurveTo(x - 6, y - 24, x, y - 32);
      g.quadraticCurveTo(x + 6, y - 24, x + 3.5, y - 16);
      WA.fillInk(g, '#ff8c1a');
      g.beginPath();
      g.moveTo(x - 1.8, y - 17);
      g.quadraticCurveTo(x - 3, y - 22, x, y - 26);
      g.quadraticCurveTo(x + 3, y - 22, x + 1.8, y - 17);
      g.fillStyle = '#ffe14a';
      g.fill();
    },
    trumpet(g, x, y, ang) {
      line(g, x - 6, y, x + 8, y - 1, WA.ink * 2.6, INK);
      line(g, x - 6, y, x + 8, y - 1, WA.ink, '#f5c518');
      poly(g, [[x + 7, y - 1], [x + 14, y - 6], [x + 14, y + 4]], '#f5c518', WA.ink * 0.8);
    },
    drum(g, x, y) {
      rrect(g, x - 6, y - 4, 12, 9, 2, C.red, WA.ink * 0.8);
      ell(g, x, y - 4, 6, 2, '#f6f1e4', 0, WA.ink * 0.7);
      line(g, x - 6, y - 3, x - 3, y + 4, WA.ink * 0.5, C.white);
      line(g, x + 6, y - 3, x + 3, y + 4, WA.ink * 0.5, C.white);
    },
    bag(g, x, y, ang, p) {
      rrect(g, x - 5, y - 2, 10, 10, 2.5, p.propC || C.brown, WA.ink * 0.8);
      arc(g, x, y - 2, 3.5, Math.PI, 0, WA.ink * 0.9);
    },
    umbrella(g, x, y, ang, p) {
      // parasol held over the head: striped canopy (a classic decoy)
      const c1 = p.propC || C.red;
      const c2 = p.propC2 || C.white;
      line(g, x, y + 6, x, y - 42, WA.ink * 1.8, INK);
      line(g, x, y + 6, x, y - 42, WA.ink * 0.7, '#8a8a8a');
      g.beginPath();
      g.moveTo(x - 20, y - 36);
      g.quadraticCurveTo(x, y - 62, x + 20, y - 36);
      g.quadraticCurveTo(x + 10, y - 40, x, y - 36);
      g.quadraticCurveTo(x - 10, y - 40, x - 20, y - 36);
      g.closePath();
      WA.stripes(g, x - 20, y - 56, 40, 20, c1, c2, 8, 'v');
      g.beginPath();
      g.moveTo(x - 20, y - 36);
      g.quadraticCurveTo(x, y - 62, x + 20, y - 36);
      g.quadraticCurveTo(x + 10, y - 40, x, y - 36);
      g.quadraticCurveTo(x - 10, y - 40, x - 20, y - 36);
      g.closePath();
      g.lineWidth = WA.ink;
      g.strokeStyle = INK;
      g.stroke();
    },
    candycane(g, x, y) {
      g.lineCap = 'round';
      const pth = () => {
        g.beginPath();
        g.moveTo(x, y + 6);
        g.lineTo(x, y - 14);
        g.arc(x + 4, y - 14, 4, Math.PI, 0);
      };
      pth();
      g.strokeStyle = INK;
      g.lineWidth = 5 + WA.ink * 1.4;
      g.stroke();
      pth();
      g.strokeStyle = C.white;
      g.lineWidth = 5;
      g.stroke();
      pth();
      g.strokeStyle = C.red;
      g.lineWidth = 5;
      g.setLineDash([2.2, 3.6]);
      g.lineCap = 'butt';
      g.stroke();
      g.setLineDash([]);
    },
    lollipop(g, x, y, ang, p) {
      line(g, x, y + 4, x, y - 14, WA.ink * 1.6, INK);
      line(g, x, y + 4, x, y - 14, WA.ink * 0.6, C.white);
      circ(g, x, y - 18, 5, p.propC || C.pink);
      arc(g, x, y - 18, 2.4, 0, 5, WA.ink * 0.6, C.white);
    },
    popcorn(g, x, y) {
      for (let i = 0; i < 5; i++) circ(g, x - 4 + i * 2, y - 8 - (i % 2) * 1.6, 2.4, '#fff3c4', WA.ink * 0.5);
      g.beginPath();
      g.moveTo(x - 5, y - 7);
      g.lineTo(x + 5, y - 7);
      g.lineTo(x + 3.5, y + 5);
      g.lineTo(x - 3.5, y + 5);
      g.closePath();
      WA.stripes(g, x - 5, y - 7, 10, 12, C.red, C.white, 5, 'v');
      g.beginPath();
      g.moveTo(x - 5, y - 7);
      g.lineTo(x + 5, y - 7);
      g.lineTo(x + 3.5, y + 5);
      g.lineTo(x - 3.5, y + 5);
      g.closePath();
      g.lineWidth = WA.ink * 0.8;
      g.strokeStyle = INK;
      g.stroke();
    },
    bouquet(g, x, y) {
      line(g, x, y + 3, x, y - 4, WA.ink * 1.4, '#2f8f3d');
      [[-3, -8, C.pink], [3, -9, C.yellow], [0, -11, C.red]].forEach(([dx, dy, c]) => circ(g, x + dx, y + dy, 2.8, c, WA.ink * 0.6));
    },
    binocs(g, x, y) {
      circ(g, x - 2.5, y - 3, 3, '#333', WA.ink * 0.7);
      circ(g, x + 2.5, y - 3, 3, '#333', WA.ink * 0.7);
    },
    phone(g, x, y) {
      rrect(g, x - 2.2, y - 4.5, 4.4, 8, 1, '#2b2b30', WA.ink * 0.6);
      rrect(g, x - 1.6, y - 3.6, 3.2, 5.8, 0.5, '#8fd0ff', 0.1, true);
    },
    ball(g, x, y, ang, p) {
      circ(g, x, y - 3, 6, C.white);
      g.save();
      g.beginPath();
      g.arc(x, y - 3, 6, 0, 7);
      g.clip();
      g.fillStyle = p.propC || C.red;
      g.fillRect(x - 7, y - 9.5, 14, 3.6);
      g.fillStyle = C.blue;
      g.fillRect(x - 7, y - 0.5, 14, 3.6);
      g.restore();
      g.beginPath();
      g.arc(x, y - 3, 6, 0, 7);
      g.lineWidth = WA.ink * 0.9;
      g.strokeStyle = INK;
      g.stroke();
    },
    megaphone(g, x, y) {
      poly(g, [[x - 3, y - 2], [x + 11, y - 7], [x + 11, y + 5], [x - 3, y + 2]], C.red, WA.ink * 0.8);
    },
    rod(g, x, y) {
      line(g, x, y + 3, x + 18, y - 28, WA.ink * 1.0, INK);
      line(g, x + 18, y - 28, x + 22, y - 6, WA.ink * 0.4, '#555');
    },
    paddle(g, x, y) {
      line(g, x - 1, y + 5, x + 3, y - 26, WA.ink * 2.2, INK);
      line(g, x - 1, y + 5, x + 3, y - 26, WA.ink * 0.8, '#c88a4a');
      ell(g, x + 3.5, y - 28, 3.2, 6, '#c88a4a', 0.15);
    },
    pitchfork(g, x, y) {
      line(g, x, y + 6, x + 1, y - 28, WA.ink * 2.0, INK);
      line(g, x, y + 6, x + 1, y - 28, WA.ink * 0.7, '#8a5a2b');
      line(g, x - 4, y - 30, x + 6, y - 30, WA.ink * 1.0, INK);
      for (const dx of [-4, 1, 6]) line(g, x + dx, y - 30, x + dx, y - 38, WA.ink * 1.0, INK);
    },
    lantern(g, x, y) {
      rrect(g, x - 3.5, y - 2, 7, 9, 1.5, '#ffd24a', WA.ink * 0.8);
      arc(g, x, y - 2, 3, Math.PI, 0, WA.ink * 0.7);
    },
    sign(g, x, y, ang, p) {
      line(g, x, y + 6, x, y - 20, WA.ink * 1.8, INK);
      line(g, x, y + 6, x, y - 20, WA.ink * 0.7, '#8a5a2b');
      rrect(g, x - 9, y - 36, 18, 14, 2, p.propC || C.white, WA.ink * 0.9);
      line(g, x - 5, y - 32, x + 5, y - 32, WA.ink * 0.8);
      line(g, x - 5, y - 28, x + 3, y - 28, WA.ink * 0.8);
    },
    surfboard(g, x, y, ang, p) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.12);
      ell(g, 0, -14, 4.6, 20, p.propC || C.yellow, 0);
      line(g, 0, -33, 0, 5, WA.ink * 0.6, C.red);
      g.restore();
    },
    skipole(g, x, y) {
      line(g, x, y + 2, x + 5, y + 38, WA.ink * 1.8, INK);
      line(g, x, y + 2, x + 5, y + 38, WA.ink * 0.7, '#cfd3d8');
      circ(g, x + 5, y + 34, 2.2, '#cfd3d8', WA.ink * 0.5);
    },
    suitcase(g, x, y, ang, p) {
      const c = p.propC || C.brown;
      arc(g, x, y + 2, 3.4, Math.PI, 0, WA.ink * 1.1, INK);
      rrect(g, x - 7, y + 2, 14, 11, 2, c, WA.ink * 0.9);
      line(g, x - 7, y + 6, x + 7, y + 6, WA.ink * 0.6, shade(c, -0.35));
      rrect(g, x - 1.5, y + 5, 3, 2.4, 0.8, '#e8c040', WA.ink * 0.4);
    },
    toybear(g, x, y, ang, p) {
      const b = p.toyC || '#c98a5a';
      circ(g, x - 4.4, y - 11.4, 2.2, b, WA.ink * 0.5);
      circ(g, x + 4.4, y - 11.4, 2.2, b, WA.ink * 0.5);
      ell(g, x, y - 1, 5.6, 6.6, b, 0, WA.ink * 0.7);
      circ(g, x, y - 9, 4.6, b, WA.ink * 0.7);
      dot(g, x - 1.6, y - 9.4, 0.8);
      dot(g, x + 1.6, y - 9.4, 0.8);
      poly(g, [[x, y - 4], [x - 3.4, y - 6], [x - 3.4, y - 2]], p.bowC || C.red, WA.ink * 0.4);
      poly(g, [[x, y - 4], [x + 3.4, y - 6], [x + 3.4, y - 2]], p.bowC || C.red, WA.ink * 0.4);
    },
    toyduck(g, x, y, ang, p) {
      ell(g, x, y - 1, 6, 4, p.toyC || C.yellow, 0, WA.ink * 0.7);
      circ(g, x + 3.6, y - 6.4, 3.2, p.toyC || C.yellow, WA.ink * 0.7);
      poly(g, [[x + 6, y - 6.4], [x + 9.2, y - 5.6], [x + 6, y - 5]], C.orange, WA.ink * 0.4);
    },
    toyrobot(g, x, y) {
      rrect(g, x - 4, y - 5, 8, 9, 1.5, '#b8c2cc', WA.ink * 0.7);
      rrect(g, x - 3, y - 11, 6, 6, 1.5, '#b8c2cc', WA.ink * 0.7);
      dot(g, x - 1.2, y - 8.4, 0.9, '#2b6fd1');
      dot(g, x + 1.2, y - 8.4, 0.9, '#2b6fd1');
    },
    cane(g, x, y) {
      line(g, x, y + 8, x, y - 14, WA.ink * 2.0, INK);
      line(g, x, y + 8, x, y - 14, WA.ink * 0.7, '#8a5a2b');
      arc(g, x + 2.5, y - 14, 2.5, Math.PI, 0, WA.ink * 1.1);
    },
    staff(g, x, y) {
      line(g, x, y + 8, x + 1, y - 34, WA.ink * 2.2, INK);
      line(g, x, y + 8, x + 1, y - 34, WA.ink * 0.9, '#8a5a2b');
      circ(g, x + 1, y - 37, 3.6, '#8fd0ff', WA.ink * 0.9);
    },
    mallet(g, x, y) {
      line(g, x, y + 4, x, y - 14, WA.ink * 2.0, INK);
      line(g, x, y + 4, x, y - 14, WA.ink * 0.7, '#8a5a2b');
      rrect(g, x - 6, y - 20, 12, 7, 1.5, '#b07a3a', WA.ink * 0.8);
    },
  };
  WA.PROPS = PROPS;
  WA.PROP_LIST = Object.keys(PROPS);

  // ---------- the figure ----------
  WA.drawFigure = function (g, p) {
    const pose = POSES[p.pose] || POSES.stand;
    const kid = p.kid ? 1 : 0;
    const legL = kid ? 28 : 40 * (p.legK || 1);
    const torsoL = kid ? 21 : 28;
    const R = kid ? 12.2 : 11.6;
    const sw = (p.wide ? 13.6 : p.slim ? 10 : 11.6) * (kid ? 0.82 : 1);
    const ww = sw - (p.wide ? 1 : 1.8);
    const belly = p.belly || (p.wide ? 2.2 : 0);
    const L1 = legL / 2, L2 = legL / 2;
    // legs: compute joint positions with a free hip height, then lift so lowest foot is at y=0
    const legs = [];
    let maxExt = 0;
    for (const side of ['r', 'l']) {
      const [a1, a2] = pose[side];
      const ext = L1 * Math.cos(a1) + L2 * Math.cos(a1 + a2);
      maxExt = Math.max(maxExt, ext);
      legs.push({ side, a1, a2, ext });
    }
    const hipY = -maxExt;
    const g0 = { sw, ww, sY: hipY - torsoL, hipY, belly };
    const sY = g0.sY;
    const ink = WA.ink;
    const sk = p.skin;
    const bottom = p.bottom || { t: 'pants', c: C.blue };
    const lieAng = p.lie ? (p.lie > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    if (lieAng) {
      g.save();
      g.rotate(lieAng);
      g.translate(0, 0);
    }

    // far arm, back hair
    const armPts = (side) => {
      const sx = side === 'R' ? sw - 2 : -sw + 2, sy = sY + 3.5;
      const [a1, a2] = pose[side];
      const U = kid ? 12 : 14.5, F = kid ? 11 : 13.5;
      const ex = sx + Math.sin(a1) * U, ey = sy + Math.cos(a1) * U;
      const hx = ex + Math.sin(a1 + a2) * F, hy = ey + Math.cos(a1 + a2) * F;
      return [[sx, sy], [ex, ey], [hx, hy]];
    };
    const lean = pose.lean || 0;
    const sleeve = p.top.sleeve || 'short';
    const drawArm = (side) => {
      const pts = armPts(side);
      const aw = kid ? 6.2 : 7.0;
      const longSl = sleeve === 'long';
      const shortSl = sleeve === 'short';
      const sc = p.top.pat === 'swim' ? sk : p.top.sleeveC || p.top.c;
      const hasStripe = p.top.pat === 'hstripe' && longSl;
      // forearm
      limb(g, [pts[1], pts[2]], aw, longSl ? sc : sk);
      if (hasStripe) {
        g.save();
        g.lineCap = 'butt';
        g.setLineDash([2.3, 2.3]);
        g.strokeStyle = p.top.c2;
        g.lineWidth = aw;
        g.beginPath();
        g.moveTo(pts[1][0], pts[1][1]);
        g.lineTo(pts[2][0], pts[2][1]);
        g.stroke();
        g.restore();
      }
      // hand
      circ(g, pts[2][0], pts[2][1], aw * 0.52, p.gloveC || sk, ink * 0.9);
      // upper arm
      limb(g, [pts[0], pts[1]], aw, longSl || shortSl ? sc : sk);
      if (p.top.pat === 'hstripe' && (longSl || shortSl)) {
        g.save();
        g.lineCap = 'butt';
        g.setLineDash([2.3, 2.3]);
        g.strokeStyle = p.top.c2;
        g.lineWidth = aw;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        g.lineTo(pts[1][0], pts[1][1]);
        g.stroke();
        g.restore();
      }
      return pts;
    };

    // draw upper body in a leaned frame
    const hy0 = sY - 2 - R;
    const f = p.face == null ? 1 : p.face;
    // --- legs
    const drawLegs = () => {
      const order = ['l', 'r'];
      for (const sd of order) {
        const lg = legs.find((q) => q.side === sd);
        const hx = sd === 'r' ? 4.2 : -4.2;
        const kx = hx + Math.sin(lg.a1) * L1, ky = hipY + Math.cos(lg.a1) * L1;
        const fx = kx + Math.sin(lg.a1 + lg.a2) * L2, fy = ky + Math.cos(lg.a1 + lg.a2) * L2;
        lg.fx = fx;
        lg.fy = fy;
        const lw = kid ? 6.6 : 7.8;
        const bt = bottom.t;
        if (bt === 'dress' || bt === 'skirt') {
          // bare legs
          limb(g, [[hx, hipY], [kx, ky], [fx, fy - 1]], lw - 1.2, sk);
          if (bottom.sock) limb(g, [[kx * 0.4 + fx * 0.6, ky * 0.4 + fy * 0.6], [fx, fy - 1]], lw - 1.2, bottom.sock);
        } else if (bt === 'shorts' || bt === 'trunks') {
          limb(g, [[kx, ky], [fx, fy - 1]], lw - 1.4, sk);
          limb(g, [[hx, hipY], [(hx + kx) / 2, (hipY + ky) / 2 - 1]], lw + 1.2, bottom.c);
        } else {
          limb(g, [[hx, hipY], [kx, ky], [fx, fy - 1]], lw + 0.6, bottom.c);
          if (bottom.stripe) {
            g.save();
            g.lineCap = 'butt';
            g.setLineDash([2.6, 2.6]);
            g.strokeStyle = bottom.stripe;
            g.lineWidth = lw + 0.6;
            g.beginPath();
            g.moveTo(hx, hipY);
            g.lineTo(kx, ky);
            g.lineTo(fx, fy - 1);
            g.stroke();
            g.restore();
          }
        }
        // shoe
        const sa = Math.atan2(fx - kx, fy - ky);
        g.save();
        g.translate(fx, fy - 0.5);
        g.rotate(-sa * 0.4);
        WA.ell(g, 2.3, 0, kid ? 4.6 : 5.2, kid ? 2.6 : 2.9, p.shoe || '#4a2f1c', 0, ink * 0.9);
        g.restore();
        if (p.skis) {
          g.save();
          g.translate(fx, fy);
          g.rotate(0);
          rrect(g, -12, 0.5, 38, 2.6, 1.3, p.skis, ink * 0.8);
          g.restore();
        }
      }
    };

    drawLegs();
    // skirt / dress
    if (bottom.t === 'dress' || bottom.t === 'skirt') {
      const len = bottom.t === 'dress' ? 20 : 11;
      g.beginPath();
      g.moveTo(-ww, hipY - 4);
      g.lineTo(ww, hipY - 4);
      g.lineTo(ww + 6.5, hipY + len);
      g.quadraticCurveTo(0, hipY + len + 3, -ww - 6.5, hipY + len);
      g.closePath();
      WA.fillInk(g, bottom.c);
      if (bottom.c2) {
        g.save();
        g.beginPath();
        g.moveTo(-ww, hipY - 4);
        g.lineTo(ww, hipY - 4);
        g.lineTo(ww + 6.5, hipY + len);
        g.quadraticCurveTo(0, hipY + len + 3, -ww - 6.5, hipY + len);
        g.closePath();
        g.clip();
        g.fillStyle = bottom.c2;
        for (let i = -3; i <= 3; i++) {
          g.fillRect(i * 4.4 - 1, hipY - 4, 2.2, len + 8);
        }
        g.restore();
        g.beginPath();
        g.moveTo(-ww, hipY - 4);
        g.lineTo(ww, hipY - 4);
        g.lineTo(ww + 6.5, hipY + len);
        g.quadraticCurveTo(0, hipY + len + 3, -ww - 6.5, hipY + len);
        g.closePath();
        g.lineWidth = ink;
        g.strokeStyle = INK;
        g.stroke();
      }
    }

    g.save();
    if (lean) {
      g.translate(0, hipY);
      g.rotate(lean);
      g.translate(0, -hipY);
    }
    if (p.cape) {
      g.beginPath();
      g.moveTo(-sw + 1, sY + 1);
      g.lineTo(sw - 1, sY + 1);
      g.lineTo(sw + 8, hipY + 22);
      g.lineTo(-sw - 12, hipY + 20);
      g.closePath();
      WA.fillInk(g, p.cape);
    }
    // far arm behind the body
    const farPts = drawArm('L');
    // long hair behind the body
    const hx = lean ? 0 : 0;
    hairBack(g, p, 0, hy0, R);
    // torso
    paintTop(g, p, g0);
    if (p.belt) {
      g.save();
      torsoPath(g, p, g0);
      g.clip();
      g.fillStyle = p.belt;
      g.fillRect(-sw - 2, hipY - 4, 2 * sw + 4, 3.6);
      g.restore();
    }
    // neck + head
    rrect(g, -2.6, sY - 5, 5.2, 7, 2, sk, ink * 0.8);
    // ears
    circ(g, -R * 0.96, hy0 + 1, 2.4, sk, ink * 0.8);
    circ(g, R * 0.96, hy0 + 1, 2.4, sk, ink * 0.8);
    // head
    g.beginPath();
    g.ellipse(0, hy0, R * 0.97, R, 0, 0, Math.PI * 2);
    WA.fillInk(g, sk);
    // cheeks
    if (p.blush) {
      ell(g, f * 1.6 - 4.6, hy0 + 3.1, 2, 1.2, 'rgba(240,110,110,0.45)', 0, 0.01);
      ell(g, f * 1.6 + 4.6, hy0 + 3.1, 2, 1.2, 'rgba(240,110,110,0.45)', 0, 0.01);
    }
    // face
    const fx0 = f * 2.4;
    const ex1 = fx0 - 2.9, ex2 = fx0 + 2.9, ey = hy0 - 0.3;
    if (p.eyes === 'closed') {
      arc(g, ex1, ey, 1.5, 0.1, Math.PI - 0.1, ink * 0.8);
      arc(g, ex2, ey, 1.5, 0.1, Math.PI - 0.1, ink * 0.8);
    } else {
      dot(g, ex1, ey, p.mood === 'surprise' ? 1.5 : 1.25);
      dot(g, ex2, ey, p.mood === 'surprise' ? 1.5 : 1.25);
      if (p.mood === 'grim' || p.mood === 'angry') {
        line(g, ex1 - 1.8, ey - 2.4, ex1 + 1.6, ey - 1.7, ink * 0.8);
        line(g, ex2 + 1.8, ey - 2.4, ex2 - 1.6, ey - 1.7, ink * 0.8);
      } else if (p.brows) {
        line(g, ex1 - 1.8, ey - 2.4, ex1 + 1.6, ey - 2.6, ink * 0.7, p.hairC);
        line(g, ex2 - 1.6, ey - 2.6, ex2 + 1.8, ey - 2.4, ink * 0.7, p.hairC);
      }
    }
    // nose
    if (f > 0.4) {
      ell(g, f * 8.0, hy0 + 1.8, p.noseC ? 2.8 : 1.9, p.noseC ? 2.6 : 1.6, p.noseC || sk, 0, ink * 0.75);
    } else {
      arc(g, fx0, hy0 + 2.6, 1.2, 0.3, Math.PI - 0.3, ink * 0.65);
    }
    // mouth
    const mx = f * 3.8;
    if (p.mood === 'open') {
      g.beginPath();
      g.ellipse(mx, hy0 + 5.2, 2.3, 1.6, 0, 0, Math.PI);
      g.fillStyle = '#7a1f1f';
      g.fill();
      g.lineWidth = ink * 0.6;
      g.strokeStyle = INK;
      g.stroke();
    } else if (p.mood === 'surprise') {
      ell(g, mx, hy0 + 5.4, 1.3, 1.6, '#7a1f1f', 0, ink * 0.6);
    } else if (p.mood === 'grim' || p.mood === 'angry') {
      line(g, mx - 2, hy0 + 5.4, mx + 2, hy0 + 5.2, ink * 0.8);
    } else {
      arc(g, mx, hy0 + 3.6, 2.5, 0.3, Math.PI - 0.3, ink * 0.8);
    }
    mustacheDraw(g, p, 0, hy0, R, f);
    beardDraw(g, p, 0, hy0, R, f);
    hairFront(g, p, 0, hy0, R, f);
    glassesDraw(g, p, 0, hy0, R, f);
    hatDraw(g, p, 0, hy0, R, f, false);
    // near arm last
    const nearPts = drawArm('R');
    if (p.prop) {
      const hand = p.propHand === 'L' ? farPts[2] : nearPts[2];
      const fn = PROPS[p.prop];
      if (fn) {
        g.save();
        fn(g, hand[0], hand[1], 0, p);
        g.restore();
        // re-draw fingers over prop
        circ(g, hand[0], hand[1], (kid ? 5.6 : 6.4) * 0.52, p.gloveC || sk, ink * 0.9);
      }
    }
    if (p.extra) p.extra(g, p, { sw, sY, hipY, hy0, R, nearPts, farPts });
    g.restore();
    if (lieAng) g.restore();
    return { hipY, headY: hy0, R };
  };

  // Draws the person with feet at (x, y), figure height H (px). flip=-1 mirrors.
  WA.drawPerson = function (g, p, x, y, H, flip) {
    const k = H / 100;
    g.save();
    g.translate(x, y);
    g.scale((flip || 1) * k, k);
    WA.ink = Math.max(1.8, 1.7 / k);
    if (!p.noShadow) {
      g.beginPath();
      g.ellipse(0, 0.5, p.lie ? 28 : 16, 3.4, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(30,18,8,0.22)';
      g.fill();
    }
    if (p.clipBelow != null) {
      // swimmers: only show above the water line (in local units)
      g.save();
      g.beginPath();
      g.rect(-60, -140, 120, 140 + p.clipBelow);
      g.clip();
      WA.drawFigure(g, p);
      g.restore();
    } else WA.drawFigure(g, p);
    g.restore();
  };
})();
