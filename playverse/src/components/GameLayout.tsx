import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { GameIcon } from './brand/GameIcon';
import { Crown } from './brand/Crown';
import { goBack } from '../app/router';
import { EMBED, requestBack } from '../app/embed';
import { useI18n } from '../i18n';
import type { GameId } from '../types/game';

export interface GameStat {
  label: string;
  value: ReactNode;
  /** Shows a crown (records) or an icon next to the label. */
  icon?: IconName | 'crown';
  /** Emphasise (e.g. current score). */
  primary?: boolean;
  /** Accessible text when `value` is not plain text. */
  ariaValue?: string;
}

export interface GameLayoutProps {
  gameId: GameId;
  /** Overrides the localized game name. */
  title?: string;
  subtitle?: ReactNode;
  stats?: GameStat[];
  onPause?: () => void;
  onHelp?: () => void;
  /** Extra header buttons (rendered before help/pause). */
  actions?: ReactNode;
  /** Bottom toolbar (undo, hint, restart…). */
  toolbar?: ReactNode;
  /** Called by the back button; defaults to returning to the previous screen. */
  onExit?: () => void;
  children: ReactNode;
  className?: string;
  /** Width / height ratio of the main board, used by `.board-fit` to size it without cropping. */
  boardAspect?: number;
}

/**
 * Shared full-screen game shell: top bar (back, title, help, pause), stats strip, a stage that
 * sizes the board to the available space (never cropped), and an optional bottom toolbar.
 */
export function GameLayout({ gameId, title, subtitle, stats, onPause, onHelp, actions, toolbar, onExit, children, className, boardAspect = 1 }: GameLayoutProps) {
  const { m } = useI18n();
  const name = title ?? m.common.games[gameId].name;
  const style = { '--game-accent': `var(--g-${gameId})`, '--board-aspect': String(boardAspect) } as CSSProperties;
  return (
    <div className={['game-screen', className].filter(Boolean).join(' ')} data-game={gameId} style={style}>
      <header className="game-topbar">
        <IconButton icon="back" label={m.common.nav.back} onClick={() => (onExit ? onExit() : EMBED ? requestBack() : goBack())} />
        <div className="game-topbar__title">
          <GameIcon id={gameId} size={30} className="game-topbar__icon" />
          <div className="game-topbar__text">
            <h1>{name}</h1>
            {subtitle && <p className="game-topbar__subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="game-topbar__actions">
          {actions}
          {onHelp && <IconButton icon="help" label={m.common.game.help} onClick={onHelp} />}
          {onPause && <IconButton icon="pause" label={m.common.game.pause} onClick={onPause} />}
        </div>
      </header>
      {stats && stats.length > 0 && (
        <section className="game-stats" aria-label={m.common.game.stats}>
          {stats.map((s) => (
            <div key={s.label} className={s.primary ? 'stat-pill is-primary' : 'stat-pill'}>
              <span className="stat-pill__label">
                {s.icon === 'crown' ? <Crown size={14} /> : s.icon ? <Icon name={s.icon} size={14} /> : null}
                {s.label}
              </span>
              <span className="stat-pill__value tabular" aria-label={s.ariaValue}>
                {s.value}
              </span>
            </div>
          ))}
        </section>
      )}
      <main id="main" className="game-stage">
        {children}
      </main>
      {toolbar && <div className="game-toolbar">{toolbar}</div>}
    </div>
  );
}

export interface ToolButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: ReactNode;
  active?: boolean;
  /** Accessible description beyond the label (e.g. "3 hints left"). */
  description?: string;
}

/** Large icon + label action for the bottom game toolbar. */
export function ToolButton({ icon, label, onClick, disabled, badge, active, description }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'tool-btn is-active' : 'tool-btn'}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={description ? `${label}, ${description}` : undefined}
    >
      <span className="tool-btn__icon">
        <Icon name={icon} size={24} />
        {badge !== undefined && badge !== null && (
          <span className="tool-btn__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </span>
      <span className="tool-btn__label">{label}</span>
    </button>
  );
}

export interface GameSetupProps {
  gameId: GameId;
  /** Text under the title; defaults to the catalogue description. */
  description?: string;
  /** Options (mode, difficulty…) rendered inside a card. */
  children?: ReactNode;
  /** Primary/secondary buttons. */
  actions: ReactNode;
}

/** Pre-game screen for games with modes or difficulty levels (rendered inside GameLayout). */
export function GameSetup({ gameId, description, children, actions }: GameSetupProps) {
  const { m } = useI18n();
  return (
    <div className="setup">
      <div className="setup__hero">
        <GameIcon id={gameId} size={88} />
        <h2>{m.common.games[gameId].name}</h2>
        <p>{description ?? m.common.games[gameId].short}</p>
      </div>
      {children && <div className="setup__card">{children}</div>}
      <div className="setup__actions">{actions}</div>
    </div>
  );
}
