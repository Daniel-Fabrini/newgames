import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, ToolButton, type GameStat } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { useBackHandler } from '../../app/embed';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Controls';
import { Icon } from '../../components/Icon';
import { LevelSelect } from '../../components/LevelSelect';
import { GameIcon } from '../../components/brand/GameIcon';
import { announce, toast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { feedback } from '../../services/feedback';
import { completeLevel, totalStars, useLevelProgress, type CompleteLevelOutcome } from '../../services/progress';
import { loadGame, saveGame, useAutosave } from '../../services/saves';
import { recordMatch } from '../../services/stats';
import { readValue, writeValue } from '../../services/storage/storage';
import { Board, type PourAnimation } from './Board';
import {
  canUndo,
  createLevelState,
  markHintUsed,
  movesOf,
  playPour,
  restartLevel,
  starsFor,
  starThresholds,
  undoPour,
  type LevelState,
  type PourError,
} from './engine';
import { generateLevel } from './levels';
import { deadEnd, findHint, poursToSolvable, type DeadEnd } from './solver';
import { defaultPrefs, fromSave, PREFS_KEY, PREFS_VERSION, prefsValidator, saveSpec, toSave, type SavedWaterSort, type WaterSortPrefs } from './save';
import { meta } from './meta';
import './water-sort.css';

type Screen = 'select' | 'play';
type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'switch' | 'won' | 'stuck';

interface WinInfo {
  level: number;
  stars: number;
  moves: number;
  timeMs: number;
  par: number;
  hintsUsed: number;
  outcome: CompleteLevelOutcome;
}

const POUR_MS = 800;
const SAVE_TICK_MS = 5000;

function boot(): { game: LevelState | null; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved) return { game: fromSave(saved), elapsedMs: saved.elapsedMs };
  return { game: null, elapsedMs: 0 };
}

function loadPrefs(): WaterSortPrefs {
  return readValue<WaterSortPrefs>(PREFS_KEY, { validate: prefsValidator, version: PREFS_VERSION }, defaultPrefs);
}

