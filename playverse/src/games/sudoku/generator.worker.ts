import { generatePuzzle } from './generator';
import type { GenerateRequest, GenerateResponse } from './protocol';

/** Generates puzzles off the main thread so the UI never freezes. */
self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, difficulty, seed } = event.data;
  let response: GenerateResponse;
  try {
    response = { id, ok: true, puzzle: generatePuzzle(difficulty, seed) };
  } catch (error) {
    response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
