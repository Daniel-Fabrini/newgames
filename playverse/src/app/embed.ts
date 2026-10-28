import { useEffect, useRef } from 'react';
import { isLocale, type Locale } from '../i18n/locales';

/**
 * Embed mode: PlayVerse runs inside an iframe of the DA Games shell.
 *
 *   index.html?embed=1&lang=pt|en|es[&sound=0][&haptics=0][&mode=<hint>]#/game/<id>
 *
 * In embed mode only the game page is rendered (no home, bottom nav, brand hero, language chip),
 * no service worker is registered, nothing about the language/sound is persisted, and the page talks
 * to the parent window through `postMessage`:
 *
 *   child → parent  { type: 'pv-exit' }                                  leave the game (back to the lobby)
 *   child → parent  { type: 'pv-result', game, outcome, score?, level? } a real match / level finished
 *   parent → child  { type: 'pv-back' }                                  Android/header back button
 */
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

export const EMBED: boolean = params.get('embed') === '1' && typeof window !== 'undefined' && window.parent !== window;

const langParam = params.get('lang');
export const EMBED_LANG: Locale | null = isLocale(langParam) ? langParam : null;
export const EMBED_SOUND: boolean = params.get('sound') !== '0';
export const EMBED_HAPTICS: boolean = params.get('haptics') !== '0';
/** Lobby mode hint from the DA Games shell (e.g. `ai`, `2p`, `easy`); games may use it to preselect options. */
export const EMBED_MODE: string | null = EMBED ? params.get('mode') || null : null;

if (EMBED && typeof document !== 'undefined') document.documentElement.dataset.embed = '1';

export function postToParent(message: Record<string, unknown>): void {
  if (!EMBED) return;
  try {
    window.parent.postMessage(message, '*');
  } catch {
    /* parent unavailable */
  }
}

export function postExit(): void {
  postToParent({ type: 'pv-exit' });
}

export interface EmbedResult {
  game: string;
  outcome: 'win' | 'loss' | 'draw' | 'ended';
  score?: number;
  /** Set when the result also completed a campaign level. */
  level?: boolean;
}

let levelPending = false;

/** Called by `completeLevel`; the next result (recorded right after it) is flagged as a level completion. */
export function markLevelCompleted(): void {
  levelPending = true;
}

export function postResult(result: EmbedResult): void {
  const level = levelPending || result.level === true;
  levelPending = false;
  postToParent({ type: 'pv-result', ...result, level });
}

/* ───────────── back navigation ───────────── */

/** A back handler returns true when it handled the request (closed a dialog, went to the menu…). */
export type BackHandler = () => boolean;

const handlers: { fn: BackHandler }[] = [];

/** Registers a handler; the most recently registered one is asked first. Returns the unregister function. */
export function registerBackHandler(fn: BackHandler): () => void {
  const entry = { fn };
  handlers.push(entry);
  return () => {
    const i = handlers.indexOf(entry);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/**
 * Handles a back request: asks the registered handlers (open dialog first, then the game screen) and,
 * when none handles it, tells the parent to leave the game.
 */
export function requestBack(): void {
  for (let i = handlers.length - 1; i >= 0; i--) {
    const entry = handlers[i];
    if (entry && entry.fn()) return;
  }
  postExit();
}

/** Registers `fn` while `enabled`. `fn` may change on every render (the latest one is called). */
export function useBackHandler(fn: BackHandler, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!EMBED || !enabled) return undefined;
    return registerBackHandler(() => ref.current());
  }, [enabled]);
}

if (EMBED && typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data as { type?: unknown } | null;
    if (data && data.type === 'pv-back') requestBack();
  });
}
