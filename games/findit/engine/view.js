// Canvas scene viewer: draws the rendered photo of the scene plus overlays
// (found outlines, effects) and handles pan / pinch-zoom / wheel / double-tap
// with inertia. Renders on demand (no idle rAF loop).

export class SceneView {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'g-findit-canvas';
    host.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = 1;
    this.h = 1;
    this.z = 1;
    this.tx = 0;
    this.ty = 0;
    this.minZ = 0.1;
    this.maxZ = 3;
    this.scene = null;
    this.effects = [];
    this.raf = 0;
    this.anim = null;
    this.inertia = null;
    this.pointers = new Map();
    this.gesture = null;
    this.pendingMiss = null;
    this.lastHit = null;
    this.locked = false;
    this.destroyed = false;

    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e);
    this._wheel = (e) => this.onWheel(e);
    const c = this.canvas;
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    c.addEventListener('lostpointercapture', this._up);
    c.addEventListener('wheel', this._wheel, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.pendingMiss) clearTimeout(this.pendingMiss.timer);
    this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    c.removeEventListener('lostpointercapture', this._up);
    c.removeEventListener('wheel', this._wheel);
    c.width = c.height = 1;
    this.scene = null;
    this.canvas.remove();
  }

  // scene: { W, H, img, edge, drawOver?(g, tnow), animating?() }
  setScene(scene) {
    this.scene = scene;
    this.computeLimits();
    this.fit(false);
    this.request();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const cx = this.scene ? (this.w / 2 - this.tx) / this.z : 0;
    const cy = this.scene ? (this.h / 2 - this.ty) / this.z : 0;
    const zr = this.scene ? this.z / this.minZ : 1;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.scene) {
      this.computeLimits();
      this.z = clamp(this.minZ * zr, this.minZ, this.maxZ);
      this.centerOn(cx, cy);
    }
    this.request();
  }

  computeLimits() {
    const { W, H } = this.scene;
    // fill the panel (the photo is wider than the phone: pan sideways)
    this.minZ = Math.max(this.w / W, this.h / H);
    // up to ~1.5 CSS px per photo pixel: still sharp on a phone
    this.maxZ = Math.max(this.minZ * 3.2, this.opts.maxZoom || 1.5);
  }

  fit(animate = true) {
    const { W, H } = this.scene;
    if (animate) this.flyTo(W / 2, H / 2, this.minZ, 420);
    else {
      this.z = this.minZ;
      this.centerOn(this.scene.startX ?? W / 2, H / 2);
    }
  }

  centerOn(wx, wy) {
    this.tx = this.w / 2 - wx * this.z;
    this.ty = this.h / 2 - wy * this.z;
    this.clampCam();
  }

  clampCam() {
    if (!this.scene) return;
    const { W, H } = this.scene;
    const sw = W * this.z, sh = H * this.z;
    this.tx = sw <= this.w ? (this.w - sw) / 2 : clamp(this.tx, this.w - sw, 0);
    this.ty = sh <= this.h ? (this.h - sh) / 2 : clamp(this.ty, this.h - sh, 0);
  }

  worldToScreen(x, y) {
    return { x: x * this.z + this.tx, y: y * this.z + this.ty };
  }
  screenToWorld(x, y) {
    return { x: (x - this.tx) / this.z, y: (y - this.ty) / this.z };
  }
  center() {
    return this.screenToWorld(this.w / 2, this.h / 2);
  }

  zoomAt(sx, sy, nz) {
    nz = clamp(nz, this.minZ, this.maxZ);
    const w = this.screenToWorld(sx, sy);
    this.z = nz;
    this.tx = sx - w.x * nz;
    this.ty = sy - w.y * nz;
    this.clampCam();
    this.request();
    if (this.opts.onZoom) this.opts.onZoom(this.z / this.minZ);
  }

  flyTo(wx, wy, z1, dur = 520, done) {
    const c0 = this.center();
    this.inertia = null;
    this.anim = { t0: now(), dur, x0: c0.x, y0: c0.y, z0: this.z, x1: wx, y1: wy, z1: clamp(z1, this.minZ, this.maxZ), done };
    this.request();
  }

  // ---------------------------------------------------------------- input
  onDown(e) {
    if (this.destroyed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const r = this.canvas.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.pointers.set(e.pointerId, p);
    this.inertia = null;
    if (this.anim && !this.anim.locked) this.anim = null;
    if (this.pointers.size === 1) {
      this.gesture = { type: 'pending', sx: p.x, sy: p.y, lx: p.x, ly: p.y, t: now(), mouse: e.pointerType === 'mouse', samples: [{ t: now(), x: p.x, y: p.y }] };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.gesture = { type: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.z, w: this.screenToWorld(mx, my) };
    }
  }

  onMove(e) {
    const p0 = this.pointers.get(e.pointerId);
    if (!p0 || !this.gesture) return;
    const r = this.canvas.getBoundingClientRect();
    p0.x = e.clientX - r.left;
    p0.y = e.clientY - r.top;
    const gs = this.gesture;
    if (gs.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      this.z = clamp((gs.z0 * d) / gs.d0, this.minZ, this.maxZ);
      this.tx = mx - gs.w.x * this.z;
      this.ty = my - gs.w.y * this.z;
      this.clampCam();
      this.request();
      if (this.opts.onZoom) this.opts.onZoom(this.z / this.minZ);
      return;
    }
    if (gs.type === 'pending' || gs.type === 'pan') {
      const thr = gs.mouse ? 4 : 9;
      if (gs.type === 'pending' && Math.hypot(p0.x - gs.sx, p0.y - gs.sy) > thr) {
        gs.type = 'pan';
        if (this.opts.onPan) this.opts.onPan();
      }
      if (gs.type === 'pan') {
        this.tx += p0.x - gs.lx;
        this.ty += p0.y - gs.ly;
        this.clampCam();
        this.request();
      }
      gs.lx = p0.x;
      gs.ly = p0.y;
      gs.samples.push({ t: now(), x: p0.x, y: p0.y });
      if (gs.samples.length > 8) gs.samples.shift();
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const gs = this.gesture;
    if (!gs) return;
    if (gs.type === 'pinch') {
      if (this.pointers.size === 1) {
        const q = [...this.pointers.values()][0];
        this.gesture = { type: 'pan', sx: q.x, sy: q.y, lx: q.x, ly: q.y, t: now(), noTap: true, samples: [{ t: now(), x: q.x, y: q.y }] };
      } else this.gesture = null;
      return;
    }
    if (this.pointers.size) return;
    this.gesture = null;
    if (e.type !== 'pointerup') return;
    if (gs.type === 'pending' && !gs.noTap && now() - gs.t < 550) this.tap(gs.sx, gs.sy);
    else if (gs.type === 'pan') {
      const s = gs.samples.filter((q) => now() - q.t < 110);
      if (s.length >= 2) {
        const a = s[0], b = s[s.length - 1];
        const dt = Math.max(16, b.t - a.t);
        const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
        if (Math.hypot(vx, vy) > 0.12) {
          this.inertia = { vx, vy, t: now() };
          this.request();
        }
      }
    }
  }

  onWheel(e) {
    e.preventDefault();
    if (!this.scene) return;
    const r = this.canvas.getBoundingClientRect();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;
    else if (e.deltaMode === 2) dy *= 400;
    dy = clamp(dy, -120, 120);
    this.anim = null;
    this.inertia = null;
    this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
  }

  tap(sx, sy) {
    if (this.locked || !this.scene) return;
    const t = now();
    if (this.lastHit && t - this.lastHit.t < 380 && Math.hypot(sx - this.lastHit.x, sy - this.lastHit.y) < 40) return;
    const pm = this.pendingMiss;
    if (pm && t - pm.t < 320 && Math.hypot(sx - pm.x, sy - pm.y) < 44) {
      clearTimeout(pm.timer);
      this.pendingMiss = null;
      this.doubleTap(sx, sy);
      return;
    }
    if (pm) {
      clearTimeout(pm.timer);
      this.pendingMiss = null;
      pm.fire();
    }
    const w = this.screenToWorld(sx, sy);
    const hit = this.opts.onTap ? this.opts.onTap(w.x, w.y, sx, sy) : false;
    if (hit) {
      this.lastHit = { t, x: sx, y: sy };
      return;
    }
    const fire = () => this.opts.onMiss && this.opts.onMiss(w.x, w.y, sx, sy);
    this.pendingMiss = { t, x: sx, y: sy, fire, timer: setTimeout(() => {
      this.pendingMiss = null;
      fire();
    }, 300) };
  }

  doubleTap(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    if (this.z > this.maxZ * 0.82) this.flyTo(this.scene.W / 2, this.scene.H / 2, this.minZ, 420);
    else this.flyTo(w.x, w.y, Math.min(this.maxZ, this.z * 2.2), 360);
    if (this.opts.onZoom) setTimeout(() => !this.destroyed && this.opts.onZoom(this.z / this.minZ), 400);
  }

  // ---------------------------------------------------------------- effects
  // effect: { dur (ms or Infinity), draw(g, t01 | ms, view), done? }
  addEffect(fx) {
    fx.t0 = now();
    this.effects.push(fx);
    this.request();
    return fx;
  }

  request() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(() => this.frame());
  }

  frame() {
    this.raf = 0;
    if (this.destroyed) return;
    const t = now();
    let more = false;
    if (this.anim) {
      const a = this.anim;
      const k = clamp((t - a.t0) / a.dur, 0, 1);
      const e = ease(k);
      this.z = Math.exp(Math.log(a.z0) + (Math.log(a.z1) - Math.log(a.z0)) * e);
      this.centerOn(a.x0 + (a.x1 - a.x0) * e, a.y0 + (a.y1 - a.y0) * e);
      if (k >= 1) {
        this.anim = null;
        if (a.done) a.done();
      } else more = true;
    }
    if (this.inertia) {
      const it = this.inertia;
      const dt = Math.min(40, t - it.t);
      it.t = t;
      const tx0 = this.tx, ty0 = this.ty;
      this.tx += it.vx * dt;
      this.ty += it.vy * dt;
      this.clampCam();
      if (this.tx === tx0) it.vx = 0;
      if (this.ty === ty0) it.vy = 0;
      const decay = Math.exp(-dt / 280);
      it.vx *= decay;
      it.vy *= decay;
      if (Math.hypot(it.vx, it.vy) < 0.02) this.inertia = null;
      else more = true;
    }
    this.draw(t);
    if (this.effects.length) more = true;
    if (this.scene && this.scene.animating && this.scene.animating(t)) more = true;
    if (more) this.request();
  }

  // Draws the world with a given camera (used for the main view and for the
  // magnifier lens).
  drawWorld(g, z, tx, ty, tnow) {
    const sc = this.scene;
    const dpr = this.dpr;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * tx, dpr * ty);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(sc.img, 0, 0, sc.W, sc.H);
    if (sc.drawOver) sc.drawOver(g, z, tx, ty, tnow);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  draw(t) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sc = this.scene;
    g.fillStyle = sc ? sc.edge || '#0a0a0c' : '#0a0a0c';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!sc) return;
    this.drawWorld(g, this.z, this.tx, this.ty, t);
    // screen-space effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      const el = t - fx.t0;
      const k = fx.dur === Infinity ? el : clamp(el / fx.dur, 0, 1);
      g.save();
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      try {
        fx.draw(g, k, this, el);
      } catch (err) {
        console.error(err);
        fx.done = true;
      }
      g.restore();
      if (fx.done || (fx.dur !== Infinity && k >= 1)) {
        this.effects.splice(i, 1);
        if (fx.onEnd) fx.onEnd();
      }
    }
  }
}
