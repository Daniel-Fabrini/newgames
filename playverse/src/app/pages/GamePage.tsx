import { Suspense, useEffect } from 'react';
import { GAME_COMPONENTS } from '../../games/registry';
import { markPlayed } from '../../services/profile';
import { Spinner } from '../../components/Controls';
import { useI18n } from '../../i18n';
import type { GameId } from '../../types/game';

export function GamePage({ gameId }: { gameId: GameId }) {
  const { m } = useI18n();
  const Game = GAME_COMPONENTS[gameId];
  useEffect(() => {
    markPlayed(gameId);
    const prev = document.title;
    document.title = `${m.common.games[gameId].name} · PlayVerse`;
    return () => {
      document.title = prev;
    };
  }, [gameId, m]);
  return (
    <Suspense
      fallback={
        <div className="page-center">
          <Spinner label={m.common.game.loading} />
        </div>
      }
    >
      <Game />
    </Suspense>
  );
}
