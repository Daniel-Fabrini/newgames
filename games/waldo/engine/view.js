// Scene viewer for "Detetive dos Personagens": draws a big pre-rendered picture inside
// a pan / pinch / wheel / double-tap zoom camera with inertia, optionally limited to a
// region of the picture and mirrored, plus overlays (found rings, wrong-tap crosses, the
// magnifier hint). Renders on demand (no idle rAF loop).

const now = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class SceneView {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'g-waldo-canvas';
    this.canvas.setAttribute('role', 'img');
    host.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = 1;
    this.h = 1;
    this.z = 1;
    this.tx = 0;
    this.ty = 0;
    this.minZ = 0.1;
    this.maxZ = 2;
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
    this._ctx = (e) => e.preventDefault();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    c.addEventListener('lostpointercapture', this._up);
    c.addEventListener('wheel', this._wheel, { passive: false });
    c.addEventListener('contextmenu', this._ctx);
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
    c.removeEventListener('contextmenu', this._ctx);
    c.width = c.height = 1;
    this.scene = null;
    this.canvas.remove();
  }

  // scene: { W, H, img, mirror, region: {x,y,w,h}, marks: [{x,y,rx,ry}] }  (world = logical picture units)
  setScene(scene) {
    this.scene = scene;
    this.effects.length = 0;
    this.anim = null;
    this.inertia = null;
    if (!scene.region) scene.region = { x: 0, y: 0, w: scene.W, h: scene.H };
    this.computeLimits();
    this.fit(false);
    this.request();
  }

  resize() {
    if (this.destroyed) return;
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const had = !!this.scene;
    const cx = had ? (this.w / 2 - this.tx) / this.z : 0;
    const cy = had ? (this.h / 2 - this.ty) / this.z : 0;
    const zr = had ? this.z / this.minZ : 1;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (had) {
      this.computeLimits();
      this.z = clamp(this.minZ * zr, this.minZ, this.maxZ);
      this.centerOn(cx, cy);
    }
    this.request();
  }

  computeLimits() {
    const { w, h } = this.scene.region;
    // whole region visible (letterboxed) at the minimum zoom
    this.minZ = Math.min(this.w / w, this.h / h);
    this.coverZ = Math.max(this.w / w, this.h / h);
    this.maxZ = Math.max(this.coverZ * 2.4, this.opts.maxZoom || 1.7);
  }

  // Start on a camera that fills the panel; `at` optionally says where to look.
  fit(animate = true) {
    const rg = this.scene.region;
    if (animate) this.flyTo(rg.x + rg.w / 2, rg.y + rg.h / 2, this.coverZ, 420);
    else {
      this.z = this.coverZ;
      this.centerOn(rg.x + rg.w / 2, rg.y + rg.h / 2);
    }
  }

  centerOn(wx, wy) {
    this.tx = this.w / 2 - wx * this.z;
    this.ty = this.h / 2 - wy * this.z;
    this.clampCam();
  }

  clampCam() {
    if (!this.scene) return;
    const rg = this.scene.region;
    const sw = rg.w * this.z, sh = rg.h * this.z;
    this.tx = sw <= this.w ? (this.w - sw) / 2 - rg.x * this.z : clamp(this.tx, this.w - (rg.x + rg.w) * this.z, -rg.x * this.z);
    this.ty = sh <= this.h ? (this.h - sh) / 2 - rg.y * this.z : clamp(this.ty, this.h - (rg.y + rg.h) * this.z, -rg.y * this.z);
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
    this.anim = null;
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
      return;
    }
    if (gs.type === 'pending' || gs.type === 'pan') {
      const thr = gs.mouse ? 4 : 9;
      if (gs.type === 'pending' && Math.hypot(p0.x - gs.sx, p0.y - gs.sy) > thr) gs.type = 'pan';
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
    if (gs.type === 'pending' && !gs.noTap && now() - gs.t < 600) this.tap(gs.sx, gs.sy);
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

  // A tap: hits resolve at once, misses wait a moment so a double-tap can zoom instead.
  tap(sx, sy) {
    if (this.locked || !this.scene) return;
    const t = now();
    if (this.lastHit && t - this.lastHit.t < 380 && Math.hypot(sx - this.lastHit.x, sy - this.lastHit.y) < 40) return;
    const pm = this.pendingMiss;
    if (pm && t - pm.t < 330 && Math.hypot(sx - pm.x, sy - pm.y) < 46) {
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
    this.pendingMiss = {
      t,
      x: sx,
      y: sy,
      fire,
      timer: setTimeout(() => {
        this.pendingMiss = null;
        fire();
      }, 310),
    };
  }

  doubleTap(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    if (this.z > this.maxZ * 0.8) this.fit(true);
    else this.flyTo(w.x, w.y, Math.min(this.maxZ, this.z * 2.3), 340);
  }

  // ---------------------------------------------------------------- effects
  // effect: { dur (ms or Infinity), draw(g, k01 | ms, view, elapsedMs), onEnd? }
  addEffect(fx) {
    fx.t0 = now();
    this.effects.push(fx);
    this.request();
    return fx;
  }
  removeEffect(fx) {
    const i = this.effects.indexOf(fx);
    if (i >= 0) this.effects.splice(i, 1);
    this.request();
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
    if (this.scene && this.scene.marks && this.scene.marks.some((m) => t - m.t0 < 420)) more = true;
    if (more) this.request();
  }

  draw(t) {
    const g = this.g;
    const sc = this.scene;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050507';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!sc || !sc.img) return;
    const dpr = this.dpr, z = this.z;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * this.tx, dpr * this.ty);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if (sc.mirror) {
      g.save();
      g.translate(sc.W, 0);
      g.scale(-1, 1);
      g.drawImage(sc.img, 0, 0, sc.W, sc.H);
      g.restore();
    } else g.drawImage(sc.img, 0, 0, sc.W, sc.H);
    // found markers (world space)
    if (sc.marks) {
      for (const m of sc.marks) {
        const pulse = Math.min(1, (t - m.t0) / 380);
        const k = 1 - Math.pow(1 - pulse, 3);
        const rx = m.rx * (1.5 - 0.5 * k) + 6 / z, ry = m.ry * (1.5 - 0.5 * k) + 6 / z;
        g.globalAlpha = k;
        g.lineWidth = 5 / z;
        g.strokeStyle = '#2ee66b';
        g.beginPath();
        g.ellipse(m.x, m.y, rx, ry, 0, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 2 / z;
        g.strokeStyle = '#fff';
        g.beginPath();
        g.ellipse(m.x, m.y, rx + 3 / z, ry + 3 / z, 0, 0, Math.PI * 2);
        g.stroke();
        // check badge
        const bx = m.x + rx * 0.72, by = m.y - ry * 0.72, br = 13 / z;
        g.fillStyle = '#2ee66b';
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 2.6 / z;
        g.strokeStyle = '#06210f';
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(bx - br * 0.45, by + br * 0.02);
        g.lineTo(bx - br * 0.1, by + br * 0.38);
        g.lineTo(bx + br * 0.5, by - br * 0.34);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // screen-space effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      const el = t - fx.t0;
      const k = fx.dur === Infinity ? el : clamp(el / fx.dur, 0, 1);
      g.save();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
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
