// Animation helpers. All promises RESOLVE (never reject), also when skipped/cancelled/disposed.
// Honour prefers-reduced-motion (instant). Never blocks input: ghosts are pointer-events:none overlays.
//
//   const anim = createAnimator();                 // one per mounted game
//   await anim.flyCard(el, fromRect, toRect?, { duration, delay, arc, fromRotate, toRotate, faceDownFrom })
//   await anim.deal(deckEl, [{ el, delay?, faceDown? }, …], { stagger:90 })
//   await anim.collect(cardEls, toEl, { remove:true })
//   anim.flip(el, faceDown?) · anim.shake(el) · anim.pulse(el) · anim.chipToss(from, to, {count, denom})
//   anim.skip()      // finish everything now (state settles)      anim.dispose() // in your unmount
// Standalone versions of each function (flyCard, flip, …) exist too and use a shared default animator.
import { setFaceDown } from './card.js';
import { chipEl } from './table.js';

export const motion = { speed: 1 }; // 1 normal, 2 = twice as fast, 0 / Infinity = instant ("fast animations" setting)

export function reducedMotion() {
  try {
    return !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}
const dur = (ms) => (reducedMotion() || !motion.speed || motion.speed === Infinity ? 0 : ms / motion.speed);

let layer = null;
function getLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'dc-fly-layer';
    document.body.append(layer);
  }
  return layer;
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
const toRectLike = (v) => {
  if (!v) return null;
  if (v.getBoundingClientRect) return v.getBoundingClientRect();
  if ('width' in v) return v;
  return { left: v.x, top: v.y, width: 0, height: 0 };
};

