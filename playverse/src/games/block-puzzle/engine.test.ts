import { describe, expect, it } from 'vitest';
import { Rng } from '../../utils/random';
import {
  CELLS,
  CROWD_MIN_FACTOR,
  SIZE,
  anchorForTap,
  boxCells,
  canPlace,
  clampAnchor,
  completedLines,
  crowdFactor,
  dealTrio,
  emptyBoard,
  fillRatio,
  fitsAnywhere,
  hasAnyMove,
  indexOf,
  lineClearPoints,
  linesAfterPlacing,
  newGame,
  place,
  shapeWeights,
  trayFits,
  validPlacements,
  type GameState,
  type PlaceOutcome,
} from './engine';
import { SHAPES, shapeOf } from './shapes';
import { boardFrom, isolatedHolesBoard, stateWith } from './test-utils';

const EMPTY = Array<string>(SIZE).fill('.........');

/** Applies a placement that must be legal. */
function mustPlace(state: GameState, slot: number, row: number, col: number): PlaceOutcome {
  const out = place(state, slot, row, col);
  if (!out) throw new Error(`illegal placement ${slot} @ ${row},${col}`);
  return out;
}

/** Plays a whole game with a simple seeded bot (random legal placement); returns every outcome. */
function playBot(seed: number, botSeed: number, maxMoves = 400): { states: GameState[]; outcomes: PlaceOutcome[] } {
  let state = newGame(seed);
  const bot = new Rng(botSeed);
  const states = [state];
  const outcomes: PlaceOutcome[] = [];
  for (let i = 0; i < maxMoves && !state.over; i++) {
    const options: Array<{ slot: number; row: number; col: number }> = [];
    state.tray.forEach((p, slot) => {
      if (p) for (const a of validPlacements(state.board, shapeOf(p.shape))) options.push({ slot, ...a });
    });
    const choice = bot.pick(options);
    const out = mustPlace(state, choice.slot, choice.row, choice.col);
    outcomes.push(out);
    state = out.state;
    states.push(state);
  }
  return { states, outcomes };
}

describe('placement validity', () => {
  const board = emptyBoard();

  it('accepts pieces flush with every edge and rejects them one cell further', () => {
    const h5 = shapeOf('line5-0');
    const v5 = shapeOf('line5-1');
    expect(h5.w).toBe(5);
    expect(canPlace(board, h5, 0, 4)).toBe(true);
    expect(canPlace(board, h5, 8, 4)).toBe(true);
    expect(canPlace(board, h5, 0, 5)).toBe(false);
    expect(canPlace(board, v5, 4, 8)).toBe(true);
    expect(canPlace(board, v5, 5, 8)).toBe(false);
    expect(canPlace(board, shapeOf('square3-0'), 6, 6)).toBe(true);
    expect(canPlace(board, shapeOf('square3-0'), 7, 6)).toBe(false);
  });

  it('rejects negative and non-integer anchors', () => {
    const mono = shapeOf('mono-0');
    expect(canPlace(board, mono, -1, 0)).toBe(false);
    expect(canPlace(board, mono, 0, -1)).toBe(false);
    expect(canPlace(board, mono, 9, 0)).toBe(false);
    expect(canPlace(board, mono, 0.5, 0)).toBe(false);
  });

  it('rejects overlaps but allows a filled cell inside the empty part of the bounding box', () => {
    const b = emptyBoard();
    b[indexOf(4, 4)] = 3;
    const sq = shapeOf('square2-0');
    expect(canPlace(b, sq, 3, 3)).toBe(false);
    expect(canPlace(b, sq, 4, 4)).toBe(false);
    expect(canPlace(b, sq, 4, 5)).toBe(true);
    // corner3-0 covers (0,0), (1,0), (1,1): its empty top-right corner may sit on a filled cell
    const corner = shapeOf('corner3-0');
    expect(corner.cells).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(canPlace(b, corner, 4, 3)).toBe(true);
  });

  it('counts every legal anchor on an empty board', () => {
    expect(validPlacements(board, shapeOf('mono-0'))).toHaveLength(81);
    expect(validPlacements(board, shapeOf('line5-0'))).toHaveLength(9 * 5);
    expect(validPlacements(board, shapeOf('square3-0'))).toHaveLength(7 * 7);
  });

  it('detects when a shape fits nowhere', () => {
    const holes = isolatedHolesBoard();
    expect(fitsAnywhere(holes, shapeOf('mono-0'))).toBe(true);
    for (const s of SHAPES) if (s.id !== 'mono-0') expect(fitsAnywhere(holes, s)).toBe(false);
  });

  it('rejects illegal moves without changing the state', () => {
    const s = stateWith(boardFrom(['#........', ...EMPTY.slice(1)]), ['square2-0', null, 'mono-0']);
    expect(place(s, 0, 0, 0)).toBeNull(); // overlap
    expect(place(s, 0, 8, 0)).toBeNull(); // out of the board
    expect(place(s, 1, 4, 4)).toBeNull(); // empty slot
    expect(place(s, 5, 4, 4)).toBeNull(); // no such slot
    expect(place({ ...s, over: true }, 0, 4, 4)).toBeNull();
    expect(s.board[0]).toBe(1);
    expect(s.tray[0]?.shape).toBe('square2-0');
  });
});

