import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, GameSetup, ToolButton } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { SegmentedControl } from '../../components/Controls';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { announce, toast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { useStopwatch } from '../../hooks/useStopwatch';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats, winRate, type RecordResult } from '../../services/stats';
import { randomSeed } from '../../utils/random';
import { Board } from './Board';
import { autoMoveFor, findHint, isStuck, type Hint } from './assist';
import { cardName, pileName } from './describe';
import {
  applyAction,
  applyMove,
  autoCompletePlan,
  canAutoComplete,
  canUndo,
  draw,
  newGame,
  pileOf,
  timeBonus,
  undo,
  type DrawMode,
  type GameState,
  type Move,
  type PileRef,
  type StepResult,
} from './engine';
import { changedCards } from './layout';
import { loadDrawPreference, saveDrawPreference, saveSpec } from './save';
import { meta } from './meta';
import './solitaire.css';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'newGame' | 'won' | 'stuck';

interface WinInfo {
  record: RecordResult;
  bonus: number;
  score: number;
  durationMs: number;
}

const variantOf = (d: DrawMode) => (d === 3 ? 'draw3' : 'draw1');
const AUTO_STEP_MS = 95;
/** Delay before the "no more moves" dialog, so the last card movement is seen first. */
const STUCK_DELAY_MS = 500;

function initial(): { game: GameState | null; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved && !saved.game.won) return saved;
  return { game: null, elapsedMs: 0 };
}

