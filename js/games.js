// Registry of every game shown in the hub. Each game lives in games/<id>/main.js
// and exports `mount(root, ctx)` — see docs/GAME_API.md.
//
//   cat     hub category chip: sport | strategy | knowledge | puzzle | classic
//   sub     subtitle under the name (tile + lobby)
//   about   lobby description
//   modes   lobby mode buttons → mount(root, ctx) with ctx.mode = id
//   trophies  icons for the lobby achievements row (unlocked by plays / game level)
//   lobby   false → the game opens directly, without the lobby page
//   progress  % of the game built (0–100); below 100 the hub shows a progress bar
//   music   false → background music is silenced while the game is open

import minesEntry from '../games/mines/entry.js';
import lightsEntry from '../games/lights/entry.js';
import stackEntry from '../games/stack/entry.js';
import mazeEntry from '../games/maze/entry.js';

export const GAMES = [
  {
    id: 'soccer',
    cat: 'sport',
    progress: 100,
    name: { pt: 'Futebol de Mesa', en: 'Table Soccer', es: 'Fútbol de Mesa' },
    sub: { pt: 'Super Craques', en: 'Super Strikers', es: 'Súper Cracks' },
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
    progress: 100,
    name: { pt: 'Comando de Guerra', en: 'War Command', es: 'Comando de Guerra' },
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
    progress: 100,
    name: { pt: 'GeoDesafio', en: 'GeoChallenge', es: 'GeoDesafío' },
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
    progress: 100,
    name: { pt: 'Mundo em Bandeiras', en: 'Flag World', es: 'Mundo de Banderas' },
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
    progress: 100,
    lobby: false,
    music: false, // lessons speak and listen
    name: { pt: 'Mestre das Línguas', en: 'Language Master', es: 'Maestro de Idiomas' },
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
    progress: 100,
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
    id: 'waldo',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Detetive dos Personagens', en: 'Character Detective', es: 'Detective de Personajes' },
    sub: { pt: 'Ache o Personagem', en: 'Find the Character', es: 'Encuentra al Personaje' },
    about: {
      pt: 'Cenas lotadas de gente, cada uma com mil detalhes. Encontre o Ruivinho escondido na multidão antes que o tempo acabe!',
      en: 'Crowded scenes packed with tiny details. Find Red hidden in the crowd before time runs out!',
      es: '¡Escenas llenas de gente con mil detalles. Encuentra a Rojito escondido entre la multitud antes de que se acabe el tiempo!',
    },
    modes: [
      { id: 'classic', icon: 'search', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'timed', icon: 'clock', label: { pt: 'Contra o Tempo', en: 'Time Attack', es: 'Contrarreloj' } },
      { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
    ],
    trophies: ['🏆', '🔎', '⏱️', '⭐', '🎯'],
    load: () => import('../games/waldo/main.js'),
  },
  {
    id: 'findit',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Tesouros Escondidos', en: 'Hidden Treasures', es: 'Tesoros Escondidos' },
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
    progress: 100,
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
  {
    id: 'hero',
    cat: 'sport',
    progress: 100,
    name: { pt: 'Craque do Futebol', en: 'Soccer Star', es: 'Crack del Fútbol' },
    sub: { pt: 'Carreira no Futebol', en: 'Soccer Career', es: 'Carrera de Fútbol' },
    about: {
      pt: 'Desenhe o passe perfeito, faça a bola fazer a curva e marque o gol decisivo. Viva a carreira de um craque, lance a lance.',
      en: 'Draw the perfect pass, curl the ball and score the winning goal. Live a star player\'s career, one moment at a time.',
      es: 'Dibuja el pase perfecto, curva el balón y marca el gol decisivo. Vive la carrera de un crack, jugada a jugada.',
    },
    modes: [
      { id: 'career', icon: 'stairs', label: { pt: 'Carreira', en: 'Career', es: 'Carrera' } },
      { id: 'daily', icon: 'calendar', label: { pt: 'Desafio Diário', en: 'Daily Challenge', es: 'Desafío Diario' } },
      { id: 'training', icon: 'flag', label: { pt: 'Treino', en: 'Training', es: 'Entrenamiento' } },
    ],
    trophies: ['🏆', '⚽', '🥅', '⭐', '🎯'],
    load: () => import('../games/hero/main.js'),
  },
  {
    id: 'million',
    cat: 'knowledge',
    progress: 100,
    name: { pt: 'Desafio Milionário', en: 'Millionaire Challenge', es: 'Desafío Millonario' },
    sub: { pt: 'Quiz de Perguntas', en: 'Trivia Quiz', es: 'Quiz de Preguntas' },
    about: {
      pt: 'Responda 16 perguntas e chegue ao prêmio de 1 milhão. Use as cartas, os universitários, as placas e os pulos com sabedoria.',
      en: 'Answer 16 questions to reach the one-million prize. Use the cards, the students, the audience and the skips wisely.',
      es: 'Responde 16 preguntas y llega al premio de un millón. Usa las cartas, los universitarios, el público y los saltos con sabiduría.',
    },
    modes: [
      { id: 'classic', icon: 'crown', label: { pt: 'Jogar', en: 'Play', es: 'Jugar' } },
      { id: 'league', icon: 'trophy', label: { pt: 'Liga', en: 'League', es: 'Liga' } },
      { id: 'practice', icon: 'question', label: { pt: 'Treino', en: 'Practice', es: 'Práctica' } },
    ],
    trophies: ['🏆', '💰', '🃏', '⭐', '🎯'],
    load: () => import('../games/million/main.js'),
  },
  {
    id: 'towers',
    cat: 'strategy',
    progress: 100,
    name: { pt: 'Guardião do Castelo', en: 'Castle Guardian', es: 'Guardián del Castillo' },
    sub: { pt: 'Defesa de Torres', en: 'Tower Defense', es: 'Defensa de Torres' },
    about: {
      pt: 'Monte suas torres, estoure as ondas de inimigos e mande ataques para o campo do adversário. Quem resistir mais vence!',
      en: 'Build your towers, pop the enemy waves and send attacks to your opponent\'s side. Whoever lasts longer wins!',
      es: 'Construye tus torres, revienta las oleadas enemigas y envía ataques al campo del rival. ¡Gana quien resista más!',
    },
    modes: [
      { id: 'assault', icon: 'skull', label: { pt: 'Ataque', en: 'Assault', es: 'Asalto' } },
      { id: 'defense', icon: 'castle', label: { pt: 'Defesa', en: 'Defense', es: 'Defensa' } },
      { id: 'arena', icon: 'trophy', label: { pt: 'Arena', en: 'Arena', es: 'Arena' } },
    ],
    trophies: ['🏆', '🏰', '💥', '⭐', '🎯'],
    load: () => import('../games/towers/main.js'),
  },
  {
    id: 'naval',
    cat: 'strategy',
    progress: 100,
    name: { pt: 'Frota de Combate', en: 'Combat Fleet', es: 'Flota de Combate' },
    sub: { pt: 'Guerra no Mar', en: 'Naval Warfare', es: 'Guerra en el Mar' },
    about: {
      pt: 'Posicione sua frota, dispare contra o inimigo e afunde todos os navios dele primeiro. Suba de Marinheiro a Almirante!',
      en: 'Place your fleet, fire at the enemy and sink all their ships first. Rise from Seaman to Admiral!',
      es: 'Coloca tu flota, dispara al enemigo y hunde todos sus barcos primero. ¡Asciende de Marinero a Almirante!',
    },
    modes: [
      { id: '1p', icon: 'user', label: { pt: '1 Jogador', en: '1 Player', es: '1 Jugador' } },
      { id: '2p', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
      { id: 'salvo', icon: 'infinity', label: { pt: 'Salvo', en: 'Salvo', es: 'Salva' } },
    ],
    trophies: ['🏆', '🚢', '💣', '⭐', '🎯'],
    load: () => import('../games/naval/main.js'),
  },
  {
    id: 'farm',
    cat: 'strategy',
    progress: 100,
    name: { pt: 'Fazenda Aventura', en: 'Farm Adventure', es: 'Granja Aventura' },
    sub: { pt: 'Fazenda e Expedições', en: 'Farm & Expeditions', es: 'Granja y Expediciones' },
    about: {
      pt: 'Plante, crie animais, produza na fábrica e entregue encomendas. Depois parta em expedições por terras selvagens atrás de tesouros.',
      en: 'Grow crops, raise animals, run factories and fill orders. Then set off on expeditions into the wild in search of treasure.',
      es: 'Cultiva, cría animales, produce en las fábricas y entrega pedidos. Luego parte en expediciones por tierras salvajes en busca de tesoros.',
    },
    modes: [
      { id: 'farm', icon: 'home', label: { pt: 'Fazenda', en: 'Farm', es: 'Granja' } },
      { id: 'expedition', icon: 'pin', label: { pt: 'Expedição', en: 'Expedition', es: 'Expedición' } },
      { id: 'orders', icon: 'calendar', label: { pt: 'Encomendas', en: 'Orders', es: 'Pedidos' } },
    ],
    trophies: ['🏆', '🌾', '🐄', '⭐', '🎯'],
    load: () => import('../games/farm/main.js'),
  },
  {
    id: 'pingpong',
    cat: 'sport',
    progress: 100,
    name: { pt: 'Ping-Pong Pro', en: 'Ping-Pong Pro', es: 'Ping-Pong Pro' },
    sub: { pt: 'Ping-Pong 3D', en: '3D Ping Pong', es: 'Ping-Pong 3D' },
    about: {
      pt: 'Deslize o dedo para rebater, dê efeito e solte a cortada. Vença rivais cada vez mais fortes numa volta ao mundo por arenas incríveis.',
      en: 'Swipe to hit, add spin and unleash the smash. Beat ever tougher rivals on a world tour through stunning arenas.',
      es: 'Desliza el dedo para golpear, dale efecto y suelta el remate. Vence a rivales cada vez más fuertes en una gira mundial por arenas increíbles.',
    },
    modes: [
      { id: 'tour', icon: 'trophy', label: { pt: 'Volta ao Mundo', en: 'World Tour', es: 'Gira Mundial' } },
      { id: 'quick', icon: 'user', label: { pt: 'Partida Rápida', en: 'Quick Match', es: 'Partida Rápida' } },
      { id: 'training', icon: 'flag', label: { pt: 'Treino', en: 'Training', es: 'Entrenamiento' } },
    ],
    trophies: ['🏆', '🏓', '🔥', '⭐', '🎯'],
    load: () => import('../games/pingpong/main.js'),
  },
  // ---- PlayVerse games (games/pv/): run in an iframe, see games/pv/host.js ----
  {
    id: 'blocks',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Block Puzzle', en: 'Block Puzzle', es: 'Block Puzzle' },
    sub: { pt: 'Encaixe de Blocos', en: 'Block Fit', es: 'Encaje de Bloques' },
    about: {
      pt: 'Encaixe as peças no tabuleiro 9×9 e limpe linhas, colunas e quadrados para fazer combos. Quanto mais você limpa, mais pontos ganha. Até onde você chega?',
      en: 'Fit the pieces onto the 9×9 board and clear rows, columns and squares to chain combos. The more you clear, the more you score. How far can you go?',
      es: 'Encaja las piezas en el tablero de 9×9 y limpia filas, columnas y cuadrados para encadenar combos. Cuanto más limpias, más puntos ganas. ¿Hasta dónde llegas?',
    },
    modes: [],
    trophies: ['🏆', '🧩', '💥', '⭐', '🎯'],
    load: () => import('../games/pv/blocks.js'),
  },
  {
    id: 'water',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Water Sort', en: 'Water Sort', es: 'Water Sort' },
    sub: { pt: 'Quebra-cabeça de Cores', en: 'Color Sorting', es: 'Clasifica los Colores' },
    about: {
      pt: 'Despeje os líquidos de uma garrafa para outra até que cada uma tenha uma só cor. Níveis infinitos, dicas e estrelas para colecionar.',
      en: 'Pour the liquids from bottle to bottle until each one holds a single color. Endless levels, hints and stars to collect.',
      es: 'Vierte los líquidos de una botella a otra hasta que cada una tenga un solo color. Niveles infinitos, pistas y estrellas para coleccionar.',
    },
    modes: [],
    trophies: ['🏆', '🧪', '💧', '⭐', '🎯'],
    load: () => import('../games/pv/water.js'),
  },
  {
    id: 'snake',
    cat: 'classic',
    progress: 100,
    name: { pt: 'Snake', en: 'Snake', es: 'Snake' },
    sub: { pt: 'Cobrinha Clássica', en: 'Classic Snake', es: 'Serpiente Clásica' },
    about: {
      pt: 'Coma, cresça e não bata em nada. Escolha o modo clássico ou infinito e a velocidade, e bata seu recorde.',
      en: 'Eat, grow and do not hit anything. Pick classic or endless mode and your speed, then beat your record.',
      es: 'Come, crece y no choques con nada. Elige el modo clásico o infinito y la velocidad, y supera tu récord.',
    },
    modes: [
      { id: 'classic', icon: 'play', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'endless', icon: 'infinity', label: { pt: 'Infinito', en: 'Endless', es: 'Infinito' } },
    ],
    trophies: ['🏆', '🐍', '🍎', '⭐', '🎯'],
    load: () => import('../games/pv/snake.js'),
  },
  {
    id: 'numbers',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Number Match', en: 'Number Match', es: 'Number Match' },
    sub: { pt: 'Pares e Somas', en: 'Pairs & Sums', es: 'Pares y Sumas' },
    about: {
      pt: 'Junte pares de números iguais ou que somem 10, na linha, na coluna ou na diagonal. Limpe a grade no modo clássico ou encare os desafios.',
      en: 'Match pairs of equal numbers or numbers that add up to 10, along a row, a column or a diagonal. Clear the grid in classic mode or take on the challenges.',
      es: 'Une pares de números iguales o que sumen 10, en fila, columna o diagonal. Limpia la cuadrícula en el modo clásico o afronta los desafíos.',
    },
    modes: [
      { id: 'classic', icon: 'pairs', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'challenge', icon: 'stairs', label: { pt: 'Desafios', en: 'Challenges', es: 'Desafíos' } },
    ],
    trophies: ['🏆', '🔢', '➕', '⭐', '🎯'],
    load: () => import('../games/pv/numbers.js'),
  },
  {
    id: 'solitaire',
    cat: 'classic',
    progress: 100,
    name: { pt: 'Paciência', en: 'Solitaire', es: 'Solitario' },
    sub: { pt: 'Klondike Clássico', en: 'Classic Klondike', es: 'Klondike Clásico' },
    about: {
      pt: 'O clássico jogo de cartas: monte as sequências, leve tudo para as fundações e vença. Compre de 1 ou de 3 cartas, com desfazer e dicas.',
      en: 'The classic card game: build the sequences, move everything to the foundations and win. Draw 1 or 3 cards, with undo and hints.',
      es: 'El clásico juego de cartas: forma las secuencias, lleva todo a las bases y gana. Roba 1 o 3 cartas, con deshacer y pistas.',
    },
    modes: [
      { id: 'draw1', icon: 'one', label: { pt: 'Compra 1', en: 'Draw 1', es: 'Robar 1' } },
      { id: 'draw3', icon: 'three', label: { pt: 'Compra 3', en: 'Draw 3', es: 'Robar 3' } },
    ],
    trophies: ['🏆', '🃏', '♠️', '⭐', '🎯'],
    load: () => import('../games/pv/solitaire.js'),
  },
  {
    id: 'checkers',
    cat: 'classic',
    progress: 100,
    name: { pt: 'Damas', en: 'Checkers', es: 'Damas' },
    sub: { pt: 'Damas Brasileiras', en: 'Brazilian Checkers', es: 'Damas Brasileñas' },
    about: {
      pt: 'Damas 8×8 com as regras brasileiras: captura obrigatória, dama voadora e a lei da maioria. Enfrente o computador em três níveis ou jogue com um amigo.',
      en: 'Checkers on an 8×8 board with Brazilian rules: mandatory capture, flying kings and the majority rule. Face the computer on three levels or play a friend.',
      es: 'Damas 8×8 con reglas brasileñas: captura obligatoria, dama voladora y ley de la mayoría. Enfréntate al ordenador en tres niveles o juega con un amigo.',
    },
    modes: [
      { id: 'ai', icon: 'user', label: { pt: 'Contra o PC', en: 'Vs Computer', es: 'Contra la IA' } },
      { id: '2p', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
    ],
    trophies: ['🏆', '♟️', '👑', '⭐', '🎯'],
    load: () => import('../games/pv/checkers.js'),
  },
  {
    id: 'domino',
    cat: 'classic',
    progress: 100,
    name: { pt: 'Dominó', en: 'Dominoes', es: 'Dominó' },
    sub: { pt: 'Duplo-Seis', en: 'Double Six', es: 'Doble Seis' },
    about: {
      pt: 'Dominó duplo-seis com monte de compra. Encaixe as pedras, bloqueie o adversário e some pontos. Jogue contra o computador ou com um amigo.',
      en: 'Double-six dominoes with a draw pile. Match the tiles, block your opponent and score points. Play the computer or a friend.',
      es: 'Dominó doble seis con pozo para robar. Encaja las fichas, bloquea al rival y suma puntos. Juega contra el ordenador o con un amigo.',
    },
    modes: [
      { id: 'ai', icon: 'user', label: { pt: 'Contra o PC', en: 'Vs Computer', es: 'Contra la IA' } },
      { id: '2p', icon: 'users', label: { pt: '2 Jogadores', en: '2 Players', es: '2 Jugadores' } },
    ],
    trophies: ['🏆', '🀄', '🎲', '⭐', '🎯'],
    load: () => import('../games/pv/domino.js'),
  },
  {
    id: 'sudoku',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Sudoku', en: 'Sudoku', es: 'Sudoku' },
    sub: { pt: 'Lógica e Números', en: 'Logic & Numbers', es: 'Lógica y Números' },
    about: {
      pt: 'Preencha a grade de 1 a 9 sem repetir em linhas, colunas e blocos. Puzzles com solução única, quatro níveis, notas e dicas.',
      en: 'Fill the grid with 1 to 9 without repeating in rows, columns or boxes. Puzzles with a single solution, four levels, notes and hints.',
      es: 'Rellena la cuadrícula del 1 al 9 sin repetir en filas, columnas ni cajas. Puzles con solución única, cuatro niveles, notas y pistas.',
    },
    modes: [
      { id: 'easy', icon: 'one', label: { pt: 'Fácil', en: 'Easy', es: 'Fácil' } },
      { id: 'medium', icon: 'two', label: { pt: 'Médio', en: 'Medium', es: 'Medio' } },
      { id: 'hard', icon: 'three', label: { pt: 'Difícil', en: 'Hard', es: 'Difícil' } },
    ],
    trophies: ['🏆', '🧮', '🧠', '⭐', '🎯'],
    load: () => import('../games/pv/sudoku.js'),
  },
  {
    id: 'g2048',
    cat: 'puzzle',
    progress: 100,
    name: { pt: '2048', en: '2048', es: '2048' },
    sub: { pt: 'Deslize e Junte', en: 'Slide & Merge', es: 'Desliza y Une' },
    about: {
      pt: 'Deslize as peças e junte as iguais até chegar ao 2048 — e continue se quiser mais. Com desfazer e recorde guardado.',
      en: 'Slide the tiles and merge equal ones until you reach 2048, and keep going if you want more. With undo and a saved best score.',
      es: 'Desliza las fichas y une las iguales hasta llegar a 2048, y sigue si quieres más. Con deshacer y récord guardado.',
    },
    modes: [],
    trophies: ['🏆', '🔢', '🔥', '⭐', '🎯'],
    load: () => import('../games/pv/g2048.js'),
  },
  {
    id: 'crossword',
    cat: 'puzzle',
    progress: 100,
    name: { pt: 'Palavras Cruzadas', en: 'Crossword', es: 'Crucigrama' },
    sub: { pt: 'Palavras e Dicas', en: 'Word Puzzles', es: 'Crucigramas' },
    about: {
      pt: 'Resolva as dicas e complete a grade. Grades geradas para cada idioma, com verificação de letras e palavras reveladas.',
      en: 'Solve the clues and complete the grid. Grids generated for each language, with letter checking and word reveals.',
      es: 'Resuelve las pistas y completa la cuadrícula. Cuadrículas generadas para cada idioma, con comprobación de letras y palabras reveladas.',
    },
    modes: [],
    trophies: ['🏆', '📝', '💡', '⭐', '🎯'],
    load: () => import('../games/pv/crossword.js'),
  },
  {
    id: 'dice',
    cat: 'classic',
    progress: 100,
    name: { pt: 'Cinco Dados', en: 'Five Dice', es: 'Cinco Dados' },
    sub: { pt: 'Poker de Dados', en: 'Dice Poker', es: 'Póker de Dados' },
    about: {
      pt: 'Um jogo original de poker de dados: role cinco dados até três vezes, segure os melhores e preencha as 13 categorias. Jogue sozinho, contra o computador ou com amigos no mesmo aparelho.',
      en: 'An original dice-poker game: roll five dice up to three times, hold the best ones and fill all 13 categories. Play solo, against the computer or with friends on the same device.',
      es: 'Un juego original de póker de dados: tira cinco dados hasta tres veces, guarda los mejores y completa las 13 categorías. Juega solo, contra el ordenador o con amigos en el mismo dispositivo.',
    },
    modes: [
      { id: 'classic', icon: 'user', label: { pt: 'Clássico', en: 'Classic', es: 'Clásico' } },
      { id: 'ai', icon: 'question', label: { pt: 'Contra o PC', en: 'Vs Computer', es: 'Contra la IA' } },
      { id: 'local', icon: 'users', label: { pt: 'Local', en: 'Local', es: 'Local' } },
    ],
    trophies: ['🏆', '🎲', '🃏', '⭐', '🎯'],
    load: () => import('../games/dice/main.js'),
  },
];

// Games that ship their own entry.js
GAMES.push(minesEntry, lightsEntry, stackEntry, mazeEntry);

export const CATEGORIES = [
  { id: 'all', label: { pt: 'Todos', en: 'All', es: 'Todos' } },
  { id: 'sport', label: { pt: 'Esportes', en: 'Sports', es: 'Deportes' } },
  { id: 'strategy', label: { pt: 'Estratégia', en: 'Strategy', es: 'Estrategia' } },
  { id: 'knowledge', label: { pt: 'Conhecimento', en: 'Knowledge', es: 'Conocimiento' } },
  { id: 'puzzle', label: { pt: 'Puzzles', en: 'Puzzles', es: 'Puzles' } },
  { id: 'classic', label: { pt: 'Clássicos', en: 'Classics', es: 'Clásicos' } },
];
