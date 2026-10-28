import type { Dir, PlacedWord, Puzzle } from './types';

/**
 * Crossword play engine (pure, UI independent).
 *
 * Rules implemented:
 * - The player fills the white squares; a square belongs to an across word, a down word or both.
 * - Check (square / word / grid) marks wrong letters; letters confirmed correct are locked.
 * - Reveal (square / word) writes the solution and locks it; a letter that was already right is
 *   only confirmed (no penalty).
 * - The puzzle is complete when every white square holds its solution letter.
 * - Accuracy = max(0, correctly typed letters − wrong letters found by checks) / total letters,
 *   where revealed letters never count as correctly typed.
 * - Stars: 3 = accuracy ≥ 95 % and nothing revealed; 2 = accuracy ≥ 70 %; otherwise 1.
 */
export interface CellModel {
  index: number;
  row: number;
  col: number;
  solution: string;
  /** Clue number printed in the square, if a word starts here. */
  number: number | null;
  /** Index of the across / down word through this square, or -1. */
  across: number;
  down: number;
}

export interface WordModel extends PlacedWord {
  index: number;
  cells: number[];
}

export interface GridModel {
  puzzle: Puzzle;
  width: number;
  height: number;
  cells: (CellModel | null)[];
  /** Across words by number, then down words by number (also the Tab order). */
  words: WordModel[];
  letterCount: number;
}

export function buildModel(puzzle: Puzzle): GridModel {
  const { width, height } = puzzle;
  const cells: (CellModel | null)[] = new Array<CellModel | null>(width * height).fill(null);
  const sorted = [...puzzle.words].sort((a, b) => (a.dir === b.dir ? a.number - b.number : a.dir === 'across' ? -1 : 1));
  const words: WordModel[] = sorted.map((w, index) => {
    const list: number[] = [];
    for (let i = 0; i < w.answer.length; i++) {
      const row = w.row + (w.dir === 'down' ? i : 0);
      const col = w.col + (w.dir === 'across' ? i : 0);
      const k = row * width + col;
      list.push(k);
      const cell = cells[k] ?? { index: k, row, col, solution: w.answer[i] as string, number: null, across: -1, down: -1 };
      if (w.dir === 'across') cell.across = index;
      else cell.down = index;
      if (i === 0) cell.number = w.number;
      cells[k] = cell;
    }
    return { ...w, index, cells: list };
  });
  return { puzzle, width, height, cells, words, letterCount: cells.filter(Boolean).length };
}

export type Mark = '' | 'wrong' | 'ok' | 'revealed';

export interface PlayState {
  /** Letter typed in each square ('' = empty or black square). */
  entries: string[];
  marks: Mark[];
  /** Check actions used. */
  checks: number;
  /** Wrong letters found by checks (each wrong letter is counted once until it is changed). */
  wrongFound: number;
  completed: boolean;
}

export function newPlay(model: GridModel): PlayState {
  const size = model.width * model.height;
  return { entries: new Array<string>(size).fill(''), marks: new Array<Mark>(size).fill(''), checks: 0, wrongFound: 0, completed: false };
}

export const isLocked = (play: PlayState, cell: number) => play.marks[cell] === 'ok' || play.marks[cell] === 'revealed';

export function isSolved(play: PlayState, model: GridModel): boolean {
  return model.cells.every((c) => c === null || play.entries[c.index] === c.solution);
}

export function isFull(play: PlayState, model: GridModel): boolean {
  return model.cells.every((c) => c === null || (play.entries[c.index] ?? '') !== '');
}

export function filledCount(play: PlayState, model: GridModel): number {
  return model.cells.reduce((n, c) => n + (c && play.entries[c.index] ? 1 : 0), 0);
}

export function revealedCount(play: PlayState): number {
  return play.marks.reduce((n, m) => n + (m === 'revealed' ? 1 : 0), 0);
}

/** True once the player has done anything on the grid. */
export function hasProgress(play: PlayState): boolean {
  return play.checks > 0 || play.entries.some((e) => e !== '') || play.marks.some((m) => m !== '');
}

function withCompletion(play: PlayState, model: GridModel): PlayState {
  return { ...play, completed: isSolved(play, model) };
}

/** Writes a letter (ignored on locked or black squares and on completed puzzles). Clears a "wrong" mark. */
export function setEntry(play: PlayState, model: GridModel, cell: number, letter: string): PlayState {
  if (play.completed || !model.cells[cell] || isLocked(play, cell)) return play;
  if (play.entries[cell] === letter && play.marks[cell] !== 'wrong') return play;
  const entries = play.entries.slice();
  entries[cell] = letter;
  const marks = play.marks.slice();
  marks[cell] = '';
  return withCompletion({ ...play, entries, marks }, model);
}

export function clearEntry(play: PlayState, model: GridModel, cell: number): PlayState {
  if (play.completed || !model.cells[cell] || isLocked(play, cell) || !play.entries[cell]) return play;
  const entries = play.entries.slice();
  entries[cell] = '';
  const marks = play.marks.slice();
  marks[cell] = '';
  return { ...play, entries, marks };
}

