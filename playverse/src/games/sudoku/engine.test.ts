import { describe, expect, it } from 'vitest';
import { bit, cellAt, parseGrid, PEERS } from './grid';
import {
  HINT_LIMIT,
  applyHint,
  canUndo,
  checkBoard,
  conflicts,
  erase,
  findHint,
  hasProgress,
  hintsLeft,
  isLocked,
  newGame,
  placeDigit,
  placedCounts,
  restart,
  toggleNote,
  undo,
  visibleErrors,
  wrongCells,
  type PlayOptions,
  type SudokuState,
} from './engine';
import { EXAMPLES } from './fixtures';
import { solve } from './solver';

const IMMEDIATE: PlayOptions = { autoNotes: true, errorMode: 'immediate' };
const ON_CHECK: PlayOptions = { autoNotes: true, errorMode: 'onCheck' };

function game(text: string = EXAMPLES.easy): SudokuState {
  const puzzle = parseGrid(text);
  return newGame({ puzzle, solution: solve(puzzle)!, difficulty: 'easy', seed: 7 });
}

/** First empty cell, its correct digit and a wrong digit for it. */
function emptyCell(s: SudokuState, from = 0) {
  const cell = s.values.findIndex((v, i) => i >= from && v === 0);
  const right = s.solution[cell]!;
  return { cell, right, wrong: right === 9 ? 1 : right + 1 };
}

describe('placing digits', () => {
  it('fills an empty cell and records it for undo', () => {
    const s = game();
    const { cell, right } = emptyCell(s);
    const r = placeDigit(s, cell, right, IMMEDIATE);
    expect(r.status).toBe('placed');
    expect(r.state.values[cell]).toBe(right);
    expect(r.state.mistakes).toBe(0);
    expect(canUndo(r.state)).toBe(true);
    expect(hasProgress(r.state)).toBe(true);
    expect(hasProgress(s)).toBe(false);
  });

  it('ignores given cells, invalid digits and repeats', () => {
    const s = game();
    const given = s.givens.findIndex((d) => d !== 0);
    expect(isLocked(s, given)).toBe(true);
    expect(placeDigit(s, given, 1).status).toBe('ignored');
    expect(placeDigit(s, 0, 0).status).toBe('ignored');
    expect(placeDigit(s, 0, 10).status).toBe('ignored');
    expect(placeDigit(s, -1, 1).status).toBe('ignored');
    const { cell, right } = emptyCell(s);
    const once = placeDigit(s, cell, right).state;
    expect(placeDigit(once, cell, right).status).toBe('ignored');
  });

  it('counts mistakes immediately in immediate mode', () => {
    const s = game();
    const { cell, wrong } = emptyCell(s);
    const r = placeDigit(s, cell, wrong, IMMEDIATE);
    expect(r.status).toBe('wrong');
    expect(r.state.mistakes).toBe(1);
    expect(visibleErrors(r.state, 'immediate')[cell]).toBe(true);
  });

  it('only counts mistakes when checking in onCheck mode (each wrong cell once)', () => {
    const s = game();
    const a = emptyCell(s);
    const b = emptyCell(s, a.cell + 1);
    let st = placeDigit(s, a.cell, a.wrong, ON_CHECK).state;
    expect(st.mistakes).toBe(0);
    expect(visibleErrors(st, 'onCheck')[a.cell]).toBe(false);
    let check = checkBoard(st);
    expect(check.wrong).toBe(1);
    expect(check.newlyFound).toBe(1);
    st = check.state;
    expect(st.mistakes).toBe(1);
    expect(visibleErrors(st, 'onCheck')[a.cell]).toBe(true);
    // Checking again does not count the same mistake twice.
    st = placeDigit(st, b.cell, b.wrong, ON_CHECK).state;
    check = checkBoard(st);
    expect(check.newlyFound).toBe(1);
    expect(check.state.mistakes).toBe(2);
    // Changing a flagged cell removes its flag.
    st = placeDigit(check.state, a.cell, a.right, ON_CHECK).state;
    expect(st.flagged).toEqual([b.cell]);
    expect(checkBoard(game()).wrong).toBe(0);
  });

  it('detects conflicts with peers (not just mistakes)', () => {
    const s = game();
    const { cell } = emptyCell(s);
    const peerGiven = PEERS[cell]!.find((p) => s.givens[p] !== 0)!;
    const r = placeDigit(s, cell, s.givens[peerGiven]!, IMMEDIATE).state;
    const c = conflicts(r);
    expect(c[cell]).toBe(true);
    expect(c[peerGiven]).toBe(true);
    expect(c.filter(Boolean)).toHaveLength(2);
  });

  it('counts placed digits for the number pad', () => {
    const s = game();
    const counts = placedCounts(s);
    const { cell, right } = emptyCell(s);
    expect(placedCounts(placeDigit(s, cell, right).state)[right]).toBe(counts[right]! + 1);
  });
});

