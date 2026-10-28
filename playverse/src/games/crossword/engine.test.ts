import { describe, expect, it } from 'vitest';
import {
  accuracy,
  backspace,
  buildModel,
  check,
  clearEntry,
  filledCount,
  fixCursor,
  hasProgress,
  initialCursor,
  isLocked,
  isSolved,
  isWordConfirmed,
  moveArrow,
  newPlay,
  reveal,
  selectCell,
  selectWord,
  setEntry,
  starsFor,
  stepWord,
  toggleDir,
  typeLetter,
  wordAt,
  type GridModel,
  type PlayState,
} from './engine';
import type { Puzzle } from './types';

// C A S A .
// . . O . .
// . . L U A
const puzzle: Puzzle = {
  id: 'pt-preset-1',
  lang: 'pt',
  kind: 'preset',
  n: 1,
  width: 5,
  height: 3,
  words: [
    { number: 1, dir: 'across', row: 0, col: 0, answer: 'CASA', clue: 'Edifício', display: 'casa' },
    { number: 2, dir: 'down', row: 0, col: 2, answer: 'SOL', clue: 'Estrela', display: 'sol' },
    { number: 3, dir: 'across', row: 2, col: 2, answer: 'LUA', clue: 'Satélite', display: 'lua' },
  ],
};

const at = (r: number, c: number) => r * 5 + c;
const opts = { skipFilled: false };

function fill(model: GridModel, play: PlayState, letters: Record<number, string>): PlayState {
  let p = play;
  for (const [cell, letter] of Object.entries(letters)) p = setEntry(p, model, Number(cell), letter);
  return p;
}

function solveAll(model: GridModel, play: PlayState): PlayState {
  let p = play;
  for (const c of model.cells) if (c) p = setEntry(p, model, c.index, c.solution);
  return p;
}

describe('model', () => {
  const model = buildModel(puzzle);

  it('builds squares, words and numbers', () => {
    expect(model.letterCount).toBe(8);
    expect(model.cells[at(0, 2)]).toMatchObject({ solution: 'S', number: 2, across: 0, down: 2 });
    expect(model.cells[at(1, 0)]).toBeNull();
    expect(model.words.map((w) => `${w.number}${w.dir[0]}`)).toEqual(['1a', '3a', '2d']);
    expect(model.words[2]?.cells).toEqual([at(0, 2), at(1, 2), at(2, 2)]);
  });
});

describe('letters, check and reveal', () => {
  const model = buildModel(puzzle);

  it('writes letters on white squares only and detects completion', () => {
    let play = newPlay(model);
    expect(setEntry(play, model, at(1, 0), 'X')).toBe(play);
    play = solveAll(model, play);
    expect(isSolved(play, model)).toBe(true);
    expect(play.completed).toBe(true);
    // Nothing changes once completed.
    expect(setEntry(play, model, at(0, 0), 'Z')).toBe(play);
  });

  it('a full grid with a wrong letter is not complete', () => {
    let play = solveAll(model, newPlay(model));
    play = { ...play, completed: false };
    play = setEntry(play, model, at(0, 0), 'K');
    expect(filledCount(play, model)).toBe(8);
    expect(play.completed).toBe(false);
  });

  it('check marks wrong letters, locks right ones and counts each wrong letter once', () => {
    let play = fill(model, newPlay(model), { [at(0, 0)]: 'C', [at(0, 1)]: 'X' });
    const res = check(play, model, { kind: 'word', word: 0 });
    expect(res).toMatchObject({ wrong: 1, correct: 1, empty: 2 });
    play = res.play;
    expect(play.marks[at(0, 1)]).toBe('wrong');
    expect(isLocked(play, at(0, 0))).toBe(true);
    expect(play.wrongFound).toBe(1);
    expect(play.checks).toBe(1);
    // Re-checking the same wrong letter does not count it again.
    play = check(play, model, { kind: 'all' }).play;
    expect(play.wrongFound).toBe(1);
    expect(play.checks).toBe(2);
    // Locked letters cannot be changed.
    expect(setEntry(play, model, at(0, 0), 'Z')).toBe(play);
    expect(clearEntry(play, model, at(0, 0))).toBe(play);
    // Changing the wrong letter clears its mark; a new mistake counts again.
    play = setEntry(play, model, at(0, 1), 'Y');
    expect(play.marks[at(0, 1)]).toBe('');
    play = check(play, model, { kind: 'cell', cell: at(0, 1) }).play;
    expect(play.wrongFound).toBe(2);
  });

  it('reveal writes the solution, locks it and only penalises letters that were not already right', () => {
    let play = fill(model, newPlay(model), { [at(0, 0)]: 'C', [at(0, 1)]: 'X' });
    const res = reveal(play, model, { kind: 'word', word: 0 });
    expect(res.revealed).toBe(3);
    play = res.play;
    expect(play.entries.slice(0, 4)).toEqual(['C', 'A', 'S', 'A']);
    expect(play.marks[at(0, 0)]).toBe('ok');
    expect(play.marks[at(0, 1)]).toBe('revealed');
    expect(reveal(play, model, { kind: 'cell', cell: at(0, 1) }).revealed).toBe(0);
  });

  it('isWordConfirmed when every letter of the word is locked', () => {
    let play = newPlay(model);
    expect(isWordConfirmed(play, model, 1)).toBe(false);
    play = reveal(play, model, { kind: 'word', word: 1 }).play;
    expect(isWordConfirmed(play, model, 1)).toBe(true);
  });

  it('hasProgress detects any action', () => {
    const play = newPlay(model);
    expect(hasProgress(play)).toBe(false);
    expect(hasProgress(setEntry(play, model, 0, 'A'))).toBe(true);
    expect(hasProgress(check(play, model, { kind: 'all' }).play)).toBe(true);
  });
});

