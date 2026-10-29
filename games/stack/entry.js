// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'stack',
  cat: 'strategy',
  progress: 100,
  name: { pt: 'Torre de Blocos', en: 'Block Tower', es: 'Torre de Bloques' },
  sub: { pt: 'Equilíbrio e Nervos de Aço', en: 'Balance & Steady Hands', es: 'Equilibrio y Pulso Firme' },
  about: {
    pt: 'Puxe um bloco de madeira da torre e coloque no topo sem derrubar tudo. Física de verdade: cada puxão pode balançar a torre. Jogue sozinho ou passe o celular para um amigo.',
    en: 'Pull a wooden block out of the tower and stack it on top without bringing it all down. Real physics: every pull can shake the tower. Play solo or pass the phone to a friend.',
    es: 'Saca un bloque de madera de la torre y colócalo arriba sin derribarlo todo. Física real: cada tirón puede sacudir la torre. Juega solo o pasa el móvil a un amigo.',
  },
  modes: [
    { id: 'solo', icon: 'user', label: { pt: '1 Jogador', en: '1 Player', es: '1 Jugador' } },
    { id: 'duo', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
  ],
  trophies: ['🏆', '🧱', '🏗️', '⭐', '🎯'],
  load: () => import('./main.js'),
};
