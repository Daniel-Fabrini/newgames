import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { ThemeController } from './ThemeController';
import { ErrorBoundary } from './ErrorBoundary';
import { BottomNav } from './BottomNav';
import { useRoute, navigate, type Route } from './router';
import { HomePage } from './pages/HomePage';
import { RecordsPage } from './pages/RecordsPage';
import { StatsPage } from './pages/StatsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SettingsPage } from './pages/SettingsPage';
import { GamePage } from './pages/GamePage';
import { ToastHost, toast } from '../components/Toast';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { onStorageIssue } from '../services/storage/storage';
import { EMBED, postExit } from './embed';

function StorageWatcher() {
  const { m } = useI18n();
  useEffect(
    () =>
      onStorageIssue((issue) => {
        if (issue.reason === 'write-failed') toast(m.common.errors.storageWriteFailed, { tone: 'error', duration: 5000 });
        else toast(m.common.errors.storageRecovered, { tone: 'warning', duration: 5000 });
      }),
    [m],
  );
  return null;
}

function tabOf(route: Route) {
  switch (route.name) {
    case 'home':
      return 'home' as const;
    case 'records':
      return 'records' as const;
    case 'stats':
      return 'stats' as const;
    case 'favorites':
      return 'favorites' as const;
    default:
      return null;
  }
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'records':
      return <RecordsPage />;
    case 'stats':
      return <StatsPage gameId={route.gameId} />;
    case 'favorites':
      return <FavoritesPage />;
    case 'settings':
      return <SettingsPage />;
    case 'game':
      return <GamePage gameId={route.gameId} />;
    case 'not-found':
      return <NotFound />;
  }
}

function NotFound() {
  const { m } = useI18n();
  return (
    <div className="page-center">
      <Icon name="info" size={40} />
      <p>{m.common.errors.notFound}</p>
      <Button onClick={() => navigate({ name: 'home' }, { replace: true })} icon="home">
        {m.common.nav.home}
      </Button>
    </div>
  );
}

/** Embed mode (inside DA Games): only the game page, no home, bottom nav or skip link. */
function EmbedShell() {
  const route = useRoute();
  useEffect(() => {
    if (route.name !== 'game') postExit();
  }, [route.name]);
  const routeKey = route.name === 'game' ? route.gameId : 'none';
  return (
    <>
      <ErrorBoundary
        resetKey={routeKey}
        fallback={(reset) => (
          <div className="page-center" role="alert">
            <Icon name="info" size={40} />
            <Button onClick={reset} icon="restart">
              Retry
            </Button>
          </div>
        )}
      >
        {route.name === 'game' && (
          <div className="app-shell">
            <GamePage gameId={route.gameId} />
          </div>
        )}
      </ErrorBoundary>
      <ToastHost />
    </>
  );
}

function Shell() {
  const route = useRoute();
  const { m } = useI18n();
  const tab = tabOf(route);
  const routeKey = route.name === 'game' ? `game:${route.gameId}` : route.name;

  useEffect(() => {
    if (route.name !== 'game') window.scrollTo({ top: 0 });
  }, [routeKey, route.name]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        {m.common.nav.skipToContent}
      </a>
      <ErrorBoundary
        resetKey={routeKey}
        fallback={(reset) => (
          <div className="page-center" role="alert">
            <Icon name="info" size={40} />
            <h1>{m.common.errors.title}</h1>
            <p>{m.common.errors.body}</p>
            <div className="row-gap">
              <Button onClick={reset} icon="restart">
                {m.common.errors.retry}
              </Button>
              <Button variant="secondary" icon="home" onClick={() => navigate({ name: 'home' }, { replace: true })}>
                {m.common.nav.home}
              </Button>
            </div>
          </div>
        )}
      >
        {route.name === 'game' ? (
          <div className="app-shell">
            <Screen route={route} />
          </div>
        ) : (
          <main id="main" tabIndex={-1} className={tab ? 'app-shell has-bottom-nav' : 'app-shell'}>
            <Screen route={route} />
          </main>
        )}
      </ErrorBoundary>
      {tab && <BottomNav active={tab} />}
      <ToastHost />
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <ThemeController />
      <StorageWatcher />
      {EMBED ? <EmbedShell /> : <Shell />}
    </I18nProvider>
  );
}
