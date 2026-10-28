import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { announce } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { feedback } from '../../services/feedback';
import { CardFace } from './CardFace';
import { cardName, pileLabel, rankLabel } from './describe';
import {
  FOUNDATIONS,
  STOCK,
  TABLEAU_COLUMNS,
  WASTE,
  faceDownCount,
  foundationRef,
  legalTargets,
  pileOf,
  refKey,
  sameRef,
  tableauRef,
  topOf,
  type GameState,
  type Move,
  type PileRef,
} from './engine';
import type { Hint } from './assist';
import { computeMetrics, layoutBoard, pickDropTarget, slotRect, type Placement, type Rect } from './layout';

interface BoardProps {
  game: GameState;
  /** Paused, auto-completing or finished: no input. */
  disabled: boolean;
  /** Cards that just moved (drawn above the others while they travel). */
  raised: ReadonlySet<number>;
  hint: Hint | null;
  celebrate: boolean;
  onDraw: () => void;
  /** Applies a move; returns false when it is illegal. */
  onMove: (move: Move) => boolean;
  /** Tap / double Enter: moves the card at `index` of `from` to its best destination. */
  onTap: (from: PileRef, index: number) => boolean;
}

interface DragStart {
  pointerId: number;
  startX: number;
  startY: number;
  from: PileRef;
  index: number;
  ids: number[];
  active: boolean;
  targets: PileRef[];
}

interface DragView {
  ids: number[];
  dx: number;
  dy: number;
  targets: PileRef[];
  over: PileRef | null;
}

interface Cursor {
  ref: PileRef;
  /** Cards counted from the top of a column (1 = top card). */
  depth: number;
}

const DRAG_THRESHOLD = 7;
const TOP_ROW: PileRef[] = [STOCK, WASTE, ...Array.from({ length: FOUNDATIONS }, (_, i) => foundationRef(i))];
/** Tableau column under each top-row pile. */
const TOP_ROW_COLUMN = [0, 1, 3, 4, 5, 6];
const ALL_PILES: PileRef[] = [...TOP_ROW, ...Array.from({ length: TABLEAU_COLUMNS }, (_, i) => tableauRef(i))];
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const boxStyle = (r: Rect): CSSProperties => ({ transform: `translate(${px(r.x)}, ${px(r.y)})`, width: px(r.w), height: px(r.h) });

function parsePile(key: string | undefined): PileRef | null {
  return ALL_PILES.find((r) => refKey(r) === key) ?? null;
}

