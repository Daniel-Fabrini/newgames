import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, GameSetup, ToolButton, type GameStat } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { SegmentedControl, Spinner, Switch } from '../../components/Controls';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Crown } from '../../components/brand/Crown';
import { announce, toast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats, type RecordResult } from '../../services/stats';
import { Board } from './Board';
import { NumberPad } from './NumberPad';
import { COL, ROW, cellAt, unitIndex, unitKind } from './grid';
import { DIFFICULTIES, type Difficulty } from './generator';
import {
  applyHint,
  canUndo,
  checkBoard,
  conflicts as findBoardConflicts,
  erase,
  findHint,
  hasProgress,
  hintsLeft,
  isLocked,
  newGame,
  placeDigit,
  placedCounts,
  restart,
  toggleNote,
  undo,
  visibleErrors,
  type Hint,
  type PlayOptions,
  type SudokuState,
} from './engine';
import { saveSpec, type SavedSudoku } from './save';
import { updatePrefs, useSudokuPrefs } from './prefs';
import { usePuzzleSource } from './usePuzzleSource';
import { meta } from './meta';
import './sudoku.css';

type Phase = 'setup' | 'playing';
type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'abandon' | 'hint' | 'result';

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** Digit from a key press; Shift + digit (on layouts where Shift gives a symbol) toggles a note. */
function keyDigit(e: KeyboardEvent): { digit: number; note: boolean } | null {
  if (/^[1-9]$/.test(e.key)) return { digit: Number(e.key), note: false };
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return match ? { digit: Number(match[1]), note: e.shiftKey } : null;
}

const firstEmpty = (s: SudokuState): number | null => {
  const i = s.values.findIndex((v) => v === 0);
  return i < 0 ? null : i;
};

function initial(): SavedSudoku | null {
  const saved = loadGame(saveSpec);
  return saved && !saved.game.solved ? saved : null;
}

const SAVE_TICK_MS = 2000;

