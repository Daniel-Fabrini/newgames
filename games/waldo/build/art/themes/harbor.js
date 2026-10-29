// Scene: Pirate harbor.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function sail(g, x, y, w, h, kind, c1, c2, bill = 0.1) {
    P.setInk(w);
    const path = () => {
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x + w / 2, y);
      g.quadraticCurveTo(x + w / 2 + w * bill, y + h * 0.5, x + w * 0.46, y + h);
      g.quadraticCurveTo(x, y + h + h * 0.1, x - w * 0.46, y + h);
      g.quadraticCurveTo(x - w / 2 - w * bill, y + h * 0.5, x - w / 2, y);
      g.closePath();
    };
    if (kind === 'stripes') P.stripedPath(g, path, x - w, y, w * 2, h, c1, c2, 12, 'h');
    else if (kind === 'vstripes') P.stripedPath(g, path, x - w, y, w * 2, h, c1, c2, 14, 'v');
    else {
      path();
      WA.fillInk(g, c1);
    }
    if (kind === 'skull') {
      WA.circ(g, x, y + h * 0.42, w * 0.13, C.white, WA.ink * 0.8);
      WA.rrect(g, x - w * 0.07, y + h * 0.5, w * 0.14, w * 0.06, 2, C.white, WA.ink * 0.8);
      WA.dot(g, x - w * 0.05, y + h * 0.4, w * 0.03);
      WA.dot(g, x + w * 0.05, y + h * 0.4, w * 0.03);
      WA.line(g, x - w * 0.22, y + h * 0.68, x + w * 0.22, y + h * 0.58, WA.ink * 2, C.white);
      WA.line(g, x + w * 0.22, y + h * 0.68, x - w * 0.22, y + h * 0.58, WA.ink * 2, C.white);
    } else if (kind === 'cross') {
      g.save();
      path();
      g.clip();
      g.fillStyle = c2;
      g.fillRect(x - w * 0.07, y, w * 0.14, h * 1.2);
      g.fillRect(x - w, y + h * 0.4, w * 2, h * 0.14);
      g.restore();
      path();
      g.lineWidth = WA.ink;
      g.strokeStyle = WA.INK;
      g.stroke();
    }
    // yard
    WA.line(g, x - w * 0.56, y - 2, x + w * 0.56, y - 2, WA.ink * 3.4, WA.INK);
    WA.line(g, x - w * 0.56, y - 2, x + w * 0.56, y - 2, WA.ink * 1.4, '#8a5a2b');
  }

  // Side-view galleon; bow to the left. (x0,y) = bow tip at deck level; returns deck zones.
  function galleon(S, cx, wl, w, o = {}) {
    const { r } = S;
    const k = w / 1300;
    const L = cx - w / 2, Rr = cx + w / 2;
    const deckY = wl - 240 * k, castleY = wl - 320 * k;
    const hullTop = deckY + 6 * k;
    // masts + sails (behind people) and hull
    S.item(wl - 600, (g) => {
      P.setInk(w);
      // hull
      g.beginPath();
      g.moveTo(L, hullTop - 30 * k);
      g.lineTo(L + (Rr - L) * 0.62, hullTop);
      g.lineTo(L + (Rr - L) * 0.62, castleY + 30 * k);
      g.lineTo(Rr, castleY - 10 * k);
      g.lineTo(Rr + 14 * k, wl - 110 * k);
      g.quadraticCurveTo(Rr - 20 * k, wl + 2, Rr - 200 * k, wl + 4);
      g.lineTo(L + 200 * k, wl + 4);
      g.quadraticCurveTo(L + 30 * k, wl - 50 * k, L, hullTop - 30 * k);
      g.closePath();
      WA.fillInk(g, o.hull || '#9a5a28', WA.ink * 1.6);
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(60,30,10,0.55)';
      g.lineWidth = 1.8;
      for (let yy = hullTop; yy < wl + 4; yy += 22 * k) {
        g.beginPath();
        g.moveTo(L, yy);
        g.lineTo(Rr + 20, yy);
        g.stroke();
      }
      // gold stripe + gunports
      g.fillStyle = '#f2b81c';
      g.fillRect(L, hullTop + 50 * k, w, 14 * k);
      for (let i = 0; i < 9; i++) {
        const px = L + 150 * k + i * 100 * k;
        g.fillStyle = '#2a1b12';
        g.fillRect(px, hullTop + 90 * k, 40 * k, 34 * k);
        g.fillStyle = '#3a3f48';
        g.fillRect(px + 8 * k, hullTop + 100 * k, 40 * k, 14 * k);
        g.fillStyle = '#2a1b12';
        g.fillRect(px + 8 * k, hullTop + 160 * k, 40 * k, 30 * k);
      }
      // stern windows
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#ffe88a';
        g.fillRect(Rr - 150 * k + i * 44 * k, castleY + 70 * k, 30 * k, 40 * k);
        g.strokeStyle = WA.INK;
        g.strokeRect(Rr - 150 * k + i * 44 * k, castleY + 70 * k, 30 * k, 40 * k);
      }
      g.restore();
      // bowsprit
      WA.line(g, L + 10 * k, hullTop - 20 * k, L - 140 * k, hullTop - 120 * k, WA.ink * 5, WA.INK);
      WA.line(g, L + 10 * k, hullTop - 20 * k, L - 140 * k, hullTop - 120 * k, WA.ink * 2.2, '#8a5a2b');
      // masts
      const masts = [L + (Rr - L) * 0.18, L + (Rr - L) * 0.45, L + (Rr - L) * 0.76];
      const tops = [deckY - 380 * k, deckY - 430 * k, deckY - 340 * k];
      masts.forEach((mx, i) => {
        WA.line(g, mx, deckY, mx, tops[i], WA.ink * 8, WA.INK);
        WA.line(g, mx, deckY, mx, tops[i], WA.ink * 4, '#8a5a2b');
      });
      // sails (over masts)
      const kinds = o.sails || [['stripes', C.red, C.white], ['cross', C.cream, C.red], ['vstripes', C.blue, C.white], ['skull', '#2a2a30', C.white], ['stripes', C.yellow, C.white], ['cross', C.white, C.blue]];
      masts.forEach((mx, i) => {
        const [kd, a, b] = kinds[(i * 2) % kinds.length];
        const [kd2, a2, b2] = kinds[(i * 2 + 1) % kinds.length];
        const top = tops[i];
        const mh = deckY - top;
        sail(g, mx, top + mh * 0.07, (i === 1 ? 250 : 210) * k, mh * 0.33, kd2, a2, b2);
        sail(g, mx, top + mh * 0.43, (i === 1 ? 340 : 290) * k, mh * 0.5, kd, a, b, 0.09);
        // crow's nest
        WA.rrect(g, mx - 22 * k, top - 8 * k, 44 * k, 26 * k, 4, '#8a5a2b', WA.ink * 1.2);
        P.flagpole(g, mx, top - 8 * k, 60 * k, r.pick([C.red, '#2a2a30', C.yellow]), C.white, r() < 0.4);
      });
      // rigging lines
      g.lineWidth = Math.max(1.4, 2.2 * k);
      g.strokeStyle = 'rgba(40,24,12,0.8)';
      masts.forEach((mx, i) => {
        for (const d of [-1, 1]) for (let j = 0; j < 3; j++) {
          g.beginPath();
          g.moveTo(mx, tops[i] + 40 * k + j * 12 * k);
          g.lineTo(mx + d * (150 + j * 26) * k, deckY);
          g.stroke();
        }
      });
      g.beginPath();
      g.moveTo(masts[0], tops[0]);
      g.lineTo(L - 140 * k, hullTop - 120 * k);
      g.stroke();
    });
    // rail in front of deck persons
    S.item(deckY + 44 * k, (g) => {
      P.setInk(w);
      const x0 = L + 10 * k, x1 = L + (Rr - L) * 0.62;
      WA.rrect(g, x0, deckY + 18 * k, x1 - x0, 28 * k, 3, '#b87a3a', WA.ink * 1.4);
      for (let x = x0 + 14 * k; x < x1; x += 26 * k) WA.line(g, x, deckY + 18 * k, x, deckY + 44 * k, WA.ink * 1.4, '#6a3d1e');
      // castle front
      const cx0 = x1, cx1 = Rr;
      WA.rrect(g, cx0, castleY + 20 * k, cx1 - cx0, 34 * k, 3, '#b87a3a', WA.ink * 1.4);
    });
    // people
    S.zone({ x0: L + 40 * k, x1: L + (Rr - L) * 0.6, y0: deckY - 4 * k, y1: deckY + 12 * k, hh: [64, 70], n: Math.round(26 * k * 1.3), target: true, outfit: { oddP: 0.5 } });
    S.zone({ x0: L + (Rr - L) * 0.66, x1: Rr - 30 * k, y0: castleY - 4 * k, y1: castleY + 6 * k, hh: [62, 66], n: Math.round(12 * k * 1.3), outfit: { oddP: 0.5 } });
    // people on ratlines / yards
    const masts = [L + (Rr - L) * 0.18, L + (Rr - L) * 0.45, L + (Rr - L) * 0.76];
    masts.forEach((mx, i) => {
      for (let j = 0; j < 7; j++) {
        const yy = deckY - 330 * k + r() * 260 * k;
        const xx = mx + (r() < 0.5 ? -1 : 1) * r.range(18, 140) * k;
        const e = S.person(xx, yy, 56 * k + 8, { p: { pose: r.pick(['cheer', 'wave', 'stand', 'hold2']) } });
        e.keep = false;
      }
    });
  }

  T.harbor = {
    id: 'harbor', W: 3200, H: 2000, seed: 2202, hide: 0.8,
    outfit: {
      tops: [['solid', 28], ['hstripe', 12], ['vstripe', 6], ['plaid', 7], ['jacket', 8], ['dots', 4], ['logo', 3], ['band', 4]],
      hats: [['none', 44], ['cap', 8], ['bandana', 7], ['pirate', 5], ['straw', 3], ['sailor', 4], ['beanie', 4], ['bobble', 2.5], ['top', 1]],
      oddP: 0.32,
      costumes: [['pirate', 10], ['sailor', 5], ['knight', 0.6], ['chef', 1.4], ['king', 0.8], ['viking', 1.6], ['clown', 0.8], ['cowboy', 1], ['explorer', 1.2], ['santa', 0.4], ['wizardish', 0.8], ['hero', 0.6]],
      props: [null, 55, ['sword', 5], ['flag', 2], ['mug', 4], ['bag', 3], ['map', 2], ['camera', 0.8], ['torch', 1.4], ['bouquet', 0.4], ['popcorn', 0.8], ['book', 1], ['cane', 1.2]],
      poses: WA.POSE_COMMON,
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 330);
      gr.addColorStop(0, '#ffb86b');
      gr.addColorStop(1, '#ffe9b0');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 340);
      WA.circ(g, 2500, 170, 70, '#fff3a0', 3);
      for (let i = 0; i < 8; i++) P.cloud(g, 150 + i * 420 + r() * 120, 60 + r() * 130, 190 + r() * 120, '#fff7e6');
      // sea
      gr = g.createLinearGradient(0, 300, 0, 780);
      gr.addColorStop(0, '#2a8fb4');
      gr.addColorStop(1, '#4fc1c9');
      g.fillStyle = gr;
      g.fillRect(0, 300, W, 490);
      for (let i = 0; i < 1100; i++) {
        const y = 320 + r() * 440;
        P.ripple(g, r() * W, y, lerp(20, 50, (y - 300) / 450), r() < 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(20,90,140,0.4)');
      }
      // far coast hills + town
      g.beginPath();
      g.moveTo(0, 330);
      g.quadraticCurveTo(250, 200, 600, 300);
      g.lineTo(600, 340);
      g.lineTo(0, 340);
      g.closePath();
      WA.fillInk(g, '#4f9a4f', 3);
      for (let i = 0; i < 6; i++) P.house(g, 60 + i * 80, 300 - (i % 2) * 14, 56, 40, r.pick(['#f2c98a', '#fff', '#f2a0a0']), r.pick([C.red, C.blue, '#8a5a2b']));
      // dock floor
      g.fillStyle = '#c99a5b';
      g.fillRect(0, 780, W, H - 780);
      for (let y = 800; y < H; y += 34 + (y - 800) * 0.02) {
        g.strokeStyle = 'rgba(80,45,15,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        for (let x = r() * 200; x < W; x += 180 + r() * 260) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 34);
          g.stroke();
        }
      }
      // dock edge
      g.fillStyle = '#8a5a2b';
      g.fillRect(0, 770, W, 18);
      for (let x = 20; x < W; x += 140) WA.rrect(g, x, 770, 20, 60, 4, '#6a3d1e', 2);
    },
    layout(S) {
      const { g, W, H, r } = S;
      // ships
      galleon(S, 1250, 740, 1300);
      galleon(S, 2650, 740, 800, { sails: [['cross', C.cream, C.red], ['stripes', C.red, C.white], ['skull', '#2a2a30', C.white], ['vstripes', C.green, C.white]] });
      // far small boats
      [[200, 400, 140], [700, 430, 120], [2150, 470, 100], [3050, 420, 130]].forEach(([x, y, w], i) => S.item(y, (gg) => P.sailboat(gg, x, y, w, i % 2 ? C.white : C.cream, i ? C.red : C.blue)));
      // sea creatures + barrels
      const creature = (name, x, y, h, v, flip = 1) => S.item(y, (gg) => {
        WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[name](g2, v), flip);
        P.ripple(gg, x - h * 0.2, y - 2, h * 0.9);
        P.ripple(gg, x + h * 0.3, y - 1, h * 0.7);
      });
      const gapX = () => r.pick([[60, 560], [1960, 2240], [3080, 3160]]).reduce((a, b) => a + r() * (b - a) * 0 + 0, 0);
      const gx = () => { const q = r.pick([[60, 560], [60, 560], [1960, 2250], [3070, 3170]]); return q[0] + r() * (q[1] - q[0]); };
      for (let i = 0; i < 7; i++) creature(r.pick(['octopus', 'monster', 'fish', 'fish']), gx(), 540 + r() * 220, 80 + r() * 50, { body: r.pick(['#3aa36b', '#7b4bb7', '#e8478a', '#f28a1e']), eyes: r.pick([1, 2, 3]), horns: r() < 0.5, grumpy: r() < 0.6 }, r.pick([1, -1]));
      S.item(740, (gg) => {
        // shark fins
        for (const [x, y] of [[480, 650], [2020, 720], [2950, 640]]) {
          WA.poly(gg, [[x, y], [x + 30, y - 60], [x + 60, y]], '#7f8fa0', 3);
          P.ripple(gg, x + 30, y + 2, 90);
        }
      });
      for (let i = 0; i < 14; i++) {
        const x = gx(), y = 340 + r() * 420;
        const k = r.int(0, 2);
        S.item(y, (gg) => (k === 0 ? P.barrel(gg, x, y, 36) : k === 1 ? P.buoy(gg, x, y, 30) : P.floatDuck(gg, x, y, 50)));
      }
      S.zone({ x0: 40, x1: 580, y0: 480, y1: 770, hh: [52, 62], water: true, waterLine: 36, d: 0.5, outfit: { sleeves: [['none', 100]] }, target: false });
      S.zone({ x0: 1960, x1: 2250, y0: 500, y1: 770, hh: [52, 62], water: true, waterLine: 36, d: 0.5, outfit: { sleeves: [['none', 100]] }, target: false });
      // rowboats with pirates
      for (let i = 0; i < 6; i++) {
        const x = gx(), y = 560 + r() * 190, w = 130 + r() * 50;
        S.item(y - 1, (gg) => P.rowboat(gg, x, y, w, '#b9722f', '#6a3d1e', 'back'));
        for (let j = 0; j < 2; j++) S.person(x + (j - 0.5) * w * 0.34, y + w * 0.05, w * 0.5, { water: true, waterLine: 30, p: { pose: 'sit' } });
        S.item(y + w * 0.06, (gg) => P.rowboat(gg, x, y, w, '#b9722f', '#6a3d1e', 'front'));
      }
      // --- dock
      S.zone({ x0: 30, x1: W - 30, y0: 810, y1: 1130, hh: [72, 88], d: 0.9 });
      S.zone({ x0: 30, x1: W - 30, y0: 1130, y1: 1560, hh: [88, 108], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1560, y1: 1990, hh: [108, 132], d: 0.8 });
      // taverns / warehouses at the back-left and right
      [[220, 1010, 280, 190, '#e8b27a', C.red], [3000, 1000, 300, 200, '#c9d8e8', C.blue], [2200, 990, 220, 170, '#f2c98a', C.green]].forEach(([x, y, w, h, wall, roof], i) => {
        S.item(y, (gg) => {
          P.house(gg, x, y, w, h, wall, roof, { roofStripes: i === 1 ? C.white : null });
          // barrel sign
          P.barrel(gg, x + w * 0.62, y + 4, 40);
        }, { x0: x - w / 2, x1: x + w / 2, y0: y - h - w * 0.3, y1: y });
        S.occupy(x - w / 2, y - h, x + w / 2, y, 6);
      });
      // cranes / lamp posts / flags
      for (let i = 0; i < 8; i++) {
        const x = 150 + i * 400 + r() * 100;
        S.item(830, (gg) => P.lamp(gg, x, 830, 220));
      }
      for (let i = 0; i < 4; i++) {
        const x = 300 + i * 800 + r() * 200, y = 900 + r() * 100;
        S.item(y, (gg) => P.flagpole(gg, x, y, 320, r.pick([C.red, '#2a2a30', C.blue]), C.white, r() < 0.5));
      }
      // stalls with striped awnings
      for (let i = 0; i < 8; i++) {
        const x = 200 + r() * (W - 400), y = 1250 + r() * 600, w = 200 + r() * 70;
        const [a, b] = r.pick([[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.orange, C.white]]);
        S.item(y, (gg) => {
          P.awning(gg, x, y, w, 180, a, b);
          WA.rrect(gg, x - w * 0.46, y - 68, w * 0.92, 68, 4, '#b87a3a', 3);
          for (let j = 0; j < 5; j++) WA.circ(gg, x - w * 0.36 + j * w * 0.18, y - 78, 12, r.pick(['#e5352b', '#f9d71c', '#f28a1e', '#2fa84f']), 2);
        }, { x0: x - w / 2, x1: x + w / 2, y0: y - 180, y1: y - 100 });
        S.occupy(x - w / 2, y - 60, x + w / 2, y, 4);
      }
      // barrels, crates, cannons, chests, anchors, ropes
      for (let i = 0; i < 110; i++) {
        const x = 60 + r() * (W - 120), y = 830 + r() * 1150, w = lerp(48, 90, (y - 830) / 1150) * r.range(0.85, 1.2), k = r.int(0, 8);
        S.item(y, (gg) => {
          if (k <= 1) P.barrel(gg, x, y, w);
          else if (k === 2 || k === 3) P.crate(gg, x, y, w);
          else if (k === 4) P.cannon(gg, x, y, w * 1.6, r.pick([1, -1]));
          else if (k === 5) P.chest(gg, x, y, w * 1.1);
          else if (k === 6) P.anchor(gg, x, y, w * 1.4);
          else if (k === 7) { P.crate(gg, x, y, w); P.crate(gg, x + w * 0.1, y - w * 0.8, w * 0.8, '#d9a35a'); }
          else P.sign(gg, x, y, w * 1.4, '#fffaf0', r.pick(['arrow', 'star', 'fish']));
        });
      }
      for (let i = 0; i < 20; i++) {
        const x = 80 + r() * (W - 160), y = 900 + r() * 1080, h = lerp(70, 120, (y - 900) / 1080);
        const nm = r.pick(['dog', 'cat', 'gull', 'parrot', 'monkey', 'crab', 'parrot']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 0.55, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42', '#e8c27a']), patch: '#8a5a2b', collar: r.pick([C.blue, C.green, null]) } : {}), r.pick([1, -1])));
      }
    },
  };
})();