describe('accuracy and stars', () => {
  const model = buildModel(puzzle);

  it('is 100 % for a clean solve', () => {
    const play = solveAll(model, newPlay(model));
    expect(accuracy(play, model)).toBe(1);
    expect(starsFor(1, 0)).toBe(3);
  });

  it('excludes revealed letters and subtracts wrong letters found by checks', () => {
    let play = fill(model, newPlay(model), { [at(0, 0)]: 'X' });
    play = check(play, model, { kind: 'cell', cell: at(0, 0) }).play; // 1 wrong found
    play = reveal(play, model, { kind: 'word', word: 2 }).play; // S, O, L revealed
    play = solveAll(model, play); // the remaining 5 letters typed correctly
    expect(play.completed).toBe(true);
    // (5 typed correctly − 1 wrong check) / 8 letters
    expect(accuracy(play, model)).toBeCloseTo(4 / 8);
    expect(starsFor(accuracy(play, model), 3)).toBe(1);
  });

  it('never goes below zero', () => {
    let play = newPlay(model);
    for (const c of model.cells) if (c) play = setEntry(play, model, c.index, 'Z');
    play = check(play, model, { kind: 'all' }).play;
    expect(accuracy(play, model)).toBe(0);
  });

  it('gives 2 stars for a good solve with reveals and 1 star for a poor one', () => {
    expect(starsFor(0.96, 1)).toBe(2);
    expect(starsFor(0.7, 0)).toBe(2);
    expect(starsFor(0.69, 0)).toBe(1);
  });
});

