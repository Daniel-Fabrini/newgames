import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, ToolButton } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SegmentedControl, Switch } from '../../components/Controls';
import { announce, toast } from '../../components/Toast';
import { LOCALE_INFO, useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useStopwatch } from '../../hooks/useStopwatch';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats } from '../../services/stats';
import { Board } from './Board';
import { ClueBar, ClueList } from './Clues';
import { Keyboard } from './Keyboard';
import { PuzzlePicker, usePuzzleName, type InProgressItem } from './PuzzlePicker';
import {
  accuracy,
  backspace,
  buildModel,
  check,
  clearEntry,
  filledCount,
  hasProgress,
  initialCursor,
  isFull,
  moveArrow,
  newPlay,
  reveal,
  revealedCount,
  selectCell,
  selectWord,
  starsFor,
  stepWord,
  toggleDir,
  typeLetter,
  wordAt,
  type Arrow,
  type Cursor,
  type GridModel,
  type PlayState,
  type Scope,
} from './engine';
import { normalizeKey } from './normalize';
import { PRESETS, generatedId, loadPuzzle, presetId } from './puzzles';
import {
  MAX_IN_PROGRESS,
  loadPrefs,
  restorePlay,
  savePrefs,
  saveSpec,
  serializePlay,
  upsertInProgress,
  withSolved,
  type CrosswordPrefs,
  type KeyboardPref,
  type SavedCrossword,
  type SavedPuzzle,
} from './save';
import { meta } from './meta';
import type { Puzzle, PuzzleLang } from './types';
import './crossword.css';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'check' | 'reveal' | 'clues' | 'grids' | 'result';

interface Session {
  puzzle: Puzzle;
  model: GridModel;
  play: PlayState;
}

interface ResultInfo {
  timeMs: number;
  accuracy: number;
  stars: number;
  revealed: number;
  checks: number;
  words: number;
  timeRecord: boolean;
  accuracyRecord: boolean;
}

/** A puzzle counts as "in progress" (and is saved) once something was typed or 5 s were spent on it. */
const MIN_SAVE_MS = 5000;
const ARROWS: Record<string, Arrow> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function sessionFor(puzzle: Puzzle, saved: SavedPuzzle | undefined): { session: Session; elapsedMs: number } {
  const model = buildModel(puzzle);
  const play = saved ? restorePlay(model, saved) : null;
  return { session: { puzzle, model, play: play ?? newPlay(model) }, elapsedMs: play && saved ? saved.elapsedMs : 0 };
}

/** Next generated grid of a language that is not solved or already in progress; advances the counter. */
function nextGenerated(lang: PuzzleLang, prefs: CrosswordPrefs, taken: ReadonlySet<string>): { puzzle: Puzzle; prefs: CrosswordPrefs } | null {
  let n = prefs.next[lang];
  for (let guard = 0; guard < 200; guard++, n++) {
    const id = generatedId(lang, n);
    if (prefs.solved[id] || taken.has(id)) continue;
    const puzzle = loadPuzzle(id);
    if (puzzle) return { puzzle, prefs: { ...prefs, next: { ...prefs.next, [lang]: n + 1 } } };
  }
  return null;
}

interface Boot {
  session: Session;
  elapsedMs: number;
  library: SavedPuzzle[];
  prefs: CrosswordPrefs;
}

function boot(locale: PuzzleLang): Boot {
  let prefs = loadPrefs();
  const saved: SavedCrossword | null = loadGame(saveSpec);
  // Keep only saves that still match their grid.
  const library = (saved?.puzzles ?? []).filter((entry) => {
    const puzzle = loadPuzzle(entry.id);
    return puzzle !== null && restorePlay(buildModel(puzzle), entry) !== null;
  });
  const resumeId = saved?.currentId && library.some((p) => p.id === saved.currentId) ? saved.currentId : library[0]?.id;
  let puzzle = resumeId ? loadPuzzle(resumeId) : null;
  if (!puzzle) {
    const taken = new Set(library.map((p) => p.id));
    const preset = PRESETS[locale].findIndex((_, i) => !prefs.solved[presetId(locale, i + 1)] && !taken.has(presetId(locale, i + 1)));
    puzzle = preset >= 0 ? loadPuzzle(presetId(locale, preset + 1)) : null;
    if (!puzzle) {
      const next = nextGenerated(locale, prefs, taken);
      if (next) {
        puzzle = next.puzzle;
        prefs = next.prefs;
      }
    }
  }
  // The generator never fails with the shipped banks; this is a last-resort fallback.
  const current = puzzle ?? (loadPuzzle(presetId(locale, 1)) as Puzzle);
  const { session, elapsedMs } = sessionFor(
    current,
    library.find((p) => p.id === current.id),
  );
  return { session, elapsedMs, library: library.filter((p) => p.id !== current.id), prefs };
}

