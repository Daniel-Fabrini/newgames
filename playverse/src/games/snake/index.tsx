import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, GameSetup } from '../../components/GameLayout';
import { EMBED_MODE, useBackHandler } from '../../app/embed';
import { HelpDialog, PauseMenu, ResultDialog, type HelpSection } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/Controls';
import { Icon } from '../../components/Icon';
import { Crown } from '../../components/brand/Crown';
import { announce } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useFixedStep } from '../../hooks/useFixedStep';
import { usePageVisible } from '../../hooks/usePageVisible';
import { useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { useSettings } from '../../services/settings';
import { getStats, recordMatch, useGameStats } from '../../services/stats';
import { randomSeed } from '../../utils/random';
import {
  BONUS_EVERY,
  BONUS_MULTIPLIER,
  BONUS_TICKS,
  COLS,
  DIFFICULTIES,
  MODES,
  SPEEDS,
  bonusPoints,
  foodPoints,
  intervalMs,
  newGame,
  step,
  turn,
  type Difficulty,
  type Direction,
  type GameState,
  type Mode,
} from './engine';
import { Board } from './Board';
import { DPad } from './DPad';
import { createClock, type StepClock, type Theme } from './render';
import { saveSpec } from './save';
import { comboKey, loadPrefs, savePrefs, type SnakePrefs } from './prefs';
import { meta } from './meta';
import './snake.css';

type Phase = 'setup' | 'play';
type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'discard' | 'over' | 'won';

interface RunResult {
  newRecord: boolean;
  lengthRecord: boolean;
  survivalRecord: boolean;
  comboBest: number;
}

const COUNTDOWN_FROM = 3;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/**
 * Space pauses on keydown, but the browser would "click" the auto-focused Resume button on the
 * matching keyup and resume at once. Swallow that one keyup.
 */
function swallowSpaceKeyup(): void {
  const onUp = (ev: KeyboardEvent) => {
    if (ev.key !== ' ') return;
    ev.preventDefault();
    window.removeEventListener('keyup', onUp, true);
  };
  window.addEventListener('keyup', onUp, true);
  window.setTimeout(() => window.removeEventListener('keyup', onUp, true), 2000);
}

/** A saved run is offered for "continue" only while it is still in progress. */
function loadSavedRun(): GameState | null {
  const saved = loadGame(saveSpec);
  return saved && saved.game.status === 'playing' ? saved.game : null;
}

/** Records a finished (or abandoned) run and returns the record flags for the end screen. */
function recordRun(state: GameState): RunResult {
  const key = comboKey(state.mode, state.difficulty);
  const before = getStats('snake').metrics;
  const durationMs = Math.round(state.timeMs);
  const res = recordMatch(
    'snake',
    {
      outcome: state.status === 'won' ? 'win' : 'ended',
      score: state.score,
      durationMs,
      variant: `${state.mode}-${state.difficulty}`,
      metrics: {
        maxLength: state.snake.length,
        longestSurvivalMs: durationMs,
        ['best:' + state.mode]: state.score,
        [key]: state.score,
        foodEaten: state.foodEaten,
      },
    },
    meta.metricRules,
  );
  const beaten = (metric: string) => res.improvedMetrics.includes(metric) && before[metric] !== undefined;
  return {
    newRecord: state.score > 0 && res.improvedMetrics.includes(key),
    lengthRecord: beaten('maxLength'),
    survivalRecord: beaten('longestSurvivalMs'),
    comboBest: res.stats.metrics[key] ?? state.score,
  };
}

/** Lobby mode from DA Games (a snake mode id): preselects that mode, and starts a run when none is saved. */
const hintedMode: Mode | null = EMBED_MODE !== null && (MODES as readonly string[]).includes(EMBED_MODE) ? (EMBED_MODE as Mode) : null;

export default function SnakeGame() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.snake;
  const stats = useGameStats('snake');
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const settings = useSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme: Theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;

  const [prefs, setPrefs] = useState<SnakePrefs>(loadPrefs);
  const [run, setRun] = useState<GameState | null>(loadSavedRun);
  const runRef = useRef<GameState | null>(run);
  const clock = useRef<StepClock>(createClock());
  const [phase, setPhase] = useState<Phase>('setup');
  const [dialog, setDialog] = useState<Dialog>('none');
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);

  const commit = useCallback((next: GameState | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const active = phase === 'play' && run !== null && run.status === 'playing';
  const running = active && dialog === 'none' && countdown === 0 && visible;
  const interval = run ? intervalMs(run.difficulty, run.foodEaten) : 1000;

  const variantOf = useCallback((mode: Mode, difficulty: Difficulty) => t.variant(t.modes[mode], g.difficulties[difficulty]), [t, g]);

  // Only runs in progress are saved; a finished run clears the save.
  const saveData = useMemo(() => (run && run.status === 'playing' ? { game: run } : null), [run]);
  useAutosave(saveSpec, saveData);

  const finish = useCallback(
    (state: GameState) => {
      setResult(recordRun(state));
    },
    [],
  );

  const tick = useCallback(() => {
    const prev = runRef.current;
    if (!prev || prev.status !== 'playing') return;
    const next = step(prev);
    const now = performance.now();
    const c = clock.current;
    c.at = now;
    c.interval = intervalMs(next.difficulty, next.foodEaten);
    c.prevTail = next.status === 'playing' && next.snake.length === prev.snake.length ? (prev.snake[prev.snake.length - 1] ?? null) : null;
    c.eaten = next.foodEaten > prev.foodEaten ? prev.food : null;
    c.eatenBonus = next.bonusEaten > prev.bonusEaten && prev.bonus ? { x: prev.bonus.x, y: prev.bonus.y } : null;
    commit(next);

    if (c.eaten) {
      c.popups.push({ x: c.eaten.x, y: c.eaten.y, text: fmt.number(foodPoints(next.difficulty), { signDisplay: 'always' }), at: now, gold: false });
      feedback('merge');
      if (next.foodEaten % BONUS_EVERY === 0 && next.status === 'playing') {
        announce(t.announce.progress(fmt.number(next.score), fmt.number(next.snake.length)));
      }
    }
    if (c.eatenBonus) {
      const pts = bonusPoints(next.difficulty);
      c.popups.push({ x: c.eatenBonus.x, y: c.eatenBonus.y, text: fmt.number(pts, { signDisplay: 'always' }), at: now, gold: true });
      feedback('clear');
      announce(t.announce.bonusEaten(fmt.number(pts)));
    } else if (!prev.bonus && next.bonus) {
      announce(t.announce.bonusAppeared);
    }
    if (next.status === 'over') {
      finish(next);
      feedback('lose');
      announce(t.announce.over(next.cause ? t.causes[next.cause] : '', fmt.number(next.score)));
    } else if (next.status === 'won') {
      finish(next);
      feedback('win');
      announce(t.announce.won(fmt.number(next.score)));
    }
  }, [commit, finish, fmt, t]);

  useFixedStep(tick, interval, running);

  // Show the end screen shortly after the crash, so the final position can be seen.
  const status = run?.status;
  useEffect(() => {
    if (phase !== 'play' || (status !== 'over' && status !== 'won')) return;
    const id = window.setTimeout(() => setDialog(status === 'won' ? 'won' : 'over'), reduced ? 250 : 750);
    return () => window.clearTimeout(id);
  }, [phase, status, reduced]);

  // 3-2-1 countdown before the snake starts or resumes moving (shorter with reduced motion).
  useEffect(() => {
    if (countdown <= 0 || dialog !== 'none' || !visible) return;
    feedback('tap');
    const id = window.setTimeout(() => setCountdown((n) => n - 1), reduced ? 350 : 650);
    return () => window.clearTimeout(id);
  }, [countdown, dialog, visible, reduced]);

  // Auto-pause when the page is hidden mid-run (the autosave flushes at the same moment).
  useEffect(() => {
    if (!visible && active && dialog === 'none') {
      setDialog('pause');
      setCountdown(0);
    }
  }, [visible, active, dialog]);

  const updatePrefs = (next: SnakePrefs) => {
    setPrefs(next);
    savePrefs(next);
  };

  const startRun = (mode: Mode, difficulty: Difficulty) => {
    clock.current = createClock();
    commit(newGame(randomSeed(), { mode, difficulty }));
    updatePrefs({ mode, difficulty });
    setResult(null);
    setPhase('play');
    setDialog('none');
    setCountdown(COUNTDOWN_FROM);
    announce(t.announce.start(variantOf(mode, difficulty)));
  };

  /** A run that is replaced before it ends still counts (its score was really achieved). */
  const abandonCurrent = () => {
    const cur = runRef.current;
    if (cur && cur.status === 'playing' && cur.ticks > 0) recordRun(cur);
  };

  const continueRun = () => {
    if (!runRef.current) return;
    clock.current = createClock();
    setPhase('play');
    setDialog('none');
    setCountdown(COUNTDOWN_FROM);
    announce(t.announce.start(variantOf(runRef.current.mode, runRef.current.difficulty)));
  };

  const resume = () => {
    setDialog('none');
    setCountdown(active ? COUNTDOWN_FROM : 0);
  };

  const pause = () => {
    if (!active) return;
    setDialog('pause');
    setCountdown(0);
  };

  const openHelp = () => {
    setDialog('help');
    setCountdown(0);
  };

  const toSetup = () => {
    setPhase('setup');
    setDialog('none');
    setCountdown(0);
  };

  useEffect(() => {
    if (hintedMode === null) return;
    if (!runRef.current) startRun(hintedMode, prefs.difficulty);
    else updatePrefs({ ...prefs, mode: hintedMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  // Embed mode (host back button / header back): pause a live run, otherwise return to the setup screen.
  useBackHandler(() => {
    if (phase !== 'play') return false;
    if (active) pause();
    else toSetup();
    return true;
  });

  const doTurn = useCallback(
    (dir: Direction) => {
      const cur = runRef.current;
      if (!cur || cur.status !== 'playing' || phase !== 'play' || dialog !== 'none') return;
      const next = turn(cur, dir);
      if (next !== cur) commit(next);
    },
    [phase, dialog, commit],
  );

  useKeyboard(
    (e) => {
      const dir = KEY_DIRECTIONS[e.key] ?? KEY_DIRECTIONS[e.key.toLowerCase()];
      if (dir) {
        doTurn(dir);
        return true;
      }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (e.key === ' ' && active) swallowSpaceKeyup();
        pause();
        return true;
      }
      return false;
    },
    phase === 'play' && dialog === 'none',
  );

  const helpSections = useMemo<HelpSection[]>(
    () => [
      { title: g.rules, items: t.help.rules },
      { title: t.help.modesTitle, items: t.help.modes },
      {
        title: t.help.speedTitle,
        items: DIFFICULTIES.map((d) =>
          t.help.speed(g.difficulties[d], fmt.number(SPEEDS[d].startMs), fmt.number(SPEEDS[d].accelMs), fmt.number(SPEEDS[d].minMs)),
        ),
      },
      {
        title: g.scoring,
        items: [
          t.help.foodPoints(fmt.number(SPEEDS.easy.points), fmt.number(SPEEDS.medium.points), fmt.number(SPEEDS.hard.points)),
          t.help.bonus(fmt.number(BONUS_EVERY), fmt.number(BONUS_TICKS), fmt.number(BONUS_MULTIPLIER)),
          t.help.records,
        ],
      },
      { title: g.controls, items: t.help.controls },
      { title: t.help.pauseTitle, items: t.help.pause },
    ],
    [g, t, fmt],
  );

  const helpDialog = (
    <HelpDialog
      open={dialog === 'help'}
      onClose={() => (active ? resume() : setDialog('none'))}
      intro={t.help.intro}
      sections={helpSections}
    />
  );

  const cps = (ms: number) => fmt.number(1000 / ms, { maximumFractionDigits: 1 });

  if (phase === 'setup' || !run) {
    const best = stats.metrics[comboKey(prefs.mode, prefs.difficulty)];
    const speed = SPEEDS[prefs.difficulty];
    return (
      <GameLayout gameId="snake" onHelp={openHelp}>
        <GameSetup
          gameId="snake"
          actions={
            run ? (
              <>
                <Button variant="primary" size="lg" icon="play" block onClick={continueRun}>
                  {g.continueGame}
                </Button>
                <Button variant="secondary" size="lg" icon="restart" block onClick={() => setDialog('discard')}>
                  {g.newGame}
                </Button>
              </>
            ) : (
              <Button variant="primary" size="lg" icon="play" block onClick={() => startRun(prefs.mode, prefs.difficulty)}>
                {g.start}
              </Button>
            )
          }
        >
          {run && (
            <div className="sn-saved">
              <Icon name="history" size={22} />
              <div className="sn-saved__text">
                <strong>{t.setup.savedTitle}</strong>
                <span>{t.setup.savedBody(variantOf(run.mode, run.difficulty), fmt.number(run.score), fmt.number(run.snake.length))}</span>
              </div>
            </div>
          )}
          <div className="sn-option">
            <SegmentedControl
              label={g.mode}
              showLabel
              options={MODES.map((mode) => ({ value: mode, label: t.modes[mode] }))}
              value={prefs.mode}
              onChange={(mode) => updatePrefs({ ...prefs, mode })}
            />
            <p className="sn-option__hint">{t.modeHints[prefs.mode]}</p>
          </div>
          <div className="sn-option">
            <SegmentedControl
              label={g.difficulty}
              showLabel
              options={DIFFICULTIES.map((d) => ({ value: d, label: g.difficulties[d] }))}
              value={prefs.difficulty}
              onChange={(difficulty) => updatePrefs({ ...prefs, difficulty })}
            />
            <p className="sn-option__hint">{t.speedHint(cps(speed.startMs), cps(speed.minMs), fmt.number(speed.points))}</p>
          </div>
          <div className="sn-best">
            <Crown size={20} />
            <span className="sn-best__label">{t.setup.bestLabel}</span>
            {best !== undefined && best > 0 ? (
              <strong className="sn-best__value tabular">{fmt.number(best)}</strong>
            ) : (
              <span className="sn-best__empty">{t.setup.noBest}</span>
            )}
          </div>
        </GameSetup>
        {helpDialog}
        <ConfirmDialog
          open={dialog === 'discard'}
          title={t.setup.discardTitle}
          body={t.setup.discardBody}
          confirmLabel={g.newGame}
          tone="danger"
          onCancel={() => setDialog('none')}
          onConfirm={() => {
            abandonCurrent();
            startRun(prefs.mode, prefs.difficulty);
          }}
        />
      </GameLayout>
    );
  }

  const variant = variantOf(run.mode, run.difficulty);
  const comboBest = stats.metrics[comboKey(run.mode, run.difficulty)] ?? 0;
  const resultStats = [
    { label: g.score, value: fmt.number(run.score), record: result?.newRecord },
    { label: t.length, value: fmt.number(run.snake.length), record: result?.lengthRecord },
    { label: t.survival, value: fmt.clock(run.timeMs), record: result?.survivalRecord },
    { label: g.best, value: fmt.number(result?.comboBest ?? Math.max(comboBest, run.score)) },
  ];
  const playAgain = () => startRun(run.mode, run.difficulty);
  const changeMode = () => {
    commit(null);
    toSetup();
  };

  return (
    <GameLayout
      gameId="snake"
      subtitle={variant}
      onPause={active ? pause : undefined}
      onHelp={openHelp}
      stats={[
        { label: g.score, value: fmt.number(run.score), primary: true },
        { label: g.best, value: fmt.number(Math.max(comboBest, run.score)), icon: 'crown' },
        { label: t.length, value: fmt.number(run.snake.length) },
      ]}
    >
      <div className="sn-wrap">
        <div className="sn-layout">
          <Board
            game={run}
            clock={clock}
            running={running}
            inputEnabled={active && dialog === 'none'}
            theme={theme}
            reduced={reduced}
            label={t.boardLabel(t.modes[run.mode], fmt.number(COLS))}
            onTurn={doTurn}
          >
            {countdown > 0 && dialog === 'none' && (
              <div className="sn-countdown" aria-hidden="true">
                <span key={countdown} className="sn-countdown__num tabular">
                  {fmt.number(countdown)}
                </span>
              </div>
            )}
          </Board>
          <div className="sn-controls">
            <DPad onTurn={doTurn} disabled={!active || dialog !== 'none'} label={t.directionsLabel} labels={t.directions} />
            <p className="sn-keys">{t.keyboardHint}</p>
          </div>
        </div>
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={resume} onRestart={() => setDialog('restart')} onHelp={openHelp}>
        <div className="sn-pause-extra">
          <p className="sn-pause-extra__variant">{variant}</p>
          <Button variant="secondary" size="md" icon="layers" block onClick={toSetup}>
            {t.changeMode}
          </Button>
        </div>
      </PauseMenu>
      {helpDialog}
      <ConfirmDialog
        open={dialog === 'restart'}
        title={g.restartTitle}
        body={g.restartBody}
        confirmLabel={g.restart}
        tone="danger"
        onCancel={resume}
        onConfirm={() => {
          abandonCurrent();
          startRun(run.mode, run.difficulty);
        }}
      />
      <ResultDialog
        open={dialog === 'over'}
        tone="neutral"
        title={g.gameOver}
        subtitle={
          <>
            {run.cause ? t.causes[run.cause] : null}
            <span className="sn-result-variant">{variant}</span>
          </>
        }
        newRecord={result?.newRecord}
        stats={resultStats}
        primary={{ label: g.playAgain, onClick: playAgain }}
        secondary={{ label: t.changeMode, onClick: changeMode }}
      />
      <ResultDialog
        open={dialog === 'won'}
        tone="win"
        title={t.wonTitle}
        subtitle={
          <>
            {t.wonBody}
            <span className="sn-result-variant">{variant}</span>
          </>
        }
        newRecord={result?.newRecord}
        stats={resultStats}
        primary={{ label: g.playAgain, onClick: playAgain }}
        secondary={{ label: t.changeMode, onClick: changeMode }}
      />
    </GameLayout>
  );
}
