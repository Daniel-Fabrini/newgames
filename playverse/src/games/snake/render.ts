import { BONUS_TICKS, VECTORS, directionBetween, type GameState, type Point } from './engine';

/**
 * Canvas renderer for the Snake board (no React). Draws a cached grid background, glowing food,
 * the bonus star with its timer ring and a glossy snake that glides smoothly between cells
 * (interpolated with the time elapsed since the last tick).
 */
export type Theme = 'dark' | 'light';

export interface Popup {
  x: number;
  y: number;
  text: string;
  at: number;
  gold: boolean;
}

/** Timing/animation data of the last tick, written by the game loop and read every frame. */
export interface StepClock {
  /** performance.now() of the last tick. */
  at: number;
  interval: number;
  /** Cell the tail left on the last tick (null when the snake grew). */
  prevTail: Point | null;
  /** Food / bonus eaten on the last tick (drawn shrinking into the head). */
  eaten: Point | null;
  eatenBonus: Point | null;
  popups: Popup[];
}

export function createClock(): StepClock {
  return { at: 0, interval: 1, prevTail: null, eaten: null, eatenBonus: null, popups: [] };
}

interface Palette {
  bgTop: string;
  bgBottom: string;
  cell: string;
  line: string;
  bodyHead: [number, number, number];
  bodyTail: [number, number, number];
  outline: string;
  gloss: string;
  shadow: string;
  headLight: string;
  headMid: string;
  headDark: string;
  eye: string;
  pupil: string;
  tongue: string;
  appleLight: string;
  appleMid: string;
  appleDark: string;
  appleGlow: string;
  leaf: string;
  stem: string;
  starLight: string;
  starMid: string;
  starDark: string;
  starGlow: string;
  ringTrack: string;
  popup: string;
  popupStroke: string;
  popupGold: string;
  dead: string;
}

const SHARED = {
  bodyHead: [134, 239, 92] as [number, number, number],
  bodyTail: [21, 163, 74] as [number, number, number],
  headLight: '#d4ff9c',
  headMid: '#5ee07f',
  headDark: '#16a34a',
  eye: '#ffffff',
  pupil: '#14203f',
  tongue: '#ef4444',
  appleLight: '#ffc2c2',
  appleMid: '#f43f5e',
  appleDark: '#9f1239',
  leaf: '#4ade80',
  stem: '#7c4a1e',
  starLight: '#fff6c4',
  starMid: '#ffc83d',
  starDark: '#f08c00',
};

const PALETTES: Record<Theme, Palette> = {
  dark: {
    ...SHARED,
    bgTop: '#1f1b6e',
    bgBottom: '#110e44',
    cell: 'rgba(255, 255, 255, 0.04)',
    line: 'rgba(139, 132, 255, 0.11)',
    outline: '#0a4f22',
    gloss: 'rgba(255, 255, 255, 0.4)',
    shadow: 'rgba(3, 2, 20, 0.45)',
    appleGlow: 'rgba(244, 63, 94, 0.5)',
    starGlow: 'rgba(255, 200, 61, 0.55)',
    ringTrack: 'rgba(255, 255, 255, 0.16)',
    popup: '#ffffff',
    popupStroke: 'rgba(11, 10, 42, 0.85)',
    popupGold: '#ffd35c',
    dead: 'rgba(244, 63, 94, 0.14)',
  },
  light: {
    ...SHARED,
    bgTop: '#e9ebff',
    bgBottom: '#d0d4f8',
    cell: 'rgba(255, 255, 255, 0.55)',
    line: 'rgba(79, 70, 229, 0.1)',
    outline: '#0f6b2f',
    gloss: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(23, 21, 74, 0.2)',
    appleGlow: 'rgba(244, 63, 94, 0.32)',
    starGlow: 'rgba(245, 165, 36, 0.45)',
    ringTrack: 'rgba(23, 21, 74, 0.14)',
    popup: '#17154a',
    popupStroke: 'rgba(255, 255, 255, 0.92)',
    popupGold: '#9a5b00',
    dead: 'rgba(225, 29, 72, 0.12)',
  },
};

export const POPUP_MS = 700;
const TAU = Math.PI * 2;

const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;

export interface FrameOptions {
  /** 0..1 progress between the previous tick and the current one. */
  t: number;
  now: number;
  reduced: boolean;
}

