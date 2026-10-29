export default {
  id: 'mines',
  cat: 'puzzle',
  progress: 100,
  name: { pt: 'Campo Minado', en: 'Minesweeper', es: 'Buscaminas' },
  sub: { pt: 'Limpe o Campo', en: 'Clear the Field', es: 'Despeja el Campo' },
  about: {
    pt: 'O clássico da lógica: use os números para deduzir onde estão as minas, marque bandeiras e limpe o campo no menor tempo. Do fácil ao infinito.',
    en: 'The classic logic puzzle: use the numbers to deduce where the mines are, plant flags and clear the field in record time. From easy to endless.',
    es: 'El clásico de lógica: usa los números para deducir dónde están las minas, coloca banderas y despeja el campo en el menor tiempo. De fácil a infinito.',
  },
  modes: [
    { id: 'easy', icon: 'leaf', label: { pt: 'Fácil', en: 'Easy', es: 'Fácil' } },
    { id: 'medium', icon: 'flag', label: { pt: 'Médio', en: 'Medium', es: 'Medio' } },
    { id: 'hard', icon: 'skull', label: { pt: 'Difícil', en: 'Hard', es: 'Difícil' } },
  ],
  trophies: ['🏆', '🚩', '💣', '⏱️', '🎯'],
  load: () => import('./main.js'),
};
