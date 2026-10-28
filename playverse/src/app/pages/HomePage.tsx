import { useMemo, useState } from 'react';
import { Logo } from '../../components/brand/Logo';
import { GameIcon } from '../../components/brand/GameIcon';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { GAMES, GAME_META } from '../../games/registry';
import { collectRecords, computeXp, formatMetric, hasAnySave, headlineMetric, levelForXp, useGameData } from '../../services/gameData';
import { useProfile } from '../../services/profile';
import { CATEGORIES, type Category } from '../../types/game';
import { href } from '../router';
import { AppHeader, GameGrid, gameStyle } from './shared';
import type { GameData, GameMeta } from '../../games/types';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function HomePage() {
  const { m } = useI18n();
  const h = m.common.home;
  const profile = useProfile();
  const data = useGameData(GAMES);
  const records = collectRecords(GAMES, data);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    const q = normalize(query);
    return GAMES.filter((meta) => {
      if (category !== 'all' && !meta.categories.includes(category)) return false;
      if (!q) return true;
      const haystack = [m.common.games[meta.id].name, m.common.games[meta.id].short, ...meta.categories.map((c) => m.common.categories[c])]
        .map(normalize)
        .join(' ');
      return haystack.includes(q);
    });
  }, [query, category, m]);

  const filteredData = filtered.map((meta) => data[GAMES.indexOf(meta)]!);
  const last = profile.recent[0];
  const lastMeta = last ? GAME_META[last.id] : undefined;
  const recent = profile.recent.slice(1, 6).map((r) => GAME_META[r.id]);
  const favorites = GAMES.filter((g) => profile.favorites.includes(g.id));

  return (
    <div className="page home">
      <AppHeader recordsCount={records.length} level={levelForXp(computeXp(data)).level} />

      <section className="hero" aria-label={m.common.app.tagline}>
        <HeroDecor />
        <h1 className="hero__title">
          <Logo className="hero__logo" />
        </h1>
        <p className="hero__tagline">{m.common.app.tagline}</p>
      </section>

      {lastMeta && last && <ContinueCard meta={lastMeta} at={last.at} data={data[GAMES.indexOf(lastMeta)]!} />}

      <div className="home-tools">
        <label className="search">
          <Icon name="search" size={20} />
          <span className="visually-hidden">{h.searchLabel}</span>
          <input type="search" value={query} placeholder={h.searchPlaceholder} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
          {query && (
            <button type="button" className="search__clear" aria-label={h.clearSearch} onClick={() => setQuery('')}>
              <Icon name="close" size={18} />
            </button>
          )}
        </label>
        <div className="chips" role="group" aria-label={h.categoriesLabel}>
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" className={category === c ? 'chip is-active' : 'chip'} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {m.common.categories[c]}
            </button>
          ))}
        </div>
      </div>

      <section className="home-section" aria-labelledby="all-games-title">
        <h2 id="all-games-title" className="section-title">
          {h.sections.all}
          <span className="section-title__count">{h.gamesAvailable(GAMES.length)}</span>
        </h2>
        {filtered.length > 0 ? <GameGrid metas={filtered} data={filteredData} /> : <p className="muted center">{h.noResults(query)}</p>}
      </section>

      {favorites.length > 0 && <ChipRow id="favorites-title" title={h.sections.favorites} metas={favorites} />}
      {recent.length > 0 && <ChipRow id="recent-title" title={h.sections.recent} metas={recent} />}

      <p className="home-footer">
        {m.common.app.name} · by <strong>Daniel Aleixo</strong>
      </p>
    </div>
  );
}

function ChipRow({ id, title, metas }: { id: string; title: string; metas: readonly GameMeta[] }) {
  const { m } = useI18n();
  return (
    <section className="home-section" aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      <ul className="recent-row">
        {metas.map((meta) => (
          <li key={meta.id}>
            <a className="recent-chip" href={href({ name: 'game', gameId: meta.id })} style={gameStyle(meta)}>
              <GameIcon id={meta.id} size={28} />
              <span>{m.common.games[meta.id].name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContinueCard({ meta, at, data }: { meta: GameMeta; at: number; data: GameData }) {
  const { m, fmt } = useI18n();
  const name = m.common.games[meta.id].name;
  const headline = headlineMetric(meta);
  const value = headline ? headline.value(data) : null;
  const saved = hasAnySave(meta);
  return (
    <a className="continue-card" href={href({ name: 'game', gameId: meta.id })} style={gameStyle(meta)}>
      <span className="continue-card__trophy" aria-hidden="true">
        <Icon name="trophy" size={26} />
      </span>
      <span className="continue-card__art" aria-hidden="true">
        <GameIcon id={meta.id} size={44} />
      </span>
      <span className="continue-card__text">
        <span className="continue-card__kicker">{m.common.home.continuePlaying}</span>
        <span className="continue-card__name">{name}</span>
        <span className="continue-card__meta">
          {value !== null && headline ? `${headline.label(m)}: ${formatMetric(headline, value, fmt)}` : saved ? m.common.home.continueSaved : m.common.home.lastPlayed(fmt.relative(at))}
        </span>
      </span>
      <span className="continue-card__go" aria-hidden="true">
        <Icon name="arrowRight" size={22} />
      </span>
    </a>
  );
}

/** Decorative gems and sparkles around the logo (hidden from assistive tech). */
function HeroDecor() {
  return (
    <div className="hero__decor" aria-hidden="true">
      <svg className="gem gem--left" viewBox="0 0 40 40">
        <path d="M8 14 20 4l12 10-12 22z" fill="#6d4bff" />
        <path d="M8 14h24L20 36z" fill="#4c2fd6" />
        <path d="M14 14 20 4l6 10z" fill="#9b85ff" />
      </svg>
      <svg className="gem gem--right" viewBox="0 0 40 40">
        <path d="M6 16 16 5h12l8 11-16 20z" fill="#7c3aed" />
        <path d="M6 16h30L20 36z" fill="#5b21b6" />
        <path d="M16 5h12l-6 11z" fill="#c4b5fd" />
      </svg>
      <svg className="gem gem--star" viewBox="0 0 40 40">
        <path d="m20 3 5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L20 30.1 9.4 35.7l2-11.8-8.6-8.4 11.9-1.7z" fill="#ffc83d" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      {[
        [8, 22],
        [90, 18],
        [20, 70],
        [82, 64],
        [52, 8],
        [70, 36],
      ].map(([x, y], i) => (
        <span key={i} className="sparkle" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
    </div>
  );
}
