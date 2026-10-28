// Registry of every game shown in the hub. Each game lives in games/<id>/main.js
// and exports `mount(root, ctx)` — see docs/GAME_API.md.
//
//   cat     hub category chip: sport | strategy | knowledge | puzzle
//   sub     subtitle under the name (tile + lobby)
//   about   lobby description
//   modes   lobby mode buttons → mount(root, ctx) with ctx.mode = id
//   trophies  icons for the lobby achievements row (unlocked by plays / game level)
//   lobby   false → the game opens directly, without the lobby page

export const GAMES = [
  {
    id: 'soccer',
    cat: 'sport',
    name: { pt: 'Super Craques', en: 'Super Strikers', es: 'Súper Cracks' },
    sub: { pt: 'Futebol de Mesa', en: 'Table Soccer', es: 'Fútbol de Mesa' },
    about: {
      pt: 'Desafie sua habilidade num emocionante jogo de futebol de mesa. Faça gols, enfrente a IA ou jogue com amigos.',
      en: 'Test your skill in a thrilling table soccer game. Score goals, take on the AI or play with friends.',
      es: 'Pon a prueba tu habilidad en un emocionante fútbol de mesa. Marca goles, enfréntate a la IA o juega con amigos.',
    },
    modes: [
      { id: '1p', icon: 'user', label: { pt: '1 Jogador', en: '1 Player', es: '1 Jugador' } },
      { id: '2p', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
      { id: 'tournament', icon: 'trophy', label: { pt: 'Torneios', en: 'Tournaments', es: 'Torneos' } },
    ],
    trophies: ['🏆', '👟', '⚽', '⭐', '🎯'],
    load: () => import('../games/soccer/main.js'),
  },
  {
    id: 'squad',
    cat: 'strategy',
    name: { pt: 'Zona de Guerra', en: 'War Zone', es: 'Zona de Guerra' },
    sub: { pt: 'Estratégia e Batalha', en: 'Strategy & Battle', es: 'Estrategia y Batalla' },
    about: {
      pt: 'Construa sua base, recrute heróis e lidere sua tropa contra hordas de zumbis. Escolha os portões certos e multiplique o exército.',
      en: 'Build your base, recruit heroes and lead your squad against zombie hordes. Pick the right gates and multiply your army.',
      es: 'Construye tu base, recluta héroes y lidera tu tropa contra hordas de zombis. Elige las puertas correctas y multiplica tu ejército.',
    },
    modes: [
      { id: 'campaign', icon: 'flag', label: { pt: 'Campanha', en: 'Campaign', es: 'Campaña' } },
      { id: 'survival', icon: 'skull', label: { pt: 'Sobrevivência', en: 'Survival', es: 'Supervivencia' } },
      { id: 'base', icon: 'castle', label: { pt: 'Base', en: 'Base', es: 'Base' } },
    ],
    trophies: ['🏆', '🪖', '💥', '⭐', '🎯'],
    load: () => import('../games/squad/main.js'),
  },
  {
    id: 'mapquiz',
    cat: 'knowledge',
    name: { pt: 'Adivinhe o País', en: 'Guess the Country', es: 'Adivina el País' },
    sub: { pt: 'Mapa-Múndi', en: 'World Map', es: 'Mapamundi' },
    about: {
      pt: 'Você sabe onde fica cada país? Adivinhe países, capitais e bandeiras no mapa-múndi e vire um mestre da geografia.',
      en: 'Do you know where every country is? Guess countries, capitals and flags on the world map and become a geography master.',
      es: '¿Sabes dónde está cada país? Adivina países, capitales y banderas en el mapamundi y conviértete en un maestro de la geografía.',
    },
    modes: [
      { id: 'guess', icon: 'question', label: { pt: 'Adivinhar', en: 'Guess', es: 'Adivinar' } },
      { id: 'find', icon: 'pin', label: { pt: 'No Mapa', en: 'On the Map', es: 'En el Mapa' } },
      { id: 'marathon', icon: 'infinity', label: { pt: 'Maratona', en: 'Marathon', es: 'Maratón' } },
    ],
    trophies: ['🏆', '🌍', '🧭', '⭐', '🎯'],
    load: () => import('../games/mapquiz/main.js'),
  },
  {
    id: 'flags',
    cat: 'knowledge',
    name: { pt: 'Bandeiras', en: 'Flags', es: 'Banderas' },
    sub: { pt: 'Bandeiras do Mundo', en: 'World Flags', es: 'Banderas del Mundo' },
    about: {
      pt: 'Todas as bandeiras do mundo em vários modos: múltipla escolha, contra o relógio, capitais, soletrar e muito mais.',
      en: 'Every flag in the world across many modes: multiple choice, time attack, capitals, spelling and more.',
      es: 'Todas las banderas del mundo en muchos modos: opción múltiple, contrarreloj, capitales, deletreo y más.',
    },
    modes: [
      { id: 'classic', icon: 'flag', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'time', icon: 'clock', label: { pt: 'Contra o Tempo', en: 'Time Attack', es: 'Contrarreloj' } },
      { id: 'capitals', icon: 'building', label: { pt: 'Capitais', en: 'Capitals', es: 'Capitales' } },
    ],
    trophies: ['🏆', '🚩', '⏱️', '⭐', '🎯'],
    load: () => import('../games/flags/main.js'),
  },
  {
    id: 'polyglot',
    cat: 'knowledge',
    lobby: false,
    name: { pt: 'Poliglota', en: 'Polyglot', es: 'Políglota' },
    sub: { pt: 'Vários Idiomas', en: 'Many Languages', es: 'Varios Idiomas' },
    about: {
      pt: 'Aprenda inglês, espanhol, francês, alemão e italiano do básico à conversação.',
      en: 'Learn Spanish, French, German, Italian and Portuguese from basics to conversation.',
      es: 'Aprende inglés, francés, alemán, italiano y portugués desde lo básico hasta la conversación.',
    },
    modes: [],
    trophies: ['🏆', '📚', '🗣️', '⭐', '🎯'],
    load: () => import('../games/polyglot/main.js'),
  },
  {
    id: 'busjam',
    cat: 'puzzle',
    name: { pt: 'Bus Jam', en: 'Bus Jam', es: 'Bus Jam' },
    sub: { pt: 'Organização', en: 'Sorting Puzzle', es: 'Organización' },
    about: {
      pt: 'Tire os carros do estacionamento na ordem certa e leve cada passageiro para o veículo da sua cor. Níveis infinitos!',
      en: 'Get the cars out of the lot in the right order and take every passenger to the vehicle of their color. Endless levels!',
      es: 'Saca los coches del estacionamiento en el orden correcto y lleva a cada pasajero al vehículo de su color. ¡Niveles infinitos!',
    },
    modes: [
      { id: 'levels', icon: 'stairs', label: { pt: 'Níveis', en: 'Levels', es: 'Niveles' } },
      { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
    ],
    trophies: ['🏆', '🚌', '🧍', '⭐', '🎯'],
    load: () => import('../games/busjam/main.js'),
  },
  {
    id: 'hidden',
    cat: 'puzzle',
    name: { pt: 'Ache Tudo', en: 'Spot It All', es: 'Encuéntralo Todo' },
    sub: { pt: 'Objetos Escondidos', en: 'Hidden Objects', es: 'Objetos Ocultos' },
    about: {
      pt: 'Explore cenários cheios de detalhes e encontre todos os objetos escondidos. Use a lupa, dê zoom e não deixe nada escapar.',
      en: 'Explore detailed scenes and find every hidden object. Use the magnifier, zoom in and let nothing slip by.',
      es: 'Explora escenarios llenos de detalles y encuentra todos los objetos ocultos. Usa la lupa, haz zoom y que nada se te escape.',
    },
    modes: [
      { id: 'classic', icon: 'search', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'findall', icon: 'grid', label: { pt: 'Ache Todos', en: 'Find Them All', es: 'Encuentra Todos' } },
      { id: 'zen', icon: 'leaf', label: { pt: 'Zen', en: 'Zen', es: 'Zen' } },
    ],
    trophies: ['🏆', '🔍', '🗝️', '⭐', '🎯'],
    load: () => import('../games/hidden/main.js'),
  },
  {
    id: 'findit',
    cat: 'puzzle',
    name: { pt: 'Caça-Objetos', en: 'Seek & Find', es: 'Busca y Encuentra' },
    sub: { pt: 'Objetos Escondidos', en: 'Hidden Objects', es: 'Objetos Ocultos' },
    about: {
      pt: 'Viaje por mapas enormes — porto, praia, cidade e muito mais — e encontre todos os itens da lista.',
      en: 'Travel across huge maps — harbor, beach, city and more — and find every item on the list.',
      es: 'Viaja por mapas enormes — puerto, playa, ciudad y más — y encuentra todos los objetos de la lista.',
    },
    modes: [
      { id: 'classic', icon: 'search', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'match', icon: 'pairs', label: { pt: 'Pares', en: 'Match', es: 'Parejas' } },
      { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
    ],
    trophies: ['🏆', '🧸', '🗺️', '⭐', '🎯'],
    load: () => import('../games/findit/main.js'),
  },
  {
    id: 'wordsearch',
    cat: 'puzzle',
    name: { pt: 'Caça-Palavras', en: 'Word Search', es: 'Sopa de Letras' },
    sub: { pt: 'Temas Variados', en: 'Many Themes', es: 'Temas Variados' },
    about: {
      pt: 'Deslize o dedo pelas letras e encontre as palavras escondidas: animais, comidas, esportes, profissões e muito mais. Níveis infinitos!',
      en: 'Swipe across the letters to find the hidden words: animals, food, sports, jobs and much more. Endless levels!',
      es: 'Desliza el dedo por las letras y encuentra las palabras ocultas: animales, comidas, deportes, profesiones y mucho más. ¡Niveles infinitos!',
    },
    modes: [
      { id: 'levels', icon: 'stairs', label: { pt: 'Níveis', en: 'Levels', es: 'Niveles' } },
      { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
      { id: 'timed', icon: 'clock', label: { pt: 'Contra o Tempo', en: 'Time Attack', es: 'Contrarreloj' } },
    ],
    trophies: ['🏆', '🔤', '🔍', '⭐', '🎯'],
    load: () => import('../games/wordsearch/main.js'),
  },
];

export const CATEGORIES = [
  { id: 'all', label: { pt: 'Todos', en: 'All', es: 'Todos' } },
  { id: 'sport', label: { pt: 'Esportes', en: 'Sports', es: 'Deportes' } },
  { id: 'strategy', label: { pt: 'Estratégia', en: 'Strategy', es: 'Estrategia' } },
  { id: 'knowledge', label: { pt: 'Conhecimento', en: 'Knowledge', es: 'Conocimiento' } },
  { id: 'puzzle', label: { pt: 'Puzzles', en: 'Puzzles', es: 'Puzles' } },
];