export default function Solitaire() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.solitaire;
  const stats = useGameStats('solitaire');
  const reduced = useReducedMotion();
  const [boot] = useState(initial);
  const [game, setGame] = useState<GameState | null>(boot.game);
  const [drawPref, setDrawPref] = useState<DrawMode>(() => boot.game?.draw ?? loadDrawPreference());
  const [newDraw, setNewDraw] = useState<DrawMode>(drawPref);
  const [dialog, setDialog] = useState<Dialog>('none');
  const [win, setWin] = useState<WinInfo | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [auto, setAuto] = useState(false);
  const [raised, setRaised] = useState<ReadonlySet<number>>(() => new Set());
  const winTimer = useRef<number | undefined>(undefined);
  const stuckTimer = useRef<number | undefined>(undefined);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const playing = game !== null && !game.won && dialog === 'none';
  // The clock stops while the automatic finish plays, so the animation never costs time.
  const clock = useStopwatch(playing && game.moves > 0 && !auto, boot.elapsedMs);
  const getElapsed = clock.getElapsed;

  // Save on every change and every few seconds of play; finished games are not kept.
  const bucket = Math.floor(clock.elapsedMs / 5000);
  const saveData = useMemo(() => (game && !game.won ? { game, elapsedMs: Math.max(getElapsed(), bucket * 5000) } : null), [game, bucket, getElapsed]);
  useAutosave(saveSpec, saveData);

  useEffect(
    () => () => {
      window.clearTimeout(winTimer.current);
      window.clearTimeout(stuckTimer.current);
    },
    [],
  );

  /** Ends the game with the "no more moves" dialog when nothing can make progress any more. */
  const scheduleStuckCheck = useCallback((state: GameState, delayMs: number) => {
    window.clearTimeout(stuckTimer.current);
    stuckTimer.current = window.setTimeout(() => {
      if (gameRef.current !== state || state.won || !isStuck(state, state.draw)) return;
      setHint(null);
      setDialog('stuck');
      feedback('lose');
    }, delayMs);
  }, []);

  // A resumed game may already be stuck (e.g. the app was closed right after the last move).
  useEffect(() => {
    if (boot.game) scheduleStuckCheck(boot.game, STUCK_DELAY_MS);
  }, [boot.game, scheduleStuckCheck]);

  const finishWin = useCallback(
    (state: GameState) => {
      const durationMs = Math.round(getElapsed());
      const bonus = timeBonus(durationMs);
      const score = state.score + bonus;
      const record = recordMatch(
        'solitaire',
        { outcome: 'win', score, durationMs, variant: variantOf(state.draw), metrics: { bestTimeMs: durationMs } },
        meta.metricRules,
      );
      setWin({ record, bonus, score, durationMs });
      setAuto(false);
      feedback('win');
      announce(t.announce.won);
      window.clearTimeout(winTimer.current);
      winTimer.current = window.setTimeout(() => setDialog('won'), reduced ? 250 : 1200);
    },
    [getElapsed, reduced, t],
  );

  /** Applies an engine step: state, raised cards, feedback, announcements and win handling. */
  const commit = useCallback(
    (prev: GameState, r: StepResult, quiet = false) => {
      setGame(r.state);
      setHint(null);
      setRaised(changedCards(prev, r.state));
      if (quiet) {
        // Automatic finish: a soft tick per card, no announcement flood.
        feedback('move');
      } else if (r.kind === 'draw') {
        feedback('tap');
        announce(t.announce.drew(fmt.list(r.drawn.map((c) => cardName(t, c.id)))));
      } else if (r.kind === 'recycle') {
        feedback('move');
        announce(t.announce.recycled);
      } else if (r.move) {
        const moved = pileOf(prev, r.move.from);
        const lead = moved[moved.length - r.move.count];
        if (lead) {
          const dest = pileName(t, r.move.to);
          const text = r.move.count > 1 ? t.announce.movedRun(cardName(t, lead.id), r.move.count - 1, dest) : t.announce.moved(cardName(t, lead.id), dest);
          announce(r.flipped ? `${text} ${t.announce.flipped(cardName(t, r.flipped.id))}` : text);
        }
        feedback(r.move.to.kind === 'foundation' ? 'merge' : 'place');
      }
      if (r.won) finishWin(r.state);
      else if (!quiet) scheduleStuckCheck(r.state, reduced ? 60 : STUCK_DELAY_MS);
    },
    [finishWin, fmt, t, scheduleStuckCheck, reduced],
  );

  const handleMove = useCallback(
    (move: Move): boolean => {
      if (!game || !playing || auto) return false;
      const r = applyMove(game, move);
      if (!r) {
        feedback('error');
        announce(g.invalidMove);
        return false;
      }
      commit(game, r);
      return true;
    },
    [game, playing, auto, commit, g],
  );

  const handleTap = useCallback(
    (from: PileRef, index: number): boolean => {
      if (!game || !playing || auto) return false;
      const move = autoMoveFor(game, from, index);
      if (!move) {
        const card = pileOf(game, from)[from.kind === 'tableau' ? index : pileOf(game, from).length - 1];
        feedback('error');
        if (card) announce(t.announce.noDestination(cardName(t, card.id)));
        return false;
      }
      return handleMove(move);
    },
    [game, playing, auto, handleMove, t],
  );

  const handleDraw = useCallback(() => {
    if (!game || !playing || auto) return;
    const r = draw(game);
    if (!r) {
      feedback('error');
      return;
    }
    commit(game, r);
  }, [game, playing, auto, commit]);

  const doUndo = (fromDialog = false) => {
    if (!game || (!playing && !fromDialog) || auto || !canUndo(game)) return;
    if (fromDialog) setDialog('none');
    const next = undo(game);
    setGame(next);
    setHint(null);
    setRaised(changedCards(game, next));
    feedback('undo');
    announce(t.announce.undone);
  };

  const showHint = () => {
    if (!game || !playing || auto) return;
    const h = findHint(game, game.draw);
    if (!h) {
      feedback('error');
      toast(t.hints.none);
      return;
    }
    setHint(h);
    feedback('hint');
    if (h.kind === 'move') {
      const lead = pileOf(game, h.move.from)[pileOf(game, h.move.from).length - h.move.count];
      if (lead) toast(t.hints.move(cardName(t, lead.id), pileName(t, h.move.to)));
    } else toast(h.kind === 'draw' ? t.hints.draw : t.hints.recycle);
  };

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 2800);
    return () => window.clearTimeout(id);
  }, [hint]);

  const canAuto = useMemo(() => game !== null && !game.won && canAutoComplete(game), [game]);

  // Auto-complete: one card every AUTO_STEP_MS, recomputing the plan from the current position.
  useEffect(() => {
    if (!auto || !game || game.won || dialog !== 'none') return;
    const next = autoCompletePlan(game)?.[0];
    if (!next) {
      setAuto(false);
      return;
    }
    const id = window.setTimeout(
      () => {
        const r = applyAction(game, next);
        if (!r) {
          setAuto(false);
          return;
        }
        commit(game, r, true);
      },
      reduced ? 20 : AUTO_STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [auto, game, dialog, reduced, commit]);

  const startAuto = () => {
    if (!playing || !canAuto) return;
    setAuto(true);
    setHint(null);
    announce(t.autoCompleting);
  };

  const startGame = (seed: number, mode: DrawMode) => {
    window.clearTimeout(winTimer.current);
    setGame(newGame(seed, mode));
    clock.reset(0);
    setWin(null);
    setHint(null);
    setAuto(false);
    setRaised(new Set());
    setDialog('none');
    setDrawPref(mode);
    saveDrawPreference(mode);
    feedback('place');
  };

  /** An unfinished game with moves counts as a loss when it is abandoned. */
  const inProgress = game !== null && game.moves > 0 && !game.won;
  const recordAbandon = () => {
    if (!game || !inProgress) return;
    recordMatch('solitaire', { outcome: 'loss', durationMs: Math.round(getElapsed()), variant: variantOf(game.draw) }, meta.metricRules);
  };

  const openNewGame = () => {
    setNewDraw(game?.draw ?? drawPref);
    setDialog('newGame');
  };

  const confirmNewGame = () => {
    recordAbandon();
    startGame(randomSeed(), newDraw);
  };

  /** From the "no more moves" dialog: the stuck game counts as a loss; same draw mode. */
  const newDealAfterStuck = () => {
    if (!game) return;
    recordAbandon();
    startGame(randomSeed(), game.draw);
  };

  const requestRestart = () => {
    if (!game) return;
    if (inProgress) setDialog('restart');
    else startGame(game.seed, game.draw);
  };

  const confirmRestart = () => {
    if (!game) return;
    recordAbandon();
    startGame(game.seed, game.draw);
  };

  useKeyboard(
    (e) => {
      const key = e.key.toLowerCase();
      if (key === 'd') {
        handleDraw();
        return true;
      }
      if (key === 'u' || e.key === 'Backspace') {
        doUndo();
        return true;
      }
      if (key === 'h') {
        showHint();
        return true;
      }
      if (key === 'p' || e.key === 'Escape') {
        setDialog('pause');
        return true;
      }
      return false;
    },
    dialog === 'none' && game !== null,
  );

  const modeOptions = [
    { value: '1' as const, label: t.drawModes.draw1 },
    { value: '3' as const, label: t.drawModes.draw3 },
  ];
  const modeDescription = (d: DrawMode) => (d === 3 ? t.drawDescriptions.draw3 : t.drawDescriptions.draw1);
  const help = <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />;
  const recordLine = stats.played > 0 ? <p className="sol-record">{t.record(fmt.number(stats.wins), fmt.percent(winRate(stats)))}</p> : null;

  if (!game) {
    return (
      <GameLayout gameId="solitaire" onHelp={() => setDialog('help')}>
        <GameSetup
          gameId="solitaire"
          actions={
            <Button variant="primary" size="lg" icon="play" block onClick={() => startGame(randomSeed(), drawPref)}>
              {t.deal}
            </Button>
          }
        >
          <div className="sol-setup">
            <SegmentedControl label={t.drawLabel} showLabel options={modeOptions} value={drawPref === 3 ? '3' : '1'} onChange={(v) => setDrawPref(v === '3' ? 3 : 1)} />
            <p className="sol-mode-desc">{modeDescription(drawPref)}</p>
            {recordLine}
          </div>
        </GameSetup>
        {help}
      </GameLayout>
    );
  }

  const improvedTime = win?.record.improvedMetrics.includes('bestTimeMs') ?? false;
  // Whole seconds, so the subtitle and the clock show the same time.
  const winSeconds = win ? Math.floor(win.durationMs / 1000) * 1000 : 0;

  return (
    <GameLayout
      gameId="solitaire"
      subtitle={game.draw === 3 ? t.drawModes.draw3 : t.drawModes.draw1}
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      stats={[
        { label: g.score, value: fmt.number(game.score), primary: true },
        { label: g.moves, value: fmt.number(game.moves) },
        { label: g.time, value: fmt.clock(clock.elapsedMs) },
      ]}
      toolbar={
        <>
          <ToolButton icon="undo" label={g.undo} onClick={() => doUndo()} disabled={!canUndo(game) || !playing || auto} />
          <ToolButton icon="hint" label={g.hint} onClick={showHint} disabled={!playing || auto} description={t.hintDescription} />
          {canAuto && (
            <span className="sol-auto">
              <ToolButton icon="bolt" label={t.autoComplete} onClick={startAuto} disabled={!playing || auto} description={t.autoCompleteDescription} />
            </span>
          )}
          <ToolButton icon="cards" label={g.newGame} onClick={openNewGame} disabled={auto} />
        </>
      }
    >
      <div className="sol-wrap">
        <Board
          game={game}
          disabled={!playing || auto}
          raised={raised}
          hint={hint}
          celebrate={game.won}
          onDraw={handleDraw}
          onMove={handleMove}
          onTap={handleTap}
        />
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={requestRestart} onHelp={() => setDialog('help')}>
        <p className="sol-pause-mode">
          <Icon name="cards" size={18} /> {t.drawLabel}: {game.draw === 3 ? t.drawModes.draw3 : t.drawModes.draw1}
        </p>
      </PauseMenu>
      {help}
      <ConfirmDialog
        open={dialog === 'restart'}
        title={t.restartTitle}
        body={`${t.restartBody} ${t.abandonWarning}`}
        confirmLabel={g.restart}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmRestart}
      />
      <Modal
        open={dialog === 'newGame'}
        onClose={() => setDialog('none')}
        title={t.newGameTitle}
        size="sm"
        icon={<Icon name="cards" size={22} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog('none')}>
              {g.cancel}
            </Button>
            <Button variant={inProgress ? 'danger' : 'primary'} icon="play" onClick={confirmNewGame} autoFocus>
              {t.deal}
            </Button>
          </>
        }
      >
        <div className="sol-newgame">
          <SegmentedControl label={t.drawLabel} showLabel options={modeOptions} value={newDraw === 3 ? '3' : '1'} onChange={(v) => setNewDraw(v === '3' ? 3 : 1)} />
          <p className="sol-mode-desc">{modeDescription(newDraw)}</p>
          {inProgress && (
            <p className="sol-warning" role="note">
              <Icon name="info" size={18} />
              <span>{t.abandonWarning}</span>
            </p>
          )}
        </div>
      </Modal>
      <ResultDialog
        open={dialog === 'stuck'}
        tone="loss"
        title={t.stuck.title}
        subtitle={t.stuck.body}
        stats={[
          { label: g.score, value: fmt.number(game.score) },
          { label: g.moves, value: fmt.number(game.moves) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]}
        primary={{ label: t.stuck.newDeal, icon: 'play', onClick: newDealAfterStuck }}
        secondary={canUndo(game) ? { label: g.undo, onClick: () => doUndo(true) } : undefined}
        onClose={() => setDialog('none')}
      />
      {win && (
        <ResultDialog
          open={dialog === 'won'}
          tone="win"
          title={t.wonTitle}
          subtitle={t.wonSubtitle(game.moves, fmt.duration(winSeconds))}
          newRecord={win.record.isNewBestScore || improvedTime}
          stats={[
            { label: g.score, value: fmt.number(win.score), record: win.record.isNewBestScore },
            { label: t.timeBonus, value: `+${fmt.number(win.bonus)}` },
            { label: g.time, value: fmt.clock(winSeconds), record: improvedTime },
            { label: g.moves, value: fmt.number(game.moves) },
            { label: m.common.metrics.wins, value: fmt.number(stats.wins) },
            { label: m.common.metrics.winRate, value: fmt.percent(winRate(stats)) },
          ]}
          primary={{ label: g.playAgain, icon: 'restart', onClick: () => startGame(randomSeed(), game.draw) }}
          secondary={{ label: t.changeMode, onClick: openNewGame }}
          onClose={() => setDialog('none')}
        />
      )}
    </GameLayout>
  );
}
