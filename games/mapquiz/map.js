// Interactive world map on a <canvas>: wrap-around panning, pinch / wheel /
// double-tap zoom with inertia, animated camera flights, glowing highlights,
// markers for tiny countries, forgiving hit-testing and floating label pins.
// Geometry comes from map-data.js (integer coordinates, see its header).

import { SHAPES, OTHER, MAP_W, MAP_H, VIEWS, GRATICULE } from './map-data.js';

const LO_DETAIL_BELOW = 0.075; // px per stored unit: below this, draw low-detail paths
const MARKER_BELOW = 13; // countries smaller than this (px) get a tappable marker
const TAP_SLOP = 9; // px a finger may move and still count as a tap
const DOUBLE_TAP_MS = 250;

export const COLORS = {
  good: '#34d17f',
  ok: '#e9b949',
  miss: '#e2475a',
  bad: '#ff4d5e',
  sel: '#f5c542',
  gold: '#f5c542',
  reveal: '#f5c542',
  seen: 'rgba(247, 215, 116, 0.2)',
};
const GOLD_A = '#f7d774';
const GOLD_B = '#c9971c';

// ---------------------------------------------------------------- geometry cache
let GEO = null;

function parseRings(d) {
  const rings = [];
  const tok = d.match(/[Mlz]|-?\d+/g) || [];
  let mode = 'M';
  let ring = null;
  let x = 0;
  let y = 0;
  let px = null;
  for (const t of tok) {
    if (t === 'M' || t === 'l') {
      mode = t;
      continue;
    }
    if (t === 'z') {
      if (ring && ring.length >= 6) rings.push(Int32Array.from(ring));
      ring = null;
      continue;
    }
    const v = +t;
    if (px === null) {
      px = v;
      continue;
    }
    if (mode === 'M') {
      x = px;
      y = v;
      ring = [x, y];
    } else {
      x += px;
      y += v;
      ring.push(x, y);
    }
    px = null;
  }
  return rings;
}

function ringBox(r) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < r.length; i += 2) {
    if (r[i] < x0) x0 = r[i];
    if (r[i] > x1) x1 = r[i];
    if (r[i + 1] < y0) y0 = r[i + 1];
    if (r[i + 1] > y1) y1 = r[i + 1];
  }
  return [x0, y0, x1, y1];
}

export function geometry() {
  if (GEO) return GEO;
  const shapes = {};
  for (const [code, s] of Object.entries(SHAPES)) {
    const g = { code, p: s.p, size: s.s, b: s.b || [s.p[0], s.p[1], s.p[0], s.p[1]], hasGeo: !!s.d };
    if (s.d) {
      g.hi = new Path2D(s.d);
      g.lo = new Path2D(s.l || s.d);
      g.rings = parseRings(s.d);
      g.boxes = g.rings.map(ringBox);
    }
    shapes[code] = g;
  }
  GEO = { shapes, otherHi: new Path2D(OTHER.d), otherLo: new Path2D(OTHER.l || OTHER.d) };
  return GEO;
}

function insideRings(g, px, py) {
  let c = false;
  for (let k = 0; k < g.rings.length; k++) {
    const b = g.boxes[k];
    if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) continue;
    const r = g.rings[k];
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const yi = r[i + 1];
      const yj = r[j + 1];
      if (yi > py !== yj > py && px < ((r[j] - r[i]) * (py - yi)) / (yj - yi) + r[i]) c = !c;
    }
  }
  return c;
}

