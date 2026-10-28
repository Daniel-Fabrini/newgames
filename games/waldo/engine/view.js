// Scene viewer: draws the offscreen scene canvas with a pan/zoom transform,
// handles drag, pinch, wheel and keyboard input, reports taps in world units
// and draws the canvas overlays (found ring, hint pulse, wrong-tap cross).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createViewer(host, { onTap, onZoomChange } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-waldo-canvas';
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const ctx = canvas.getContext('2d');

  let cw = 0;
  let ch = 0;
  let dpr = 1;
  let scene = null; // { canvas, W, H, target }
  let s = 1;
  let tx = 0;
  let ty = 0;
  let minS = 1;
  const MAX_ZOOM = 2.6;
  let vx = 0;
  let vy = 0;
  let anim = null; // { t0, dur, from, to }
  let dirty = true;
  let raf = 0;
  const overlays = []; // { kind, t0, dur, ... } in world units
  const pointers = new Map();
  let gesture = null; // { mode:'pan'|'pinch', ... }
  let dragDist = 0;
  let tapStart = 0;

  const W = () => (scene ? scene.W : 1);
  const H = () => (scene ? scene.H : 1);

  function clampView() {
    const sw = W() * s;
    const sh = H() * s;
    if (sw <= cw) tx = (cw - sw) / 2;
    else tx = clamp(tx, cw - sw, 0);
    if (sh <= ch) ty = (ch - sh) / 2;
    else ty = clamp(ty, ch - sh, 0);
  }

  function computeMin() {
    minS = Math.max(cw / W(), ch / H());
  }

  function resize() {
    const r = host.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    if (nw === cw && nh === ch) return;
    const ratio = cw ? s / minS : 1.25;
    cw = nw;
    ch = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    computeMin();
    s = clamp(minS * ratio, minS, minS * MAX_ZOOM);
    clampView();
    dirty = true;
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(host);
  window.addEventListener('resize', resize);

  // ---- world <-> css helpers ----
  const toWorld = (x, y) => ({ x: (x - tx) / s, y: (y - ty) / s });
  const toCss = (wx, wy) => ({ x: tx + wx * s, y: ty + wy * s });

  function zoomAround(px, py, ns) {
    ns = clamp(ns, minS, minS * MAX_ZOOM);
    const wx = (px - tx) / s;
    const wy = (py - ty) / s;
    s = ns;
    tx = px - wx * s;
    ty = py - wy * s;
    clampView();
    dirty = true;
    onZoomChange && onZoomChange(s / minS);
  }

  // ---- input ----
  function onDown(e) {
    if (!scene) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anim = null;
    vx = 0;
    vy = 0;
    if (pointers.size === 1) {
      gesture = { mode: 'pan', lastX: e.clientX, lastY: e.clientY, t: performance.now() };
      dragDist = 0;
      tapStart = performance.now();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      gesture = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, mx, my };
      dragDist = 999;
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.mode === 'pan' && pointers.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragDist += Math.hypot(dx, dy);
      tx += dx;
      ty += dy;
      vx = dx;
      vy = dy;
      clampView();
      dirty = true;
    } else if (gesture.mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ns = gesture.s0 * (d / gesture.d0);
      const wx = (gesture.mx - tx) / s;
      const wy = (gesture.my - ty) / s;
      s = clamp(ns, minS, minS * MAX_ZOOM);
      tx = mx - wx * s;
      ty = my - wy * s;
      clampView();
      gesture.mx = mx;
      gesture.my = my;
      dirty = true;
      onZoomChange && onZoomChange(s / minS);
    }
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasSingle && gesture && gesture.mode === 'pan') {
      const dt = performance.now() - tapStart;
      if (dragDist < 10 && dt < 380 && onTap) {
        const r = canvas.getBoundingClientRect();
        onTap(e.clientX - r.left, e.clientY - r.top);
      }
    }
    if (pointers.size === 0) {
      gesture = null;
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      gesture = { mode: 'pan', lastX: p.x, lastY: p.y, t: performance.now() };
      dragDist = 999;
    }
  }

  function onWheel(e) {
    if (!scene) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAround(e.clientX - r.left, e.clientY - r.top, s * Math.exp(-e.deltaY * 0.0015));
  }

  function onKey(e) {
    if (!scene) return;
    const step = 60;
    if (e.key === 'ArrowLeft') tx += step;
    else if (e.key === 'ArrowRight') tx -= step;
    else if (e.key === 'ArrowUp') ty += step;
    else if (e.key === 'ArrowDown') ty -= step;
    else if (e.key === '+' || e.key === '=') zoomAround(cw / 2, ch / 2, s * 1.2);
    else if (e.key === '-') zoomAround(cw / 2, ch / 2, s / 1.2);
    else return;
    e.preventDefault();
    clampView();
    dirty = true;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  // ---- overlays (world-space rings and crosses) ----
  function ringGeom(t) {
    const cx = t.x;
    const cy = t.y - t.h * 0.5;
    return { cx, cy, r: t.h * 0.72 };
  }

  // ---- animation ----
  function tween(to, dur = 700) {
    anim = { t0: performance.now(), dur, from: { s, tx, ty }, to };
    dirty = true;
  }

  // Centres the target at a zoom factor (relative to the cover scale).
  function focusTarget(t, zoom = 2.2, dur = 800) {
    const ns = clamp(minS * zoom, minS, minS * MAX_ZOOM);
    const cx = t.x;
    const cy = t.y - t.h * 0.5;
    const to = { s: ns, tx: cw / 2 - cx * ns, ty: ch / 2 - cy * ns };
    tween(to, dur);
    return to;
  }

  function fitCenter(dur = 500) {
    const ns = clamp(minS * 1.25, minS, minS * MAX_ZOOM);
    tween({ s: ns, tx: (cw - W() * ns) / 2, ty: (ch - H() * ns) / 2 }, dur);
  }

  function addOverlay(o) {
    overlays.push({ ...o, t0: performance.now() });
    dirty = true;
  }

  function step(now) {
    raf = requestAnimationFrame(step);
    if (!scene) return;
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.dur);
      const e = easeInOut(k);
      s = anim.from.s + (anim.to.s - anim.from.s) * e;
      tx = anim.from.tx + (anim.to.tx - anim.from.tx) * e;
      ty = anim.from.ty + (anim.to.ty - anim.from.ty) * e;
      clampView();
      dirty = true;
      if (k >= 1) anim = null;
    } else if (!pointers.size && (Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2)) {
      tx += vx;
      ty += vy;
      vx *= 0.9;
      vy *= 0.9;
      clampView();
      dirty = true;
    }
    if (overlays.length) dirty = true;
    if (!dirty) return;
    dirty = false;
    draw(now);
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scene.canvas, tx, ty, W() * s, H() * s);

    // hint pulse (dashed, slowly turning)
    for (let i = overlays.length - 1; i >= 0; i--) {
      const o = overlays[i];
      const age = (now - o.t0) / 1000;
      if (o.kind === 'hint') {
        if (age > o.dur) {
          overlays.splice(i, 1);
          continue;
        }
        const g = ringGeom(o.target);
        const c = toCss(g.cx, g.cy);
        const fade = Math.min(1, age * 3, (o.dur - age) * 2);
        const pulse = 1 + Math.sin(age * 6) * 0.08;
        ctx.save();
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = '#ffd95a';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -age * 40;
        ctx.beginPath();
        ctx.arc(c.x, c.y, g.r * s * 1.25 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (o.kind === 'found') {
        const dur = 2.6;
        if (age > dur) {
          overlays.splice(i, 1);
          continue;
        }
        const g = ringGeom(o.target);
        const c = toCss(g.cx, g.cy);
        const k = easeOut(Math.min(1, age / 0.38));
        const r0 = g.r * s;
        ctx.save();
        // glow ring
        ctx.globalAlpha = Math.max(0, 1 - age / dur) * 0.9;
        ctx.shadowColor = 'rgba(255,214,90,0.9)';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ffd95a';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r0 * (1.9 - 0.9 * k) + Math.sin(age * 5) * 2, 0, Math.PI * 2);
        ctx.stroke();
        // sparkles bursting outward
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff2b0';
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * Math.PI * 2 + 0.3;
          const dist = r0 * (1.1 + easeOut(Math.min(1, age / 0.9)) * 1.2);
          const sz = Math.max(0, 3.2 * (1 - age / 0.9));
          if (sz <= 0) continue;
          ctx.beginPath();
          ctx.arc(c.x + Math.cos(a) * dist, c.y + Math.sin(a) * dist, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (o.kind === 'cross') {
        const dur = 0.7;
        if (age > dur) {
          overlays.splice(i, 1);
          continue;
        }
        const k = easeOut(Math.min(1, age / 0.2));
        const a = 1 - age / dur;
        const sz = 22 * k;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ff4a5c';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(o.x - sz, o.y - sz);
        ctx.lineTo(o.x + sz, o.y + sz);
        ctx.moveTo(o.x + sz, o.y - sz);
        ctx.lineTo(o.x - sz, o.y + sz);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function setScene(next) {
    scene = next;
    overlays.length = 0;
    anim = null;
    vx = vy = 0;
    if (!cw) resize();
    computeMin();
    s = clamp(minS * 1.25, minS, minS * MAX_ZOOM);
    tx = (cw - W() * s) / 2;
    ty = (ch - H() * s) / 2;
    clampView();
    dirty = true;
    onZoomChange && onZoomChange(s / minS);
  }

  raf = requestAnimationFrame(step);

  return {
    setScene,
    resize,
    focusTarget,
    fitCenter,
    zoomBy(f) {
      zoomAround(cw / 2, ch / 2, s * f);
    },
    toWorld,
    toCss,
    targetCss(t) {
      const g = ringGeom(t);
      return toCss(g.cx, g.cy);
    },
    targetRadius(t) {
      return ringGeom(t).r * s;
    },
    addFound(t) {
      addOverlay({ kind: 'found', target: t });
    },
    addHint(t, dur = 3.5) {
      addOverlay({ kind: 'hint', target: t, dur });
    },
    addCross(x, y) {
      addOverlay({ kind: 'cross', x, y });
    },
    clearHint() {
      for (let i = overlays.length - 1; i >= 0; i--) if (overlays[i].kind === 'hint') overlays.splice(i, 1);
      dirty = true;
    },
    isAnimating: () => !!anim,
    get zoom() {
      return minS ? s / minS : 1;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro && ro.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.remove();
      scene = null;
    },
  };
}
