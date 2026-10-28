import type { SnakeMessages } from '../pt/snake';

export const snake: SnakeMessages = {
  help: {
    intro: 'Guía a la serpiente, cómete las manzanas para crecer y no choques con nada. ¡Cuanto más comes, más rápido va!',
    rules: [
      'La serpiente avanza sola, una casilla cada vez; tú solo eliges hacia dónde gira.',
      'Cada manzana hace crecer la serpiente una casilla y suma puntos. Enseguida aparece otra en una casilla libre al azar.',
      'Puedes entrar en la casilla donde está la punta de la cola, porque la cola sale de ahí en ese mismo instante.',
      'Chocar con tu propio cuerpo siempre termina la partida.',
      'Si la serpiente llena todo el tablero, ¡ganas!',
    ],
    modesTitle: 'Modos',
    modes: [
      'Clásico: los bordes del tablero son paredes (marco continuo). Chocar con una pared o con tu propio cuerpo termina la partida.',
      'Infinito: no hay paredes (marco discontinuo): sales por un lado y entras por el lado opuesto. Solo tu cuerpo puede detenerte.',
    ],
    speedTitle: 'Dificultad y velocidad',
    speed: (difficulty: string, startMs: string, accelMs: string, minMs: string) =>
      `${difficulty}: empieza con una casilla cada ${startMs} ms y acelera ${accelMs} ms por cada manzana, hasta el límite de una casilla cada ${minMs} ms.`,
    foodPoints: (easy: string, medium: string, hard: string) =>
      `Cada manzana vale ${easy} puntos en Fácil, ${medium} en Media y ${hard} en Difícil.`,
    bonus: (every: string, ticks: string, multiplier: string) =>
      `Cada ${every} manzanas aparece una estrella dorada durante ${ticks} movimientos. Vale ${multiplier} veces los puntos de una manzana y no hace crecer la serpiente. El anillo alrededor de la estrella muestra el tiempo que le queda.`,
    records: 'Los récords se guardan por separado para cada modo y dificultad.',
    controls: [
      'Móvil: desliza el dedo sobre el tablero hacia donde quieras girar. Puedes encadenar giros sin levantar el dedo.',
      'Botones de dirección debajo del tablero (al lado, en pantallas anchas).',
      'Teclado: flechas o W, A, S, D. Espacio, P o Esc ponen en pausa.',
      'La serpiente recuerda hasta 2 giros y aplica uno por casilla, así que puedes hacer curvas cerradas. Dar media vuelta de golpe (180°) se ignora.',
    ],
    pauseTitle: 'Pausa y guardado',
    pause: [
      'El juego se pausa solo cuando sales de la aplicación o abres un menú.',
      'Al reanudar hay una cuenta atrás de 3 segundos.',
      'Si sales a mitad de partida, se guarda y puedes continuarla más tarde.',
    ],
  },
  modes: {
    classic: 'Clásico',
    endless: 'Infinito',
  },
  modeHints: {
    classic: 'Paredes sólidas: chocar con una pared o con tu propio cuerpo termina la partida.',
    endless: 'Sin paredes: atraviesa los bordes y reaparece por el lado opuesto. Solo tu cuerpo puede detenerte.',
  },
  speedHint: (start: string, max: string, points: string) =>
    `Empieza a ${start} casillas por segundo y llega hasta ${max}. Cada manzana vale ${points} puntos.`,
  variant: (mode: string, difficulty: string) => `${mode} · ${difficulty}`,
  setup: {
    bestLabel: 'Récord en esta combinación',
    noBest: 'Todavía sin récord',
    savedTitle: 'Partida guardada',
    savedBody: (variant: string, score: string, length: string) => `${variant} — ${score} puntos, longitud ${length}`,
    discardTitle: '¿Empezar una partida nueva?',
    discardBody: 'La partida guardada termina aquí y cuenta para las estadísticas con la puntuación que tiene ahora.',
  },
  length: 'Longitud',
  survival: 'Supervivencia',
  food: 'Manzanas',
  changeMode: 'Cambiar modo',
  boardLabel: (mode: string, size: string) =>
    `Tablero de la serpiente, modo ${mode}, ${size} por ${size} casillas. Desliza sobre el tablero o usa los botones de dirección para girar.`,
  directionsLabel: 'Dirección de la serpiente',
  directions: {
    up: 'Girar hacia arriba',
    down: 'Girar hacia abajo',
    left: 'Girar a la izquierda',
    right: 'Girar a la derecha',
  },
  keyboardHint: 'Flechas o W A S D para girar · Espacio, P o Esc para pausar',
  causes: {
    wall: 'Has chocado con la pared.',
    self: 'Te has mordido el cuerpo.',
  },
  wonTitle: '¡Tablero lleno!',
  wonBody: 'La serpiente ocupa todas las casillas. ¡Una hazaña legendaria!',
  announce: {
    start: (variant: string) => `Empieza la partida: ${variant}. ¡Prepárate!`,
    progress: (score: string, length: string) => `${score} puntos, longitud ${length}.`,
    bonusAppeared: '¡Ha aparecido una estrella extra!',
    bonusEaten: (points: string) => `Estrella extra: ¡${points} puntos más!`,
    over: (cause: string, score: string) => `${cause} Fin de la partida con ${score} puntos.`,
    won: (score: string) => `¡Has llenado el tablero! ${score} puntos.`,
  },
};