export type Scope = { kind: 'cell'; cell: number } | { kind: 'word'; word: number } | { kind: 'all' };

export function scopeCells(model: GridModel, scope: Scope): number[] {
  if (scope.kind === 'cell') return model.cells[scope.cell] ? [scope.cell] : [];
  if (scope.kind === 'word') return model.words[scope.word]?.cells ?? [];
  return model.cells.filter((c): c is CellModel => c !== null).map((c) => c.index);
}

export interface CheckResult {
  play: PlayState;
  wrong: number;
  correct: number;
  empty: number;
}

/** Checks the letters in scope: right ones are confirmed (locked), wrong ones are marked. */
export function check(play: PlayState, model: GridModel, scope: Scope): CheckResult {
  if (play.completed) return { play, wrong: 0, correct: 0, empty: 0 };
  const marks = play.marks.slice();
  let wrong = 0;
  let correct = 0;
  let empty = 0;
  let newlyWrong = 0;
  for (const i of scopeCells(model, scope)) {
    const cell = model.cells[i];
    if (!cell || isLocked(play, i)) continue;
    const entry = play.entries[i] ?? '';
    if (entry === '') empty++;
    else if (entry === cell.solution) {
      marks[i] = 'ok';
      correct++;
    } else {
      if (marks[i] !== 'wrong') newlyWrong++;
      marks[i] = 'wrong';
      wrong++;
    }
  }
  return { play: { ...play, marks, checks: play.checks + 1, wrongFound: play.wrongFound + newlyWrong }, wrong, correct, empty };
}

export interface RevealResult {
  play: PlayState;
  revealed: number;
}

/** Reveals the solution in scope. Letters that were already right are just confirmed. */
export function reveal(play: PlayState, model: GridModel, scope: Scope): RevealResult {
  if (play.completed) return { play, revealed: 0 };
  const entries = play.entries.slice();
  const marks = play.marks.slice();
  let revealed = 0;
  for (const i of scopeCells(model, scope)) {
    const cell = model.cells[i];
    if (!cell || isLocked(play, i)) continue;
    if (entries[i] === cell.solution) marks[i] = 'ok';
    else {
      entries[i] = cell.solution;
      marks[i] = 'revealed';
      revealed++;
    }
  }
  return { play: withCompletion({ ...play, entries, marks }, model), revealed };
}

/** Accuracy in [0, 1] (see the formula at the top of this file). */
export function accuracy(play: PlayState, model: GridModel): number {
  if (model.letterCount === 0) return 0;
  let typed = 0;
  for (const c of model.cells) if (c && play.entries[c.index] === c.solution && play.marks[c.index] !== 'revealed') typed++;
  return Math.max(0, typed - play.wrongFound) / model.letterCount;
}

export function starsFor(acc: number, revealed: number): number {
  if (acc >= 0.95 && revealed === 0) return 3;
  if (acc >= 0.7) return 2;
  return 1;
}

/** A word is confirmed when all its letters are locked (checked right or revealed) or the puzzle is done. */
export function isWordConfirmed(play: PlayState, model: GridModel, word: number): boolean {
  const w = model.words[word];
  if (!w) return false;
  return play.completed || w.cells.every((i) => isLocked(play, i));
}

export function isWordFilled(play: PlayState, model: GridModel, word: number): boolean {
  return (model.words[word]?.cells ?? []).every((i) => (play.entries[i] ?? '') !== '');
}

// ───────────── Cursor and navigation ─────────────

export interface Cursor {
  cell: number;
  dir: Dir;
}

export function wordAt(model: GridModel, cell: number, dir: Dir): number {
  const c = model.cells[cell];
  if (!c) return -1;
  return dir === 'across' ? c.across : c.down;
}

const other = (dir: Dir): Dir => (dir === 'across' ? 'down' : 'across');

/** Makes sure the cursor is on a white square and points at a word through it. */
export function fixCursor(model: GridModel, cursor: Cursor): Cursor {
  let cell = cursor.cell;
  if (!model.cells[cell]) cell = model.words[0]?.cells[0] ?? 0;
  const dir = wordAt(model, cell, cursor.dir) >= 0 ? cursor.dir : other(cursor.dir);
  return { cell, dir };
}

/** First empty square of the first word with empty squares (or the first square). */
export function initialCursor(model: GridModel, play: PlayState): Cursor {
  for (const w of model.words) {
    const cell = w.cells.find((i) => !play.entries[i] && !isLocked(play, i));
    if (cell !== undefined) return { cell, dir: w.dir };
  }
  const first = model.words[0];
  return { cell: first?.cells[0] ?? 0, dir: first?.dir ?? 'across' };
}

export function toggleDir(model: GridModel, cursor: Cursor): Cursor {
  const dir = other(cursor.dir);
  return wordAt(model, cursor.cell, dir) >= 0 ? { cell: cursor.cell, dir } : cursor;
}

