// Scene: Medieval castle siege.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function bricks(g, x0, y0, x1, y1, c, bh = 26, bw = 54) {
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.strokeStyle = WA.shade(c, -0.28);
    g.lineWidth = 2;
    let row = 0;
    for (let y = y0; y < y1; y += bh, row++) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
      for (let x = x0 + (row % 2) * bw * 0.5; x < x1; x += bw) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + bh);
        g.stroke();
      }
    }
    g.restore();
  }
  function tower(g, x, base, w, h, stone, roofA, roofB, pennant) {
    P.setInk(w);
    WA.rrect(g, x - w / 2, base - h, w, h, 3, stone);
    bricks(g, x - w / 2, base - h, x + w / 2, base, stone);
    // projecting top
    WA.rrect(g, x - w * 0.58, base - h - 18, w * 1.16, 26, 4, WA.shade(stone, 0.08));
    // windows
    for (let i = 0; i < 3; i++) {
      const wy = base - h * 0.78 + i * h * 0.22;
      WA.rrect(g, x - 10, wy, 20, 38, 10, '#2a2230', WA.ink * 1.2);
    }
    const roof = () => {
      g.beginPath();
      g.moveTo(x - w * 0.66, base - h - 14);
      g.lineTo(x, base - h - w * 0.95);
      g.lineTo(x + w * 0.66, base - h - 14);
      g.closePath();
    };
    P.stripedPath(g, roof, x - w * 0.7, base - h - w, w * 1.4, w, roofA, roofB, 12, 'v');
    P.flagpole(g, x, base - h - w * 0.95, 90, pennant || C.red, C.white, false);
  }
  function wall(g, x0, x1, top, base, stone) {
    P.setInk(300);
    WA.rrect(g, x0, top, x1 - x0, base - top, 2, stone);
    bricks(g, x0, top, x1, base, stone);
  }
  function catapult(g, x, y, w, flip = 1) {
    P.setInk(w);
    g.save();
    g.translate(x, y);
    g.scale(flip, 1);
    WA.rrect(g, -w * 0.5, -w * 0.18, w, w * 0.14, 3, '#8a5a2b');
    WA.line(g, -w * 0.4, -w * 0.18, -w * 0.1, -w * 0.62, WA.ink * 5, WA.INK);
    WA.line(g, -w * 0.4, -w * 0.18, -w * 0.1, -w * 0.62, WA.ink * 2.4, '#a8672f');
    WA.line(g, w * 0.4, -w * 0.18, w * 0.1, -w * 0.62, WA.ink * 5, WA.INK);
    WA.line(g, w * 0.4, -w * 0.18, w * 0.1, -w * 0.62, WA.ink * 2.4, '#a8672f');
    WA.line(g, -w * 0.28, -w * 0.4, w * 0.5, -w * 0.78, WA.ink * 5, WA.INK);
    WA.line(g, -w * 0.28, -w * 0.4, w * 0.5, -w * 0.78, WA.ink * 2.4, '#c88a4a');
    WA.circ(g, w * 0.54, -w * 0.8, w * 0.1, '#6a6f78');
    WA.circ(g, -w * 0.36, -w * 0.04, w * 0.14, '#8a5a2b');
    WA.circ(g, w * 0.36, -w * 0.04, w * 0.14, '#8a5a2b');
    WA.circ(g, -w * 0.36, -w * 0.04, w * 0.05, '#5b3a1e', WA.ink);
    WA.circ(g, w * 0.36, -w * 0.04, w * 0.05, '#5b3a1e', WA.ink);
    g.restore();
  }
  function siegeTower(S, x, base, w, h) {
    const { r } = S;
    S.item(base - 150, (g) => {
      P.setInk(w);
      WA.rrect(g, x - w / 2, base - h, w, h, 3, '#a8672f');
      g.save();
      g.beginPath();
      g.rect(x - w / 2, base - h, w, h);
      g.clip();
      g.strokeStyle = 'rgba(60,30,10,0.6)';
      g.lineWidth = 2;
      for (let yy = base - h; yy < base; yy += 20) {
        g.beginPath();
        g.moveTo(x - w / 2, yy);
        g.lineTo(x + w / 2, yy);
        g.stroke();
      }
      g.restore();
      // openings on 3 levels
      for (let i = 0; i < 3; i++) WA.rrect(g, x - w * 0.36, base - h * 0.88 + i * h * 0.3, w * 0.72, h * 0.18, 4, '#3a2418', WA.ink * 1.3);
      WA.circ(g, x - w * 0.34, base + 2, 22, '#6a3d1e');
      WA.circ(g, x + w * 0.34, base + 2, 22, '#6a3d1e');
      const roof = () => {
        g.beginPath();
        g.moveTo(x - w * 0.6, base - h);
        g.lineTo(x, base - h - w * 0.5);
        g.lineTo(x + w * 0.6, base - h);
        g.closePath();
      };
      P.stripedPath(g, roof, x - w * 0.6, base - h - w * 0.5, w * 1.2, w * 0.5, C.red, C.white, 8, 'v');
    });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const px = x + (j - 0.5) * w * 0.34, py = base - h * 0.88 + i * h * 0.3 + h * 0.18;
        const e = S.person(px, py, 50, { p: { pose: r.pick(['cheer', 'wave', 'hold2']), clipBelow: -20 } });
        e.sortKey = base - 149;
        e.keep = false;
      }
    }
    S.item(base - 148, (g) => {
      for (let i = 0; i < 3; i++) WA.rrect(g, x - w * 0.36, base - h * 0.88 + i * h * 0.3 + h * 0.13, w * 0.72, h * 0.06, 2, '#a8672f', WA.ink * 1.2);
    });
  }

  T.castle = {
    id: 'castle', W: 3200, H: 2000, seed: 4404, hide: 0.8,
    outfit: {
      tops: [['solid', 22], ['hstripe', 9], ['vstripe', 5], ['plaid', 7], ['jacket', 10], ['dots', 3], ['armor', 5], ['band', 4], ['apron', 3]],
      colors: ['#e5352b', '#f9d71c', '#2b6fd1', '#2fa84f', '#f28a1e', '#7b4bb7', '#fffaf0', '#233a7a', '#8a5a2b', '#9cd13a', '#2a2a30', '#c43a3a'],
      hats: [['none', 40], ['cap', 5], ['hood', 6], ['bobble', 3], ['beanie', 3], ['helmet', 6], ['straw', 3], ['cowboy', 1], ['viking', 1.5], ['bandana', 2], ['crown', 0.4], ['top', 0.4]],
      oddP: 0.34,
      costumes: [['knight', 12], ['viking', 3], ['king', 1.4], ['wizardish', 2], ['pirate', 1.4], ['chef', 1.4], ['cowboy', 1], ['clown', 0.8], ['hero', 0.8], ['explorer', 1]],
      props: [null, 42, ['sword', 8], ['shield', 7], ['flag', 6], ['torch', 3], ['mug', 2], ['cane', 1.2], ['pitchfork', 2.4], ['bag', 1.6], ['map', 1], ['bouquet', 0.4], ['trumpet', 1.2], ['drum', 1]],
      poses: ['stand', 'stand', 'stand2', 'walk', 'walk2', 'wave', 'cheer', 'point', 'hip', 'run', 'dance', 'hold2', 'kick', 'hold'],
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 450);
      gr.addColorStop(0, '#5fb4ec');
      gr.addColorStop(1, '#d6f0fb');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 460);
      for (let i = 0; i < 9; i++) P.cloud(g, 100 + i * 380 + r() * 120, 40 + r() * 140, 200 + r() * 120);
      // distant mountains
      g.beginPath();
      g.moveTo(0, 440);
      for (let x = 0; x <= W; x += 80) g.lineTo(x, 300 + Math.abs(Math.sin(x * 0.0035)) * 120 - Math.sin(x * 0.011) * 25);
      g.lineTo(W, 460);
      g.lineTo(0, 460);
      g.closePath();
      WA.fillInk(g, '#8aa9d8', 3);
      // meadow
      g.fillStyle = '#a6d874';
      g.fillRect(0, 450, W, 260);
      for (let i = 0; i < 40; i++) {
        const x = r() * W, y = 480 + r() * 220;
        WA.circ(g, x, y, 14 + r() * 20, i % 2 ? '#8cc65c' : '#b7e386', 0);
      }
      g.fillStyle = '#86c85c';
      g.fillRect(0, 700, W, H - 700);
      for (let i = 0; i < 90; i++) {
        const x = r() * W, y = 760 + r() * (H - 760), w = 120 + r() * 240;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.12, 0, 0, 7);
        g.fillStyle = r() < 0.5 ? '#74b84e' : '#9dd66c';
        g.fill();
      }
      for (let i = 0; i < 700; i++) {
        const x = r() * W, y = 740 + r() * (H - 740);
        WA.line(g, x, y, x - 3, y - 10, 2.2, '#3f8a38');
        WA.line(g, x, y, x + 4, y - 9, 2.2, '#3f8a38');
      }
      // moat
      g.fillStyle = '#4aa8d8';
      g.fillRect(0, 760, W, 90);
      for (let i = 0; i < 160; i++) P.ripple(g, r() * W, 770 + r() * 70, 36, r() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(20,90,150,0.4)');
      g.fillStyle = '#c9a56a';
      g.fillRect(0, 848, W, 12);
      g.fillStyle = '#8f7f57';
      g.fillRect(0, 752, W, 10);
    },
    layout(S) {
      const { g, W, H, r } = S;
      const stone = '#c3bfb2';
      // sky: dragons, arrows
      S.item(150, (gg) => WA.sprite(gg, 520, 330, 220, (g2) => WA.CREATURES.dragon(g2, { body: '#3aa36b', wing: C.red, fire: true }), 1));
      S.item(150, (gg) => WA.sprite(gg, 2780, 300, 190, (g2) => WA.CREATURES.dragon(g2, { body: '#7b4bb7', wing: C.yellow, spike: C.orange, fire: true }), -1));
      for (let i = 0; i < 9; i++) {
        const x = 80 + r() * (W - 160), y = 60 + r() * 150;
        S.item(y, (gg) => WA.sprite(gg, x, y, 30, WA.CREATURES.gull, r.pick([1, -1])));
      }
      // castle
      S.item(300, (g) => {
        wall(g, 520, 2680, 420, 760, stone);
        // keep
        wall(g, 1350, 1850, 110, 760, '#d3cebf');
        // crenels on keep + big windows
        for (let i = 0; i < 4; i++) WA.rrect(g, 1420 + i * 112, 190, 52, 90, 26, '#2a2230', 2);
        for (let i = 0; i < 4; i++) WA.rrect(g, 1420 + i * 112, 360, 52, 90, 26, '#2a2230', 2);
        WA.circ(g, 1600, 560, 56, '#e8d9a0', 3);
        // keep roof as striped cone
        const roof = () => {
          g.beginPath();
          g.moveTo(1320, 112);
          g.lineTo(1600, -80);
          g.lineTo(1880, 112);
          g.closePath();
        };
        P.stripedPath(g, roof, 1320, -80, 560, 192, C.blue, C.white, 14, 'v');
        P.flagpole(g, 1600, -78, 150, C.red, C.yellow, false);
        tower(g, 700, 760, 190, 520, stone, C.red, C.white, C.yellow);
        tower(g, 1130, 760, 150, 420, stone, C.blue, C.white, C.red);
        tower(g, 2070, 760, 150, 420, stone, C.green, C.white, C.red);
        tower(g, 2500, 760, 190, 520, stone, C.red, C.white, C.blue);
        // gate
        g.beginPath();
        g.moveTo(1480, 760);
        g.lineTo(1480, 620);
        g.quadraticCurveTo(1600, 520, 1720, 620);
        g.lineTo(1720, 760);
        g.closePath();
        WA.fillInk(g, '#2a2230', 3);
        for (let x = 1500; x < 1720; x += 24) WA.line(g, x, 560, x, 760, 3, '#6a6f78');
        for (let y = 600; y < 760; y += 32) WA.line(g, 1482, y, 1718, y, 3, '#6a6f78');
        // banners on the wall
        for (const [bx, c1, c2] in {}) { }
      });
      for (const [bx, c1, c2] of [[900, C.red, C.yellow], [1000, C.blue, C.white], [2200, C.green, C.white], [2300, C.purple, C.yellow], [1250, C.yellow, C.red], [1950, C.red, C.white]]) {
        S.item(305, (g) => {
          P.setInk(100);
          g.beginPath();
          g.moveTo(bx - 28, 480);
          g.lineTo(bx + 28, 480);
          g.lineTo(bx + 28, 640);
          g.lineTo(bx, 610);
          g.lineTo(bx - 28, 640);
          g.closePath();
          WA.stripes(g, bx - 28, 480, 56, 160, c1, c2, 6, 'h');
          g.beginPath();
          g.moveTo(bx - 28, 480);
          g.lineTo(bx + 28, 480);
          g.lineTo(bx + 28, 640);
          g.lineTo(bx, 610);
          g.lineTo(bx - 28, 640);
          g.closePath();
          g.lineWidth = WA.ink;
          g.strokeStyle = WA.INK;
          g.stroke();
        });
      }
      // rampart people (behind merlons)
      S.zone({ x0: 560, x1: 1260, y0: 436, y1: 450, hh: [58, 62], n: 22, outfit: { oddP: 0.6 } });
      S.zone({ x0: 1900, x1: 2640, y0: 436, y1: 450, hh: [58, 62], n: 22, outfit: { oddP: 0.6 } });
      S.zone({ x0: 1380, x1: 1830, y0: 96, y1: 108, hh: [58, 62], n: 7, outfit: { oddP: 0.6 } });
      S.item(452, (g) => {
        P.setInk(100);
        for (let x = 530; x < 2680; x += 70) {
          if (x > 1330 && x < 1850) continue;
          WA.rrect(g, x, 410, 44, 50, 3, stone, WA.ink * 1.3);
        }
        for (let x = 1360; x < 1850; x += 70) WA.rrect(g, x, 82, 44, 50, 3, '#d3cebf', WA.ink * 1.3);
      });
      // gate people in towers' windows are skipped; drawbridge
      S.item(860, (g) => {
        P.setInk(200);
        g.beginPath();
        g.moveTo(1480, 760);
        g.lineTo(1720, 760);
        g.lineTo(1780, 870);
        g.lineTo(1420, 870);
        g.closePath();
        WA.fillInk(g, '#a8672f', 3);
        for (let i = 1; i < 6; i++) WA.line(g, 1480 - i * 10, 760 + i * 20, 1720 + i * 10, 760 + i * 20, 2, '#6a3d1e');
        WA.line(g, 1480, 760, 1470, 560, 4, WA.INK);
        WA.line(g, 1720, 760, 1730, 560, 4, WA.INK);
      });
      S.zone({ x0: 1450, x1: 1750, y0: 790, y1: 860, hh: [60, 66], n: 14, outfit: { oddP: 0.5 } });
      // moat creatures + swimmers
      const creature = (name, x, y, h, v, flip = 1) => S.item(y, (gg) => {
        WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[name](g2, v), flip);
        P.ripple(gg, x - h * 0.2, y - 2, h * 0.9);
      });
      for (let i = 0; i < 6; i++) creature(r.pick(['octopus', 'monster', 'fish']), r.pick([r.range(60, 1380), r.range(1790, 3140)]), 800 + r() * 50, 70 + r() * 30, { body: r.pick(['#3aa36b', '#7b4bb7', '#e8478a']), eyes: r.pick([1, 2, 3]), horns: r() < 0.6, grumpy: true }, r.pick([1, -1]));
      S.zone({ x0: 40, x1: 1400, y0: 790, y1: 850, hh: [50, 56], water: true, waterLine: 36, d: 0.7, outfit: { sleeves: [['none', 100]] }, target: false });
      S.zone({ x0: 1800, x1: 3160, y0: 790, y1: 850, hh: [50, 56], water: true, waterLine: 36, d: 0.7, outfit: { sleeves: [['none', 100]] }, target: false });
      // siege towers + ladders with climbers
      siegeTower(S, 960, 1010, 170, 420);
      siegeTower(S, 2260, 1010, 170, 420);
      for (const lx of [610, 1290, 1910, 2600]) {
        S.item(800, (g) => P.ladder(g, lx, 880, 450, 30));
        for (let j = 0; j < 4; j++) {
          const e = S.person(lx + r.range(-6, 6), 840 - j * 100, 56, { p: { pose: r.pick(['cheer', 'hold2', 'wave']) } });
          e.sortKey = 801;
          e.keep = false;
        }
      }
      // battlefield zones
      S.zone({ x0: 30, x1: W - 30, y0: 880, y1: 1180, hh: [66, 80], d: 0.9 });
      S.zone({ x0: 30, x1: W - 30, y0: 1180, y1: 1560, hh: [80, 102], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1560, y1: 1990, hh: [102, 130], d: 0.8 });
      // catapults, tents, trees, banners, horses
      for (let i = 0; i < 6; i++) {
        const x = 150 + r() * (W - 300), y = 950 + r() * 950, w = lerp(150, 260, (y - 950) / 950);
        S.item(y, (g) => catapult(g, x, y, w, r.pick([1, -1])), { x0: x - w * 0.5, x1: x + w * 0.5, y0: y - w * 0.8, y1: y - w * 0.4 });
      }
      const pal = [[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.purple, C.white], [C.orange, C.white]];
      for (let i = 0; i < 14; i++) {
        const x = 150 + r() * (W - 300), y = 1050 + r() * 920, w = lerp(150, 250, (y - 1050) / 920), [a, b] = r.pick(pal);
        S.item(y, (g) => P.tent(g, x, y, w, w * 0.8, a, b, { flagC: r.pick(WA.BRIGHT) }), { x0: x - w * 0.3, x1: x + w * 0.3, y0: y - w * 0.8, y1: y - w * 0.4 });
        S.occupy(x - w * 0.5, y - w * 0.5, x + w * 0.5, y, 4);
      }
      for (let i = 0; i < 9; i++) {
        const x = 80 + r() * (W - 160), y = 920 + r() * 1050, h = lerp(150, 250, (y - 920) / 1050);
        S.item(y, (g) => P.tree(g, x, y, h, r.pick(['#3f9a3f', '#4aa84a', '#2f8a4a'])), { x0: x - h * 0.25, x1: x + h * 0.25, y0: y - h, y1: y - h * 0.5 });
      }
      for (let i = 0; i < 14; i++) {
        const x = 100 + r() * (W - 200), y = 950 + r() * 1000;
        S.item(y, (g) => P.flagpole(g, x, y, lerp(180, 300, (y - 950) / 1000), r.pick(WA.BRIGHT), r.pick([C.white, C.yellow]), r() < 0.5));
      }
      for (let i = 0; i < 70; i++) {
        const x = 70 + r() * (W - 140), y = 900 + r() * 1080, w = lerp(52, 100, (y - 900) / 1080), k = r.int(0, 6);
        S.item(y, (g) => {
          if (k === 0 || k === 1) P.barrel(g, x, y, w);
          else if (k === 2) P.crate(g, x, y, w);
          else if (k === 3) P.rock(g, x, y, w * 1.3);
          else if (k === 4) P.bush(g, x, y, w * 1.5, '#2f9a4a', r.pick([C.red, C.yellow, C.pink]));
          else P.flowers(g, x, y, w * 1.4);
        });
      }
      for (let i = 0; i < 16; i++) {
        const x = 100 + r() * (W - 200), y = 950 + r() * 1000, h = lerp(120, 220, (y - 950) / 1000) * 0.8;
        const nm = r.pick(['horse', 'horse', 'sheep', 'dog', 'cat', 'bunny']);
        S.item(y, (g) => WA.sprite(g, x, y, nm === 'horse' ? h : h * 0.5, (g2) => WA.CREATURES[nm](g2, nm === 'horse' ? { body: r.pick(['#f6f1e4', '#a8672f', '#2a2a30', '#c98a4a']), saddle: r.pick([C.red, C.blue]) } : nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42']), patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : {}), r.pick([1, -1])));
      }
    },
  };
})();
