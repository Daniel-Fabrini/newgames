// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'foosball',
  cat: 'sport',
  progress: 100,
  name: { pt: 'Pebolim', en: 'Foosball', es: 'Futbolín' },
  sub: { pt: 'Matraquilhos', en: 'Rod Football', es: 'Fútbol de Barras' },
  about: {
    pt: 'Deslize e gire as barras da mesa para chutar a bola e marcar gols. Jogue contra o computador, em dois no mesmo aparelho ou conquiste a taça num torneio de 8 times.',
    en: 'Slide and spin the rods to kick the ball and score. Play the computer, two players on one device, or win the trophy in an 8-team knockout tournament.',
    es: 'Desliza y gira las barras de la mesa para chutar el balón y marcar. Juega contra la CPU, de dos en un dispositivo o gana la copa en un torneo de 8 equipos.',
  },
  modes: [
    { id: 'quick', icon: 'user', label: { pt: 'Rápida', en: 'Quick', es: 'Rápida' } },
    { id: 'duo', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
    { id: 'tournament', icon: 'trophy', label: { pt: 'Torneio', en: 'Tournament', es: 'Torneo' } },
    { id: 'custom', icon: 'grid', label: { pt: 'Personalizado', en: 'Custom', es: 'Personalizado' } },
  ],
  trophies: ['🥅', '⚽', '🏆', '🔥', '🥇'],
  load: () => import('./main.js'),
};
