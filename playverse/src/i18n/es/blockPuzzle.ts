import type { BlockPuzzleMessages } from '../pt/blockPuzzle';

/** "2 líneas", "1 cuadrado"… for the groups cleared by one placement. */
function clearParts(lines: number, squares: number): string[] {
  const parts: string[] = [];
  if (lines > 0) parts.push(lines === 1 ? '1 línea' : `${lines} líneas`);
  if (squares > 0) parts.push(squares === 1 ? '1 cuadrado' : `${squares} cuadrados`);
  return parts;
}

export const blockPuzzle: BlockPuzzleMessages = {
  help: {
    intro:
      'Encaja las piezas en el tablero de 9 × 9. Completa filas, columnas o cuadrados de 3 × 3 para eliminarlos y sumar puntos. La partida termina cuando ninguna de tus piezas cabe en el tablero.',
    sections: [
      {
        title: 'Reglas',
        items: [
          'Recibes 3 piezas cada vez. Solo recibes piezas nuevas después de colocar las tres, en el orden que quieras.',
          'Las piezas no giran: cada orientación es una pieza distinta.',
          'Una pieza solo se puede colocar entera dentro del tablero y sobre casillas vacías.',
          'Cuando una fila, una columna o uno de los nueve cuadrados de 3 × 3 destacados se completa, se elimina. Todo lo que se completa se elimina a la vez; una casilla que pertenece a varios cuenta solo una vez.',
          'Los cuadrados de 3 × 3 son los bloques sombreados del tablero (3 por 3 casillas, sin solaparse).',
          'Las piezas que no caben en ningún sitio aparecen atenuadas.',
          'Siempre que alguna pieza cabe en el tablero, al menos una de las tres piezas nuevas cabe, pero nunca se garantiza que quepan todas, así que planifica con cuidado.',
          'La partida termina cuando ninguna de las piezas que te quedan cabe en el tablero.',
        ],
      },
      {
        title: 'Controles',
        items: [
          'Arrastrar: arrastra una pieza de la bandeja al tablero. La sombra muestra dónde quedará y las filas, columnas y cuadrados que se van a eliminar se iluminan. Si la sueltas en un sitio no válido, vuelve a la bandeja.',
          'En pantallas táctiles, la pieza arrastrada queda un poco por encima del dedo para que puedas verla.',
          'Tocar: toca una pieza para seleccionarla y después toca una casilla del tablero. La casilla tocada queda en el centro de la pieza (en las piezas con anchura o altura par, es la casilla justo a la izquierda o encima del centro) y, junto a los bordes, la pieza se desplaza hacia dentro del tablero. Con el ratón ves la vista previa antes de hacer clic.',
          'Teclado: 1, 2 y 3 seleccionan la pieza, las flechas la mueven por el tablero, Intro o Espacio la colocan y Esc cancela la selección. P pone la partida en pausa.',
        ],
      },
      {
        title: 'Puntuación',
        items: [
          '1 punto por cada bloque colocado.',
          'Eliminar L grupos a la vez (cada fila, columna o cuadrado de 3 × 3 cuenta como un grupo) vale 10 × L × L puntos: 1 → 10, 2 → 40, 3 → 90, 4 → 160.',
          'Combo: cada colocación seguida que elimina al menos un grupo aumenta el combo (×1, ×2, ×3…) y los puntos de la eliminación se multiplican por el combo. Una colocación que no elimina nada pone el combo a cero.',
          'Ejemplo: una pieza de 4 bloques que completa una fila y un cuadrado (2 grupos) con combo ×3 da 4 + 40 × 3 = 124 puntos.',
        ],
      },
    ],
  },
  lines: 'Limpiezas',
  combo: (n: number) => `Combo ×${n}`,
  comboLabel: (n: number) => `Combo actual: ${n}`,
  clearsPopup: (lines: number, squares: number) => `¡${clearParts(lines, squares).join(' + ')}!`,
  boardLabel: 'Tablero de 9 por 9',
  cellLabel: (row: number, col: number, state: string) => `Fila ${row}, columna ${col}: ${state}`,
  cellEmpty: 'vacía',
  cellFilled: 'ocupada',
  trayLabel: 'Piezas disponibles',
  slotLabel: (slot: number, name: string, blocks: number) => `Pieza ${slot}: ${name}, ${blocks === 1 ? '1 bloque' : `${blocks} bloques`}`,
  slotEmpty: (slot: number) => `Hueco ${slot}: pieza ya colocada`,
  slotNoFit: 'no cabe en el tablero',
  shapes: {
    mono: 'bloque simple',
    line2: 'línea de 2',
    line3: 'línea de 3',
    line4: 'línea de 4',
    line5: 'línea de 5',
    square2: 'cuadrado 2 × 2',
    square3: 'cuadrado 3 × 3',
    corner3: 'esquina pequeña',
    l4: 'pieza en L',
    j4: 'pieza en J',
    t4: 'pieza en T',
    s4: 'pieza en S',
    z4: 'pieza en Z',
    corner5: 'esquina grande',
  },
  orientation: {
    horizontal: 'en horizontal',
    vertical: 'en vertical',
  },
  hintIdle: 'Arrastra una pieza al tablero o tócala para seleccionarla.',
  hintSelected: 'Toca una casilla del tablero para colocar la pieza.',
  hintNoFit: 'Esta pieza no cabe en ningún sitio. Elige otra.',
  announce: {
    selected: (name: string) => `Has seleccionado: ${name}. Usa las flechas e Intro, o toca el tablero.`,
    selectedNoFit: (name: string) => `Has seleccionado: ${name}. Esta pieza no cabe en ningún sitio.`,
    cancelled: 'Selección cancelada.',
    position: (row: number, col: number, valid: boolean) => `Fila ${row}, columna ${col}${valid ? '' : ': no cabe aquí'}`,
    placed: (gained: number, score: number) => `Pieza colocada. +${gained} puntos, total ${score}.`,
    cleared: (lines: number, squares: number, combo: number) => `Has eliminado ${clearParts(lines, squares).join(' y ')}${combo >= 2 ? `, combo ×${combo}` : ''}.`,
    newPieces: 'Piezas nuevas en la bandeja.',
    invalid: 'No puedes colocar la pieza ahí.',
    emptySlot: 'Ese hueco ya está vacío.',
  },
  overBody: 'Ninguna de las piezas que quedan cabe en el tablero.',
  bestCombo: 'Mejor combo',
  piecesPlaced: 'Piezas colocadas',
  totalPiecesPlaced: 'Piezas colocadas (total)',
};