export const Board = memo(function Board({ game, disabled, raised, hint, celebrate, onDraw, onMove, onTap }: BoardProps) {
  const { m, fmt } = useI18n();
  const t = m.solitaire;
  const boardRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dragStart = useRef<DragStart | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [shake, setShake] = useState<{ ids: number[]; seq: number } | null>(null);
  const [cursor, setCursor] = useState<Cursor>({ ref: tableauRef(0), depth: 1 });
  const [picked, setPicked] = useState<{ ref: PileRef; count: number } | null>(null);
  const [kbFocus, setKbFocus] = useState(false);
  // A keyboard selection belongs to one position: any change of the game (draw, undo…) drops it.
  const [pickedGame, setPickedGame] = useState(game);
  if (pickedGame !== game) {
    setPickedGame(game);
    if (picked) setPicked(null);
  }

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = useMemo(() => computeMetrics(size.w, size.h), [size]);
  const layout = useMemo(() => layoutBoard(game, game.draw, metrics), [game, metrics]);
  const byId = useMemo(() => new Map(layout.cards.map((c) => [c.id, c])), [layout]);

  const maxDepth = (ref: PileRef) => {
    const pile = pileOf(game, ref);
    if (ref.kind === 'tableau') return pile.length - faceDownCount(pile);
    return pile.length > 0 ? 1 : 0;
  };
  const depthOf = (c: Cursor) => Math.max(1, Math.min(c.depth, maxDepth(c.ref)));

  const triggerShake = (ids: number[]) => {
    if (ids.length === 0) return;
    const seq = Date.now();
    setShake({ ids, seq });
    window.setTimeout(() => setShake((s) => (s && s.seq === seq ? null : s)), 380);
  };

  /** Cards that would be taken by pressing on `index` of `from` (waste/foundation: the top card only). */
  const grabbable = (from: PileRef, index: number): { index: number; ids: number[] } => {
    const pile = pileOf(game, from);
    if (from.kind === 'stock' || pile.length === 0) return { index, ids: [] };
    if (from.kind === 'tableau') {
      const card = pile[index];
      return card?.up ? { index, ids: pile.slice(index).map((c) => c.id) } : { index, ids: [] };
    }
    const top = topOf(pile) as { id: number };
    return { index: pile.length - 1, ids: [top.id] };
  };

  /* ───────────── Pointer: tap and drag ───────────── */

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // One pointer at a time: a second finger never disturbs a drag in progress.
    if (disabled || dragStart.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.target as HTMLElement;
    const cardEl = el.closest<HTMLElement>('[data-card]');
    const slotEl = el.closest<HTMLElement>('[data-pile]');
    let from: PileRef | null = null;
    let index = -1;
    if (cardEl) {
      const placed = byId.get(Number(cardEl.dataset.card));
      if (placed) {
        from = placed.pile;
        index = placed.index;
      }
    } else if (slotEl) {
      from = parsePile(slotEl.dataset.pile);
    }
    if (!from) return;
    setPicked(null);
    const grab = grabbable(from, index);
    dragStart.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, from, index: grab.index, ids: grab.ids, active: false, targets: [] };
    boardRef.current?.setPointerCapture?.(e.pointerId);
  };

  const dragViewFor = (d: DragStart, clientX: number, clientY: number): DragView | null => {
    const lead = byId.get(d.ids[0] as number);
    if (!lead) return null;
    const dx = clientX - d.startX;
    const dy = clientY - d.startY;
    const over = pickDropTarget(metrics, { x: lead.x + dx, y: lead.y + dy, w: metrics.cardW, h: metrics.cardH }, d.targets);
    return { ids: d.ids, dx, dy, targets: d.targets, over };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragStart.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active) {
      if (d.ids.length === 0 || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.active = true;
      d.targets = legalTargets(game, d.from, d.ids.length);
    }
    setDrag(dragViewFor(d, e.clientX, e.clientY));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragStart.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragStart.current = null;
    if (d.active) {
      const view = dragViewFor(d, e.clientX, e.clientY);
      setDrag(null);
      if (view?.over) onMove({ from: d.from, to: view.over, count: d.ids.length });
      return;
    }
    if (d.from.kind === 'stock') {
      onDraw();
      return;
    }
    if (d.ids.length === 0) return;
    if (!onTap(d.from, d.index)) triggerShake(d.ids);
  };

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current && dragStart.current.pointerId !== e.pointerId) return;
    dragStart.current = null;
    setDrag(null);
  };

  /* ───────────── Keyboard ───────────── */

  const focusPile = (ref: PileRef) => slotRefs.current.get(refKey(ref))?.focus();

  const moveCursor = (next: Cursor) => {
    setCursor(next);
    focusPile(next.ref);
    if (next.ref.kind === 'tableau' && next.depth > 1) {
      const pile = pileOf(game, next.ref);
      const card = pile[pile.length - next.depth];
      if (card) announce(t.labels.selection(cardName(t, card.id), next.depth));
    }
  };

  const activate = () => {
    const ref = cursor.ref;
    const pile = pileOf(game, ref);
    if (picked) {
      if (sameRef(picked.ref, ref)) {
        const fromPile = pileOf(game, picked.ref);
        const index = fromPile.length - picked.count;
        const ids = fromPile.slice(index).map((c) => c.id);
        setPicked(null);
        if (!onTap(picked.ref, index)) triggerShake(ids);
        return;
      }
      if (onMove({ from: picked.ref, to: ref, count: picked.count })) setPicked(null);
      return;
    }
    if (ref.kind === 'stock') {
      onDraw();
      return;
    }
    const count = ref.kind === 'tableau' ? depthOf(cursor) : 1;
    const card = pile[pile.length - count];
    if (!card || !card.up || maxDepth(ref) === 0) {
      feedback('error');
      return;
    }
    setPicked({ ref, count });
    feedback('select');
    announce(t.announce.picked(cardName(t, card.id), count));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const ref = cursor.ref;
    const topIndex = TOP_ROW.findIndex((r) => sameRef(r, ref));
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        handled();
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        if (topIndex >= 0) moveCursor({ ref: TOP_ROW[Math.max(0, Math.min(TOP_ROW.length - 1, topIndex + step))] as PileRef, depth: 1 });
        else if (ref.kind === 'tableau') moveCursor({ ref: tableauRef(Math.max(0, Math.min(TABLEAU_COLUMNS - 1, ref.index + step))), depth: 1 });
        return;
      }
      case 'ArrowUp': {
        handled();
        if (ref.kind === 'tableau') {
          const depth = depthOf(cursor);
          if (!picked && depth < maxDepth(ref)) moveCursor({ ref, depth: depth + 1 });
          else {
            const col = ref.index === 2 ? 1 : ref.index;
            const i = TOP_ROW_COLUMN.indexOf(col);
            moveCursor({ ref: TOP_ROW[i] as PileRef, depth: 1 });
          }
        }
        return;
      }
      case 'ArrowDown': {
        handled();
        if (ref.kind === 'tableau') {
          const depth = depthOf(cursor);
          if (depth > 1) moveCursor({ ref, depth: depth - 1 });
        } else if (topIndex >= 0) {
          moveCursor({ ref: tableauRef(TOP_ROW_COLUMN[topIndex] as number), depth: 1 });
        }
        return;
      }
      case 'Enter':
      case ' ':
        handled();
        activate();
        return;
      case 'Escape':
        if (picked) {
          handled();
          setPicked(null);
          announce(t.announce.cancelled);
        }
        return;
    }
  };

  // Arrow keys bring the focus to the table when it is elsewhere on the page.
  useKeyboard((e) => {
    if (!ARROWS.includes(e.key)) return false;
    if (boardRef.current?.contains(document.activeElement)) return false;
    focusPile(cursor.ref);
    return true;
  }, !disabled);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.pile;
    const ref = parsePile(key);
    if (ref && !sameRef(ref, cursor.ref)) setCursor({ ref, depth: 1 });
    setKbFocus(target.matches(':focus-visible'));
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!boardRef.current?.contains(e.relatedTarget as Node | null)) setKbFocus(false);
  };

  /* ───────────── Rendering ───────────── */

  const { cardW, cardH } = metrics;
  const ready = size.w > 0 && size.h > 0;
  const keyboardTargets = picked ? legalTargets(game, picked.ref, picked.count) : [];
  const targets = drag?.targets ?? keyboardTargets;
  const pickedIds = new Set<number>();
  if (picked) pileOf(game, picked.ref).slice(-picked.count).forEach((c) => pickedIds.add(c.id));
  const hintIds = new Set<number>();
  if (hint?.kind === 'move') pileOf(game, hint.move.from).slice(-hint.move.count).forEach((c) => hintIds.add(c.id));
  const dragIndex = new Map((drag?.ids ?? []).map((id, i) => [id, i]));
  const shaking = new Set(shake?.ids ?? []);

  /** Where a card dropped on `ref` lands (top card of a column or the slot). */
  const landingRect = (ref: PileRef): Rect => {
    const top = topOf(pileOf(game, ref));
    const placed = top ? byId.get(top.id) : undefined;
    if (ref.kind === 'tableau' && placed) return { x: placed.x, y: placed.y, w: cardW, h: cardH };
    return slotRect(metrics, ref);
  };

  const cursorRect = (): Rect => {
    const ref = cursor.ref;
    const pile = pileOf(game, ref);
    if (pile.length === 0) return slotRect(metrics, ref);
    if (ref.kind === 'tableau') {
      const first = byId.get((pile[pile.length - depthOf(cursor)] as { id: number }).id) as Placement;
      const last = byId.get((topOf(pile) as { id: number }).id) as Placement;
      return { x: first.x, y: first.y, w: cardW, h: last.y - first.y + cardH };
    }
    const top = byId.get((topOf(pile) as { id: number }).id) as Placement;
    return { x: top.x, y: top.y, w: cardW, h: cardH };
  };

  const boardStyle = { '--cw': px(cardW), '--ch': px(cardH) } as CSSProperties;
  const classes = ['sol-board', 'no-gesture', cardW >= 64 && 'is-large', cardW < 44 && 'is-small', drag && 'is-dragging', celebrate && 'is-celebrating']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={boardRef}
      className={classes}
      style={boardStyle}
      role="group"
      aria-label={t.boardLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {ready && (
        <>
          {ALL_PILES.map((ref) => {
            const key = refKey(ref);
            const base = slotRect(metrics, ref);
            const rect = ref.kind === 'tableau' ? { ...base, h: Math.max(cardH, (layout.columnBottoms[ref.index] ?? 0) - base.y) } : base;
            const empty = pileOf(game, ref).length === 0;
            const isCursor = sameRef(ref, cursor.ref);
            const stockHint = ref.kind === 'stock' && hint !== null && hint.kind !== 'move';
            return (
              <div
                key={key}
                ref={(el) => {
                  if (el) slotRefs.current.set(key, el);
                  else slotRefs.current.delete(key);
                }}
                className={['sol-slot', `sol-slot--${ref.kind}`, empty && 'is-empty', stockHint && 'is-hint'].filter(Boolean).join(' ')}
                style={boxStyle(rect)}
                data-pile={key}
                role="button"
                tabIndex={isCursor ? 0 : -1}
                aria-label={pileLabel(t, game, ref, fmt.list)}
                aria-disabled={disabled || undefined}
              >
                <span className="sol-slot__mark" style={{ width: px(cardW), height: px(cardH) }} aria-hidden="true">
                  {ref.kind === 'stock' && (game.waste.length > 0 ? <Icon name="restart" size={Math.round(cardW * 0.5)} /> : <Icon name="close" size={Math.round(cardW * 0.36)} />)}
                  {ref.kind === 'foundation' && <span className="sol-slot__glyph">{t.rankShort[0]}</span>}
                  {ref.kind === 'tableau' && <span className="sol-slot__glyph">{t.rankShort[12]}</span>}
                </span>
              </div>
            );
          })}

          {layout.cards.map((c) => {
            const di = dragIndex.get(c.id);
            const dragging = di !== undefined && drag !== null;
            const x = dragging ? c.x + drag.dx : c.x;
            const y = dragging ? c.y + drag.dy : c.y;
            const z = dragging ? 5000 + (di as number) : raised.has(c.id) ? 1000 + c.z : c.z;
            const pileLength = pileOf(game, c.pile).length;
            const foundationTop = c.pile.kind === 'foundation' && c.index === pileLength - 1;
            // Cards fully covered by the card above (stacked piles) cast no shadow, so stacks stay crisp.
            const visibleFromTop = c.pile.kind === 'waste' && game.draw === 3 ? 3 : 1;
            const buried = c.pile.kind !== 'tableau' && !dragging && c.index < pileLength - visibleFromTop;
            const cls = [
              'sol-card',
              c.up ? 'is-up' : 'is-down',
              dragging && 'is-dragging',
              pickedIds.has(c.id) && 'is-picked',
              hintIds.has(c.id) && 'is-hint',
              shaking.has(c.id) && 'is-shake',
              celebrate && foundationTop && 'is-celebrate',
              buried && 'is-buried',
            ]
              .filter(Boolean)
              .join(' ');
            const style = {
              transform: `translate3d(${px(x)}, ${px(y)}, 0)`,
              zIndex: z,
              '--i': c.pile.kind === 'foundation' ? c.pile.index : 0,
            } as CSSProperties;
            return (
              <div key={c.id} className={cls} style={style} data-card={c.id} aria-hidden="true">
                <span className="sol-card__inner">
                  <CardFace id={c.id} up={c.up} rankLabel={rankLabel(t, c.id)} />
                </span>
              </div>
            );
          })}

          {game.stock.length > 0 && (
            <span className="sol-count tabular" style={{ left: px(slotRect(metrics, STOCK).x + cardW / 2), top: px(cardH) }} aria-hidden="true">
              {fmt.number(game.stock.length)}
            </span>
          )}

          {targets.map((ref) => (
            <span
              key={`target-${refKey(ref)}`}
              className={drag?.over && sameRef(drag.over, ref) ? 'sol-target is-over' : 'sol-target'}
              style={boxStyle(landingRect(ref))}
              aria-hidden="true"
            >
              <Icon name="plus" size={Math.max(14, Math.round(cardW * 0.32))} />
            </span>
          ))}

          {hint?.kind === 'move' && <span className="sol-target is-hint" style={boxStyle(landingRect(hint.move.to))} aria-hidden="true" />}

          {kbFocus && !disabled && <span className={picked ? 'sol-cursor is-carrying' : 'sol-cursor'} style={boxStyle(cursorRect())} aria-hidden="true" />}

        </>
      )}
    </div>
  );
});
