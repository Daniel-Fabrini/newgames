import type { Validator } from './schema';

/**
 * Versioned, validated local persistence.
 *
 * Every value is stored as `{ "v": <schemaVersion>, "d": <data> }` under `playverse:<key>`.
 * Reads are validated; corrupted or incompatible values are moved to a backup key and the
 * caller receives its fallback, so the app always starts in a consistent state.
 * When localStorage is unavailable (private mode, blocked cookies) an in-memory store is used.
 */
export const STORAGE_PREFIX = 'playverse:';
const BACKUP_PREFIX = 'playverse-corrupt:';

interface Backend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

function memoryBackend(): Backend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, val) => void map.set(k, val),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

function detectBackend(): { backend: Backend; persistent: boolean } {
  try {
    if (typeof localStorage === 'undefined') return { backend: memoryBackend(), persistent: false };
    const probe = `${STORAGE_PREFIX}__probe__`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      persistent: true,
      backend: {
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, val) => localStorage.setItem(k, val),
        removeItem: (k) => localStorage.removeItem(k),
        keys: () => {
          const out: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k !== null) out.push(k);
          }
          return out;
        },
      },
    };
  } catch {
    return { backend: memoryBackend(), persistent: false };
  }
}

let { backend, persistent } = detectBackend();

export type StorageIssue = { key: string; reason: 'corrupt' | 'invalid' | 'version' | 'write-failed' };
const issueListeners = new Set<(issue: StorageIssue) => void>();
const issueLog: StorageIssue[] = [];

function reportIssue(issue: StorageIssue): void {
  issueLog.push(issue);
  console.warn(`[storage] ${issue.reason} value for "${issue.key}"`);
  for (const listener of issueListeners) listener(issue);
}

/** Subscribe to storage problems (used to inform the player that data was recovered). */
export function onStorageIssue(listener: (issue: StorageIssue) => void): () => void {
  issueListeners.add(listener);
  return () => issueListeners.delete(listener);
}

export function getStorageIssues(): readonly StorageIssue[] {
  return issueLog;
}

export function isPersistent(): boolean {
  return persistent;
}

export interface ReadOptions<T> {
  validate: Validator<T>;
  /** Schema version written with the value. Defaults to 1. */
  version?: number;
  /** Optional migration from an older version's raw data. Return undefined to discard. */
  migrate?: (fromVersion: number, data: unknown) => unknown;
}

function backup(key: string, raw: string): void {
  try {
    backend.setItem(`${BACKUP_PREFIX}${key}`, raw);
  } catch {
    /* ignore: backup is best effort */
  }
}

/** Reads and validates a value. Returns `fallback` when missing, corrupt or invalid. */
export function readValue<T>(key: string, options: ReadOptions<T>, fallback: T): T {
  const fullKey = STORAGE_PREFIX + key;
  let raw: string | null;
  try {
    raw = backend.getItem(fullKey);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    backup(key, raw);
    backend.removeItem(fullKey);
    reportIssue({ key, reason: 'corrupt' });
    return fallback;
  }

  const expected = options.version ?? 1;
  if (typeof envelope !== 'object' || envelope === null || !('v' in envelope) || !('d' in envelope)) {
    backup(key, raw);
    backend.removeItem(fullKey);
    reportIssue({ key, reason: 'corrupt' });
    return fallback;
  }
  const { v: version, d: data } = envelope as { v: unknown; d: unknown };
  let payload = data;
  if (version !== expected) {
    const migrated = typeof version === 'number' && options.migrate ? options.migrate(version, data) : undefined;
    if (migrated === undefined) {
      backup(key, raw);
      backend.removeItem(fullKey);
      reportIssue({ key, reason: 'version' });
      return fallback;
    }
    payload = migrated;
  }

  const result = options.validate(payload);
  if (!result.ok) {
    console.warn(`[storage] validation failed for "${key}": ${result.error}`);
    backup(key, raw);
    backend.removeItem(fullKey);
    reportIssue({ key, reason: 'invalid' });
    return fallback;
  }
  if (version !== expected) writeValue(key, result.value, expected);
  return result.value;
}

/** Writes a value. Returns false when the write failed (e.g. quota exceeded). */
export function writeValue(key: string, value: unknown, version = 1): boolean {
  try {
    backend.setItem(STORAGE_PREFIX + key, JSON.stringify({ v: version, d: value }));
    return true;
  } catch {
    reportIssue({ key, reason: 'write-failed' });
    return false;
  }
}

export function removeValue(key: string): void {
  try {
    backend.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function hasValue(key: string): boolean {
  try {
    return backend.getItem(STORAGE_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

/** Lists keys (without prefix) that start with `prefix`. */
export function listKeys(prefix = ''): string[] {
  try {
    return backend
      .keys()
      .filter((k) => k.startsWith(STORAGE_PREFIX + prefix))
      .map((k) => k.slice(STORAGE_PREFIX.length));
  } catch {
    return [];
  }
}

/** Removes every PlayVerse key (used by "reset all data"). */
export function clearAllValues(): void {
  for (const key of backend.keys()) {
    if (key.startsWith(STORAGE_PREFIX) || key.startsWith(BACKUP_PREFIX)) backend.removeItem(key);
  }
}

/** Test helper: re-detects the backend (e.g. after jsdom localStorage is reset). */
export function __resetStorageBackendForTests(useMemory = false): void {
  if (useMemory) {
    backend = memoryBackend();
    persistent = false;
  } else {
    ({ backend, persistent } = detectBackend());
  }
  issueLog.length = 0;
}
