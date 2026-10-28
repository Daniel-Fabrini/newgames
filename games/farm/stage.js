// A full-size canvas with pan / pinch-zoom / tap handling and a cached static layer.
import { Camera } from './iso.js';

export function createStage(host, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-farm-canvas';
  host.append(canvas);
  const c = canvas.getContext('2d');
  const cam = new Camera();
  const b = opts.bounds; // world bounds { x0, y0, x1, y1 }
  const focus = opts.focus || b; // what the camera shows first
  const pts = new Map();
  let W = 0, H = 0, dpr = 1, raf = 0, alive = true, fitted = false;
  let drag = null, pinch = null, cache = null, cacheZ = 0, cacheDirty = true, lastCache = 0;
  let minZ = 0.4, maxZ = 2.6;
  const t0 = performance.now();

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    minZ = Math.min(W / bw, H / bh) * 0.85;
    if (!fitted) fit(focus);
    clampCam();
    cacheDirty = true;
  }

  function fit(bb = b) {
    const bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
    cam.z = Math.min(maxZ, Math.max(minZ, Math.min(W / bw, H / bh) * 0.95));
    centerOn((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
    fitted = true;
  }

  function centerOn(wx, wy) {
    cam.ox = W / 2 - wx * cam.z;
    cam.oy = H / 2 - wy * cam.z;
  }

  // Keep at least part of the world on screen.
  function clampCam() {
    const left = cam.ox + b.x0 * cam.z, right = cam.ox + b.x1 * cam.z;
    const top = cam.oy + b.y0 * cam.z, bottom = cam.oy + b.y1 * cam.z;
    const m = 40;
    if (right < m) cam.ox += m - right;
    if (left > W - m) cam.ox -= left - (W - m);
    if (bottom < m) cam.oy += m - bottom;
    if (top > H - m) cam.oy -= top - (H - m);
  }

  function setZoom(nz, sx = W / 2, sy = H / 2) {
    nz = Math.max(minZ, Math.min(maxZ, nz));
    cam.zoomAt(sx, sy, nz);
    clampCam();
  }

  function rebuildCache() {
    const s = Math.min(cam.z * dpr, 3, 4096 / Math.max(b.x1 - b.x0, b.y1 - b.y0));
    const cw = Math.ceil((b.x1 - b.x0) * s), ch = Math.ceil((b.y1 - b.y0) * s);
    if (!cache) cache = document.createElement('canvas');
    cache.width = cw;
    cache.height = ch;
    const cc = cache.getContext('2d');
    cc.setTransform(s, 0, 0, s, -b.x0 * s, -b.y0 * s);
    opts.drawStatic(cc, s);
    cacheZ = cam.z;
    cacheDirty = false;
    lastCache = performance.now();
  }

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    const busy = pts.size > 0;
    if (cacheDirty || (!busy && Math.abs(cacheZ - cam.z) > 0.02 * cam.z && performance.now() - lastCache > 300)) {
      rebuildCache();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    // static layer, scaled from the cache when the zoom differs
    const sx = (cam.ox + b.x0 * cam.z) * dpr, sy = (cam.oy + b.y0 * cam.z) * dpr;
    c.imageSmoothingEnabled = true;
    c.drawImage(cache, sx, sy, (b.x1 - b.x0) * cam.z * dpr, (b.y1 - b.y0) * cam.z * dpr);
    // dynamic layer in world units
    c.setTransform(cam.z * dpr, 0, 0, cam.z * dpr, cam.ox * dpr, cam.oy * dpr);
    opts.drawDynamic(c, cam, t, W, H);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ----- input
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function down(e) {
    const [x, y] = local(e);
    pts.set(e.pointerId, { x, y });
    canvas.setPointerCapture?.(e.pointerId);
    if (pts.size === 1) {
      drag = { x, y, ox: cam.ox, oy: cam.oy, t: performance.now(), moved: false };
    } else if (pts.size === 2) {
      const [a, bb] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - bb.x, a.y - bb.y), z: cam.z };
      drag = null;
    }
  }
  function move(e) {
    if (!pts.has(e.pointerId)) return;
    const [x, y] = local(e);
    pts.set(e.pointerId, { x, y });
    if (pinch && pts.size >= 2) {
      const [a, bb] = [...pts.values()];
      const d = Math.hypot(a.x - bb.x, a.y - bb.y);
      setZoom(pinch.z * d / pinch.d, (a.x + bb.x) / 2, (a.y + bb.y) / 2);
      return;
    }
    if (drag) {
      const dx = x - drag.x, dy = y - drag.y;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) {
        cam.ox = drag.ox + dx;
        cam.oy = drag.oy + dy;
        clampCam();
      }
    }
  }
  function up(e) {
    if (!pts.has(e.pointerId)) return;
    const wasSingle = pts.size === 1;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (drag && wasSingle) {
      const [x, y] = local(e);
      const quick = performance.now() - drag.t < 450;
      if (!drag.moved && quick) opts.onTap?.(x, y, e);
      drag = null;
    }
  }
  function wheel(e) {
    e.preventDefault();
    const [x, y] = local(e);
    setZoom(cam.z * Math.exp(-e.deltaY * 0.0015), x, y);
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    cam,
    get W() { return W; },
    get H() { return H; },
    fit() { fit(focus); clampCam(); },
    zoomBy(f) { setZoom(cam.z * f); },
    center(wx, wy) { centerOn(wx, wy); clampCam(); },
    invalidate() { cacheDirty = true; },
    setLimits(lo, hi) { minZ = lo; maxZ = hi; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.remove();
    },
  };
}