describe('cursor and input', () => {
  const model = buildModel(puzzle);

  it('selecting a square keeps the direction when possible; tapping again toggles it', () => {
    let cursor = { cell: at(0, 0), dir: 'across' as const };
    let next = selectCell(model, cursor, at(1, 2));
    expect(next).toEqual({ cell: at(1, 2), dir: 'down' });
    next = selectCell(model, { cell: at(0, 2), dir: 'across' }, at(0, 2));
    expect(next.dir).toBe('down');
    // A square with a single word cannot toggle.
    cursor = { cell: at(0, 0), dir: 'across' };
    expect(selectCell(model, cursor, at(0, 0))).toEqual(cursor);
    expect(toggleDir(model, cursor)).toEqual(cursor);
    // Black squares cannot be selected.
    expect(selectCell(model, cursor, at(1, 0))).toBe(cursor);
  });

  it('fixes invalid cursors and starts at the first empty square', () => {
    expect(fixCursor(model, { cell: at(1, 0), dir: 'down' })).toEqual({ cell: 0, dir: 'across' });
    const play = setEntry(newPlay(model), model, 0, 'C');
    expect(initialCursor(model, play)).toEqual({ cell: 1, dir: 'across' });
  });

  it('arrows move over empty squares and set the direction', () => {
    expect(moveArrow(model, { cell: at(0, 2), dir: 'across' }, 'down')).toEqual({ cell: at(1, 2), dir: 'down' });
    expect(moveArrow(model, { cell: at(2, 2), dir: 'across' }, 'right')).toEqual({ cell: at(2, 3), dir: 'across' });
    // Jumps over the gap in column 3 (row 1 is empty there).
    expect(moveArrow(model, { cell: at(0, 3), dir: 'across' }, 'down')).toEqual({ cell: at(2, 3), dir: 'across' });
    // At the edge it stays.
    expect(moveArrow(model, { cell: at(0, 0), dir: 'across' }, 'left')).toEqual({ cell: at(0, 0), dir: 'across' });
  });

  it('typing advances inside the word and then jumps to the next clue', () => {
    let play = newPlay(model);
    let cursor = { cell: at(0, 0), dir: 'across' as const } as { cell: number; dir: 'across' | 'down' };
    for (const letter of 'CASA') ({ play, cursor } = typeLetter(model, play, cursor, letter, opts));
    expect(play.entries.slice(0, 4).join('')).toBe('CASA');
    // CASA is full: the cursor moves to the first empty square of the next clue (3 across).
    expect(cursor).toEqual({ cell: at(2, 2), dir: 'across' });
  });

  it('skip-filled mode jumps over squares that already have letters', () => {
    let play = fill(model, newPlay(model), { [at(0, 1)]: 'A' });
    let cursor = { cell: at(0, 0), dir: 'across' as 'across' | 'down' };
    ({ play, cursor } = typeLetter(model, play, cursor, 'C', { skipFilled: true }));
    expect(cursor.cell).toBe(at(0, 2));
    ({ play, cursor } = typeLetter(model, play, { cell: at(0, 0), dir: 'across' }, 'C', { skipFilled: false }));
    expect(cursor.cell).toBe(at(0, 1));
  });

  it('typing on a locked square only advances', () => {
    let play = reveal(newPlay(model), model, { kind: 'cell', cell: 0 }).play;
    const res = typeLetter(model, play, { cell: 0, dir: 'across' }, 'Z', opts);
    play = res.play;
    expect(play.entries[0]).toBe('C');
    expect(res.cursor.cell).toBe(1);
  });

  it('backspace clears the square, or moves back and clears the previous one', () => {
    let play = fill(model, newPlay(model), { [at(0, 0)]: 'C', [at(0, 1)]: 'A' });
    let res = backspace(model, play, { cell: at(0, 1), dir: 'across' });
    expect(res.play.entries[at(0, 1)]).toBe('');
    expect(res.cursor.cell).toBe(at(0, 1));
    res = backspace(model, res.play, res.cursor);
    expect(res.play.entries[at(0, 0)]).toBe('');
    expect(res.cursor.cell).toBe(at(0, 0));
    // At the start of the word nothing else happens.
    play = res.play;
    expect(backspace(model, play, res.cursor).cursor.cell).toBe(at(0, 0));
  });

  it('next / previous clue follows clue order and wraps', () => {
    const play = newPlay(model);
    let cursor = { cell: at(0, 1), dir: 'across' as 'across' | 'down' };
    cursor = stepWord(model, play, cursor, 1);
    expect(wordAt(model, cursor.cell, cursor.dir)).toBe(1); // 3 across
    cursor = stepWord(model, play, cursor, 1);
    expect(wordAt(model, cursor.cell, cursor.dir)).toBe(2); // 2 down
    cursor = stepWord(model, play, cursor, 1);
    expect(wordAt(model, cursor.cell, cursor.dir)).toBe(0); // back to 1 across
    cursor = stepWord(model, play, cursor, -1);
    expect(cursor).toEqual({ cell: at(0, 2), dir: 'down' });
  });

  it('selecting a word goes to its first empty square', () => {
    const play = fill(model, newPlay(model), { [at(0, 2)]: 'S' });
    expect(selectWord(model, play, 2)).toEqual({ cell: at(1, 2), dir: 'down' });
  });
});
