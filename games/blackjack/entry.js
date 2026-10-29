export default {
  id: 'blackjack',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Blackjack', en: 'Blackjack', es: 'Blackjack' },
  sub: { pt: 'Vinte e Um', en: 'Twenty-One', es: 'Veintiuna' },
  about: {
    pt: 'Chegue o mais perto de 21 sem estourar e vença a banca. Aposte fichas virtuais, dobre, divida pares e use o seguro. Sem dinheiro de verdade.',
    en: 'Get as close to 21 as you can without going bust and beat the dealer. Bet virtual chips, double down, split pairs and take insurance. No real money.',
    es: 'Acércate a 21 sin pasarte y vence a la banca. Apuesta fichas virtuales, dobla, divide pares y usa el seguro. Sin dinero real.',
  },
  modes: [
    { id: 'classic', icon: 'play', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
    { id: 'challenge', icon: 'trophy', label: { pt: 'Desafio', en: 'Challenge', es: 'Desafío' } },
  ],
  trophies: ['🏆', '🃏', '💰', '🔥', '👑'],
  load: () => import('./main.js'),
};
