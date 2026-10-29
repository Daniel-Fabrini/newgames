// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'maze',
  cat: 'puzzle',
  progress: 100,
  name: { pt: 'Labirinto Inclinado', en: 'Tilt Maze', es: 'Laberinto Inclinado' },
  sub: { pt: 'Incline e Role a Esfera', en: 'Tilt & Roll the Ball', es: 'Inclina y Haz Rodar la Bola' },
  about: {
    pt: 'Incline o tabuleiro e conduza a esfera de aço até a saída, fugindo de buracos, gelo, lama e obstáculos móveis. Use o sensor do celular, o dedo ou o teclado. Fases infinitas!',
    en: 'Tilt the board and guide the steel ball to the exit, dodging holes, ice, sticky mud and moving obstacles. Use your phone sensor, your finger or the keyboard. Endless levels!',
    es: 'Inclina el tablero y guía la bola de acero hasta la salida, esquivando agujeros, hielo, barro y obstáculos móviles. Usa el sensor del móvil, el dedo o el teclado. ¡Niveles infinitos!',
  },
  modes: [
    { id: 'classic', icon: 'flag', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
    { id: 'daily', icon: 'calendar', label: { pt: 'Diário', en: 'Daily', es: 'Diario' } },
    { id: 'timed', icon: 'clock', label: { pt: 'Contra o Tempo', en: 'Time Attack', es: 'Contrarreloj' } },
  ],
  trophies: ['🏆', '🔮', '🕳️', '⭐', '🎯'],
  load: () => import('./main.js'),
};
