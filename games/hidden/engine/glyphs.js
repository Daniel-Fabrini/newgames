// Emoji sprite cache. Each emoji is rendered once to offscreen canvases at a
// few sizes (levels of detail), with a soft contact shadow and drop shadow
// baked in, so a scene with hundreds of props can be redrawn every frame with
// plain drawImage calls. A clean (shadow-free) small sprite is used for the
// visibility masks during level generation.

const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Android Emoji",sans-serif';
const REF = 96; // reference font size used to measure the glyph
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function measure(ch) {
  const S = 192;
  const c = canvas(S, S);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = `${REF}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ff00ff';
  g.fillText(ch, S / 2, S / 2);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1, opaque = 0, magenta = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const a = d[i + 3];
      if (a > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (a > 200) {
        opaque++;
        if (d[i] > 225 && d[i + 1] < 40 && d[i + 2] > 225) magenta++;
      }
    }
  }
  // Monochrome fallback glyphs (tofu boxes, text symbols) take the fill color.
  const ok = opaque > 120 && magenta < opaque * 0.3 && x1 > x0 && y1 > y0;
  return { ok, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2 - S / 2, cy: (y0 + y1 + 1) / 2 - S / 2 };
}

class Glyph {
  constructor(ch) {
    this.ch = ch;
    const m = measure(ch);
    this.ok = m.ok;
    this.w = m.w;
    this.h = m.h;
    this.cx = m.cx;
    this.cy = m.cy;
    this.max = Math.max(m.w, m.h);
    this.aspect = m.w / Math.max(1, m.h);
    this.sprites = new Map();
  }

  // Sprite whose glyph's larger side measures L pixels.
  // variant: 'shadow' (light scenes), 'glow' (dark scenes), 'clean' (masks).
  sprite(L, variant = 'shadow') {
    const key = variant + L;
    let s = this.sprites.get(key);
    if (s) return s;
    const k = L / this.max;
    const gw = this.w * k;
    const gh = this.h * k;
    const shadow = variant !== 'clean';
    const mx = shadow ? Math.ceil(L * 0.12) : 2;
    const mTop = shadow ? Math.ceil(L * 0.1) : 2;
    const mBot = shadow ? Math.ceil(L * 0.2) : 2;
    const c = canvas(gw + mx * 2, gh + mTop + mBot);
    const g = c.getContext('2d');
    const ox = mx + gw / 2;
    const oy = mTop + gh / 2;
    if (shadow) {
      // contact shadow: soft ellipse under the object
      const ry = Math.max(3, gh * 0.09);
      const rx = gw * 0.46;
      const sy = oy + gh / 2 - ry * 0.2;
      g.save();
      g.translate(ox, sy);
      g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      const a = variant === 'glow' ? 0.5 : 0.36;
      rg.addColorStop(0, `rgba(0,0,0,${a})`);
      rg.addColorStop(0.6, `rgba(0,0,0,${a * 0.45})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (variant === 'glow') {
        g.shadowColor = 'rgba(255,236,190,0.55)';
        g.shadowBlur = L * 0.09;
      } else {
        g.shadowColor = 'rgba(20,10,0,0.38)';
        g.shadowBlur = L * 0.05;
        g.shadowOffsetY = L * 0.035;
      }
    }
    const fs = REF * k;
    g.font = `${fs}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.ch, ox - this.cx * k, oy - this.cy * k);
    s = { c, ox, oy, L };
    this.sprites.set(key, s);
    return s;
  }
}

export function glyph(ch) {
  let gl = cache.get(ch);
  if (!gl) {
    gl = new Glyph(ch);
    cache.set(ch, gl);
  }
  return gl;
}

export function supported(ch) {
  return glyph(ch).ok;
}

// Frees the big sprites (called when leaving a level).
export function trimGlyphs() {
  for (const gl of cache.values()) {
    for (const k of [...gl.sprites.keys()]) if (!k.endsWith('64') && !k.startsWith('clean')) gl.sprites.delete(k);
  }
}

// Draws a prop (center x,y, size s, rotation, flip) into a 2D context whose
// current transform maps world → pixels with scale `k` and offset (ox, oy).
export function drawPropMask(g, p, k, ox, oy) {
  const gl = glyph(p.ch);
  const sp = gl.sprite(64, 'clean');
  const sc = (p.s / 64) * k;
  const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
  const fx = p.flip ? -1 : 1;
  g.setTransform(cos * sc * fx, sin * sc * fx, -sin * sc, cos * sc, (p.x - ox) * k, (p.y - oy) * k);
  g.drawImage(sp.c, -sp.ox, -sp.oy);
}