export default function Crossword() {
  const { m, fmt, locale } = useI18n();
  const g = m.common.game;
  const t = m.crossword;
  const stats = useGameStats('crossword');
  const nameOf = usePuzzleName();
  const [initial] = useState(() => boot(locale));
  const [session, setSession] = useState<Session>(initial.session);
  const [library, setLibrary] = useState<SavedPuzzle[]>(initial.library);
  const [prefs, setPrefs] = useState<CrosswordPrefs>(initial.prefs);
  const [cursor, setCursor] = useState<Cursor>(() => initialCursor(initial.session.model, initial.session.play));
  const [dialog, setDialog] = useState<Dialog>('none');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 900px) and (min-height: 520px)');
  const coarse = useMediaQuery('(pointer: coarse)');

  const { puzzle, model, play } = session;
  const completed = play.completed;
  const running = !completed && (dialog === 'none' || dialog === 'clues' || dialog === 'check' || dialog === 'reveal');
  const clock = useStopwatch(running, initial.elapsedMs);
  const showKeyboard = prefs.keyboard === 'on' || (prefs.keyboard === 'auto' && coarse);
  const activeWord = wordAt(model, cursor.cell, cursor.dir);
  const word = model.words[activeWord];
  const canToggle = toggleDir(model, cursor).dir !== cursor.dir;

  useEffect(() => savePrefs(prefs), [prefs]);

  // Autosave: the puzzle on screen (once started and while unsolved) plus the other puzzles in progress.
  // The snapshot is refreshed every second of play; hiding or closing the page flushes it at once.
  const playedSeconds = Math.floor(clock.elapsedMs / 1000);
  const saveData = useMemo<SavedCrossword | null>(() => {
    const elapsed = clock.getElapsed();
    const keepCurrent = !play.completed && (hasProgress(play) || elapsed >= MIN_SAVE_MS);
    const puzzles = keepCurrent ? upsertInProgress(library, serializePlay(puzzle.id, play, elapsed, Date.now())) : library.slice(0, MAX_IN_PROGRESS);
    if (puzzles.length === 0) return null;
    return { currentId: keepCurrent ? puzzle.id : null, puzzles };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playedSeconds re-snapshots the clock every second
  }, [play, puzzle.id, library, clock, playedSeconds]);
  useAutosave(saveSpec, saveData);

  const clueText = word ? t.clueAnnouncement(t.clueRef(word.number, t.dir[word.dir]), word.clue, word.cells.length) : '';
  useEffect(() => {
    if (clueText) announce(clueText);
  }, [clueText]);

  const finish = useCallback(
    (done: PlayState) => {
      const timeMs = Math.round(clock.getElapsed());
      const acc = accuracy(done, model);
      const revealed = revealedCount(done);
      const stars = starsFor(acc, revealed);
      const before = stats.metrics;
      const rec = recordMatch(
        'crossword',
        {
          outcome: 'win',
          durationMs: timeMs,
          variant: puzzle.lang,
          metrics: { bestTimeMs: timeMs, bestAccuracy: acc, wordsSolved: model.words.length },
        },
        meta.metricRules,
      );
      setPrefs((p) => withSolved(p, puzzle.id, { stars, timeMs, accuracy: acc }, Date.now()));
      setResult({
        timeMs,
        accuracy: acc,
        stars,
        revealed,
        checks: done.checks,
        words: model.words.length,
        timeRecord: before.bestTimeMs !== undefined && rec.improvedMetrics.includes('bestTimeMs'),
        accuracyRecord: before.bestAccuracy !== undefined && rec.improvedMetrics.includes('bestAccuracy'),
      });
      feedback('win');
      announce(t.solvedTitle);
      setDialog('result');
    },
    [clock, model, puzzle, stats.metrics, t],
  );

  const applyPlay = useCallback(
    (next: PlayState, nextCursor?: Cursor) => {
      if (nextCursor) setCursor(nextCursor);
      if (next === play) return;
      setSession((s) => ({ ...s, play: next }));
      if (next.completed && !play.completed) finish(next);
      else if (!next.completed && isFull(next, model) && !isFull(play, model)) {
        toast(t.fullButWrong, { tone: 'warning' });
        announce(t.fullButWrong);
        feedback('error');
      }
    },
    [play, model, finish, t],
  );

  const inputEnabled = !completed && (dialog === 'none' || dialog === 'clues');

  const onLetter = useCallback(
    (letter: string) => {
      if (!inputEnabled) return;
      const res = typeLetter(model, play, cursor, letter, { skipFilled: prefs.skipFilled });
      feedback('tap');
      applyPlay(res.play, res.cursor);
    },
    [inputEnabled, model, play, cursor, prefs.skipFilled, applyPlay],
  );

  const onBackspace = useCallback(() => {
    if (!inputEnabled) return;
    const res = backspace(model, play, cursor);
    feedback('tap');
    applyPlay(res.play, res.cursor);
  }, [inputEnabled, model, play, cursor, applyPlay]);

  const onToggle = useCallback(() => {
    if (completed) return;
    setCursor((c) => toggleDir(model, c));
    feedback('select');
  }, [completed, model]);

  const onSelect = useCallback(
    (cell: number) => {
      if (completed) return;
      setCursor((c) => selectCell(model, c, cell));
    },
    [completed, model],
  );

  const onStep = useCallback(
    (delta: 1 | -1) => {
      if (completed) return;
      setCursor((c) => stepWord(model, play, c, delta));
    },
    [completed, model, play],
  );

  const pickWord = useCallback(
    (index: number) => {
      setCursor(selectWord(model, play, index));
      if (dialog === 'clues') setDialog('none');
      boardRef.current?.focus({ preventScroll: true });
    },
    [model, play, dialog],
  );

  const doCheck = (scope: Scope) => {
    const res = check(play, model, scope);
    applyPlay(res.play);
    const message = t.checkResult(res.wrong, res.correct);
    toast(message, { tone: res.wrong > 0 ? 'error' : 'success' });
    announce(message);
    feedback(res.wrong > 0 ? 'error' : 'select');
    setDialog('none');
  };

  const doReveal = (scope: Scope) => {
    const res = reveal(play, model, scope);
    if (!res.play.completed) {
      const message = t.revealResult(res.revealed);
      toast(message);
      announce(message);
      feedback('hint');
    }
    setDialog('none');
    applyPlay(res.play);
  };

  /** Moves the puzzle on screen to the in-progress list (when started) and opens another one. */
  const switchTo = (next: Puzzle, nextPrefs?: CrosswordPrefs) => {
    let list = library;
    const elapsed = clock.getElapsed();
    if (!play.completed && (hasProgress(play) || elapsed >= MIN_SAVE_MS)) list = upsertInProgress(list, serializePlay(puzzle.id, play, elapsed, Date.now()));
    const saved = list.find((p) => p.id === next.id);
    const { session: s, elapsedMs } = sessionFor(next, saved);
    setLibrary(list.filter((p) => p.id !== next.id));
    setSession(s);
    setCursor(initialCursor(s.model, s.play));
    clock.reset(elapsedMs);
    setResult(null);
    setDialog('none');
    if (nextPrefs) setPrefs(nextPrefs);
    feedback('select');
    announce(t.puzzleSubtitle(nameOf(next.id), t.langName[next.lang]));
  };

  const openPuzzle = (id: string) => {
    if (id === puzzle.id) {
      setDialog('none');
      return;
    }
    const next = loadPuzzle(id);
    if (!next) {
      toast(t.loadError, { tone: 'error' });
      return;
    }
    switchTo(next);
  };

  const newGrid = (lang: PuzzleLang = locale) => {
    const taken = new Set([...library.map((p) => p.id), puzzle.id]);
    const next = nextGenerated(lang, prefs, taken);
    if (!next) {
      toast(t.loadError, { tone: 'error' });
      return;
    }
    switchTo(next.puzzle, next.prefs);
  };

  const restartPuzzle = () => {
    const fresh = newPlay(model);
    setSession((s) => ({ ...s, play: fresh }));
    setCursor(initialCursor(model, fresh));
    clock.reset(0);
    setResult(null);
    setDialog('none');
    feedback('clear');
  };

  const requestRestart = () => {
    if (hasProgress(play) && !completed) setDialog('restart');
    else restartPuzzle();
  };

  useKeyboard((e) => {
    const active = document.activeElement;
    const onBoard = active === null || active === document.body || active === boardRef.current;
    if (e.key === 'Escape') {
      setDialog('pause');
      return true;
    }
    if (completed) return false;
    const arrow = ARROWS[e.key];
    if (arrow) {
      setCursor((c) => moveArrow(model, c, arrow));
      return true;
    }
    if (e.key === 'Backspace') {
      onBackspace();
      return true;
    }
    if (e.key === 'Delete') {
      applyPlay(clearEntry(play, model, cursor.cell));
      return true;
    }
    if (e.key === 'Tab' && onBoard) {
      onStep(e.shiftKey ? -1 : 1);
      return true;
    }
    if (e.key === ' ' && onBoard) {
      onToggle();
      return true;
    }
    const letter = normalizeKey(e.key, puzzle.lang);
    if (letter) {
      onLetter(letter);
      return true;
    }
    return false;
  }, dialog === 'none');

  const filled = filledCount(play, model);
  const bestTime = stats.metrics.bestTimeMs;
  const inProgressItems = (): InProgressItem[] => {
    const items: InProgressItem[] = [];
    const elapsed = clock.getElapsed();
    if (!play.completed && (hasProgress(play) || elapsed >= MIN_SAVE_MS)) items.push({ id: puzzle.id, filled: filled / model.letterCount, elapsedMs: elapsed, current: true });
    for (const entry of library) {
      const p = loadPuzzle(entry.id);
      if (!p) continue;
      const letters = [...entry.entries].filter((ch) => ch !== '.').length;
      items.push({ id: entry.id, filled: letters / Math.max(1, buildModel(p).letterCount), elapsedMs: entry.elapsedMs, current: false });
    }
    return items;
  };

  const puzzleLangName = t.langName[puzzle.lang];
  const intl = LOCALE_INFO[puzzle.lang].intl;

  return (
    <GameLayout
      gameId="crossword"
      subtitle={t.puzzleSubtitle(nameOf(puzzle.id), puzzleLangName)}
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      className={wide ? 'cw-screen is-wide' : 'cw-screen'}
      stats={[
        { label: g.time, value: fmt.clock(completed && result ? result.timeMs : clock.elapsedMs), primary: true },
        { label: t.progress, value: `${fmt.number(filled)}/${fmt.number(model.letterCount)}` },
        { label: g.best, value: bestTime !== undefined ? fmt.clock(bestTime) : '—', icon: 'crown', ariaValue: bestTime !== undefined ? fmt.duration(bestTime) : m.common.stats.noData },
      ]}
      toolbar={
        <>
          <ToolButton icon="check" label={t.check} onClick={() => setDialog('check')} disabled={completed} badge={play.checks || undefined} description={t.usedCount(play.checks)} />
          <ToolButton icon="hint" label={t.reveal} onClick={() => setDialog('reveal')} disabled={completed} description={t.revealedCount(revealedCount(play))} />
          {!wide && <ToolButton icon="menu" label={t.clues} onClick={() => setDialog('clues')} />}
          <ToolButton icon="plus" label={t.newGrid} onClick={() => newGrid()} description={t.newGridHint(t.langName[locale])} />
          <ToolButton icon="grid" label={t.grids} onClick={() => setDialog('grids')} />
        </>
      }
    >
      <div className={['cw-root', wide && 'is-wide', showKeyboard && 'has-keyboard'].filter(Boolean).join(' ')}>
        <div className="cw-main">
          {puzzle.lang !== locale && (
            <div className="cw-notice" role="note">
              <Icon name="globe" size={18} />
              <span className="cw-notice__text">{t.langNotice(puzzleLangName)}</span>
              <button type="button" className="cw-notice__btn" onClick={() => newGrid(locale)}>
                {t.newGridIn(t.langName[locale])}
              </button>
            </div>
          )}
          <div className="cw-board-area">
            <Board model={model} play={play} cursor={cursor} hidden={!completed && !running} readOnly={completed} onSelect={onSelect} boardRef={boardRef} />
          </div>
          {!completed && (
            <ClueBar word={word} lang={puzzle.lang} onPrev={() => onStep(-1)} onNext={() => onStep(1)} onToggle={onToggle} canToggle={canToggle} disabled={!running} />
          )}
          {completed && (
            <div className="cw-done" role="status">
              <Icon name="trophy" size={20} />
              <span>{t.solvedTitle}</span>
              <Button variant="gold" size="sm" icon="plus" onClick={() => newGrid()}>
                {t.newGrid}
              </Button>
            </div>
          )}
          {showKeyboard && !completed && <Keyboard lang={puzzle.lang} onLetter={onLetter} onBackspace={onBackspace} onToggle={onToggle} disabled={!inputEnabled} />}
        </div>
        {wide && (
          <aside className="cw-side" aria-label={t.cluesTitle}>
            <ClueList model={model} play={play} activeWord={activeWord} onPick={pickWord} follow />
          </aside>
        )}
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={requestRestart} onHelp={() => setDialog('help')}>
        <section className="cw-options" aria-label={t.options}>
          <h3 className="cw-options__title">{t.options}</h3>
          <SegmentedControl<KeyboardPref>
            label={t.keyboardOption}
            showLabel
            size="sm"
            value={prefs.keyboard}
            onChange={(keyboard) => setPrefs((p) => ({ ...p, keyboard }))}
            options={[
              { value: 'auto', label: t.keyboardAuto },
              { value: 'on', label: t.keyboardOn },
              { value: 'off', label: t.keyboardOff },
            ]}
          />
          <p className="cw-options__hint">{t.keyboardHint}</p>
          <Switch checked={prefs.skipFilled} onChange={(skipFilled) => setPrefs((p) => ({ ...p, skipFilled }))} label={t.skipFilled} />
        </section>
      </PauseMenu>
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      <ConfirmDialog
        open={dialog === 'restart'}
        title={t.restartTitle}
        body={t.restartBody}
        confirmLabel={t.restartPuzzle}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={restartPuzzle}
      />

      <Modal open={dialog === 'check'} onClose={() => setDialog('none')} title={t.checkTitle} size="sm" icon={<Icon name="check" size={22} />}>
        <div className="cw-menu">
          <Button variant="secondary" size="lg" block onClick={() => doCheck({ kind: 'cell', cell: cursor.cell })}>
            {t.checkLetter}
          </Button>
          <Button variant="secondary" size="lg" block onClick={() => doCheck({ kind: 'word', word: activeWord })} disabled={activeWord < 0}>
            {t.checkWord}
          </Button>
          <Button variant="primary" size="lg" block onClick={() => doCheck({ kind: 'all' })}>
            {t.checkPuzzle}
          </Button>
          <p className="cw-menu__note">{t.checkNote}</p>
          <p className="cw-menu__meta">{t.usedCount(play.checks)}</p>
        </div>
      </Modal>
      <Modal open={dialog === 'reveal'} onClose={() => setDialog('none')} title={t.revealTitle} size="sm" icon={<Icon name="hint" size={22} />}>
        <div className="cw-menu">
          <Button variant="secondary" size="lg" block onClick={() => doReveal({ kind: 'cell', cell: cursor.cell })}>
            {t.revealLetter}
          </Button>
          <Button variant="secondary" size="lg" block onClick={() => doReveal({ kind: 'word', word: activeWord })} disabled={activeWord < 0}>
            {t.revealWord}
          </Button>
          <p className="cw-menu__note">{t.revealNote}</p>
          <p className="cw-menu__meta">{t.revealedCount(revealedCount(play))}</p>
        </div>
      </Modal>
      <Modal open={dialog === 'clues'} onClose={() => setDialog('none')} title={t.cluesTitle} size="md" icon={<Icon name="menu" size={22} />} className="cw-clues-modal">
        <ClueList model={model} play={play} activeWord={activeWord} onPick={pickWord} />
      </Modal>
      {dialog === 'grids' && (
        <PuzzlePicker
          open
          onClose={() => setDialog('none')}
          uiLang={locale}
          inProgress={inProgressItems()}
          solved={prefs.solved}
          onOpen={openPuzzle}
          onNewGrid={() => newGrid()}
        />
      )}
      <ResultDialog
        open={dialog === 'result' && result !== null}
        tone="win"
        title={t.solvedTitle}
        subtitle={result ? t.solvedBody(result.words) : undefined}
        stars={result?.stars}
        newRecord={Boolean(result && (result.timeRecord || result.accuracyRecord))}
        stats={
          result
            ? [
                { label: g.time, value: fmt.clock(result.timeMs), record: result.timeRecord },
                { label: t.accuracy, value: fmt.percent(result.accuracy), record: result.accuracyRecord },
                { label: t.revealedLetters, value: fmt.number(result.revealed) },
                { label: t.checksUsed, value: fmt.number(result.checks) },
              ]
            : undefined
        }
        primary={{ label: t.newGridIn(t.langName[locale]), icon: 'arrowRight', onClick: () => newGrid() }}
        secondary={{ label: t.grids, onClick: () => setDialog('grids') }}
        onClose={() => setDialog('none')}
      >
        <p className="cw-result__words" lang={intl}>
          {model.words.map((w) => w.display).join(' · ')}
        </p>
      </ResultDialog>
    </GameLayout>
  );
}
