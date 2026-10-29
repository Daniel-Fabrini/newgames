// Scene: Space station (cutaway with floors) + moon base.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  function planet(g, x, y, r, c1, c2, ring) {
    P.setInk(r);
    if (ring) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.3);
      g.beginPath();
      g.ellipse(0, 0, r * 1.9, r * 0.5, 0, Math.PI, Math.PI * 2);
      g.lineWidth = r * 0.22;
      g.strokeStyle = '#f2d490';
      g.stroke();
      g.restore();
    }
    WA.circ(g, x, y, r, c1, WA.ink * 1.4);
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.clip();
    g.fillStyle = c2;
    for (let i = -3; i <= 3; i++) g.fillRect(x - r, y + i * r * 0.28 - r * 0.06, r * 2, r * 0.12);
    g.restore();
    if (ring) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.3);
      g.beginPath();
      g.ellipse(0, 0, r * 1.9, r * 0.5, 0, 0, Math.PI);
      g.lineWidth = r * 0.22;
      g.strokeStyle = '#f2d490';
      g.stroke();
      g.restore();
    }
  }
  function rocket(g, x, y, h, c1 = C.red, c2 = C.white) {
    P.setInk(h * 0.5);
    const w = h * 0.26;
    // fins
    WA.poly(g, [[x - w * 0.5, y - h * 0.3], [x - w * 1.3, y], [x - w * 0.5, y - h * 0.08]], C.red);
    WA.poly(g, [[x + w * 0.5, y - h * 0.3], [x + w * 1.3, y], [x + w * 0.5, y - h * 0.08]], C.red);
    const body = () => {
      g.beginPath();
      g.moveTo(x - w * 0.5, y - h * 0.06);
      g.lineTo(x - w * 0.5, y - h * 0.6);
      g.quadraticCurveTo(x - w * 0.46, y - h * 0.9, x, y - h);
      g.quadraticCurveTo(x + w * 0.46, y - h * 0.9, x + w * 0.5, y - h * 0.6);
      g.lineTo(x + w * 0.5, y - h * 0.06);
      g.closePath();
    };
    P.stripedPath(g, body, x - w, y - h, w * 2, h, c1, c2, 12, 'h');
    WA.circ(g, x, y - h * 0.62, w * 0.2, '#8fd0ee', WA.ink * 1.4);
    WA.circ(g, x, y - h * 0.4, w * 0.15, '#8fd0ee', WA.ink * 1.2);
    WA.rrect(g, x - w * 0.4, y - h * 0.08, w * 0.8, h * 0.05, 3, '#6a6f78');
  }
  function dome(g, x, y, w, c = 'rgba(190,230,255,0.55)') {
    P.setInk(w);
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.bezierCurveTo(x - w / 2, y - w * 0.75, x + w / 2, y - w * 0.75, x + w / 2, y);
    g.closePath();
    WA.fillInk(g, c, WA.ink * 1.6);
  }
  const FLOORS = [560, 780, 1000, 1220, 1440];
  const ROOMS = ['#cfd8ff', '#ffe9c4', '#d4f3d0', '#f6d4f1', '#d4eef6'];

  T.space = {
    id: 'space', W: 3200, H: 2000, seed: 8808, hide: 0.8,
    outfit: {
      tops: [['spacesuit', 18], ['solid', 22], ['hstripe', 12], ['logo', 10], ['jacket', 8], ['vstripe', 4], ['diag', 3], ['dots', 4]],
      colors: ['#e5352b', '#f9d71c', '#2b6fd1', '#2fa84f', '#f28a1e', '#f28ab2', '#7b4bb7', '#18a5a5', '#fffaf0', '#233a7a', '#9cd13a', '#e8478a'],
      hats: [['none', 40], ['astro', 24], ['headphones', 6], ['cap', 4], ['beanie', 3], ['bobble', 3], ['hard', 3], ['headband', 3]],
      oddP: 0.1,
      costumes: [['astronaut', 10], ['scientist', 4], ['hero', 2], ['clown', 1], ['explorer', 1.4], ['chef', 1.2], ['wizardish', 0.8], ['king', 0.6]],
      props: [null, 44, ['flag', 5], ['book', 3], ['mug', 4], ['camera', 2], ['map', 1.4], ['binocs', 2], ['bag', 3], ['phone', 1.6], ['balloons', 1.4], ['lollipop', 1], ['megaphone', 1]],
      glasses: 0.2,
      poses: WA.POSE_COMMON,
      fixup(p, r) {
        if (p.top.pat === 'spacesuit') { p.top.c = r.pick([C.white, C.white, '#e8edf2', '#f6e4a0', '#cfe3ff']); p.top.sleeveC = p.top.c; p.top.c2 = r.pick([C.red, C.blue, C.green]); }
      },
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0a0f33');
      gr.addColorStop(0.7, '#1b2b78');
      gr.addColorStop(1, '#3a3f7a');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = r() < 0.2 ? '#ffe9a0' : '#ffffff';
        g.beginPath();
        g.arc(r() * W, r() * 1500, 1.2 + r() * 2.6, 0, 7);
        g.fill();
      }
      for (let i = 0; i < 40; i++) {
        const x = r() * W, y = r() * 1400;
        P.star5(g, x, y, 6 + r() * 7, r() < 0.5 ? '#ffe14a' : '#ffffff');
      }
      planet(g, 380, 190, 120, '#e8784a', '#d85a3a', true);
      planet(g, 2800, 170, 90, '#4aa0e0', '#2f7ac0', false);
      planet(g, 1800, 120, 50, '#9cd13a', '#7eb02a', false);
      // moon surface
      g.fillStyle = '#b6b9c6';
      g.fillRect(0, 1480, W, H - 1480);
      for (let i = 0; i < 60; i++) {
        const x = r() * W, y = 1520 + r() * 470, w = 80 + r() * 200;
        g.beginPath();
        g.ellipse(x, y, w, w * 0.22, 0, 0, 7);
        g.fillStyle = '#9ea2b2';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#8a8ea0';
        g.stroke();
        g.beginPath();
        g.ellipse(x + 8, y + 4, w * 0.82, w * 0.17, 0, 0, 7);
        g.fillStyle = '#c5c8d4';
        g.fill();
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = r() < 0.5 ? '#d3d6e0' : '#9a9eae';
        g.beginPath();
        g.arc(r() * W, 1490 + r() * 510, 1.5 + r() * 2.5, 0, 7);
        g.fill();
      }
    },
    layout(S) {
      const { g, W, H, r } = S;
      // station shell + rooms
      S.item(20, (gg) => {
        P.setInk(300);
        // solar panels
        for (const [x, d] of [[40, 1], [3160, -1]]) {
          WA.line(gg, x + d * 20, 760, x + d * 120, 760, 8, WA.INK);
          for (let k = 0; k < 2; k++) {
            const px = d > 0 ? x + 60 : x - 60 - 120;
            WA.rrect(gg, px, 440 + k * 520, 120, 360, 6, '#2b5aa8', WA.ink * 1.8);
            gg.strokeStyle = '#8fb0e8';
            gg.lineWidth = 2;
            for (let i = 1; i < 4; i++) { gg.beginPath(); gg.moveTo(px + i * 30, 440 + k * 520); gg.lineTo(px + i * 30, 800 + k * 520); gg.stroke(); }
            for (let i = 1; i < 6; i++) { gg.beginPath(); gg.moveTo(px, 440 + k * 520 + i * 60); gg.lineTo(px + 120, 440 + k * 520 + i * 60); gg.stroke(); }
          }
        }
        WA.rrect(gg, 150, 330, 2900, 1150, 40, '#dfe5f2', 7);
        FLOORS.forEach((fy, i) => {
          WA.rrect(gg, 190, fy - 200, 2820, 200, 10, ROOMS[i], WA.ink * 1.2);
          // portholes on the back wall
          for (let x = 280; x < 2950; x += 230) {
            WA.circ(gg, x, fy - 150, 34, '#16206a', WA.ink * 2);
            for (let k = 0; k < 4; k++) WA.dot(gg, x - 18 + ((k * 13 + i * 7) % 36), fy - 168 + ((k * 17 + i * 5) % 36), 2.2, '#fff');
          }
          // wall stripe
          WA.rrect(gg, 190, fy - 62, 2820, 18, 0, ['#7b8cff', '#f2b81c', '#5fbf6a', '#d65ac4', '#38a8c8'][i], 0.01, true);
        });
        // top antennas + domes
        for (const x of [500, 1600, 2500]) {
          WA.line(gg, x, 330, x, 200, 6, WA.INK);
          WA.circ(gg, x, 190, 18, '#ffd23c', 3);
        }
        dome(gg, 800, 336, 260);
        dome(gg, 2300, 336, 300);
      });
      // consoles, tables, plants, pods in rooms
      FLOORS.forEach((fy, i) => {
        for (let k = 0; k < 11; k++) {
          const x = 230 + k * 260 + r() * 90, w = r.range(70, 130), kind = r.int(0, 6);
          S.item(fy - 40, (gg) => {
            P.setInk(w);
            if (kind === 0) { WA.rrect(gg, x - w / 2, fy - 90, w, 80, 6, '#3a4a68'); for (let j = 0; j < 5; j++) WA.dot(gg, x - w * 0.36 + j * w * 0.18, fy - 66, 4, r.pick(['#ff5a5a', '#5aff7a', '#ffd23c', '#5ac8ff'])); WA.rrect(gg, x - w * 0.4, fy - 130, w * 0.8, 40, 4, '#0c1a38'); }
            else if (kind === 1) { WA.rrect(gg, x - w / 2, fy - 54, w, 14, 3, '#b87a3a'); WA.line(gg, x - w * 0.4, fy - 40, x - w * 0.4, fy - 6, 5, WA.INK); WA.line(gg, x + w * 0.4, fy - 40, x + w * 0.4, fy - 6, 5, WA.INK); }
            else if (kind === 2) P.bush(gg, x, fy - 8, w * 0.8, '#2fa84f', r.pick([C.pink, C.yellow, C.red]));
            else if (kind === 3) { WA.rrect(gg, x - 24, fy - 130, 48, 120, 22, 'rgba(160,230,255,0.7)'); WA.circ(gg, x, fy - 70, 8, '#7ed957', WA.ink); }
            else if (kind === 4) { WA.rrect(gg, x - w * 0.3, fy - 110, w * 0.6, 100, 6, '#e8edf2'); WA.circ(gg, x, fy - 80, 16, '#16206a', WA.ink * 1.4); WA.rrect(gg, x - 14, fy - 40, 28, 16, 3, '#ff7a5a', 2); }
            else P.balloons(gg, x, fy - 10, 100, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]);
          });
        }
        // floor slab
        S.item(fy - 6, (gg) => {
          P.setInk(300);
          gg.fillStyle = ['#7a86c8', '#c9a050', '#5a9a5a', '#a860a0', '#5898b0'][i];
          gg.fillRect(190, fy - 12, 2820, 34);
          gg.fillStyle = 'rgba(0,0,0,0.25)';
          gg.fillRect(190, fy + 10, 2820, 12);
          gg.strokeStyle = WA.INK;
          gg.lineWidth = 4;
          gg.strokeRect(190, fy - 12, 2820, 34);
        });
        S.zone({ x0: 210, x1: 2990, y0: fy - 84, y1: fy - 14, hh: [98, 112], n: 150, outfit: { oddP: 0.14 } });
      });
      // vertical tubes between floors
      for (const x of [420, 1500, 2700]) S.item(1500, (gg) => {
        P.setInk(300);
        gg.fillStyle = 'rgba(180,230,255,0.45)';
        gg.fillRect(x - 28, 360, 56, 1080);
        gg.lineWidth = 4;
        gg.strokeStyle = WA.INK;
        gg.strokeRect(x - 28, 360, 56, 1080);
      });
      // aliens & robots strolling in rooms
      FLOORS.forEach((fy, i) => {
        for (let k = 0; k < 9; k++) {
          const x = 230 + r() * 2740, h = r.range(90, 120);
          const nm = r.pick(['alien', 'alien', 'robot', 'monster', 'robot']);
          S.item(fy - 20 + r() * 8, (gg) => WA.sprite(gg, x, fy - 14, h, (g2) => WA.CREATURES[nm](g2, nm === 'monster' ? { body: r.pick(['#7ed957', '#f28ab2', '#7bb7ff', '#f9d71c']), eyes: r.pick([1, 2, 3]), horns: r() < 0.5 } : nm === 'alien' ? { body: r.pick(['#7ed957', '#b79ae0', '#f28a1e', '#5ac8ff']), suit: r.pick(WA.BRIGHT) } : { body: r.pick(['#b8c2cc', '#f2b81c', '#7bb7ff']), accent: r.pick([C.red, C.green]) }), r.pick([1, -1])));
        }
      });
      // moon surface: UFOs, rockets (striped), rovers, domes
      for (const [x, y, h, a, b] of [[300, 1600, 520, C.red, C.white], [900, 1520, 380, C.blue, C.white], [2250, 1560, 460, C.red, C.white], [2850, 1620, 560, C.yellow, C.red], [1600, 1540, 340, C.orange, C.white]]) {
        S.item(y, (gg) => rocket(gg, x, y, h, a, b), { x0: x - h * 0.2, x1: x + h * 0.2, y0: y - h, y1: y - h * 0.3 });
        S.occupy(x - h * 0.15, y - h * 0.3, x + h * 0.15, y, 6);
      }
      for (const [x, y] of [[620, 1660], [1950, 1700], [3000, 1520]]) S.item(y, (gg) => dome(gg, x, y, 220));
      for (let i = 0; i < 6; i++) {
        const x = 150 + r() * (W - 300), y = 100 + r() * 280;
        S.item(y, (gg) => WA.sprite(gg, x, y, 70 + r() * 40, WA.CREATURES.ufo, r.pick([1, -1])));
      }
      for (let i = 0; i < 5; i++) {
        const x = 100 + r() * (W - 200), y = 80 + r() * 260;
        S.item(y, (gg) => {
          P.setInk(100);
          WA.rrect(gg, x - 20, y - 12, 40, 24, 4, '#c9ced4');
          WA.rrect(gg, x - 90, y - 8, 60, 16, 2, '#2b5aa8');
          WA.rrect(gg, x + 30, y - 8, 60, 16, 2, '#2b5aa8');
        });
      }
      S.zone({ x0: 30, x1: W - 30, y0: 1520, y1: 1760, hh: [88, 106], d: 0.62, outfit: { hats: [['astro', 50], ['none', 30], ['cap', 6], ['beanie', 6], ['bobble', 4]], oddP: 0.05 } });
      S.zone({ x0: 30, x1: W - 30, y0: 1760, y1: 1990, hh: [106, 130], d: 0.62, outfit: { hats: [['astro', 50], ['none', 30], ['cap', 6], ['beanie', 6], ['bobble', 4]], oddP: 0.05 } });
      for (let i = 0; i < 16; i++) {
        const x = 80 + r() * (W - 160), y = 1520 + r() * 470, w = lerp(60, 110, (y - 1520) / 470), k = r.int(0, 3);
        S.item(y, (gg) => {
          if (k === 0) P.rock(gg, x, y, w * 1.4, '#9ea2b2');
          else if (k === 1) P.flagpole(gg, x, y, w * 2.4, r.pick(WA.BRIGHT), C.white, r() < 0.5);
          else if (k === 2) P.crate(gg, x, y, w * 0.9, '#d9dde8');
          else P.sign(gg, x, y, w * 1.5, '#fffaf0', r.pick(['arrow', 'star']));
        });
      }
    },
  };
})();
