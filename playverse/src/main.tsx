import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { EMBED } from './app/embed';
import { registerServiceWorker } from './app/pwa';
import { dictionaries } from './i18n';
import { settingsStore } from './services/settings';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/app.css';
import './styles/embed.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Embedded in DA Games: no service worker (the host app caches everything) and no install prompt.
if (!EMBED) registerServiceWorker(() => dictionaries[settingsStore.get().locale].common.pwa.updateReady);
