import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameLayout, GameSetup, type GameStat } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { Modal } from '../../components/Modal';
import { SegmentedControl } from '../../components/Controls';
import { Button, IconButton } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { announce, toast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { usePageVisible } from '../../hooks/usePageVisible';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, type RecordResult } from '../../services/stats';
import { readValue, writeValue } from '../../services/storage/storage';
import { v } from '../../services/storage/schema';
import { Rng, randomSeed } from '../../utils/random';
import { chooseAction, viewFor } from './ai';
import {
  DIFFICULTIES,
  MATCH_LENGTHS,
  applyAction,
  bestRoundPoints,
  hasActed,
  legalActions,
  lineEnds,
  newMatch,
  nextRound,
  otherSeat,
  playableTiles,
  restartRound,
  type Action,
  type End,
  type MatchConfig,
  type MatchLength,
  type MatchState,
  type RoundRecord,
  type Seat,
} from './engine';
import { Hand, type DropInfo } from './Hand';
import { HistoryPanel, useDescribe, type Names } from './HistoryPanel';
import { Table, type EndTarget } from './Table';
import { DominoFace, TileBack } from './Tile';
import { pipsOf, type TileId } from './tiles';
import { saveSpec } from './save';
import { meta } from './meta';
import './domino.css';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'history';

const DEFAULT_CONFIG: MatchConfig = { mode: 'ai', difficulty: 'medium', length: 100 };
const PREFS_KEY = 'prefs:domino';
const prefsValidator = v.object({
  mode: v.literal('ai', '2p'),
  difficulty: v.literal('easy', 'medium', 'hard'),
  length: v.literal('single', 50, 100, 150),
});

const AI_DELAY = { play: 750, draw: 450, pass: 650 } as const;

function boot(): { match: MatchState | null; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved && !saved.match.over) return saved;
  return { match: null, elapsedMs: 0 };
}

const lengthKey = (l: MatchLength) => String(l) as '50' | '100' | '150' | 'single';
const lengthFromKey = (k: string): MatchLength => (k === 'single' ? 'single' : (Number(k) as 50 | 100 | 150));

function lastPlayedTile(match: MatchState | null): TileId | null {
  const log = match?.round.log ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.kind === 'play') return e.tile;
  }
  return null;
}

