export default {
  id: 'tricolor',
  cat: 'knowledge',
  progress: 100,
  music: false,
  name: { pt: 'Tricolor do Milhão', en: 'Tricolor Millionaire', es: 'Tricolor del Millón' },
  sub: { pt: 'Quanto mais você sabe, mais tricolor você é!', en: 'The more you know, the more Tricolor you are!', es: '¡Cuanto más sabes, más tricolor eres!' },
  about: {
    pt: 'Quiz sobre a história do São Paulo Futebol Clube: 15 perguntas rumo ao milhão virtual, com ajudas, pontos seguros, desafio diário, temas e ranking local. App de fã, sem vínculo oficial com o clube.',
    en: 'A quiz on the history of São Paulo Futebol Clube: 15 questions towards a virtual million, with lifelines, safe points, a daily challenge, themes and a local ranking. Fan app, not affiliated with the club.',
    es: 'Quiz sobre la historia del São Paulo Futebol Clube: 15 preguntas rumbo al millón virtual, con ayudas, puntos seguros, desafío diario, temas y ranking local. App de aficionado, sin vínculo oficial con el club.',
  },
  modes: [
    { id: 'main', icon: 'crown', label: { pt: 'Rumo ao Milhão', en: 'Road to a Million', es: 'Rumbo al Millón' } },
    { id: 'quick', icon: 'play', label: { pt: 'Desafio Rápido', en: 'Quick Challenge', es: 'Desafío Rápido' } },
    { id: 'themes', icon: 'grid', label: { pt: 'Temas', en: 'Themes', es: 'Temas' } },
    { id: 'time', icon: 'clock', label: { pt: 'Contra o Relógio', en: 'Against the Clock', es: 'Contra el Reloj' } },
    { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
    { id: 'expert', icon: 'trophy', label: { pt: 'Especialista', en: 'Expert', es: 'Especialista' } },
  ],
  trophies: ['🏆', '💰', '⚽', '🔥', '🧠'],
  load: () => import('./main.js'),
};
