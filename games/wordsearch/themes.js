// Theme packs (chapters) and themes. Word lists live in words-<lang>.js and use
// the same theme ids. Every pack has 6 themes = 6 levels per chapter.

export const PACKS = [
  { id: 'animals', emoji: '🐾', color: '#f0a33a', name: { pt: 'Bichos', en: 'Animal Kingdom', es: 'Mundo Animal' }, themes: ['animals', 'pets', 'birds', 'insects', 'safari', 'sea'] },
  { id: 'food', emoji: '🍎', color: '#ef5b45', name: { pt: 'Comidas', en: 'Food', es: 'Comidas' }, themes: ['fruits', 'vegetables', 'desserts', 'breakfast', 'drinks', 'snacks'] },
  { id: 'home', emoji: '🏠', color: '#d39556', name: { pt: 'Lar, Doce Lar', en: 'Home Sweet Home', es: 'Hogar, Dulce Hogar' }, themes: ['house', 'furniture', 'kitchen', 'bathroom', 'cleaning', 'garden'] },
  { id: 'basics', emoji: '🎨', color: '#f7c948', name: { pt: 'Primeiras Palavras', en: 'First Words', es: 'Primeras Palabras' }, themes: ['colors', 'shapes', 'numbers', 'calendar', 'actions', 'materials'] },
  { id: 'school', emoji: '📚', color: '#9b7bf0', name: { pt: 'Escola', en: 'School', es: 'Escuela' }, themes: ['school', 'math', 'science', 'history', 'books', 'geography'] },
  { id: 'sports', emoji: '⚽', color: '#3cc47a', name: { pt: 'Esportes', en: 'Sports', es: 'Deportes' }, themes: ['sports', 'soccer', 'gym', 'olympics', 'watersports', 'martial'] },
  { id: 'nature', emoji: '🌿', color: '#5fbf5a', name: { pt: 'Natureza', en: 'Nature', es: 'Naturaleza' }, themes: ['forest', 'flowers', 'trees', 'weather', 'landscape', 'mountain'] },
  { id: 'travel', emoji: '✈️', color: '#35c2cf', name: { pt: 'Viagens', en: 'Travel', es: 'Viajes' }, themes: ['transport', 'travel', 'airport', 'beach', 'camping', 'city'] },
  { id: 'people', emoji: '😊', color: '#f5884c', name: { pt: 'Gente', en: 'People', es: 'Personas' }, themes: ['body', 'family', 'feelings', 'clothes', 'accessories', 'qualities'] },
  { id: 'work', emoji: '💼', color: '#5a8ff0', name: { pt: 'Trabalho', en: 'Work', es: 'Trabajo' }, themes: ['professions', 'tools', 'office', 'hospital', 'construction', 'restaurant'] },
  { id: 'arts', emoji: '🎵', color: '#ee6aa7', name: { pt: 'Arte e Música', en: 'Arts & Music', es: 'Arte y Música' }, themes: ['music', 'instruments', 'art', 'dance', 'movies', 'theater'] },
  { id: 'fun', emoji: '🎲', color: '#f08c2e', name: { pt: 'Diversão', en: 'Fun & Games', es: 'Diversión' }, themes: ['toys', 'games', 'hobbies', 'fishing', 'farm', 'park'] },
  { id: 'parties', emoji: '🎉', color: '#e9c13d', name: { pt: 'Festas', en: 'Celebrations', es: 'Fiestas' }, themes: ['party', 'christmas', 'carnival', 'wedding', 'circus', 'halloween'] },
  { id: 'world', emoji: '🌎', color: '#45a6e8', name: { pt: 'Mundo', en: 'World', es: 'Mundo' }, themes: ['countries', 'capitals', 'languages', 'worldfood', 'brazil', 'cities'] },
  { id: 'fantasy', emoji: '🐉', color: '#a866e0', name: { pt: 'Fantasia', en: 'Fantasy', es: 'Fantasía' }, themes: ['fairytales', 'pirates', 'medieval', 'magic', 'space', 'dinosaurs'] },
  { id: 'tech', emoji: '💻', color: '#2fc6e0', name: { pt: 'Tecnologia', en: 'Technology', es: 'Tecnología' }, themes: ['computer', 'videogames', 'energy', 'robots', 'internet', 'car'] },
];

const T = (id, emoji, pt, en, es) => ({ id, emoji, name: { pt, en, es } });

