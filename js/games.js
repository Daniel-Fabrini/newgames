// Registry of every game shown in the hub. Each game lives in games/<id>/main.js
// and exports `mount(root, ctx)` — see docs/GAME_API.md.

export const GAMES = [
  {
    id: 'soccer',
    icon: '⚽',
    bg: 'linear-gradient(145deg, #1fa34a, #0b6b2d)',
    name: { pt: 'Futebol de Botão', en: 'Button Soccer', es: 'Fútbol de Botones' },
    desc: { pt: 'Peteleco, tabela e gol!', en: 'Flick, pass and score!', es: '¡Golpea, pasa y marca!' },
    load: () => import('../games/soccer/main.js'),
  },
  {
    id: 'squad',
    icon: '🪖',
    bg: 'linear-gradient(145deg, #d1495b, #6b1d2a)',
    name: { pt: 'Esquadrão Sobrevivente', en: 'Survivor Squad', es: 'Escuadrón Superviviente' },
    desc: { pt: 'Multiplique a tropa e vença os zumbis', en: 'Grow your squad, beat the zombies', es: 'Multiplica tu tropa y vence a los zombis' },
    load: () => import('../games/squad/main.js'),
  },
  {
    id: 'mapquiz',
    icon: '🗺️',
    bg: 'linear-gradient(145deg, #2a9df4, #124e9c)',
    name: { pt: 'Onde Fica?', en: 'Where Is It?', es: '¿Dónde Está?' },
    desc: { pt: 'Encontre países no mapa-múndi', en: 'Find countries on the world map', es: 'Encuentra países en el mapamundi' },
    load: () => import('../games/mapquiz/main.js'),
  },
  {
    id: 'flags',
    icon: '🏁',
    bg: 'linear-gradient(145deg, #ff8c42, #c4361b)',
    name: { pt: 'Bandeiras do Mundo', en: 'World Flags', es: 'Banderas del Mundo' },
    desc: { pt: 'Quiz de bandeiras e capitais', en: 'Flags and capitals quiz', es: 'Quiz de banderas y capitales' },
    load: () => import('../games/flags/main.js'),
  },
  {
    id: 'polyglot',
    icon: '🦜',
    bg: 'linear-gradient(145deg, #58cc02, #2b7a0b)',
    name: { pt: 'Poliglota', en: 'Polyglot', es: 'Políglota' },
    desc: { pt: 'Aprenda idiomas jogando', en: 'Learn languages by playing', es: 'Aprende idiomas jugando' },
    load: () => import('../games/polyglot/main.js'),
  },
  {
    id: 'busjam',
    icon: '🚌',
    bg: 'linear-gradient(145deg, #f7b801, #d17a00)',
    name: { pt: 'Todos a Bordo', en: 'All Aboard', es: 'Todos a Bordo' },
    desc: { pt: 'Desfaça o engarrafamento', en: 'Clear the traffic jam', es: 'Despeja el atasco' },
    load: () => import('../games/busjam/main.js'),
  },
  {
    id: 'hidden',
    icon: '🔍',
    bg: 'linear-gradient(145deg, #9b5de5, #4a1f8c)',
    name: { pt: 'Caça-Objetos', en: 'Seek & Find', es: 'Busca y Encuentra' },
    desc: { pt: 'Ache os objetos escondidos', en: 'Spot the hidden objects', es: 'Encuentra los objetos ocultos' },
    load: () => import('../games/hidden/main.js'),
  },
  {
    id: 'crossword',
    icon: '✏️',
    bg: 'linear-gradient(145deg, #00b8a9, #00675e)',
    name: { pt: 'Cruzadas Diretas', en: 'Arrow Crosswords', es: 'Crucigramas Directos' },
    desc: { pt: 'Palavras cruzadas com dicas na grade', en: 'Crosswords with clues in the grid', es: 'Crucigramas con pistas en la cuadrícula' },
    load: () => import('../games/crossword/main.js'),
  },
];
