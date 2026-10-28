import { chooseMove, type AiRequest, type AiResult } from './ai';
import type { WorkerRequest, WorkerResponse } from './ai.worker';

/**
 * Runs the computer opponent in a Web Worker so the interface never freezes. When workers are not
 * available (or the worker fails to load), the search runs on the main thread after yielding a frame,
 * so the "thinking" indicator is painted first; the search is time-bounded either way.
 */
interface Pending {
  request: AiRequest;
  resolve: (result: AiResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function runLocally(p: Pending): void {
  window.setTimeout(() => {
    try {
      p.resolve(chooseMove(p.request));
    } catch (err) {
      p.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }, 30);
}

function failOver(): void {
  workerBroken = true;
  worker?.terminate();
  worker = null;
  const waiting = [...pending.values()];
  pending.clear();
  waiting.forEach(runLocally);
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if ('result' in data) p.resolve(data.result);
      else runLocally(p);
    };
    w.onerror = (event) => {
      event.preventDefault();
      failOver();
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Asks the computer for a move. The promise resolves with a move from the legal move generator. */
export function requestAiMove(request: AiRequest): Promise<AiResult> {
  return new Promise<AiResult>((resolve, reject) => {
    const p: Pending = { request, resolve, reject };
    const w = getWorker();
    if (!w) {
      runLocally(p);
      return;
    }
    const id = nextId++;
    pending.set(id, p);
    const message: WorkerRequest = { id, request };
    w.postMessage(message);
  });
}

/** Stops the worker (e.g. when leaving the game). Pending requests are dropped. */
export function releaseAi(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
