// Registry entry for the lobby (copied into js/games.js by the shell owner).
export default {
  id: 'pinball',
  cat: 'classic',
  progress: 100,
  name: { pt: 'Pinball Pro', en: 'Pinball Pro', es: 'Pinball Pro' },
  sub: { pt: 'Arcade de Alta Pontuação', en: 'High-Score Arcade', es: 'Arcade de Altas Puntuaciones' },
  about: {
    pt: 'Um fliperama moderno em duas mesas: Neon Arcade e Space Station. Bumpers, rampas, alvos, spinner, multibola, missões e bônus de fim de bola. Use os dois flippers, puxe o plunger e dê um empurrãozinho, mas cuidado com o TILT!',
    en: 'A modern arcade pinball machine with two tables: Neon Arcade and Space Station. Pop bumpers, ramps, targets, spinner, multiball, missions and end-of-ball bonus. Work both flippers, pull the plunger and nudge the table, but beware of TILT!',
    es: 'Un pinball arcade moderno con dos mesas: Neon Arcade y Space Station. Bumpers, rampas, blancos, spinner, multibola, misiones y bono al final de cada bola. Usa los dos flippers, tira del émbolo y sacude la mesa, ¡pero cuidado con el TILT!',
  },
  modes: [
    { id: 'classic', icon: 'play', label: { pt: 'Neon Arcade', en: 'Neon Arcade', es: 'Neon Arcade' } },
    { id: 'space', icon: 'infinity', label: { pt: 'Space Station', en: 'Space Station', es: 'Space Station' } },
    { id: 'missions', icon: 'flag', label: { pt: 'Missões', en: 'Missions', es: 'Misiones' } },
  ],
  trophies: ['🏆', '🎱', '🚀', '⭐', '🎯'],
  load: () => import('./main.js'),
};
