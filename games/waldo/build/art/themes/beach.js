// Scene: Beach & sea.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  T.beach = {
    id: 'beach', W: 3200, H: 2000, seed: 1101, hide: 0.7,
    outfit: {
      tops: [['swim', 36], ['solid', 16], ['hstripe', 9], ['dots', 8], ['vstripe', 4], ['logo', 6], ['plaid', 2], ['band', 3]],
      sleeves: [['none', 62], ['short', 30], ['long', 8]],
      bottoms: [['trunks', 34], ['shorts', 30], ['dress', 6], ['skirt', 6], ['pants', 8]],
      hats: [['none', 55], ['sun', 8], ['straw', 8], ['cap', 8], ['bandana', 4], ['swimcap', 3], ['bobble', 1.2], ['beanie', 1], ['flower', 1.2], ['headband', 1.5]],
      glasses: 0.3,
      props: [null, 60, ['ball', 3], ['icecream', 3], ['surfboard', 2], ['bag', 2], ['camera', 1.5], ['umbrella', 2.2], ['bouquet', 0.5], ['popcorn', 1], ['flag', 1], ['bucket', 2], ['shovel', 1.5], ['mug', 1]],
      poses: ['stand', 'stand', 'stand2', 'walk', 'walk', 'walk2', 'wave', 'cheer', 'point', 'hip', 'dance', 'run', 'hold2', 'kick'],
      fixup(p, r) {
        if (p.top.pat === 'swim') {
          p.top.c = p.skin;
          if (p.hairS === 'long' || p.hairS === 'bob' || p.hairS === 'ponytail' || p.hairS === 'pigtails' || p.hairS === 'braid') p.top.bikini = r.pick(WA.BRIGHT);
        }
        if (p.bottom.t === 'trunks') p.bottom.c = r.pick(WA.BRIGHT);
        if (p.top.pat === 'dress') p.top.pat = 'solid';
      },
    },
    bg(S) {
      const { g, W, H, r } = S;
      // sky
      let gr = g.createLinearGradient(0, 0, 0, 260);
      gr.addColorStop(0, '#7fcbf0');
      gr.addColorStop(1, '#c6ecfa');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 270);
      // sea
      gr = g.createLinearGradient(0, 250, 0, 900);
      gr.addColorStop(0, '#2f8fd0');
      gr.addColorStop(0.5, '#4fb6e2');
      gr.addColorStop(1, '#8fdcee');
      g.fillStyle = gr;
      g.fillRect(0, 250, W, 700);
      // shallow strip + sand
      gr = g.createLinearGradient(0, 860, 0, 1000);
      gr.addColorStop(0, '#a9ebe6');
      gr.addColorStop(1, '#f6e3a8');
      g.fillStyle = gr;
      g.fillRect(0, 860, W, 140);
      g.fillStyle = '#f3d98f';
      g.fillRect(0, 1000, W, H - 1000);
      // sand speckles
      for (let i = 0; i < 2600; i++) {
        const x = r() * W, y = 1000 + r() * (H - 1000);
        g.fillStyle = r() < 0.5 ? '#dfbd6a' : '#fff0c0';
        g.beginPath();
        g.arc(x, y, 1.5 + r() * 2.2, 0, 7);
        g.fill();
      }
      // wet-sand line
      g.beginPath();
      g.moveTo(0, 1000);
      for (let x = 0; x <= W; x += 80) g.lineTo(x, 1000 + Math.sin(x * 0.011) * 14);
      g.lineTo(W, 1030);
      g.lineTo(0, 1030);
      g.closePath();
      g.fillStyle = '#e8c97a';
      g.fill();
      // ripples
      for (let i = 0; i < 1800; i++) {
        const y = 270 + r() * 650;
        P.ripple(g, r() * W, y, lerp(18, 44, (y - 250) / 650), r() < 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(30,110,190,0.45)');
      }
      // foam lines
      for (let k = 0; k < 4; k++) {
        const y = 880 + k * 30;
        g.beginPath();
        for (let x = 0; x <= W; x += 20) {
          const yy = y + Math.sin(x * 0.02 + k) * 8;
          x ? g.lineTo(x, yy) : g.moveTo(x, yy);
        }
        g.lineWidth = 5;
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.stroke();
      }
      // clouds + sun
      WA.circ(g, 2800, 110, 60, '#ffe14a', 3);
      for (let i = 0; i < 9; i++) P.cloud(g, 150 + i * 350 + r() * 120, 60 + r() * 130, 160 + r() * 140);
      // far headland + lighthouse (top right)
      g.beginPath();
      g.moveTo(2250, 262);
      g.quadraticCurveTo(2500, 120, 2800, 200);
      g.quadraticCurveTo(3050, 160, 3200, 240);
      g.lineTo(3200, 270);
      g.lineTo(2250, 270);
      g.closePath();
      WA.fillInk(g, '#5ea65a', 3);
      P.house(g, 2560, 230, 70, 46, '#f2c98a', C.red);
      P.house(g, 2660, 228, 54, 40, '#fff', C.blue);
    },
    layout(S) {
      const { g, W, H, r } = S;
      const sea = { y0: 280, y1: 940 };
      // --- sky: kites, balloons, planes, birds
      for (let i = 0; i < 9; i++) {
        const x = 150 + r() * (W - 300), y = 40 + r() * 150;
        S.item(y, (gg) => P.kite(gg, x, y, 36 + r() * 24, r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)));
      }
      S.item(120, (gg) => P.hotAirBalloon(gg, 700, 190, 90, C.red, C.white));
      S.item(120, (gg) => P.hotAirBalloon(gg, 1850, 170, 70, C.blue, C.yellow));
      S.item(100, (gg) => P.plane(gg, 1300, 90, 140, C.white, C.red));
      for (let i = 0; i < 12; i++) {
        const x = r() * W, y = 80 + r() * 150;
        S.item(y, (gg) => WA.sprite(gg, x, y, 30, WA.CREATURES.gull, r.pick([1, -1])));
      }
      // --- far boats + island
      const boats = [[300, 330, 120], [900, 360, 140], [1500, 320, 100], [2050, 350, 130], [2750, 380, 110], [600, 450, 150], [1900, 470, 160], [1200, 520, 120]];
      boats.forEach(([x, y, w], i) => {
        S.item(y, (gg) => P.sailboat(gg, x, y, w, i % 2 ? C.white : C.yellow, i % 3 === 0 ? C.red : C.blue));
        S.occupy(x - w / 2, y - w * 1.1, x + w / 2, y, 2);
      });
      // --- sea zones: swimmers (far to near)
      S.zone({ x0: 30, x1: W - 30, y0: 300, y1: 480, hh: [34, 44], water: true, waterLine: 38, d: 0.85, outfit: { sleeves: [['none', 100]] } });
      S.zone({ x0: 30, x1: W - 30, y0: 480, y1: 700, hh: [44, 58], water: true, waterLine: 38, d: 0.9, outfit: { sleeves: [['none', 100]] } });
      S.zone({ x0: 30, x1: W - 30, y0: 700, y1: 930, hh: [58, 72], water: true, waterLine: 36, d: 0.9, outfit: { sleeves: [['none', 100]] } });
      // sea creatures, floats, rowboats with people
      const creature = (name, x, y, h, v, flip = 1) => S.item(y, (gg) => {
        WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[name](g2, v), flip);
        P.ripple(gg, x - h * 0.2, y - 2, h * 0.9);
        P.ripple(gg, x + h * 0.3, y - 1, h * 0.7);
      });
      for (let i = 0; i < 9; i++) creature(r.pick(['octopus', 'monster']), 150 + r() * (W - 300), 400 + r() * 480, 70 + r() * 40, { body: r.pick(['#3aa36b', '#7b4bb7', '#e8478a', '#f28a1e', '#18a5a5']), eyes: r.pick([1, 2, 3]), horns: r() < 0.5, grumpy: r() < 0.4 }, r.pick([1, -1]));
      for (let i = 0; i < 16; i++) creature('fish', 80 + r() * (W - 160), 330 + r() * 560, 26 + r() * 14, { body: r.pick(['#f28a1e', '#e8478a', '#f9d71c', '#2fa84f']), stripe: r.pick([C.white, C.blue]) }, r.pick([1, -1]));
      for (let i = 0; i < 6; i++) creature('crab', 80 + r() * (W - 160), 960 + r() * 150, 38, { body: r.pick([C.red, C.orange]) });
      const rowing = (x, y, w, n) => {
        S.item(y - 1, (gg) => P.rowboat(gg, x, y, w, r.pick(['#b9722f', '#e8c37a', '#4a7ac4']), '#6a3d1e', 'back'));
        for (let i = 0; i < n; i++) {
          const px = x + (i - (n - 1) / 2) * w * 0.3;
          const e = S.person(px, y + w * 0.05, w * 0.42, { water: true, waterLine: 30, p: { pose: r.pick(['sit', 'wave', 'cheer', 'sit']) } });
          e.keep = false;
        }
        S.item(y + w * 0.06, (gg) => P.rowboat(gg, x, y, w, '#b9722f', '#6a3d1e', 'front'));
        S.occupy(x - w / 2, y - w * 0.5, x + w / 2, y + 10, 3);
      };
      for (let i = 0; i < 12; i++) rowing(150 + r() * (W - 300), 420 + r() * 480, 110 + r() * 70, r.int(2, 3));
      for (let i = 0; i < 12; i++) {
        const x = 80 + r() * (W - 160), y = 340 + r() * 600;
        const k = r.int(0, 3);
        S.item(y, (gg) => (k === 0 ? P.ring(gg, x, y, 50) : k === 1 ? P.buoy(gg, x, y, 30) : k === 2 ? P.floatDuck(gg, x, y, 60) : P.beachball(gg, x, y, 28, r.pick(WA.BRIGHT))));
      }
      // surfers
      for (let i = 0; i < 5; i++) {
        const x = 200 + r() * (W - 400), y = 560 + r() * 330;
        S.item(y, (gg) => {
          P.surfboard(gg, x, y + 4, 40, r.pick(WA.BRIGHT), C.white, 1.55);
        });
      }
      // pier
      const px0 = 1950, px1 = 2260;
      S.item(1000, (gg) => {
        P.setInk(300);
        WA.rrect(gg, px0, 740, px1 - px0, 260, 6, '#b88a4a');
        for (let x = px0 + 10; x < px1; x += 22) WA.line(gg, x, 745, x, 995, 1.6, '#7a5a2b');
        for (let y = 745; y < 995; y += 32) WA.line(gg, px0, y, px1, y, 2.2, '#7a5a2b');
      }, { x0: px0, y0: 740, x1: px1, y1: 1000 });
      S.item(741, () => {});
      S.zone({ x0: px0 + 20, x1: px1 - 20, y0: 780, y1: 990, hh: [60, 72], d: 0.9 });
      // --- sand
      const sandOut = Object.assign({}, S.theme.outfit);
      S.zone({ x0: 30, x1: W - 30, y0: 1040, y1: 1340, hh: [74, 90], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1340, y1: 1700, hh: [90, 112], d: 0.82 });
      S.zone({ x0: 30, x1: W - 30, y0: 1700, y1: 1990, hh: [112, 132], d: 0.8 });
      // palms along the back of the sand and scattered
      for (let i = 0; i < 12; i++) {
        const x = 100 + i * 270 + r() * 100, y = 1020 + r() * 60, h = 340 + r() * 140;
        S.item(y, (gg) => P.palm(gg, x, y, h, r.range(-0.2, 0.2)), { x0: x - h * 0.4, x1: x + h * 0.4, y0: y - h, y1: y - h * 0.5 });
      }
      for (let i = 0; i < 6; i++) {
        const x = 100 + r() * (W - 200), y = 1500 + r() * 450, h = 400;
        S.item(y, (gg) => P.palm(gg, x, y, h, r.range(-0.25, 0.25)), { x0: x - h * 0.4, x1: x + h * 0.4, y0: y - h, y1: y - h * 0.5 });
      }
      // beach cabins (striped!), tents, lifeguard towers, ice cream cart
      const pal2 = [[C.blue, C.white], [C.red, C.white], [C.yellow, C.white], [C.green, C.white], [C.pink, C.white], [C.orange, C.white], [C.teal, C.yellow]];
      for (let i = 0; i < 9; i++) {
        const x = 130 + i * 340 + r() * 90, y = 1100 + r() * 90, w = 150 + r() * 40, [a, b] = r.pick(pal2);
        S.item(y, (gg) => P.beachCabin(gg, x, y, w, w * 1.25, a, b), { x0: x - w / 2, x1: x + w / 2, y0: y - w * 1.55, y1: y });
        S.occupy(x - w / 2, y - w, x + w / 2, y, 6);
      }
      for (let i = 0; i < 9; i++) {
        const x = 150 + r() * (W - 300), y = 1250 + r() * 600, w = 190 + r() * 80, [a, b] = r.pick(pal2);
        S.item(y, (gg) => P.tent(gg, x, y, w, w * 0.8, a, b), { x0: x - w * 0.3, x1: x + w * 0.3, y0: y - w * 0.8, y1: y - w * 0.3 });
        S.occupy(x - w / 2, y - w * 0.6, x + w / 2, y, 5);
      }
      S.item(1030, (gg) => P.lifeguard(gg, 520, 1040, 120));
      S.item(1030, (gg) => P.lifeguard(gg, 2700, 1040, 120));
      // ice cream cart with awning
      S.item(1560, (gg) => {
        P.awning(gg, 1000, 1560, 220, 200, C.red, C.white);
        WA.rrect(gg, 905, 1470, 190, 90, 6, C.cream, 3);
        WA.rrect(gg, 905, 1470, 190, 24, 4, C.pink);
      }, { x0: 880, x1: 1120, y0: 1360, y1: 1560 });
      // umbrellas
      const umbCols = [[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.orange, C.white], [C.pink, C.white], [C.purple, C.white], [C.teal, C.yellow], [C.red, C.yellow], [C.navy, C.white], [C.yellow, C.white]];
      for (let i = 0; i < 46; i++) {
        const x = 80 + r() * (W - 160), y = 1090 + r() * 880, w = lerp(150, 230, (y - 1090) / 880) * r.range(0.9, 1.15), [a, b] = r.pick(umbCols);
        S.item(y, (gg) => P.umbrella(gg, x, y, w, a, b, r.range(-0.12, 0.12)), { x0: x - w / 2, x1: x + w / 2, y0: y - w * 0.95, y1: y - w * 0.45 });
        S.occupy(x - w * 0.3, y - w * 0.5, x + w * 0.3, y, 3);
      }
      // ground clutter
      for (let i = 0; i < 70; i++) {
        const x = 80 + r() * (W - 160), y = 1070 + r() * 900, w = lerp(70, 120, (y - 1070) / 900) * r.range(0.85, 1.2), [a, b] = r.pick(umbCols), k = r.int(0, 6);
        S.item(y - 4, (gg) => {
          if (k === 0 || k === 1) P.towel(gg, x, y, w, a, b);
          else if (k === 2) P.beachball(gg, x, y, w * 0.38, a);
          else if (k === 3) P.sandcastle(gg, x, y, w * 0.9);
          else if (k === 4) P.sunbed(gg, x, y, w * 1.2, a, b);
          else P.surfboard(gg, x, y, w * 1.1, a, b, r.range(-0.2, 0.2));
        });
      }
      for (let i = 0; i < 20; i++) {
        const x = 80 + r() * (W - 160), y = 1090 + r() * 880, h = lerp(70, 120, (y - 1090) / 880);
        const nm = r.pick(['dog', 'cat', 'gull', 'bunny', 'monkey', 'crab']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 0.5, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42', '#e8c27a']), patch: '#8a5a2b', collar: r.pick([C.blue, C.green, null]) } : {}), r.pick([1, -1])));
      }
      // sunbathers lying on towels
      for (let i = 0; i < 24; i++) {
        const x = 120 + r() * (W - 240), y = 1120 + r() * 800, h = lerp(70, 110, (y - 1120) / 800);
        const [a, b] = r.pick(umbCols);
        S.item(y - 3, (gg) => P.towel(gg, x + h * 0.1, y + h * 0.08, h * 1.0, a, b, h * 0.42));
        S.person(x, y, h, { lie: r.pick([1, -1]), p: { pose: 'stand', prop: null, hat: r.chance(0.5) ? { t: 'sun', c: r.pick(WA.BRIGHT), c2: C.white } : null } });
        S.occupy(x - h * 0.5, y - h * 0.5, x + h * 0.5, y, 2);
      }
    },
    fg(S) {},
  };
})();
