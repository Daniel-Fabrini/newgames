import { useEffect, useMemo, useRef } from 'react';
import { randomSeed } from '../../utils/random';
import { generatePuzzle, type Difficulty, type GeneratedPuzzle } from './generator';
import type { GenerateRequest, GenerateResponse } from './protocol';

/**
 * Supplies generated puzzles. Generation runs in a Web Worker; one puzzle of the last requested
 * difficulty is pre-generated in the background so "new puzzle" is usually instant.
 * If workers are unavailable (or the worker fails to load) generation falls back to the main
 * thread, deferred with a timeout so the loading state can render first.
 */
export interface PuzzleSource {
  /** Resolves with a puzzle of the given difficulty (the prefetched one when available). */
  next(difficulty: Difficulty): Promise<GeneratedPuzzle>;
  /** Starts generating a puzzle of this difficulty in the background. */
  prefetch(difficulty: Difficulty): void;
  dispose(): void;
}

type Pending = { resolve: (p: GeneratedPuzzle) => void; reject: (e: Error) => void; request: GenerateRequest };

export function createPuzzleSource(): PuzzleSource {
  let worker: Worker | null = null;
  let workerFailed = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();
  let prefetched: { difficulty: Difficulty; promise: Promise<GeneratedPuzzle> } | null = null;

  const runLocally = (req: GenerateRequest): Promise<GeneratedPuzzle> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          resolve(generatePuzzle(req.difficulty, req.seed));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 30);
    });

  const failWorker = () => {
    workerFailed = true;
    worker?.terminate();
    worker = null;
    const waiting = [...pending.values()];
    pending.clear();
    for (const p of waiting) runLocally(p.request).then(p.resolve, p.reject);
  };

  const getWorker = (): Worker | null => {
    if (worker || workerFailed) return worker;
    if (typeof Worker === 'undefined') {
      workerFailed = true;
      return null;
    }
    try {
      worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerFailed = true;
      return null;
    }
    worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.puzzle);
      else p.reject(new Error(msg.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      failWorker();
    };
    return worker;
  };

  const generate = (difficulty: Difficulty): Promise<GeneratedPuzzle> => {
    const request: GenerateRequest = { id: nextId++, difficulty, seed: randomSeed() };
    const w = getWorker();
    if (!w) return runLocally(request);
    return new Promise((resolve, reject) => {
      pending.set(request.id, { resolve, reject, request });
      w.postMessage(request);
    });
  };

  return {
    next(difficulty) {
      if (prefetched && prefetched.difficulty === difficulty) {
        const { promise } = prefetched;
        prefetched = null;
        // A failed prefetch falls back to a fresh request.
        return promise.catch(() => generate(difficulty));
      }
      return generate(difficulty);
    },
    prefetch(difficulty) {
      if (prefetched && prefetched.difficulty === difficulty) return;
      const promise = generate(difficulty);
      promise.catch(() => undefined);
      prefetched = { difficulty, promise };
    },
    dispose() {
      worker?.terminate();
      worker = null;
      const waiting = [...pending.values()];
      pending.clear();
      prefetched = null;
      for (const p of waiting) p.reject(new Error('disposed'));
    },
  };
}

/**
 * One puzzle source per mounted game, created lazily on first use; the worker is terminated on
 * unmount (requests still pending are rejected, so callers must ignore results after cleanup).
 */
export function usePuzzleSource(): PuzzleSource {
  const ref = useRef<PuzzleSource | null>(null);
  useEffect(
    () => () => {
      ref.current?.dispose();
      ref.current = null;
    },
    [],
  );
  return useMemo<PuzzleSource>(() => {
    const get = () => (ref.current ??= createPuzzleSource());
    return {
      next: (difficulty) => get().next(difficulty),
      prefetch: (difficulty) => get().prefetch(difficulty),
      dispose: () => {
        ref.current?.dispose();
        ref.current = null;
      },
    };
  }, []);
}
