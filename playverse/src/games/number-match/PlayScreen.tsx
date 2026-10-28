import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, ToolButton, type GameStat } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog, type ResultStat } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { Button } from '../../components/Button';
import { announce } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { feedback } from '../../services/feedback';
import { clearGame, saveGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats, type RecordResult } from '../../services/stats';
import { completeLevel } from '../../services/progress';
import { randomSeed } from '../../utils/random';
import { Board, type Pulse } from './Board';
import {
  addNumbers,
  canAdd,
  canUndo,
  challengeStars,
  newChallenge,
  newClassic,
  nextStage,
  removePair,
  requestHint,
  stageBonus,
  undo,
  type GameState,
  type Mode,
  type RemoveResult,
} from './engine';
import { colOf, digitCount, hasPair, isDigit, rowOf, type Pair } from './match';
import { saveSpecFor, type SavedNumberMatch } from './save';
import { useBackHandler } from '../../app/embed';
import { meta } from './meta';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'stage' | 'over' | 'level' | 'stuck';

interface PlayScreenProps {
  mode: Mode;
  boot: SavedNumberMatch;
  /** Back to the mode selection (the game in progress stays saved). */
  onChangeMode: () => void;
  /** Back to the challenge level list. */
  onLevels: () => void;
}

const SAVE_EVERY_MS = 5000;
const COLLAPSE_MS = 260;
const END_DELAY_MS = 420;
const ERROR_MS = 650;
const NO_ROWS: readonly number[] = [];

function initialDialog(game: GameState): Dialog {
  return game.mode === 'classic' && game.status === 'cleared' ? 'stage' : 'none';
}

/** Whether abandoning this classic run should be recorded as a finished match. */
const hasProgress = (game: GameState) => game.status === 'playing' && (game.moves > 0 || game.stage > 1 || game.score > 0);

