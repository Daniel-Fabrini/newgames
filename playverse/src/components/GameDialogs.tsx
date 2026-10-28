import { useMemo, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';
import { Switch } from './Controls';
import { LanguageSelect } from './LanguageSelect';
import { Crown } from './brand/Crown';
import { useI18n } from '../i18n';
import { updateSettings, useSettings } from '../services/settings';
import { supportsVibration } from '../services/feedback';
import { goBack } from '../app/router';
import { EMBED } from '../app/embed';
import { useReducedMotion } from '../hooks/useMediaQuery';

interface PauseMenuProps {
  open: boolean;
  onResume: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
  onExit?: () => void;
  /** Extra content (e.g. mode/difficulty info). */
  children?: ReactNode;
  title?: string;
}

/**
 * Pause menu with resume/restart/help/exit and quick settings (language, sound, vibration).
 * Changing the language here swaps texts in place: the game state is untouched.
 */
export function PauseMenu({ open, onResume, onRestart, onHelp, onExit, children, title }: PauseMenuProps) {
  const { m } = useI18n();
  const g = m.common.game;
  const settings = useSettings();
  return (
    <Modal open={open} onClose={onResume} title={title ?? g.paused} size="sm" icon={<Icon name="pause" size={22} />}>
      <div className="pause-menu">
        <Button variant="primary" size="lg" icon="play" block onClick={onResume} autoFocus>
          {g.resume}
        </Button>
        {onRestart && (
          <Button variant="secondary" size="lg" icon="restart" block onClick={onRestart}>
            {g.restart}
          </Button>
        )}
        {onHelp && (
          <Button variant="secondary" size="lg" icon="help" block onClick={onHelp}>
            {g.howToPlay}
          </Button>
        )}
        <Button variant="ghost" size="lg" icon="home" block onClick={() => (onExit ? onExit() : goBack())}>
          {g.exitToHome}
        </Button>
        {children}
        {!EMBED && (
          <section className="pause-menu__settings" aria-label={g.quickSettings}>
            <div className="pause-menu__row">
              <span className="pause-menu__label">
                <Icon name="globe" size={18} /> {m.common.settings.language}
              </span>
              <LanguageSelect />
            </div>
            <Switch
              checked={settings.sound}
              onChange={(sound) => updateSettings({ sound })}
              label={m.common.settings.sound}
              icon={<Icon name={settings.sound ? 'volume' : 'volumeOff'} size={18} />}
            />
            {supportsVibration() && (
              <Switch
                checked={settings.haptics}
                onChange={(haptics) => updateSettings({ haptics })}
                label={m.common.settings.haptics}
                icon={<Icon name="vibrate" size={18} />}
              />
            )}
          </section>
        )}
        <p className="pause-menu__note">{g.savedAutomatically}</p>
      </div>
    </Modal>
  );
}

export interface ResultStat {
  label: string;
  value: ReactNode;
  /** Highlights the row as a new record. */
  record?: boolean;
}

interface ResultDialogProps {
  open: boolean;
  tone: 'win' | 'loss' | 'draw' | 'neutral';
  title: string;
  subtitle?: ReactNode;
  stats?: ResultStat[];
  newRecord?: boolean;
  /** 0–3 stars for level-based games. */
  stars?: number;
  primary: { label: string; onClick: () => void; icon?: 'restart' | 'arrowRight' | 'play' };
  secondary?: { label: string; onClick: () => void };
  /** Shown as a ghost "back to home" button unless false. */
  showHome?: boolean;
  /** Optional close (e.g. to look at the final board). */
  onClose?: () => void;
  children?: ReactNode;
}

export function ResultDialog({ open, tone, title, subtitle, stats, newRecord, stars, primary, secondary, showHome = true, onClose, children }: ResultDialogProps) {
  const { m } = useI18n();
  const reduced = useReducedMotion();
  const icon = tone === 'win' ? <Icon name="trophy" size={34} /> : tone === 'loss' ? <Icon name="flag" size={30} /> : tone === 'draw' ? <Icon name="swap" size={30} /> : <Icon name="star" size={30} />;
  return (
    <Modal open={open} onClose={onClose ?? (() => undefined)} dismissible={Boolean(onClose)} title={title} size="sm" className={`result result--${tone}`} hideClose={!onClose}>
      {tone === 'win' && !reduced && <Confetti />}
      <div className="result__hero">
        <div className="result__badge">{icon}</div>
        {newRecord && (
          <div className="result__record" role="status">
            <Crown size={18} /> {m.common.game.newRecord}
          </div>
        )}
        {stars !== undefined && (
          <div className="result__stars" role="img" aria-label={m.common.game.starsOf(stars, 3)}>
            {[0, 1, 2].map((i) => (
              <Icon key={i} name="star" size={34} filled={i < stars} className={i < stars ? 'is-on' : ''} />
            ))}
          </div>
        )}
        {subtitle && <p className="result__subtitle">{subtitle}</p>}
      </div>
      {stats && stats.length > 0 && (
        <dl className="result__stats">
          {stats.map((s) => (
            <div key={s.label} className={s.record ? 'result__stat is-record' : 'result__stat'}>
              <dt>{s.label}</dt>
              <dd className="tabular">
                {s.record && <Crown size={14} />} {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      <div className="result__actions">
        <Button variant={tone === 'win' ? 'gold' : 'primary'} size="lg" block icon={primary.icon ?? 'restart'} onClick={primary.onClick} autoFocus>
          {primary.label}
        </Button>
        {secondary && (
          <Button variant="secondary" size="lg" block onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        {showHome && (
          <Button variant="ghost" size="md" block icon="home" onClick={() => goBack()}>
            {m.common.game.exitToHome}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 7) * 0.12,
        hue: ['#ffc83d', '#3d7bff', '#22c55e', '#f43f5e', '#a855f7'][i % 5],
        rot: (i * 53) % 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, background: p.hue, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

export interface HelpSection {
  title: string;
  items: readonly string[];
}

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  intro?: string;
  sections: readonly HelpSection[];
}

/** Rules/instructions dialog. Content comes from each game's translation file. */
export function HelpDialog({ open, onClose, title, intro, sections }: HelpDialogProps) {
  const { m } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title ?? m.common.game.howToPlay} size="md" icon={<Icon name="help" size={22} />}>
      <div className="help">
        {intro && <p className="help__intro">{intro}</p>}
        {sections.map((s) => (
          <section key={s.title} className="help__section">
            <h3>{s.title}</h3>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="help__footer">
        <Button variant="primary" block onClick={onClose}>
          {m.common.nav.close}
        </Button>
      </div>
    </Modal>
  );
}
