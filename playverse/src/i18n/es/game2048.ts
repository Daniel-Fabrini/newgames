import type { Game2048Messages } from '../pt/game2048';

export const game2048: Game2048Messages = {
  help: {
    intro: 'Desliza las fichas para unirlas. Cuando dos fichas con el mismo número se tocan, se fusionan en una que vale el doble. ¡Llega a la ficha 2048!',
    sections: [
      {
        title: 'Reglas',
        items: [
          'Cada movimiento desliza todas las fichas lo más lejos posible en la dirección elegida.',
          'Dos fichas iguales se fusionan en una; cada ficha solo puede fusionarse una vez por movimiento.',
          'Después de cada movimiento que cambie el tablero aparece una ficha nueva (2 o 4) en una casilla vacía.',
          'Si el movimiento no desplaza ninguna ficha, no aparece ninguna ficha nueva.',
          'Ganas cuando creas la ficha 2048 y puedes seguir jugando para llegar más lejos.',
          'La partida termina cuando el tablero está lleno y no es posible ninguna fusión.',
        ],
      },
      {
        title: 'Controles',
        items: [
          'Móvil: desliza el dedo sobre el tablero.',
          'Teclado: flechas o W, A, S, D. U deshace, P o Esc pausa.',
          'También puedes usar los botones de dirección debajo del tablero.',
        ],
      },
      {
        title: 'Puntuación',
        items: ['Cada fusión suma a la puntuación el valor de la nueva ficha (2 + 2 = 4 puntos).', 'Puedes deshacer hasta 10 movimientos seguidos.'],
      },
    ],
  },
  reachedTitle: '¡Has llegado a 2048!',
  reachedBody: '¡Fantástico! Puedes seguir jugando para intentar una ficha aún mayor.',
  overBody: 'No quedan movimientos posibles.',
  bestTile: 'Mayor ficha',
  boardLabel: 'Tablero de 2048, 4 por 4',
  cellEmpty: 'vacía',
  cellLabel: (row: number, col: number, value: string) => `Fila ${row}, columna ${col}: ${value}`,
  directionsLabel: 'Mover fichas',
  directions: {
    up: 'Mover hacia arriba',
    down: 'Mover hacia abajo',
    left: 'Mover hacia la izquierda',
    right: 'Mover hacia la derecha',
  },
  movedAnnouncement: (score: number) => `Puntuación: ${score}`,
  undoLimit: (n: number) => `Puedes deshacer ${n} más`,
};
