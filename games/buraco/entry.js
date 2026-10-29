// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'buraco',
  cat: 'cards',
  progress: 100,
  name: { pt: 'Buraco', en: 'Buraco', es: 'Buraco' },
  sub: { pt: 'Buraco Aberto em Duplas', en: 'Open Buraco for Partners', es: 'Buraco Abierto en Parejas' },
  about: {
    pt: 'O clássico buraco brasileiro: forme sequências, faça canastras limpas, pegue o morto e bata antes da dupla adversária. Jogue em duplas com um parceiro do computador ou em duelo, até 1500 ou 3000 pontos.',
    en: 'The classic Brazilian buraco: build sequences, make clean canastas, take the morto and go out before the opposing side. Play in partnerships with a computer partner or in a 1 v 1 duel, to 1500 or 3000 points.',
    es: 'El clásico buraco brasileño: arma secuencias, haz canastas limpias, toma el morto y cierra antes que la pareja rival. Juega en parejas con un compañero de la computadora o en duelo, hasta 1500 o 3000 puntos.',
  },
  modes: [
    { id: 'team', icon: 'users', label: { pt: 'Em Duplas', en: 'Partners', es: 'En Parejas' } },
    { id: 'duel', icon: 'user', label: { pt: 'Duelo 1×1', en: 'Duel 1v1', es: 'Duelo 1v1' } },
  ],
  trophies: ['🏆', '🃏', '♠️', '⭐', '🎯'],
  load: () => import('./main.js'),
};
