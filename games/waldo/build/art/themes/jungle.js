// Scene: Jungle ruins.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function leaf(g, x, y, w, h, rot, c) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    P.setInk(w);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(w * 0.1, -h * 0.5, w * 0.6, -h * 0.55, w, 0);
    g.bezierCurveTo(w * 0.6, h * 0.5, w * 0.1, h * 0.5, 0, 0);
    WA.fillInk(g, c, WA.ink * 1.1);
    WA.line(g, 0, 0, w * 0.95, 0, WA.ink * 0.9, WA.shade(c, -0.35));
    for (let i = 1; i < 5; i++) {
      WA.line(g, w * i * 0.18, 0, w * i * 0.18 + w * 0.1, -h * 0.3, WA.ink * 0.6, WA.shade(c, -0.3));
      WA.line(g, w * i * 0.18, 0, w * i * 0.18 + w * 0.1, h * 0.3, WA.ink * 0.6, WA.shade(c, -0.3));
    }
    g.restore();
  }
  function jtree(g, x, y, h, c) {
    P.setInk(h);
    g.beginPath();
    g.moveTo(x - h * 0.05, y);
    g.quadraticCurveTo(x - h * 0.03, y - h * 0.5, x - h * 0.04, y - h * 0.82);
    g.lineTo(x + h * 0.04, y - h * 0.82);
    g.quadraticCurveTo(x + h * 0.03, y - h * 0.5, x + h * 0.06, y);
    g.closePath();
    WA.fillInk(g, '#7a4f2a');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      leaf(g, x, y - h * 0.82, h * 0.34, h * 0.18, a, i % 2 ? c : WA.shade(c, 0.12));
    }
    // vines
    for (let i = 0; i < 3; i++) {
      const vx = x - h * 0.18 + i * h * 0.18;
      g.beginPath();
      g.moveTo(vx, y - h * 0.8);
      g.bezierCurveTo(vx + 20, y - h * 0.6, vx - 20, y - h * 0.4, vx + 6, y - h * (0.3 + i * 0.05));
      g.lineWidth = WA.ink * 2;
      g.strokeStyle = '#1f6a2a';
      g.stroke();
    }
  }

  T.jungle = {
    id: 'jungle', W: 3200, H: 2000, seed: 9909, hide: 0.8,
    outfit: {
      tops: [['solid', 22], ['plaid', 14], ['hstripe', 9], ['jacket', 8], ['vstripe', 4], ['dots', 4], ['logo', 6], ['band', 3]],
      colors: ['#e5352b', '#f9d71c', '#2b6fd1', '#2fa84f', '#f28a1e', '#f28ab2', '#7b4bb7', '#18a5a5', '#fffaf0', '#c9b17a', '#8a7a4a', '#9cd13a', '#e8478a'],
      hats: [['none', 32], ['straw', 10], ['hard', 6], ['cap', 8], ['bandana', 6], ['bobble', 3], ['beanie', 2], ['cowboy', 4], ['sun', 4], ['headband', 3], ['flower', 2]],
      oddP: 0.2,
      costumes: [['explorer', 9], ['pirate', 1.5], ['scientist', 2], ['cowboy', 2], ['chef', 1], ['clown', 1], ['wizardish', 1], ['king', 0.6], ['sailor', 1], ['hero', 1]],
      props: [null, 38, ['binocs', 4], ['map', 4], ['camera', 4], ['torch', 3], ['book', 2], ['bag', 3], ['flag', 2], ['mug', 2], ['cane', 1.4], ['pitchfork', 1], ['net', 0], ['bouquet', 0.8]],
      bottoms: [['shorts', 40], ['pants', 40], ['skirt', 8], ['dress', 6]],
      poses: WA.POSE_COMMON,
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 300);
      gr.addColorStop(0, '#bfe9a8');
      gr.addColorStop(1, '#8fd08a');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 320);
      // foliage wall
      g.fillStyle = '#2f9a4a';
      g.fillRect(0, 120, W, 760);
      for (let i = 0; i < 260; i++) {
        const x = r() * W, y = 60 + r() * 760;
        leaf(g, x, y, 150 + r() * 200, 60 + r() * 60, r() * Math.PI * 2, r.pick(['#2f9a4a', '#3fb25a', '#25833f', '#58c26a', '#1f7a3a']));
      }
      // floor
      g.fillStyle = '#9a7a45';
      g.fillRect(0, 860, W, H - 860);
      for (let i = 0; i < 110; i++) {
        const x = r() * W, y = 880 + r() * (H - 880), w = 140 + r() * 280;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.12, 0, 0, 7);
        g.fillStyle = r() < 0.5 ? '#86a456' : '#b08c52';
        g.fill();
      }
      for (let i = 0; i < 1300; i++) {
        g.fillStyle = r() < 0.5 ? '#7a5a30' : '#c9a468';
        g.beginPath();
        g.arc(r() * W, 870 + r() * (H - 870), 1.5 + r() * 2.5, 0, 7);
        g.fill();
      }
      // river
      g.beginPath();
      g.moveTo(0, 1010);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, 1010 + Math.sin(x * 0.006) * 36);
      for (let x = W; x >= 0; x -= 40) g.lineTo(x, 1150 + Math.sin(x * 0.006 + 0.5) * 36);
      g.closePath();
      g.fillStyle = '#3aa8c8';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = WA.INK;
      g.stroke();
      for (let i = 0; i < 160; i++) P.ripple(g, r() * W, 1030 + r() * 120, 34, r() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(20,80,130,0.4)');
    },
    layout(S) {
      const { g, W, H, r } = S;
      // temple tiers
      const tiers = 6, tH = 96, baseY = 860, w0 = 1500;
      for (let i = 0; i < tiers; i++) {
        const top = baseY - (tiers - i) * tH; // top surface y of tier i (i=0 highest)
        const w = w0 - (tiers - 1 - i) * 0 - (i === 0 ? 0 : 0);
        const ww = 560 + i * 190;
        const cx = 1600;
        S.item(top - 1, (gg) => {
          P.setInk(400);
          WA.rrect(gg, cx - ww / 2, top, ww, tH + 4, 4, '#c0b48a', WA.ink * 1.4);
          gg.save();
          gg.beginPath();
          gg.rect(cx - ww / 2, top, ww, tH + 4);
          gg.clip();
          gg.strokeStyle = 'rgba(70,60,30,0.5)';
          gg.lineWidth = 2;
          for (let x = cx - ww / 2; x < cx + ww / 2; x += 60) { gg.beginPath(); gg.moveTo(x, top); gg.lineTo(x, top + tH); gg.stroke(); }
          gg.beginPath(); gg.moveTo(cx - ww / 2, top + 50); gg.lineTo(cx + ww / 2, top + 50); gg.stroke();
          // moss
          for (let k = 0; k < 12; k++) WA.circ(gg, cx - ww / 2 + r() * ww, top + r() * 20, 10 + r() * 14, '#5fae4a', 0);
          // carved faces
          for (let x = cx - ww / 2 + 110; x < cx + ww / 2 - 60; x += 220) {
            WA.circ(gg, x, top + 56, 24, '#a89c70', WA.ink);
            WA.dot(gg, x - 8, top + 52, 3.5);
            WA.dot(gg, x + 8, top + 52, 3.5);
            WA.rrect(gg, x - 10, top + 62, 20, 6, 2, '#5a4a28', 0.01, true);
          }
          gg.restore();
          // ledge strip
          WA.rrect(gg, cx - ww / 2 - 10, top - 14, ww + 20, 22, 4, '#d6caa0', WA.ink * 1.2);
        });
        if (i > 0) S.zone({ x0: cx - ww / 2 + 20, x1: cx + ww / 2 - 20, y0: top - 6, y1: top + 4, hh: [58, 62], n: Math.round(ww / 66), outfit: { oddP: 0.3 } });
      }
      // shrine on top
      S.item(baseY - tiers * tH - 4, (gg) => {
        P.setInk(300);
        const top = baseY - tiers * tH;
        WA.rrect(gg, 1430, top - 190, 340, 190, 6, '#d6caa0', 3);
        WA.rrect(gg, 1395, top - 220, 410, 40, 4, '#c0b48a', 3);
        gg.beginPath();
        gg.moveTo(1520, top);
        gg.lineTo(1520, top - 110);
        gg.quadraticCurveTo(1600, top - 170, 1680, top - 110);
        gg.lineTo(1680, top);
        gg.closePath();
        WA.fillInk(gg, '#2a2230', 3);
        WA.circ(gg, 1600, top - 70, 26, '#f2b81c', 3);
        WA.line(gg, 1600, top - 220, 1600, top - 330, 5);
        WA.poly(gg, [[1600, top - 330], [1680, top - 305], [1600, top - 280]], C.red, 3);
      });
      // stairs
      S.item(baseY + 20, (gg) => {
        P.setInk(300);
        gg.beginPath();
        gg.moveTo(1500, baseY - tiers * tH + 8);
        gg.lineTo(1700, baseY - tiers * tH + 8);
        gg.lineTo(1800, baseY + 14);
        gg.lineTo(1400, baseY + 14);
        gg.closePath();
        WA.fillInk(gg, '#dcd2aa', 3);
        for (let k = 1; k < 30; k++) {
          const t = k / 30;
          WA.line(gg, lerp(1500, 1400, t), lerp(baseY - tiers * tH + 8, baseY + 14, t), lerp(1700, 1800, t), lerp(baseY - tiers * tH + 8, baseY + 14, t), 1.8, '#a89c70');
        }
      });
      S.zone({ x0: 1450, x1: 1750, y0: 420, y1: 850, hh: [52, 62], n: 38, outfit: { oddP: 0.3 }, K: 3 });
      // big trees at the sides + hanging vines/leaves
      for (let i = 0; i < 12; i++) {
        const x = (i < 6 ? 80 + i * 150 : 2300 + (i - 6) * 150) + r() * 60, y = 780 + r() * 120, h = 520 + r() * 220;
        S.item(y, (gg) => jtree(gg, x, y, h, r.pick(['#2f9a4a', '#3fb25a', '#25833f'])), { x0: x - 120, x1: x + 120, y0: y - h, y1: y - h * 0.5 });
      }
      // crowd zones
      S.zone({ x0: 30, x1: W - 30, y0: 880, y1: 1000, hh: [66, 74], d: 1.0 });
      S.zone({ x0: 30, x1: W - 30, y0: 1160, y1: 1480, hh: [88, 106], d: 1.05 });
      S.zone({ x0: 30, x1: W - 30, y0: 1480, y1: 1990, hh: [106, 134], d: 1.0 });
      // river life + bridge
      const creature = (name, x, y, h, v, flip = 1) => S.item(y, (gg) => {
        WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[name](g2, v), flip);
        P.ripple(gg, x - h * 0.2, y - 2, h * 0.9);
      });
      for (let i = 0; i < 8; i++) creature(r.pick(['fish', 'monster', 'octopus', 'snake']), 100 + r() * (W - 200), 1040 + r() * 100, 70 + r() * 30, { body: r.pick(['#3aa36b', '#7b4bb7', '#e8478a', '#f28a1e']), eyes: r.pick([1, 2, 3]), horns: r() < 0.5, grumpy: true }, r.pick([1, -1]));
      S.item(1100, (gg) => {
        P.setInk(300);
        WA.line(gg, 500, 1020, 2700, 1020, 4);
        WA.line(gg, 500, 1150, 2700, 1150, 4);
        gg.fillStyle = '#b8864a';
        for (let x = 500; x < 2700; x += 34) { WA.rrect(gg, x, 1060, 28, 60, 3, '#c8965a', 2); }
        WA.line(gg, 500, 1042, 2700, 1042, 6);
        WA.line(gg, 500, 1128, 2700, 1128, 6);
      });
      S.zone({ x0: 520, x1: 2680, y0: 1080, y1: 1118, hh: [60, 68], n: 56, outfit: { oddP: 0.3 }, target: false });
      // tents, huts, totems, rocks, bushes, flowers, campfires, crates
      const pal = [['#c9b17a', C.white], [C.red, C.white], [C.green, C.white], [C.orange, C.white], [C.blue, C.white], ['#8a9a4a', C.yellow]];
      for (let i = 0; i < 10; i++) {
        const x = 150 + r() * (W - 300), y = 1220 + r() * 740, w = lerp(150, 240, (y - 1220) / 740), [a, b] = r.pick(pal);
        S.item(y, (gg) => P.tent(gg, x, y, w, w * 0.8, a, b, { flagC: r.pick(WA.BRIGHT) }), { x0: x - w * 0.3, x1: x + w * 0.3, y0: y - w * 0.8, y1: y - w * 0.4 });
        S.occupy(x - w * 0.5, y - w * 0.5, x + w * 0.5, y, 4);
      }
      for (let i = 0; i < 70; i++) {
        const x = 70 + r() * (W - 140), y = 880 + r() * 1100, w = lerp(52, 110, (y - 880) / 1100), k = r.int(0, 8);
        if (y > 1000 && y < 1170) continue;
        S.item(y, (gg) => {
          if (k === 0) P.rock(gg, x, y, w * 1.3, '#9a9a8a');
          else if (k === 1 || k === 2) P.bush(gg, x, y, w * 1.6, r.pick(['#2f9a4a', '#3fb25a']), r.pick([C.red, C.yellow, C.pink, C.white]));
          else if (k === 3) P.flowers(gg, x, y, w * 1.5, [C.red, C.yellow, C.pink, C.orange]);
          else if (k === 4) P.crate(gg, x, y, w * 0.9);
          else if (k === 5) P.barrel(gg, x, y, w * 0.8);
          else if (k === 6) P.sign(gg, x, y, w * 1.6, '#fffaf0', r.pick(['arrow', 'star']));
          else leaf(gg, x, y, w * 1.4, w * 0.6, r.range(-0.6, 0.6) - Math.PI / 2, '#3fb25a');
        });
      }
      for (let i = 0; i < 24; i++) {
        const x = 80 + r() * (W - 160), y = 900 + r() * 1090, h = lerp(70, 130, (y - 900) / 1090);
        if (y > 1000 && y < 1170) continue;
        const nm = r.pick(['monkey', 'monkey', 'parrot', 'parrot', 'snake', 'cat', 'bunny', 'dog']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 0.6, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: '#c98a4a', patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : nm === 'parrot' ? { body: r.pick([C.red, C.green, C.blue, C.yellow]), tail: r.pick([C.blue, C.red]), wing: r.pick([C.yellow, C.orange]) } : nm === 'cat' ? { body: '#e69a45' } : {}), r.pick([1, -1])));
      }
      for (let i = 0; i < 3; i++) {
        const x = 300 + r() * (W - 600), y = 1300 + r() * 650, h = lerp(120, 200, (y - 1300) / 650);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => WA.CREATURES.elephant(g2, { body: '#9a9fae' }), r.pick([1, -1])), { x0: x - h * 0.6, x1: x + h * 0.6, y0: y - h, y1: y - h * 0.2 });
      }
    },
  };
})();