export function PlayScreen({ mode, boot, onChangeMode, onLevels }: PlayScreenProps) {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.numberMatch;
  const reduced = useReducedMotion();
  const stats = useGameStats('number-match');
  const spec = saveSpecFor(mode);

  const [game, setGame] = useState<GameState>(boot.game);
  const [dialog, setDialog] = useState<Dialog>(() => initialDialog(boot.game));
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Pair | 'add' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [collapse, setCollapse] = useState<{ cells: number[]; rows: number[] } | null>(null);
  const [burst, setBurst] = useState<Pulse | null>(null);
  const [error, setError] = useState<Pulse | null>(null);
  const [reveal, setReveal] = useState<Pulse | null>(null);
  const [gain, setGain] = useState<{ points: number; token: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [record, setRecord] = useState<RecordResult | null>(null);
  const [levelDone, setLevelDone] = useState<{ stars: number; timeMs: number; bestTime: boolean } | null>(null);
  const tokens = useRef(1);
  const timers = useRef<number[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  const playing = dialog === 'none' && game.status === 'playing';
  const busy = collapse !== null;
  const clock = useStopwatch(playing, boot.elapsedMs);
  const getElapsed = clock.getElapsed;
  const finished = game.status === 'over' || (game.mode === 'challenge' && game.status === 'cleared');

  // Finished games are not saved. The elapsed time is refreshed every few seconds so the debounced save can settle.
  const saveTick = Math.floor(clock.elapsedMs / SAVE_EVERY_MS);
  const saveState = useMemo(
    () => (finished ? null : { game, elapsedMs: Math.max(getElapsed(), saveTick * SAVE_EVERY_MS) }),
    [finished, game, getElapsed, saveTick],
  );
  useAutosave(spec, saveState);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const nextToken = () => tokens.current++;

  const clearTransient = () => {
    setSelected(null);
    setHint(null);
    setMessage(null);
    setCollapse(null);
    setBurst(null);
    setError(null);
  };

  const showError = (text: string, cells: number[]) => {
    const token = nextToken();
    feedback('error');
    setError({ cells, token });
    later(() => setError((e) => (e?.token === token ? null : e)), ERROR_MS);
    setMessage({ text, tone: 'error' });
    announce(text);
  };

  /** Records the end of a stage/level/run right away; the result dialog follows the animation. */
  const conclude = (state: GameState, delay: number) => {
    const elapsed = getElapsed();
    const open = (d: Dialog) => (delay > 0 ? later(() => setDialog(d), delay) : setDialog(d));
    if (state.mode === 'classic') {
      if (state.status === 'cleared') {
        feedback('win');
        announce(t.result.stageTitle(state.stage));
        open('stage');
        return;
      }
      clearGame('number-match', 'classic');
      const res = recordMatch(
        'number-match',
        {
          outcome: 'ended',
          score: state.score,
          durationMs: elapsed,
          variant: 'classic',
          metrics: { pairsCleared: state.pairsCleared, highestStage: state.stage, rowsCleared: state.rowsCleared },
        },
        meta.metricRules,
      );
      setRecord(res);
      feedback('lose');
      announce(`${g.gameOver}. ${t.result.overBody}`);
      open('over');
      return;
    }
    clearGame('number-match', 'challenge');
    if (state.status === 'cleared') {
      const stars = challengeStars(state.addsUsed, state.hintsUsed);
      const timeMs = Math.round(elapsed);
      const outcome = completeLevel('number-match', state.stage, { stars, moves: state.moves, timeMs }, 'challenges');
      recordMatch('number-match', { outcome: 'win', durationMs: elapsed, variant: 'challenge', metrics: { pairsCleared: state.pairsCleared } }, meta.metricRules);
      setLevelDone({ stars, timeMs, bestTime: outcome.newBestTime && !outcome.firstCompletion });
      feedback('win');
      announce(`${t.result.levelTitle(state.stage)} ${g.starsOf(stars, 3)}`);
      open('level');
    } else {
      recordMatch('number-match', { outcome: 'loss', durationMs: elapsed, variant: 'challenge', metrics: { pairsCleared: state.pairsCleared } }, meta.metricRules);
      feedback('lose');
      announce(`${t.result.stuckTitle}. ${t.result.stuckBody}`);
      open('stuck');
    }
  };

  const commitRemoval = (r: Extract<RemoveResult, { ok: true }>, a: number, b: number) => {
    const token = nextToken();
    const da = fmt.number(game.cells[a] ?? 0);
    const db = fmt.number(game.cells[b] ?? 0);
    setSelected(null);
    setHint(null);
    setMessage(null);
    setError(null);
    setGame(r.state);
    if (mode === 'classic') setGain({ points: r.gained, token });
    const animate = !reduced;
    if (animate) {
      setBurst({ cells: [a, b], token });
      later(() => setBurst((p) => (p?.token === token ? null : p)), COLLAPSE_MS + 160);
    }
    if (r.rowsRemoved.length > 0) {
      feedback('clear');
      if (animate) {
        setCollapse({ cells: r.beforeCollapse, rows: r.rowsRemoved });
        later(() => setCollapse(null), COLLAPSE_MS);
      }
    } else {
      feedback('merge');
    }
    const base = mode === 'classic' ? t.announce.removed(da, db, fmt.number(r.gained)) : t.announce.removedChallenge(da, db, digitCount(r.state.cells));
    announce(r.rowsRemoved.length > 0 ? `${base}. ${t.announce.rows(r.rowsRemoved.length)}` : base);
    if (r.state.status !== 'playing') conclude(r.state, animate ? END_DELAY_MS : 0);
  };

  const activate = (index: number) => {
    if (!playing || busy) return;
    const value = game.cells[index];
    if (!isDigit(value)) return;
    setCursor(index);
    if (selected === null) {
      setSelected(index);
      setMessage(null);
      feedback('select');
      announce(t.announce.selected(fmt.number(value), rowOf(index) + 1, colOf(index) + 1));
      return;
    }
    if (selected === index) {
      setSelected(null);
      feedback('tap');
      announce(t.announce.deselected);
      return;
    }
    const r = removePair(game, selected, index);
    if (r.ok) {
      commitRemoval(r, selected, index);
      return;
    }
    const text = r.reason === 'digits' ? t.errors.digits(fmt.number(game.cells[selected] ?? 0), fmt.number(value)) : t.errors.blocked;
    showError(text, [selected, index]);
    setSelected(index);
  };

  // Stable handler for the memoised board (the clock re-renders this screen several times a second).
  const activateRef = useRef(activate);
  useEffect(() => {
    activateRef.current = activate;
  });
  const onActivate = useCallback((index: number) => activateRef.current(index), []);

  const doAdd = () => {
    if (!playing || busy) return;
    const r = addNumbers(game);
    if (!r.ok) {
      showError(t.errors.noAdds, []);
      return;
    }
    setGame(r.state);
    setHint(null);
    setMessage(null);
    feedback('place');
    announce(`${t.announce.added(r.added)}. ${t.addsLeft(r.state.addsLeft)}`);
    setReveal({ cells: [r.state.cells.length - 1], token: nextToken() });
    if (r.state.status === 'over') conclude(r.state, reduced ? 0 : END_DELAY_MS);
  };

  const doHint = () => {
    if (!playing || busy) return;
    const h = requestHint(game);
    if (h.kind === 'pair') {
      const [a, b] = h.pair;
      setGame(h.state);
      setHint(h.pair);
      setSelected(null);
      setMessage({ text: t.prompt.hint, tone: 'info' });
      feedback('hint');
      announce(t.announce.hintPair(rowOf(a) + 1, colOf(a) + 1, rowOf(b) + 1, colOf(b) + 1));
      setReveal({ cells: [a], token: nextToken() });
      setCursor(a);
    } else if (h.kind === 'add') {
      setHint('add');
      setMessage({ text: t.prompt.hintAdd, tone: 'info' });
      feedback('hint');
      announce(t.prompt.hintAdd);
    } else {
      showError(t.errors.noHints, []);
    }
  };

  const doUndo = () => {
    if (!playing || busy || !canUndo(game)) return;
    setGame(undo(game));
    clearTransient();
    feedback('undo');
    announce(t.announce.undone);
  };

  const resetTo = (state: GameState) => {
    setGame(state);
    clock.reset(0);
    clearTransient();
    setGain(null);
    setRecord(null);
    setLevelDone(null);
    setCursor(0);
    setDialog('none');
  };

  const confirmRestart = () => {
    if (mode === 'classic') {
      if (hasProgress(game)) {
        recordMatch(
          'number-match',
          {
            outcome: 'ended',
            score: game.score,
            durationMs: getElapsed(),
            variant: 'classic',
            metrics: { pairsCleared: game.pairsCleared, highestStage: game.stage, rowsCleared: game.rowsCleared },
          },
          meta.metricRules,
        );
      }
      resetTo(newClassic(randomSeed()));
    } else {
      resetTo(newChallenge(game.stage));
    }
  };

  const requestRestart = () => {
    const progress = mode === 'classic' ? hasProgress(game) : game.status === 'playing' && game.moves > 0;
    if (progress) setDialog('restart');
    else confirmRestart();
  };

  /** Writes the save synchronously before leaving, so the next screen reads the current state. */
  const persistNow = () => {
    if (finished) clearGame('number-match', spec.slot);
    else saveGame(spec, { game, elapsedMs: getElapsed() });
  };

  const changeMode = () => {
    persistNow();
    onChangeMode();
  };

  // Embed mode (host back button / header back): back to the setup / level screen (the game is saved).
  useBackHandler(() => {
    changeMode();
    return true;
  });

  const toLevels = () => {
    persistNow();
    onLevels();
  };

  const goNextStage = () => {
    const s = nextStage(game);
    setGame(s);
    clearTransient();
    setGain(null);
    setCursor(0);
    setDialog('none');
    feedback('tap');
    announce(`${t.announce.stageStart(s.stage)}. ${t.prompt.idle}`);
  };

  const focusCursor = () => {
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${Math.min(cursor, Math.max(0, game.cells.length - 1))}"]`)?.focus();
  };

  useKeyboard((e) => {
    const k = e.key;
    if (k === 'h' || k === 'H') doHint();
    else if (k === 'a' || k === 'A' || k === '+') doAdd();
    else if (k === 'u' || k === 'U' || k === 'Backspace') doUndo();
    else if (k === 'p' || k === 'P') setDialog('pause');
    else if (k === 'Escape') {
      if (selected !== null) {
        setSelected(null);
        announce(t.announce.deselected);
      } else setDialog('pause');
    } else if (k.startsWith('Arrow') && !gridRef.current?.contains(document.activeElement)) focusCursor();
    else return false;
    return true;
  }, dialog === 'none');

  const pairsNow = useMemo(() => hasPair(game.cells), [game.cells]);
  const left = digitCount(game.cells);
  const best = Math.max(stats.bestScore ?? 0, game.score);
  const selectedDigit = selected !== null ? game.cells[selected] : undefined;

  let statusText = message?.text ?? '';
  if (!message && game.status === 'playing') {
    if (!pairsNow) statusText = t.prompt.noPairs;
    else if (selectedDigit !== undefined && isDigit(selectedDigit)) statusText = t.prompt.selected(fmt.number(selectedDigit));
    else statusText = t.prompt.idle;
  }

  const hudStats: GameStat[] =
    mode === 'classic'
      ? [
          {
            label: g.score,
            primary: true,
            ariaValue: fmt.number(game.score),
            value: (
              <span className="nm-score">
                {fmt.number(game.score)}
                {gain && (
                  <span key={gain.token} className="nm-gain tabular" aria-hidden="true">
                    {fmt.number(gain.points, { signDisplay: 'always' })}
                  </span>
                )}
              </span>
            ),
          },
          { label: g.best, value: fmt.number(best), icon: 'crown' },
          { label: t.stage, value: fmt.number(game.stage) },
          { label: t.digitsLeft, value: fmt.number(left) },
        ]
      : [
          { label: g.level, value: fmt.number(game.stage), primary: true },
          { label: t.digitsLeft, value: fmt.number(left) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ];

  const hintPair = hint !== null && hint !== 'add' ? hint : null;
  const toolsOff = !playing || busy;

  const overStats: ResultStat[] = [
    { label: g.score, value: fmt.number(game.score), record: record?.isNewBestScore },
    { label: t.result.stageReached, value: fmt.number(game.stage), record: record?.improvedMetrics.includes('highestStage') },
    { label: t.result.pairs, value: fmt.number(game.pairsCleared) },
    { label: g.time, value: fmt.clock(clock.elapsedMs) },
  ];

  return (
    <GameLayout
      gameId="number-match"
      subtitle={mode === 'classic' ? t.subtitle.classic(game.stage) : t.subtitle.challenge(game.stage)}
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      stats={hudStats}
      toolbar={
        <>
          <ToolButton
            icon="hint"
            label={g.hint}
            onClick={doHint}
            disabled={toolsOff || (game.hintsLeft === 0 && pairsNow)}
            badge={fmt.number(game.hintsLeft)}
            description={g.hintsLeft(game.hintsLeft)}
          />
          <ToolButton
            icon="plus"
            label={t.add}
            onClick={doAdd}
            disabled={toolsOff || !canAdd(game)}
            badge={fmt.number(game.addsLeft)}
            active={hint === 'add'}
            description={t.addsLeft(game.addsLeft)}
          />
          <ToolButton
            icon="undo"
            label={g.undo}
            onClick={doUndo}
            disabled={toolsOff || !canUndo(game)}
            badge={game.undo.length > 0 ? fmt.number(game.undo.length) : undefined}
            description={t.undoLeft(game.undo.length)}
          />
        </>
      }
    >
      <div className="nm-play">
        <Board
          cells={collapse?.cells ?? game.cells}
          selected={collapse ? null : selected}
          hint={hintPair}
          collapsing={collapse?.rows ?? NO_ROWS}
          burst={burst}
          error={error}
          reveal={reveal}
          cursor={cursor}
          onCursor={setCursor}
          onActivate={onActivate}
          disabled={!playing}
          gridRef={gridRef}
        />
        <div className="nm-status" aria-hidden="true">
          <p className={message?.tone === 'error' ? 'nm-status__text is-error' : 'nm-status__text'}>{statusText}</p>
        </div>
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={requestRestart} onHelp={() => setDialog('help')}>
        <Button variant="secondary" size="lg" icon="swap" block onClick={changeMode}>
          {t.changeMode}
        </Button>
      </PauseMenu>
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      <ConfirmDialog
        open={dialog === 'restart'}
        title={mode === 'classic' ? t.setup.abandonTitle : t.restartLevelTitle}
        body={mode === 'classic' ? t.setup.abandonBody : t.restartLevelBody}
        confirmLabel={mode === 'classic' ? g.newGame : g.restart}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmRestart}
      />
      <ResultDialog
        open={dialog === 'stage'}
        tone="win"
        title={t.result.stageTitle(game.stage)}
        subtitle={t.result.stageBody}
        stats={[
          { label: t.result.stageBonus, value: fmt.number(stageBonus(game.stage), { signDisplay: 'always' }) },
          { label: g.score, value: fmt.number(game.score) },
          { label: t.result.rows, value: fmt.number(game.rowsCleared) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]}
        primary={{ label: t.result.nextStage, icon: 'arrowRight', onClick: goNextStage }}
      />
      <ResultDialog
        open={dialog === 'over'}
        tone="neutral"
        title={g.gameOver}
        subtitle={t.result.overBody}
        newRecord={record?.isNewBestScore}
        stats={overStats}
        primary={{ label: g.playAgain, onClick: () => resetTo(newClassic(randomSeed())) }}
        secondary={{ label: t.changeMode, onClick: changeMode }}
      />
      <ResultDialog
        open={dialog === 'level'}
        tone="win"
        title={t.result.levelTitle(game.stage)}
        subtitle={t.result.levelBody}
        stars={levelDone?.stars}
        newRecord={levelDone?.bestTime}
        stats={[
          { label: g.time, value: fmt.clock(levelDone?.timeMs ?? clock.elapsedMs), record: levelDone?.bestTime },
          { label: g.moves, value: fmt.number(game.moves) },
          { label: t.result.addsUsed, value: fmt.number(game.addsUsed) },
          { label: t.result.hintsUsed, value: fmt.number(game.hintsUsed) },
        ]}
        primary={{ label: g.nextLevel, icon: 'arrowRight', onClick: () => resetTo(newChallenge(game.stage + 1)) }}
        secondary={{ label: t.result.levels, onClick: toLevels }}
      />
      <ResultDialog
        open={dialog === 'stuck'}
        tone="loss"
        title={t.result.stuckTitle}
        subtitle={t.result.stuckBody}
        stats={[
          { label: t.digitsLeft, value: fmt.number(left) },
          { label: t.result.pairs, value: fmt.number(game.pairsCleared) },
          { label: g.moves, value: fmt.number(game.moves) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]}
        primary={{ label: g.tryAgain, onClick: () => resetTo(newChallenge(game.stage)) }}
        secondary={{ label: t.result.levels, onClick: toLevels }}
      />
    </GameLayout>
  );
}
