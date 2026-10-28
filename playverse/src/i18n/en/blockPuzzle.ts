import type { BlockPuzzleMessages } from '../pt/blockPuzzle';

/** "2 lines", "1 square"… for the groups cleared by one placement. */
function clearParts(lines: number, squares: number): string[] {
  const parts: string[] = [];
  if (lines > 0) parts.push(lines === 1 ? '1 line' : `${lines} lines`);
  if (squares > 0) parts.push(squares === 1 ? '1 square' : `${squares} squares`);
  return parts;
}

export const blockPuzzle: BlockPuzzleMessages = {
  help: {
    intro:
      'Fit the pieces onto the 9 × 9 board. Complete rows, columns or 3 × 3 squares to clear them and score points. The game ends when none of your pieces fits on the board.',
    sections: [
      {
        title: 'Rules',
        items: [
          'You get 3 pieces at a time. New pieces are dealt only after you have placed all three, in any order you like.',
          'Pieces do not rotate: every orientation is a different piece.',
          'A piece can only be placed entirely inside the board and on empty cells.',
          'When a row, a column or one of the nine highlighted 3 × 3 squares is complete, it is cleared. Everything that is complete clears at the same time; a cell that belongs to several of them counts only once.',
          'The 3 × 3 squares are the shaded blocks of the board (3 by 3 cells, not overlapping).',
          'Pieces that do not fit anywhere are shown dimmed.',
          'Whenever any piece can fit on the board, at least one of the three new pieces fits — but there is never a guarantee that all of them do, so plan carefully.',
          'The game ends when none of your remaining pieces fits on the board.',
        ],
      },
      {
        title: 'Controls',
        items: [
          'Drag: drag a piece from the tray onto the board. The shadow shows where it will land and the rows, columns and squares that will be cleared light up. If you drop it in an invalid spot, it goes back to the tray.',
          'On touch screens the dragged piece floats a little above your finger so you can see it.',
          'Tap: tap a piece to select it, then tap a cell on the board. The tapped cell becomes the centre of the piece (for pieces with an even width or height, the cell just left of or above the centre) and, near the edges, the piece is shifted inside the board. With a mouse you see a preview before clicking.',
          'Keyboard: 1, 2 and 3 select a piece, the arrow keys move it on the board, Enter or Space place it and Esc cancels the selection. P pauses the game.',
        ],
      },
      {
        title: 'Scoring',
        items: [
          '1 point for every block placed.',
          'Clearing L groups at once (each row, column or 3 × 3 square counts as one group) is worth 10 × L × L points: 1 → 10, 2 → 40, 3 → 90, 4 → 160.',
          'Combo: each placement in a row that clears at least one group raises the combo (×1, ×2, ×3…) and clear points are multiplied by the combo. A placement that clears nothing resets the combo to zero.',
          'Example: a 4-block piece that completes a row and a square (2 groups) on a ×3 combo earns 4 + 40 × 3 = 124 points.',
        ],
      },
    ],
  },
  lines: 'Clears',
  combo: (n: number) => `Combo ×${n}`,
  comboLabel: (n: number) => `Current combo: ${n}`,
  clearsPopup: (lines: number, squares: number) => `${clearParts(lines, squares).join(' + ')}!`,
  boardLabel: '9 by 9 board',
  cellLabel: (row: number, col: number, state: string) => `Row ${row}, column ${col}: ${state}`,
  cellEmpty: 'empty',
  cellFilled: 'filled',
  trayLabel: 'Available pieces',
  slotLabel: (slot: number, name: string, blocks: number) => `Piece ${slot}: ${name}, ${blocks === 1 ? '1 block' : `${blocks} blocks`}`,
  slotEmpty: (slot: number) => `Slot ${slot}: piece already placed`,
  slotNoFit: 'does not fit on the board',
  shapes: {
    mono: 'single block',
    line2: 'line of 2',
    line3: 'line of 3',
    line4: 'line of 4',
    line5: 'line of 5',
    square2: '2 × 2 square',
    square3: '3 × 3 square',
    corner3: 'small corner',
    l4: 'L piece',
    j4: 'J piece',
    t4: 'T piece',
    s4: 'S piece',
    z4: 'Z piece',
    corner5: 'big corner',
  },
  orientation: {
    horizontal: 'horizontal',
    vertical: 'vertical',
  },
  hintIdle: 'Drag a piece onto the board or tap it to select it.',
  hintSelected: 'Tap a cell on the board to place the piece.',
  hintNoFit: 'This piece does not fit anywhere. Pick another one.',
  announce: {
    selected: (name: string) => `Selected: ${name}. Use the arrow keys and Enter, or tap the board.`,
    selectedNoFit: (name: string) => `Selected: ${name}. This piece does not fit anywhere.`,
    cancelled: 'Selection cancelled.',
    position: (row: number, col: number, valid: boolean) => `Row ${row}, column ${col}${valid ? '' : ': does not fit here'}`,
    placed: (gained: number, score: number) => `Piece placed. +${gained} points, total ${score}.`,
    cleared: (lines: number, squares: number, combo: number) => `Cleared ${clearParts(lines, squares).join(' and ')}${combo >= 2 ? `, combo ×${combo}` : ''}.`,
    newPieces: 'New pieces in the tray.',
    invalid: 'You cannot place the piece there.',
    emptySlot: 'That slot is already empty.',
  },
  overBody: 'None of the remaining pieces fits on the board.',
  bestCombo: 'Best combo',
  piecesPlaced: 'Pieces placed',
  totalPiecesPlaced: 'Pieces placed (total)',
};
