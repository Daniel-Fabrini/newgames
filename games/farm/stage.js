// A full-size canvas with pan / pinch-zoom / tap handling. Static scenery is painted into
// world-space chunks (offscreen canvases) that are rebuilt lazily, so a big painted world stays crisp.
import { Camera } from './iso.js';

const CH = 320; // chunk size in world units
const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function createStage(host, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-farm-canvas';
  host.append(canvas);
  const c = canvas.getContext('2d');
  const cam = new Camera();
  const b = opts.bounds; // world rect the camera may show { x0, y0, x1, y1 }
  const pts = new Map();
  const chunks = new Map(); // key -> { cv, s, gen }
  let gen = 1;
  let W = 0, H = 0, dpr = 1, raf = 0, alive = true, started = false;
  let drag = null, pinch = null;
  let minZ = 0.5, maxZ = opts.maxZ || 2.6;
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
    minZ = Math.max(W / (b.x1 - b.x0), H / (b.y1 - b.y0), opts.minZ || 0);
    if (!started) {
      cam.z = Math.max(minZ, Math.min(maxZ, opts.zoom || 1));
      const f = opts.focus || [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
      centerOn(f[0], f[1]);
      started = true;
    }
    cam.z = Math.max(minZ, Math.min(maxZ, cam.z));
    clampCam();
  }

  function centerOn(wx, wy) {
    cam.ox = W / 2 - wx * cam.z;
    cam.oy = H / 2 - wy * cam.z;
  }

  // The camera always keeps the screen covered by the painted world (no empty background).
  function clampCam() {
    const z = cam.z;
    const left = cam.ox + b.x0 * z, right = cam.ox + b.x1 * z;
    const top = cam.oy + b.y0 * z, bottom = cam.oy + b.y1 * z;
    if (right - left <= W) cam.ox = (W - (b.x1 + b.x0) * z) / 2;
    else if (left > 0) cam.ox -= left;
    else if (right < W) cam.ox += W - right;
    if (bottom - top <= H) cam.oy = (H - (b.y1 + b.y0) * z) / 2;
    else if (top > 0) cam.oy -= top;
    else if (bottom < H) cam.oy += H - bottom;
  }

  function setZoom(nz, sx = W / 2, sy = H / 2) {
    nz = Math.max(minZ, Math.min(maxZ, nz));
    cam.zoomAt(sx, sy, nz);
    clampCam();
  }

  const wantScale = () => {
    const s = cam.z * dpr;
    let best = STEPS[0];
    for (const q of STEPS) if (q <= s * 1.1) best = q;
    return Math.min(best, 3);
  };

  function buildChunk(i, j, s) {
    let ch = chunks.get(i + ',' + j);
    const size = Math.ceil(CH * s) + 2;
    if (!ch) { ch = { cv: document.createElement('canvas') }; chunks.set(i + ',' + j, ch); }
    if (ch.cv.width !== size) { ch.cv.width = size; ch.cv.height = size; }
    const cc = ch.cv.getContext('2d');
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.clearRect(0, 0, size, size);
    cc.setTransform(s, 0, 0, s, -i * CH * s, -j * CH * s);
    cc.save();
    cc.beginPath();
    cc.rect(i * CH, j * CH, CH + 2 / s, CH + 2 / s);
    cc.clip();
    opts.drawStatic(cc, { x0: i * CH, y0: j * CH, x1: (i + 1) * CH, y1: (j + 1) * CH });
    cc.restore();
    ch.s = s;
    ch.gen = gen;
  }

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    const s = wantScale();
    // visible chunk range
    const wx0 = -cam.ox / cam.z, wy0 = -cam.oy / cam.z;
    const wx1 = (W - cam.ox) / cam.z, wy1 = (H - cam.oy) / cam.z;
    const i0 = Math.floor(wx0 / CH), i1 = Math.floor(wx1 / CH);
    const j0 = Math.floor(wy0 / CH), j1 = Math.floor(wy1 / CH);
    let budget = pts.size ? 1 : 3;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = opts.bg || '#3f7a2c';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = true;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ch = chunks.get(i + ',' + j);
      const stale = !ch || ch.gen !== gen || ch.s !== s;
      if (!ch || (stale && budget > 0)) { buildChunk(i, j, s); if (ch) budget--; }
      const cur = chunks.get(i + ',' + j);
      const x = (cam.ox + i * CH * cam.z) * dpr, y = (cam.oy + j * CH * cam.z) * dpr;
      const sz = (CH + 2 / cur.s) * cam.z * dpr;
      c.drawImage(cur.cv, 0, 0, cur.cv.width, cur.cv.height, x, y, sz, sz);
    }
    c.setTransform(cam.z * dpr, 0, 0, cam.z * dpr, cam.ox * dpr, cam.oy * dpr);
    opts.drawDynamic(c, cam, t, W, H);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // drop far-away chunks to bound memory
    if (chunks.size > 40) {
      for (const k of chunks.keys()) {
        const [i, j] = k.split(',').map(Number);
        if (i < i0 - 2 || i > i1 + 2 || j < j0 - 2 || j > j1 + 2) chunks.delete(k);
      }
    }
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
      pinch = { d: Math.hypot(a.x - bb.x, a.y - bb.y) || 1, z: cam.z };
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
      if (!drag.moved && performance.now() - drag.t < 450) opts.onTap?.(x, y, e);
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
    zoomBy(f) { setZoom(cam.z * f); },
    center(wx, wy) { centerOn(wx, wy); clampCam(); },
    invalidate() { gen++; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      chunks.clear();
      canvas.remove();
    },
  };
}
