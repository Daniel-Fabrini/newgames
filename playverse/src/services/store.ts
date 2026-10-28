import { useSyncExternalStore } from 'react';
import { readValue, writeValue, STORAGE_PREFIX, type ReadOptions } from './storage/storage';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface PersistedStore<T> extends Store<T> {
  /** Re-reads the value from storage (used after "reset data" and cross-tab updates). */
  reload(): void;
}

/** A store backed by validated storage. Changes are written immediately and synced across tabs. */
export function createPersistedStore<T>(key: string, options: ReadOptions<T>, defaults: () => T): PersistedStore<T> {
  const store = createStore<T>(readValue(key, options, defaults()));
  const persistedSet = (next: T | ((prev: T) => T)) => {
    store.set(next);
    writeValue(key, store.get(), options.version ?? 1);
  };
  const reload = () => store.set(readValue(key, options, defaults()));
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_PREFIX + key) reload();
    });
  }
  return { ...store, set: persistedSet, reload };
}

export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S;
export function useStore<T, S>(store: Store<T>, selector?: (state: T) => S): T | S {
  const getSnapshot = () => (selector ? selector(store.get()) : store.get());
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
