import { GAMES, GAME_META } from '../../games/registry';
import { useGameData } from '../../services/gameData';
import { useProfile } from '../../services/profile';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { EmptyState, GameGrid, PageTopBar } from './shared';
import { href } from '../router';

export function FavoritesPage() {
  const { m } = useI18n();
  const profile = useProfile();
  const metas = GAMES.filter((g) => profile.favorites.includes(g.id));
  const data = useGameData(GAMES);
  const favData = metas.map((meta) => data[GAMES.indexOf(GAME_META[meta.id])]!);
  return (
    <div className="page">
      <PageTopBar title={m.common.favorites.title} subtitle={m.common.favorites.subtitle} />
      {metas.length === 0 ? (
        <EmptyState
          icon={<Icon name="heart" size={44} />}
          text={m.common.favorites.empty}
          action={
            <a className="btn btn--primary btn--md" href={href({ name: 'home' })}>
              <span className="btn__label">{m.common.favorites.browse}</span>
            </a>
          }
        />
      ) : (
        <GameGrid metas={metas} data={favData} />
      )}
    </div>
  );
}
