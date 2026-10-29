export default {
  id: 'poker',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Poker World Tour', en: 'Poker World Tour', es: 'Poker World Tour' },
  sub: { pt: 'Texas Hold’em e Carreira', en: 'Texas Hold’em & Career', es: 'Texas Hold’em y Carrera' },
  about: {
    pt: 'Do bar da esquina ao Mundial: jogue Texas Hold’em No-Limit contra rivais com personalidade, suba pelos quatro circuitos e conquiste o troféu máximo. Fichas virtuais, sem dinheiro real.',
    en: 'From the corner pub to the World Championship: play No-Limit Texas Hold’em against rivals with real personality, climb four circuits and win the ultimate trophy. Virtual chips only, no real money.',
    es: 'Del bar de la esquina al Mundial: juega Texas Hold’em No-Limit contra rivales con personalidad, sube por cuatro circuitos y gana el trofeo supremo. Fichas virtuales, sin dinero real.',
  },
  modes: [
    { id: 'career', icon: 'trophy', label: { pt: 'Carreira', en: 'Career', es: 'Carrera' } },
    { id: 'sitgo', icon: 'users', label: { pt: 'Sit & Go', en: 'Sit & Go', es: 'Sit & Go' } },
    { id: 'quick', icon: 'pairs', label: { pt: 'Mesa Rápida', en: 'Quick Table', es: 'Mesa Rápida' } },
    { id: 'tutorial', icon: 'question', label: { pt: 'Tutorial', en: 'Tutorial', es: 'Tutorial' } },
  ],
  trophies: ['🏆', '♠️', '🃏', '💰', '👑'],
  load: () => import('./main.js'),
};
