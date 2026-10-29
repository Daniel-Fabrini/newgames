// Scene: Funfair / circus.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function ferris(S, cx, cy, R, base) {
    const { r } = S;
    const cols = [C.red, C.yellow, C.blue, C.green, C.orange, C.pink, C.purple, C.teal];
    S.item(base - 900, (g) => {
      P.setInk(R);
      // legs
      WA.line(g, cx, cy, cx - R * 0.55, base, WA.ink * 8, WA.INK);
      WA.line(g, cx, cy, cx + R * 0.55, base, WA.ink * 8, WA.INK);
      WA.line(g, cx, cy, cx - R * 0.55, base, WA.ink * 4, '#d9dde2');
      WA.line(g, cx, cy, cx + R * 0.55, base, WA.ink * 4, '#d9dde2');
      // wheel
      for (const rr of [R, R * 0.62]) {
        g.beginPath();
        g.arc(cx, cy, rr, 0, Math.PI * 2);
        g.lineWidth = WA.ink * 6;
        g.strokeStyle = WA.INK;
        g.stroke();
        g.lineWidth = WA.ink * 2.8;
        g.strokeStyle = rr === R ? C.red : C.yellow;
        g.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        WA.line(g, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, WA.ink * 2.4, '#8a8f98');
      }
      WA.circ(g, cx, cy, R * 0.08, C.yellow, WA.ink * 1.4);
    });
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.1;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const w = R * 0.16, h = R * 0.15;
      const col = cols[i % cols.length];
      S.item(base - 880, (g) => {
        P.setInk(R);
        WA.line(g, x, y, x, y + h * 0.4, WA.ink * 1.6, WA.INK);
        WA.rrect(g, x - w / 2, y + h * 0.3, w, h * 1.05, 4, col, WA.ink * 1.2);
        // roof
        WA.poly(g, [[x - w * 0.6, y + h * 0.3], [x, y + h * 0.05], [x + w * 0.6, y + h * 0.3]], shade2(col), WA.ink);
      });
      for (let j = 0; j < 2; j++) {
        const e = S.person(x + (j - 0.5) * w * 0.4, y + h * 1.18, h * 0.62, { p: { pose: r.pick(['wave', 'cheer', 'sit', 'stand']), clipBelow: -34 } });
        e.keep = false;
        e.sortKey = base - 870 + 1;
      }
      S.item(base - 869, (g) => {
        WA.rrect(g, x - w / 2, y + h * 0.82, w, h * 0.55, 3, col, WA.ink * 1.1);
        WA.line(g, x - w / 2, y + h * 1.0, x + w / 2, y + h * 1.0, WA.ink * 1.2, C.white);
      });
    }
  }
  const shade2 = (c) => WA.shade(c, -0.2);

  function coaster(S, x0, x1, ybase, ytop) {
    const { r } = S;
    const pts = [];
    for (let x = x0; x <= x1; x += 20) {
      const t = (x - x0) / (x1 - x0);
      const y = ybase - (Math.sin(t * Math.PI * 2.2 + 0.4) * 0.5 + 0.5) * (ybase - ytop) * (0.55 + 0.45 * Math.sin(t * 5 + 1) * Math.sin(t * 5 + 1));
      pts.push([x, y]);
    }
    S.item(ybase - 950, (g) => {
      P.setInk(300);
      // supports
      for (let i = 0; i < pts.length; i += 3) {
        const [x, y] = pts[i];
        WA.line(g, x, y, x, ybase + 80, WA.ink * 3.4, WA.INK);
        WA.line(g, x, y, x, ybase + 80, WA.ink * 1.4, '#d9a35a');
        if (i + 3 < pts.length) {
          const [x2] = pts[i + 3];
          WA.line(g, x, y + 20, x2, ybase + 50, WA.ink * 1.2, '#7a5a2b');
          WA.line(g, x2, y + 20, x, ybase + 50, WA.ink * 1.2, '#7a5a2b');
        }
      }
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineWidth = WA.ink * 9;
      g.strokeStyle = WA.INK;
      g.stroke();
      g.lineWidth = WA.ink * 5;
      g.strokeStyle = C.red;
      g.stroke();
      g.lineWidth = WA.ink * 1.4;
      g.strokeStyle = C.white;
      g.setLineDash([14, 14]);
      g.stroke();
      g.setLineDash([]);
    });
    // cars
    for (let c = 0; c < 6; c++) {
      const i = 6 + c * 18;
      if (i >= pts.length) break;
      for (let k = 0; k < 3; k++) {
        const [x, y] = pts[Math.min(pts.length - 1, i + k * 2)];
        for (let j = 0; j < 2; j++) {
          const e = S.person(x + (j - 0.5) * 22, y - 8, 56, { p: { pose: r.pick(['cheer', 'wave', 'cheer', 'stand']), clipBelow: -30 } });
          e.y = y - 7;
          e.keep = false;
        }
        S.item(y - 6, (g) => {
          P.setInk(200);
          WA.rrect(g, x - 24, y - 8, 48, 22, 6, [C.yellow, C.blue, C.green, C.orange][c % 4], WA.ink * 1.4);
        });
      }
    }
  }

  T.fair = {
    id: 'fair', W: 3200, H: 2000, seed: 3303, hide: 0.8,
    outfit: {
      tops: [['solid', 26], ['hstripe', 9], ['vstripe', 6], ['dots', 8], ['plaid', 7], ['jacket', 8], ['logo', 8], ['diag', 2], ['band', 4]],
      hats: [['none', 52], ['cap', 8], ['party', 3], ['straw', 3], ['beanie', 3], ['bobble', 2], ['top', 1.4], ['flower', 1.2], ['headband', 1], ['sun', 2]],
      oddP: 0.14,
      costumes: [['clown', 6], ['cowboy', 1.6], ['hero', 1.6], ['chef', 2], ['king', 0.8], ['wizardish', 1], ['sailor', 0.8], ['knight', 0.8], ['astronaut', 0.8], ['pirate', 1]],
      props: [null, 50, ['balloons', 7], ['icecream', 4], ['lollipop', 4], ['popcorn', 5], ['candycane', 2], ['flag', 2], ['camera', 1], ['bag', 1.5], ['ball', 1], ['megaphone', 0.6], ['umbrella', 1.2]],
      poses: WA.POSE_COMMON,
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 480);
      gr.addColorStop(0, '#8fd3f4');
      gr.addColorStop(1, '#fde3f1');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 520);
      for (let i = 0; i < 9; i++) P.cloud(g, 80 + i * 380 + r() * 120, 40 + r() * 100, 200 + r() * 100);
      // far hills
      g.beginPath();
      g.moveTo(0, 470);
      for (let x = 0; x <= W; x += 100) g.lineTo(x, 400 + Math.sin(x * 0.004) * 50);
      g.lineTo(W, 520);
      g.lineTo(0, 520);
      g.closePath();
      WA.fillInk(g, '#74c46a', 3);
      // ground
      g.fillStyle = '#ecd7a2';
      g.fillRect(0, 510, W, H - 510);
      for (let i = 0; i < 70; i++) {
        const x = r() * W, y = 560 + r() * (H - 560), w = 160 + r() * 260;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.14, 0, 0, 7);
        g.fillStyle = r() < 0.5 ? '#c9e08a' : '#e1c58a';
        g.fill();
      }
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = r() < 0.5 ? '#d7bc80' : '#fff3cc';
        g.beginPath();
        g.arc(r() * W, 520 + r() * (H - 520), 1.6 + r() * 2, 0, 7);
        g.fill();
      }
    },
    layout(S) {
      const { g, W, H, r } = S;
      // sky: balloons, kites, hot-air
      S.item(100, (gg) => P.hotAirBalloon(gg, 500, 230, 100, C.red, C.yellow));
      S.item(100, (gg) => P.hotAirBalloon(gg, 2900, 200, 80, C.blue, C.white));
      for (let i = 0; i < 10; i++) {
        const x = 100 + r() * (W - 200), y = 70 + r() * 200;
        S.item(y, (gg) => P.balloons(gg, x, y + 120, 120, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]));
      }
      // big attractions
      coaster(S, 80, 1800, 560, 120);
      ferris(S, 2450, 520, 360, 960);
      // big top
      S.item(980, (gg) => P.bigtop(gg, 1750, 980, 520, 520, C.red, C.white), { x0: 1490, x1: 2010, y0: 460, y1: 980 });
      S.item(980, (gg) => P.bigtop(gg, 3000, 900, 360, 380, C.blue, C.yellow), { x0: 2820, x1: 3180, y0: 520, y1: 900 });
      S.occupy(1490, 600, 2010, 980, 8);
      // carousel
      const cx = 760, cy = 1040;
      S.item(cy - 40, (gg) => {
        P.setInk(300);
        WA.ell(gg, cx, cy, 250, 52, '#e8d9b0', 0, WA.ink * 1.4);
        WA.rrect(gg, cx - 230, cy - 30, 460, 26, 6, C.red, WA.ink * 1.4);
        for (let i = 0; i < 9; i++) {
          const px = cx - 210 + i * 52.5;
          WA.line(gg, px, cy - 24, px, cy - 220, WA.ink * 3.4, WA.INK);
          WA.line(gg, px, cy - 24, px, cy - 220, WA.ink * 1.4, '#f2d68a');
        }
      });
      for (let i = 0; i < 9; i++) {
        const px = cx - 210 + i * 52.5;
        const y = cy - 70 + (i % 2) * 14;
        S.item(cy - 20 + i, (gg) => {
          WA.sprite(gg, px, y + 24, 78, (g2) => WA.CREATURES.horse(g2, { body: r.pick(['#f6f1e4', '#a8672f', '#2a2a30', '#f2b81c', '#e8a0c0']), mane: r.pick([C.red, C.blue, '#2a1b12']), saddle: r.pick([C.red, C.blue, C.green]) }), r.pick([1, -1]));
        });
        const e = S.person(px, y + 4, 62, { p: { pose: r.pick(['wave', 'sit', 'cheer', 'sit']), clipBelow: -26 } });
        e.sortKey = cy - 21 + i;
        e.keep = false;
      }
      S.item(cy + 30, (gg) => {
        P.setInk(300);
        const roof = () => {
          gg.beginPath();
          gg.moveTo(cx - 280, cy - 210);
          gg.lineTo(cx + 280, cy - 210);
          gg.lineTo(cx, cy - 400);
          gg.closePath();
        };
        P.stripedPath(gg, roof, cx - 280, cy - 400, 560, 190, C.pink, C.white, 14, 'v');
        gg.beginPath();
        for (let i = 0; i < 10; i++) {
          const xa = cx - 280 + i * 56;
          gg.moveTo(xa, cy - 210);
          gg.quadraticCurveTo(xa + 28, cy - 180, xa + 56, cy - 210);
        }
        gg.lineWidth = WA.ink * 2;
        gg.strokeStyle = WA.INK;
        gg.stroke();
        WA.circ(gg, cx, cy - 410, 14, C.yellow, WA.ink * 1.4);
        P.flagpole(gg, cx, cy - 420, 80, C.red, C.white, true);
      }, { x0: cx - 280, x1: cx + 280, y0: cy - 420, y1: cy - 200 });
      // zones
      S.zone({ x0: 30, x1: W - 30, y0: 560, y1: 920, hh: [62, 78], d: 0.9 });
      S.zone({ x0: 30, x1: W - 30, y0: 920, y1: 1350, hh: [78, 100], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1350, y1: 1700, hh: [100, 118], d: 0.82 });
      S.zone({ x0: 30, x1: W - 30, y0: 1700, y1: 1990, hh: [118, 134], d: 0.8 });
      // stalls and booths (many striped awnings)
      const pal = [[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.orange, C.white], [C.pink, C.white], [C.purple, C.yellow], [C.teal, C.white], [C.red, C.yellow]];
      for (let i = 0; i < 20; i++) {
        const x = 150 + r() * (W - 300), y = 1000 + r() * 950, w = lerp(150, 250, (y - 1000) / 950) * r.range(0.9, 1.15);
        const [a, b] = r.pick(pal), kind = r.int(0, 3);
        S.item(y, (gg) => {
          P.awning(gg, x, y, w, w * 0.9, a, b);
          WA.rrect(gg, x - w * 0.46, y - w * 0.36, w * 0.92, w * 0.36, 4, '#d9a35a', WA.ink * 1.3);
          for (let j = 0; j < 5; j++) {
            if (kind === 0) WA.circ(gg, x - w * 0.34 + j * w * 0.17, y - w * 0.45, w * 0.06, r.pick(WA.BRIGHT), WA.ink);
            else if (kind === 1) P.star5(gg, x - w * 0.34 + j * w * 0.17, y - w * 0.45, w * 0.07, r.pick(['#f9d71c', '#e5352b']));
            else WA.rrect(gg, x - w * 0.36 + j * w * 0.17, y - w * 0.5, w * 0.1, w * 0.14, 3, r.pick(WA.BRIGHT), WA.ink);
          }
        }, { x0: x - w / 2, x1: x + w / 2, y0: y - w * 0.9, y1: y - w * 0.5 });
        S.occupy(x - w / 2, y - w * 0.4, x + w / 2, y, 4);
      }
      // tents, carts, ticket booths
      for (let i = 0; i < 12; i++) {
        const x = 150 + r() * (W - 300), y = 1100 + r() * 880, w = lerp(130, 210, (y - 1100) / 880), [a, b] = r.pick(pal);
        S.item(y, (gg) => P.tent(gg, x, y, w, w * 0.9, a, b, { flagC: r.pick(WA.BRIGHT) }), { x0: x - w * 0.3, x1: x + w * 0.3, y0: y - w * 0.9, y1: y - w * 0.4 });
      }
      for (let i = 0; i < 26; i++) {
        const x = 100 + r() * (W - 200), y = 1000 + r() * 980, w = lerp(130, 220, (y - 1000) / 980), [a, b] = r.pick(pal);
        S.item(y, (gg) => P.umbrella(gg, x, y, w, a, b, r.range(-0.1, 0.1)), { x0: x - w / 2, x1: x + w / 2, y0: y - w * 0.95, y1: y - w * 0.45 });
      }
      // lamp posts + bunting across the sky
      for (let i = 0; i < 6; i++) {
        const x0 = 100 + i * 520, y0 = 640 + r() * 40;
        S.item(y0 + 400, (gg) => P.bunting(gg, x0, y0, x0 + 480, y0 + r() * 30 - 15, 10, pal.map((q) => q[0]), 0.07));
      }
      for (let i = 0; i < 12; i++) {
        const x = 120 + i * 270 + r() * 90, y = 780 + r() * 80;
        S.item(y, (gg) => P.lamp(gg, x, y, 200));
      }
      // clutter: balloons bunches, benches, barrels, signs, bins, animals
      for (let i = 0; i < 50; i++) {
        const x = 70 + r() * (W - 140), y = 800 + r() * 1180, w = lerp(60, 110, (y - 800) / 1180), k = r.int(0, 6);
        S.item(y, (gg) => {
          if (k === 0 || k === 1) P.balloons(gg, x, y, w * 1.6, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]);
          else if (k === 2) P.crate(gg, x, y, w * 0.9);
          else if (k === 3) P.sign(gg, x, y, w * 1.5, '#fffaf0', r.pick(['arrow', 'star']));
          else if (k === 4) P.barrel(gg, x, y, w * 0.8, r.pick(['#e5352b', '#2b6fd1', '#a8672f']));
          else P.flowers(gg, x, y, w);
        });
      }
      for (let i = 0; i < 12; i++) {
        const x = 100 + r() * (W - 200), y = 900 + r() * 1000, h = lerp(70, 120, (y - 900) / 1100);
        const nm = r.pick(['dog', 'cat', 'bunny', 'monkey', 'parrot', 'penguin']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 0.55, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42', '#e8c27a']), patch: '#8a5a2b', collar: r.pick([C.blue, C.green, null]) } : {}), r.pick([1, -1])));
      }
      for (let i = 0; i < 3; i++) {
        const x = 300 + r() * (W - 600), y = 1200 + r() * 700, h = lerp(120, 200, (y - 1200) / 700);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => WA.CREATURES.elephant(g2, { blanket: r.pick([C.red, C.blue, C.purple]) }), r.pick([1, -1])), { x0: x - h * 0.6, x1: x + h * 0.6, y0: y - h, y1: y - h * 0.2 });
      }
    },
  };
})();
