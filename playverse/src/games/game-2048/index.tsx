import { useCallback, useState } from 'react';
import { GameLayout, ToolButton } from '../../components/GameLayout';
import { HelpDialog, PauseMenu, ResultDialog } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { IconButton } from '../../components/Button';
import { announce } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useStopwatch } from '../../hooks/useStopwatch';
import { feedback } from '../../services/feedback';
import { loadGame, useAutosave } from '../../services/saves';
import { recordMatch, useGameStats, type RecordResult } from '../../services/stats';
import { randomSeed } from '../../utils/random';
import { Board } from './Board';
import { canUndo, continueAfterWin, maxTile, move, newGame, undo, type Direction, type GameState } from './engine';
import { saveSpec } from './save';
import { meta } from './meta';
import './game-2048.css';

type Dialog = 'none' | 'pause' | 'help' | 'restart' | 'won' | 'over';

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

function initial(): { game: GameState; elapsedMs: number } {
  const saved = loadGame(saveSpec);
  if (saved && !saved.game.over) return saved;
  return { game: newGame(randomSeed()), elapsedMs: 0 };
}

export default function Game2048() {
  const { m, fmt } = useI18n();
  const g = m.common.game;
  const t = m.game2048;
  const stats = useGameStats('game-2048');
  const [boot] = useState(initial);
  const [game, setGame] = useState<GameState>(boot.game);
  const [dialog, setDialog] = useState<Dialog>(boot.game.won && !boot.game.keepPlaying ? 'won' : 'none');
  const [result, setResult] = useState<RecordResult | null>(null);
  const playing = dialog === 'none' && !game.over;
  const clock = useStopwatch(playing && game.moves > 0, boot.elapsedMs);

  // Finished games are not saved: the next visit starts a fresh board.
  useAutosave(saveSpec, game.over ? null : { game, elapsedMs: clock.getElapsed() });

  const finish = useCallback(
    (state: GameState) => {
      const res = recordMatch(
        'game-2048',
        {
          outcome: state.won ? 'win' : 'ended',
          score: state.score,
          durationMs: clock.getElapsed(),
          metrics: { bestTile: maxTile(state.tiles), moves: state.moves },
        },
        meta.metricRules,
      );
      setResult(res);
      return res;
    },
    [clock],
  );

  const doMove = useCallback(
    (direction: Direction) => {
      if (!playing) return;
      const outcome = move(game, direction);
      if (!outcome.moved) {
        feedback('error');
        return;
      }
      setGame(outcome.state);
      feedback(outcome.gained > 0 ? 'merge' : 'move');
      announce(t.movedAnnouncement(outcome.state.score));
      if (outcome.justWon) {
        feedback('win');
        setDialog('won');
      } else if (outcome.state.over) {
        finish(outcome.state);
        feedback('lose');
        setDialog('over');
      }
    },
    [game, playing, finish, t],
  );

  const startNew = useCallback(() => {
    setGame(newGame(randomSeed()));
    clock.reset(0);
    setResult(null);
    setDialog('none');
  }, [clock]);

  const requestRestart = () => {
    if (game.moves > 0 && !game.over) setDialog('restart');
    else startNew();
  };

  const confirmRestart = () => {
    finish(game);
    startNew();
  };

  const doUndo = () => {
    if (!canUndo(game) || !playing) return;
    setGame(undo(game));
    feedback('undo');
  };

  useKeyboard((e) => {
    const dir = KEY_DIRECTIONS[e.key] ?? KEY_DIRECTIONS[e.key.toLowerCase()];
    if (dir) {
      doMove(dir);
      return true;
    }
    if (e.key === 'u' || e.key === 'U' || e.key === 'Backspace') {
      doUndo();
      return true;
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      setDialog('pause');
      return true;
    }
    return false;
  }, dialog === 'none');

  const best = Math.max(stats.bestScore ?? 0, game.score);
  const tile = maxTile(game.tiles);

  return (
    <GameLayout
      gameId="game-2048"
      onPause={() => setDialog('pause')}
      onHelp={() => setDialog('help')}
      stats={[
        { label: g.score, value: fmt.number(game.score), primary: true },
        { label: g.best, value: fmt.number(best), icon: 'crown' },
        { label: t.bestTile, value: fmt.number(tile, { useGrouping: false }) },
      ]}
      toolbar={
        <>
          <ToolButton icon="undo" label={g.undo} onClick={doUndo} disabled={!canUndo(game) || !playing} badge={game.undo.length || undefined} description={t.undoLimit(game.undo.length)} />
          <ToolButton icon="restart" label={g.newGame} onClick={requestRestart} />
        </>
      }
    >
      <div className="t48-wrap">
        <Board tiles={game.tiles} ghosts={game.ghosts} onMove={doMove} disabled={!playing} />
        <div className="t48-dpad" role="group" aria-label={t.directionsLabel}>
          <IconButton icon="arrowLeft" label={t.directions.left} onClick={() => doMove('left')} disabled={!playing} />
          <IconButton icon="arrowUp" label={t.directions.up} onClick={() => doMove('up')} disabled={!playing} />
          <IconButton icon="arrowDown" label={t.directions.down} onClick={() => doMove('down')} disabled={!playing} />
          <IconButton icon="arrowRight" label={t.directions.right} onClick={() => doMove('right')} disabled={!playing} />
        </div>
      </div>

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
        open={dialog === 'won'}
        tone="win"
        title={t.reachedTitle}
        subtitle={t.reachedBody}
        stats={[
          { label: g.score, value: fmt.number(game.score) },
          { label: g.moves, value: fmt.number(game.moves) },
        ]}
        primary={{
          label: g.keepPlaying,
          icon: 'play',
          onClick: () => {
            setGame(continueAfterWin(game));
            setDialog('none');
          },
        }}
        secondary={{
          label: g.newGame,
          onClick: () => {
            finish(game);
            startNew();
          },
        }}
      />
      <ResultDialog
        open={dialog === 'over'}
        tone={game.won ? 'win' : 'neutral'}
        title={g.gameOver}
        subtitle={t.overBody}
        newRecord={result?.isNewBestScore}
        stats={[
          { label: g.score, value: fmt.number(game.score), record: result?.isNewBestScore },
          { label: t.bestTile, value: fmt.number(tile, { useGrouping: false }), record: result?.improvedMetrics.includes('bestTile') },
          { label: g.moves, value: fmt.number(game.moves) },
          { label: g.time, value: fmt.clock(clock.elapsedMs) },
        ]}
        primary={{ label: g.playAgain, onClick: startNew }}
      />
    </GameLayout>
  );
}
