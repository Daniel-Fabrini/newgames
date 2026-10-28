import { memo, type CSSProperties } from 'react';
import type { Orient } from './layout';

/** Pip centres (percent of a square half) for a half drawn upright; rotated for horizontal tiles. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  0: [],
  1: [[50, 50]],
  2: [
    [27, 27],
    [73, 73],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [28, 24],
    [28, 50],
    [28, 76],
    [72, 24],
    [72, 50],
    [72, 76],
  ],
};

function Half({ value, orient }: { value: number; orient: Orient }) {
  const pips = PIPS[value] ?? [];
  return (
    <span className="dm-half" data-v={value}>
      {pips.map(([x, y], i) => {
        const [px, py] = orient === 'h' ? [100 - y, x] : [x, y];
        return <i key={i} className="dm-pip" style={{ left: `${px}%`, top: `${py}%` }} />;
      })}
    </span>
  );
}

interface FaceProps {
  /** Pip on the top (vertical) or left (horizontal) half. */
  first: number;
  /** Pip on the bottom (vertical) or right (horizontal) half. */
  second: number;
  orient: Orient;
  className?: string;
  style?: CSSProperties;
}

/** Glossy ivory domino face drawn with CSS (no images). Decorative: callers provide labels. */
export const DominoFace = memo(function DominoFace({ first, second, orient, className, style }: FaceProps) {
  return (
    <span className={['dm-face', `dm-face--${orient}`, first === second && 'is-double', className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
      <Half value={first} orient={orient} />
      <span className="dm-bar" />
      <Half value={second} orient={orient} />
    </span>
  );
});

/** Face-down tile (opponent hand, boneyard). */
export function TileBack({ orient = 'v', className }: { orient?: Orient; className?: string }) {
  return <span className={['dm-back', `dm-back--${orient}`, className].filter(Boolean).join(' ')} aria-hidden="true" />;
}
