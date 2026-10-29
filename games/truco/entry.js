// Registry entry for the lobby.
export default {
  id: 'truco',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Truco', en: 'Truco', es: 'Truco' },
  sub: { pt: 'Truco Paulista', en: 'Truco Paulista', es: 'Truco Paulista' },
  about: {
    pt: 'O clássico truco paulista em duplas: vira, manilhas, truco, seis, nove e doze. Blefe, corra na hora certa e fuja da mão de onze contra parceiro e adversários com personalidade própria.',
    en: 'The classic Brazilian Truco Paulista in teams of two: vira, manilhas, truco, six, nine and twelve. Bluff, fold at the right moment and survive the eleven hand against opponents with real personalities.',
    es: 'El clásico Truco Paulista brasileño por parejas: vira, manilhas, truco, seis, nueve y doce. Farolea, corre en el momento justo y sobrevive a la mano de once contra rivales con personalidad.',
  },
  modes: [
    { id: 'match', icon: 'users', label: { pt: 'Partida', en: 'Match', es: 'Partida' } },
    { id: 'quick', icon: 'clock', label: { pt: 'Rápido', en: 'Quick', es: 'Rápido' } },
    { id: 'duel', icon: 'user', label: { pt: 'Duelo', en: 'Duel', es: 'Duelo' } },
  ],
  trophies: ['🏆', '🃏', '♣️', '⭐', '🔥'],
  load: () => import('./main.js'),
};