describe('anchor rules', () => {
  it('centres tapped pieces on the tapped cell (left/above the centre for even sizes)', () => {
    expect(anchorForTap(shapeOf('square3-0'), 4, 4)).toEqual({ row: 3, col: 3 });
    expect(anchorForTap(shapeOf('mono-0'), 4, 4)).toEqual({ row: 4, col: 4 });
    expect(anchorForTap(shapeOf('line2-0'), 4, 4)).toEqual({ row: 4, col: 4 });
    expect(anchorForTap(shapeOf('line4-0'), 4, 4)).toEqual({ row: 4, col: 3 });
    expect(anchorForTap(shapeOf('square2-0'), 4, 4)).toEqual({ row: 4, col: 4 });
  });

  it('shifts tapped pieces inside the board near the edges', () => {
    expect(anchorForTap(shapeOf('square3-0'), 0, 0)).toEqual({ row: 0, col: 0 });
    expect(anchorForTap(shapeOf('square3-0'), 8, 8)).toEqual({ row: 6, col: 6 });
    expect(anchorForTap(shapeOf('line5-1'), 8, 3)).toEqual({ row: 4, col: 3 });
    expect(clampAnchor(shapeOf('line5-0'), -3, 7)).toEqual({ row: 0, col: 4 });
  });
});

