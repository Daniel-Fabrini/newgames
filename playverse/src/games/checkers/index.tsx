import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameLayout, GameSetup, ToolButton, type GameStat } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog, type ResultStat } from '../../components/GameDialogs';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SegmentedControl } from '../../components/Controls';
import { announce, toast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { getStats, recordMatch, useGameStats, type RecordResult } from '../../services/stats';
import { readValue, writeValue } from '../../services/storage/storage';
import { randomSeed } from '../../utils/random';
import { EMBED_MODE, useBackHandler } from '../../app/embed';
import type { Outcome } from '../../types/game';
import { Board, cellToSquare, squareToCell, type TargetKind } from './Board';
import { MiniPiece, MoveList, PlayerBar } from './Panels';
import { displayPieces, humanMoveCount, undoPlies, type Anim, type Selection, type Session } from './session';
import {
  agreeDraw,
  applyMove,
  captureCount,
  capturedBy,
  destination,
  findMove,
  legalMoves,
  movePath,
  newGame,
  notation,
  opponent,
  replay,
  sideOfPiece,
  PIECES_PER_SIDE,
  type GameResult,
  type GameState,
  type Move,
  type Side,
} from './engine';
import type { Difficulty } from './ai';
import { requestAiMove, releaseAi } from './aiClient';
import { SETUP_KEY, configValidator, saveSpec, type CheckersConfig } from './save';
import { meta } from './meta';
import './checkers.css';

type Dialog = 'none' | 'pause' | 'help' | 'confirm' | 'result' | 'history' | 'draw';
type PendingAction = 'restart' | 'setup';

const STEP_MS = 170;
const MIN_THINK_MS = 380;
const DEFAULT_CONFIG: CheckersConfig = { mode: 'ai', humanSide: 'w', difficulty: 'medium' };
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

function boot(): { session: Session | null; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved) {
    const game = replay(saved.moves);
    if (game && !game.result) return { session: { config: saved.config, game, rng: saved.rng }, elapsedMs: saved.elapsedMs };
  }
  return { session: null, elapsedMs: 0 };
}

/** Lobby mode from DA Games (`ai` / `2p`): preselects the match type and starts a new match when nothing is in progress. */
const hintedMode: CheckersConfig['mode'] | null = EMBED_MODE === 'ai' || EMBED_MODE === '2p' ? EMBED_MODE : null;

const loadSetup = (): CheckersConfig => readValue(SETUP_KEY, { validate: configValidator }, DEFAULT_CONFIG);

