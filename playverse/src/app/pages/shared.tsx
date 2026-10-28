import type { CSSProperties, ReactNode } from 'react';
import { GameIcon } from '../../components/brand/GameIcon';
import { Crown } from '../../components/brand/Crown';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/Button';
import { LanguageSelect } from '../../components/LanguageSelect';
import { href, goBack, navigate } from '../router';
import { useI18n } from '../../i18n';
import { avatarEmoji, toggleFavorite, useProfile } from '../../services/profile';
import { formatMetric, headlineMetric } from '../../services/gameData';
import type { GameData, GameMeta } from '../../games/types';

/** Home/tab header: avatar, greeting, records counter, language pill and settings. */
export function AppHeader({ recordsCount, level }: { recordsCount: number; level?: number }) {
  const { m } = useI18n();
  const profile = useProfile();
  const name = profile.name.trim() || m.common.settings.defaultPlayerName;
  return (
    <header className="app-header">
      <a className="app-header__profile" href={href({ name: 'settings' })} aria-label={`${m.common.settings.profile}: ${name}`}>
        <span className="avatar" aria-hidden="true">
          <span className="avatar__emoji">{avatarEmoji(profile.avatar)}</span>
          {level !== undefined && <span className="avatar__level tabular">{level}</span>}
        </span>
        <span className="app-header__hello">
          <span className="app-header__greeting">{m.common.home.greeting(name)}</span>
          {level !== undefined && <span className="visually-hidden">{m.common.home.playerLevel(level)}</span>}
          <span className="app-header__records">
            <Icon name="chart" size={14} strokeWidth={2.6} />
            {m.common.home.recordsCount(recordsCount)}
          </span>
        </span>
      </a>
      <div className="app-header__actions">
        <LanguageSelect />
        <IconButton icon="settings" label={m.common.nav.settings} onClick={() => navigate({ name: 'settings' })} />
      </div>
    </header>
  );
}

/** Header for secondary pages (title + optional back button). */
export function PageTopBar({ title, subtitle, back = false, actions }: { title: string; subtitle?: string; back?: boolean; actions?: ReactNode }) {
  const { m } = useI18n();
  return (
    <header className="page-topbar">
      {back && <IconButton icon="back" label={m.common.nav.back} onClick={() => goBack()} />}
      <div className="page-topbar__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-topbar__actions">{actions}</div>
    </header>
  );
}

export function gameStyle(meta: GameMeta): CSSProperties {
  return { '--card-tint': `var(--g-${meta.id})` } as CSSProperties;
}

/** Catalogue card: illustration, name and headline record; whole card opens the game. */
export function GameCard({ meta, data }: { meta: GameMeta; data: GameData }) {
  const { m, fmt } = useI18n();
  const profile = useProfile();
  const name = m.common.games[meta.id].name;
  const headline = headlineMetric(meta);
  const value = headline ? headline.value(data) : null;
  const favorite = profile.favorites.includes(meta.id);
  return (
    <article className="game-card" style={gameStyle(meta)}>
      <a className="game-card__link" href={href({ name: 'game', gameId: meta.id })} aria-label={m.common.home.playGame(name)}>
        <span className="game-card__art">
          <GameIcon id={meta.id} size={60} />
        </span>
        <span className="game-card__name">{name}</span>
        <span className="game-card__record">
          {value !== null && headline ? (
            <>
              <Crown size={16} />
              <span className="tabular" aria-label={`${headline.label(m)}: ${formatMetric(headline, value, fmt)}`}>
                {formatMetric(headline, value, fmt)}
              </span>
            </>
          ) : (
            <span className="game-card__new">{m.common.home.newGameBadge}</span>
          )}
        </span>
      </a>
      <button
        type="button"
        className={favorite ? 'game-card__fav is-on' : 'game-card__fav'}
        aria-pressed={favorite}
        aria-label={favorite ? m.common.home.removeFavorite(name) : m.common.home.addFavorite(name)}
        onClick={() => toggleFavorite(meta.id)}
      >
        <Icon name="heart" size={16} filled={favorite} />
      </button>
    </article>
  );
}

export function GameGrid({ metas, data }: { metas: readonly GameMeta[]; data: readonly GameData[] }) {
  return (
    <div className="game-grid">
      {metas.map((meta, i) => {
        const d = data[i];
        return d ? <GameCard key={meta.id} meta={meta} data={d} /> : null;
      })}
    </div>
  );
}

export function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <p>{text}</p>
      {action}
    </div>
  );
}
