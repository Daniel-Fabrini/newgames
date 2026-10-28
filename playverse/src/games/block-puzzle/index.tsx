import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GameLayout } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { announce } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { useStopwatch } from '../../hooks/useStopwatch';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats, type RecordResult } from '../../services/stats';
import { randomSeed } from '../../utils/random';
import { Board, type Effects, type Preview } from './Board';
import { PieceView, Tray, shapeName } from './Tray';
import {
  SIZE,
  anchorForTap,
  canPlace,
  clampAnchor,
  footprint,
  indexOf,
  lineCells,
  linesAfterPlacing,
  newGame,
  place,
  trayFits,
  type Cell,
  type GameState,
  type PlaceOutcome,
} from './engine';
import { shapeOf, type Shape } from './shapes';
import { usePieceDrag } from './usePieceDrag';
import { saveSpec } from './save';
import { meta } from './meta';
import './block-puzzle.css';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'over';

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

const CENTER: Cell = { row: 4, col: 4 };
const SAVE_TIME_STEP_MS = 3000;

function initial(): { game: GameState; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved && !saved.game.over) return saved;
  return { game: newGame(randomSeed()), elapsedMs: 0 };
}

function buildPreview(board: readonly number[], shape: Shape, anchor: Cell): Preview | null {
  const cells = footprint(shape, anchor.row, anchor.col)
    .filter((c) => c.row >= 0 && c.row < SIZE && c.col >= 0 && c.col < SIZE)
    .map((c) => indexOf(c.row, c.col));
  if (cells.length === 0) return null;
  const valid = canPlace(board, shape, anchor.row, anchor.col);
  const clear = valid ? lineCells(linesAfterPlacing(board, shape, anchor.row, anchor.col)) : [];
  return { cells: new Set(cells), valid, color: shape.color, clear: new Set(clear) };
}

function effectsOf(id: number, out: PlaceOutcome, shape: Shape, anchor: Cell): Effects {
  const cx = anchor.col + shape.w / 2;
  const cy = anchor.row + shape.h / 2;
  return {
    id,
    placed: out.placed,
    cleared: out.cleared.map((c) => {
      const r = Math.floor(c.index / SIZE) + 0.5;
      const col = (c.index % SIZE) + 0.5;
      return { ...c, delay: Math.round(Math.min(Math.hypot(r - cy, col - cx), 9) * 22) };
    }),
    rows: out.rows,
    cols: out.cols,
    boxes: out.boxes,
    gained: out.gained,
    lines: out.lines,
    combo: out.combo,
    x: Math.min(Math.max(cx, 1.4), SIZE - 1.4),
    y: Math.min(Math.max(cy, 1), SIZE - 0.6),
    originX: (cx / SIZE) * 100,
    originY: (cy / SIZE) * 100,
  };
}

