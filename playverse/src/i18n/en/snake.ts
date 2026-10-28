import type { SnakeMessages } from '../pt/snake';

export const snake: SnakeMessages = {
  help: {
    intro: 'Steer the snake, eat apples to grow and don’t crash into anything. The more you eat, the faster it goes!',
    rules: [
      'The snake keeps moving on its own, one cell at a time; you only choose where it turns.',
      'Each apple makes the snake one cell longer and scores points. A new one appears straight away on a random free cell.',
      'You may move into the cell holding the tip of the tail, because the tail leaves it at that very moment.',
      'Running into your own body always ends the run.',
      'If the snake fills the whole board, you win!',
    ],
    modesTitle: 'Modes',
    modes: [
      'Classic: the edges of the board are walls (solid frame). Hitting a wall or your own body ends the run.',
      'Endless: there are no walls (dashed frame) — leave on one side and come back on the opposite side. Only your own body can stop you.',
    ],
    speedTitle: 'Difficulty and speed',
    speed: (difficulty: string, startMs: string, accelMs: string, minMs: string) =>
      `${difficulty}: starts at one cell every ${startMs} ms and speeds up by ${accelMs} ms per apple, up to a limit of one cell every ${minMs} ms.`,
    foodPoints: (easy: string, medium: string, hard: string) =>
      `Each apple is worth ${easy} points on Easy, ${medium} on Medium and ${hard} on Hard.`,
    bonus: (every: string, ticks: string, multiplier: string) =>
      `Every ${every} apples a golden star appears for ${ticks} moves. It is worth ${multiplier} times the points of an apple and does not make the snake grow. The ring around the star shows how much time is left.`,
    records: 'Records are kept separately for each mode and difficulty.',
    controls: [
      'Phone: swipe on the board in the direction you want to turn. You can chain turns without lifting your finger.',
      'Direction buttons below the board (beside it on wide screens).',
      'Keyboard: arrow keys or W, A, S, D. Space, P or Esc pauses.',
      'The snake remembers up to 2 turns and applies one per cell, so you can make tight corners. Reversing straight back (180°) is ignored.',
    ],
    pauseTitle: 'Pausing and saving',
    pause: [
      'The game pauses by itself when you leave the app or open a menu.',
      'When you resume there is a 3-second countdown.',
      'If you leave mid-run, the run is saved and you can continue it later.',
    ],
  },
  modes: {
    classic: 'Classic',
    endless: 'Endless',
  },
  modeHints: {
    classic: 'Solid walls: hitting a wall or your own body ends the run.',
    endless: 'No walls: cross an edge and reappear on the opposite side. Only your own body can stop you.',
  },
  speedHint: (start: string, max: string, points: string) =>
    `Starts at ${start} cells per second and goes up to ${max}. Each apple is worth ${points} points.`,
  variant: (mode: string, difficulty: string) => `${mode} · ${difficulty}`,
  setup: {
    bestLabel: 'Record for this combination',
    noBest: 'No record yet',
    savedTitle: 'Saved run',
    savedBody: (variant: string, score: string, length: string) => `${variant} — ${score} points, length ${length}`,
    discardTitle: 'Start a new run?',
    discardBody: 'The saved run ends here and counts towards your statistics with its current score.',
  },
  length: 'Length',
  survival: 'Survival',
  food: 'Apples',
  changeMode: 'Change mode',
  boardLabel: (mode: string, size: string) =>
    `Snake board, ${mode} mode, ${size} by ${size} cells. Swipe on the board or use the direction buttons to turn.`,
  directionsLabel: 'Snake direction',
  directions: {
    up: 'Turn up',
    down: 'Turn down',
    left: 'Turn left',
    right: 'Turn right',
  },
  keyboardHint: 'Arrows or W A S D to turn · Space, P or Esc to pause',
  causes: {
    wall: 'You hit the wall.',
    self: 'You bit your own body.',
  },
  wonTitle: 'Board full!',
  wonBody: 'The snake fills every single cell. A legendary feat!',
  announce: {
    start: (variant: string) => `Run starting: ${variant}. Get ready!`,
    progress: (score: string, length: string) => `${score} points, length ${length}.`,
    bonusAppeared: 'A bonus star has appeared!',
    bonusEaten: (points: string) => `Bonus star: ${points} extra points!`,
    over: (cause: string, score: string) => `${cause} Game over with ${score} points.`,
    won: (score: string) => `You filled the board! ${score} points.`,
  },
};