function distToRings(g, px, py, max) {
  let best = max * max;
  for (let k = 0; k < g.rings.length; k++) {
    const b = g.boxes[k];
    if (px < b[0] - max || px > b[2] + max || py < b[1] - max || py > b[3] + max) continue;
    const r = g.rings[k];
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const ax = r[j];
      const ay = r[j + 1];
      const dx = r[i] - ax;
      const dy = r[i + 1] - ay;
      let t = dx || dy ? ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy) : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (v, m) => ((v % m) + m) % m;

// ---------------------------------------------------------------- MapView
export class MapView {
  // opts: { onTap(code|null, {x,y}), onPress(code), labelFor(code) -> string, labels: bool, tapDelay,
  //         markers: 'all' | 'states' (only countries with a state), markerBelow: px }
  constructor(parent, opts = {}) {
    this.opts = opts;
    this.geo = geometry();
    this.el = document.createElement('div');
    this.el.className = 'g-mapquiz-map';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.pinsEl = document.createElement('div');
    this.pinsEl.className = 'g-mapquiz-pins';
    this.el.append(this.canvas, this.pinsEl);
    this.el.mapView = this; // handy for debugging / automated tests
    parent.append(this.el);
    this.ctx = this.canvas.getContext('2d');

    this.vw = 1;
    this.vh = 1;
    this.dpr = 1;
    this.cam = { cx: MAP_W / 2, cy: MAP_H / 2, s: 0.02 };
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.active = null; // Set of codes, or null = every country
    this.states = new Map(); // code -> good | ok | miss | sel | seen
    this.flashes = [];
    this.pulses = [];
    this.pins = [];
    this.hover = null;
    this.press = null;
    this.labels = !!opts.labels;
    this.labelCache = new Map();
    this.pointers = new Map();
    this.gesture = null;
    this.tween = null;
    this.inertia = null;
    this.wheelZoom = null;
    this.pendingFit = null;
    this.raf = 0;
    this.tapTimer = 0;
    this.lastTap = null;
    this.destroyed = false;
    this.buildCombined();

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onLeave = () => this.setHover(null);
    this.frame = this.frame.bind(this);
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.tapTimer);
    this.ro.disconnect();
    this.el.remove();
  }

  // ------------------------------------------------------------ setup
  resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.vw = r.width;
    this.vh = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    this.gradient = null;
    if (this.pendingFit) {
      const f = this.pendingFit;
      this.pendingFit = null;
      this.fitRect(f.rect, f.opts);
    } else this.clampCam(this.cam);
    this.draw(performance.now());
  }

  get sMin() {
    return this.vw / MAP_W;
  }
  get sMax() {
    return Math.max(this.sMin * 160, 1.2);
  }

  setInsets(insets) {
    Object.assign(this.insets, insets);
    this.clampCam(this.cam);
    this.requestRender();
  }

  setActive(codes) {
    this.active = codes ? new Set(codes) : null;
    this.buildCombined();
    this.requestRender();
  }

  isActive(code) {
    return !!this.geo.shapes[code] && (!this.active || this.active.has(code));
  }

  buildCombined() {
    const lo = { act: new Path2D(), ina: new Path2D() };
    for (const g of Object.values(this.geo.shapes)) {
      if (!g.hasGeo) continue;
      (this.isActive(g.code) ? lo.act : lo.ina).addPath(g.lo);
    }
    const all = new Path2D();
    all.addPath(lo.act);
    all.addPath(lo.ina);
    all.addPath(this.geo.otherLo);
    lo.all = all;
    this.combined = lo;
  }

  setState(code, state) {
    if (state) this.states.set(code, state);
    else this.states.delete(code);
    this.requestRender();
  }

  clearStates() {
    this.states.clear();
    this.flashes = [];
    this.pulses = [];
    this.clearPins();
    this.requestRender();
  }

  setLabels(on) {
    this.labels = !!on;
    this.requestRender();
  }

  // kind: good | bad | sel | reveal. reveal loops until stopFlash(code).
  flash(code, kind, dur = kind === 'bad' ? 900 : 1100) {
    this.flashes = this.flashes.filter((f) => f.code !== code);
    this.flashes.push({ code, kind, t0: performance.now(), dur, loop: kind === 'reveal' });
    if (kind === 'reveal' || kind === 'good' || kind === 'sel') this.pulse(code, kind);
    this.requestRender();
  }

  stopFlash(code) {
    this.flashes = this.flashes.filter((f) => f.code !== code);
    this.pulses = this.pulses.filter((p) => p.code !== code);
    this.requestRender();
  }

  pulse(code, kind) {
    this.pulses = this.pulses.filter((p) => p.code !== code);
    this.pulses.push({ code, kind, t0: performance.now(), loop: kind === 'reveal' });
  }

  // dashed circle around an area (hints); x, y, r in stored map units
  showArea(x, y, r, ms = 4000) {
    const now = performance.now();
    this.area = { x, y, r, t0: now, until: now + ms };
    this.requestRender();
  }

  // ------------------------------------------------------------ pins (HTML labels)
  pin(code, text, kind = 'info', ms = 1600) {
    const g = this.geo.shapes[code];
    if (!g) return null;
    this.pins = this.pins.filter((p) => {
      if (p.code === code) {
        p.el.remove();
        return false;
      }
      return true;
    });
    const el = document.createElement('div');
    el.className = `g-mapquiz-pin ${kind}`;
    el.textContent = text;
    this.pinsEl.append(el);
    const p = { code, el, until: ms ? performance.now() + ms : Infinity };
    this.pins.push(p);
    this.placePin(p);
    this.requestRender();
    return p;
  }

  clearPins() {
    for (const p of this.pins) p.el.remove();
    this.pins = [];
  }

  placePin(p) {
    const g = this.geo.shapes[p.code];
    const [x, y] = this.toScreen(g.p[0], g.p[1]);
    const marker = this.markerVisible(g);
    p.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - (marker ? 12 : 4)).toFixed(1)}px) translate(-50%, -100%)`;
  }

  // ------------------------------------------------------------ camera
  toScreen(wx, wy) {
    const { cx, cy, s } = this.cam;
    // pick the copy of the wrapped world nearest the view centre
    const dx = mod(wx - cx + MAP_W / 2, MAP_W) - MAP_W / 2;
    return [this.vw / 2 + dx * s, this.vh / 2 + (wy - cy) * s];
  }

  toWorld(sx, sy) {
    const { cx, cy, s } = this.cam;
    return [cx + (sx - this.vw / 2) / s, cy + (sy - this.vh / 2) / s];
  }

  clampCam(c) {
    c.s = clamp(c.s, this.sMin, this.sMax);
    const top = (this.vh / 2 - this.insets.top) / c.s;
    const bottom = MAP_H - (this.vh / 2 - this.insets.bottom) / c.s;
    c.cy = top > bottom ? (top + bottom) / 2 : clamp(c.cy, top, bottom);
    return c;
  }

  normalize() {
    this.cam.cx = mod(this.cam.cx, MAP_W);
  }

  stopMotion() {
    this.tween = null;
    this.inertia = null;
    this.wheelZoom = null;
  }

  // camera that shows rect [x0,y0,x1,y1] inside the free area (minus insets)
  // fill (0..1): 0 = show the whole rect, 1 = cover the free area with it
  cameraFor(rect, { pad = 16, maxS = Infinity, minSize = 0, fill = 0 } = {}) {
    let [x0, y0, x1, y1] = rect;
    if (x1 - x0 < minSize) {
      const m = (x0 + x1) / 2;
      x0 = m - minSize / 2;
      x1 = m + minSize / 2;
    }
    if (y1 - y0 < minSize * 0.75) {
      const m = (y0 + y1) / 2;
      y0 = m - minSize * 0.375;
      y1 = m + minSize * 0.375;
    }
    const { top, bottom, left, right } = this.insets;
    const aw = Math.max(40, this.vw - left - right - pad * 2);
    const ah = Math.max(40, this.vh - top - bottom - pad * 2);
    const sContain = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const sCover = Math.max(aw / (x1 - x0), ah / (y1 - y0));
    // blend towards "cover" but keep at least 85% of the rect's width/height visible
    const sKeep = Math.min(aw / (0.85 * (x1 - x0)), ah / (0.85 * (y1 - y0)));
    const sFill = Math.max(sContain, Math.min(sContain * Math.pow(sCover / sContain, fill), sKeep));
    const s = clamp(Math.min(sFill, maxS), this.sMin, this.sMax);
    const cx = (x0 + x1) / 2 - (left - right) / 2 / s;
    const cy = (y0 + y1) / 2 - (top - bottom) / 2 / s;
    return this.clampCam({ cx, cy, s });
  }

  fitRect(rect, opts = {}) {
    if (this.vw <= 1) {
      this.pendingFit = { rect, opts: { ...opts, animate: false } };
      return;
    }
    const target = this.cameraFor(rect, opts);
    if (opts.animate) this.flyTo(target, opts.dur);
    else {
      this.stopMotion();
      this.cam = target;
      this.normalize();
      this.requestRender();
    }
  }

  fitView(key, opts = {}) {
    this.fitRect(VIEWS[key] || VIEWS.world, { fill: key === 'world' ? 0 : 0.42, ...opts });
  }

  focus(code, opts = {}) {
    const g = this.geo.shapes[code];
    if (!g) return;
    const [x0, y0, x1, y1] = g.b;
    const w = x1 - x0;
    const hgt = y1 - y0;
    const rect = [x0 - w * 0.35, y0 - hgt * 0.35, x1 + w * 0.35, y1 + hgt * 0.35];
    // big countries: keep current zoom if it already shows them nicely
    this.fitRect(rect, { animate: true, minSize: 1500, pad: 30, ...opts });
  }

  // Is the country's label point comfortably inside the visible area?
  isInView(code, margin = 30) {
    const g = this.geo.shapes[code];
    if (!g) return false;
    const [x, y] = this.toScreen(g.p[0], g.p[1]);
    return x > margin && x < this.vw - margin && y > this.insets.top + margin && y < this.vh - this.insets.bottom - margin;
  }

  // pans (without zooming) so the country is not hidden under overlays
  ensureVisible(code) {
    if (this.isInView(code, 40)) return;
    const g = this.geo.shapes[code];
    if (!g) return;
    const { top, bottom } = this.insets;
    const s = this.cam.s;
    this.flyTo(this.clampCam({ s, cx: g.p[0], cy: g.p[1] - (top - bottom) / 2 / s }), 500);
  }

  flyTo(target, dur) {
    const from = { ...this.cam };
    const to = { ...target };
    to.cx = from.cx + (mod(to.cx - from.cx + MAP_W / 2, MAP_W) - MAP_W / 2);
    const smin = Math.min(from.s, to.s);
    const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy) * smin;
    const bump = clamp(dist / (this.vw * 3), 0, 0.55);
    const zoomDelta = Math.abs(Math.log(to.s / from.s));
    this.inertia = null;
    this.wheelZoom = null;
    this.tween = {
      from,
      to,
      bump,
      t0: performance.now(),
      dur: dur || clamp(450 + zoomDelta * 110 + bump * 600, 450, 1300),
    };
    this.requestRender();
  }

  zoomBy(factor, sx = this.vw / 2, sy = (this.insets.top + this.vh - this.insets.bottom) / 2) {
    const target = { ...this.cam };
    const [wx, wy] = this.toWorld(sx, sy);
    target.s = clamp(this.cam.s * factor, this.sMin, this.sMax);
    target.cx = wx - (sx - this.vw / 2) / target.s;
    target.cy = wy - (sy - this.vh / 2) / target.s;
    this.flyTo(this.clampCam(target), 380);
  }

  zoomAround(factor, sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    const c = this.cam;
    c.s = clamp(c.s * factor, this.sMin, this.sMax);
    c.cx = wx - (sx - this.vw / 2) / c.s;
    c.cy = wy - (sy - this.vh / 2) / c.s;
    this.clampCam(c);
  }

  // ------------------------------------------------------------ input
  localXY(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const [x, y] = this.localXY(e);
    this.pointers.set(e.pointerId, { x, y });
    this.stopMotion();
    const now = performance.now();
    if (this.pointers.size === 1) {
      this.gesture = { sx: x, sy: y, lx: x, ly: y, t0: now, lt: now, moved: false, multi: false, vx: 0, vy: 0 };
    } else if (this.pointers.size === 2 && this.gesture) {
      this.gesture.multi = true;
      this.startPinch();
    }
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const [wx, wy] = this.toWorld(mx, my);
    this.gesture.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), s0: this.cam.s, wx, wy };
  }

  onMove(e) {
    const [x, y] = this.localXY(e);
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && !this.pointers.size && this.opts.onTap) this.setHover(this.hitTest(x, y));
      return;
    }
    p.x = x;
    p.y = y;
    const g = this.gesture;
    if (!g) return;
    const now = performance.now();
    if (this.pointers.size >= 2 && g.pinch) {
      const [a, b] = [...this.pointers.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const c = this.cam;
      c.s = clamp((g.pinch.s0 * d) / g.pinch.d0, this.sMin, this.sMax);
      c.cx = g.pinch.wx - (mx - this.vw / 2) / c.s;
      c.cy = g.pinch.wy - (my - this.vh / 2) / c.s;
      this.clampCam(c);
      g.moved = true;
      this.cancelPress();
      this.requestRender();
      return;
    }
    if (!g.moved && Math.hypot(x - g.sx, y - g.sy) > (e.pointerType === 'mouse' ? 4 : TAP_SLOP)) {
      g.moved = true;
      g.lx = x;
      g.ly = y;
      this.cancelPress();
      this.el.classList.add('dragging');
    }
    if (g.moved) {
      const dx = x - g.lx;
      const dy = y - g.ly;
      const dt = Math.max(1, now - g.lt);
      this.cam.cx -= dx / this.cam.s;
      this.cam.cy -= dy / this.cam.s;
      this.clampCam(this.cam);
      g.vx = g.vx * 0.6 + (dx / dt) * 0.4;
      g.vy = g.vy * 0.6 + (dy / dt) * 0.4;
      g.lx = x;
      g.ly = y;
      g.lt = now;
      this.requestRender();
    }
  }

  onUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    if (this.pointers.size === 1) {
      // pinch -> pan with the remaining finger
      const [p] = [...this.pointers.values()];
      g.pinch = null;
      g.lx = p.x;
      g.ly = p.y;
      g.lt = performance.now();
      g.vx = g.vy = 0;
      return;
    }
    if (this.pointers.size > 0) return;
    this.gesture = null;
    this.el.classList.remove('dragging');
    const now = performance.now();
    if (e.type === 'pointercancel') {
      this.normalize();
      return;
    }
    if (!g.moved && !g.multi && now - g.t0 < 700) {
      this.handleTap(g.sx, g.sy);
      return;
    }
    if (g.moved && !g.multi && now - g.lt < 80 && Math.hypot(g.vx, g.vy) > 0.25) {
      this.inertia = { vx: g.vx, vy: g.vy, t: now };
      this.requestRender();
    } else this.normalize();
  }

  handleTap(x, y) {
    const now = performance.now();
    const last = this.lastTap;
    if (last && now - last.t < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < 40) {
      clearTimeout(this.tapTimer);
      this.lastTap = null;
      this.press = null;
      this.zoomBy(2.2, x, y);
      return;
    }
    if (!this.opts.onTap) {
      this.lastTap = { t: now, x, y };
      return;
    }
    const code = this.hitTest(x, y);
    this.press = code;
    this.lastTap = { t: now, x, y };
    if (this.opts.onPress) this.opts.onPress(code);
    this.requestRender();
    clearTimeout(this.tapTimer);
    const delay = this.opts.tapDelay ?? DOUBLE_TAP_MS;
    this.tapTimer = setTimeout(() => {
      this.press = null;
      this.requestRender();
      if (!this.destroyed && this.opts.onTap) this.opts.onTap(code, { x, y });
    }, delay);
  }

  cancelPress() {
    if (this.press !== null || this.lastTap) {
      this.press = null;
      this.lastTap = null;
      clearTimeout(this.tapTimer);
    }
  }

  onWheel(e) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const [x, y] = this.localXY(e);
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      this.stopMotion();
      this.cam.cx += (e.deltaX * unit) / this.cam.s;
      this.normalize();
      this.requestRender();
      return;
    }
    const k = e.ctrlKey ? 0.01 : 0.0022;
    const f = Math.exp(clamp(-e.deltaY * unit * k, -0.9, 0.9));
    this.tween = null;
    this.inertia = null;
    const base = this.wheelZoom ? this.wheelZoom.s : this.cam.s;
    this.wheelZoom = { s: clamp(base * f, this.sMin, this.sMax), x, y };
    this.requestRender();
  }

  setHover(code) {
    if (code === this.hover) return;
    this.hover = code;
    this.canvas.style.cursor = code ? 'pointer' : '';
    this.requestRender();
  }

  // ------------------------------------------------------------ hit testing
  markerVisible(g) {
    if (this.opts.markers === 'states' && !this.states.has(g.code)) return false;
    if (!g.hasGeo) return true;
    const px = g.size * this.cam.s; // on-screen size of the country
    // small countries, or anything that is only a few pixels wide right now
    return px < (this.opts.markerBelow ?? MARKER_BELOW) && (px < 4 || g.size < 150);
  }

  markerRadius() {
    return clamp(2.6 + Math.log2(this.cam.s / this.sMin) * 1.1, 2.6, 7.5);
  }

  hitTest(sx, sy) {
    const [wx0, wy] = this.toWorld(sx, sy);
    const s = this.cam.s;
    const rM = this.markerRadius();
    const shapes = Object.values(this.geo.shapes);
    // nearest visible marker (tiny countries)
    let mCode = null;
    let mD = Infinity;
    for (const g of shapes) {
      if (!this.isActive(g.code) || !this.markerVisible(g)) continue;
      const [mx, my] = this.toScreen(g.p[0], g.p[1]);
      const d = Math.hypot(mx - sx, my - sy) - rM;
      if (d < mD) {
        mD = d;
        mCode = g.code;
      }
    }
    // 1) right on a marker
    if (mCode && mD <= 4) return mCode;
    const xw = mod(wx0, MAP_W);
    const wxs = [xw, xw - MAP_W, xw + MAP_W];
    // 2) inside a polygon
    for (const g of shapes) {
      if (!g.hasGeo || !this.isActive(g.code)) continue;
      for (const wx of wxs) {
        if (wx < g.b[0] || wx > g.b[2] || wy < g.b[1] || wy > g.b[3]) continue;
        if (insideRings(g, wx, wy)) return g.code;
      }
    }
    // 3) forgiving: nearest marker or coast/border within a finger's width
    const slopPx = 22;
    const slop = slopPx / s;
    let best = mCode && mD < slopPx ? mCode : null;
    let bestD = best ? mD : Infinity;
    for (const g of shapes) {
      if (!g.hasGeo || !this.isActive(g.code)) continue;
      for (const wx of wxs) {
        if (wx < g.b[0] - slop || wx > g.b[2] + slop || wy < g.b[1] - slop || wy > g.b[3] + slop) continue;
        const d = distToRings(g, wx, wy, slop) * s;
        if (d < slopPx && d < bestD) {
          best = g.code;
          bestD = d;
        }
      }
    }
    return best;
  }

  // ------------------------------------------------------------ animation loop
  requestRender() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    if (this.destroyed) return;
    let more = false;
    const c = this.cam;
    if (this.tween) {
      const tw = this.tween;
      const t = clamp((now - tw.t0) / tw.dur, 0, 1);
      const e = ease(t);
      c.cx = tw.from.cx + (tw.to.cx - tw.from.cx) * e;
      c.cy = tw.from.cy + (tw.to.cy - tw.from.cy) * e;
      c.s = Math.exp(Math.log(tw.from.s) + (Math.log(tw.to.s) - Math.log(tw.from.s)) * e) * (1 - tw.bump * Math.sin(Math.PI * e));
      c.s = clamp(c.s, this.sMin, this.sMax);
      if (t >= 1) {
        this.tween = null;
        Object.assign(c, tw.to);
        this.normalize();
        if (tw.done) tw.done();
      } else more = true;
    }
    if (this.inertia) {
      const it = this.inertia;
      const dt = Math.min(40, now - it.t);
      it.t = now;
      c.cx -= (it.vx * dt) / c.s;
      c.cy -= (it.vy * dt) / c.s;
      const f = Math.pow(0.94, dt / 16);
      it.vx *= f;
      it.vy *= f;
      this.clampCam(c);
      if (Math.hypot(it.vx, it.vy) < 0.02) {
        this.inertia = null;
        this.normalize();
      } else more = true;
    }
    if (this.wheelZoom) {
      const wz = this.wheelZoom;
      const ls = Math.log(c.s);
      const lt = Math.log(wz.s);
      const next = Math.abs(lt - ls) < 0.004 ? wz.s : Math.exp(ls + (lt - ls) * 0.3);
      this.zoomAround(next / c.s, wz.x, wz.y);
      if (next === wz.s) {
        this.wheelZoom = null;
        this.normalize();
      } else more = true;
    }
    if (this.draw(now)) more = true;
    if (more) this.requestRender();
  }

  // ------------------------------------------------------------ drawing
  draw(now) {
    const ctx = this.ctx;
    const { vw, vh, dpr } = this;
    const { cx, cy, s } = this.cam;
    let animating = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ocean
    if (!this.gradient) {
      const g = ctx.createRadialGradient(vw * 0.5, vh * 0.42, 0, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.85);
      g.addColorStop(0, '#1b1e26');
      g.addColorStop(0.55, '#121419');
      g.addColorStop(1, '#09090b');
      this.gradient = g;
    }
    ctx.fillStyle = this.gradient;
    ctx.fillRect(0, 0, vw, vh);

    // graticule
    ctx.strokeStyle = 'rgba(247, 215, 116, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const oy = vh / 2 - cy * s;
    for (const gy of GRATICULE) {
      const y = Math.round(oy + gy * s) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
    }
    const step = MAP_W / 12;
    const x0w = cx - vw / 2 / s;
    for (let k = Math.floor(x0w / step); k * step < x0w + vw / s; k++) {
      const x = Math.round(vw / 2 + (k * step - cx) * s) + 0.5;
      ctx.moveTo(x, Math.max(0, oy));
      ctx.lineTo(x, Math.min(vh, oy + MAP_H * s));
    }
    ctx.stroke();

    const lo = s < LO_DETAIL_BELOW;
    const viewX0 = cx - vw / 2 / s;
    const viewX1 = cx + vw / 2 / s;
    const viewY0 = cy - vh / 2 / s;
    const viewY1 = cy + vh / 2 / s;
    const shapes = this.geo.shapes;
    const kFrom = Math.floor((viewX0 - MAP_W * 0.1) / MAP_W);
    const kTo = Math.floor((viewX1 + MAP_W * 0.1) / MAP_W);
    const px = 1 / s; // one CSS pixel in world units

    // land gradient (world space) – soft north/south shading
    if (!this.landGrad) {
      const lg = ctx.createLinearGradient(0, 0, 0, MAP_H);
      lg.addColorStop(0, '#4a4950');
      lg.addColorStop(0.45, '#3c3b42');
      lg.addColorStop(1, '#313036');
      this.landGrad = lg;
    }

    for (let k = kFrom; k <= kTo; k++) {
      const ox = k * MAP_W;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (vw / 2 + (ox - cx) * s), dpr * (vh / 2 - cy * s));
      const visible = [];
      for (const g of Object.values(shapes)) {
        if (!g.hasGeo) continue;
        const b = g.b;
        if (b[2] + ox < viewX0 || b[0] + ox > viewX1 || b[3] < viewY0 || b[1] > viewY1) continue;
        visible.push(g);
      }
      const pathOf = (g) => (lo ? g.lo : g.hi);

      // drop shadow + coastal glow
      ctx.save();
      ctx.translate(0, 2.2 * px);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      if (lo) ctx.fill(this.combined.all, 'evenodd');
      else {
        for (const g of visible) ctx.fill(pathOf(g), 'evenodd');
        ctx.fill(this.geo.otherHi, 'evenodd');
      }
      ctx.restore();

      // inactive land
      ctx.fillStyle = '#202025';
      ctx.strokeStyle = 'rgba(201, 151, 28, 0.25)';
      ctx.lineWidth = 0.7 * px;
      ctx.fill(lo ? this.geo.otherLo : this.geo.otherHi, 'evenodd');
      if (lo) {
        ctx.fill(this.combined.ina, 'evenodd');
        ctx.stroke(this.combined.ina);
      } else
        for (const g of visible)
          if (!this.isActive(g.code)) {
            ctx.fill(g.hi, 'evenodd');
            ctx.stroke(g.hi);
          }

      // active land
      ctx.fillStyle = this.landGrad;
      ctx.strokeStyle = 'rgba(226, 182, 76, 0.62)';
      ctx.lineWidth = 0.85 * px;
      if (lo) {
        ctx.fill(this.combined.act, 'evenodd');
        ctx.stroke(this.combined.act);
      } else
        for (const g of visible)
          if (this.isActive(g.code)) {
            ctx.fill(g.hi, 'evenodd');
            ctx.stroke(g.hi);
          }

      // painted states / hover / press
      for (const g of visible) {
        const st = this.states.get(g.code);
        const hov = g.code === this.hover || g.code === this.press;
        if (!st && !hov) continue;
        const p = pathOf(g);
        if (st) {
          if (st === 'gold') {
            const gg = ctx.createLinearGradient(g.b[0], g.b[1], g.b[2], g.b[3]);
            gg.addColorStop(0, GOLD_A);
            gg.addColorStop(1, GOLD_B);
            ctx.save();
            ctx.shadowColor = 'rgba(247, 215, 116, 0.75)';
            ctx.shadowBlur = 22 * dpr;
            ctx.fillStyle = gg;
            ctx.fill(p, 'evenodd');
            ctx.restore();
          } else {
            ctx.fillStyle = COLORS[st] || st;
            ctx.fill(p, 'evenodd');
          }
        }
        if (hov) {
          ctx.fillStyle = g.code === this.press ? 'rgba(247, 215, 116, 0.34)' : 'rgba(247, 215, 116, 0.16)';
          ctx.fill(p, 'evenodd');
        }
        ctx.strokeStyle = st === 'seen' || !st ? 'rgba(247, 215, 116, 0.95)' : 'rgba(255, 246, 214, 0.85)';
        ctx.lineWidth = (hov ? 1.5 : st && st !== 'seen' ? 1.2 : 0.9) * px;
        ctx.stroke(p);
      }

      // flashes (glow)
      for (const f of this.flashes) {
        const g = shapes[f.code];
        if (!g || !g.hasGeo) continue;
        const t = (now - f.t0) / f.dur;
        if (!f.loop && t >= 1) continue;
        animating = true;
        const a = f.loop ? 0.55 + 0.45 * Math.sin((now - f.t0) / 180) : Math.sin(Math.min(1, t) * Math.PI) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.4);
        const color = COLORS[f.kind] || COLORS.sel;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 26 * dpr * Math.max(0.3, a);
        ctx.globalAlpha = 0.45 + 0.55 * a;
        ctx.fillStyle = color;
        ctx.fill(pathOf(g), 'evenodd');
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#fff6d6';
        ctx.lineWidth = 1.6 * px;
        ctx.stroke(pathOf(g));
        ctx.restore();
      }
    }
    this.flashes = this.flashes.filter((f) => f.loop || now - f.t0 < f.dur);

    // markers for tiny countries + pulses (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rM = this.markerRadius();
    const flashing = new Map(this.flashes.map((f) => [f.code, f]));
    for (const g of Object.values(shapes)) {
      if (!this.isActive(g.code) || !this.markerVisible(g)) continue;
      const [x, y] = this.toScreen(g.p[0], g.p[1]);
      if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) continue;
      const st = this.states.get(g.code);
      const f = flashing.get(g.code);
      let r = rM;
      ctx.beginPath();
      if (f) {
        const a = f.loop ? 0.5 + 0.5 * Math.sin((now - f.t0) / 180) : 1 - (now - f.t0) / f.dur;
        r = rM * (1.2 + 0.35 * a);
        ctx.save();
        ctx.shadowColor = COLORS[f.kind];
        ctx.shadowBlur = 18 * dpr;
        ctx.fillStyle = COLORS[f.kind];
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
      }
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (st === 'gold' && !f) {
        ctx.save();
        ctx.shadowColor = 'rgba(247, 215, 116, 0.9)';
        ctx.shadowBlur = 16 * dpr;
        ctx.fillStyle = GOLD_A;
        ctx.fill();
        ctx.restore();
      } else if (r < 4 && !f && !st) {
        // zoomed out: discreet gold dot
        ctx.fillStyle = g.code === this.hover || g.code === this.press ? '#fff1c2' : 'rgba(232, 191, 74, 0.85)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(10, 10, 12, 0.75)';
        ctx.stroke();
        continue;
      } else {
        ctx.fillStyle = f ? COLORS[f.kind] : st && st !== 'seen' ? COLORS[st] || st : g.code === this.hover || g.code === this.press ? '#6a6553' : '#45444b';
        ctx.fill();
      }
      ctx.lineWidth = g.code === this.press || g.code === this.hover ? 2.6 : r < 4 ? 1.2 : 1.7;
      ctx.strokeStyle = st && st !== 'seen' ? '#fff6d6' : '#e3b84a';
      ctx.stroke();
    }
    for (const p of this.pulses) {
      const g = shapes[p.code];
      if (!g) continue;
      const period = 1300;
      const el = now - p.t0;
      if (!p.loop && el > period) continue;
      animating = true;
      const [x, y] = this.toScreen(g.p[0], g.p[1]);
      for (let i = 0; i < (p.loop ? 2 : 1); i++) {
        const ph = ((el + i * period * 0.5) % period) / period;
        if (!p.loop && el > period) continue;
        ctx.beginPath();
        ctx.arc(x, y, 8 + ph * 46, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS[p.kind] || COLORS.sel;
        ctx.globalAlpha = (1 - ph) * 0.9;
        ctx.lineWidth = 3 * (1 - ph) + 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    this.pulses = this.pulses.filter((p) => p.loop || now - p.t0 < 1300);

    if (this.area) {
      const a = this.area;
      if (now > a.until) this.area = null;
      else {
        animating = true;
        const [x, y] = this.toScreen(a.x, a.y);
        const fadeIn = Math.min(1, (now - a.t0) / 300);
        const fadeOut = Math.min(1, (a.until - now) / 500);
        const k = fadeIn * fadeOut;
        const r = Math.max(26, a.r * s) * (1.08 - 0.08 * fadeIn);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(247, 215, 116, 0.1)';
        ctx.fill();
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = -now / 35;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#f5c542';
        ctx.shadowColor = 'rgba(247, 215, 116, 0.8)';
        ctx.shadowBlur = 10 * dpr;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.labels && this.opts.labelFor) this.drawLabels();

    // pins
    if (this.pins.length) {
      this.pins = this.pins.filter((p) => {
        if (now > p.until) {
          p.el.classList.add('out');
          setTimeout(() => p.el.remove(), 250);
          return false;
        }
        this.placePin(p);
        return true;
      });
      if (this.pins.some((p) => p.until !== Infinity)) animating = true;
    }
    return animating;
  }

  drawLabels() {
    const ctx = this.ctx;
    const s = this.cam.s;
    const placed = [];
    const list = Object.values(this.geo.shapes)
      .filter((g) => this.isActive(g.code) && g.hasGeo && g.size * s > 26)
      .sort((a, b) => b.size - a.size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const g of list) {
      const [x, y] = this.toScreen(g.p[0], g.p[1]);
      if (x < -60 || x > this.vw + 60 || y < -20 || y > this.vh + 20) continue;
      const size = clamp(g.size * s * 0.09, 10, 15);
      const font = `800 ${size.toFixed(0)}px Nunito, system-ui, sans-serif`;
      ctx.font = font;
      const text = this.opts.labelFor(g.code);
      const key = text + font;
      let w = this.labelCache.get(key);
      if (w === undefined) {
        w = ctx.measureText(text).width;
        this.labelCache.set(key, w);
      }
      const bw = (g.b[2] - g.b[0]) * s;
      if (bw < w * 0.75) continue;
      const box = [x - w / 2 - 3, y - size / 2 - 2, x + w / 2 + 3, y + size / 2 + 2];
      if (placed.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      placed.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(12, 12, 14, 0.85)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = '#f3e3b3';
      ctx.fillText(text, x, y);
    }
  }
}