export default function BlockPuzzle() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.blockPuzzle;
  const stats = useGameStats('block-puzzle');
  const reduced = useReducedMotion();
  const [boot] = useState(initial);
  const [game, setGame] = useState<GameState>(boot.game);
  const [dialog, setDialog] = useState<Dialog>('none');
  const [result, setResult] = useState<RecordResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** Keyboard placement position (top-left anchor of the selected piece). */
  const [cursor, setCursor] = useState<Cell | null>(null);
  /** Board cell under the mouse / finger while a piece is selected. */
  const [hover, setHover] = useState<Cell | null>(null);
  const [fx, setFx] = useState<Effects | null>(null);
  const fxCounter = useRef(0);
  const lastCursor = useRef<Cell | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const playing = dialog === 'none' && !game.over;
  const clock = useStopwatch(playing && game.placed > 0, boot.elapsedMs);
  const { getElapsed, reset: resetClock } = clock;

  // The save payload changes only with the game or every few seconds of play: a new object on
  // every stopwatch tick would keep postponing the debounced autosave. Finished games are not
  // saved, so the next visit starts a fresh board.
  const timeBucket = Math.floor(clock.elapsedMs / SAVE_TIME_STEP_MS);
  const saveData = useMemo(
    () => (game.over ? null : { game, elapsedMs: Math.max(getElapsed(), timeBucket * SAVE_TIME_STEP_MS) }),
    [game, timeBucket, getElapsed],
  );
  useAutosave(saveSpec, saveData);

  const fits = useMemo(() => trayFits(game.board, game.tray), [game.board, game.tray]);
  const shapeAt = useCallback((slot: number): Shape | null => {
    const piece = game.tray[slot];
    return piece ? shapeOf(piece.shape) : null;
  }, [game.tray]);
  const selectedShape = selected === null ? null : shapeAt(selected);

  const finish = useCallback(
    (state: GameState) => {
      const res = recordMatch(
        'block-puzzle',
        {
          outcome: 'ended',
          score: state.score,
          durationMs: getElapsed(),
          metrics: { linesCleared: state.lines, maxCombo: state.maxCombo, bestLines: state.lines, piecesPlaced: state.placed },
        },
        meta.metricRules,
      );
      setResult(res);
      return res;
    },
    [getElapsed],
  );

  const tryPlace = useCallback(
    (slot: number, anchor: Cell): boolean => {
      if (!playing) return false;
      const piece = game.tray[slot];
      const out = place(game, slot, anchor.row, anchor.col);
      if (!piece || !out) {
        feedback('error');
        announce(t.announce.invalid);
        return false;
      }
      const shape = shapeOf(piece.shape);
      fxCounter.current += 1;
      setGame(out.state);
      setFx(effectsOf(fxCounter.current, out, shape, anchor));
      setSelected(null);
      setHover(null);
      setCursor(null);
      lastCursor.current = anchor;
      feedback(out.lines > 0 ? 'clear' : 'place');
      const parts = [t.announce.placed(out.gained, out.state.score)];
      if (out.lines > 0) parts.push(t.announce.cleared(out.rows.length + out.cols.length, out.boxes.length, out.combo));
      if (out.dealt && !out.state.over) parts.push(t.announce.newPieces);
      if (out.state.over) {
        parts.push(t.overBody);
        finish(out.state);
      }
      announce(parts.join(' '));
      return true;
    },
    [game, playing, finish, t],
  );

  const { drag, floatRef, handlersFor, consumeClick } = usePieceDrag({
    enabled: playing,
    reducedMotion: reduced,
    areaRef,
    shapeAt,
    onStart: () => {
      setSelected(null);
      setHover(null);
      setCursor(null);
      feedback('select');
    },
    onDrop: tryPlace,
  });

  // Effects (pop, clear sweep, score popup) are cosmetic and short-lived.
  useEffect(() => {
    if (!fx) return;
    const id = window.setTimeout(() => setFx(null), 1150);
    return () => window.clearTimeout(id);
  }, [fx]);

  // Let the last placement and its clear play out before showing the end screen.
  useEffect(() => {
    if (!game.over || dialog !== 'none') return;
    const id = window.setTimeout(
      () => {
        feedback('lose');
        setDialog('over');
      },
      reduced ? 300 : 1000,
    );
    return () => window.clearTimeout(id);
  }, [game.over, dialog, reduced]);

  const select = useCallback(
    (slot: number, source: 'pointer' | 'keyboard') => {
      if (!playing) return;
      const piece = game.tray[slot];
      if (!piece) {
        feedback('error');
        announce(t.announce.emptySlot);
        return;
      }
      const shape = shapeOf(piece.shape);
      if (selected === slot && source === 'pointer') {
        setSelected(null);
        setHover(null);
        feedback('tap');
        announce(t.announce.cancelled);
        return;
      }
      setSelected(slot);
      const base = lastCursor.current ?? anchorForTap(shape, CENTER.row, CENTER.col);
      setCursor(source === 'keyboard' ? clampAnchor(shape, base.row, base.col) : null);
      feedback('select');
      announce(fits[slot] ? t.announce.selected(shapeName(m, shape)) : t.announce.selectedNoFit(shapeName(m, shape)));
    },
    [playing, game.tray, selected, fits, m, t],
  );

  const onSlotClick = useCallback(
    (slot: number) => {
      if (consumeClick()) return;
      select(slot, 'pointer');
    },
    [consumeClick, select],
  );

  const onHover = useCallback((cell: Cell | null) => {
    setHover((prev) => (prev === cell || (prev && cell && prev.row === cell.row && prev.col === cell.col) ? prev : cell));
    if (cell) setCursor(null);
  }, []);

  const onTapCell = useCallback(
    (cell: Cell) => {
      if (selected === null || !selectedShape) return;
      tryPlace(selected, anchorForTap(selectedShape, cell.row, cell.col));
    },
    [selected, selectedShape, tryPlace],
  );

  const cancelSelection = useCallback(() => {
    setSelected(null);
    setHover(null);
    setCursor(null);
    announce(t.announce.cancelled);
  }, [t]);

  const startNew = useCallback(() => {
    setGame(newGame(randomSeed()));
    resetClock(0);
    setResult(null);
    setSelected(null);
    setHover(null);
    setCursor(null);
    setFx(null);
    lastCursor.current = null;
    setDialog('none');
  }, [resetClock]);

  const requestRestart = () => {
    if (game.placed > 0 && !game.over) setDialog('restart');
    else startNew();
  };

  const confirmRestart = () => {
    finish(game);
    startNew();
  };

  const keyboardAnchor = (shape: Shape): Cell => cursor ?? (hover ? anchorForTap(shape, hover.row, hover.col) : anchorForTap(shape, CENTER.row, CENTER.col));

  useKeyboard((e) => {
    if (e.key === 'p' || e.key === 'P') {
      setDialog('pause');
      return true;
    }
    if (e.key === 'Escape') {
      if (selected !== null) cancelSelection();
      else setDialog('pause');
      return true;
    }
    if (!playing || drag) return false;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      select(Number(e.key) - 1, 'keyboard');
      return true;
    }
    const arrow = ARROWS[e.key];
    if (arrow) {
      if (selected === null || !selectedShape) {
        const first = fits.findIndex(Boolean);
        const slot = first >= 0 ? first : game.tray.findIndex((p) => p !== null);
        if (slot >= 0) select(slot, 'keyboard');
        return true;
      }
      const base = keyboardAnchor(selectedShape);
      const next = clampAnchor(selectedShape, base.row + arrow[0], base.col + arrow[1]);
      setCursor(next);
      setHover(null);
      lastCursor.current = next;
      announce(t.announce.position(next.row + 1, next.col + 1, canPlace(game.board, selectedShape, next.row, next.col)));
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (selected === null || !selectedShape) return false;
      tryPlace(selected, keyboardAnchor(selectedShape));
      return true;
    }
    return false;
  }, dialog === 'none');

  // Preview: dragged piece, else selected piece under the pointer, else keyboard cursor.
  const previewSource: { shape: Shape; anchor: Cell } | null =
    drag && !drag.returning
      ? drag.anchor && { shape: drag.shape, anchor: drag.anchor }
      : selectedShape && hover
        ? { shape: selectedShape, anchor: anchorForTap(selectedShape, hover.row, hover.col) }
        : selectedShape && cursor
          ? { shape: selectedShape, anchor: cursor }
          : null;
  const pShape = previewSource?.shape ?? null;
  const pRow = previewSource?.anchor.row ?? 0;
  const pCol = previewSource?.anchor.col ?? 0;
  const preview = useMemo(() => (pShape ? buildPreview(game.board, pShape, { row: pRow, col: pCol }) : null), [game.board, pShape, pRow, pCol]);

  const best = Math.max(stats.bestScore ?? 0, game.score);
  const hint = selected !== null ? (fits[selected] ? t.hintSelected : t.hintNoFit) : game.placed < 3 ? t.hintIdle : null;
  const lineRecord = Boolean(result?.improvedMetrics.includes('bestLines')) && game.lines > 0;
  const comboRecord = Boolean(result?.improvedMetrics.includes('maxCombo')) && game.maxCombo > 0;

  return (
    <GameLayout
      gameId="block-puzzle"
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      stats={[
        { label: g.score, value: fmt.number(game.score), primary: true },
        { label: g.best, value: fmt.number(best), icon: 'crown' },
        { label: t.lines, value: fmt.number(game.lines) },
      ]}
    >
      <div className="bp-wrap">
        <div className="bp-game">
          <Board
            board={game.board}
            preview={preview}
            fx={fx}
            placing={playing && selected !== null && !drag}
            over={game.over}
            reducedMotion={reduced}
            areaRef={areaRef}
            onHover={onHover}
            onTapCell={onTapCell}
          />
          <div className="bp-status" aria-live="off">
            {game.combo > 0 && (
              <span className="bp-combo" role="img" aria-label={t.comboLabel(game.combo)}>
                <Icon name="bolt" size={14} />
                {t.combo(game.combo)}
              </span>
            )}
            {hint && <span className="bp-status__hint">{hint}</span>}
          </div>
          <Tray
            tray={game.tray}
            fits={fits}
            selected={selected}
            dragging={drag ? drag.slot : null}
            disabled={!playing}
            handlers={handlersFor}
            onSelect={onSlotClick}
          />
        </div>
      </div>

      {drag &&
        createPortal(
          <div ref={floatRef} className="bp-float" style={{ '--fcell': `${drag.pitch}px` } as CSSProperties} aria-hidden="true">
            <div className="bp-float__inner" style={{ '--from': drag.fromScale } as CSSProperties}>
              <PieceView shape={drag.shape} />
            </div>
          </div>,
          document.body,
        )}

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={requestRestart} onHelp={() => setDialog('help')} />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      <ConfirmDialog
        open={dialog === 'restart'}
        title={g.restartTitle}
        body={g.restartBody}
        confirmLabel={g.newGame}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmRestart}
      />
      <ResultDialog
        open={dialog === 'over'}
        tone="neutral"
        title={g.gameOver}
        subtitle={t.overBody}
        newRecord={result?.isNewBestScore}
        stats={[
          { label: g.score, value: fmt.number(game.score), record: result?.isNewBestScore },
          { label: g.best, value: fmt.number(Math.max(result?.previousBestScore ?? 0, game.score)) },
          { label: t.lines, value: fmt.number(game.lines), record: lineRecord },
          { label: t.bestCombo, value: fmt.number(game.maxCombo), record: comboRecord },
          { label: t.piecesPlaced, value: fmt.number(game.placed) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]}
        primary={{ label: g.playAgain, onClick: startNew }}
      />
    </GameLayout>
  );
}