/** Tapping a square selects it; tapping the selected square again switches direction. */
export function selectCell(model: GridModel, cursor: Cursor, cell: number): Cursor {
  if (!model.cells[cell]) return cursor;
  if (cell === cursor.cell) return toggleDir(model, cursor);
  return fixCursor(model, { cell, dir: cursor.dir });
}

/** Selects a word, placing the cursor on its first empty square (or its first square). */
export function selectWord(model: GridModel, play: PlayState, word: number): Cursor {
  const w = model.words[word];
  if (!w) return fixCursor(model, { cell: 0, dir: 'across' });
  const cell = w.cells.find((i) => !play.entries[i] && !isLocked(play, i)) ?? w.cells[0] ?? 0;
  return { cell, dir: w.dir };
}

export type Arrow = 'up' | 'down' | 'left' | 'right';

/** Moves to the next white square in the arrow's direction (jumping over empty squares). */
export function moveArrow(model: GridModel, cursor: Cursor, arrow: Arrow): Cursor {
  const current = model.cells[cursor.cell];
  if (!current) return fixCursor(model, cursor);
  const axis: Dir = arrow === 'left' || arrow === 'right' ? 'across' : 'down';
  const dr = arrow === 'up' ? -1 : arrow === 'down' ? 1 : 0;
  const dc = arrow === 'left' ? -1 : arrow === 'right' ? 1 : 0;
  let r = current.row + dr;
  let c = current.col + dc;
  while (r >= 0 && c >= 0 && r < model.height && c < model.width) {
    const k = r * model.width + c;
    if (model.cells[k]) return fixCursor(model, { cell: k, dir: axis });
    r += dr;
    c += dc;
  }
  return fixCursor(model, { cell: cursor.cell, dir: axis });
}

/** Next/previous clue in clue order (Tab / Shift+Tab, clue-bar arrows). */
export function stepWord(model: GridModel, play: PlayState, cursor: Cursor, delta: 1 | -1): Cursor {
  const n = model.words.length;
  if (n === 0) return cursor;
  const current = wordAt(model, cursor.cell, cursor.dir);
  const start = current < 0 ? (delta === 1 ? -1 : 0) : current;
  const next = (((start + delta) % n) + n) % n;
  return selectWord(model, play, next);
}

export interface InputOptions {
  /** Skip squares that already hold a letter when advancing. */
  skipFilled: boolean;
}

export interface InputResult {
  play: PlayState;
  cursor: Cursor;
}

function nextTarget(model: GridModel, play: PlayState, cursor: Cursor, opts: InputOptions): Cursor {
  const wi = wordAt(model, cursor.cell, cursor.dir);
  const word = model.words[wi];
  if (!word) return cursor;
  const open = (i: number) => !isLocked(play, i) && (!opts.skipFilled || !play.entries[i]);
  const pos = word.cells.indexOf(cursor.cell);
  for (let j = pos + 1; j < word.cells.length; j++) {
    const k = word.cells[j] as number;
    if (open(k)) return { cell: k, dir: cursor.dir };
  }
  const emptyHere = word.cells.find((i) => !play.entries[i] && !isLocked(play, i));
  if (emptyHere !== undefined) return { cell: emptyHere, dir: cursor.dir };
  for (let step = 1; step < model.words.length; step++) {
    const w = model.words[(wi + step) % model.words.length] as WordModel;
    const empty = w.cells.find((i) => !play.entries[i] && !isLocked(play, i));
    if (empty !== undefined) return { cell: empty, dir: w.dir };
  }
  return cursor;
}

/** Types a letter in the selected square and advances inside the word (then to the next clue). */
export function typeLetter(model: GridModel, play: PlayState, cursor: Cursor, letter: string, opts: InputOptions): InputResult {
  if (play.completed || !model.cells[cursor.cell]) return { play, cursor };
  const updated = setEntry(play, model, cursor.cell, letter);
  if (updated.completed) return { play: updated, cursor };
  return { play: updated, cursor: nextTarget(model, updated, cursor, opts) };
}

/** Backspace: clears the selected letter, or moves back one square in the word and clears it. */
export function backspace(model: GridModel, play: PlayState, cursor: Cursor): InputResult {
  if (play.completed || !model.cells[cursor.cell]) return { play, cursor };
  if (!isLocked(play, cursor.cell) && play.entries[cursor.cell]) return { play: clearEntry(play, model, cursor.cell), cursor };
  const word = model.words[wordAt(model, cursor.cell, cursor.dir)];
  if (!word) return { play, cursor };
  for (let j = word.cells.indexOf(cursor.cell) - 1; j >= 0; j--) {
    const k = word.cells[j] as number;
    if (!isLocked(play, k)) return { play: clearEntry(play, model, k), cursor: { cell: k, dir: cursor.dir } };
  }
  return { play, cursor };
}
