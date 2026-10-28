import type { Difficulty, GeneratedPuzzle } from './generator';

/** Messages exchanged with generator.worker.ts. */
export interface GenerateRequest {
  id: number;
  difficulty: Difficulty;
  seed: number;
}

export type GenerateResponse = { id: number; ok: true; puzzle: GeneratedPuzzle } | { id: number; ok: false; error: string };