export class SnakeRenderer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private theme: Theme = 'dark';
  private cols = 0;
  private rows = 0;
  private background: HTMLCanvasElement | null = null;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    this.ctx = ctx;
  }

  /** Sets the CSS size of the canvas; the backing store uses devicePixelRatio for crisp output. */
  resize(width: number, height: number, dpr: number): void {
    const ratio = Math.min(3, Math.max(1, dpr || 1));
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    this.width = width;
    this.height = height;
    this.dpr = ratio;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.background = null;
  }

  setTheme(theme: Theme): void {
    if (theme !== this.theme) {
      this.theme = theme;
      this.background = null;
    }
  }

  private cellSize(): number {
    return Math.min(this.width / this.cols, this.height / this.rows);
  }

  private buildBackground(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const bg = document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const g = bg.getContext('2d');
    if (!g) return null;
    const p = PALETTES[this.theme];
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, this.width * 0.4, this.height);
    grad.addColorStop(0, p.bgTop);
    grad.addColorStop(1, p.bgBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.width, this.height);
    const c = this.cellSize();
    g.fillStyle = p.cell;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) if ((x + y) % 2 === 0) g.fillRect(x * c, y * c, c, c);
    }
    g.strokeStyle = p.line;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < this.cols; x++) {
      const px = Math.round(x * c * this.dpr) / this.dpr + 0.5 / this.dpr;
      g.moveTo(px, 0);
      g.lineTo(px, this.rows * c);
    }
    for (let y = 1; y < this.rows; y++) {
      const py = Math.round(y * c * this.dpr) / this.dpr + 0.5 / this.dpr;
      g.moveTo(0, py);
      g.lineTo(this.cols * c, py);
    }
    g.stroke();
    return bg;
  }

  draw(game: GameState, clock: StepClock, { t, now, reduced }: FrameOptions): void {
    const ctx = this.ctx;
    if (!ctx || this.width <= 0 || this.height <= 0) return;
    if (game.cols !== this.cols || game.rows !== this.rows) {
      this.cols = game.cols;
      this.rows = game.rows;
      this.background = null;
    }
    if (!this.background) this.background = this.buildBackground();
    const p = PALETTES[this.theme];
    const c = this.cellSize();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.background) ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const pulse = reduced ? 1 : 1 + 0.07 * Math.sin(now / 230);
    if (game.food) this.drawApple(ctx, p, game.food, c, pulse, 1);
    if (game.bonus) {
      const left = game.bonus.ticksLeft / BONUS_TICKS;
      const blinkOff = !reduced && game.bonus.ticksLeft <= 8 && Math.floor(now / 140) % 2 === 0;
      this.drawStar(ctx, p, game.bonus, c, blinkOff ? 0.45 : 1, pulse, left);
    }
    // Food eaten on the last tick shrinks while the head slides onto it.
    const fade = Math.max(0, 1 - t);
    if (clock.eaten && fade > 0) {
      this.drawApple(ctx, p, clock.eaten, c, fade, fade);
      if (!reduced) this.drawRing(ctx, p.appleGlow, clock.eaten, c, t);
    }
    if (clock.eatenBonus && fade > 0) {
      this.drawStar(ctx, p, clock.eatenBonus, c, fade, fade, null);
      if (!reduced) this.drawRing(ctx, p.starGlow, clock.eatenBonus, c, t);
    }

    this.drawSnake(ctx, p, game, clock, c, t, now, reduced);

    if (game.status === 'over') {
      ctx.fillStyle = p.dead;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    this.drawPopups(ctx, p, clock, c, now, reduced);
  }

  private drawApple(ctx: CanvasRenderingContext2D, p: Palette, at: Point, c: number, scale: number, alpha: number): void {
    const cx = (at.x + 0.5) * c;
    const cy = (at.y + 0.5) * c;
    const r = 0.37 * c * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, c * 0.85 * scale);
    glow.addColorStop(0, p.appleGlow);
    glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    body.addColorStop(0, p.appleLight);
    body.addColorStop(0.45, p.appleMid);
    body.addColorStop(1, p.appleDark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.08, r, 0, TAU);
    ctx.fill();
    // stem + leaf
    ctx.strokeStyle = p.stem;
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 1.15, cx + r * 0.3, cy - r * 1.25);
    ctx.stroke();
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.42, cy - r * 0.98, r * 0.36, r * 0.17, -0.5, 0, TAU);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.38, cy - r * 0.28, r * 0.2, r * 0.12, -0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, p: Palette, at: Point, c: number, alpha: number, scale: number, timeLeft: number | null): void {
    const cx = (at.x + 0.5) * c;
    const cy = (at.y + 0.5) * c;
    const r = 0.42 * c * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, c * 0.95 * scale);
    glow.addColorStop(0, p.starGlow);
    glow.addColorStop(1, 'rgba(255, 200, 61, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
    if (timeLeft !== null) {
      ctx.lineWidth = Math.max(1.5, c * 0.07);
      ctx.strokeStyle = p.ringTrack;
      ctx.beginPath();
      ctx.arc(cx, cy, c * 0.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = p.starMid;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, c * 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * timeLeft);
      ctx.stroke();
    }
    const fill = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    fill.addColorStop(0, p.starLight);
    fill.addColorStop(0.5, p.starMid);
    fill.addColorStop(1, p.starDark);
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#b45f00';
    ctx.lineWidth = Math.max(1, c * 0.04);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.52;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, color: string, at: Point, c: number, t: number): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, c * 0.08);
    ctx.beginPath();
    ctx.arc((at.x + 0.5) * c, (at.y + 0.5) * c, c * (0.35 + 0.45 * t), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** Unit step from `a` to the adjacent cell `b`, honouring wrap-around. */
  private delta(game: GameState, a: Point, b: Point): Point {
    const d = directionBetween(a, b, game.cols, game.rows, game.mode === 'endless');
    return d ? VECTORS[d] : { x: b.x - a.x, y: b.y - a.y };
  }

  private drawSnake(ctx: CanvasRenderingContext2D, p: Palette, game: GameState, clock: StepClock, c: number, t: number, now: number, reduced: boolean): void {
    const snake = game.snake;
    const head = snake[0];
    const neck = snake[1];
    const tail = snake[snake.length - 1];
    if (!head || !neck || !tail) return;
    const dHead = this.delta(game, neck, head);
    const headPt = { x: neck.x + dHead.x * t, y: neck.y + dHead.y * t };
    let tailPt: Point = tail;
    if (clock.prevTail && t < 1) {
      const dTail = this.delta(game, tail, clock.prevTail);
      tailPt = { x: tail.x + dTail.x * (1 - t), y: tail.y + dTail.y * (1 - t) };
    }

    // Path pieces in cell coordinates, split where the body wraps across an edge.
    const pieces: Array<Array<{ pt: Point; k: number }>> = [];
    let piece: Array<{ pt: Point; k: number }> = [{ pt: headPt, k: 0 }];
    for (let i = 1; i < snake.length; i++) {
      const prev = snake[i - 1] as Point;
      const cur = snake[i] as Point;
      if (i > 1 && Math.abs(prev.x - cur.x) + Math.abs(prev.y - cur.y) > 1) {
        const d = this.delta(game, prev, cur);
        piece.push({ pt: { x: prev.x + d.x, y: prev.y + d.y }, k: i - 0.5 });
        pieces.push(piece);
        piece = [{ pt: { x: cur.x - d.x, y: cur.y - d.y }, k: i - 0.5 }];
      }
      piece.push({ pt: cur, k: i });
    }
    piece.push({ pt: tailPt, k: snake.length });
    pieces.push(piece);

    const total = Math.max(1, snake.length);
    const offsets = (pts: Array<{ pt: Point }>): Point[] => {
      const out: Point[] = [{ x: 0, y: 0 }];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const { pt } of pts) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
      if (minX < 0) out.push({ x: game.cols, y: 0 });
      if (maxX > game.cols - 1) out.push({ x: -game.cols, y: 0 });
      if (minY < 0) out.push({ x: 0, y: game.rows });
      if (maxY > game.rows - 1) out.push({ x: 0, y: -game.rows });
      return out;
    };

    const X = (pt: Point, o: Point) => (pt.x + o.x + 0.5) * c;
    const Y = (pt: Point, o: Point) => (pt.y + o.y + 0.5) * c;
    const tracePath = (pts: Array<{ pt: Point }>, o: Point, dx = 0, dy = 0) => {
      ctx.beginPath();
      pts.forEach(({ pt }, i) => {
        if (i === 0) ctx.moveTo(X(pt, o) + dx, Y(pt, o) + dy);
        else ctx.lineTo(X(pt, o) + dx, Y(pt, o) + dy);
      });
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const outer = c * 0.86;
    const inner = c * 0.7;
    for (const pts of pieces) {
      for (const o of offsets(pts)) {
        ctx.strokeStyle = p.shadow;
        ctx.lineWidth = outer;
        tracePath(pts, o, 0, c * 0.1);
        ctx.stroke();
      }
    }
    for (const pts of pieces) {
      for (const o of offsets(pts)) {
        ctx.strokeStyle = p.outline;
        ctx.lineWidth = outer;
        tracePath(pts, o);
        ctx.stroke();
        ctx.lineWidth = inner;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1] as { pt: Point; k: number };
          const b = pts[i] as { pt: Point; k: number };
          ctx.strokeStyle = mix(p.bodyHead, p.bodyTail, Math.min(1, (a.k + b.k) / 2 / total));
          ctx.beginPath();
          ctx.moveTo(X(a.pt, o), Y(a.pt, o));
          ctx.lineTo(X(b.pt, o), Y(b.pt, o));
          ctx.stroke();
        }
        ctx.strokeStyle = p.gloss;
        ctx.lineWidth = c * 0.15;
        tracePath(pts, o, -c * 0.08, -c * 0.14);
        ctx.stroke();
      }
    }
    ctx.restore();

    const dir = game.status === 'over' ? VECTORS[game.dir] : dHead;
    for (const o of offsets([{ pt: headPt }])) this.drawHead(ctx, p, X(headPt, o), Y(headPt, o), dir, c, game.status === 'over', now, reduced);
  }

  private drawHead(ctx: CanvasRenderingContext2D, p: Palette, cx: number, cy: number, dir: Point, c: number, dead: boolean, now: number, reduced: boolean): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dir.y, dir.x));
    // Tongue flick every few seconds (forward is +x after the rotation).
    if (!dead && !reduced && now % 2600 < 260) {
      ctx.strokeStyle = p.tongue;
      ctx.lineWidth = Math.max(1, c * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c * 0.45, 0);
      ctx.lineTo(c * 0.72, 0);
      ctx.lineTo(c * 0.84, -c * 0.09);
      ctx.moveTo(c * 0.72, 0);
      ctx.lineTo(c * 0.84, c * 0.09);
      ctx.stroke();
    }
    const rx = c * 0.54;
    const ry = c * 0.48;
    const grad = ctx.createRadialGradient(-rx * 0.1, -ry * 0.45, c * 0.05, 0, 0, rx);
    grad.addColorStop(0, p.headLight);
    grad.addColorStop(0.5, p.headMid);
    grad.addColorStop(1, p.headDark);
    ctx.fillStyle = grad;
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = Math.max(1, c * 0.07);
    ctx.beginPath();
    ctx.ellipse(c * 0.04, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // eyes
    for (const side of [-1, 1]) {
      const ex = c * 0.16;
      const ey = side * c * 0.22;
      ctx.fillStyle = p.eye;
      ctx.beginPath();
      ctx.arc(ex, ey, c * 0.15, 0, TAU);
      ctx.fill();
      if (dead) {
        ctx.strokeStyle = p.pupil;
        ctx.lineWidth = Math.max(1, c * 0.05);
        const s = c * 0.07;
        ctx.beginPath();
        ctx.moveTo(ex - s, ey - s);
        ctx.lineTo(ex + s, ey + s);
        ctx.moveTo(ex + s, ey - s);
        ctx.lineTo(ex - s, ey + s);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.pupil;
        ctx.beginPath();
        ctx.arc(ex + c * 0.045, ey, c * 0.075, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + c * 0.06, ey - c * 0.025, c * 0.022, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D, p: Palette, clock: StepClock, c: number, now: number, reduced: boolean): void {
    if (clock.popups.length === 0) return;
    clock.popups = clock.popups.filter((pop) => now - pop.at < POPUP_MS);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(11, c * 0.62)}px Nunito, ui-rounded, system-ui, sans-serif`;
    ctx.lineJoin = 'round';
    for (const pop of clock.popups) {
      const k = Math.min(1, Math.max(0, (now - pop.at) / POPUP_MS));
      const x = Math.min(this.width - c, Math.max(c, (pop.x + 0.5) * c));
      const y = Math.max(c * 0.6, (pop.y + 0.5) * c - (reduced ? 0.6 : 0.6 + 0.9 * k) * c);
      ctx.globalAlpha = 1 - k * k;
      ctx.lineWidth = Math.max(2, c * 0.16);
      ctx.strokeStyle = p.popupStroke;
      ctx.strokeText(pop.text, x, y);
      ctx.fillStyle = pop.gold ? p.popupGold : p.popup;
      ctx.fillText(pop.text, x, y);
    }
    ctx.restore();
  }
}
