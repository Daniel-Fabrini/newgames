// Isometric projection and camera. World units: one tile is TW wide and TH tall on the diamond.
export const TW = 64;
export const TH = 32;

// World point of a tile corner (x, y) lifted by z.
export function P(x, y, z = 0) {
  return [(x - y) * (TW / 2), (x + y) * (TH / 2) - z];
}

// Tile coordinates (floats) of a world point.
export function tileAt(wx, wy) {
  const a = wx / (TW / 2), b = wy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export class Camera {
  constructor() {
    this.z = 1;
    this.ox = 0;
    this.oy = 0;
  }
  toScreen(wx, wy) {
    return [this.ox + wx * this.z, this.oy + wy * this.z];
  }
  toWorld(sx, sy) {
    return [(sx - this.ox) / this.z, (sy - this.oy) / this.z];
  }
  tileAt(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    return tileAt(wx, wy);
  }
  // Zoom keeping the screen point (sx, sy) fixed.
  zoomAt(sx, sy, nz) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.z = nz;
    this.ox = sx - wx * nz;
    this.oy = sy - wy * nz;
  }
}
