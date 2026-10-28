import { Icon, type IconName } from '../components/Icon';
import { href, type Route } from './router';
import { useI18n } from '../i18n';

type TabName = 'home' | 'records' | 'stats' | 'favorites';

const TABS: { name: TabName; icon: IconName; route: Route }[] = [
  { name: 'home', icon: 'home', route: { name: 'home' } },
  { name: 'records', icon: 'trophy', route: { name: 'records' } },
  { name: 'stats', icon: 'chart', route: { name: 'stats' } },
  { name: 'favorites', icon: 'heart', route: { name: 'favorites' } },
];

export function BottomNav({ active }: { active: TabName | null }) {
  const { m } = useI18n();
  const labels: Record<TabName, string> = {
    home: m.common.nav.home,
    records: m.common.nav.records,
    stats: m.common.nav.stats,
    favorites: m.common.nav.favorites,
  };
  return (
    <nav className="bottom-nav" aria-label={m.common.nav.mainNavigation}>
      <ul>
        {TABS.map((tab) => {
          const isActive = tab.name === active;
          return (
            <li key={tab.name}>
              <a href={href(tab.route)} className={isActive ? 'bottom-nav__link is-active' : 'bottom-nav__link'} aria-current={isActive ? 'page' : undefined}>
                <Icon name={tab.icon} size={24} filled={isActive && (tab.icon === 'heart' || tab.icon === 'home')} />
                <span>{labels[tab.name]}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