export function createAnimator() {
  const running = new Set(); // { anim, finish }
  let disposed = false;

  function track(animation, cleanup) {
    return new Promise((resolve) => {
      const rec = {
        done: false,
        finish() {
          if (rec.done) return;
          rec.done = true;
          running.delete(rec);
          try { cleanup && cleanup(); } catch { /* ignore */ }
          resolve();
        },
        animation,
      };
      running.add(rec);
      animation.onfinish = rec.finish;
      animation.oncancel = rec.finish;
    });
  }

  function flyCard(el, fromRect, toRect, opts = {}) {
    if (disposed) return Promise.resolve();
    const d = dur(opts.duration ?? 420);
    const from = toRectLike(fromRect);
    const to = toRectLike(toRect) || el.getBoundingClientRect();
    const prevVis = el.style.visibility;
    if (d === 0 || !from) {
      opts.onStart && opts.onStart();
      opts.onEnd && opts.onEnd();
      return Promise.resolve();
    }
    const a = center(from);
    const b = center(to);
    const w = el.offsetWidth || to.width || a.w;
    const h = el.offsetHeight || w * 1.4;
    const ghost = document.createElement('div');
    ghost.className = 'dc-fly';
    const clone = el.cloneNode(true);
    clone.classList.remove('is-selected', 'is-hl');
    clone.style.translate = 'none';
    clone.style.setProperty('--cw', w + 'px');
    clone.style.visibility = 'visible';
    clone.removeAttribute('id');
    ghost.append(clone);
    getLayer().append(ghost);
    if (opts.faceDownFrom !== undefined) {
      clone.classList.toggle('is-down', !!opts.faceDownFrom);
      const inner = clone.firstChild;
      inner.style.transition = 'none';
      void inner.offsetWidth;
      inner.style.transition = '';
      requestAnimationFrame(() => clone.classList.toggle('is-down', el.classList.contains('is-down')));
    }
    el.style.visibility = 'hidden';
    const s0 = a.w ? a.w / w : 1;
    const s1 = 1;
    const r0 = opts.fromRotate || 0;
    const r1 = opts.toRotate || 0;
    const tf = (c, s, r) => `translate(${c.x - w / 2}px, ${c.y - h / 2}px) rotate(${r}deg) scale(${s})`;
    const arc = opts.arc ?? Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - arc };
    ghost.style.transformOrigin = `${w / 2}px ${h / 2}px`;
    const frames = [
      { transform: tf(a, s0, r0), offset: 0 },
      { transform: tf(mid, Math.max(s0, s1) * 1.08, (r0 + r1) / 2), offset: 0.5, easing: 'ease-in' },
      { transform: tf(b, s1, r1), offset: 1 },
    ];
    const animation = ghost.animate(frames, { duration: d, delay: dur(opts.delay || 0), easing: opts.easing || 'cubic-bezier(0.3,0.7,0.2,1)', fill: 'both' });
    // reveal ghost only once its delay has elapsed (avoid ghosts sitting at the origin)
    if (dur(opts.delay || 0) > 0) {
      ghost.style.opacity = '0';
      setTimeout(() => { if (ghost.isConnected) { ghost.style.opacity = ''; opts.onStart && opts.onStart(); } }, dur(opts.delay));
    } else opts.onStart && opts.onStart();
    return track(animation, () => {
      ghost.remove();
      if (!opts.keepHidden) el.style.visibility = prevVis;
      opts.onEnd && opts.onEnd();
    });
  }

  function deal(deckEl, targets, opts = {}) {
    const stagger = opts.stagger ?? 90;
    const from = toRectLike(deckEl);
    const ps = targets.map((t, i) => {
      const el = t.el || t;
      return flyCard(el, from, t.rect || null, { duration: opts.duration ?? 380, delay: (t.delay ?? i * stagger), faceDownFrom: true, onEnd: t.onArrive, arc: opts.arc, fromRotate: opts.fromRotate });
    });
    // `deal` does not hide targets early beyond flyCard behaviour: callers typically build targets right before.
    return Promise.all(ps).then(() => undefined);
  }

  function collect(cards, toEl, opts = {}) {
    const to = toRectLike(toEl);
    const ps = cards.map((el, i) => {
      const from = el.getBoundingClientRect();
      return flyCard(el, from, to, { duration: opts.duration ?? 380, delay: i * (opts.stagger ?? 40), keepHidden: true, arc: opts.arc ?? 0, toRotate: opts.toRotate ?? 0 }).then(() => {
        if (opts.remove) el.remove();
      });
    });
    return Promise.all(ps).then(() => undefined);
  }

  function flip(el, faceDown, opts = {}) {
    const inner = el.querySelector('.dc-inner');
    const want = faceDown === undefined ? !el.classList.contains('is-down') : !!faceDown;
    if (disposed || !inner) {
      setFaceDown(el, want);
      return Promise.resolve();
    }
    if (want === el.classList.contains('is-down')) return Promise.resolve();
    const d = dur(opts.duration ?? 460);
    if (d === 0) {
      setFaceDown(el, want);
      return Promise.resolve();
    }
    setFaceDown(el, want); // class swap sets the end rotation; animate from the start rotation
    const from = want ? 'rotateY(0deg)' : 'rotateY(180deg)';
    const to = want ? 'rotateY(180deg)' : 'rotateY(0deg)';
    inner.style.transition = 'none';
    const animation = inner.animate([{ transform: from }, { transform: to }], { duration: d, easing: 'cubic-bezier(0.3,0.7,0.2,1)' });
    const lift = el.animate([{ scale: 1 }, { scale: 1.1, offset: 0.5 }, { scale: 1 }], { duration: d, easing: 'ease-in-out' });
    track(lift, null);
    return track(animation, () => { inner.style.transition = ''; });
  }

  function simple(el, frames, ms, opts = {}) {
    const d = dur(ms);
    if (disposed || d === 0 || !el) return Promise.resolve();
    return track(el.animate(frames, { duration: d, easing: opts.easing || 'ease-in-out' }), null);
  }
  const shake = (el, amp = 6) => simple(el, [{ translate: '0 0' }, { translate: `${-amp}px 0` }, { translate: `${amp}px 0` }, { translate: `${-amp * 0.6}px 0` }, { translate: `${amp * 0.6}px 0` }, { translate: '0 0' }], 380);
  const pulse = (el, scale = 1.12) => simple(el, [{ scale: 1 }, { scale }, { scale: 1 }], 360, { easing: 'ease-out' });
  const bump = (el, px = 8) => simple(el, [{ translate: '0 0' }, { translate: `0 ${-px}px` }, { translate: '0 0' }], 260, { easing: 'ease-out' });

  /** Chips thrown from one rect/element to another. */
  function chipToss(from, to, { count = 3, denom = 25, size = 26, stagger = 60, duration = 520 } = {}) {
    const a = center(toRectLike(from));
    const b = center(toRectLike(to));
    const d = dur(duration);
    if (disposed || d === 0) return Promise.resolve();
    const ps = [];
    for (let i = 0; i < count; i++) {
      const g = document.createElement('div');
      g.className = 'dc-fly';
      g.append(chipEl({ denom, size }));
      g.style.opacity = '0';
      getLayer().append(g);
      const jx = (Math.random() - 0.5) * size * 1.4;
      const jy = (Math.random() - 0.5) * size * 0.8;
      const tf = (x, y, r, s = 1) => `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${r}deg) scale(${s})`;
      const anim = g.animate(
        [
          { transform: tf(a.x, a.y, 0, 0.8), opacity: 1 },
          { transform: tf((a.x + b.x) / 2, Math.min(a.y, b.y) - 50 - i * 6, 180 + i * 40, 1.1), opacity: 1, offset: 0.55 },
          { transform: tf(b.x + jx, b.y + jy, 360 + i * 30, 0.95), opacity: 1 },
        ],
        { duration: d, delay: i * dur(stagger), easing: 'cubic-bezier(0.3,0.7,0.3,1)', fill: 'both' },
      );
      anim.ready.then(() => { g.style.opacity = ''; });
      ps.push(track(anim, () => g.remove()));
    }
    return Promise.all(ps).then(() => undefined);
  }

  function skip() {
    for (const rec of [...running]) {
      try { rec.animation.finish(); } catch { rec.finish(); }
      rec.finish();
    }
  }
  function dispose() {
    disposed = true;
    for (const rec of [...running]) {
      try { rec.animation.cancel(); } catch { /* ignore */ }
      rec.finish();
    }
    running.clear();
  }

  return { flyCard, deal, collect, flip, shake, pulse, bump, chipToss, skip, cancelAll: skip, dispose, get active() { return running.size; } };
}

// standalone convenience wrappers (shared animator — fine for demos / one-offs; games should use createAnimator()).
const shared = createAnimator();
export const flyCard = shared.flyCard;
export const deal = shared.deal;
export const collect = shared.collect;
export const flip = shared.flip;
export const shake = shared.shake;
export const pulse = shared.pulse;
export const bump = shared.bump;
export const chipToss = shared.chipToss;

/** Resolve after ms (honours speed/reduced motion → 0). Handy for sequencing AI turns. */
export const wait = (ms) => new Promise((r) => setTimeout(r, dur(ms)));