/** Tiles left in each hand at the end of a round, with their pip totals. */
function RevealedHands({ record, names }: { record: RoundRecord; names: readonly [string, string] }) {
  const { m } = useI18n();
  const t = m.domino;
  return (
    <div className="dm-reveal">
      {([0, 1] as const).map((seat) => (
        <div key={seat} className={record.winner === seat ? 'dm-reveal__row is-winner' : 'dm-reveal__row'}>
          <div className="dm-reveal__head">
            <span className="dm-reveal__name">
              {record.winner === seat && <Icon name="trophy" size={14} />}
              {names[seat]}
            </span>
            <span className="dm-reveal__pips tabular">{t.round.pips(record.pips[seat])}</span>
          </div>
          <div className="dm-reveal__tiles" aria-label={record.hands[seat].map((x) => t.tile(pipsOf(x)[1], pipsOf(x)[0])).join(', ') || t.round.emptyHand}>
            {record.hands[seat].length === 0 ? (
              <span className="dm-reveal__empty">{t.round.emptyHand}</span>
            ) : (
              record.hands[seat].map((x) => <DominoFace key={x} first={pipsOf(x)[1]} second={pipsOf(x)[0]} orient="v" className="dm-mini" />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DominoGame() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.domino;
  const [bootState] = useState(boot);
  const [match, setMatch] = useState<MatchState | null>(bootState.match);
  const [config, setConfig] = useState<MatchConfig>(() => bootState.match?.config ?? readValue(PREFS_KEY, { validate: prefsValidator }, DEFAULT_CONFIG));
  const [dialog, setDialog] = useState<Dialog>('none');
  const [selected, setSelected] = useState<TileId | null>(null);
  const [dragging, setDragging] = useState<TileId | null>(null);
  const [hoverEnd, setHoverEnd] = useState<End | null>(null);
  const [readyFor, setReadyFor] = useState<Seat | null>(null);
  const [justDrawn, setJustDrawn] = useState<TileId | null>(null);
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [result, setResult] = useState<RecordResult | null>(null);
  const visible = usePageVisible();

  const round = match?.round ?? null;
  const inRound = Boolean(match && round && !match.over && !round.result);
  const clock = useStopwatch(inRound && dialog === 'none', bootState.elapsedMs);
  const getElapsed = clock.getElapsed;

  // Saved after every change; finished matches are cleared so they never resume.
  const savePayload = useMemo(() => (match && !match.over ? { match, elapsedMs: getElapsed() } : null), [match, getElapsed]);
  useAutosave(saveSpec, savePayload);

  const mode = match?.config.mode ?? config.mode;
  const names = useMemo<[string, string]>(() => (mode === 'ai' ? [g.you, g.computer] : [g.player1, g.player2]), [mode, g]);
  const nameInfo = useMemo<Names>(() => ({ names, you: mode === 'ai' ? 0 : null }), [names, mode]);
  const describe = useDescribe(nameInfo);

  const turn: Seat = round?.turn ?? 0;
  const handHidden = mode === '2p' && inRound && readyFor !== turn;
  const viewer: Seat = mode === 'ai' ? 0 : inRound ? turn : (readyFor ?? turn);
  const opponent = otherSeat(viewer);
  const humanTurn = inRound && (mode === '2p' ? !handHidden : turn === 0);
  const canInteract = humanTurn && dialog === 'none';
  const playable = useMemo(() => (round && humanTurn ? playableTiles(round) : new Map<TileId, End[]>()), [round, humanTurn]);
  const legal = round && humanTurn ? legalActions(round) : [];
  const mustDraw = legal.length === 1 && legal[0]?.type === 'draw';
  const mustPass = legal.length === 1 && legal[0]?.type === 'pass';
  const ends = round ? lineEnds(round.line) : null;

  const tileText = describe.tileText;

  const resetRoundUi = useCallback(() => {
    setSelected(null);
    setDragging(null);
    setHoverEnd(null);
    setReadyFor(null);
    setJustDrawn(null);
    setSummaryHidden(false);
  }, []);

  const finishMatch = useCallback(
    (final: MatchState) => {
      const durationMs = getElapsed();
      let res: RecordResult;
      if (final.config.mode === 'ai') {
        const best = bestRoundPoints(final, 0);
        res = recordMatch(
          'domino',
          {
            outcome: final.winner === 0 ? 'win' : final.winner === 1 ? 'loss' : 'draw',
            durationMs,
            variant: `ai-${final.config.difficulty}`,
            metrics: best > 0 ? { points: final.scores[0], bestRound: best } : { points: final.scores[0] },
          },
          meta.metricRules,
        );
      } else {
        res = recordMatch('domino', { outcome: 'ended', durationMs, variant: '2p' }, meta.metricRules);
      }
      setResult(res);
    },
    [getElapsed],
  );

  /** Applies a state change, then handles feedback, announcements and the end of the round/match. */
  const commit = useCallback(
    (prev: MatchState, next: MatchState) => {
      setMatch(next);
      setSelected(null);
      setDragging(null);
      setHoverEnd(null);
      const entry = next.round.log[next.round.log.length - 1];
      const roundEnded = Boolean(next.round.result && !prev.round.result);
      if (!roundEnded) {
        if (entry) {
          const parts = [describe.entry(entry)];
          if (entry.kind === 'draw' && (next.config.mode === '2p' || entry.seat === 0)) {
            const drawn = next.round.hands[entry.seat].find((x) => !prev.round.hands[entry.seat].includes(x));
            if (drawn !== undefined) parts[0] = t.drewTile(tileText(drawn));
          }
          if (next.config.mode === 'ai' && next.round.turn === 0 && prev.round.turn === 1) parts.push(g.yourTurn);
          announce(parts.join('. '));
          feedback(entry.kind === 'play' ? 'place' : entry.kind === 'draw' ? 'tap' : 'select');
        }
        return;
      }
      const res = next.round.result;
      if (!res) return;
      setSummaryHidden(false);
      if (next.over) finishMatch(next);
      const ai = next.config.mode === 'ai';
      const title =
        res.winner === null ? t.round.draw : ai ? (res.winner === 0 ? t.round.youWin : t.round.youLose) : t.round.wins(names[res.winner]);
      const points = res.winner === null ? t.round.blockedTie : ai && res.winner === 0 ? t.round.pointsYou(res.points) : t.round.pointsFor(names[res.winner], res.points);
      announce(`${title}. ${points}`);
      const humanWon = next.config.mode === 'ai' ? res.winner === 0 : res.winner !== null;
      const humanLost = next.config.mode === 'ai' && res.winner === 1;
      feedback(humanWon ? 'win' : humanLost ? 'lose' : 'clear');
    },
    [describe, finishMatch, g, t, tileText, names],
  );

  const act = (action: Action) => {
    if (!match || !canInteract) return;
    const next = applyAction(match, action);
    if (!next) {
      feedback('error');
      return;
    }
    if (action.type === 'draw') {
      const seat = match.round.turn;
      setJustDrawn(next.round.hands[seat].find((x) => !match.round.hands[seat].includes(x)) ?? null);
    } else {
      setJustDrawn(null);
    }
    commit(match, next);
  };

  // Computer turn: decides from its public view only, after a short visible delay.
  useEffect(() => {
    if (!match || match.config.mode !== 'ai' || match.over) return;
    const r = match.round;
    if (r.result || r.turn !== 1 || dialog !== 'none' || !visible) return;
    const view = viewFor(r, 1);
    const first = legalActions(r)[0];
    const delay = first?.type === 'draw' ? AI_DELAY.draw : first?.type === 'pass' ? AI_DELAY.pass : AI_DELAY.play;
    const id = window.setTimeout(() => {
      const rng = new Rng(match.rng);
      const action = chooseAction(view, match.config.difficulty, rng);
      if (!action) return;
      const next = applyAction({ ...match, rng: rng.state }, action);
      if (next) commit(match, next);
    }, delay);
    return () => window.clearTimeout(id);
  }, [match, dialog, visible, commit]);

  const startMatch = (cfg: MatchConfig) => {
    writeValue(PREFS_KEY, cfg);
    setConfig(cfg);
    setMatch(newMatch(cfg, randomSeed()));
    clock.reset(0);
    setResult(null);
    resetRoundUi();
    setDialog('none');
  };

  const abandonCounts = Boolean(match && !match.over && match.config.mode === 'ai' && hasActed(match, 0));

  const recordAbandon = () => {
    if (!match || !abandonCounts) return;
    const best = bestRoundPoints(match, 0);
    recordMatch(
      'domino',
      {
        outcome: 'loss',
        durationMs: getElapsed(),
        variant: `ai-${match.config.difficulty}`,
        metrics: best > 0 ? { points: match.scores[0], bestRound: best } : { points: match.scores[0] },
      },
      meta.metricRules,
    );
  };

  const restartRoundNow = () => {
    if (!match) return;
    const next = restartRound(match);
    if (next) {
      setMatch(next);
      resetRoundUi();
      feedback('undo');
    }
    setDialog('none');
  };

  const restartMatchNow = () => {
    if (!match) return;
    recordAbandon();
    startMatch(match.config);
  };

  const toSetup = () => {
    recordAbandon();
    if (match) setConfig(match.config);
    setMatch(null);
    clock.reset(0);
    setResult(null);
    resetRoundUi();
    setDialog('none');
  };

  const goNextRound = () => {
    if (!match) return;
    const next = nextRound(match);
    if (!next) return;
    setMatch(next);
    resetRoundUi();
  };

  /** End chosen automatically when the choice does not matter (one end, or both ends equal). */
  const autoEnd = (options: readonly End[]): End | null => {
    if (!round) return null;
    if (options.length === 1) return options[0] ?? null;
    if (!ends || ends[0] === ends[1]) {
      const leftArm = round.origin;
      const rightArm = round.line.length - 1 - round.origin;
      return leftArm <= rightArm ? 'left' : 'right';
    }
    return null;
  };

  const onTileTap = (tile: TileId) => {
    if (!canInteract) {
      feedback('error');
      toast(t.notYourTurn);
      return;
    }
    const options = playable.get(tile);
    if (!options) {
      feedback('error');
      toast(t.doesNotFit);
      return;
    }
    if (selected === tile) {
      setSelected(null);
      return;
    }
    const end = autoEnd(options);
    if (end) {
      act({ type: 'play', tile, end });
      return;
    }
    setSelected(tile);
    feedback('select');
    announce(t.status.chooseEnd(tileText(tile)));
  };

  const onDrop = (tile: TileId, drop: DropInfo) => {
    setDragging(null);
    setHoverEnd(null);
    const options = playable.get(tile);
    if (!options || !drop.overTable) return;
    const end = drop.end && options.includes(drop.end) ? drop.end : autoEnd(options);
    if (end) act({ type: 'play', tile, end });
    else setSelected(tile);
  };

  useKeyboard(
    (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (selected !== null && e.key === 'Escape') setSelected(null);
        else setDialog('pause');
        return true;
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(document.activeElement instanceof HTMLElement && document.activeElement.closest('.dm-hand, .dm-table'))) {
        // Bring keyboard focus into the hand (e.g. after the focused tile was played).
        document.querySelector<HTMLElement>('.dm-hand-tile.is-playable, .dm-hand-tile')?.focus();
        return true;
      }
      if ((e.key === 'd' || e.key === 'D') && mustDraw) {
        act({ type: 'draw' });
        return true;
      }
      if ((e.key === 's' || e.key === 'S') && mustPass) {
        act({ type: 'pass' });
        return true;
      }
      return false;
    },
    Boolean(match) && dialog === 'none',
  );

  const candidate = dragging ?? selected;
  const targets = useMemo<EndTarget[]>(() => {
    if (candidate === null || !ends) return [];
    return (playable.get(candidate) ?? []).map((end) => {
      const value = end === 'left' ? ends[0] : ends[1];
      return { end, value, label: t.endTarget(t.ends[end], value) };
    });
  }, [candidate, ends, playable, t]);

  // ───────────── Setup screen ─────────────
  if (!match || !round) {
    const lengthHint = config.length === 'single' ? t.setup.singleHint : t.setup.lengthHint(config.length);
    return (
      <GameLayout gameId="domino" onHelp={() => setDialog('help')}>
        <GameSetup
          gameId="domino"
          actions={
            <Button variant="primary" size="lg" block icon="play" onClick={() => startMatch(config)}>
              {g.start}
            </Button>
          }
        >
          <SegmentedControl
            label={g.mode}
            showLabel
            value={config.mode}
            onChange={(mode) => setConfig({ ...config, mode })}
            options={[
              { value: 'ai', label: g.vsComputer },
              { value: '2p', label: g.twoPlayers },
            ]}
          />
          {config.mode === 'ai' ? (
            <>
              <SegmentedControl
                label={g.difficulty}
                showLabel
                value={config.difficulty}
                onChange={(difficulty) => setConfig({ ...config, difficulty })}
                options={DIFFICULTIES.map((d) => ({ value: d, label: g.difficulties[d] }))}
              />
              <p className="dm-setup-hint">{t.setup.difficultyHints[config.difficulty]}</p>
            </>
          ) : (
            <p className="dm-setup-hint">{t.setup.twoPlayersHint}</p>
          )}
          <SegmentedControl
            label={t.setup.length}
            showLabel
            size="sm"
            value={lengthKey(config.length)}
            onChange={(k) => setConfig({ ...config, length: lengthFromKey(k) })}
            options={MATCH_LENGTHS.map((l) => ({ value: lengthKey(l), label: l === 'single' ? t.setup.single : fmt.number(l) }))}
          />
          <p className="dm-setup-hint">{lengthHint}</p>
        </GameSetup>
        <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />
      </GameLayout>
    );
  }

  // ───────────── Game screen ─────────────
  const cfg = match.config;
  const subtitle = cfg.length === 'single' ? t.subtitle.single : t.subtitle.target(cfg.length);
  const stats: GameStat[] = [
    { label: names[0], value: fmt.number(match.scores[0]), primary: mode === 'ai' || (inRound && turn === 0) },
    { label: names[1], value: fmt.number(match.scores[1]), primary: mode === '2p' && inRound && turn === 1 },
    { label: t.roundLabel, value: fmt.number(match.roundNo) },
  ];

  const lastRecord = match.rounds[match.rounds.length - 1] ?? null;
  const res = round.result;
  const aiThinking = mode === 'ai' && inRound && turn === 1;

  let status: string;
  if (res) status = t.status.roundOver;
  else if (aiThinking) status = round.line.length === 0 ? t.status.opensWith(names[1], tileText(round.opening)) : t.status.thinking;
  else if (handHidden) status = g.turnOf(names[turn]);
  else if (round.line.length === 0) status = mode === 'ai' ? t.status.openWith(tileText(round.opening)) : t.status.opensWith(names[turn], tileText(round.opening));
  else if (selected !== null) status = t.status.chooseEnd(tileText(selected));
  else if (mustDraw) status = t.status.mustDraw;
  else if (mustPass) status = t.status.mustPass;
  else status = mode === 'ai' ? g.yourTurn : g.turnOf(names[turn]);

  const tableLabel = ends ? t.tableLabel(round.line.length, ends[0], ends[1]) : t.tableEmpty;
  const viewerHand = round.hands[viewer];
  const oppCount = round.hands[opponent].length;

  const roundTitle = (r: RoundRecord) =>
    r.winner === null ? t.round.draw : mode === 'ai' ? (r.winner === 0 ? t.round.youWin : t.round.youLose) : t.round.wins(names[r.winner]);
  const roundReason = (r: RoundRecord) =>
    r.reason === 'blocked' ? (r.winner === null ? t.round.blockedTie : t.round.blocked) : mode === 'ai' && r.winner === 0 ? t.round.dominoYou : t.round.domino(names[r.winner ?? 0]);

  const matchTitle =
    match.winner === null ? t.match.draw : mode === 'ai' ? (match.winner === 0 ? t.match.youWin : t.match.youLose) : t.match.wins(names[match.winner]);
  const matchTone = match.winner === null ? 'draw' : mode === 'ai' ? (match.winner === 0 ? 'win' : 'loss') : 'win';
  const best = bestRoundPoints(match, 0);

  return (
    <GameLayout
      gameId="domino"
      subtitle={subtitle}
      stats={stats}
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      actions={<IconButton icon="history" label={t.history.title} onClick={() => setDialog('history')} />}
    >
      <div className="dm-root">
        <div className="dm-main">
          <div className={aiThinking ? 'dm-opponent is-thinking' : 'dm-opponent'} aria-label={t.opponentHand(names[opponent], oppCount)} role="group">
            <Icon name={mode === 'ai' ? 'bolt' : 'user'} size={18} className="dm-opponent__icon" />
            <span className="dm-opponent__who">
              <span className="dm-opponent__name">
                {names[opponent]}
                {aiThinking && (
                  <span className="dm-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
              {mode === 'ai' && <span className="dm-opponent__level">{g.difficulties[cfg.difficulty]}</span>}
            </span>
            <span className="dm-opponent__backs" aria-hidden="true">
              {Array.from({ length: Math.min(oppCount, 12) }, (_, i) => (
                <TileBack key={i} />
              ))}
            </span>
            <span className="dm-opponent__count tabular" aria-hidden="true">
              {t.tiles(oppCount)}
            </span>
            <span className="dm-boneyard" aria-label={t.boneyardCount(round.boneyard.length)} role="img">
              <span className="dm-boneyard__pile" aria-hidden="true">
                <TileBack orient="h" />
                <TileBack orient="h" />
              </span>
              <span className="dm-boneyard__text">
                <span className="dm-boneyard__label">{t.boneyard}</span>
                <strong className="tabular">{fmt.number(round.boneyard.length)}</strong>
              </span>
            </span>
          </div>

          <Table
            line={round.line}
            origin={round.origin}
            candidate={candidate}
            targets={targets}
            onTarget={(end) => candidate !== null && act({ type: 'play', tile: candidate, end })}
            hoverEnd={hoverEnd}
            lastPlayed={lastPlayedTile(match)}
            inProgress={inRound}
            label={tableLabel}
            focusTargets={selected !== null && dragging === null}
          />

          <div className="dm-status">
            <span className={humanTurn ? 'dm-status__text is-you' : 'dm-status__text'}>
              <span className="dm-status__dot" aria-hidden="true" />
              {status}
            </span>
            {mustDraw && canInteract && (
              <Button variant="primary" size="md" icon="plus" onClick={() => act({ type: 'draw' })} aria-label={t.actions.drawLabel(round.boneyard.length)}>
                {t.actions.draw} · {fmt.number(round.boneyard.length)}
              </Button>
            )}
            {mustPass && canInteract && (
              <Button variant="primary" size="md" icon="arrowRight" onClick={() => act({ type: 'pass' })}>
                {t.actions.pass}
              </Button>
            )}
            {selected !== null && canInteract && (
              <Button variant="secondary" size="sm" icon="close" onClick={() => setSelected(null)}>
                {t.actions.cancel}
              </Button>
            )}
            {res && summaryHidden && (
              <Button variant="primary" size="md" icon="arrowRight" onClick={() => setSummaryHidden(false)}>
                {match.over ? t.match.showResult : t.round.next}
              </Button>
            )}
          </div>

          <div className="dm-hand-area">
            {handHidden ? (
              <div className="dm-handoff" role="group" aria-label={g.passDevice(names[turn])}>
                <Icon name="swap" size={26} />
                <div className="dm-handoff__text">
                  <strong>{g.passDevice(names[turn])}</strong>
                  <span>{t.handoff.body}</span>
                </div>
                <Button variant="primary" size="lg" icon="play" onClick={() => setReadyFor(turn)} disabled={dialog !== 'none'}>
                  {g.ready}
                </Button>
              </div>
            ) : (
              <Hand
                tiles={viewerHand}
                playable={playable}
                selected={selected}
                justDrawn={justDrawn}
                active={canInteract}
                label={mode === 'ai' ? t.handLabel : t.handOf(names[viewer])}
                tileLabel={(tile, canPlay, isNew) => {
                  const base = canPlay ? t.tilePlayable(tileText(tile)) : t.tileBlocked(tileText(tile));
                  return isNew ? `${base}, ${t.tileNew}` : base;
                }}
                onTap={onTileTap}
                onDragStart={(tile) => {
                  setDragging(tile);
                  setSelected(null);
                }}
                onDragHover={setHoverEnd}
                onDrop={onDrop}
                onDragCancel={() => {
                  setDragging(null);
                  setHoverEnd(null);
                }}
              />
            )}
          </div>
        </div>
        <aside className="dm-side" aria-label={t.history.title}>
          <HistoryPanel match={match} names={nameInfo} />
        </aside>
      </div>

      <PauseMenu open={dialog === 'pause'} onResume={() => setDialog('none')} onRestart={() => setDialog('restart')} onHelp={() => setDialog('help')} />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog('none')} intro={t.help.intro} sections={t.help.sections} />

      <Modal open={dialog === 'history'} onClose={() => setDialog('none')} title={t.history.title} size="md" icon={<Icon name="history" size={22} />}>
        <HistoryPanel match={match} names={nameInfo} />
      </Modal>

      <Modal
        open={dialog === 'restart'}
        onClose={() => setDialog('none')}
        title={t.restart.title}
        size="sm"
        icon={<Icon name="restart" size={22} />}
        footer={
          <Button variant="secondary" onClick={() => setDialog('none')} autoFocus>
            {g.cancel}
          </Button>
        }
      >
        <p className="modal__text">{t.restart.body}</p>
        {abandonCounts && (
          <p className="dm-warning" role="note">
            <Icon name="flag" size={18} />
            {t.restart.lossWarning}
          </p>
        )}
        <div className="dm-restart">
          {inRound && (
            <button type="button" className="dm-restart__option" onClick={restartRoundNow}>
              <Icon name="shuffle" size={22} />
              <span>
                <strong>{t.restart.round}</strong>
                <small>{t.restart.roundHint}</small>
              </span>
            </button>
          )}
          <button type="button" className="dm-restart__option" onClick={restartMatchNow}>
            <Icon name="restart" size={22} />
            <span>
              <strong>{t.restart.match}</strong>
              <small>{t.restart.matchHint}</small>
            </span>
          </button>
          <button type="button" className="dm-restart__option" onClick={toSetup}>
            <Icon name="settings" size={22} />
            <span>
              <strong>{t.restart.setup}</strong>
            </span>
          </button>
        </div>
      </Modal>

      {lastRecord && res && !match.over && (
        <Modal
          open={!summaryHidden && dialog === 'none'}
          onClose={() => setSummaryHidden(true)}
          title={roundTitle(lastRecord)}
          size="sm"
          className={lastRecord.winner === null ? 'dm-summary' : `dm-summary dm-summary--seat${lastRecord.winner}`}
          icon={<Icon name={lastRecord.winner === null ? 'swap' : mode === 'ai' && lastRecord.winner === 1 ? 'flag' : 'trophy'} size={22} />}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSummaryHidden(true)}>
                {t.round.viewTable}
              </Button>
              <Button variant="primary" icon="arrowRight" onClick={goNextRound} autoFocus>
                {t.round.next}
              </Button>
            </>
          }
        >
          <p className="dm-summary__reason">{roundReason(lastRecord)}</p>
          {lastRecord.points > 0 && lastRecord.winner !== null && (
            <p className="dm-summary__points tabular">
              {mode === 'ai' && lastRecord.winner === 0 ? t.round.pointsYou(lastRecord.points) : t.round.pointsFor(names[lastRecord.winner], lastRecord.points)}
            </p>
          )}
          <RevealedHands record={lastRecord} names={names} />
          <ScoreLine names={names} scores={match.scores} />
        </Modal>
      )}

      {lastRecord && match.over && (
        <ResultDialog
          open={!summaryHidden && dialog === 'none'}
          tone={matchTone}
          title={matchTitle}
          subtitle={roundReason(lastRecord)}
          newRecord={Boolean(result?.improvedMetrics.includes('bestRound'))}
          onClose={() => setSummaryHidden(true)}
          stats={[
            { label: t.round.score, value: `${fmt.number(match.scores[0])} – ${fmt.number(match.scores[1])}` },
            { label: t.match.rounds, value: fmt.number(match.rounds.length) },
            ...(mode === 'ai' ? [{ label: t.match.bestRound, value: fmt.number(best), record: Boolean(result?.improvedMetrics.includes('bestRound')) }] : []),
            { label: g.time, value: fmt.clock(clock.elapsedMs) },
          ]}
          primary={{ label: g.playAgain, onClick: () => startMatch(match.config) }}
          secondary={{ label: t.match.changeMode, onClick: toSetup }}
        >
          <RevealedHands record={lastRecord} names={names} />
        </ResultDialog>
      )}
    </GameLayout>
  );
}

function ScoreLine({ names, scores }: { names: readonly [string, string]; scores: readonly [number, number] }) {
  const { m, fmt } = useI18n();
  return (
    <div className="dm-scoreline" role="group" aria-label={m.domino.round.score}>
      {([0, 1] as const).map((seat) => (
        <span key={seat} className="dm-scoreline__item">
          <span>{names[seat]}</span>
          <strong className="tabular">{fmt.number(scores[seat])}</strong>
        </span>
      ))}
    </div>
  );
}