export const THEMES = [
  T('animals', '🦁', 'Animais', 'Animals', 'Animales'),
  T('pets', '🐶', 'Animais de Estimação', 'Pets', 'Mascotas'),
  T('birds', '🦜', 'Aves', 'Birds', 'Aves'),
  T('insects', '🐞', 'Insetos', 'Insects', 'Insectos'),
  T('safari', '🦒', 'Safári', 'Safari', 'Safari'),
  T('sea', '🐙', 'Fundo do Mar', 'Under the Sea', 'Fondo del Mar'),

  T('fruits', '🍓', 'Frutas', 'Fruits', 'Frutas'),
  T('vegetables', '🥕', 'Legumes e Verduras', 'Vegetables', 'Verduras'),
  T('desserts', '🍰', 'Doces e Sobremesas', 'Sweets & Desserts', 'Dulces y Postres'),
  T('breakfast', '🥐', 'Café da Manhã', 'Breakfast', 'Desayuno'),
  T('drinks', '🥤', 'Bebidas', 'Drinks', 'Bebidas'),
  T('snacks', '🍔', 'Lanches', 'Snacks', 'Antojitos'),

  T('house', '🏡', 'Casa', 'House', 'Casa'),
  T('furniture', '🛋️', 'Móveis', 'Furniture', 'Muebles'),
  T('kitchen', '🍳', 'Cozinha', 'Kitchen', 'Cocina'),
  T('bathroom', '🛁', 'Banheiro', 'Bathroom', 'Baño'),
  T('cleaning', '🧹', 'Limpeza', 'Cleaning', 'Limpieza'),
  T('garden', '🌻', 'Jardim', 'Garden', 'Jardín'),

  T('colors', '🌈', 'Cores', 'Colors', 'Colores'),
  T('shapes', '🔷', 'Formas', 'Shapes', 'Formas'),
  T('numbers', '🔢', 'Números', 'Numbers', 'Números'),
  T('calendar', '📅', 'Dias e Meses', 'Days & Months', 'Días y Meses'),
  T('actions', '🏃', 'Ações', 'Actions', 'Acciones'),
  T('materials', '🧱', 'Materiais', 'Materials', 'Materiales'),

  T('school', '🎒', 'Escola', 'School', 'Escuela'),
  T('math', '➗', 'Matemática', 'Math', 'Matemáticas'),
  T('science', '🔬', 'Ciências', 'Science', 'Ciencias'),
  T('history', '🏛️', 'História', 'History', 'Historia'),
  T('books', '📖', 'Livros e Leitura', 'Books & Reading', 'Libros y Lectura'),
  T('geography', '🧭', 'Geografia', 'Geography', 'Geografía'),

  T('sports', '🏅', 'Esportes', 'Sports', 'Deportes'),
  T('soccer', '⚽', 'Futebol', 'Soccer', 'Fútbol'),
  T('gym', '🏋️', 'Academia', 'Gym', 'Gimnasio'),
  T('olympics', '🥇', 'Olimpíadas', 'Olympics', 'Olimpiadas'),
  T('watersports', '🏄', 'Esportes Aquáticos', 'Water Sports', 'Deportes Acuáticos'),
  T('martial', '🥋', 'Artes Marciais', 'Martial Arts', 'Artes Marciales'),

  T('forest', '🌲', 'Floresta', 'Forest', 'Bosque'),
  T('flowers', '🌷', 'Flores', 'Flowers', 'Flores'),
  T('trees', '🌳', 'Árvores', 'Trees', 'Árboles'),
  T('weather', '⛅', 'Clima', 'Weather', 'Clima'),
  T('landscape', '🏞️', 'Paisagens', 'Landscapes', 'Paisajes'),
  T('mountain', '🏔️', 'Montanha', 'Mountains', 'Montaña'),

  T('transport', '🚆', 'Transportes', 'Transportation', 'Transportes'),
  T('travel', '🧳', 'Viagem', 'Travel', 'Viaje'),
  T('airport', '🛫', 'Aeroporto', 'Airport', 'Aeropuerto'),
  T('beach', '🏖️', 'Praia', 'Beach', 'Playa'),
  T('camping', '⛺', 'Acampamento', 'Camping', 'Campamento'),
  T('city', '🏙️', 'Cidade', 'City', 'Ciudad'),

  T('body', '💪', 'Corpo Humano', 'Human Body', 'Cuerpo Humano'),
  T('family', '👨‍👩‍👧', 'Família', 'Family', 'Familia'),
  T('feelings', '💖', 'Sentimentos', 'Feelings', 'Sentimientos'),
  T('clothes', '👕', 'Roupas', 'Clothes', 'Ropa'),
  T('accessories', '👜', 'Acessórios', 'Accessories', 'Accesorios'),
  T('qualities', '🌟', 'Qualidades', 'Good Qualities', 'Cualidades'),

  T('professions', '👩‍⚕️', 'Profissões', 'Jobs', 'Profesiones'),
  T('tools', '🔧', 'Ferramentas', 'Tools', 'Herramientas'),
  T('office', '🗂️', 'Escritório', 'Office', 'Oficina'),
  T('hospital', '🏥', 'Hospital', 'Hospital', 'Hospital'),
  T('construction', '🏗️', 'Construção', 'Construction', 'Construcción'),
  T('restaurant', '🍽️', 'Restaurante', 'Restaurant', 'Restaurante'),

  T('music', '🎶', 'Música', 'Music', 'Música'),
  T('instruments', '🎸', 'Instrumentos', 'Instruments', 'Instrumentos'),
  T('art', '🎨', 'Arte', 'Art', 'Arte'),
  T('dance', '💃', 'Dança', 'Dance', 'Baile'),
  T('movies', '🎬', 'Cinema', 'Movies', 'Cine'),
  T('theater', '🎭', 'Teatro', 'Theater', 'Teatro'),

  T('toys', '🧸', 'Brinquedos', 'Toys', 'Juguetes'),
  T('games', '♟️', 'Jogos', 'Games', 'Juegos'),
  T('hobbies', '🧶', 'Passatempos', 'Hobbies', 'Pasatiempos'),
  T('fishing', '🎣', 'Pescaria', 'Fishing', 'Pesca'),
  T('farm', '🐄', 'Fazenda', 'Farm', 'Granja'),
  T('park', '🛝', 'Parque', 'Park', 'Parque'),

  T('party', '🎂', 'Aniversário', 'Birthday Party', 'Cumpleaños'),
  T('christmas', '🎄', 'Natal', 'Christmas', 'Navidad'),
  T('carnival', '🎭', 'Carnaval', 'Carnival', 'Carnaval'),
  T('wedding', '💍', 'Casamento', 'Wedding', 'Boda'),
  T('circus', '🎪', 'Circo', 'Circus', 'Circo'),
  T('halloween', '🎃', 'Dia das Bruxas', 'Halloween', 'Halloween'),

  T('countries', '🗺️', 'Países', 'Countries', 'Países'),
  T('capitals', '🏛️', 'Capitais', 'Capitals', 'Capitales'),
  T('languages', '🗣️', 'Idiomas', 'Languages', 'Idiomas'),
  T('worldfood', '🍜', 'Comidas do Mundo', 'World Food', 'Comidas del Mundo'),
  T('brazil', '🇧🇷', 'Brasil', 'Brazil', 'Brasil'),
  T('cities', '🌆', 'Cidades Famosas', 'Famous Cities', 'Ciudades Famosas'),

  T('fairytales', '👑', 'Contos de Fadas', 'Fairy Tales', 'Cuentos de Hadas'),
  T('pirates', '🏴‍☠️', 'Piratas', 'Pirates', 'Piratas'),
  T('medieval', '🏰', 'Idade Média', 'Middle Ages', 'Edad Media'),
  T('magic', '🪄', 'Magia', 'Magic', 'Magia'),
  T('space', '🚀', 'Espaço', 'Space', 'Espacio'),
  T('dinosaurs', '🦖', 'Dinossauros', 'Dinosaurs', 'Dinosaurios'),

  T('computer', '🖥️', 'Informática', 'Computers', 'Informática'),
  T('videogames', '🎮', 'Videogame', 'Video Games', 'Videojuegos'),
  T('energy', '⚡', 'Energia', 'Energy', 'Energía'),
  T('robots', '🤖', 'Robôs e Futuro', 'Robots & Future', 'Robots y Futuro'),
  T('internet', '📱', 'Internet', 'Internet', 'Internet'),
  T('car', '🚗', 'Carro', 'Car', 'Automóvil'),
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
export const PACK_OF_THEME = Object.fromEntries(PACKS.flatMap((p) => p.themes.map((id) => [id, p])));
