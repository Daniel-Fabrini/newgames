// Scene: Ski slope.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function chalet(g, x, y, w, h, wall = '#b8793a', roofC = '#f4f8fb') {
    P.setInk(w);
    WA.rrect(g, x - w / 2, y - h, w, h, 3, wall);
    g.save();
    g.beginPath();
    g.rect(x - w / 2, y - h, w, h);
    g.clip();
    g.strokeStyle = 'rgba(70,35,10,0.55)';
    g.lineWidth = 2;
    for (let yy = y - h + 14; yy < y; yy += 14) {
      g.beginPath();
      g.moveTo(x - w / 2, yy);
      g.lineTo(x + w / 2, yy);
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < 2; i++) {
      WA.rrect(g, x - w * 0.34 + i * w * 0.46, y - h * 0.7, w * 0.22, h * 0.3, 3, '#ffe88a', WA.ink * 1.2);
      WA.line(g, x - w * 0.23 + i * w * 0.46, y - h * 0.7, x - w * 0.23 + i * w * 0.46, y - h * 0.4, WA.ink);
    }
    WA.rrect(g, x - w * 0.09, y - h * 0.46, w * 0.18, h * 0.46, 3, '#5b3a1e', WA.ink * 1.2);
    // snowy roof
    WA.poly(g, [[x - w * 0.62, y - h + 4], [x, y - h - w * 0.4], [x + w * 0.62, y - h + 4]], '#a8383a', WA.ink * 1.6);
    g.beginPath();
    g.moveTo(x - w * 0.66, y - h + 8);
    g.lineTo(x - w * 0.12, y - h - w * 0.32);
    g.lineTo(x + w * 0.12, y - h - w * 0.32);
    g.lineTo(x + w * 0.66, y - h + 8);
    g.quadraticCurveTo(x + w * 0.4, y - h - 6, x + w * 0.2, y - h + 8);
    g.quadraticCurveTo(x, y - h - 8, x - w * 0.2, y - h + 6);
    g.quadraticCurveTo(x - w * 0.4, y - h - 4, x - w * 0.66, y - h + 8);
    WA.fillInk(g, roofC);
    WA.rrect(g, x + w * 0.22, y - h - w * 0.34, w * 0.1, w * 0.2, 2, '#8a8f98');
  }
  function igloo(g, x, y, w) {
    P.setInk(w);
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.bezierCurveTo(x - w / 2, y - w * 0.8, x + w / 2, y - w * 0.8, x + w / 2, y);
    g.closePath();
    WA.fillInk(g, '#f4f8fb');
    g.save();
    g.clip();
    g.strokeStyle = '#9ab8d0';
    g.lineWidth = 1.8;
    for (let k = 1; k < 5; k++) {
      g.beginPath();
      g.moveTo(x - w / 2, y - k * w * 0.13);
      g.lineTo(x + w / 2, y - k * w * 0.13);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    g.moveTo(x - w * 0.13, y);
    g.lineTo(x - w * 0.13, y - w * 0.14);
    g.quadraticCurveTo(x, y - w * 0.3, x + w * 0.13, y - w * 0.14);
    g.lineTo(x + w * 0.13, y);
    g.closePath();
    WA.fillInk(g, '#2a3a50');
  }
  function mountain(g, x, base, w, h, snow = true) {
    g.beginPath();
    g.moveTo(x - w / 2, base);
    g.lineTo(x - w * 0.08, base - h);
    g.lineTo(x + w * 0.05, base - h * 0.97);
    g.lineTo(x + w / 2, base);
    g.closePath();
    WA.fillInk(g, '#7e93b8', 3);
    if (snow) {
      g.beginPath();
      g.moveTo(x - w * 0.08, base - h);
      g.lineTo(x + w * 0.05, base - h * 0.97);
      g.lineTo(x + w * 0.19, base - h * 0.66);
      g.lineTo(x + w * 0.1, base - h * 0.72);
      g.lineTo(x + w * 0.03, base - h * 0.62);
      g.lineTo(x - w * 0.05, base - h * 0.72);
      g.lineTo(x - w * 0.12, base - h * 0.64);
      g.lineTo(x - w * 0.2, base - h * 0.68);
      g.closePath();
      WA.fillInk(g, '#ffffff', 3);
    }
  }

  T.ski = {
    id: 'ski', W: 3200, H: 2000, seed: 6606, hide: 0.8,
    outfit: {
      tops: [['solid', 24], ['jacket', 20], ['hstripe', 10], ['diag', 6], ['dots', 4], ['vstripe', 5], ['plaid', 4], ['logo', 4]],
      colors: ['#e5352b', '#f9d71c', '#2b6fd1', '#2fa84f', '#f28a1e', '#f28ab2', '#7b4bb7', '#18a5a5', '#fffaf0', '#233a7a', '#9cd13a', '#e8478a', '#2a2a30'],
      hats: [['none', 20], ['beanie', 20], ['bobble', 15], ['hood', 8], ['headphones', 6], ['cap', 6], ['headband', 5], ['helmet', 6], ['bandana', 2], ['santa', 1]],
      oddP: 0.08,
      costumes: [['scarfskier', 10], ['santa', 1.2], ['astronaut', 1.2], ['hero', 1.6], ['clown', 1], ['viking', 1.5], ['explorer', 1], ['wizardish', 0.8], ['king', 0.5]],
      props: [null, 40, ['skipole', 14], ['flag', 2], ['mug', 4], ['camera', 3], ['icecream', 0.4], ['bag', 3], ['sign', 1], ['lollipop', 0.6], ['balloons', 1]],
      sleeves: [['long', 92], ['short', 8]],
      bottoms: [['pants', 90], ['skirt', 5], ['shorts', 5]],
      glasses: 0.34,
      poses: ['stand', 'stand', 'stand2', 'walk', 'walk2', 'walk', 'wave', 'cheer', 'hip', 'dance', 'run', 'hold2'],
      fixup(p, r) {
        if (r() < 0.38) p.skis = r.pick(['#d8462c', '#2b6fd1', '#2a2a30', '#f9d71c', '#2fa84f']);
        if (p.skis && !['stand', 'stand2', 'walk', 'run', 'walk2'].includes(p.pose)) p.pose = 'stand2';
        if (p.skis && r() < 0.6) { p.prop = 'skipole'; p.pose = 'stand2'; }
        if (p.glasses === 'sun' || p.glasses === 'square') p.glasses = r.pick(['goggles', 'sun', 'goggles']);
        p.shoe = r.pick(['#2a2a30', '#8a2f2f', '#2b4a86', '#f9d71c']);
      },
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 500);
      gr.addColorStop(0, '#6fb8ee');
      gr.addColorStop(1, '#d9f0fb');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 520);
      for (let i = 0; i < 8; i++) P.cloud(g, 100 + i * 420 + r() * 120, 40 + r() * 100, 200 + r() * 100);
      for (const [x, b, w, h] of [[300, 480, 900, 360], [1000, 480, 1100, 440], [1900, 480, 1000, 380], [2700, 480, 1000, 420], [100, 500, 600, 240], [1500, 500, 800, 280], [3100, 500, 600, 260]]) mountain(g, x, b, w, h);
      // pine forest band at the foot of the mountains
      for (let i = 0; i < 140; i++) {
        const x = r() * W, y = 430 + r() * 60, h = 60 + r() * 50;
        P.pine(g, x, y, h, r() < 0.5 ? '#1f8a4c' : '#2a9a5a', r() < 0.6);
      }
      // snow field
      g.fillStyle = '#f6fafd';
      g.fillRect(0, 470, W, H - 470);
      for (let i = 0; i < 90; i++) {
        const x = r() * W, y = 520 + r() * (H - 520), w = 160 + r() * 340;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.1, 0, 0, 7);
        g.fillStyle = r() < 0.55 ? '#dcebf6' : '#ffffff';
        g.fill();
      }
      g.strokeStyle = '#c3d9ea';
      g.lineWidth = 3;
      for (let i = 0; i < 120; i++) {
        let x = r() * W, y = 480 + r() * (H - 480);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += 24 + r() * 20; g.lineTo(x, y); }
        g.stroke();
      }
      // frozen pond
      g.beginPath();
      g.ellipse(2500, 1560, 560, 190, 0, 0, Math.PI * 2);
      g.fillStyle = '#bfe6f6';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = WA.INK;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 3;
      for (let i = 0; i < 18; i++) { g.beginPath(); const x = 2100 + r() * 800, y = 1440 + r() * 240; g.moveTo(x, y); g.lineTo(x + 60 + r() * 60, y + (r() - 0.5) * 30); g.stroke(); }
      for (let i = 0; i < 700; i++) {
        g.fillStyle = r() < 0.5 ? '#cfe3f2' : '#ffffff';
        g.beginPath();
        g.arc(r() * W, 500 + r() * (H - 500), 1.6 + r() * 2.2, 0, 7);
        g.fill();
      }
    },
    layout(S) {
      const { g, W, H, r } = S;
      // lift: pylons, cable, chairs with riders
      const cable = (x) => 560 - x * 0.07;
      S.item(500, (gg) => {
        P.setInk(300);
        for (let x = 200; x < W; x += 700) {
          WA.line(gg, x, cable(x) + 280, x, cable(x), 9, WA.INK);
          WA.line(gg, x, cable(x) + 280, x, cable(x), 5, '#6a6f78');
          WA.line(gg, x - 30, cable(x), x + 30, cable(x), 9, WA.INK);
          WA.line(gg, x - 30, cable(x), x + 30, cable(x), 5, '#6a6f78');
        }
        gg.beginPath();
        gg.moveTo(0, cable(0));
        gg.lineTo(W, cable(W));
        gg.lineWidth = 4;
        gg.strokeStyle = WA.INK;
        gg.stroke();
      });
      for (let x = 100; x < W; x += 190) {
        const y = cable(x);
        const e1 = S.person(x - 24, y + 132, 78, { p: { pose: 'sit', prop: null } });
        const e2 = S.person(x + 26, y + 132, 78, { p: { pose: 'sit', prop: null } });
        e1.sortKey = e2.sortKey = 501;
        e1.keep = e2.keep = false;
        S.item(502, (gg) => {
          P.setInk(200);
          WA.line(gg, x, y, x, y + 84, 3, WA.INK);
          WA.rrect(gg, x - 60, y + 98, 120, 14, 4, r.pick([C.red, C.blue, C.green, C.orange]), 2.4);
        });
      }
      for (let i = 0; i < 70; i++) {
        const x = 40 + r() * (W - 80), y = 250 + r() * 220, e = S.person(x, y, 20 + (y - 250) * 0.1, { p: { pose: r.pick(['stand', 'walk', 'wave', 'cheer']), skis: r.pick(['#d8462c', '#2b6fd1', '#2a2a30', '#f9d71c']), prop: null } });
        e.keep = false;
      }
      // chalets + igloos + trees on the far side
      [[260, 700, 240, 150], [800, 690, 200, 130], [1500, 705, 280, 160], [2250, 690, 220, 140], [2900, 700, 260, 150]].forEach(([x, y, w, h], i) => {
        S.item(y, (gg) => chalet(gg, x, y, w, h, r.pick(['#b8793a', '#c98a4a', '#a8672f']), i % 2 ? '#fff' : '#f4f8fb'), { x0: x - w / 2, x1: x + w / 2, y0: y - h - w * 0.4, y1: y });
        S.occupy(x - w / 2, y - h, x + w / 2, y, 6);
      });
      for (const x of [1100, 1900, 2600]) S.item(700, (gg) => igloo(gg, x, 700, 190));
      for (let i = 0; i < 30; i++) {
        const x = 60 + r() * (W - 120), y = 640 + r() * 1300, h = lerp(150, 330, (y - 640) / 1300);
        if (r() < 0.55 && y > 900) continue;
        S.item(y, (gg) => P.pine(gg, x, y, h, '#1f8a4c', true), { x0: x - h * 0.2, x1: x + h * 0.2, y0: y - h, y1: y - h * 0.45 });
      }
      // slalom gates (striped!), flags, signs, snowmen, sleds
      for (let i = 0; i < 24; i++) {
        const x = 100 + r() * (W - 200), y = 800 + r() * 1180, h = lerp(70, 120, (y - 800) / 1180) * 1.5;
        const [a, b] = r.pick([[C.red, C.white], [C.blue, C.white], [C.red, C.white], [C.yellow, C.black]]);
        S.item(y, (gg) => {
          P.setInk(h);
          for (const dx of [-h * 0.5, h * 0.5]) WA.limb(gg, [[x + dx, y], [x + dx, y - h]], 5, '#cfd3d8');
          gg.beginPath();
          gg.rect(x - h * 0.5, y - h, h, h * 0.34);
          WA.stripes(gg, x - h * 0.5, y - h, h, h * 0.34, a, b, 6, 'v');
          gg.beginPath();
          gg.rect(x - h * 0.5, y - h, h, h * 0.34);
          gg.lineWidth = WA.ink;
          gg.strokeStyle = WA.INK;
          gg.stroke();
        });
      }
      for (let i = 0; i < 12; i++) {
        const x = 100 + r() * (W - 200), y = 900 + r() * 1000, h = lerp(70, 130, (y - 900) / 1100);
        S.item(y - 2, (gg) => {
          P.setInk(h);
          const c = r.pick([C.red, C.blue, C.green, C.orange]);
          WA.limb(gg, [[x - h * 0.55, y - 4], [x + h * 0.55, y - 4]], 5, '#8a8f98');
          WA.rrect(gg, x - h * 0.5, y - h * 0.2, h, h * 0.16, 4, c, WA.ink * 1.2);
        });
        for (let j = 0; j < 2; j++) {
          const e = S.person(x - h * 0.2 + j * h * 0.36, y - h * 0.06, h * 0.7, { p: { pose: 'sit', prop: null, clipBelow: -30 } });
          e.sortKey = y - 1;
          e.keep = false;
        }
      }
      for (let i = 0; i < 12; i++) {
        const x = 100 + r() * (W - 200), y = 780 + r() * 1200, h = lerp(70, 130, (y - 780) / 1200);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 1.1, (g2) => WA.CREATURES.snowman(g2, { scarf: r.pick([C.red, C.blue, C.green, C.yellow]), hat: r.pick(['#2a2a30', '#c43a3a', '#2b6fd1']) })));
      }
      for (let i = 0; i < 18; i++) {
        const x = 100 + r() * (W - 200), y = 780 + r() * 1200, h = lerp(70, 130, (y - 780) / 1200);
        const nm = r.pick(['penguin', 'penguin', 'dog', 'bear', 'monster', 'bunny']);
        S.item(y, (gg) => WA.sprite(gg, x, y, nm === 'monster' ? h * 1.1 : h * 0.55, (g2) => WA.CREATURES[nm](g2, nm === 'monster' ? { body: '#eef5fa', belly: '#fff', eyes: r.pick([1, 2]), horns: true, hornC: '#9ab8d0', grumpy: r() < 0.5 } : nm === 'bear' ? { body: '#f4f8fb', belly: '#fff', bow: null } : nm === 'dog' ? { body: '#c98a4a', patch: '#8a5a2b', collar: C.red } : nm === 'penguin' ? { scarf: r.pick([C.red, C.blue, C.green, C.orange]) } : {}), r.pick([1, -1])));
      }
      for (let i = 0; i < 30; i++) {
        const x = 80 + r() * (W - 160), y = 800 + r() * 1180, w = lerp(60, 110, (y - 800) / 1180), k = r.int(0, 4);
        S.item(y, (gg) => {
          if (k === 0) P.sign(gg, x, y, w * 1.5, '#fffaf0', r.pick(['arrow', 'star']));
          else if (k === 1) P.barrel(gg, x, y, w * 0.8, r.pick(['#e5352b', '#2b6fd1']));
          else if (k === 2) P.flagpole(gg, x, y, w * 2.4, r.pick(WA.BRIGHT), C.white, r() < 0.5);
          else if (k === 3) P.rock(gg, x, y, w, '#a9b3c0');
          else P.crate(gg, x, y, w * 0.8, '#c88a4a');
        });
      }
      S.zone({ x0: 30, x1: W - 30, y0: 720, y1: 1000, hh: [54, 74], d: 0.7 });
      S.zone({ x0: 30, x1: W - 30, y0: 1000, y1: 1420, hh: [74, 100], d: 0.7 });
      S.zone({ x0: 30, x1: W - 30, y0: 1420, y1: 1990, hh: [100, 134], d: 0.68 });
    },
  };
})();