export default function Sudoku() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.sudoku;
  const prefs = useSudokuPrefs();
  const stats = useGameStats('sudoku');
  const source = usePuzzleSource();

  const [boot] = useState(initial);
  const [game, setGame] = useState<SudokuState | null>(boot?.game ?? null);
  const [phase, setPhase] = useState<Phase>(boot ? 'playing' : 'setup');
  const [dialog, setDialog] = useState<Dialog>('none');
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [setupDifficulty, setSetupDifficulty] = useState<Difficulty>(boot?.game.difficulty ?? prefs.difficulty);
  const [generating, setGenerating] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [result, setResult] = useState<{ record: RecordResult; durationMs: number } | null>(null);
  const requestToken = useRef(0);

  const playing = phase === 'playing' && game !== null && !game.solved;
  const running = playing && dialog === 'none' && !generating;
  const clock = useStopwatch(running, boot?.elapsedMs ?? 0);
  const { getElapsed, reset: resetClock } = clock;
  const opts: PlayOptions = useMemo(() => ({ autoNotes: prefs.autoNotes, errorMode: prefs.errorMode }), [prefs.autoNotes, prefs.errorMode]);
  const adjective = (d: Difficulty) => t.difficultyAdjective[d];

  // Autosave: on every change and every couple of seconds of play (the save also flushes on hide/unmount).
  const saveTick = Math.floor(clock.elapsedMs / SAVE_TICK_MS);
  const snapshot = useMemo<SavedSudoku | null>(
    () => (game && !game.solved ? { game, elapsedMs: Math.max(getElapsed(), saveTick * SAVE_TICK_MS) } : null),
    [game, getElapsed, saveTick],
  );
  useAutosave(saveSpec, snapshot);

  // Ignore generation results that arrive after unmount.
  useEffect(
    () => () => {
      requestToken.current++;
    },
    [],
  );

  // Pre-generate the difficulty shown on the setup screen so "start" is usually instant.
  useEffect(() => {
    if (phase === 'setup') source.prefetch(setupDifficulty);
  }, [phase, setupDifficulty, source]);

  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(id);
  }, [flash]);

  const errors = useMemo(() => (game ? visibleErrors(game, prefs.errorMode) : []), [game, prefs.errorMode]);
  const boardConflicts = useMemo(() => (game ? findBoardConflicts(game) : []), [game]);
  const counts = useMemo(() => (game ? placedCounts(game) : []), [game]);

  /* ───────────── Lifecycle of a puzzle ───────────── */

  const begin = useCallback(
    (difficulty: Difficulty) => {
      const token = ++requestToken.current;
      setGenerating(true);
      updatePrefs({ difficulty });
      source.next(difficulty).then(
        (puzzle) => {
          if (token !== requestToken.current) return;
          const next = newGame({ puzzle: puzzle.puzzle, solution: puzzle.solution, difficulty, seed: puzzle.seed });
          setGame(next);
          resetClock(0);
          setSelected(null);
          setNotesMode(false);
          setHint(null);
          setFlash(null);
          setResult(null);
          setDialog('none');
          setPhase('playing');
          setGenerating(false);
          announce(t.announce.started(t.difficultyAdjective[difficulty]));
          source.prefetch(difficulty);
        },
        () => {
          if (token !== requestToken.current) return;
          setGenerating(false);
          toast(t.generateFailed, { tone: 'error' });
        },
      );
    },
    [source, resetClock, t],
  );

  const recordAbandon = useCallback(
    (state: SudokuState) => {
      recordMatch('sudoku', { outcome: 'loss', durationMs: Math.round(getElapsed()), variant: state.difficulty }, meta.metricRules);
    },
    [getElapsed],
  );

  const requestStart = (difficulty: Difficulty) => {
    if (generating) return;
    if (game && !game.solved && hasProgress(game)) {
      setSetupDifficulty(difficulty);
      setDialog('abandon');
      return;
    }
    begin(difficulty);
  };

  const confirmAbandon = () => {
    if (game && !game.solved && hasProgress(game)) recordAbandon(game);
    setDialog('none');
    begin(setupDifficulty);
  };

  const finishWin = (state: SudokuState) => {
    const durationMs = Math.round(getElapsed());
    const d = state.difficulty;
    const record = recordMatch(
      'sudoku',
      { outcome: 'win', durationMs, variant: d, metrics: { [`bestTime:${d}`]: durationMs, [`solved:${d}`]: 1 } },
      meta.metricRules,
    );
    setResult({ record, durationMs });
    setSelected(null);
    setNotesMode(false);
    setDialog('result');
    feedback('win');
    announce(`${t.result.title} ${t.solvedIn(fmt.clock(durationMs))}`);
  };

  const requestRestart = () => {
    if (!game) return;
    if (hasProgress(game) && !game.solved) setDialog('restart');
    else confirmRestart(false);
  };

  const confirmRestart = (abandon = true) => {
    if (!game) return;
    if (abandon && hasProgress(game) && !game.solved) recordAbandon(game);
    const next = restart(game);
    setGame(next);
    resetClock(0);
    setSelected(null);
    setNotesMode(false);
    setResult(null);
    setPhase('playing');
    setDialog('none');
    feedback('clear');
  };

  const goToSetup = () => {
    if (game) setSetupDifficulty(game.difficulty);
    setDialog('none');
    setPhase('setup');
  };

  /* ───────────── Actions ───────────── */

  const describeCell = (cell: number) => t.cellName(ROW[cell]! + 1, COL[cell]! + 1);

  const inputDigit = (digit: number, asNote: boolean = notesMode) => {
    if (!playing || !game || generating) return;
    if (selected === null) {
      toast(t.selectCellFirst);
      feedback('error');
      return;
    }
    if (isLocked(game, selected)) {
      feedback('error');
      announce(t.lockedCell);
      return;
    }
    if (asNote) {
      if (game.values[selected] !== 0) {
        feedback('error');
        return;
      }
      const next = toggleNote(game, selected, digit);
      setGame(next);
      feedback('tap');
      announce(t.announce.noteToggled(digit, (next.notes[selected]! & (1 << (digit - 1))) !== 0));
      return;
    }
    const r = placeDigit(game, selected, digit, opts);
    if (r.status === 'ignored') return;
    setGame(r.state);
    if (r.status === 'solved') {
      feedback('place');
      finishWin(r.state);
      return;
    }
    if (r.status === 'wrong') {
      feedback('error');
      announce(t.announce.wrong(digit));
      return;
    }
    feedback('place');
    const repeated = findBoardConflicts(r.state)[selected];
    announce(repeated ? t.announce.conflict(digit) : t.announce.placed(digit, ROW[selected]! + 1, COL[selected]! + 1));
  };

  const doErase = () => {
    if (!playing || !game || selected === null) return;
    const next = erase(game, selected);
    if (next === game) {
      if (isLocked(game, selected)) announce(t.lockedCell);
      return;
    }
    setGame(next);
    feedback('clear');
    announce(t.announce.erased);
  };

  const doUndo = () => {
    if (!playing || !game || !canUndo(game)) return;
    const last = game.history[game.history.length - 1];
    setGame(undo(game));
    if (last?.changes[0]) setSelected(last.changes[0].cell);
    feedback('undo');
    announce(t.announce.undone);
  };

  const toggleNotesMode = () => {
    if (!playing) return;
    const on = !notesMode;
    setNotesMode(on);
    feedback('select');
    announce(on ? t.tools.notesOn : t.tools.notesOff);
  };

  const doHint = () => {
    if (!playing || !game) return;
    if (hintsLeft(game) === 0) {
      toast(t.hint.none);
      feedback('error');
      return;
    }
    const found = findHint(game, selected);
    if (!found) return;
    const next = applyHint(game, found, opts);
    setGame(next);
    setSelected(found.cell);
    setFlash(found.cell);
    feedback('hint');
    if (next.solved) {
      finishWin(next);
      return;
    }
    setHint(found);
    setDialog('hint');
    announce(hintText(found));
  };

  const doCheck = () => {
    if (!playing || !game) return;
    const r = checkBoard(game);
    setGame(r.state);
    if (r.wrong === 0) {
      feedback('select');
      toast(t.check.none, { tone: 'success' });
      announce(t.check.none);
    } else {
      feedback('error');
      toast(t.check.found(r.wrong), { tone: 'warning' });
      announce(t.check.found(r.wrong));
    }
  };

  const onSelect = useCallback(
    (cell: number) => {
      setSelected(cell);
      feedback('tap');
    },
    [],
  );

  const moveSelection = (dr: number, dc: number) => {
    if (!game) return;
    const from = selected ?? firstEmpty(game) ?? 40;
    const r = selected === null ? ROW[from]! : (ROW[from]! + dr + 9) % 9;
    const c = selected === null ? COL[from]! : (COL[from]! + dc + 9) % 9;
    const cell = cellAt(r, c);
    setSelected(cell);
    const v = game.values[cell]!;
    announce(t.announce.selected(r + 1, c + 1, v ? fmt.number(v) : t.board.empty));
  };

  useKeyboard((e) => {
    if (phase !== 'playing' || !game || generating) return false;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (!game.solved) setDialog('pause');
      return true;
    }
    if (game.solved) return false;
    const arrow = ARROWS[e.key];
    if (arrow) {
      moveSelection(arrow[0], arrow[1]);
      return true;
    }
    const key = keyDigit(e);
    if (key) {
      inputDigit(key.digit, key.note || notesMode);
      return true;
    }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0' || e.code === 'Numpad0') {
      doErase();
      return true;
    }
    if (e.key === 'n' || e.key === 'N') {
      toggleNotesMode();
      return true;
    }
    if (e.key === 'u' || e.key === 'U') {
      doUndo();
      return true;
    }
    return false;
  }, dialog === 'none');

  /* ───────────── Texts ───────────── */

  function hintText(h: Hint): string {
    const cell = describeCell(h.cell);
    if (h.kind === 'mistake') return t.hint.mistake(cell, h.digit);
    if (h.kind === 'reveal') return t.hint.reveal(cell, h.digit);
    let main: string;
    if (h.technique === 'nakedSingle') main = t.hint.nakedSingle(cell, h.digit);
    else if (h.technique === 'hiddenSingle' && h.unit !== undefined) {
      const n = unitIndex(h.unit) + 1;
      main = t.hint.hiddenSingle(t.hint.unitIn[unitKind(h.unit)](n), h.digit, cell);
    } else return t.hint.revealed(cell, h.digit);
    if (h.support.length) main += ` ${t.hint.support(fmt.list(h.support.map((id) => t.techniques[id])))}`;
    return main;
  }

  /* ───────────── Render ───────────── */

  const metrics = stats.metrics;
  const bestOf = (d: Difficulty): number | null => metrics[`bestTime:${d}`] ?? null;
  const solvedOf = (d: Difficulty): number => metrics[`solved:${d}`] ?? 0;
  const showBoard = phase === 'playing' && game !== null;
  const boardHidden = dialog === 'pause' || dialog === 'help' || dialog === 'restart' || dialog === 'abandon';
  const selectedLocked = !game || selected === null || isLocked(game, selected);
  const canErase = playing && !selectedLocked && game !== null && selected !== null && (game.values[selected] !== 0 || game.notes[selected] !== 0);
  const left = game ? hintsLeft(game) : 0;

  let statsStrip: GameStat[] | undefined;
  if (showBoard && game) {
    const best = bestOf(game.difficulty);
    statsStrip = [
      { label: g.time, value: fmt.clock(game.solved && result ? result.durationMs : clock.elapsedMs), primary: true },
      { label: t.mistakes, value: fmt.number(game.mistakes) },
      { label: t.bestForLevel, value: best !== null ? fmt.clock(best) : t.setup.none, icon: 'crown' },
    ];
  }

  const newRecord = result !== null && game !== null && result.record.improvedMetrics.includes(`bestTime:${game.difficulty}`);

  return (
    <GameLayout
      gameId="sudoku"
      subtitle={showBoard && game ? g.difficulties[game.difficulty] : undefined}
      onPause={showBoard && playing ? () => setDialog('pause') : undefined}
      onHelp={() => setDialog('help')}
      stats={statsStrip}
      toolbar={
        showBoard && game && !game.solved ? (
          <>
            <ToolButton icon="undo" label={g.undo} onClick={doUndo} disabled={!running || !canUndo(game)} />
            <ToolButton icon="eraser" label={t.tools.erase} onClick={doErase} disabled={!running || !canErase} />
            <ToolButton icon="pencil" label={t.tools.notes} onClick={toggleNotesMode} disabled={!running} active={notesMode} description={notesMode ? t.tools.notesOn : t.tools.notesOff} />
            <ToolButton icon="hint" label={g.hint} onClick={doHint} disabled={!running || left === 0} badge={left} description={g.hintsLeft(left)} />
            {prefs.errorMode === 'onCheck' && <ToolButton icon="check" label={t.tools.check} onClick={doCheck} disabled={!running} />}
          </>
        ) : undefined
      }
    >
      {showBoard && game ? (
        <div className="sd-wrap">
          <div className="sd-play">
            <Board
              givens={game.givens}
              values={game.values}
              notes={game.notes}
              hinted={game.hinted}
              errors={errors}
              conflicts={boardConflicts}
              selected={selected}
              highlightSame={prefs.highlightSame}
              hidden={boardHidden}
              flash={flash}
              solved={game.solved}
              onSelect={onSelect}
            />
            <div className="sd-side">
              {game.solved ? (
                <div className="sd-solved" role="status">
                  <p className="sd-solved__title">
                    <Icon name="trophy" size={22} /> {t.solvedIn(fmt.clock(result?.durationMs ?? clock.elapsedMs))}
                  </p>
                  <div className="sd-solved__actions">
                    <Button variant="primary" icon="play" block onClick={() => begin(game.difficulty)} loading={generating}>
                      {t.newPuzzle}
                    </Button>
                    <Button variant="secondary" block onClick={goToSetup}>
                      {t.changeDifficulty}
                    </Button>
                  </div>
                </div>
              ) : (
                <NumberPad counts={counts} notesMode={notesMode} disabled={!running} onDigit={inputDigit} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <GameSetup
          gameId="sudoku"
          description={t.setup.description}
          actions={
            <>
              <Button variant="primary" size="lg" icon="play" block loading={generating} onClick={() => requestStart(setupDifficulty)}>
                {generating ? t.generating : t.setup.start}
              </Button>
              {game && !game.solved && (
                <Button variant="secondary" size="lg" block disabled={generating} onClick={() => setPhase('playing')}>
                  {t.setup.backToPuzzle}
                </Button>
              )}
            </>
          }
        >
          <SegmentedControl
            options={DIFFICULTIES.map((d) => {
              const best = bestOf(d);
              return {
                value: d,
                label: (
                  <>
                    <span className="sd-level__text">
                      <span className="sd-level__name">{g.difficulties[d]}</span>
                      <span className="sd-level__desc">{t.setup.levels[d]}</span>
                    </span>
                    <span className="sd-level__stats">
                      <span className="visually-hidden">{t.setup.bestTime}: </span>
                      {best !== null ? (
                        <span className="sd-level__best tabular">
                          <Crown size={13} /> {fmt.clock(best)}
                        </span>
                      ) : (
                        <span className="sd-level__best is-empty">{t.setup.none}</span>
                      )}
                      <span className="sd-level__solved">{t.setup.solvedCount(solvedOf(d))}</span>
                    </span>
                  </>
                ),
              };
            })}
            value={setupDifficulty}
            onChange={(d) => {
              setSetupDifficulty(d);
              updatePrefs({ difficulty: d });
            }}
            label={g.difficulty}
            showLabel
            className="sd-levels"
          />
          {game && !game.solved && <p className="sd-setup__note">{t.setup.inProgress(adjective(game.difficulty))}</p>}
        </GameSetup>
      )}

      {generating && showBoard && (
        <div className="sd-loading">
          <Spinner label={t.generating} />
        </div>
      )}

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={requestRestart} onHelp={() => setDialog('help')}>
        <Button variant="secondary" size="lg" icon="grid" block onClick={goToSetup}>
          {t.newPuzzle}
        </Button>
        <section className="sd-options" aria-label={t.options.title}>
          <Switch
            checked={prefs.errorMode === 'immediate'}
            onChange={(on) => updatePrefs({ errorMode: on ? 'immediate' : 'onCheck' })}
            label={t.options.showMistakes}
            description={t.options.showMistakesDesc}
          />
          <Switch checked={prefs.autoNotes} onChange={(autoNotes) => updatePrefs({ autoNotes })} label={t.options.autoNotes} description={t.options.autoNotesDesc} />
          <Switch checked={prefs.highlightSame} onChange={(highlightSame) => updatePrefs({ highlightSame })} label={t.options.highlightSame} />
        </section>
      </PauseMenu>

      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />

      <ConfirmDialog
        open={dialog === 'restart'}
        title={t.restartTitle}
        body={t.restartBody}
        confirmLabel={g.restart}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={() => confirmRestart(true)}
      />
      <ConfirmDialog
        open={dialog === 'abandon'}
        title={t.abandonTitle}
        body={t.abandonBody}
        confirmLabel={t.abandonConfirm}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmAbandon}
      />

      <Modal open={dialog === 'hint' && hint !== null} onClose={() => setDialog('none')} title={g.hint} size="sm" icon={<Icon name="hint" size={22} />}>
        {hint && <p className="modal__text">{hintText(hint)}</p>}
        <div className="sd-hint__footer">
          <span className="sd-hint__left">{g.hintsLeft(left)}</span>
          <Button variant="primary" onClick={() => setDialog('none')} autoFocus>
            {t.hint.ok}
          </Button>
        </div>
      </Modal>

      {game && result && (
        <ResultDialog
          open={dialog === 'result'}
          tone="win"
          title={t.result.title}
          subtitle={t.result.subtitle(adjective(game.difficulty))}
          newRecord={newRecord}
          stats={[
            { label: g.time, value: fmt.clock(result.durationMs), record: newRecord },
            { label: g.difficulty, value: g.difficulties[game.difficulty] },
            { label: t.mistakes, value: fmt.number(game.mistakes) },
            { label: t.result.hints, value: fmt.number(game.hintsUsed) },
            { label: t.result.bestTime, value: fmt.clock(bestOf(game.difficulty) ?? result.durationMs) },
          ]}
          primary={{
            label: t.newPuzzle,
            icon: 'play',
            onClick: () => {
              setDialog('none');
              begin(game.difficulty);
            },
          }}
          secondary={{ label: t.changeDifficulty, onClick: goToSetup }}
          onClose={() => setDialog('none')}
        />
      )}
    </GameLayout>
  );
}
