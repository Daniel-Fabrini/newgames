// Random crowd members, the hero (Ruivinho) and its decoys.
(function () {
  const WA = window.WA;
  const { C } = WA;

  const MALE_HAIR = [['short', 5], ['sidepart', 3], ['bald', 1.2], ['spiky', 1], ['curly', 1.2], ['afro', 0.6], ['mohawk', 0.35], ['fringe', 1.5]];
  const FEM_HAIR = [['long', 4], ['bob', 2], ['pigtails', 1], ['bun', 1.4], ['ponytail', 2], ['braid', 0.9], ['curly', 1.2], ['afro', 0.5], ['short', 1], ['longwave', 1]];
  const HAIRC = () => null;

  // Generic crowd outfit mix; `o` customises a scene (see themes).
  const DEF = {
    tops: [['solid', 36], ['hstripe', 6], ['vstripe', 5], ['dots', 7], ['plaid', 7], ['jacket', 8], ['logo', 8], ['diag', 2], ['band', 4], ['suit', 2]],
    colors: WA.BRIGHT,
    hats: [['none', 62], ['cap', 6], ['sun', 3], ['straw', 2], ['beanie', 3], ['bobble', 2.5], ['headband', 1], ['top', 0.4], ['bandana', 1], ['hood', 0.6], ['flower', 0.6], ['party', 0.4], ['headphones', 0.8]],
    bottoms: [['pants', 56], ['shorts', 20], ['skirt', 8], ['dress', 8]],
    pants: ['#2c4a86', '#3a5a9a', '#4a3a2a', '#2a2a30', '#5b6b8a', '#6a4b2a', '#7a8a5a', '#8a2f2f', '#3a7a5a', '#c9b58a'],
    props: [null, 70, ['balloons', 2], ['icecream', 2], ['bag', 3], ['flag', 1.3], ['mug', 1.2], ['camera', 1.6], ['phone', 1.4], ['book', 1], ['lollipop', 1], ['ball', 1.2], ['binocs', 0.8], ['megaphone', 0.5], ['bouquet', 0.7], ['popcorn', 0.8], ['sign', 0.6], ['umbrella', 0.8]],
    poses: WA.POSE_COMMON,
    glasses: 0.17,
    sleeves: [['long', 55], ['short', 45]],
  };
  const merge = (o) => Object.assign({}, DEF, o || {});
  WA.OUTFIT = DEF;

  function weightedProp(r, list) {
    const items = [];
    for (const e of list) {
      if (Array.isArray(e)) items.push([e[0], e[1]]);
      else if (typeof e === 'number') items.push([null, e]);
    }
    return r.weighted(items);
  }

  const HERO_RED = '#e5352b';
  WA.HERO_RED = HERO_RED;

  WA.randomPerson = function (r, o0) {
    const o = merge(o0);
    const female = r.chance(0.46);
    const kid = r.chance(o.kidP == null ? 0.09 : o.kidP);
    const skin = r.weighted([[WA.SKIN[0], 2], [WA.SKIN[1], 3], [WA.SKIN[2], 2.4], [WA.SKIN[3], 1.8], [WA.SKIN[4], 1.2], [WA.SKIN[5], 0.8], [WA.SKIN[6], 0.5]]);
    let hairC = r.weighted([[WA.HAIR[0], 3], [WA.HAIR[1], 2.5], [WA.HAIR[2], 2.5], [WA.HAIR[3], 2], [WA.HAIR[4], 1.2], [WA.HAIR[5], 1.5], [WA.HAIR[6], 2], [WA.HAIR[7], 0.9], [WA.HAIR[8], 0.5], [WA.GINGER, 0.9], ['#3aa0e0', 0.12], ['#e8478a', 0.12], ['#6fcf4a', 0.08]]);
    const hairS = r.weighted(female ? FEM_HAIR : MALE_HAIR);
    const pat = r.weighted(o.tops);
    const col = () => r.pick(o.colors);
    let c1 = col(), c2 = col();
    while (c2 === c1) c2 = col();
    if (pat === 'hstripe' || pat === 'vstripe' || pat === 'diag') {
      // keep stripe pairs varied but not the hero's red/white combination
      if (r.chance(0.5)) c2 = C.white;
      if ((c1 === C.red || c1 === HERO_RED) && c2 === C.white && pat === 'hstripe') c1 = r.pick([C.blue, C.green, C.orange, C.purple, C.teal, C.navy]);
    }
    const top = { pat, c: c1, c2, sleeve: r.weighted(o.sleeves) };
    if (o.sleeveOverride) top.sleeve = o.sleeveOverride;
    let bt = r.weighted(o.bottoms);
    if (!female && (bt === 'skirt' || bt === 'dress')) bt = 'pants';
    const bottom = { t: bt, c: bt === 'dress' || bt === 'skirt' ? r.pick(o.colors) : r.pick(o.pants) };
    if (bt === 'dress') top.pat = 'dress';
    const hatT = r.weighted(o.hats);
    const hat = hatT === 'none' ? null : { t: hatT, c: r.pick(o.hatColors || o.colors), c2: r.pick(o.colors) };
    if (hat && hat.t === 'bobble') {
      // the hero's red bobble hat only appears in the dedicated decoys
      if (hat.c === HERO_RED || hat.c === C.red) hat.c = r.pick([C.blue, C.green, C.yellow, C.purple, C.teal]);
      hat.band = r.pick([C.white, WA.shade(hat.c, -0.3), C.yellow]);
      hat.pom = hat.c;
    }
    if (hat && hat.t === 'beanie' && hat.c === C.red) hat.c = C.orange;
    let glasses = r.chance(o.glasses) ? r.weighted([['round', 3], ['square', 3], ['sun', 3], ['goggles', 0.3], ['mono', 0.2], ['heart', 0.3]]) : null;
    if (glasses === 'round' && top.pat === 'hstripe' && top.c2 === C.white && (top.c === C.red)) glasses = 'square';
    let beard = null;
    let must = null;
    if (!female && !kid && r.chance(0.2)) {
      const bc = r.chance(0.8) ? hairC : r.pick(WA.HAIR);
      const t = r.weighted([['mustache', 3], ['full', 3], ['goatee', 1.5]]);
      if (t === 'mustache') must = bc;
      else beard = { t, c: bc };
    }
    const poses = o.poses;
    const pose = r.pick(poses);
    const prop = weightedProp(r, o.props);
    const p = {
      skin, hairC, hairS, top, bottom, hat, glasses, beard, must,
      shoe: r.pick(['#4a2f1c', '#2a2a30', '#fffaf0', '#8a2f2f', '#2b6fd1', '#e5352b', '#2fa84f', '#f9d71c']),
      pose,
      prop,
      propC: r.pick(WA.BRIGHT),
      propC2: C.white,
      propHand: r.chance(0.5) ? 'R' : 'L',
      kid,
      wide: !kid && r.chance(0.12),
      slim: r.chance(0.12),
      face: r.pick([1, 1, 1, 0.5, 0]),
      mood: r.weighted([['smile', 52], ['open', 14], ['surprise', 7], ['grim', 8], ['closed', 4], ['smile2', 15]]),
      blush: r.chance(0.2),
      brows: r.chance(0.3),
      glassC: r.pick(['#2a1a0e', '#1c1c1e', '#8a6a2a', '#7a2a2a']),
      lieFlag: false,
    };
    if (p.mood === 'closed') p.eyes = 'closed';
    // props need an arm up front
    if (prop && !['hold', 'hold2', 'point', 'stand', 'stand2', 'wave', 'hip'].includes(p.pose)) p.pose = r.pick(['hold2', 'stand', 'walk', 'stand2']);
    if (prop === 'umbrella' || prop === 'flag' || prop === 'balloons') {
      if (!['stand', 'stand2', 'walk', 'walk2'].includes(p.pose)) p.pose = 'stand';
      p.propHand = 'R';
      p.pose = p.pose === 'walk2' ? 'stand2' : p.pose;
    }
    if (p.pose === 'walk' || p.pose === 'walk2' || p.pose === 'stand' || p.pose === 'stand2') {
      if (prop && prop !== 'umbrella' && prop !== 'flag' && prop !== 'balloons') p.pose = 'hold2';
    }
    if (prop === 'camera' || prop === 'phone' || prop === 'binocs') p.pose = 'photo';
    if (prop === 'book' || prop === 'mug' || prop === 'popcorn' || prop === 'icecream' || prop === 'lollipop' || prop === 'bouquet' || prop === 'bag') p.pose = r.pick(['hold2', 'hold', 'stand']);
    if (prop && ['hold', 'hold2'].includes(p.pose) === false && ['book', 'mug', 'popcorn', 'icecream'].includes(prop)) p.pose = 'hold2';
    if (o.fixup) o.fixup(p, r);
    return p;
  };

  // extra pose with raised camera
  WA.POSES.photo = { R: [2.0, 1.3], L: [0.5, 1.9], r: [0.05, 0], l: [-0.05, 0] };
  WA.POSES.look = { R: [2.0, 1.45], L: [1.9, 1.45], r: [0.05, 0], l: [-0.05, 0] };

  // ---------- the hero: Ruivinho ----------
  WA.hero = function (pose, face) {
    return {
      skin: '#f4cba2', hairC: WA.GINGER, hairS: 'curls',
      top: { pat: 'hstripe', c: HERO_RED, c2: C.white, sleeve: 'long', n: 9 },
      bottom: { t: 'pants', c: '#2c4a86' }, shoe: '#4a2f1c',
      hat: { t: 'bobble', c: HERO_RED, c2: C.white, band: C.white, pom: HERO_RED },
      glasses: 'round', glassC: '#3b2414', pose: pose || 'stand', face: face == null ? 1 : face,
      mood: 'smile', blush: true, brows: true, hero: true,
    };
  };

  // Near-miss decoys of the hero. kind: stripes | hat | glasses | two | almost
  WA.heroDecoy = function (r, kind) {
    const p = WA.randomPerson(r, { glasses: 0, hats: [['none', 1]] });
    p.prop = null;
    p.pose = r.pick(['stand', 'stand2', 'walk', 'walk2', 'wave', 'cheer', 'hip', 'dance', 'point']);
    const red = HERO_RED;
    const otherStripe = () => r.pick([[C.blue, C.white], [C.green, C.white], [C.orange, C.white], [C.navy, C.white], [red, C.yellow], [red, C.navy], [C.purple, C.white], [C.teal, C.white], [C.yellow, C.white], ['#222', C.white]]);
    const rwStripe = () => ({ pat: 'hstripe', c: red, c2: C.white, sleeve: r.pick(['long', 'long', 'short']), n: r.pick([7, 9, 9, 11]) });
    const mkHat = (c, band, t = 'bobble') => ({ t, c, c2: band, band, pom: c });
    const g = () => r.pick(['square', 'sun', null, null]);
    switch (kind) {
      case 'stripes':
        p.top = rwStripe();
        if (r.chance(0.4)) p.hat = r.pick([{ t: 'cap', c: C.blue, c2: C.navy }, { t: 'sun', c: C.yellow, c2: C.orange }, null]);
        if (r.chance(0.3)) p.glasses = r.pick(['square', 'sun']);
        break;
      case 'hat':
        p.hat = mkHat(red, C.white);
        if (r.chance(0.5)) p.top = { pat: 'solid', c: r.pick([C.blue, C.green, C.yellow, C.navy, C.purple]), c2: C.white, sleeve: 'long' };
        if (r.chance(0.3)) p.glasses = r.pick(['square', 'sun']);
        break;
      case 'glasses': {
        p.glasses = 'round';
        p.glassC = r.pick(['#2a1a0e', '#1c1c1e', '#7a2a2a']);
        const [a, b] = otherStripe();
        p.top = { pat: 'hstripe', c: a, c2: b, sleeve: 'long', n: 9 };
        break;
      }
      case 'two': {
        // two of the three traits
        const m = r.int(0, 2);
        if (m === 0) { p.top = rwStripe(); p.glasses = 'round'; if (r.chance(0.5)) p.hat = { t: 'cap', c: r.pick([C.blue, C.yellow, C.green]), c2: C.white }; }
        if (m === 1) { p.top = rwStripe(); p.hat = mkHat(red, C.white); p.glasses = g(); }
        if (m === 2) { p.hat = mkHat(red, C.white); p.glasses = 'round'; p.top = { pat: r.pick(['solid', 'dots', 'jacket']), c: r.pick([C.blue, C.green, C.navy, C.yellow]), c2: C.white, sleeve: 'long' }; }
        break;
      }
      case 'almost': {
        // all three but one detail is wrong
        p.top = rwStripe();
        p.hat = mkHat(red, C.white);
        p.glasses = 'round';
        const w = r.int(0, 7);
        if (w === 0) p.top = { pat: 'vstripe', c: red, c2: C.white, sleeve: 'long' };
        else if (w === 1) p.hat = mkHat(C.blue, C.white);
        else if (w === 2) p.hat = mkHat(C.orange, C.white);
        else if (w === 3) p.glasses = 'square';
        else if (w === 4) p.glasses = 'sun';
        else if (w === 5) p.top = { pat: 'hstripe', c: C.hot, c2: C.white, sleeve: 'long', n: 9 };
        else if (w === 6) p.hat = { t: 'beanie', c: red, c2: C.white, band: C.white };
        else p.top = { pat: 'hstripe', c: red, c2: C.yellow, sleeve: 'long', n: 9 };
        p.hairC = r.pick(['#2a1b12', '#5a3a22', WA.GINGER]);
        p.hairS = r.pick(['short', 'curly', 'sidepart']);
        break;
      }
    }
    p.top.sleeve = p.top.sleeve || 'long';
    p.decoy = kind;
    return p;
  };

  WA.isHeroLook = function (p) {
    return p.top && p.top.pat === 'hstripe' && p.top.c === HERO_RED && p.top.c2 === C.white && p.glasses === 'round' && p.hat && (p.hat.t === 'bobble') && p.hat.c === HERO_RED && p.hat.band === C.white;
  };
})();