describe('notes', () => {
  it('toggles pencil marks on empty cells only', () => {
    const s = game();
    const { cell } = emptyCell(s);
    let st = toggleNote(s, cell, 4);
    st = toggleNote(st, cell, 6);
    expect(st.notes[cell]).toBe(bit(4) | bit(6));
    st = toggleNote(st, cell, 4);
    expect(st.notes[cell]).toBe(bit(6));
    const given = s.givens.findIndex((d) => d !== 0);
    expect(toggleNote(s, given, 1)).toBe(s);
    const filled = placeDigit(s, cell, s.solution[cell]!).state;
    expect(toggleNote(filled, cell, 2)).toBe(filled);
  });

  it('placing a digit clears its notes and removes the digit from peer notes (auto notes)', () => {
    const s = game();
    const { cell, right } = emptyCell(s);
    const peers = PEERS[cell]!.filter((p) => s.values[p] === 0).slice(0, 3);
    const far = s.values.findIndex((v, i) => v === 0 && i !== cell && !PEERS[cell]!.includes(i));
    let st = toggleNote(s, cell, right);
    for (const p of [...peers, far]) st = toggleNote(st, p, right);
    st = toggleNote(st, peers[0]!, right === 1 ? 2 : 1);
    const placed = placeDigit(st, cell, right, IMMEDIATE).state;
    expect(placed.notes[cell]).toBe(0);
    for (const p of peers) expect(placed.notes[p]! & bit(right)).toBe(0);
    expect(placed.notes[peers[0]!]).toBe(bit(right === 1 ? 2 : 1));
    expect(placed.notes[far]).toBe(bit(right)); // not a peer: untouched
    // Undo restores every note in one step.
    expect(undo(placed).notes).toEqual(st.notes);
    // With auto notes off, peers keep their notes.
    const manual = placeDigit(st, cell, right, { autoNotes: false, errorMode: 'immediate' }).state;
    for (const p of peers) expect(manual.notes[p]! & bit(right)).not.toBe(0);
  });
});

describe('erase, undo and restart', () => {
  it('erases digits first, then notes', () => {
    const s = game();
    const { cell, wrong } = emptyCell(s);
    const withNote = toggleNote(s, cell, 3);
    expect(erase(withNote, cell).notes[cell]).toBe(0);
    const filled = placeDigit(s, cell, wrong).state;
    const erased = erase(filled, cell);
    expect(erased.values[cell]).toBe(0);
    expect(erase(erased, cell)).toBe(erased);
    const given = s.givens.findIndex((d) => d !== 0);
    expect(erase(s, given)).toBe(s);
  });

  it('undoes actions in order and keeps the mistake counter', () => {
    const s = game();
    const { cell, right, wrong } = emptyCell(s);
    const s1 = placeDigit(s, cell, wrong, IMMEDIATE).state;
    const s2 = placeDigit(s1, cell, right, IMMEDIATE).state;
    const back1 = undo(s2);
    expect(back1.values[cell]).toBe(wrong);
    const back0 = undo(back1);
    expect(back0.values[cell]).toBe(0);
    expect(back0.mistakes).toBe(1);
    expect(canUndo(back0)).toBe(false);
    expect(undo(back0)).toBe(back0);
  });

  it('restart clears entries, notes, hints and counters', () => {
    const s = game();
    const { cell, wrong } = emptyCell(s);
    let st = placeDigit(s, cell, wrong, IMMEDIATE).state;
    st = toggleNote(st, emptyCell(st).cell, 2);
    st = applyHint(st, findHint(st)!);
    const r = restart(st);
    expect(r.values).toEqual(s.givens);
    expect(r.notes.every((n) => n === 0)).toBe(true);
    expect(r.mistakes).toBe(0);
    expect(r.hintsUsed).toBe(0);
    expect(r.hinted).toEqual([]);
    expect(r.history).toEqual([]);
    expect(hasProgress(r)).toBe(false);
  });
});