export default function Checkers() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.checkers;
  const reduced = useReducedMotion();
  const stats = useGameStats('checkers');
  const [start] = useState(() => {
    const saved = boot();
    // A saved match of the other type stays untouched: the setup screen opens with the hinted type instead.
    return hintedMode && saved.session && saved.session.config.mode !== hintedMode ? { session: null, elapsedMs: 0, hadSaved: true } : { ...saved, hadSaved: saved.session !== null };
  });
  const [session, setSession] = useState<Session | null>(start.session);
  const [setup, setSetup] = useState<CheckersConfig>(() => {
    const base = start.session?.config ?? loadSetup();
    return hintedMode ? { ...base, mode: hintedMode } : base;
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [fresh, setFresh] = useState(false);
  const [dialog, setDialog] = useState<Dialog>('none');
  const [pendingAction, setPendingAction] = useState<PendingAction>('restart');
  const [resultPending, setResultPending] = useState(false);
  const [record, setRecord] = useState<RecordResult | null>(null);
  const [streakRecord, setStreakRecord] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);

  const game = session?.game ?? null;
  const config = session?.config ?? setup;
  const result: GameResult | null = game?.result ?? null;
  const playing = session !== null && !result && dialog === 'none';
  const clock = useStopwatch(playing && (game?.moves.length ?? 0) > 0, start.elapsedMs);
  const getElapsed = clock.getElapsed;
  const resetClock = clock.reset;

  // Autosave: configuration + moves (replayed and validated on load). Finished games are not kept.
  // The snapshot is refreshed after every move and every 2 s of play (the clock ticks faster than the
  // autosave debounce, so a per-tick object would postpone saving until the page is hidden).
  const elapsedBucket = Math.floor(clock.elapsedMs / 2000);
  const saveData = useMemo(
    () =>
      session && !session.game.result
        ? { config: session.config, moves: session.game.moves.map(movePath), rng: session.rng, elapsedMs: Math.max(getElapsed(), elapsedBucket * 2000) }
        : null,
    [session, getElapsed, elapsedBucket],
  );
  useAutosave(saveSpec, saveData);

  useEffect(() => releaseAi, []);

  const legal = useMemo(() => (game ? legalMoves(game) : []), [game]);
  const mustCapture = captureCount(legal);
  const humanTurn = game !== null && !result && (config.mode === '2p' || game.turn === config.humanSide);
  const aiTurn = game !== null && !result && config.mode === 'ai' && game.turn !== config.humanSide;
  const canInput = playing && humanTurn && anim === null;
  const thinking = aiTurn && anim === null && dialog === 'none';
  const flipped = config.mode === 'ai' && config.humanSide === 'b';

  const candidates = useMemo(
    () => (selection ? legal.filter((mv) => mv.from === selection.from && selection.path.every((s, i) => mv.path[i] === s)) : []),
    [legal, selection],
  );
  const movableFrom = useMemo(() => new Set(legal.map((mv) => mv.from)), [legal]);

  const sideName = useCallback(
    (side: Side) => (config.mode === 'ai' ? (side === config.humanSide ? g.you : g.computer) : t.sides[side]),
    [config, g, t],
  );

  const finish = useCallback(
    (final: GameState, cfg: CheckersConfig) => {
      const res = final.result;
      if (!res) return;
      const outcome: Outcome = cfg.mode === '2p' ? 'ended' : res.winner === null ? 'draw' : res.winner === cfg.humanSide ? 'win' : 'loss';
      const previousBest = getStats('checkers').bestStreak;
      const recorded = recordMatch(
        'checkers',
        {
          outcome,
          durationMs: getElapsed(),
          variant: cfg.mode === '2p' ? '2p' : `ai-${cfg.difficulty}`,
          metrics: cfg.mode === 'ai' ? { vsComputerWins: outcome === 'win' ? 1 : 0 } : undefined,
        },
        meta.metricRules,
      );
      setRecord(recorded);
      setStreakRecord(outcome === 'win' && recorded.stats.bestStreak > previousBest);
      setResultPending(true);
      window.setTimeout(() => feedback(outcome === 'loss' ? 'lose' : res.winner === null ? 'hint' : 'win'), reduced ? 0 : 200);
    },
    [getElapsed, reduced],
  );

  const reasonText = useCallback(
    (res: GameResult): string => {
      switch (res.reason) {
        case 'no-pieces':
          return t.results.noPieces[opponent(res.winner ?? 'w')];
        case 'no-moves':
          return t.results.noMoves[opponent(res.winner ?? 'w')];
        case 'repetition':
          return t.results.repetition;
        case 'king-moves':
          return t.results.kingMoves;
        case 'agreement':
          return t.results.agreement;
      }
    },
    [t],
  );

  const commitMove = useCallback(
    (move: Move, shown: number, rng?: number) => {
      if (!session) return;
      const next = applyMove(session.game, move);
      setSession({ ...session, game: next, rng: rng ?? session.rng });
      setSelection(null);
      setFresh(true);
      setAnim(!reduced && shown < move.path.length ? { ply: next.moves.length, step: shown + 1 } : null);
      feedback(move.captures.length > 1 ? 'clear' : move.captures.length === 1 ? 'merge' : 'place');

      const parts = [t.announceMove(sideName(session.game.turn), notation(move))];
      if (move.promotes) parts.push(t.announcePromotion);
      if (next.result) parts.push(reasonText(next.result));
      else {
        if (session.config.mode === 'ai' && next.turn === session.config.humanSide) parts.push(t.announceYourTurn);
        else if (session.config.mode === '2p') parts.push(t.turnOf[next.turn]);
        const n = captureCount(legalMoves(next));
        if (n > 0 && (session.config.mode === '2p' || next.turn === session.config.humanSide)) parts.push(t.status.mustCapture(n));
      }
      announce(parts.join(' '));
      if (next.result) finish(next, session.config);
    },
    [session, reduced, t, sideName, reasonText, finish],
  );

  // Step-by-step playback of the last move; captured pieces disappear only at the end.
  useEffect(() => {
    if (!anim || !game) return;
    const move = game.moves[anim.ply - 1];
    const timer = window.setTimeout(
      () => setAnim(move && anim.step < move.path.length ? { ply: anim.ply, step: anim.step + 1 } : null),
      STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [anim, game]);

  // Opens the result once the final move has been shown and no other dialog is open.
  useEffect(() => {
    if (resultPending && !anim && dialog === 'none') {
      setResultPending(false);
      setDialog('result');
    }
  }, [resultPending, anim, dialog]);

  // Computer move (in a worker). Cancelled when the position changes or a dialog opens.
  const commitRef = useRef(commitMove);
  useEffect(() => {
    commitRef.current = commitMove;
  });
  useEffect(() => {
    if (!thinking || !session) return;
    let cancelled = false;
    let timer = 0;
    const started = performance.now();
    const { game: position, config: cfg, rng } = session;
    requestAiMove({ board: position.board, turn: position.turn, difficulty: cfg.difficulty, rng, positions: position.positions, quietPlies: position.quietPlies })
      .then((res) => {
        if (cancelled) return;
        // Only moves from the legal move generator are ever played.
        const move = findMove(position, res.path) ?? legalMoves(position)[0];
        if (!move) return;
        timer = window.setTimeout(() => {
          if (!cancelled) commitRef.current(move, 0, res.rng);
        }, Math.max(0, MIN_THINK_MS - (performance.now() - started)));
      })
      .catch(() => {
        /* No legal move: the engine has already ended the game. */
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [thinking, session]);

  const startGame = useCallback(
    (cfg: CheckersConfig) => {
      writeValue(SETUP_KEY, cfg);
      setSetup(cfg);
      setSession({ config: cfg, game: newGame(), rng: randomSeed() });
      setSelection(null);
      setAnim(null);
      setFresh(false);
      setRecord(null);
      setStreakRecord(false);
      setResultPending(false);
      setDialog('none');
      resetClock(0);
      feedback('tap');
      announce(cfg.mode === 'ai' && cfg.humanSide === 'w' ? t.announceYourTurn : t.turnOf.w);
    },
    [resetClock, t],
  );

  useEffect(() => {
    if (hintedMode && !start.hadSaved) startGame({ ...setup, mode: hintedMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const goToSetup = useCallback(() => {
    if (session) setSetup(session.config);
    setSession(null);
    setSelection(null);
    setAnim(null);
    setFresh(false);
    setRecord(null);
    setResultPending(false);
    setDialog('none');
    resetClock(0);
  }, [session, resetClock]);

  /** Abandoning a game against the computer after moving counts as a loss. */
  const recordAbandon = () => {
    if (!session || result || session.config.mode !== 'ai' || humanMoveCount(session) === 0) return;
    recordMatch(
      'checkers',
      { outcome: 'loss', durationMs: getElapsed(), variant: `ai-${session.config.difficulty}`, metrics: { vsComputerWins: 0 } },
      meta.metricRules,
    );
  };

  const request = (action: PendingAction) => {
    if (session && !result && session.game.moves.length > 0) {
      setPendingAction(action);
      setDialog('confirm');
    } else if (action === 'restart' && session) startGame(session.config);
    else goToSetup();
  };

  const confirmAction = () => {
    recordAbandon();
    if (pendingAction === 'restart' && session) startGame(session.config);
    else goToSetup();
  };

  // Embed mode (host back button / header back): from a match go back to the setup screen.
  useBackHandler(() => {
    if (!session) return false;
    request('setup');
    return true;
  });

  const undoCount = session && !result ? undoPlies(session) : 0;
  const doUndo = () => {
    if (!session || undoCount === 0 || anim || !playing) return;
    const previous = replay(session.game.moves.slice(0, -undoCount).map(movePath));
    if (!previous) return;
    setSession({ ...session, game: previous });
    setSelection(null);
    setFresh(false);
    feedback('undo');
    const lastMove = previous.moves[previous.moves.length - 1];
    announce(lastMove ? t.status.lastMove(notation(lastMove)) : t.turnOf[previous.turn]);
  };

  const confirmDraw = () => {
    if (!session || result) return;
    const next = agreeDraw(session.game);
    setSession({ ...session, game: next });
    setSelection(null);
    setDialog('none');
    announce(t.results.agreement);
    finish(next, session.config);
  };

  const onSquare = (sq: number) => {
    if (!canInput || !game) return;
    if (selection) {
      const depth = selection.path.length;
      const steps = candidates.filter((mv) => mv.path[depth] === sq);
      if (steps.length > 0) {
        const complete = steps.find((mv) => mv.path.length === depth + 1);
        if (complete) return commitMove(complete, depth);
        if (steps.length === 1) return commitMove(steps[0] as Move, depth);
        setSelection({ from: selection.from, path: [...selection.path, sq] });
        feedback('select');
        return;
      }
      const finals = candidates.filter((mv) => destination(mv) === sq);
      if (finals.length === 1) return commitMove(finals[0] as Move, depth);
      if (depth > 0) {
        if (sq === selection.path[depth - 1]) {
          setSelection(null);
          return;
        }
        feedback('error');
        toast(t.status.continueCapture((candidates[0]?.captures.length ?? depth) - depth));
        return;
      }
      if (sq === selection.from) {
        setSelection(null);
        return;
      }
    }
    const value = game.board[sq] ?? 0;
    if (value !== 0 && sideOfPiece(value) === game.turn) {
      if (movableFrom.has(sq)) {
        setSelection({ from: sq, path: [] });
        feedback('select');
        announce(t.announceSelected(sq + 1));
      } else {
        feedback('error');
        toast(mustCapture > 0 ? t.mustCaptureHint : t.cannotMove);
      }
    } else if (selection) setSelection(null);
  };

  const selectedSquare = selection ? (selection.path[selection.path.length - 1] ?? selection.from) : null;
  const targets = useMemo(() => {
    const out = new Map<number, TargetKind>();
    if (!selection) return out;
    for (const mv of candidates) {
      const next = mv.path[selection.path.length];
      if (next !== undefined) out.set(next, mv.captures.length > 0 ? 'capture' : 'move');
    }
    return out;
  }, [candidates, selection]);
  const victims = useMemo(() => {
    const out = new Set<number>();
    if (!selection) return out;
    for (const mv of candidates) {
      const victim = mv.captures[selection.path.length];
      if (victim !== undefined) out.add(victim);
    }
    return out;
  }, [candidates, selection]);
  const movable = useMemo(
    () => (canInput && (!selection || selection.path.length === 0) ? movableFrom : new Set<number>()),
    [canInput, selection, movableFrom],
  );
  const pieces = useMemo(() => (game ? displayPieces(game, anim, selection, candidates, fresh) : []), [game, anim, selection, candidates, fresh]);
  const lastMove = game && !anim && game.moves.length > 0 ? movePath(game.moves[game.moves.length - 1] as Move) : [];

  useKeyboard(
    (e) => {
      if (!session) return false;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const onControl = Boolean(target && !target.closest('.ck-board') && target.closest('button, a, input, select, [role="radio"], [role="switch"]'));
      const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const delta = arrows[e.key];
      if (delta) {
        setCursor((current) => {
          if (current === null) {
            const start = selectedSquare ?? [...movableFrom][0];
            return start !== undefined ? squareToCell(start, flipped) : 27;
          }
          const r = Math.min(7, Math.max(0, (current >> 3) + delta[0]));
          const c = Math.min(7, Math.max(0, (current & 7) + delta[1]));
          return r * 8 + c;
        });
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (onControl) return false;
        if (cursor === null) return false;
        const sq = cellToSquare(cursor, flipped);
        if (sq >= 0) onSquare(sq);
        return true;
      }
      if (e.key === 'Escape') {
        if (selection) setSelection(null);
        else setDialog('pause');
        return true;
      }
      if (e.key === 'u' || e.key === 'U' || e.key === 'Backspace') {
        doUndo();
        return true;
      }
      if (e.key === 'p' || e.key === 'P') {
        setDialog('pause');
        return true;
      }
      return false;
    },
    dialog === 'none',
  );

  const difficultyLabel = (d: Difficulty) => g.difficulties[d];

  /* ───────────── Setup screen ───────────── */
  if (!session || !game) {
    return (
      <GameLayout gameId="checkers" onHelp={() => setDialog('help')}>
        <GameSetup
          gameId="checkers"
          description={t.setup.rules}
          actions={
            <Button variant="primary" size="lg" icon="play" block onClick={() => startGame(setup)}>
              {g.start}
            </Button>
          }
        >
          <div className="ck-setup">
            <SegmentedControl
              label={g.mode}
              showLabel
              value={setup.mode}
              onChange={(mode) => setSetup({ ...setup, mode })}
              options={[
                { value: 'ai', label: g.vsComputer },
                { value: '2p', label: g.twoPlayers },
              ]}
            />
            {setup.mode === 'ai' && (
              <>
                <SegmentedControl
                  label={t.setup.colour}
                  showLabel
                  value={setup.humanSide}
                  onChange={(humanSide) => setSetup({ ...setup, humanSide })}
                  options={(['w', 'b'] as const).map((side) => ({
                    value: side,
                    label: (
                      <span className="ck-option">
                        <MiniPiece side={side} /> {t.sides[side]}
                      </span>
                    ),
                  }))}
                />
                <SegmentedControl
                  label={g.difficulty}
                  showLabel
                  value={setup.difficulty}
                  onChange={(difficulty) => setSetup({ ...setup, difficulty })}
                  options={DIFFICULTIES.map((d) => ({ value: d, label: difficultyLabel(d) }))}
                />
              </>
            )}
            <p className="ck-setup__note">
              <Icon name="info" size={16} /> {t.setup.whiteFirst}
            </p>
          </div>
        </GameSetup>
        <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      </GameLayout>
    );
  }

  /* ───────────── Game screen ───────────── */
  const topSide: Side = flipped ? 'w' : 'b';
  const bottomSide = opponent(topSide);
  const playerName = (side: Side) =>
    config.mode === 'ai' ? (side === config.humanSide ? t.playerYou(t.sides[side]) : t.playerComputer(difficultyLabel(config.difficulty))) : t.sides[side];
  /** Pieces captured by `side`, counted from what is drawn (a capture counts once its pieces leave the board). */
  const onBoardCaptured = (side: Side) =>
    PIECES_PER_SIDE - pieces.filter((p) => p.state !== 'ghost' && sideOfPiece(p.value) === opponent(side)).length;
  const bar = (side: Side) => (
    <PlayerBar
      side={side}
      name={playerName(side)}
      active={!result && game.turn === side}
      thinking={thinking && game.turn === side}
      captured={onBoardCaptured(side)}
      winner={result?.winner === side}
    />
  );

  const last = game.moves[game.moves.length - 1];
  let status: string;
  if (result) status = reasonText(result);
  else if (aiTurn) status = t.status.waiting;
  else if (selection && selection.path.length > 0) status = t.status.continueCapture((candidates[0]?.captures.length ?? 0) - selection.path.length);
  else if (mustCapture > 0) status = t.status.mustCapture(mustCapture);
  else if (selection) status = t.status.selectDestination;
  else status = t.status.selectPiece;
  const statusPrefix = !result && !aiTurn && config.mode === '2p' ? `${t.turnOf[game.turn]} · ` : '';

  const layoutStats: GameStat[] = [
    { label: g.moves, value: fmt.number(game.moves.length) },
    { label: g.time, value: fmt.clock(clock.elapsedMs) },
  ];
  if (config.mode === 'ai') layoutStats.push({ label: m.common.metrics.wins, value: fmt.number(stats.wins), icon: 'crown' });

  const tone = !result ? 'neutral' : result.winner === null ? 'draw' : config.mode === '2p' || result.winner === config.humanSide ? 'win' : 'loss';
  const resultTitle = !result
    ? g.gameOver
    : result.winner === null
      ? g.draw
      : config.mode === '2p'
        ? t.sideWins[result.winner]
        : result.winner === config.humanSide
          ? g.youWin
          : g.youLose;
  const resultStats: ResultStat[] = [
    { label: g.moves, value: fmt.number(game.moves.length) },
    { label: g.time, value: fmt.clock(clock.elapsedMs) },
    { label: `${t.captures} · ${t.sides[bottomSide]}`, value: fmt.number(capturedBy(game.board, bottomSide)) },
    { label: `${t.captures} · ${t.sides[topSide]}`, value: fmt.number(capturedBy(game.board, topSide)) },
  ];
  if (config.mode === 'ai' && record) resultStats.push({ label: t.bestStreak, value: fmt.number(record.stats.bestStreak), record: streakRecord });

  const confirmBody = config.mode === 'ai' && humanMoveCount(session) > 0 ? t.abandonBody : g.restartBody;

  return (
    <GameLayout
      gameId="checkers"
      subtitle={config.mode === 'ai' ? t.subtitleAi(difficultyLabel(config.difficulty)) : t.subtitleTwoPlayers}
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      stats={layoutStats}
      toolbar={
        <>
          <ToolButton icon="undo" label={g.undo} onClick={doUndo} disabled={undoCount === 0 || anim !== null || !playing} />
          {config.mode === '2p' && (
            <ToolButton icon="swap" label={t.offerDraw} description={t.offerDrawDescription} onClick={() => setDialog('draw')} disabled={!playing || anim !== null} />
          )}
          <button type="button" className="tool-btn ck-history-btn" onClick={() => setDialog('history')}>
            <span className="tool-btn__icon">
              <Icon name="history" size={24} />
            </span>
            <span className="tool-btn__label">{g.history}</span>
          </button>
          <ToolButton icon="restart" label={g.newGame} onClick={() => request('setup')} />
        </>
      }
    >
      <div className="ck-wrap">
        <div className="ck-layout">
          <div className="ck-top">{bar(topSide)}</div>
          <div className="ck-boardbox">
            <Board
              pieces={pieces}
              flipped={flipped}
              movable={movable}
              selected={selectedSquare}
              targets={targets}
              victims={victims}
              lastMove={lastMove}
              cursor={cursor}
              mandatory={canInput && mustCapture > 0}
              onSquare={onSquare}
              onPointerUse={() => setCursor(null)}
            />
          </div>
          <div className="ck-bottom">{bar(bottomSide)}</div>
          <p className={mustCapture > 0 && canInput ? 'ck-status is-alert' : 'ck-status'}>
            <span className="ck-status__text">
              {mustCapture > 0 && canInput && <Icon name="bolt" size={14} />}
              {statusPrefix}
              {status}
            </span>
            {last && !anim && <span className="ck-status__last tabular">{notation(last)}</span>}
          </p>
          <section className="ck-side" aria-label={g.history}>
            <h2 className="ck-side__title">
              <Icon name="history" size={16} /> {g.history}
            </h2>
            <MoveList moves={game.moves} />
          </section>
        </div>
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={() => request('restart')} onHelp={() => setDialog('help')} />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      <Modal open={dialog === 'history'} onClose={() => setDialog('none')} title={g.history} size="sm" icon={<Icon name="history" size={22} />}>
        <MoveList moves={game.moves} className="ck-history--modal" />
      </Modal>
      <ConfirmDialog
        open={dialog === 'confirm'}
        title={g.restartTitle}
        body={confirmBody}
        confirmLabel={pendingAction === 'restart' ? g.restart : g.newGame}
        tone="danger"
        onCancel={() => setDialog('none')}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={dialog === 'draw'}
        title={t.drawOfferTitle[game.turn]}
        body={t.drawOfferBody[game.turn]}
        confirmLabel={t.acceptDraw}
        cancelLabel={t.declineDraw}
        onCancel={() => {
          setDialog('none');
          toast(t.drawDeclined);
        }}
        onConfirm={confirmDraw}
      />
      <ResultDialog
        open={dialog === 'result'}
        tone={tone}
        title={resultTitle}
        subtitle={result ? reasonText(result) : undefined}
        newRecord={streakRecord}
        stats={resultStats}
        primary={{ label: g.playAgain, onClick: () => startGame(config) }}
        secondary={{ label: t.changeMode, onClick: goToSetup }}
        onClose={() => setDialog('none')}
      />
    </GameLayout>
  );
}
