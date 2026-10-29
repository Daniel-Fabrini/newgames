export default {
  id: 'bisca',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Bisca', en: 'Bisca', es: 'Bisca' },
  sub: { pt: 'Clássico de Cartas', en: 'Classic Card Game', es: 'Clásico de Cartas' },
  about: {
    pt: 'A bisca tradicional: três cartas na mão, um trunfo virado e muita memória. Vença as vazas, conte os pontos e passe de 60 para ganhar. Jogue um contra um ou em duplas.',
    en: 'Traditional bisca: three cards in hand, a trump turned face up and plenty of memory. Win tricks, count the points and pass 60 to win. Play one-on-one or in teams of two.',
    es: 'La bisca tradicional: tres cartas en la mano, un triunfo boca arriba y mucha memoria. Gana bazas, cuenta los puntos y pasa de 60 para ganar. Juega uno contra uno o por parejas.',
  },
  modes: [
    { id: 'solo', icon: 'user', label: { pt: '1 contra 1', en: '1 vs 1', es: '1 contra 1' } },
    { id: 'team', icon: 'users', label: { pt: 'Em duplas', en: 'Teams', es: 'Por parejas' } },
  ],
  trophies: ['🏆', '♥️', '♣️', '⭐', '🎯'],
  load: () => import('./main.js'),
};
