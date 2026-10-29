// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'pinball',
  cat: 'classic',
  progress: 100,
  name: { pt: 'Pinball Pro', en: 'Pinball Pro', es: 'Pinball Pro' },
  sub: { pt: 'Edição Pokémon', en: 'Pokémon Edition', es: 'Edición Pokémon' },
  about: {
    pt: 'Um fliperama moderno com tema Pokémon: Poké Balls como bumpers, rampas de acrílico, spinner, alvos, multibola e as missões Descobrir, Capturar, Treinar e Batalhar. Duas mesas: Aventura Pokémon e Laboratório Psíquico.',
    en: 'A modern Pokémon-themed pinball machine: Poké Ball pop bumpers, clear ramps, spinner, targets, multiball and the Discover, Catch, Train and Battle missions. Two tables: Pokémon Adventure and Psychic Lab.',
    es: 'Un pinball moderno con temática Pokémon: bumpers Poké Ball, rampas transparentes, spinner, blancos, multibola y las misiones Descubrir, Capturar, Entrenar y Batalla. Dos mesas: Aventura Pokémon y Laboratorio Psíquico.',
  },
  modes: [
    { id: 'classic', icon: 'play', label: { pt: 'Aventura', en: 'Adventure', es: 'Aventura' } },
    { id: 'space', icon: 'infinity', label: { pt: 'Lab Psíquico', en: 'Psychic Lab', es: 'Lab Psíquico' } },
    { id: 'missions', icon: 'flag', label: { pt: 'Missões', en: 'Missions', es: 'Misiones' } },
  ],
  trophies: ['🏆', '⚡', '🔴', '⭐', '🎯'],
  load: () => import('./main.js'),
};
