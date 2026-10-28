import { createStore, useStore } from '../services/store';
import { toast } from '../components/Toast';
import { isNativeApp } from './native';

/** Install prompt support (Chromium/Android) and service worker registration (production only). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installEvent = createStore<BeforeInstallPromptEvent | null>(null);

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
}

export function isIos(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const event = useStore(installEvent);
  return {
    canInstall: event !== null,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      installEvent.set(null);
    },
  };
}

export function registerServiceWorker(updateMessage: () => string): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent.set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => installEvent.set(null));

  // Inside the Android app the files are already bundled locally: no service worker needed.
  if (!import.meta.env.PROD || isNativeApp() || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast(updateMessage(), { tone: 'info', duration: 8000 });
    });
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('[PlayVerse] service worker registration failed', error);
    });
  });
}
