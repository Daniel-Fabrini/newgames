// Scene: Toy shop.
(function () {
  const WA = window.WA;
  const { C, P, lerp, clamp } = WA;
  const T = (WA.THEMES = WA.THEMES || {});
  const CR = WA.CREATURES;

  function blocks(g, x, y, w, r) {
    P.setInk(w);
    const cols = [C.red, C.blue, C.yellow, C.green, C.orange, C.pink];
    const rows = r.int(2, 3);
    for (let i = 0; i < rows; i++) {
      const n = rows - i;
      for (let j = 0; j < n; j++) {
        const bx = x + (j - (n - 1) / 2) * w * 0.34, by = y - i * w * 0.32;
        WA.rrect(g, bx - w * 0.16, by - w * 0.32, w * 0.32, w * 0.32, 2, r.pick(cols), WA.ink);
        WA.dot(g, bx, by - w * 0.16, w * 0.04, 'rgba(255,255,255,0.8)');
      }
    }
  }
  function toyTrain(g, x, y, w, r) {
    P.setInk(w);
    const cols = [C.red, C.blue, C.yellow];
    WA.rrect(g, x - w * 0.5, y - w * 0.28, w * 0.34, w * 0.26, 4, C.red, WA.ink);
    WA.rrect(g, x - w * 0.5, y - w * 0.36, w * 0.14, w * 0.1, 2, '#2a2a30', WA.ink);
    for (let i = 0; i < 2; i++) WA.rrect(g, x - w * 0.1 + i * w * 0.32, y - w * 0.24, w * 0.28, w * 0.22, 3, cols[i + 1], WA.ink);
    for (const dx of [-0.42, -0.26, -0.04, 0.2, 0.36]) WA.circ(g, x + w * dx, y - w * 0.03, w * 0.05, '#2a2a30', WA.ink * 0.8);
  }
  function ballToy(g, x, y, w, r) {
    P.beachball(g, x, y, w * 0.5, r.pick(WA.BRIGHT));
  }
  function topToy(g, x, y, w, r) {
    P.setInk(w);
    const c = r.pick(WA.BRIGHT);
    WA.poly(g, [[x - w * 0.22, y - w * 0.34], [x + w * 0.22, y - w * 0.34], [x, y]], c, WA.ink);
    WA.rrect(g, x - w * 0.26, y - w * 0.42, w * 0.52, w * 0.1, 3, r.pick(WA.BRIGHT), WA.ink);
    WA.line(g, x, y - w * 0.42, x, y - w * 0.6, WA.ink * 1.4);
  }
  function drumToy(g, x, y, w, r) {
    P.setInk(w);
    WA.rrect(g, x - w * 0.26, y - w * 0.36, w * 0.52, w * 0.36, 3, C.red, WA.ink);
    WA.ell(g, x, y - w * 0.36, w * 0.26, w * 0.07, '#f6f1e4', 0, WA.ink * 0.8);
    WA.line(g, x - w * 0.26, y - w * 0.34, x - w * 0.1, y - 1, WA.ink * 0.7, C.white);
    WA.line(g, x + w * 0.26, y - w * 0.34, x + w * 0.1, y - 1, WA.ink * 0.7, C.white);
  }
  function rocketToy(g, x, y, w, r) {
    const c = r.pick([C.red, C.blue, C.green, C.orange]);
    P.setInk(w);
    WA.poly(g, [[x - w * 0.14, y - w * 0.6], [x, y - w * 0.9], [x + w * 0.14, y - w * 0.6], [x + w * 0.14, y - w * 0.1], [x - w * 0.14, y - w * 0.1]], C.white, WA.ink);
    WA.poly(g, [[x - w * 0.14, y - w * 0.3], [x - w * 0.3, y], [x - w * 0.14, y - w * 0.1]], c, WA.ink);
    WA.poly(g, [[x + w * 0.14, y - w * 0.3], [x + w * 0.3, y], [x + w * 0.14, y - w * 0.1]], c, WA.ink);
    WA.circ(g, x, y - w * 0.5, w * 0.06, '#8fd0ee', WA.ink * 0.8);
  }
  const SHELF = [190, 345, 500, 655];
  function shelfToy(S, x, y, h) {
    const { r } = S;
    const k = r.weighted([['bear', 5], ['robot', 3], ['duck', 3], ['blocks', 3], ['ball', 2], ['train', 2], ['top', 1], ['drum', 1], ['rocket', 1.4], ['bunny', 2], ['penguin', 1], ['monkey', 1.4], ['dragon', 1], ['dog', 1], ['chick', 1], ['horse', 0.6], ['snowman', 0.5], ['monster', 1]]);
    S.item(y + 0.5, (g) => {
      if (k === 'bear') WA.sprite(g, x, y, h, (g2) => CR.bear(g2, { body: r.pick(['#a8672f', '#e8a0c0', '#f3ead2', '#c98a5a', '#3a2a22', '#e8c27a', '#7bb7ff']), belly: r.pick(['#e6c08a', '#fbd5e4', '#fffaf0']), bow: r.pick([C.red, C.green, C.yellow, null, C.pink, C.red]) }), 1);
      else if (k === 'robot') WA.sprite(g, x, y, h * 0.95, (g2) => CR.robot(g2, { body: r.pick(['#b8c2cc', '#f2b81c', '#7bb7ff', '#e8a0c0']), accent: r.pick([C.red, C.green]) }), 1);
      else if (k === 'duck') WA.sprite(g, x, y, h * 0.8, (g2) => CR.duck(g2, { body: r.pick([C.yellow, C.yellow, '#f28ab2', C.white, '#7bb7ff']), hat: r.pick([C.blue, null, null, C.green]) }), 1);
      else if (k === 'blocks') blocks(g, x, y, h * 0.9, r);
      else if (k === 'ball') ballToy(g, x, y, h * 0.8, r);
      else if (k === 'train') toyTrain(g, x, y, h * 1.1, r);
      else if (k === 'top') topToy(g, x, y, h * 0.8, r);
      else if (k === 'drum') drumToy(g, x, y, h * 0.8, r);
      else if (k === 'rocket') rocketToy(g, x, y, h * 0.9, r);
      else WA.sprite(g, x, y, h * (k === 'dragon' ? 0.7 : k === 'horse' ? 0.8 : 0.7), (g2) => CR[k](g2, k === 'monster' ? { body: r.pick(['#7ed957', '#f28ab2', '#7bb7ff', '#f9d71c']), eyes: r.pick([1, 2, 3]), horns: r() < 0.5 } : k === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42']), patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : {}), r.pick([1, -1]));
    });
  }

  T.toyshop = {
    id: 'toyshop', W: 3200, H: 2000, seed: 10101, hide: 0.8,
    outfit: {
      tops: [['solid', 24], ['hstripe', 10], ['dots', 8], ['logo', 9], ['vstripe', 5], ['plaid', 5], ['jacket', 6], ['diag', 3], ['band', 3]],
      hats: [['none', 52], ['cap', 6], ['party', 4], ['beanie', 3], ['bobble', 2.4], ['headband', 3], ['flower', 2], ['top', 0.6], ['sun', 1.4]],
      oddP: 0.12,
      costumes: [['clown', 5], ['knight', 2], ['hero', 3], ['wizardish', 2], ['pirate', 2], ['astronaut', 2], ['chef', 1], ['king', 1], ['viking', 1], ['cowboy', 2]],
      props: [null, 34, ['toybear', 7], ['toyduck', 3], ['toyrobot', 3], ['balloons', 6], ['ball', 3], ['lollipop', 3], ['bag', 3], ['icecream', 1], ['flag', 1.4], ['book', 1.2], ['candycane', 1.5], ['bouquet', 0.6], ['drum', 1.4], ['trumpet', 1.2]],
      kidP: 0.3,
      poses: WA.POSE_COMMON,
      fixup(p, r) {
        if (p.prop === 'toybear') {
          p.toyC = r.pick(['#e8a0c0', '#f3ead2', '#c98a5a', '#7bb7ff', '#3a2a22', '#e8c27a']);
          p.bowC = r.pick([C.red, C.green, C.yellow, C.pink]);
          p.pose = 'hold2';
        }
        if (p.prop === 'toyduck') { p.toyC = r.pick(['#f28ab2', C.white, '#7bb7ff', C.yellow]); p.pose = 'hold2'; }
        if (p.prop === 'toyrobot') p.pose = 'hold2';
      },
    },
    bg(S) {
      const { g, W, H, r } = S;
      // wallpaper
      g.fillStyle = '#ffe3ef';
      g.fillRect(0, 0, W, 820);
      for (let x = 0; x < W; x += 100) {
        g.fillStyle = (x / 100) % 2 ? '#ffd0e4' : '#ffe3ef';
        g.fillRect(x, 0, 100, 820);
      }
      for (let i = 0; i < 120; i++) P.star5(g, r() * W, r() * 780, 8 + r() * 8, 'rgba(255,255,255,0.7)');
      // floor checker
      for (let y = 800, row = 0; y < H; y += 60 + (y - 800) * 0.05, row++) {
        for (let x = -((row % 2) * 90); x < W; x += 180) {
          g.fillStyle = ((x / 180 + row) | 0) % 2 ? '#bde3f5' : '#fff3c4';
          g.fillRect(x, y, 180, 60 + (y - 800) * 0.05);
        }
      }
      g.fillStyle = '#e8478a';
      g.fillRect(0, 780, W, 24);
      g.fillStyle = '#7a3a5a';
      g.fillRect(0, 804, W, 8);
    },
    layout(S) {
      const { g, W, H, r } = S;
      // ceiling garlands
      for (let i = 0; i < 6; i++) {
        const x0 = 100 + i * 520;
        S.item(40, (gg) => P.bunting(gg, x0, 20, x0 + 500, 20 + r() * 20, 10, [C.red, C.yellow, C.blue, C.green, C.pink, C.orange], 0.08));
      }
      for (let i = 0; i < 12; i++) {
        const x = 150 + i * 260 + r() * 100;
        S.item(60, (gg) => P.balloons(gg, x, 120 + r() * 40, 150, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]));
      }
      // shelves with toys
      SHELF.forEach((sy, si) => {
        S.item(sy - 0.2, (gg) => {
          P.setInk(300);
          WA.rrect(gg, 40, sy - 6, W - 80, 24, 4, '#b8793a', WA.ink * 1.6);
          WA.rrect(gg, 40, sy + 18, W - 80, 10, 2, '#8a5a2b', WA.ink * 1.2);
        });
        let x = 90;
        while (x < W - 90) {
          const h = r.range(86, 120);
          shelfToy(S, x, sy - 8, h);
          x += h * r.range(0.62, 0.95);
        }
        S.zone({ x0: 80, x1: W - 80, y0: sy - 14, y1: sy - 4, hh: [96, 96], noCrowd: true, itemsOnly: true, target: true, pw: 0.6 });
      });
      // posts
      for (const x of [20, W - 20]) S.item(60, (gg) => WA.rrect(gg, x - 20, 0, 40, 780, 4, '#8a5a2b', 4));
      // floor zones
      S.zone({ x0: 30, x1: W - 30, y0: 840, y1: 1150, hh: [74, 92], d: 0.9, peopleOnly: false });
      S.zone({ x0: 30, x1: W - 30, y0: 1150, y1: 1550, hh: [92, 112], d: 0.85 });
      S.zone({ x0: 30, x1: W - 30, y0: 1550, y1: 1990, hh: [112, 134], d: 0.8 });
      // giant toys + play stuff (floor): bears (red bows), horses, blocks, train tracks
      for (let i = 0; i < 6; i++) {
        const x = 200 + r() * (W - 400), y = 1000 + r() * 950, h = lerp(150, 280, (y - 1000) / 950);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => CR.bear(g2, { body: r.pick(['#e8a0c0', '#f3ead2', '#7bb7ff', '#e8c27a']), belly: '#fffaf0', bow: r.pick([C.red, C.green, C.yellow]) }), r.pick([1, -1])), { x0: x - h * 0.3, x1: x + h * 0.3, y0: y - h, y1: y - h * 0.4 });
        S.occupy(x - h * 0.3, y - h * 0.6, x + h * 0.3, y, 5);
      }
      const pal = [[C.red, C.white], [C.blue, C.white], [C.yellow, C.red], [C.green, C.white], [C.pink, C.white], [C.purple, C.yellow], [C.orange, C.white]];
      for (let i = 0; i < 7; i++) {
        const x = 150 + r() * (W - 300), y = 1100 + r() * 850, w = lerp(150, 240, (y - 1100) / 850), [a, b] = r.pick(pal);
        S.item(y, (gg) => P.tent(gg, x, y, w, w * 0.85, a, b, { flagC: r.pick(WA.BRIGHT) }), { x0: x - w * 0.3, x1: x + w * 0.3, y0: y - w * 0.85, y1: y - w * 0.4 });
        S.occupy(x - w * 0.5, y - w * 0.5, x + w * 0.5, y, 4);
      }
      for (let i = 0; i < 8; i++) {
        const x = 150 + r() * (W - 300), y = 1000 + r() * 950, w = lerp(120, 220, (y - 1000) / 950), [a, b] = r.pick(pal);
        S.item(y, (gg) => P.awning(gg, x, y, w, w * 0.9, a, b), { x0: x - w / 2, x1: x + w / 2, y0: y - w * 0.9, y1: y - w * 0.5 });
      }
      for (let i = 0; i < 10; i++) {
        const x = 150 + r() * (W - 300), y = 1000 + r() * 950, h = lerp(100, 170, (y - 1000) / 950);
        S.item(y, (gg) => WA.sprite(gg, x, y, h, (g2) => CR.horse(g2, { body: r.pick(['#f6f1e4', '#a8672f', '#e8a0c0', '#7bb7ff']), mane: r.pick([C.red, C.blue, '#2a1b12']), saddle: r.pick([C.red, C.yellow]) }), r.pick([1, -1])));
      }
      for (let i = 0; i < 70; i++) {
        const x = 70 + r() * (W - 140), y = 840 + r() * 1140, w = lerp(60, 120, (y - 840) / 1140), k = r.int(0, 6);
        S.item(y, (gg) => {
          if (k === 0) blocks(gg, x, y, w, r);
          else if (k === 1) toyTrain(gg, x, y, w * 1.3, r);
          else if (k === 2) P.balloons(gg, x, y, w * 1.7, [r.pick(WA.BRIGHT), r.pick(WA.BRIGHT), r.pick(WA.BRIGHT)]);
          else if (k === 3) P.beachball(gg, x, y, w * 0.5, r.pick(WA.BRIGHT));
          else if (k === 4) rocketToy(gg, x, y, w * 1.2, r);
          else if (k === 5) drumToy(gg, x, y, w * 0.9, r);
          else P.crate(gg, x, y, w * 0.8, r.pick(['#e5352b', '#2b6fd1', '#f9d71c', '#2fa84f']));
        });
      }
      for (let i = 0; i < 14; i++) {
        const x = 100 + r() * (W - 200), y = 900 + r() * 1080, h = lerp(70, 130, (y - 900) / 1080);
        const nm = r.pick(['dog', 'cat', 'bunny', 'penguin', 'monkey', 'chick', 'robot']);
        S.item(y, (gg) => WA.sprite(gg, x, y, h * 0.6, (g2) => CR[nm](g2, nm === 'dog' ? { body: r.pick(['#c98a4a', '#3a3a42']), patch: '#8a5a2b', collar: r.pick([C.blue, null]) } : {}), r.pick([1, -1])));
      }
    },
  };
})();
