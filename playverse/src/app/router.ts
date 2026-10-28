import { useSyncExternalStore } from 'react';
import { isGameId, type GameId } from '../types/game';

/** Hash-based routes: work on any static host and inside the installed PWA without server config. */
export type Route =
  | { name: 'home' }
  | { name: 'records' }
  | { name: 'stats'; gameId?: GameId }
  | { name: 'favorites' }
  | { name: 'settings' }
  | { name: 'game'; gameId: GameId }
  | { name: 'not-found' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const [first = '', second] = path.split('/');
  switch (first) {
    case '':
      return { name: 'home' };
    case 'records':
      return { name: 'records' };
    case 'favorites':
      return { name: 'favorites' };
    case 'settings':
      return { name: 'settings' };
    case 'stats':
      if (second === undefined) return { name: 'stats' };
      return isGameId(second) ? { name: 'stats', gameId: second } : { name: 'not-found' };
    case 'game':
      return isGameId(second) ? { name: 'game', gameId: second } : { name: 'not-found' };
    default:
      return { name: 'not-found' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'records':
      return '#/records';
    case 'favorites':
      return '#/favorites';
    case 'settings':
      return '#/settings';
    case 'stats':
      return route.gameId ? `#/stats/${route.gameId}` : '#/stats';
    case 'game':
      return `#/game/${route.gameId}`;
    case 'not-found':
      return '#/';
  }
}

export const href = routeToHash;

/**
 * In-app history stack, kept in sync with hash changes (links, navigate(), browser back).
 * Lets the back button return to the previous screen without leaving the app.
 */
const stack: string[] = typeof window !== 'undefined' ? [window.location.hash || '#/'] : [];

function trackHash(): void {
  const hash = window.location.hash || '#/';
  if (stack.length >= 2 && stack[stack.length - 2] === hash) stack.pop();
  else if (stack[stack.length - 1] !== hash) stack.push(hash);
}

if (typeof window !== 'undefined') window.addEventListener('hashchange', trackHash);

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseHash(hash);
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const target = routeToHash(route);
  if (options.replace) {
    window.history.replaceState(window.history.state, '', target);
    stack[stack.length - 1] = target;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

/** Goes back within the app when possible, otherwise to `fallback` (home by default). */
export function goBack(fallback: Route = { name: 'home' }): void {
  if (stack.length >= 2) window.history.back();
  else navigate(fallback, { replace: true });
}