describe('win detection', () => {
  it('is solved exactly when the grid equals the solution', () => {
    let s = game();
    const empties = s.values.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    const last = empties.pop()!;
    for (const c of empties) s = placeDigit(s, c, s.solution[c]!).state;
    expect(s.solved).toBe(false);
    const wrong = s.solution[last] === 9 ? 1 : s.solution[last]! + 1;
    const almost = placeDigit(s, last, wrong).state;
    expect(almost.solved).toBe(false);
    const done = placeDigit(almost, last, s.solution[last]!);
    expect(done.status).toBe('solved');
    expect(done.state.solved).toBe(true);
    // Nothing can change a solved grid.
    expect(placeDigit(done.state, last, wrong).status).toBe('ignored');
    expect(erase(done.state, last)).toBe(done.state);
    expect(undo(done.state)).toBe(done.state);
    expect(findHint(done.state)).toBeNull();
  });
});

describe('hints', () => {
  it('fills the selected empty cell with its correct digit', () => {
    const s = game();
    const { cell, right } = emptyCell(s);
    const hint = findHint(s, cell)!;
    expect(hint).toMatchObject({ cell, digit: right, kind: 'selected' });
    const after = applyHint(s, hint);
    expect(after.values[cell]).toBe(right);
    expect(after.hintsUsed).toBe(1);
    expect(isLocked(after, cell)).toBe(true);
    expect(hintsLeft(after)).toBe(HINT_LIMIT - 1);
  });

  it('explains a selected cell that can be deduced directly', () => {
    const s = game();
    const logic = findHint(s)!;
    const selected = findHint(s, logic.cell)!;
    expect(selected.kind).toBe('selected');
    expect(selected.technique).toBe(logic.technique);
  });

  it('without a selection gives the next logically deducible cell with its technique', () => {
    const s = game();
    const hint = findHint(s)!;
    expect(hint.kind).toBe('logic');
    expect(hint.digit).toBe(s.solution[hint.cell]);
    expect(['nakedSingle', 'hiddenSingle']).toContain(hint.technique);
    expect(s.values[hint.cell]).toBe(0);
  });

  it('reports the support techniques needed before the placement', () => {
    const puzzle = parseGrid(EXAMPLES.xWing);
    let s = newGame({ puzzle, solution: solve(puzzle)!, difficulty: 'hard', seed: 1 });
    // Play the singles until the X-Wing is needed, then ask for a hint.
    for (let guard = 0; guard < 81; guard++) {
      const h = findHint(s)!;
      if (h.support.length > 0) {
        expect(h.support.length).toBeGreaterThan(0);
        expect(h.digit).toBe(s.solution[h.cell]);
        return;
      }
      s = placeDigit(s, h.cell, h.digit).state;
    }
    throw new Error('expected a hint that needs eliminations first');
  });

  it('corrects a wrong digit first (selected or not)', () => {
    const s = game();
    const { cell, right, wrong } = emptyCell(s);
    const st = placeDigit(s, cell, wrong, ON_CHECK).state;
    expect(wrongCells(st)).toEqual([cell]);
    const other = emptyCell(st, cell + 1).cell;
    const hint = findHint(st, cellAt(0, 2))!; // selection on a given cell is ignored
    expect(hint).toMatchObject({ cell, digit: right, kind: 'mistake' });
    expect(findHint(st, cell)).toMatchObject({ cell, kind: 'mistake' });
    expect(findHint(st, other)).toMatchObject({ cell: other, kind: 'selected' });
    expect(applyHint(st, hint).values[cell]).toBe(right);
  });

  it('reveals the most constrained cell when logic is stuck', () => {
    const puzzle = parseGrid(EXAMPLES.inkala);
    const s = newGame({ puzzle, solution: solve(puzzle)!, difficulty: 'expert', seed: 1 });
    const hint = findHint(s)!;
    expect(hint.kind).toBe('reveal');
    expect(hint.technique).toBeNull();
    expect(s.values[hint.cell]).toBe(0);
    expect(hint.digit).toBe(s.solution[hint.cell]);
  });

  it('is limited per puzzle and locked cells survive undo', () => {
    let s = game();
    const { cell, wrong } = emptyCell(s);
    s = placeDigit(s, cell, wrong).state;
    for (let i = 0; i < HINT_LIMIT; i++) s = applyHint(s, findHint(s, i === 0 ? cell : null)!);
    expect(hintsLeft(s)).toBe(0);
    expect(applyHint(s, findHint(s)!)).toBe(s);
    // The wrong placement is still in the history, but undo must not overwrite the hinted cell.
    const undone = undo(s);
    expect(undone.values[cell]).toBe(s.solution[cell]);
  });
});
