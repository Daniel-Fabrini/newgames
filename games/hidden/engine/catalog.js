// Emoji catalog shared by both hidden-object games.
// One line per emoji: emoji|pt|en|es|look-alike groups (comma separated).
// Emoji in the same group can be mistaken for each other at small sizes, so
// when one of them is a target the others are kept out of that scene.
// Only single-codepoint emoji that render in color by default (no ZWJ, no
// skin tones, no text-presentation symbols) — they look right on Android.

const RAW = `
🌷|tulipa|tulip|tulipán|redflower
🌹|rosa|rose|rosa|redflower
🥀|flor murcha|wilted rose|flor marchita|redflower
🌻|girassol|sunflower|girasol|yellowflower
🌸|flor de cerejeira|cherry blossom|flor de cerezo|pinkflower
🌺|hibisco|hibiscus|hibisco|pinkflower
💐|buquê|bouquet|ramo de flores
🦋|borboleta|butterfly|mariposa
🐝|abelha|bee|abeja
🐞|joaninha|ladybug|mariquita
🐛|lagarta|caterpillar|oruga|worm
🐜|formiga|ant|hormiga
🐌|caracol|snail|caracol|shell
🐚|concha|shell|concha|shell
🐦|passarinho|bird|pajarito
🦆|pato|duck|pato
🦢|cisne|swan|cisne
🦉|coruja|owl|búho
🦜|papagaio|parrot|loro
🦩|flamingo|flamingo|flamenco
🐧|pinguim|penguin|pingüino
🐓|galo|rooster|gallo|chicken
🐔|galinha|hen|gallina|chicken
🦃|peru|turkey|pavo|chicken
🐤|pintinho|chick|pollito
🐶|cachorro|dog|perro|dog
🐕|cachorro|dog|perro|dog
🐺|lobo|wolf|lobo|dog
🦊|raposa|fox|zorro
🐈|gato|cat|gato|cat
🐱|gato|cat|gato|cat
🐇|coelho|rabbit|conejo|rabbit
🐁|ratinho|mouse|ratón|mouse
🐀|rato|rat|rata|mouse
🦔|ouriço|hedgehog|erizo|brown
🦝|guaxinim|raccoon|mapache|raccoon
🦡|texugo|badger|tejón|raccoon
🦫|castor|beaver|castor|beaver
🦦|lontra|otter|nutria|beaver
🐻|urso|bear|oso|bear
🧸|ursinho de pelúcia|teddy bear|osito de peluche|bear
🦌|cervo|deer|ciervo
🐗|javali|boar|jabalí|pig
🐖|porco|pig|cerdo|pig
🐄|vaca|cow|vaca
🐑|ovelha|sheep|oveja|sheep
🐐|cabra|goat|cabra|sheep
🐎|cavalo|horse|caballo|horse
🦄|unicórnio|unicorn|unicornio|horse
🎠|cavalinho|carousel horse|caballito|horse
🐘|elefante|elephant|elefante
🐉|dragão|dragon|dragón|reptile
🐸|sapo|frog|rana
🦎|lagartixa|lizard|lagartija|reptile
🐍|cobra|snake|serpiente|worm
🐢|tartaruga|turtle|tortuga
🦇|morcego|bat|murciélago
🐠|peixe tropical|tropical fish|pez tropical|fish
🐟|peixe|fish|pez|fish
🐡|baiacu|blowfish|pez globo
🦈|tubarão|shark|tiburón|shark
🐬|golfinho|dolphin|delfín|shark
🐳|baleia|whale|ballena|whale
🦭|foca|seal|foca
🐙|polvo|octopus|pulpo
🦑|lula|squid|calamar
🦀|caranguejo|crab|cangrejo|crab
🦞|lagosta|lobster|langosta|crab
🦐|camarão|shrimp|camarón|crab
🧜|sereia|mermaid|sirena
🍎|maçã|apple|manzana|apple
🍏|maçã verde|green apple|manzana verde|apple
🍐|pera|pear|pera|apple
🍅|tomate|tomato|tomate|apple
🫑|pimentão|bell pepper|pimiento|apple
🍊|laranja|orange|naranja|citrus,orange
🍋|limão|lemon|limón|citrus
🍑|pêssego|peach|durazno|citrus
🥭|manga|mango|mango|citrus
🎃|abóbora|pumpkin|calabaza|orange
🍌|banana|banana|plátano
🍉|melancia|watermelon|sandía
🍇|uvas|grapes|uvas|berry
🫐|mirtilos|blueberries|arándanos|berry
🍓|morango|strawberry|fresa
🍒|cerejas|cherries|cerezas
🥝|kiwi|kiwi|kiwi
🍍|abacaxi|pineapple|piña
🥥|coco|coconut|coco
🥑|abacate|avocado|aguacate
🍆|berinjela|eggplant|berenjena
🥔|batata|potato|papa|brown
🥕|cenoura|carrot|zanahoria
🌽|milho|corn|maíz
🥒|pepino|cucumber|pepino
🥬|alface|lettuce|lechuga|greens
🥦|brócolis|broccoli|brócoli|greens
🧄|alho|garlic|ajo|onion,egg
🧅|cebola|onion|cebolla|onion
🍄|cogumelo|mushroom|hongo
🥜|amendoim|peanuts|maní|brown
🌰|castanha|chestnut|castaña|brown
🍞|pão|bread|pan|bread
🥖|baguete|baguette|baguette|bread
🥐|croissant|croissant|croissant|crescent
🥠|biscoito da sorte|fortune cookie|galleta de la suerte|crescent
🥨|pretzel|pretzel|pretzel
🥯|bagel|bagel|bagel|roundsnack
🥞|panquecas|pancakes|panqueques|pancake
🧇|waffle|waffle|wafle|pancake
🧀|queijo|cheese|queso|wedge
🍖|carne no osso|meat on bone|carne con hueso
🍗|coxa de frango|drumstick|muslo de pollo
🍔|hambúrguer|burger|hamburguesa
🍟|batata frita|fries|papas fritas
🍕|pizza|pizza|pizza|wedge
🌭|cachorro-quente|hot dog|perro caliente
🥪|sanduíche|sandwich|sándwich
🍝|espaguete|spaghetti|espagueti|bowl
🥣|tigela|bowl|tazón|bowl
🥚|ovo|egg|huevo|egg
🍳|frigideira|frying pan|sartén
🧈|manteiga|butter|mantequilla
🧂|saleiro|salt shaker|salero
🥫|lata|can|lata
🍿|pipoca|popcorn|palomitas
🍡|dango|dango|dango
🥮|bolo lunar|moon cake|pastel de luna
🍦|sorvete|ice cream|helado|icecream
🍧|raspadinha|shaved ice|raspado|icecream
🍩|rosquinha|doughnut|dona|roundsnack
🍪|biscoito|cookie|galleta|roundsnack
🎂|bolo de aniversário|birthday cake|pastel de cumpleaños|cake
🍰|fatia de bolo|cake slice|rebanada de pastel|cake,wedge
🧁|cupcake|cupcake|cupcake|cake
🥧|torta|pie|tarta
🍮|pudim|custard|flan
🍫|chocolate|chocolate|chocolate
🍬|bala|candy|caramelo
🍭|pirulito|lollipop|paleta
🍯|pote de mel|honey pot|tarro de miel
🥛|copo de leite|glass of milk|vaso de leche
☕|xícara de café|coffee|café|cup
🍵|chá|tea|té|cup
🫖|bule|teapot|tetera
🥤|copo com canudo|soft drink|refresco|drink
🧃|caixinha de suco|juice box|jugo en caja|drink
🍹|suco tropical|tropical drink|bebida tropical|drink
🧊|gelo|ice cube|cubo de hielo
🥄|colher|spoon|cuchara
🍴|garfo e faca|fork and knife|tenedor y cuchillo|knife
🔪|faca|knife|cuchillo|knife
🥢|hashi|chopsticks|palillos
⚽|bola de futebol|soccer ball|balón de fútbol|whiteball
🏐|bola de vôlei|volleyball|balón de vóley|whiteball
🏀|bola de basquete|basketball|balón de básquet
🏈|bola oval|football|balón ovalado
🎾|bola de tênis|tennis ball|pelota de tenis
🏓|pingue-pongue|ping pong|ping pong
🎳|boliche|bowling|boliche
🏒|taco de hóquei|hockey stick|palo de hockey|stick
🎿|esquis|skis|esquís|stick
🛷|trenó|sled|trineo
🏂|snowboard|snowboarder|snowboard
🏄|surfista|surfer|surfista
🤹|malabarista|juggler|malabarista
🛹|skate|skateboard|patineta
🛼|patins|roller skate|patín
🛴|patinete|kick scooter|monopatín
🚲|bicicleta|bicycle|bicicleta
🛵|lambreta|motor scooter|motoneta
🚗|carro|car|auto|car
🚕|táxi|taxi|taxi|car
🚓|viatura|police car|patrulla|car
🚑|ambulância|ambulance|ambulancia|van
🚚|caminhão|truck|camión|van
🚒|caminhão de bombeiros|fire engine|camión de bomberos
🚌|ônibus|bus|autobús
🚜|trator|tractor|tractor
🚂|trenzinho|locomotive|trencito
🚁|helicóptero|helicopter|helicóptero
🚀|foguete|rocket|cohete
🛸|disco voador|flying saucer|platillo volador
🚡|teleférico|cable car|teleférico
⛵|veleiro|sailboat|velero|boat
🚤|lancha|speedboat|lancha|boat
🛶|canoa|canoe|canoa|boat
🚢|navio|ship|barco|boat
⚓|âncora|anchor|ancla
🚦|semáforo|traffic light|semáforo
🛑|placa de pare|stop sign|señal de alto
🚧|cavalete de obra|roadwork sign|valla de obra
⛽|bomba de gasolina|fuel pump|surtidor
🚏|ponto de ônibus|bus stop|parada de autobús
☔|guarda-chuva|umbrella|paraguas|umbrella
🌂|guarda-chuva fechado|closed umbrella|paraguas cerrado|umbrella
💼|maleta|briefcase|maletín|case
🧳|mala de viagem|suitcase|maleta|case
👜|bolsa|handbag|bolso|case
👛|carteira|purse|monedero
🎒|mochila|backpack|mochila
🧢|boné|cap|gorra
🎩|cartola|top hat|sombrero de copa
👒|chapéu|sun hat|sombrero
🎓|capelo|graduation cap|birrete
👑|coroa|crown|corona
👓|óculos|glasses|lentes|glasses
🥽|óculos de proteção|goggles|gafas protectoras|glasses
👕|camiseta|T-shirt|camiseta
👖|calça jeans|jeans|jeans
👗|vestido|dress|vestido
🧥|casaco|coat|abrigo
🦺|colete|safety vest|chaleco
🧣|cachecol|scarf|bufanda
🧤|luvas|gloves|guantes
🧦|meias|socks|calcetines
👟|tênis|sneaker|zapatilla|shoe
🥾|bota de trilha|hiking boot|bota de montaña|boot
👢|bota|boot|bota|boot
🩴|chinelo|flip-flop|chancla
👙|biquíni|bikini|bikini|swim
🩱|maiô|swimsuit|traje de baño|swim
🩳|bermuda|shorts|short|swim
💄|batom|lipstick|labial
💍|anel|ring|anillo|gem
💎|diamante|diamond|diamante|gem
🧴|protetor solar|lotion|protector solar
🪥|escova de dente|toothbrush|cepillo de dientes
🧽|esponja|sponge|esponja
🧻|rolo de papel|paper roll|rollo de papel
🧹|vassoura|broom|escoba
🧺|cesta|basket|canasta
🪣|balde|bucket|balde
🛒|carrinho de compras|shopping cart|carrito
📦|caixa|box|caja
🎁|presente|gift|regalo
🎈|balão|balloon|globo
🎀|laço|ribbon|moño
🪁|pipa|kite|cometa
🪀|ioiô|yo-yo|yoyó|disc
🥏|frisbee|frisbee|frisbee|disc
💿|CD|CD|CD|disc
🎲|dado|die|dado
🧩|quebra-cabeça|puzzle piece|rompecabezas
🎮|controle|game controller|control
🪅|piñata|piñata|piñata
🪆|boneca russa|nesting dolls|matrioska
🎎|bonecas|dolls|muñecas
🤖|robô|robot|robot
🦖|tiranossauro|T-Rex|tiranosaurio|dino
🦕|dinossauro|dinosaur|dinosaurio|dino
🎨|paleta de tintas|paint palette|paleta de pintura
🎯|alvo|bullseye|diana
🪃|bumerangue|boomerang|bumerán
🧶|novelo de lã|ball of yarn|ovillo de lana
🧵|carretel de linha|spool of thread|carrete de hilo
🔮|bola de cristal|crystal ball|bola de cristal
🪄|varinha mágica|magic wand|varita mágica
🃏|curinga|joker card|comodín
🎭|máscaras|theater masks|máscaras
🎪|tenda de circo|circus tent|carpa de circo
🎫|ingresso|ticket|boleto
🎬|claquete|clapper board|claqueta
🎸|guitarra|guitar|guitarra|guitar
🎻|violino|violin|violín|guitar
🪕|banjo|banjo|banjo|guitar
🎺|trompete|trumpet|trompeta|horn
🎷|saxofone|saxophone|saxofón|horn
📯|corneta|post horn|corneta|horn
🥁|tambor|drum|tambor|drum
🪘|atabaque|long drum|tambor largo|drum
🪗|sanfona|accordion|acordeón
🎹|teclado|piano keys|teclado
🎤|microfone|microphone|micrófono
🎧|fone de ouvido|headphones|audífonos
📻|rádio|radio|radio
📢|megafone|megaphone|megáfono|speaker
🔊|alto-falante|speaker|altavoz|speaker
🎼|partitura|sheet music|partitura
🎵|nota musical|music note|nota musical
🔔|sino|bell|campana
📺|televisão|television|televisor
📱|celular|phone|celular
💻|notebook|laptop|laptop
💾|disquete|floppy disk|disquete
📷|câmera|camera|cámara
🔦|lanterna|flashlight|linterna
🏮|lanterna de papel|paper lantern|farolito
💡|lâmpada|light bulb|foco
🔋|pilha|battery|pila
🔌|tomada|plug|enchufe
🧲|ímã|magnet|imán
🔧|chave inglesa|wrench|llave inglesa
🔨|martelo|hammer|martillo
🪛|chave de fenda|screwdriver|destornillador
🪚|serrote|saw|serrucho
🔩|parafuso|nut and bolt|tornillo
🪓|machado|axe|hacha
🧰|caixa de ferramentas|toolbox|caja de herramientas
🪜|escada|ladder|escalera
🧱|tijolo|brick|ladrillo
🪵|lenha|wood|leña
🪨|pedra|rock|roca
🪤|ratoeira|mousetrap|ratonera
🪝|gancho|hook|gancho
🔗|corrente|chain link|eslabón
🔒|cadeado|padlock|candado
🔑|chave|key|llave
🧯|extintor|fire extinguisher|extintor
🧪|tubo de ensaio|test tube|tubo de ensayo
🔬|microscópio|microscope|microscopio|scope
🔭|telescópio|telescope|telescopio|scope
📡|antena parabólica|satellite dish|antena parabólica
🧭|bússola|compass|brújula
⏰|despertador|alarm clock|despertador|clock
⌚|relógio de pulso|wristwatch|reloj de pulsera|clock
⏳|ampulheta|hourglass|reloj de arena|hourglass
⌛|ampulheta|hourglass|reloj de arena|hourglass
📚|livros|books|libros|book
📖|livro aberto|open book|libro abierto|book
📓|caderno|notebook|cuaderno|book
📜|pergaminho|scroll|pergamino
📝|bloco de notas|memo|nota|paper
📰|jornal|newspaper|periódico|paper
💌|carta de amor|love letter|carta de amor
📁|pasta|folder|carpeta
📅|calendário|calendar|calendario
🔖|marcador|bookmark|marcador
📎|clipe|paperclip|clip
📌|tachinha|pushpin|chincheta
📐|esquadro|triangle ruler|escuadra|ruler
📏|régua|ruler|regla|ruler
🔍|lupa|magnifying glass|lupa
🧮|ábaco|abacus|ábaco
🪶|pena|feather|pluma
🪑|cadeira|chair|silla
🪞|espelho|mirror|espejo
🪴|vaso de planta|potted plant|maceta
🏺|vaso antigo|amphora|ánfora
🗿|estátua de pedra|stone statue|estatua de piedra
🦴|osso|bone|hueso
💀|caveira|skull|calavera|spooky
👻|fantasma|ghost|fantasma|spooky
🪦|lápide|headstone|lápida
🧿|olho grego|nazar amulet|ojo turco
📿|colar de contas|prayer beads|collar de cuentas
🎐|sino de vento|wind chime|campanita de viento
🔱|tridente|trident|tridente
🏹|arco e flecha|bow and arrow|arco y flecha
🪙|moeda|coin|moneda
💰|saco de dinheiro|money bag|bolsa de dinero
🏆|troféu|trophy|trofeo
🥇|medalha de ouro|gold medal|medalla de oro
🪢|nó de corda|knot|nudo
🎣|vara de pescar|fishing pole|caña de pescar
⛺|barraca|tent|tienda de campaña
🔥|fogueira|campfire|fogata
🌍|planeta Terra|Earth|Tierra
🌙|lua|moon|luna|moon
🌞|sol|sun|sol|moon
🪐|Saturno|Saturn|Saturno
⭐|estrela|star|estrella|star
🌟|estrela brilhante|glowing star|estrella brillante|star
✨|brilhos|sparkles|destellos|star
👽|alienígena|alien|extraterrestre|alien
👾|monstrinho|space invader|marcianito|alien
👹|ogro|ogre|ogro|monster
👺|duende|goblin|duende|monster
🤡|palhaço|clown|payaso
🧙|mago|mage|mago|witch
🧛|vampiro|vampire|vampiro|witch
🧟|zumbi|zombie|zombi
🎅|Papai Noel|Santa Claus|Papá Noel|santa
🥶|carinha congelada|cold face|cara congelada
💃|dançarina|dancer|bailarina
🕺|dançarino|man dancing|bailarín
⛄|boneco de neve|snowman|muñeco de nieve
🎄|árvore de Natal|Christmas tree|árbol de Navidad|pine
🌲|pinheiro|pine tree|pino|pine
🌳|árvore|tree|árbol|greens
🌴|coqueiro|palm tree|palmera
🌿|erva|herb|hierba|leaf
🍃|folhas|leaves|hojas|leaf
🍀|trevo|clover|trébol|leaf
🍁|folha de bordo|maple leaf|hoja de arce|maple
🍂|folhas secas|fallen leaves|hojas secas|maple
🌾|trigo|wheat|trigo
❄️|floco de neve|snowflake|copo de nieve
`;

export const CATALOG = new Map();
for (const line of RAW.split('\n')) {
  if (!line.trim()) continue;
  const [ch, pt, en, es, groups = ''] = line.split('|');
  CATALOG.set(ch, { ch, pt, en, es, groups: groups ? groups.split(',') : [] });
}

// Every emoji that shares a look-alike group with `ch` (including itself).
export function lookAlikes(ch) {
  const out = new Set([ch]);
  const e = CATALOG.get(ch);
  if (!e) return out;
  for (const other of CATALOG.values()) {
    if (other.groups.some((g) => e.groups.includes(g))) out.add(other.ch);
  }
  return out;
}

export function emojiName(ch, lang) {
  const e = CATALOG.get(ch);
  return e ? e[lang] || e.en : ch;
}

// Splits a theme string ("🍎 🍌 🍇") into an array of emoji.
export function emojiList(str) {
  return String(str || '')
    .split(/\s+/)
    .filter((c) => c && CATALOG.has(c));
}
