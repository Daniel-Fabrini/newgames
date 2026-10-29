// Scene: Sports stadium.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});

  const TEAMS = [
    [C.red, C.white], [C.blue, C.white], [C.yellow, C.green], ['#2a2a30', C.white], [C.orange, C.navy], [C.purple, C.yellow], [C.green, C.white], [C.sky, C.white],
  ];
  const jerseyFix = (cols) => (p, r) => {
    const [a, b] = cols;
    if (p.top.pat === 'hstripe' || p.top.pat === 'vstripe' || p.top.pat === 'diag') { p.top.c = r.chance(0.5) ? a : b; p.top.c2 = p.top.c === a ? b : a; }
    else if (p.top.pat === 'solid' || p.top.pat === 'logo') { p.top.c = r.chance(0.7) ? a : b; p.top.c2 = p.top.c === a ? b : a; }
    if (p.top.pat === 'hstripe' && p.top.c === C.red && p.top.c2 === C.white) { /* decoy-ish: allowed, hero also needs hat+glasses */ }
    if (p.hat && p.hat.t === 'bobble' && p.hat.c === C.red) p.hat.c = C.blue;
    if (p.hat && p.hat.t === 'cap') p.hat.c = r.chance(0.5) ? a : b;
    if (p.hat && p.hat.t === 'beanie' && p.hat.c === C.red) p.hat.c = a === C.red ? C.orange : p.hat.c;
  };

  T.stadium = {
    id: 'stadium', W: 3200, H: 2000, seed: 5505, hide: 0.8,
    outfit: {
      tops: [['solid', 18], ['hstripe', 22], ['vstripe', 18], ['logo', 12], ['diag', 6], ['dots', 2], ['band', 5], ['jacket', 3]],
      hats: [['none', 52], ['cap', 14], ['beanie', 5], ['bobble', 4], ['headband', 4], ['sun', 1.5], ['top', 0.8], ['party', 1.5], ['flower', 0.5]],
      oddP: 0.05,
      costumes: [['clown', 3], ['hero', 3], ['chef', 1], ['king', 1], ['viking', 2], ['cowboy', 1], ['pirate', 1], ['astronaut', 1]],
      props: [null, 40, ['flag', 9], ['balloons', 5], ['megaphone', 3], ['drum', 2], ['trumpet', 2], ['popcorn', 3], ['sign', 3], ['camera', 1.2], ['icecream', 1.4], ['ball', 3], ['mug', 1.2]],
      sleeves: [['short', 70], ['long', 30]],
      bottoms: [['shorts', 40], ['pants', 45], ['skirt', 8], ['dress', 7]],
      poses: WA.POSE_COMMON,
    },
    bg(S) {
      const { g, W, H, r } = S;
      let gr = g.createLinearGradient(0, 0, 0, 160);
      gr.addColorStop(0, '#6fbfee');
      gr.addColorStop(1, '#bfe4f7');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 200);
      for (let i = 0; i < 6; i++) P.cloud(g, 200 + i * 560 + r() * 100, 40 + r() * 40, 220 + r() * 80);
      // stands backdrop
      g.fillStyle = '#9aa3b2';
      g.fillRect(0, 100, W, 800);
      // pitch
      g.fillStyle = '#3fa24a';
      g.fillRect(0, 880, W, H - 880);
      for (let x = -200; x < W + 200; x += 200) {
        g.fillStyle = '#4db85a';
        g.beginPath();
        g.moveTo(x, 880);
        g.lineTo(x + 100, 880);
        g.lineTo(x + 100 + (x - W / 2) * 0.32 + 130, H);
        g.lineTo(x + (x - W / 2) * 0.32 + 30, H);
        g.closePath();
        g.fill();
      }
      g.lineWidth = 9;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.moveTo(220, 1000);
      g.lineTo(W - 220, 1000);
      g.lineTo(W - 20, 1960);
      g.lineTo(20, 1960);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(W / 2, 1000);
      g.lineTo(W / 2, 1960);
      g.stroke();
      g.beginPath();
      g.ellipse(W / 2, 1480, 380, 170, 0, 0, Math.PI * 2);
      g.stroke();
      WA.dot(g, W / 2, 1480, 10, '#fff');
      for (const s of [-1, 1]) {
        g.beginPath();
        const cx = W / 2 + s * 1250;
        g.moveTo(cx - s * 150, 1020);
        g.lineTo(cx - s * 330, 1450);
        g.lineTo(cx + s * 250, 1450);
        g.lineTo(cx + s * 100, 1020);
        g.stroke();
      }
    },
    layout(S) {
      const { g, W, H, r } = S;
      // floodlights + scoreboard
      for (const x of [60, 3140]) S.item(90, (gg) => {
        P.setInk(300);
        WA.line(gg, x, 250, x, 20, 8, WA.INK);
        WA.line(gg, x, 250, x, 20, 4, '#cfd3d8');
        WA.rrect(gg, x - 60, -4, 120, 60, 6, '#3a3f48', 3);
        for (let i = 0; i < 6; i++) WA.circ(gg, x - 42 + (i % 3) * 42, 14 + Math.floor(i / 3) * 28, 11, '#fff7b0', 2);
      });
      S.item(110, (gg) => {
        P.setInk(300);
        WA.rrect(gg, 1250, 20, 700, 190, 12, '#262a32', 4);
        WA.rrect(gg, 1280, 44, 640, 142, 6, '#0e5a8a', 3);
        for (let i = 0; i < 10; i++) WA.rrect(gg, 1300 + i * 62, 66, 48, 22, 3, WA.BRIGHT[i % WA.BRIGHT.length], 2);
        WA.circ(gg, 1450, 140, 28, '#fff3a0', 3);
        WA.rrect(gg, 1520, 112, 340, 52, 6, '#101820', 3);
        for (let i = 0; i < 6; i++) WA.rrect(gg, 1536 + i * 52, 124, 40, 28, 3, i % 2 ? '#ffd23c' : '#7ed957', 2);
      });
      // stands: 9 rows
      const rows = 15;
      const y0 = 170, dy = 48;
      const sects = [[0, 640], [640, 1280], [1280, 1920], [1920, 2560], [2560, 3200]];
      const sectTeams = r.shuffle(TEAMS).slice(0, 5);
      for (let i = 0; i < rows; i++) {
        const yi = y0 + i * dy;
        const hh = lerp(76, 100, i / (rows - 1));
        sects.forEach(([xa, xb], si) => {
          const cols = sectTeams[si];
          S.zone({ x0: xa + 20, x1: xb - 10, y0: yi - 2, y1: yi + 2, hh: [hh, hh], n: Math.round((xb - xa) / (hh * 0.36) * 1.0), outfit: { fixup: jerseyFix(cols), colors: [cols[0], cols[1], cols[0], cols[1], C.white, C.yellow, C.navy] }, pose: ['sit', 'sit', 'sit', 'cheer', 'wave', 'sit', 'sitread', 'sit'], fix: (e) => { e.p.clipBelow = -50; }, target: true });
        });
        // riser (covers legs) — coloured seats
        S.item(yi + 3, (gg) => {
          P.setInk(300);
          gg.fillStyle = '#6d7686';
          gg.fillRect(0, yi - 10, W, dy + 6);
          gg.fillStyle = '#586071';
          gg.fillRect(0, yi - 10, W, 6);
          sects.forEach(([xa, xb], si) => {
            const cols = sectTeams[si];
            for (let x = xa + 4; x < xb - 30; x += 54) {
              gg.fillStyle = ((x / 54) | 0) % 2 ? cols[0] : cols[1];
              gg.fillRect(x, yi + 4, 36, 10);
            }
          });
        });
      }
      // banners/flags hung over the stands front
      for (let i = 0; i < 24; i++) {
        const x = 60 + i * 130 + r() * 40, yy = y0 + r.int(1, 13) * dy + 26;
        S.item(yy + 10, (gg) => {
          const [a, b] = r.pick(TEAMS);
          P.setInk(120);
          gg.beginPath();
          gg.rect(x, yy - 8, 70, 36);
          WA.stripes(gg, x, yy - 8, 70, 36, a, b, r.pick([4, 6, 8]), r.pick(['h', 'v']));
          gg.beginPath();
          gg.rect(x, yy - 8, 70, 36);
          gg.lineWidth = WA.ink;
          gg.strokeStyle = WA.INK;
          gg.stroke();
        });
      }
      // pitch crowd (players, fans, staff)
      S.zone({ x0: 40, x1: W - 40, y0: 900, y1: 1250, hh: [66, 82], d: 0.6, outfit: { oddP: 0.1 } });
      S.zone({ x0: 40, x1: W - 40, y0: 1250, y1: 1620, hh: [82, 104], d: 0.58, outfit: { oddP: 0.1 } });
      S.zone({ x0: 40, x1: W - 40, y0: 1620, y1: 1990, hh: [104, 132], d: 0.6, outfit: { oddP: 0.1 } });
      // goals
      for (const gx of [W / 2 - 1240, W / 2 + 1240]) {
        S.item(1180, (gg) => {
          P.setInk(300);
          gg.strokeStyle = 'rgba(255,255,255,0.6)';
          gg.lineWidth = 2;
          for (let x = gx - 110; x < gx + 110; x += 18) { gg.beginPath(); gg.moveTo(x, 1010); gg.lineTo(x + 14, 1120); gg.stroke(); }
          for (let y = 1010; y < 1120; y += 18) { gg.beginPath(); gg.moveTo(gx - 110, y); gg.lineTo(gx + 124, y + 6); gg.stroke(); }
          WA.line(gg, gx - 110, 1010, gx - 110, 1130, 9, WA.INK);
          WA.line(gg, gx - 110, 1010, gx - 110, 1130, 5, '#fff');
          WA.line(gg, gx + 110, 1010, gx + 110, 1130, 9, WA.INK);
          WA.line(gg, gx + 110, 1010, gx + 110, 1130, 5, '#fff');
          WA.line(gg, gx - 114, 1010, gx + 114, 1010, 9, WA.INK);
          WA.line(gg, gx - 114, 1010, gx + 114, 1010, 5, '#fff');
        });
      }
      // ad boards along the pitch edge + corner flags + trees of balloons
      S.item(905, (gg) => {
        P.setInk(300);
        for (let x = 0; x < W; x += 160) {
          WA.rrect(gg, x + 6, 868, 148, 40, 4, WA.BRIGHT[((x / 160) | 0) % WA.BRIGHT.length], 3);
          WA.rrect(gg, x + 30, 880, 100, 16, 3, C.white, 2);
        }
      });
      for (let i = 0; i < 40; i++) {
        const x = 70 + r() * (W - 140), y = 950 + r() * 1030, w = lerp(52, 100, (y - 950) / 1030), k = r.int(0, 4);
        S.item(y, (gg) => {
          if (k === 0) P.beachball(gg, x, y, w * 0.4, r.pick(WA.BRIGHT));
          else if (k === 1) P.balloons(gg, x, y, w * 1.6, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]);
          else if (k === 2) P.flagpole(gg, x, y, w * 2.4, r.pick(WA.BRIGHT), r.pick([C.white, C.yellow]), r() < 0.5);
          else if (k === 3) P.crate(gg, x, y, w * 0.8, r.pick(['#e5352b', '#2b6fd1', '#fff']));
          else P.sign(gg, x, y, w * 1.4, '#fffaf0', r.pick(['arrow', 'star']));
        });
      }
      for (let i = 0; i < 12; i++) {
        const x = 100 + r() * (W - 200), y = 1000 + r() * 960, h = lerp(70, 120, (y - 1000) / 960) * 0.55;
        const nm = r.pick(['dog', 'cat', 'bunny', 'penguin', 'monkey']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => WA.CREATURES[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42']), patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : {}), r.pick([1, -1])));
      }
    },
  };
})();
