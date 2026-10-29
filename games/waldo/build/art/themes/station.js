// Scene: Train station.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function loco(g, x, y, w, c1, c2) {
    P.setInk(w);
    const h = w * 0.36;
    // wheels
    // boiler
    WA.rrect(g, x - w * 0.5, y - h * 1.05, w * 0.62, h * 0.7, h * 0.3, c1);
    g.save();
    g.beginPath();
    WA.rrect(g, x - w * 0.5, y - h * 1.05, w * 0.62, h * 0.7, h * 0.3, null, 0.01, true);
    g.restore();
    for (const dx of [0.1, 0.35, 0.6]) WA.line(g, x - w * 0.5 + w * 0.62 * dx, y - h * 1.05, x - w * 0.5 + w * 0.62 * dx, y - h * 0.35, WA.ink * 1.4, c2);
    WA.rrect(g, x - w * 0.52, y - h * 0.6, w * 0.66, h * 0.3, 3, c2, WA.ink * 1.2);
    // chimney
    WA.poly(g, [[x - w * 0.43, y - h * 1.05], [x - w * 0.37, y - h * 1.05], [x - w * 0.33, y - h * 1.4], [x - w * 0.47, y - h * 1.4]], '#2a2a30');
    WA.rrect(g, x - w * 0.5, y - h * 1.5, w * 0.2, h * 0.14, 3, '#2a2a30');
    WA.rrect(g, x - w * 0.2, y - h * 1.18, w * 0.08, h * 0.14, 3, '#f2b81c');
    // cab
    WA.rrect(g, x + w * 0.1, y - h * 1.35, w * 0.34, h * 1.05, 4, c1);
    WA.rrect(g, x + w * 0.1, y - h * 1.45, w * 0.38, h * 0.14, 3, c2);
    WA.rrect(g, x + w * 0.16, y - h * 1.18, w * 0.2, h * 0.34, 3, '#8fd0ee', WA.ink * 1.2);
    // wheels
    for (const [dx, rr] of [[-0.36, 0.17], [-0.12, 0.17], [0.12, 0.17], [0.36, 0.22]]) {
      WA.circ(g, x + w * dx, y - h * rr * 1.15, h * rr * 1.15, '#2a2a30', WA.ink * 1.4);
      WA.circ(g, x + w * dx, y - h * rr * 1.15, h * rr * 0.45, '#c9ced4', WA.ink);
    }
    WA.poly(g, [[x - w * 0.52, y - h * 0.3], [x - w * 0.6, y], [x - w * 0.46, y]], '#2a2a30');
  }
  function carriage(S, x, y, w, c1, c2, kind) {
    const { r } = S;
    const h = w * 0.34;
    S.item(y - 5000, (g) => {
      P.setInk(w);
      WA.rrect(g, x - w / 2, y - h * 1.1, w, h * 1.05, 8, c1);
      WA.rrect(g, x - w / 2, y - h * 0.5, w, h * 0.12, 0, c2, 0.01, true);
      g.save();
      g.beginPath();
      g.rect(x - w / 2, y - h * 1.1, w, h * 1.05);
      g.clip();
      g.fillStyle = c2;
      g.fillRect(x - w / 2, y - h * 1.1, w, h * 0.12);
      g.fillRect(x - w / 2, y - h * 0.34, w, h * 0.1);
      g.restore();
      WA.rrect(g, x - w / 2, y - h * 1.1, w, h * 1.05, 8, null);
      for (const dx of [-0.38, 0.38]) {
        WA.circ(g, x + w * dx, y - h * 0.08, h * 0.17, '#2a2a30', WA.ink * 1.3);
        WA.circ(g, x + w * dx, y - h * 0.08, h * 0.08, '#c9ced4', WA.ink);
      }
    });
    const n = 5;
    for (let i = 0; i < n; i++) {
      const wx = x - w / 2 + w * 0.12 + i * (w * 0.76 / (n - 1));
      for (let j = 0; j < 1 + (r() < 0.6 ? 1 : 0); j++) {
        const e = S.person(wx + j * 12 - 6, y - h * 0.46, h * 0.5, { p: { pose: r.pick(['wave', 'stand', 'cheer', 'stand']), clipBelow: -40 } });
        e.sortKey = y - 4999;
        e.keep = false;
      }
    }
    S.item(y - 4998, (g) => {
      P.setInk(w);
      const n2 = 5;
      for (let i = 0; i < n2; i++) {
        const wx = x - w / 2 + w * 0.12 + i * (w * 0.76 / (n2 - 1));
        // window frame around the passengers
        WA.rrect(g, wx - w * 0.07, y - h * 0.98, w * 0.14, h * 0.5, 6, null, WA.ink * 1.4);
        WA.rrect(g, wx - w * 0.08, y - h * 0.5, w * 0.16, h * 0.06, 2, c2, WA.ink);
      }
    });
  }

  T.station = {
    id: 'station', W: 3200, H: 2000, seed: 7707, hide: 0.8,
    outfit: {
      tops: [['solid', 24], ['jacket', 12], ['hstripe', 9], ['vstripe', 5], ['plaid', 8], ['dots', 4], ['logo', 6], ['suit', 6], ['band', 3]],
      hats: [['none', 46], ['cap', 8], ['top', 3], ['sun', 3], ['bobble', 2.4], ['beanie', 3], ['cowboy', 2], ['fez', 1], ['hood', 2], ['straw', 3], ['sailor', 1]],
      oddP: 0.1,
      costumes: [['sailor', 4], ['explorer', 3], ['chef', 1.5], ['cowboy', 2], ['king', 0.8], ['astronaut', 1.2], ['clown', 1], ['pirate', 1.5], ['scientist', 1.5], ['knight', 0.8], ['santa', 0.6]],
      props: [null, 40, ['suitcase', 14], ['bag', 6], ['umbrella', 2.4], ['book', 2], ['camera', 2], ['map', 2], ['mug', 2], ['flag', 1], ['cane', 1.6], ['popcorn', 0.6], ['bouquet', 1.4], ['phone', 1]],
      poses: WA.POSE_COMMON,
    },
    bg(S) {
      const { g, W, H, r } = S;
      // glass roof
      let gr = g.createLinearGradient(0, 0, 0, 420);
      gr.addColorStop(0, '#9fd3ee');
      gr.addColorStop(1, '#e9f6fb');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 420);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(i * 90, 0); g.lineTo(i * 90 + 60, 420); g.stroke(); }
      // iron arches
      for (let i = 0; i < 6; i++) {
        const cx = 270 + i * 530;
        g.beginPath();
        g.moveTo(cx - 265, 440);
        g.quadraticCurveTo(cx, -120, cx + 265, 440);
        g.lineWidth = 16;
        g.strokeStyle = WA.INK;
        g.stroke();
        g.lineWidth = 9;
        g.strokeStyle = '#3f6a58';
        g.stroke();
        for (let k = 0; k < 7; k++) {
          const t = (k + 1) / 8;
          const xx = lerp(cx - 265, cx + 265, t), yy = 440 - Math.sin(t * Math.PI) * 330;
          WA.line(g, xx, yy, xx, 440, 3, '#3f6a58');
        }
      }
      // back wall (brick)
      g.fillStyle = '#d99a6c';
      g.fillRect(0, 380, W, 160);
      g.strokeStyle = 'rgba(100,40,20,0.35)';
      g.lineWidth = 2;
      for (let y = 380; y < 540; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i = 0; i < 40; i++) WA.rrect(g, 40 + i * 78, 420, 46, 96, 22, '#fdeeb0', 3);
      // tracks bed
      g.fillStyle = '#8c8f96';
      g.fillRect(0, 540, W, 280);
      for (let y = 600; y < 800; y += 60) {
        g.fillStyle = '#5b3a1e';
        for (let x = 0; x < W; x += 40) g.fillRect(x, y, 22, 14);
        WA.line(g, 0, y + 4, W, y + 4, 7, '#d3d6dc');
        WA.line(g, 0, y + 18, W, y + 18, 7, '#d3d6dc');
        WA.line(g, 0, y + 4, W, y + 4, 2, WA.INK);
        WA.line(g, 0, y + 18, W, y + 18, 2, WA.INK);
      }
      // platform floor
      g.fillStyle = '#e6d8b8';
      g.fillRect(0, 810, W, H - 810);
      for (let y = 840, row = 0; y < H; y += 40 + (y - 840) * 0.06, row++) {
        for (let x = -((row % 2) * 60); x < W; x += 120) {
          g.fillStyle = ((x / 120 + row) | 0) % 2 ? '#d8c8a0' : '#ede0c2';
          g.fillRect(x, y, 120, 40 + (y - 840) * 0.06);
        }
      }
      g.fillStyle = '#f2c230';
      g.fillRect(0, 806, W, 14);
      for (let x = 0; x < W; x += 60) { g.fillStyle = '#2a2a30'; g.fillRect(x, 806, 30, 14); }
    },
    layout(S) {
      const { g, W, H, r } = S;
      // clock
      S.item(50, (gg) => {
        P.setInk(300);
        WA.circ(gg, 1600, 190, 120, '#fffaf0', 6);
        WA.circ(gg, 1600, 190, 106, null, 3);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          WA.line(gg, 1600 + Math.cos(a) * 88, 190 + Math.sin(a) * 88, 1600 + Math.cos(a) * 102, 190 + Math.sin(a) * 102, 5);
        }
        WA.line(gg, 1600, 190, 1600, 112, 8);
        WA.line(gg, 1600, 190, 1650, 215, 8);
        WA.circ(gg, 1600, 190, 10, '#2a2a30', 2);
      });
      // trains
      const tracks = [630, 750];
      // train 1 (top track): loco + 4 carriages
      const t1y = 665;
      S.item(t1y - 5100, (gg) => loco(gg, 560, t1y, 520, C.red, C.yellow));
      carriage(S, 1180, t1y, 560, C.blue, C.white, 0);
      carriage(S, 1760, t1y, 560, C.red, C.white, 0);
      carriage(S, 2340, t1y, 560, C.green, C.white, 0);
      carriage(S, 2920, t1y, 560, C.yellow, C.red, 0);
      // train 2: bright carriages on the near track
      const t2y = 805;
      carriage(S, 360, t2y, 620, C.white, C.red, 1);
      carriage(S, 1000, t2y, 620, C.orange, C.white, 1);
      carriage(S, 2200, t2y, 620, '#2b8fcf', C.white, 1);
      carriage(S, 2840, t2y, 620, C.purple, C.yellow, 1);
      // steam puffs
      for (let i = 0; i < 6; i++) S.item(5, (gg) => P.cloud(gg, 330 + i * 40, 440 - i * 40, 90 + i * 22, '#f4f4f4'));
      // columns, lamps, signs
      for (let i = 0; i < 9; i++) {
        const x = 150 + i * 370;
        S.item(840, (gg) => {
          P.setInk(300);
          WA.rrect(gg, x - 16, 440, 32, 400, 4, '#3f6a58', 3);
          WA.rrect(gg, x - 26, 826, 52, 28, 4, '#5a8a74', 3);
          WA.rrect(gg, x - 26, 430, 52, 24, 4, '#5a8a74', 3);
        });
      }
      for (let i = 0; i < 12; i++) {
        const x = 90 + i * 270 + r() * 60;
        const col = r.pick(WA.BRIGHT);
        S.item(900, (gg) => {
          P.setInk(200);
          WA.line(gg, x, 900, x, 760, 4, WA.INK);
          WA.rrect(gg, x - 60, 700, 120, 60, 6, '#2a3a50', 3);
          for (let k = 0; k < 3; k++) WA.rrect(gg, x - 50, 712 + k * 16, r.range(40, 90), 8, col, 1.5);
        });
      }
      S.zone({ x0: 30, x1: W - 30, y0: 830, y1: 1130, hh: [72, 92], d: 0.9 });
      S.zone({ x0: 30, x1: W - 30, y0: 1130, y1: 1520, hh: [92, 112], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1520, y1: 1990, hh: [112, 134], d: 0.8 });
      // kiosks with striped awnings, benches, luggage piles, trolleys, flowers
      const pal = [[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.orange, C.white], [C.pink, C.white], [C.purple, C.white]];
      for (let i = 0; i < 12; i++) {
        const x = 200 + r() * (W - 400), y = 1050 + r() * 920, w = lerp(150, 250, (y - 1050) / 920), [a, b] = r.pick(pal);
        S.item(y, (gg) => {
          P.awning(gg, x, y, w, w * 0.95, a, b);
          WA.rrect(gg, x - w * 0.46, y - w * 0.38, w * 0.92, w * 0.38, 4, '#d9a35a', 3);
          for (let j = 0; j < 4; j++) WA.rrect(gg, x - w * 0.34 + j * w * 0.2, y - w * 0.56, w * 0.12, w * 0.16, 3, r.pick(WA.BRIGHT), 2);
        }, { x0: x - w / 2, x1: x + w / 2, y0: y - w * 0.95, y1: y - w * 0.55 });
        S.occupy(x - w / 2, y - w * 0.4, x + w / 2, y, 4);
      }
      for (let i = 0; i < 40; i++) {
        const x = 70 + r() * (W - 140), y = 840 + r() * 1140, w = lerp(60, 110, (y - 840) / 1140), k = r.int(0, 5);
        S.item(y, (gg) => {
          if (k === 0) { P.crate(gg, x, y, w * 0.9, r.pick(['#8a5a2b', '#2b6fd1', '#c43a3a', '#2fa84f'])); P.crate(gg, x + w * 0.1, y - w * 0.72, w * 0.7, '#c88a4a'); }
          else if (k === 1) P.barrel(gg, x, y, w * 0.8);
          else if (k === 2) P.sign(gg, x, y, w * 1.6, '#fffaf0', r.pick(['arrow', 'star']));
          else if (k === 3) P.flowers(gg, x, y, w * 1.4);
          else if (k === 4) P.lamp(gg, x, y, w * 2.2);
          else P.balloons(gg, x, y, w * 1.5, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]);
        });
      }
      for (let i = 0; i < 22; i++) {
        const x = 70 + r() * (W - 140), y = 880 + r() * 1100, w = lerp(50, 90, (y - 880) / 1100), c = r.pick(['#8a5a2b', '#2b6fd1', '#c43a3a', '#2fa84f', '#7b4bb7', '#f28a1e']);
        S.item(y, (gg) => {
          P.setInk(w);
          WA.rrect(gg, x - w * 0.5, y - w * 0.7, w, w * 0.7, 6, c);
          WA.arc(gg, x, y - w * 0.7, w * 0.22, Math.PI, 0, WA.ink * 1.4, WA.INK);
          WA.line(gg, x - w * 0.5, y - w * 0.4, x + w * 0.5, y - w * 0.4, WA.ink * 1.4, WA.shade(c, -0.4));
          WA.rrect(gg, x - 3, y - w * 0.46, 6, 6, 1, '#f2d050', 1.2);
        });
      }
      for (let i = 0; i < 14; i++) {
        const x = 100 + r() * (W - 200), y = 900 + r() * 1080, h = lerp(70, 120, (y - 900) / 1080) * 0.55;
        const nm = r.pick(['dog', 'cat', 'gull', 'bunny', 'monkey', 'parrot']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42']), patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : {}), r.pick([1, -1])));
      }
    },
  };
})();
