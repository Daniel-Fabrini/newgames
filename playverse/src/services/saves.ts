import { useCallback, useEffect, useRef } from 'react';
import { hasValue, readValue, removeValue, writeValue } from './storage/storage';
import type { Validator } from './storage/schema';
import type { GameId } from '../types/game';

/**
 * Saved in-progress games. Each game owns its state shape and validator; this module only
 * namespaces keys (`save:<gameId>[:<slot>]`) and handles versioning/validation.
 */
export interface SaveSpec<T> {
  gameId: GameId;
  /** Optional slot for games with independent saves per mode. */
  slot?: string;
  version: number;
  validate: Validator<T>;
  /** Upgrades data saved with an older `version` (return undefined to discard it). */
  migrate?: (fromVersion: number, data: unknown) => unknown;
}

const keyOf = (gameId: GameId, slot?: string) => (slot ? `save:${gameId}:${slot}` : `save:${gameId}`);

export function loadGame<T>(spec: SaveSpec<T>): T | null {
  return readValue<T | null>(keyOf(spec.gameId, spec.slot), { validate: spec.validate, version: spec.version, migrate: spec.migrate }, null);
}

export function saveGame<T>(spec: SaveSpec<T>, state: T): boolean {
  return writeValue(keyOf(spec.gameId, spec.slot), state, spec.version);
}

export function clearGame(gameId: GameId, slot?: string): void {
  removeValue(keyOf(gameId, slot));
}

/** True when a save exists for the game in any slot (used by "continue" on the home screen). */
export function hasSavedGame(gameId: GameId, slot?: string): boolean {
  return hasValue(keyOf(gameId, slot));
}

/**
 * Throttled autosave. Writes `state` at most once every `delayMs` while it keeps changing (or
 * clears the save when `state` is null) and flushes immediately when the page is hidden or the
 * component unmounts, so progress is not lost when the app is closed. Passing a new object on
 * every render (e.g. with a running clock) is fine: writes are not postponed indefinitely.
 */
export function useAutosave<T>(spec: SaveSpec<T>, state: T | null, delayMs = 400): void {
  const latest = useRef<{ spec: SaveSpec<T>; state: T | null; dirty: boolean }>({ spec, state, dirty: false });
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const { spec: s, state: value, dirty } = latest.current;
    if (!dirty) return;
    latest.current.dirty = false;
    if (value === null) clearGame(s.gameId, s.slot);
    else saveGame(s, value);
  }, []);

  useEffect(() => {
    latest.current.spec = spec;
  });

  useEffect(() => {
    latest.current.state = state;
    latest.current.dirty = true;
    if (timer.current === null) timer.current = window.setTimeout(flush, delayMs);
  }, [state, delayMs, flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);
}
