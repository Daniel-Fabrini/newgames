import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { CAPACITY, isBottleDone, type Bottle } from './engine';
import { computeLayout, type BottleLayout } from './layout';
import { liquid, type SymbolName } from './palette';

export interface PourAnimation {
  id: number;
  from: number;
  to: number;
  amount: number;
  colour: number;
}

interface BoardProps {
  bottles: readonly Bottle[];
  selected: number | null;
  hint: { from: number; to: number } | null;
  focusIndex: number;
  showSymbols: boolean;
  pour: PourAnimation | null;
  shake: { bottle: number; id: number } | null;
  disabled: boolean;
  onBottle: (index: number) => void;
  onFocusBottle: (index: number) => void;
  registerBottle: (index: number, el: HTMLButtonElement | null) => void;
}

const SYMBOLS: Record<SymbolName, ReactNode> = {
  circle: <circle cx="12" cy="12" r="7.5" />,
  triangle: <path d="M12 3.5 21 19.5H3z" />,
  star: <path d="m12 2.6 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />,
  plus: <path d="M9.4 3.5h5.2v5.9h5.9v5.2h-5.9v5.9H9.4v-5.9H3.5V9.4h5.9z" />,
  square: <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />,
  diamond: <path d="M12 2.2 21.2 12 12 21.8 2.8 12z" />,
  heart: <path d="M12 20.8S3.3 15.5 3.3 9.2a4.6 4.6 0 0 1 8.7-2.1 4.6 4.6 0 0 1 8.7 2.1c0 6.3-8.7 11.6-8.7 11.6z" />,
  hexagon: <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />,
  cross: <path d="m6.2 3.4 5.8 5.8 5.8-5.8 2.8 2.8-5.8 5.8 5.8 5.8-2.8 2.8-5.8-5.8-5.8 5.8-2.8-2.8 5.8-5.8-5.8-5.8z" />,
  moon: <path d="M14.5 2.8a9.3 9.3 0 1 0 6.8 15.6 7.6 7.6 0 0 1-6.8-15.6z" />,
  bolt: <path d="M13.8 2 4.8 13.6h6.1L9.6 22l9.6-12.1h-6.2z" />,
  ring: <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="3.4" />,
};

function LiquidSymbol({ name }: { name: SymbolName }) {
  return (
    <svg className="ws-sym" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {SYMBOLS[name]}
    </svg>
  );
}

function segmentStyle(colour: number, index: number): CSSProperties {
  const l = liquid(colour);
  return { '--i': index, '--base': l.base, '--shade': l.shade, '--light': l.light, '--ink': l.ink } as CSSProperties;
}

/** Accessible description of a bottle, bottom to top. */
function useBottleLabel() {
  const { m } = useI18n();
  const t = m.waterSort;
  return (bottle: Bottle, index: number, selected: boolean, hint: 'from' | 'to' | null) => {
    const parts: string[] = [];
    let i = 0;
    while (i < bottle.length) {
      const c = bottle[i] as number;
      let n = 0;
      while (i < bottle.length && bottle[i] === c) {
        n++;
        i++;
      }
      const name = t.liquidName(t.colours[c] ?? String(c + 1), t.symbols[c] ?? liquid(c).symbol);
      parts.push(t.bottleUnits(n, name));
    }
    let contents = bottle.length === 0 ? t.bottleEmpty : `${t.bottleBottomToTop}: ${parts.join(', ')}`;
    if (bottle.length > 0 && bottle.length < CAPACITY) contents += `; ${t.bottleFree(CAPACITY - bottle.length)}`;
    if (bottle.length === CAPACITY && isBottleDone(bottle)) contents += `; ${t.bottleDone}`;
    if (selected) contents += `; ${t.bottleSelected}`;
    if (hint === 'from') contents += `; ${t.hintFromLabel}`;
    if (hint === 'to') contents += `; ${t.hintToLabel}`;
    return t.bottleLabel(index + 1, contents);
  };
}

interface PourGeometry {
  id: number;
  x: number;
  y: number;
  rot: number;
  dir: number;
}

