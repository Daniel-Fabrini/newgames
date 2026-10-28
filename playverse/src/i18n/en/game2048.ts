import type { Game2048Messages } from '../pt/game2048';

export const game2048: Game2048Messages = {
  help: {
    intro: 'Slide the tiles to join them. When two tiles with the same number touch, they merge into one worth double. Reach the 2048 tile!',
    sections: [
      {
        title: 'Rules',
        items: [
          'Each move slides every tile as far as possible in the chosen direction.',
          'Two equal tiles merge into one; each tile can only merge once per move.',
          'After every move that changes the board, a new tile (2 or 4) appears in an empty cell.',
          'If a move does not shift any tile, no new tile appears.',
          'You win when you create the 2048 tile, and you can keep playing to go further.',
          'The game ends when the board is full and no merge is possible.',
        ],
      },
      {
        title: 'Controls',
        items: [
          'Phone: swipe on the board.',
          'Keyboard: arrow keys or W, A, S, D. U undoes, P or Esc pauses.',
          'You can also use the direction buttons below the board.',
        ],
      },
      {
        title: 'Scoring',
        items: ['Every merge adds the value of the new tile to your score (2 + 2 = 4 points).', 'You can undo up to 10 moves in a row.'],
      },
    ],
  },
  reachedTitle: 'You reached 2048!',
  reachedBody: 'Fantastic! You can keep playing to try for an even bigger tile.',
  overBody: 'No more moves are possible.',
  bestTile: 'Biggest tile',
  boardLabel: '2048 board, 4 by 4',
  cellEmpty: 'empty',
  cellLabel: (row: number, col: number, value: string) => `Row ${row}, column ${col}: ${value}`,
  directionsLabel: 'Move tiles',
  directions: {
    up: 'Move up',
    down: 'Move down',
    left: 'Move left',
    right: 'Move right',
  },
  movedAnnouncement: (score: number) => `Score: ${score}`,
  undoLimit: (n: number) => `You can undo ${n} more`,
};