export default function WaterSort() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.waterSort;
  const progress = useLevelProgress('water-sort', 'main');
  const reducedMotion = useReducedMotion();
  const [start] = useState(boot);
  const [game, setGame] = useState<LevelState | null>(start.game);
  const [screen, setScreen] = useState<Screen>(start.game ? 'play' : 'select');
  const [dialog, setDialog] = useState<Dialog>('none');
  const [prefs, setPrefs] = useState<WaterSortPrefs>(loadPrefs);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [pourAnim, setPourAnim] = useState<PourAnimation | null>(null);
  const [shake, setShake] = useState<{ bottle: number; id: number } | null>(null);
  const [win, setWin] = useState<WinInfo | null>(null);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [stuck, setStuck] = useState<{ reason: DeadEnd; back: number | null } | null>(null);
  const animId = useRef(0);
  const bottleEls = useRef<(HTMLButtonElement | null)[]>([]);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const playing = screen === 'play' && dialog === 'none' && game !== null && !game.won;
  const clock = useStopwatch(playing, start.elapsedMs);
  const { getElapsed, reset: resetClock } = clock;

  // Autosave: the in-progress level (never a finished one). Every move saves (debounced) and a new
  // snapshot every few seconds keeps the stopwatch fresh; the elapsed time is read when the snapshot
  // is written, and the page being hidden or the game being left always writes the exact time.
  const saveTick = Math.floor(clock.elapsedMs / SAVE_TICK_MS);
  const saveData = useMemo<SavedWaterSort | null>(
    () => (game && !game.won ? withLiveClock(toSave(game, saveTick * SAVE_TICK_MS), getElapsed) : null),
    [game, saveTick, getElapsed],
  );
  useAutosave(saveSpec, saveData);
  const latestSave = useRef(saveData);
  useEffect(() => {
    latestSave.current = saveData;
  }, [saveData]);
  useEffect(() => {
    const write = () => {
      if (latestSave.current) saveGame(saveSpec, latestSave.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') write();
    };
    window.addEventListener('pagehide', write);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', write);
      document.removeEventListener('visibilitychange', onVisibility);
      write();
    };
  }, []);

  // Clear transient animation state.
  useEffect(() => {
    if (!pourAnim) return;
    const id = window.setTimeout(() => setPourAnim(null), POUR_MS);
    return () => window.clearTimeout(id);
  }, [pourAnim]);

  useEffect(() => {
    if (!shake) return;
    const id = window.setTimeout(() => setShake(null), 360);
    return () => window.clearTimeout(id);
  }, [shake]);

  // Show the result once the last pour animation has played.
  useEffect(() => {
    if (!win || dialog !== 'none') return;
    const id = window.setTimeout(() => setDialog('won'), reducedMotion ? 150 : POUR_MS);
    return () => window.clearTimeout(id);
  }, [win, dialog, reducedMotion]);

  const resetTransient = useCallback(() => {
    setSelected(null);
    setHint(null);
    setPourAnim(null);
    setShake(null);
  }, []);

  /**
   * After a pour (once its animation has played) or when a saved level is resumed: if the position
   * has no moves left or is proven unsolvable, end the attempt with the "dead end" dialog.
   */
  const deadEndTimer = useRef<number | undefined>(undefined);
  const scheduleDeadEndCheck = useCallback((state: LevelState, delayMs: number) => {
    window.clearTimeout(deadEndTimer.current);
    deadEndTimer.current = window.setTimeout(() => {
      if (gameRef.current !== state || state.won) return;
      const reason = deadEnd(state.bottles);
      if (!reason) return;
      setSelected(null);
      setHint(null);
      setStuck({ reason, back: poursToSolvable(state.bottles, state.history) });
      setDialog('stuck');
      feedback('lose');
    }, delayMs);
  }, []);
  useEffect(() => () => window.clearTimeout(deadEndTimer.current), []);

  // A resumed level may already be a dead end (e.g. the app was closed right after the last pour).
  useEffect(() => {
    if (start.game && !start.game.won) scheduleDeadEndCheck(start.game, 400);
  }, [start.game, scheduleDeadEndCheck]);

  const startLevel = useCallback(
    (level: number) => {
      const generated = generateLevel(level);
      setGame(createLevelState(level, generated.bottles, generated.par));
      resetClock(0);
      resetTransient();
      setWin(null);
      setFocusIndex(0);
      setScreen('play');
      setDialog('none');
      if (generated.empties === 1) toast(t.tightLevel, { tone: 'warning' });
      else if (generated.empties >= 3) toast(t.newColour, { tone: 'info' });
      announce(t.levelStarted(level, generated.colours));
    },
    [resetClock, resetTransient, t],
  );

  /** Opens a level from the level screen; asks before abandoning another level in progress. */
  const requestLevel = (level: number) => {
    if (game && !game.won && game.level === level) {
      setScreen('play');
      return;
    }
    if (game && !game.won && movesOf(game) > 0) {
      setPendingLevel(level);
      setDialog('switch');
      return;
    }
    startLevel(level);
  };

  const finishLevel = useCallback(
    (state: LevelState) => {
      const moves = movesOf(state);
      const timeMs = Math.round(getElapsed());
      const stars = starsFor(moves, state.par, state.hintsUsed);
      const before = progress.completed[String(state.level)]?.stars ?? 0;
      const outcome = completeLevel('water-sort', state.level, { stars, moves, timeMs });
      recordMatch(
        'water-sort',
        {
          outcome: 'win',
          durationMs: timeMs,
          variant: 'level',
          // A level counts as perfect the first time it earns 3 stars (replays do not double count).
          metrics: { moves, perfectLevels: stars === 3 && before < 3 ? 1 : 0 },
        },
        meta.metricRules,
      );
      setWin({ level: state.level, stars, moves, timeMs, par: state.par, hintsUsed: state.hintsUsed, outcome });
      feedback('win');
      announce(t.wonAnnouncement(state.level, stars));
    },
    [getElapsed, progress.completed, t],
  );

  const liquidName = (colour: number) => t.liquidName(t.colours[colour] ?? String(colour + 1), t.symbols[colour] ?? '');

  const reject = (bottle: number, reason: PourError | 'finished') => {
    animId.current += 1;
    setShake({ bottle, id: animId.current });
    feedback('error');
    const text =
      reason === 'source-empty' ? t.errors.sourceEmpty : reason === 'target-full' ? t.errors.targetFull : reason === 'colour-mismatch' ? t.errors.colourMismatch : null;
    if (text) {
      announce(text);
      toast(text, { tone: 'error', duration: 1600 });
    }
  };

  const onBottle = (index: number) => {
    if (!playing || !game) return;
    setFocusIndex(index);
    if (selected === null) {
      const bottle = game.bottles[index];
      if (!bottle || bottle.length === 0) {
        reject(index, 'source-empty');
        return;
      }
      setSelected(index);
      feedback('select');
      announce(t.selected(index + 1));
      return;
    }
    if (selected === index) {
      setSelected(null);
      feedback('tap');
      announce(t.cancelled);
      return;
    }
    const result = playPour(game, selected, index);
    if (!result.ok) {
      setSelected(null);
      reject(index, result.reason);
      return;
    }
    setGame(result.state);
    setSelected(null);
    setHint(null);
    animId.current += 1;
    if (!reducedMotion) setPourAnim({ id: animId.current, from: result.move.from, to: result.move.to, amount: result.move.amount, colour: result.move.colour });
    feedback(result.won ? 'clear' : 'place');
    announce(t.poured(result.move.amount, liquidName(result.move.colour), result.move.from + 1, result.move.to + 1));
    if (result.won) finishLevel(result.state);
    else scheduleDeadEndCheck(result.state, reducedMotion ? 60 : POUR_MS);
  };

  const doUndo = () => {
    if (!playing || !game || !canUndo(game)) return;
    setGame(undoPour(game));
    resetTransient();
    feedback('undo');
  };

  /** "Dead end" dialog: undo just enough pours to reach a solvable position again. */
  const undoToSolvable = () => {
    if (!game || !stuck?.back) return;
    let state = game;
    for (let i = 0; i < stuck.back; i++) state = undoPour(state);
    setGame(state);
    resetTransient();
    setStuck(null);
    setDialog('none');
    feedback('undo');
    announce(t.stuck.undo(stuck.back));
  };

  const doHint = () => {
    if (!playing || !game) return;
    setSelected(null);
    const res = findHint(game.bottles);
    if (res.status === 'move') {
      setHint({ from: res.from, to: res.to });
      setGame(markHintUsed(game));
      setFocusIndex(res.from);
      feedback('hint');
      // The bottles are highlighted (glow, outline and arrow badges); a toast would cover them.
      announce(t.hintMove(res.from + 1, res.to + 1));
    } else {
      setHint(null);
      feedback('error');
      const text = res.status === 'unsolvable' ? t.hintUnsolvable : t.hintUnknown;
      toast(text, { tone: 'warning', duration: 4500 });
      announce(text);
    }
  };

  const requestRestart = () => {
    if (!game) return;
    if (movesOf(game) > 0 && !game.won) setDialog('restart');
    else confirmRestart();
  };

  const confirmRestart = () => {
    if (!game) return;
    setGame(restartLevel(game));
    resetClock(0);
    resetTransient();
    setWin(null);
    setStuck(null);
    setDialog('none');
    setScreen('play');
    feedback('undo');
  };

  const openLevels = () => {
    setSelected(null);
    setDialog('none');
    setScreen('select');
  };

  // Embed mode (host back button / header back): from a level go back to the level map (the level is saved).
  useBackHandler(() => {
    if (screen !== 'play') return false;
    openLevels();
    return true;
  });

  const toggleSymbols = (value = !prefs.symbols) => {
    const next = { ...prefs, symbols: value };
    setPrefs(next);
    writeValue(PREFS_KEY, next, PREFS_VERSION);
    announce(value ? t.symbolsOn : t.symbolsOff);
  };

  const focusBottle = (index: number) => {
    if (!game) return;
    const n = game.bottles.length;
    const i = ((index % n) + n) % n;
    setFocusIndex(i);
    bottleEls.current[i]?.focus();
  };

  /** Bottle in the row above/below that is closest horizontally (layout is responsive). */
  const verticalNeighbour = (index: number, direction: 1 | -1): number | null => {
    const current = bottleEls.current[index]?.getBoundingClientRect();
    if (!current) return null;
    let best: { i: number; dy: number; dx: number } | null = null;
    for (let i = 0; i < bottleEls.current.length; i++) {
      const el = bottleEls.current[i];
      if (!el || i === index) continue;
      const r = el.getBoundingClientRect();
      const dy = (r.top - current.top) * direction;
      if (dy < current.height / 2) continue;
      const dx = Math.abs(r.left + r.width / 2 - (current.left + current.width / 2));
      if (!best || dy < best.dy - 1 || (Math.abs(dy - best.dy) <= 1 && dx < best.dx)) best = { i, dy, dx };
    }
    return best ? best.i : null;
  };

  useKeyboard((e) => {
    if (screen !== 'play' || !game) return false;
    const key = e.key;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      focusBottle(focusIndex + (key === 'ArrowRight' ? 1 : -1));
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const next = verticalNeighbour(focusIndex, key === 'ArrowDown' ? 1 : -1);
      if (next !== null) focusBottle(next);
      else bottleEls.current[focusIndex]?.focus();
      return true;
    }
    if (/^[0-9]$/.test(key)) {
      const index = key === '0' ? 9 : Number(key) - 1;
      if (index < game.bottles.length) focusBottle(index);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      // A focused bottle button handles Enter/Space itself (native click).
      if (document.activeElement instanceof HTMLButtonElement) return false;
      onBottle(focusIndex);
      bottleEls.current[focusIndex]?.focus();
      return true;
    }
    if (key === 'Escape') {
      if (selected !== null) {
        setSelected(null);
        announce(t.cancelled);
      } else setDialog('pause');
      return true;
    }
    if (key === 'u' || key === 'U' || key === 'Backspace') {
      doUndo();
      return true;
    }
    if (key === 'h' || key === 'H') {
      doHint();
      return true;
    }
    if (key === 'r' || key === 'R') {
      requestRestart();
      return true;
    }
    if (key === 'p' || key === 'P') {
      setDialog('pause');
      return true;
    }
    return false;
  }, dialog === 'none' && screen === 'play');

  const registerBottle = useCallback((index: number, el: HTMLButtonElement | null) => {
    bottleEls.current[index] = el;
  }, []);

  /* ───────────── Level select screen ───────────── */

  const frontier = Math.min(progress.unlocked, Math.max(1, progress.current));
  const inProgress = game && !game.won ? game : null;
  const completedCount = Object.keys(progress.completed).length;
  const starsTotal = totalStars(progress);

  const levelPicker = (
    <div className="ws-select setup">
      <div className="setup__hero">
        <GameIcon id="water-sort" size={72} />
        <h2>{m.common.games['water-sort'].name}</h2>
        <p>{t.select.intro}</p>
      </div>
      <div className="ws-summary">
        <div className="ws-summary__item">
          <Icon name="check" size={18} />
          <span className="ws-summary__label">{t.select.completed}</span>
          <strong className="tabular">{fmt.number(completedCount)}</strong>
        </div>
        <div className="ws-summary__item is-gold">
          <Icon name="star" size={18} filled />
          <span className="ws-summary__label">{t.select.stars}</span>
          <strong className="tabular">{fmt.number(starsTotal)}</strong>
        </div>
      </div>
      <div className="setup__actions">
        {inProgress && (
          <Button variant="primary" size="lg" block icon="play" onClick={() => requestLevel(inProgress.level)} autoFocus>
            {t.select.continueLevel(inProgress.level)}
          </Button>
        )}
        {inProgress && <p className="ws-select__note">{t.select.inProgress(inProgress.level, movesOf(inProgress))}</p>}
        {(!inProgress || inProgress.level !== frontier) && (
          <Button variant={inProgress ? 'secondary' : 'primary'} size="lg" block icon="play" onClick={() => requestLevel(frontier)} autoFocus={!inProgress}>
            {t.select.play(frontier)}
          </Button>
        )}
      </div>
      <section className="setup__card" aria-label={t.select.gridLabel}>
        <h3 className="ws-select__title">{g.selectLevel}</h3>
        <LevelSelect progress={progress} onSelect={requestLevel} />
      </section>
    </div>
  );

  /* ───────────── Play screen ───────────── */

  const thresholds = game ? starThresholds(game.par) : null;
  const moves = game ? movesOf(game) : 0;
  const stats: GameStat[] | undefined =
    screen === 'play' && game && thresholds
      ? [
          { label: g.level, value: fmt.number(game.level), primary: true },
          { label: g.moves, value: fmt.number(moves) },
          { label: t.goal, value: t.goalValue(thresholds.three), ariaValue: t.goalDescription(thresholds.three, thresholds.two) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]
      : undefined;

  const info = game ? levelInfo(game) : null;

  const pauseExtras = (
    <div className="ws-pause-extras">
      <Button
        variant="secondary"
        size="lg"
        icon="grid"
        block
        onClick={openLevels}
      >
        {t.levelsButton}
      </Button>
      <Switch checked={prefs.symbols} onChange={(v) => toggleSymbols(v)} label={t.showSymbols} icon={<Icon name="sparkle" size={18} />} />
    </div>
  );

  const winInfo = win;
  const levelResult = winInfo ? progress.completed[String(winInfo.level)] : undefined;
  const winThresholds = winInfo ? starThresholds(winInfo.par) : null;
  const improved = winInfo && !winInfo.outcome.firstCompletion && (winInfo.outcome.newBestMoves || winInfo.outcome.newBestTime);

  return (
    <GameLayout
      gameId="water-sort"
      subtitle={screen === 'play' && game && info ? t.levelSubtitle(info.colours, info.empties) : undefined}
      onPause={screen === 'play' ? () => setDialog('pause') : undefined}
      onHelp={() => setDialog('help')}
      stats={stats}
      toolbar={
        screen === 'play' && game ? (
          <>
            <ToolButton icon="undo" label={g.undo} onClick={doUndo} disabled={!playing || !canUndo(game)} badge={moves || undefined} />
            <ToolButton icon="restart" label={g.restart} onClick={requestRestart} disabled={!playing || moves === 0} />
            <ToolButton icon="hint" label={g.hint} onClick={doHint} disabled={!playing} badge={game.hintsUsed || undefined} description={t.hintCap} />
            <ToolButton icon="sparkle" label={t.symbolsButton} onClick={() => toggleSymbols()} active={prefs.symbols} description={t.showSymbols} />
            <ToolButton icon="grid" label={t.levelsShort} onClick={openLevels} description={t.levelsButton} />
          </>
        ) : undefined
      }
    >
      {screen === 'select' || !game ? (
        levelPicker
      ) : (
        <div className="ws-play">
          <Board
            bottles={game.bottles}
            selected={selected}
            hint={hint}
            focusIndex={Math.min(focusIndex, game.bottles.length - 1)}
            showSymbols={prefs.symbols}
            pour={pourAnim}
            shake={shake}
            disabled={!playing}
            onBottle={onBottle}
            onFocusBottle={setFocusIndex}
            registerBottle={registerBottle}
          />
        </div>
      )}

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={game && screen === 'play' ? requestRestart : undefined} onHelp={() => setDialog('help')}>
        {pauseExtras}
      </PauseMenu>
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      <ConfirmDialog
        open={dialog === 'restart'}
        title={t.restartTitle}
        body={t.restartBody}
        confirmLabel={g.restart}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmRestart}
      />
      <ConfirmDialog
        open={dialog === 'switch'}
        title={t.switchTitle}
        body={game ? t.switchBody(game.level) : undefined}
        confirmLabel={t.switchConfirm}
        tone="danger"
        onCancel={() => {
          setPendingLevel(null);
          setDialog('none');
        }}
        onConfirm={() => {
          const level = pendingLevel;
          setPendingLevel(null);
          if (level !== null) startLevel(level);
          else setDialog('none');
        }}
      />
      <ResultDialog
        open={dialog === 'won' && winInfo !== null}
        tone="win"
        title={winInfo ? t.result.title(winInfo.level) : ''}
        stars={winInfo?.stars}
        newRecord={Boolean(improved)}
        subtitle={
          winInfo && winThresholds
            ? winInfo.hintsUsed > 0 && winInfo.stars === 2 && winInfo.moves <= winThresholds.three
              ? t.result.hintCapped
              : winInfo.stars === 3
                ? t.result.perfect
                : winInfo.stars === 2
                  ? t.result.good(winThresholds.three)
                  : t.result.ok(winThresholds.two)
            : undefined
        }
        stats={
          winInfo
            ? [
                { label: g.moves, value: fmt.number(winInfo.moves), record: !winInfo.outcome.firstCompletion && winInfo.outcome.newBestMoves },
                { label: t.par, value: fmt.number(winInfo.par) },
                { label: g.time, value: fmt.clock(winInfo.timeMs), record: !winInfo.outcome.firstCompletion && winInfo.outcome.newBestTime },
                // Per-level bests from the saved progress (after a replay; on a first win they equal this run).
                ...(!winInfo.outcome.firstCompletion && levelResult?.bestMoves !== undefined
                  ? [{ label: t.result.bestMoves, value: fmt.number(levelResult.bestMoves) }]
                  : []),
                ...(!winInfo.outcome.firstCompletion && levelResult?.bestTimeMs !== undefined
                  ? [{ label: t.result.bestTime, value: fmt.clock(levelResult.bestTimeMs) }]
                  : []),
                ...(winInfo.hintsUsed > 0 ? [{ label: t.hintsLabel, value: fmt.number(winInfo.hintsUsed) }] : []),
              ]
            : undefined
        }
        primary={{ label: g.nextLevel, icon: 'arrowRight', onClick: () => winInfo && startLevel(winInfo.level + 1) }}
        secondary={{ label: t.result.replay, onClick: () => winInfo && startLevel(winInfo.level) }}
      />
      <ResultDialog
        open={dialog === 'stuck' && stuck !== null && game !== null}
        tone="loss"
        title={t.stuck.title}
        subtitle={stuck ? `${stuck.reason === 'no-moves' ? t.stuck.noMoves : t.stuck.unsolvable}${stuck.back ? ` ${t.stuck.undoHint(stuck.back)}` : ''}` : undefined}
        stats={game ? [{ label: g.moves, value: fmt.number(movesOf(game)) }, { label: g.time, value: fmt.clock(clock.elapsedMs) }] : undefined}
        primary={{ label: t.stuck.restart, icon: 'restart', onClick: confirmRestart }}
        secondary={stuck?.back ? { label: t.stuck.undo(stuck.back), onClick: undoToSolvable } : undefined}
        onClose={() => setDialog('none')}
      />
    </GameLayout>
  );
}

/** Save snapshot whose `elapsedMs` is read from the stopwatch at the moment it is serialised. */
function withLiveClock(save: SavedWaterSort, getElapsed: () => number): SavedWaterSort {
  const floor = save.elapsedMs;
  const { elapsedMs: _ignored, ...rest } = save;
  return {
    ...rest,
    get elapsedMs() {
      return Math.max(floor, Math.round(getElapsed()));
    },
  };
}

/** Colour and empty-bottle counts of a level state (shown in the header). */
function levelInfo(state: LevelState): { colours: number; empties: number } {
  const colours = new Set(state.initial.flat()).size;
  return { colours, empties: state.initial.length - colours };
}