describe('line clears', () => {
  it('clears a completed row', () => {
    const s = stateWith(boardFrom(['########.', ...EMPTY.slice(1)]), ['mono-0', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 0, 8);
    expect(out.rows).toEqual([0]);
    expect(out.cols).toEqual([]);
    expect(out.lines).toBe(1);
    expect(out.cleared).toHaveLength(9);
    expect(out.state.board.every((v) => v === 0)).toBe(true);
    expect(out.state.lines).toBe(1);
  });

  it('clears a completed column', () => {
    const rows = ['...#.....', '...#.....', '...#.....', '...#.....', '.........', '...#.....', '...#.....', '...#.....', '...#.....'];
    const s = stateWith(boardFrom(rows), ['mono-0', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 4, 3);
    expect(out.cols).toEqual([3]);
    expect(out.rows).toEqual([]);
    expect(out.state.board.every((v) => v === 0)).toBe(true);
  });

  it('clears a row and a column at once, counting the shared cell once', () => {
    const rows = ['....#....', '....#....', '....#....', '....#....', '####.####', '....#....', '....#....', '....#....', '....#...#'];
    const s = stateWith(boardFrom(rows), ['mono-0', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 4, 4);
    expect(out.rows).toEqual([4]);
    expect(out.cols).toEqual([4]);
    expect(out.lines).toBe(2);
    expect(out.cleared).toHaveLength(17);
    // The unrelated block survives
    expect(out.state.board[indexOf(8, 8)]).toBe(1);
    expect(out.state.board.filter((v) => v !== 0)).toHaveLength(1);
  });

  it('clears several rows completed by one piece and keeps the colours of cleared cells', () => {
    const rows = [...EMPTY.slice(0, 6), '.22222222', '.33333333', '#........'];
    const s = stateWith(boardFrom(rows), ['line2-1', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 6, 0);
    expect(out.rows).toEqual([6, 7]);
    expect(out.cleared.map((c) => c.color)).toContain(2);
    expect(out.cleared.map((c) => c.color)).toContain(3);
    expect(out.state.board[indexOf(8, 0)]).toBe(1);
  });

  it('predicts the lines a placement would clear (for the preview)', () => {
    const rows = ['########.', ...EMPTY.slice(1)];
    const b = boardFrom(rows);
    expect(linesAfterPlacing(b, shapeOf('mono-0'), 0, 8)).toEqual({ rows: [0], cols: [], boxes: [] });
    expect(linesAfterPlacing(b, shapeOf('mono-0'), 1, 8)).toEqual({ rows: [], cols: [], boxes: [] });
    expect(linesAfterPlacing(b, shapeOf('mono-0'), 0, 0)).toEqual({ rows: [], cols: [], boxes: [] }); // illegal
    expect(completedLines(b)).toEqual({ rows: [], cols: [], boxes: [] });
  });
});

describe('3×3 square clears', () => {
  it('numbers the squares in reading order', () => {
    expect(boxCells(0)).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
    expect(boxCells(4)).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
    expect(boxCells(8)).toEqual([60, 61, 62, 69, 70, 71, 78, 79, 80]);
  });

  it('clears a completed square', () => {
    // Centre square full except its middle cell, plus an unrelated block.
    const rows = [...EMPTY.slice(0, 3), '...###...', '...#.#...', '...###...', ...EMPTY.slice(6, 8), '#........'];
    const s = stateWith(boardFrom(rows), ['mono-0', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 4, 4);
    expect(out.boxes).toEqual([4]);
    expect(out.rows).toEqual([]);
    expect(out.cols).toEqual([]);
    expect(out.lines).toBe(1);
    expect(out.cleared).toHaveLength(9);
    expect(out.gained).toBe(1 + 10);
    expect(out.state.board.filter((v) => v !== 0)).toHaveLength(1);
    expect(out.state.lines).toBe(1);
  });

  it('clears a square and a row together, counting the shared cells once', () => {
    // Row 0 and the top-left square both miss only (0,0).
    const rows = ['.########', '###......', '###......', ...EMPTY.slice(3)];
    const s = stateWith(boardFrom(rows), ['mono-0', 'mono-0', 'mono-0']);
    const out = mustPlace(s, 0, 0, 0);
    expect(out.rows).toEqual([0]);
    expect(out.boxes).toEqual([0]);
    expect(out.lines).toBe(2);
    expect(out.cleared).toHaveLength(9 + 9 - 3);
    expect(out.gained).toBe(1 + 40);
    expect(out.state.board.every((v) => v === 0)).toBe(true);
  });

  it('predicts square clears for the preview', () => {
    const rows = [...EMPTY.slice(0, 6), '......##.', '......###', '......###'];
    expect(linesAfterPlacing(boardFrom(rows), shapeOf('mono-0'), 6, 8)).toEqual({ rows: [], cols: [], boxes: [8] });
  });
});

describe('scoring', () => {
  it('awards one point per block for a placement without clears', () => {
    // Offset by one cell, the 3×3 piece straddles four squares and completes none.
    const out = mustPlace(stateWith(emptyBoard(), ['square3-0', 'mono-0', 'mono-0']), 0, 1, 1);
    expect(out.gained).toBe(9);
    expect(out.state.score).toBe(9);
    expect(out.combo).toBe(0);
  });

  it('uses 10 × L² for L lines at once, multiplied by the combo', () => {
    expect(lineClearPoints(0, 3)).toBe(0);
    expect(lineClearPoints(1, 1)).toBe(10);
    expect(lineClearPoints(2, 1)).toBe(40);
    expect(lineClearPoints(3, 1)).toBe(90);
    expect(lineClearPoints(4, 1)).toBe(160);
    expect(lineClearPoints(2, 3)).toBe(120);
  });

  it('scores single, double and triple clears', () => {
    const single = mustPlace(stateWith(boardFrom(['########.', ...EMPTY.slice(1)]), ['mono-0', 'mono-0', 'mono-0']), 0, 0, 8);
    expect(single.gained).toBe(1 + 10);
    const crossRows = ['....#....', '....#....', '....#....', '....#....', '####.####', '....#....', '....#....', '....#....', '....#....'];
    const cross = mustPlace(stateWith(boardFrom(crossRows), ['mono-0', 'mono-0', 'mono-0']), 0, 4, 4);
    expect(cross.gained).toBe(1 + 40);
    const triple = mustPlace(stateWith(boardFrom(['.########', '.########', '########.', ...EMPTY.slice(3)]), ['line2-1', 'mono-0', 'mono-0']), 0, 0, 0);
    // Rows 0–1 and the top-left square complete; row 2 still misses its last cell.
    expect(triple.rows).toEqual([0, 1]);
    expect(triple.boxes).toEqual([0, 1]);
    expect(triple.lines).toBe(4);
    expect(triple.gained).toBe(2 + 160);
    // Three rows at once also fill the three squares of the band: 6 groups.
    const band = mustPlace(stateWith(boardFrom(['.########', '.########', '.########', ...EMPTY.slice(3)]), ['line3-1', 'mono-0', 'mono-0']), 0, 0, 0);
    expect(band.rows).toEqual([0, 1, 2]);
    expect(band.boxes).toEqual([0, 1, 2]);
    expect(band.lines).toBe(6);
    expect(band.gained).toBe(3 + 360);
  });

  it('builds a combo over consecutive clearing placements and resets it on a placement without clears', () => {
    // Rows 0 and 3 each miss their last cell; row 6 misses two cells (one row per band, so no square fills).
    const rows = ['########.', '.........', '.........', '########.', '.........', '.........', '#######..', '.........', '.........'];
    let s = stateWith(boardFrom(rows), ['mono-0', 'mono-0', 'mono-0']);
    const first = mustPlace(s, 0, 0, 8);
    expect(first.combo).toBe(1);
    expect(first.gained).toBe(1 + 10);
    s = first.state;
    const second = mustPlace(s, 1, 3, 8);
    expect(second.combo).toBe(2);
    expect(second.gained).toBe(1 + 10 * 2);
    s = second.state;
    const third = mustPlace(s, 2, 6, 8); // row 6 still misses (6,7): no clear
    expect(third.combo).toBe(0);
    expect(third.gained).toBe(1);
    expect(third.state.combo).toBe(0);
    expect(third.state.maxCombo).toBe(2);
    expect(third.state.lines).toBe(2);
    expect(third.state.score).toBe(11 + 21 + 1);
    expect(third.state.placed).toBe(3);
  });
});

describe('tray and dealing', () => {
  it('deals a new trio only after the three pieces are placed', () => {
    let s = stateWith(emptyBoard(), ['mono-0', 'mono-0', 'mono-0']);
    const a = mustPlace(s, 0, 0, 0);
    expect(a.dealt).toBe(false);
    expect(a.state.tray.map((p) => p?.shape ?? null)).toEqual([null, 'mono-0', 'mono-0']);
    s = mustPlace(a.state, 2, 0, 2).state;
    expect(s.tray.filter(Boolean)).toHaveLength(1);
    const c = mustPlace(s, 1, 0, 4);
    expect(c.dealt).toBe(true);
    expect(c.state.tray.every((p) => p !== null)).toBe(true);
    const ids = c.state.tray.map((p) => p?.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => (id ?? 0) >= s.nextId)).toBe(true);
    expect(c.state.rng).not.toBe(s.rng);
  });

  it('marks the pieces that fit nowhere', () => {
    const holes = isolatedHolesBoard();
    expect(trayFits(holes, stateWith(holes, ['line2-0', null, 'mono-0']).tray)).toEqual([false, false, true]);
  });
});

describe('game over', () => {
  it('detects when no remaining piece fits', () => {
    const holes = isolatedHolesBoard();
    expect(hasAnyMove(holes, stateWith(holes, ['line2-0', 'square2-0', 'corner3-0']).tray)).toBe(false);
    expect(hasAnyMove(holes, stateWith(holes, ['line2-0', null, 'mono-0']).tray)).toBe(true);
  });

  it('ends the game when the pieces left after a placement cannot be placed', () => {
    const s = stateWith(isolatedHolesBoard(), ['mono-0', 'line2-0', null]);
    expect(s.over).toBe(false);
    const out = mustPlace(s, 0, 0, 0);
    expect(out.lines).toBe(0);
    expect(out.state.over).toBe(true);
    expect(place(out.state, 1, 0, 3)).toBeNull();
  });

  it('keeps playing when a remaining piece still fits', () => {
    const out = mustPlace(stateWith(isolatedHolesBoard(), ['mono-0', 'mono-0', 'line2-0']), 0, 0, 0);
    expect(out.state.over).toBe(false);
  });

  it('checks the freshly dealt trio: the fairness rule keeps the game alive when something fits', () => {
    // Last piece fills a hole; the remaining holes only accept the 1-block piece.
    const out = mustPlace(stateWith(isolatedHolesBoard(), ['mono-0', null, null]), 0, 0, 0);
    expect(out.dealt).toBe(true);
    expect(out.state.tray.some((p) => p?.shape === 'mono-0')).toBe(true);
    expect(out.state.over).toBe(false);
  });
});

describe('piece generation', () => {
  it('reduces big pieces as the board fills up', () => {
    expect(crowdFactor(0)).toBe(1);
    expect(crowdFactor(0.35)).toBe(1);
    expect(crowdFactor(0.5)).toBeCloseTo(0.6);
    expect(crowdFactor(0.65)).toBeCloseTo(CROWD_MIN_FACTOR);
    expect(crowdFactor(1)).toBe(CROWD_MIN_FACTOR);
    for (let f = 0; f < 1; f += 0.05) expect(crowdFactor(f + 0.05)).toBeLessThanOrEqual(crowdFactor(f));

    const crowded = boardFrom(['########.', '########.', '########.', '########.', '########.', '########.', ...EMPTY.slice(6)]);
    expect(fillRatio(crowded)).toBeCloseTo(48 / 81);
    const open = shapeWeights(emptyBoard());
    const tight = shapeWeights(crowded);
    SHAPES.forEach((s, i) => {
      expect(open[i]).toBe(s.weight);
      if (s.big) expect(tight[i]).toBeLessThan(s.weight);
      else expect(tight[i]).toBe(s.weight);
    });
  });

  it('deals noticeably fewer big pieces on a crowded board', () => {
    const crowded = boardFrom(['########.', '########.', '########.', '########.', '########.', '########.', ...EMPTY.slice(6)]);
    const bigShare = (board: number[]) => {
      const rng = new Rng(2024);
      let big = 0;
      let total = 0;
      for (let i = 0; i < 1500; i++) {
        for (const id of dealTrio(board, rng)) {
          total++;
          if (shapeOf(id).big) big++;
        }
      }
      return big / total;
    };
    const open = bigShare(emptyBoard());
    const tight = bigShare(crowded);
    expect(open).toBeGreaterThan(0.1);
    expect(tight).toBeLessThan(open * 0.6);
  });

  it('guarantees at least one fitting piece when any shape fits', () => {
    const holes = isolatedHolesBoard();
    let notAllFit = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const trio = dealTrio(holes, new Rng(seed));
      expect(trio).toHaveLength(3);
      expect(trio).toContain('mono-0');
      if (!trio.every((id) => id === 'mono-0')) notAllFit++;
    }
    // ...but it does not guarantee that all three fit
    expect(notAllFit).toBeGreaterThan(300);
  });

  it('guarantees a fit on a board where only a few small shapes fit', () => {
    // Checkerboard of holes with one 3-cell gap in row 4: no line is complete.
    const rows = Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => ((r + c) % 2 === 0 ? '.' : '#')).join(''));
    rows[4] = '...#.#.#.';
    const board = boardFrom(rows);
    expect(completedLines(board)).toEqual({ rows: [], cols: [], boxes: [] });
    const fitting = SHAPES.filter((s) => fitsAnywhere(board, s)).map((s) => s.id);
    expect(fitting).toEqual(expect.arrayContaining(['mono-0', 'line2-0', 'line3-0']));
    expect(fitting.length).toBeLessThan(SHAPES.length / 2);
    for (let seed = 1; seed <= 200; seed++) {
      const trio = dealTrio(board, new Rng(seed));
      expect(trio.some((id) => fitting.includes(id))).toBe(true);
    }
  });

  it('still deals three pieces when nothing can fit', () => {
    const full = Array<number>(CELLS).fill(2);
    const trio = dealTrio(full, new Rng(7));
    expect(trio).toHaveLength(3);
    expect(trio.every((id) => SHAPES.some((s) => s.id === id))).toBe(true);
  });
});

describe('determinism and long games', () => {
  it('is deterministic for a seed', () => {
    expect(newGame(99)).toEqual(newGame(99));
    const trays = new Set(Array.from({ length: 20 }, (_, i) => newGame(i + 1).tray.map((p) => p?.shape).join()));
    expect(trays.size).toBeGreaterThan(10);
  });

  it('replays identically from the same seed and placements', () => {
    const a = playBot(31, 5, 120);
    const b = playBot(31, 5, 120);
    expect(b.states).toEqual(a.states);
  });

  it('continues identically after a JSON save/restore', () => {
    const { states } = playBot(8, 3, 30);
    const mid = states[states.length - 1] as GameState;
    if (mid.over) return;
    const restored = JSON.parse(JSON.stringify(mid)) as GameState;
    const pick = (s: GameState) => {
      const slot = s.tray.findIndex((p) => p && fitsAnywhere(s.board, shapeOf(p.shape)));
      const piece = s.tray[slot];
      if (!piece) throw new Error('no move');
      const anchor = validPlacements(s.board, shapeOf(piece.shape))[0];
      if (!anchor) throw new Error('no anchor');
      return mustPlace(s, slot, anchor.row, anchor.col).state;
    };
    let x = mid;
    let y = restored;
    for (let i = 0; i < 6 && !x.over; i++) {
      x = pick(x);
      y = pick(y);
    }
    expect(y).toEqual(x);
  });

  it('keeps the invariants through whole random games', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { states, outcomes } = playBot(seed * 101, seed);
      let score = 0;
      outcomes.forEach((o, i) => {
        const prev = states[i] as GameState;
        const s = o.state;
        score += o.gained;
        expect(s.score).toBe(score);
        expect(s.placed).toBe(i + 1);
        expect(s.board).toHaveLength(81);
        expect(completedLines(s.board)).toEqual({ rows: [], cols: [], boxes: [] });
        expect(s.tray.some((p) => p !== null)).toBe(true);
        expect(s.over).toBe(!hasAnyMove(s.board, s.tray));
        expect(s.maxCombo).toBeGreaterThanOrEqual(s.combo);
        expect(s.lines).toBe(prev.lines + o.lines);
        if (o.dealt && SHAPES.some((sh) => fitsAnywhere(s.board, sh))) expect(s.over).toBe(false);
      });
      const last = states[states.length - 1] as GameState;
      // The random bot eventually runs out of room
      expect(last.over || outcomes.length === 400).toBe(true);
    }
  });
});
