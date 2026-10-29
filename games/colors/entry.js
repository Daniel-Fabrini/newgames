export default {
  id: 'colors',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Corrida de Cores', en: 'Color Rush', es: 'Carrera de Colores' },
  sub: { pt: 'Descarte Rápido', en: 'Fast Shedding', es: 'Descarte Rápido' },
  about: {
    pt: 'Combine cor, número ou símbolo e seja o primeiro a ficar sem cartas. Use bloqueios, inversões e curingas, grite UM! na hora certa e vença a rodada contra 3 adversários.',
    en: 'Match colour, number or symbol and be the first to empty your hand. Use skips, reverses and wilds, shout ONE! at the right time and win the round against 3 opponents.',
    es: 'Combina color, número o símbolo y sé el primero en quedarte sin cartas. Usa saltos, inversiones y comodines, grita ¡UNA! en el momento justo y gana la ronda contra 3 rivales.',
  },
  modes: [
    { id: 'solo', icon: 'users', label: { pt: 'Você vs 3', en: 'You vs 3', es: 'Tú vs 3' } },
    { id: 'duel', icon: 'user', label: { pt: 'Duelo', en: 'Duel', es: 'Duelo' } },
  ],
  trophies: ['🏆', '🎴', '🌈', '☝️', '🔥'],
  load: () => import('./main.js'),
};