export const Board = memo(function Board({
  bottles,
  selected,
  hint,
  focusIndex,
  showSymbols,
  pour,
  shake,
  disabled,
  onBottle,
  onFocusBottle,
  registerBottle,
}: BoardProps) {
  const { m } = useI18n();
  const t = m.waterSort;
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [geometry, setGeometry] = useState<PourGeometry | null>(null);
  const labelOf = useBottleLabel();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: BottleLayout = computeLayout(size.w || 320, size.h || 480, bottles.length);
  const { bottleW, bottleH } = layout;

  // Geometry of the pour: the source moves so that its mouth sits just above the target's mouth,
  // tilting towards it (rotation around the mouth).
  useLayoutEffect(() => {
    if (!pour) {
      setGeometry(null);
      return;
    }
    const src = slotRefs.current[pour.from];
    const dst = slotRefs.current[pour.to];
    if (!src || !dst) return;
    const s = src.getBoundingClientRect();
    const d = dst.getBoundingClientRect();
    const sx = s.left + s.width / 2;
    const dx = d.left + d.width / 2;
    let dir = Math.sign(dx - sx);
    if (dir === 0) {
      const wrap = wrapRef.current?.getBoundingClientRect();
      dir = wrap && sx > wrap.left + wrap.width / 2 ? -1 : 1;
    }
    setGeometry({
      id: pour.id,
      dir,
      x: dx - dir * bottleW * 0.42 - sx,
      y: d.top - s.top - bottleH * 0.16,
      rot: dir * 74,
    });
  }, [pour, bottleW, bottleH]);

  const style = {
    '--bw': `${layout.bottleW}px`,
    '--bh': `${layout.bottleH}px`,
    '--row-h': `${layout.rowH}px`,
    '--gap-x': `${layout.gapX}px`,
    '--row-gap': `${layout.rowGap}px`,
  } as CSSProperties;

  const activeGeometry = geometry && pour && geometry.id === pour.id ? geometry : null;

  return (
    <div ref={wrapRef} className="ws-board">
      <div className="ws-rows no-gesture" style={style} role="group" aria-label={t.boardLabel(bottles.length)}>
        {layout.rows.map((row, r) => (
          <div key={r} className="ws-row">
            {row.map((index) => {
              const bottle = bottles[index] as Bottle;
              const isSelected = selected === index;
              const hintRole = hint ? (hint.from === index ? 'from' : hint.to === index ? 'to' : null) : null;
              const done = bottle.length === CAPACITY && isBottleDone(bottle);
              const pouringOut = activeGeometry && pour && pour.from === index ? pour : null;
              const pouringIn = pour && pour.to === index ? pour : null;
              const shaking = shake && shake.bottle === index ? shake : null;
              const classes = [
                'ws-bottle',
                isSelected && 'is-selected',
                done && 'is-done',
                hintRole === 'from' && 'is-hint-from',
                hintRole === 'to' && 'is-hint-to',
                pouringOut && 'is-pouring',
                shaking && 'is-shaking',
              ]
                .filter(Boolean)
                .join(' ');
              const bottleStyle = {} as Record<string, string | number>;
              if (pouringOut && activeGeometry) {
                bottleStyle['--px'] = `${activeGeometry.x}px`;
                bottleStyle['--py'] = `${activeGeometry.y}px`;
                bottleStyle['--pr'] = `${activeGeometry.rot}deg`;
                bottleStyle.animationName = pouringOut.id % 2 ? 'ws-pour-a' : 'ws-pour-b';
              } else if (shaking) {
                bottleStyle.animationName = shaking.id % 2 ? 'ws-shake-a' : 'ws-shake-b';
              }
              const newFrom = pouringIn ? bottle.length - pouringIn.amount : CAPACITY;
              return (
                <div
                  key={index}
                  className="ws-slot"
                  ref={(el) => {
                    slotRefs.current[index] = el;
                  }}
                >
                  <button
                    type="button"
                    ref={(el) => registerBottle(index, el)}
                    className={classes}
                    style={bottleStyle as CSSProperties}
                    tabIndex={index === focusIndex ? 0 : -1}
                    aria-label={labelOf(bottle, index, isSelected, hintRole)}
                    aria-pressed={isSelected}
                    aria-disabled={disabled || undefined}
                    onClick={() => onBottle(index)}
                    onFocus={() => onFocusBottle(index)}
                  >
                    <span className="ws-glass" aria-hidden="true">
                      <span className="ws-liquid">
                        {bottle.map((c, i) => {
                          const above = bottle[i + 1];
                          const isNew = pouringIn !== null && i >= newFrom;
                          return (
                            <span
                              key={isNew && pouringIn ? `n${pouringIn.id}-${i}` : `s${i}-${c}`}
                              className={['ws-seg', above !== c && 'is-run-top', i === 0 && 'is-bottom', isNew && 'is-filling'].filter(Boolean).join(' ')}
                              style={{ ...segmentStyle(c, i), ...(isNew ? { animationDelay: `${170 + (i - newFrom) * 70}ms` } : null) }}
                            >
                              {showSymbols && <LiquidSymbol name={liquid(c).symbol} />}
                            </span>
                          );
                        })}
                        {pouringOut && (
                          <span
                            key={`d${pouringOut.id}`}
                            className="ws-drain"
                            style={{ ...segmentStyle(pouringOut.colour, bottle.length), '--n': pouringOut.amount } as CSSProperties}
                          />
                        )}
                      </span>
                      <span className="ws-shine" />
                    </span>
                    <span className="ws-rim" aria-hidden="true" />
                    {done && <span className="ws-cap" aria-hidden="true" />}
                    {pouringIn && (
                      <span
                        key={`st${pouringIn.id}`}
                        className="ws-stream"
                        aria-hidden="true"
                        style={
                          {
                            '--base': liquid(pouringIn.colour).base,
                            '--shade': liquid(pouringIn.colour).shade,
                            '--fill': bottle.length,
                            '--dir': geometry && geometry.id === pouringIn.id ? geometry.dir : 1,
                          } as CSSProperties
                        }
                      />
                    )}
                    {hintRole && (
                      <span className={`ws-hint-badge is-${hintRole}`} aria-hidden="true">
                        <Icon name={hintRole === 'from' ? 'arrowUp' : 'arrowDown'} size={13} />
                      </span>
                    )}
                  </button>
                  <span className="ws-num tabular" aria-hidden="true">
                    {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
