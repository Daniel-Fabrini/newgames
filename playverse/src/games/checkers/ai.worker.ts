import { chooseMove, type AiRequest, type AiResult } from './ai';

/** Web Worker running the computer opponent's search off the main thread. */
export interface WorkerRequest {
  id: number;
  request: AiRequest;
}

export type WorkerResponse = { id: number; result: AiResult } | { id: number; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

scope.onmessage = (event) => {
  const { id, request } = event.data;
  try {
    scope.postMessage({ id, result: chooseMove(request) });
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
