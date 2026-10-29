// The hidden characters / items and their near-miss decoys.
// A drawable: { kind: 'person', p } | { kind: 'sprite', fn(g), unit } drawn by WA.drawDrawable.
(function () {
  const WA = window.WA;
  const { INK, C, circ, ell, rrect, poly, limb, line, arc, dot, shade } = WA;
  const CR = WA.CREATURES;

  const person = (p, sizeK = 1) => ({ kind: 'person', p, sizeK });
  const sprite = (fn, sizeK, extra) => Object.assign({ kind: 'sprite', fn, sizeK }, extra || {});

  // ----- item sprites (designed in a ~100 unit box, origin at ground centre) -----
  function keyFn(v = {}) {
    return (g) => {
      const c = v.c || '#f2b81c', dk = shade(c, -0.35);
      const head = v.head || 'ring';
      g.save();
      g.translate(0, -26);
      g.rotate(v.rot == null ? -0.35 : v.rot);
      // shaft
      rrect(g, -6, -5, 66, 10, 4, c);
      // teeth
      rrect(g, 38, 3, 8, 16, 2, c);
      rrect(g, 50, 3, 8, 12, 2, c);
      if (v.teeth === 3) rrect(g, 26, 3, 7, 10, 2, c);
      // head
      if (head === 'ring') {
        circ(g, -20, 0, 20, c);
        circ(g, -20, 0, 9, '#fdf3c8', WA.ink * 1.1);
      } else if (head === 'clover') {
        for (const [dx, dy] of [[-20, -11], [-20, 11], [-31, 0], [-9, 0]]) circ(g, dx, dy, 11, c);
        circ(g, -20, 0, 7, '#fdf3c8', WA.ink * 0.9);
      } else if (head === 'square') {
        rrect(g, -42, -16, 34, 32, 6, c);
        rrect(g, -34, -8, 18, 16, 3, '#fdf3c8', WA.ink * 0.9);
      }
      line(g, 4, -2, 30, -2, WA.ink * 0.9, dk);
      g.restore();
    };
  }
  function scrollFn(v = {}) {
    return (g) => {
      const paper = v.paper || '#f4e6b8', rib = v.ribbon === undefined ? C.red : v.ribbon;
      g.save();
      g.translate(0, -24);
      g.rotate(v.rot == null ? -0.25 : v.rot);
      rrect(g, -34, -14, 68, 28, 14, paper);
      ell(g, -34, 0, 8, 14, shade(paper, -0.12), 0, WA.ink * 0.9);
      ell(g, 34, 0, 8, 14, shade(paper, -0.12), 0, WA.ink * 0.9);
      ell(g, 34, 0, 3.5, 7, shade(paper, -0.35), 0, WA.ink * 0.6);
      if (v.lines !== false) {
        line(g, -22, -6, 22, -6, WA.ink * 0.5, '#7a5a2b');
        line(g, -22, 0, 18, 0, WA.ink * 0.5, '#7a5a2b');
        line(g, -22, 6, 22, 6, WA.ink * 0.5, '#7a5a2b');
      }
      if (rib) {
        rrect(g, -6, -16, 12, 32, 3, rib);
        poly(g, [[0, 14], [-7, 28], [-1, 24]], rib, WA.ink * 0.8);
        poly(g, [[0, 14], [7, 28], [1, 24]], rib, WA.ink * 0.8);
      }
      if (v.stripes) {
        for (let i = -2; i <= 2; i++) rrect(g, i * 12 - 3, -14, 5, 28, 0, v.stripes, 0.01, true);
      }
      g.restore();
    };
  }
  function coinFn(c = '#f2b81c') {
    return (g) => {
      circ(g, 0, -20, 20, c);
      circ(g, 0, -20, 13, shade(c, 0.15), WA.ink * 0.8);
      line(g, 0, -28, 0, -12, WA.ink * 1.3, shade(c, -0.4));
    };
  }
  function spoonFn(c = '#f2b81c') {
    return (g) => {
      g.save();
      g.translate(0, -24);
      g.rotate(-0.4);
      rrect(g, -4, -4, 62, 8, 4, c);
      ell(g, -16, 0, 17, 12, c);
      g.restore();
    };
  }
  function pennantFn(c1 = C.red, c2 = C.white) {
    return (g) => {
      line(g, 0, 0, 0, -70, WA.ink * 2, INK);
      g.beginPath();
      g.moveTo(0, -70);
      g.lineTo(34, -60);
      g.lineTo(0, -50);
      g.closePath();
      WA.fillInk(g, c1);
    };
  }

  // ----- person-based targets -----
  function wizardP(v = {}) {
    const robe = v.robe || '#2b55c4';
    return {
      skin: '#f0c9a0', hairC: v.hair || '#f2efe6', hairS: v.hairS || 'long',
      top: { pat: 'solid', c: robe, c2: '#f9d71c', sleeve: 'long' },
      bottom: { t: 'dress', c: robe, c2: v.trim === undefined ? null : v.trim },
      shoe: '#5b3a1e',
      hat: v.hat === undefined ? { t: 'wizard', c: robe, c2: '#f9d71c' } : v.hat,
      beard: v.beard === undefined ? { t: 'long', c: '#f2efe6' } : v.beard,
      glasses: v.glasses || null, glassC: '#8a6a2a',
      pose: v.pose || 'hold2', prop: v.prop === undefined ? 'staff' : v.prop, propHand: 'R', face: 1, mood: 'smile', brows: true, collar: true,
      belt: v.belt === undefined ? '#f9d71c' : v.belt,
    };
  }
  function camGirlP(v = {}) {
    const jc = v.jacket || C.pink;
    return {
      skin: v.skin || '#eab98a', hairC: v.hair || '#1d1d22', hairS: v.hairS || 'ponytail',
      top: { pat: 'jacket', c: jc, c2: C.white, sleeve: 'long' },
      bottom: { t: 'pants', c: v.pants || '#4a78c4' }, shoe: '#fffaf0',
      hat: v.hat || null, glasses: v.glasses || null,
      pose: v.pose || 'photo', prop: v.prop === undefined ? 'camera' : v.prop, propHand: 'R', face: 1, mood: 'smile', blush: true, brows: true,
    };
  }

  const T = (WA.TARGETS = {});

  T.hero = {
    size: 1.0,
    make: (pose, face) => person(WA.hero(pose, face)),
    decoy: (r) => person(WA.heroDecoy(r, r.weighted([['stripes', 3], ['hat', 3], ['glasses', 3], ['two', 2.5], ['almost', 1.3]]))),
  };
  T.dog = {
    size: 0.5,
    make: () => sprite((g) => CR.dog(g, { body: '#f6f1e6', patch: '#2a2a30', ear: '#2a2a30', collar: C.red }), 0.5),
    decoy: (r) => {
      const v = r.pick([
        { body: '#f6f1e6', patch: '#8a5a2b', ear: '#8a5a2b', collar: C.red },
        { body: '#f6f1e6', patch: '#2a2a30', ear: '#2a2a30', collar: C.blue },
        { body: '#f6f1e6', patch: '#2a2a30', ear: '#2a2a30', collar: null },
        { body: '#f6f1e6', patch: '#2a2a30', ear: '#2a2a30', collar: C.red, spots: true },
        { body: '#c98a4a', patch: '#8a5a2b', ear: '#6a3d1e', collar: C.red },
        { body: '#3a3a42', patch: '#1d1d22', ear: '#1d1d22', collar: C.yellow },
        { body: '#e8c27a', patch: '#e8c27a', ear: '#b8863a', collar: C.red, noPatch: true },
        { body: '#f6f1e6', patch: '#2a2a30', ear: '#8a5a2b', collar: C.green },
      ]);
      const cat = r.chance(0.12);
      if (cat) return sprite((g) => CR.cat(g, { body: r.pick(['#e69a45', '#9aa0a8', '#f6f1e6', '#3a3a42']) }), 0.45);
      return sprite((g) => CR.dog(g, v), r.range(0.42, 0.52));
    },
  };
  T.wizard = {
    size: 1.0,
    make: (pose) => person(wizardP({ pose: pose || 'hold2' })),
    decoy: (r) => {
      const m = r.int(0, 6);
      const blue = '#2b55c4';
      if (m === 0) return person(wizardP({ robe: '#7b3fb0', trim: null }));
      if (m === 1) return person(wizardP({ hat: { t: 'party', c: C.red, c2: C.yellow } }));
      if (m === 2) return person(wizardP({ beard: null, hairS: 'short', hair: '#5a3a22' }));
      if (m === 3) return person(wizardP({ robe: '#c43a3a', beard: { t: 'long', c: '#cfd3d8' } }));
      if (m === 4) return person(wizardP({ hat: null, hairS: 'bald', hair: '#f2efe6', prop: 'cane' }));
      if (m === 5) return person(wizardP({ hat: { t: 'wizard', c: '#1f9a6a', c2: '#f9d71c' }, robe: '#1f9a6a' }));
      return person(wizardP({ hat: { t: 'santa' }, robe: C.red, belt: '#2a2a30', prop: 'bag' }));
    },
  };
  T.camera = {
    size: 1.0,
    make: (pose) => person(camGirlP({ pose: pose || 'photo' })),
    decoy: (r) => {
      const m = r.int(0, 6);
      if (m === 0) return person(camGirlP({ jacket: C.yellow }));
      if (m === 1) return person(camGirlP({ prop: null, pose: 'stand2' }));
      if (m === 2) return person(camGirlP({ hair: '#8a5a2b', hairS: 'long' }));
      if (m === 3) return person(camGirlP({ prop: 'phone' }));
      if (m === 4) return person(camGirlP({ jacket: C.hot, prop: 'binocs' }));
      if (m === 5) return person(camGirlP({ jacket: C.lilac, prop: null, hairS: 'bob', pose: 'wave' }));
      return person(camGirlP({ jacket: C.pink, hairS: 'braid', hat: { t: 'cap', c: C.pink, c2: C.white }, prop: 'camera' }));
    },
  };
  T.key = {
    size: 0.36,
    make: () => sprite(keyFn({ c: '#f2b81c', head: 'ring' }), 0.36, { item: true }),
    decoy: (r) => {
      const m = r.int(0, 6);
      if (m === 0) return sprite(keyFn({ c: '#c9ced4', head: 'ring' }), 0.36, { item: true });
      if (m === 1) return sprite(keyFn({ c: '#f2b81c', head: 'clover' }), 0.36, { item: true });
      if (m === 2) return sprite(keyFn({ c: '#c0793a', head: 'ring' }), 0.36, { item: true });
      if (m === 3) return sprite(coinFn(), 0.26, { item: true });
      if (m === 4) return sprite(spoonFn(), 0.34, { item: true });
      if (m === 5) return sprite(keyFn({ c: '#f2b81c', head: 'square', teeth: 3 }), 0.36, { item: true });
      return sprite(keyFn({ c: '#8fd0e8', head: 'ring', rot: 0.4 }), 0.36, { item: true });
    },
  };
  T.scroll = {
    size: 0.36,
    make: () => sprite(scrollFn({}), 0.36, { item: true }),
    decoy: (r) => {
      const m = r.int(0, 5);
      if (m === 0) return sprite(scrollFn({ ribbon: null }), 0.36, { item: true });
      if (m === 1) return sprite(scrollFn({ ribbon: C.blue }), 0.36, { item: true });
      if (m === 2) return sprite(scrollFn({ paper: '#9cc8ee', ribbon: C.white, lines: false }), 0.36, { item: true });
      if (m === 3) return sprite(scrollFn({ paper: '#fffaf0', ribbon: C.red, stripes: '#e5352b', lines: false }), 0.36, { item: true });
      if (m === 4) return sprite(scrollFn({ paper: '#f1dfae', ribbon: '#2fa84f', rot: 0.3 }), 0.36, { item: true });
      return sprite(scrollFn({ paper: '#e8d9ff', ribbon: C.red }), 0.36, { item: true });
    },
  };
  T.teddy = {
    size: 0.46,
    make: () => sprite((g) => CR.bear(g, { bow: C.blue }), 0.46),
    decoy: (r) => {
      const m = r.int(0, 6);
      if (m === 0) return sprite((g) => CR.bear(g, { bow: C.red }), 0.46);
      if (m === 1) return sprite((g) => CR.bear(g, { bow: null }), 0.46);
      if (m === 2) return sprite((g) => CR.bear(g, { body: '#f3ead2', belly: '#fffaf0', bow: C.blue }), 0.46);
      if (m === 3) return sprite((g) => CR.bear(g, { body: '#3a2a22', belly: '#7a5a3a', bow: C.blue }), 0.46);
      if (m === 4) return sprite((g) => CR.bear(g, { bow: C.green, patch: C.yellow }), 0.46);
      if (m === 5) return sprite((g) => CR.bear(g, { body: '#e8a0c0', belly: '#fbd5e4', bow: C.blue }), 0.46);
      return sprite((g) => CR.monkey(g, {}), 0.5);
    },
  };
  T.duck = {
    size: 0.4,
    make: () => sprite((g) => CR.duck(g, { hat: C.red }), 0.4, { item: true }),
    decoy: (r) => {
      const m = r.int(0, 6);
      if (m === 0) return sprite((g) => CR.duck(g, { hat: C.blue }), 0.4, { item: true });
      if (m === 1) return sprite((g) => CR.duck(g, {}), 0.4, { item: true });
      if (m === 2) return sprite((g) => CR.duck(g, { body: '#f28ab2', hat: C.red }), 0.4, { item: true });
      if (m === 3) return sprite((g) => CR.chick(g, {}), 0.32, { item: true });
      if (m === 4) return sprite((g) => CR.swan(g, {}), 0.42, { item: true });
      if (m === 5) return sprite((g) => CR.duck(g, { body: '#fffaf0', hat: C.red }), 0.4, { item: true });
      return sprite((g) => CR.duck(g, { bowc: C.red }), 0.4, { item: true });
    },
  };
  WA.TARGET_IDS = ['hero', 'dog', 'wizard', 'camera', 'key', 'scroll', 'teddy', 'duck'];

  // Draws a drawable with feet at (x,y); H = height of a crowd person at that spot.
  WA.drawDrawable = function (g, d, x, y, H, flip) {
    if (d.kind === 'person') {
      WA.drawPerson(g, d.p, x, y, H * (d.sizeK || 1), flip);
    } else {
      WA.sprite(g, x, y, H * d.sizeK * 1.0 / 0.5 * 0.5, d.fn, flip);
    }
  };
  // Height of a drawable's visual box in px (approx.), used for bounding boxes.
  WA.drawableBox = function (d, H) {
    if (d.kind === 'person') {
      const h = H * (d.sizeK || 1) * 1.12;
      return { w: h * 0.42, h };
    }
    const h = H * d.sizeK;
    return { w: h * (d.item ? 0.95 : 0.9), h: h * (d.item ? 0.62 : 0.85) };
  };
  // Card portrait (for the wanted card / tray): centred on (cx, cy) inside a size x size box.
  WA.drawIcon = function (g, id, cx, cy, size) {
    const T0 = WA.TARGETS[id];
    const d = T0.make(id === 'hero' ? 'wave' : id === 'wizard' ? 'hold2' : 'photo');
    const flip = 1;
    if (d.kind === 'person') {
      const H = size * 0.9;
      WA.drawPerson(g, Object.assign({ noShadow: true }, d.p), cx, cy + H * 0.5, H, flip);
    } else {
      const dk = d.item ? 1.05 : 0.95;
      WA.sprite(g, cx - 0, cy + size * (d.item ? 0.28 : 0.42), size * dk * (d.item ? 1.0 : 0.95), d.fn, flip);
    }
  };
})();
