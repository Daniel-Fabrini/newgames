export default {
  id: 'sueca',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Sueca', en: 'Sueca', es: 'Sueca' },
  sub: { pt: 'Baralho Português', en: 'Portuguese Card Game', es: 'Baraja Portuguesa' },
  about: {
    pt: 'O clássico jogo de vazas português: quatro jogadores, duas duplas e um trunfo. Jogue com seu parceiro contra dois adversários, conte os pontos e vá atrás da bandeira.',
    en: 'The classic Portuguese trick-taking game: four players, two teams and a trump suit. Team up with your partner against two opponents, count the points and go for the bandeira.',
    es: 'El clásico juego de bazas portugués: cuatro jugadores, dos equipos y un triunfo. Juega con tu compañero contra dos rivales, cuenta los puntos y ve por la bandeira.',
  },
  modes: [
    { id: 'match', icon: 'trophy', label: { pt: 'Partida', en: 'Match', es: 'Partida' } },
    { id: 'round', icon: 'one', label: { pt: 'Mão única', en: 'Single hand', es: 'Mano única' } },
  ],
  trophies: ['🏆', '♠️', '🚩', '⭐', '🎯'],
  load: () => import('./main.js'),
};
