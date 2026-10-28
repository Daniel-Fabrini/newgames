import { describe, expect, it } from 'vitest';
import { computeLayout, layoutSize } from './layout';
import { MAX_BOTTLES } from './levels';

// Stage sizes measured in the browser (game stage minus its padding).
const PHONE_SMALL = { w: 336, h: 520 }; // 360×740
const PHONE = { w: 366, h: 610 }; // 390×844
const DESKTOP = { w: 1256, h: 560 }; // 1280×800

describe('bottle layout', () => {
  it('fits every bottle count on a 360×740 phone without cropping, with tappable bottles', () => {
    for (let n = 5; n <= MAX_BOTTLES; n++) {
      const layout = computeLayout(PHONE_SMALL.w, PHONE_SMALL.h, n);
      const size = layoutSize(layout);
      expect(size.width).toBeLessThanOrEqual(PHONE_SMALL.w);
      expect(size.height).toBeLessThanOrEqual(PHONE_SMALL.h);
      expect(layout.rows.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
      // Tap target = bottle plus half the gap on each side; tall bottles are easy to hit.
      expect(layout.bottleW + layout.gapX).toBeGreaterThanOrEqual(44);
      expect(layout.bottleH).toBeGreaterThanOrEqual(110);
    }
  });

  it('uses several rows for many bottles on phones and one row on desktop', () => {
    expect(computeLayout(PHONE.w, PHONE.h, 14).rows.length).toBeGreaterThanOrEqual(2);
    expect(computeLayout(PHONE.w, PHONE.h, 14).bottleW).toBeGreaterThanOrEqual(40);
    expect(computeLayout(PHONE_SMALL.w, PHONE_SMALL.h, 14).rows.length).toBeGreaterThanOrEqual(2);
    expect(computeLayout(DESKTOP.w, DESKTOP.h, 14).rows.length).toBe(1);
    expect(computeLayout(PHONE.w, PHONE.h, 5).rows.length).toBe(1);
  });

  it('balances rows', () => {
    for (let n = 5; n <= MAX_BOTTLES; n++) {
      const lengths = computeLayout(PHONE_SMALL.w, PHONE_SMALL.h, n).rows.map((r) => r.length);
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
    }
    expect(computeLayout(PHONE.w, PHONE.h, 13).rows.map((r) => r.length)).toEqual([5, 4, 4]);
  });
});
