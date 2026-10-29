// Circuits, events and requirement definitions (pure data + builders). All text fields are {pt,en,es}.
import { L } from './text.js';
import { makeStructure } from '../tournament/structures.js';
import { rivalEntrant } from './rivals.js';

export const CIRCUITS = [
  { id: 'local', order: 1, name: L('Local Grinder', 'Local Grinder', 'Local Grinder'), tag: L('Torneios de bairro', 'Neighbourhood games', 'Torneos de barrio'),
    desc: L('Mesas pequenas e rivais iniciantes. Ganhe o seu primeiro título para abrir o Circuito Regional.', 'Small tables and beginner rivals. Win your first title to open the Regional Tour.', 'Mesas pequeñas y rivales principiantes. Gana tu primer título para abrir el Circuito Regional.'), unlock: null, final: 'local_final', mult: 1 },
  { id: 'regional', order: 2, name: L('Circuito Regional', 'Regional Tour', 'Circuito Regional'), tag: L('Pontos e consistência', 'Points and consistency', 'Puntos y consistencia'),
    desc: L('Torneios maiores, blinds mais duros e rivais recorrentes. Acumule pontos para se qualificar ao Internacional.', 'Bigger events, tougher blinds and recurring rivals. Collect points to qualify for the International Tour.', 'Torneos más grandes, ciegas más duras y rivales recurrentes. Acumula puntos para clasificarte al Internacional.'),
    unlock: { kind: 'wins', circuit: 'local', n: 1 }, final: 'reg_final', mult: 2.5 },
  { id: 'intl', order: 3, name: L('Circuito Internacional', 'International Tour', 'Circuito Internacional'), tag: L('Elite mundial', 'World elite', 'Élite mundial'),
    desc: L('Grandes campos, estruturas progressivas e especialistas. Título, satélite ou ranking abrem o Campeonato Mundial.', 'Large fields, progressive structures and specialists. A title, the satellite or the ranking opens the World Championship.', 'Grandes campos, estructuras progresivas y especialistas. Un título, el satélite o el ranking abren el Campeonato Mundial.'),
    unlock: { kind: 'any', of: [{ kind: 'points', circuit: 'regional', n: 220 }, { kind: 'title', event: 'reg_final' }] }, final: 'intl_final', mult: 5 },
  { id: 'world', order: 4, name: L('Campeonato Mundial', 'World Championship', 'Campeonato Mundial'), tag: L('O grande final', 'The grand finale', 'La gran final'),
    desc: L('Três dias, 135 jogadores e um único troféu. Só se entra por qualificação.', 'Three days, 135 players and a single trophy. Entry by qualification only.', 'Tres días, 135 jugadores y un solo trofeo. Solo se entra por clasificación.'),
    unlock: { kind: 'qualified' }, final: 'world_main', mult: 12 },
];
export const CIRCUIT_BY_ID = Object.fromEntries(CIRCUITS.map((c) => [c.id, c]));

/** The three ways to reach the World Championship. */
export const QUAL_WORLD = {
  kind: 'any', of: [
    { kind: 'titles', circuit: 'intl', n: 1, id: 'title' },
    { kind: 'title', event: 'intl_sat', id: 'satellite' },
    { kind: 'rank', circuit: 'intl', top: 4, minEvents: 4, id: 'ranking' },
  ],
};

const S = (stack, bb0, hpl, extra = {}) => ({ startStack: stack, structure: makeStructure({ bb: bb0, handsPerLevel: hpl, ...extra }) });

const STORY = {
  tito: { intro: L('Tito empurra as fichas na mesa: "Só você e eu, campeão! Sem cartas escondidas na manga."', 'Tito slides his chips forward: "Just you and me, champ. No cards up my sleeve."', 'Tito empuja sus fichas: "¡Solo tú y yo, campeón! Sin cartas en la manga."'), win: L('Tito sorri e aperta a sua mão. "Você vai longe. Muito longe."', 'Tito grins and shakes your hand. "You will go far. Very far."', 'Tito sonríe y te estrecha la mano. "Llegarás lejos. Muy lejos."'), lose: L('Tito levanta os braços. "Um dia eu ensino-lhe o meu segredo... se descobrir qual é!"', 'Tito throws his arms up. "One day I will teach you my secret... once I figure it out!"', 'Tito levanta los brazos. "Algún día te enseño mi secreto... ¡cuando descubra cuál es!"') },
  rafa: { intro: L('Rafa estuda-o em silêncio. "Já ouvi falar de você. Mostre-me que não foi sorte."', 'Rafa studies you in silence. "I have heard of you. Show me it was not luck."', 'Rafa te estudia en silencio. "He oído hablar de ti. Demuéstrame que no fue suerte."'), win: L('Rafa inclina a cabeça, a contragosto. "Primeira vez. Não será a última que me incomoda."', 'Rafa nods, reluctantly. "First time. It will not be the last you bother me."', 'Rafa asiente a regañadientes. "La primera vez. No será la última que me molestes."'), lose: L('"Cada ficha é um território", diz Rafa, e recolhe o que ganhou.', '"Every chip is territory," says Rafa, collecting his winnings.', '"Cada ficha es territorio", dice Rafa, y recoge lo ganado.') },
  celeste: { intro: L('Céleste ajusta as luvas. "Os duelos são onde se conhece o carácter."', 'Céleste adjusts her gloves. "Duels are where you learn character."', 'Céleste se ajusta los guantes. "Los duelos son donde se conoce el carácter."'), win: L('"Impressionante", admite Céleste. "Vou lembrar-me deste duelo na mesa final."', '"Impressive," Céleste admits. "I will remember this duel at the final table."', '"Impresionante", admite Céleste. "Recordaré este duelo en la mesa final."'), lose: L('Céleste sorri. "A pressão é um bom professor. Volte quando estiver pronto."', 'Céleste smiles. "Pressure is a fine teacher. Come back when you are ready."', 'Céleste sonríe. "La presión es un buen maestro. Vuelve cuando estés listo."') },
  legend: { intro: L('Aurelio Vance pousa o relógio na mesa. "Um último desafio. Mostre-me o que aprendeu."', 'Aurelio Vance sets his watch on the table. "One last challenge. Show me what you have learned."', 'Aurelio Vance deja su reloj sobre la mesa. "Un último desafío. Muéstrame lo que has aprendido."'), win: L('A lenda levanta-se e aplaude devagar. "O jogo está em boas mãos."', 'The legend stands and applauds slowly. "The game is in good hands."', 'La leyenda se levanta y aplaude despacio. "El juego está en buenas manos."'), lose: L('"Ainda não", diz a Lenda, com um sorriso quase terno.', '"Not yet," says the Legend with an almost tender smile.', '"Todavía no", dice la Leyenda con una sonrisa casi tierna.') },
  three: { intro: L('Três cadeiras, uma vencedora. Os blinds sobem depressa.', 'Three chairs, one winner. The blinds climb fast.', 'Tres sillas, un ganador. Las ciegas suben rápido.'), win: L('Você domina a mesa a três. Os dois olham-no com respeito.', 'You dominate the three-handed table. Both look at you with respect.', 'Dominas la mesa a tres. Ambos te miran con respeto.'), lose: L('A mesa a três é implacável. Aprenda com ela.', 'Three-handed play is merciless. Learn from it.', 'La mesa a tres es implacable. Aprende de ella.') },
};

// id, circuit, format, name, sub, entrants, tableSize, structure, buyIn, mult, fieldSkill, rivals, req, title, xp, rep, extras
const E = (o) => o;
export const EVENTS = [
  // ---------------- LOCAL ----------------
  E({ id: 'local_cafe', circuit: 'local', format: 'sitgo', name: L('Taça do Café', 'Café Cup', 'Copa del Café'), sub: L('Sit & Go para 6 jogadores', '6-player sit & go', 'Sit & Go de 6 jugadores'), entrants: 6, tableSize: 6, ...S(1500, 30, 8), buyIn: 50, mult: 1, fieldSkill: [1.5, 3.5], rivals: ['tito'], req: null, title: L('Campeão da Taça do Café', 'Café Cup Champion', 'Campeón de la Copa del Café'), xp: 60, rep: 8, tutorial: true }),
  E({ id: 'local_friday', circuit: 'local', format: 'sitgo', name: L('Freezeout de Sexta', 'Friday Freezeout', 'Freezeout del Viernes'), sub: L('Sit & Go para 9 jogadores', '9-player sit & go', 'Sit & Go de 9 jugadores'), entrants: 9, tableSize: 9, ...S(1500, 30, 8), buyIn: 75, mult: 1, fieldSkill: [2, 4], rivals: ['tito', 'bartholomew'], req: { kind: 'played', circuit: 'local', n: 1 }, title: L('Campeão do Freezeout de Sexta', 'Friday Freezeout Champion', 'Campeón del Freezeout del Viernes'), xp: 70, rep: 9 }),
  E({ id: 'local_ko', circuit: 'local', format: 'ko', name: L('Eliminatória dos Novatos', 'Rookie Knockout', 'Eliminatoria de Novatos'), sub: L('Bounty de 25 por eliminação', '25 bounty per knockout', 'Recompensa de 25 por eliminación'), entrants: 9, tableSize: 9, ...S(1500, 30, 8), buyIn: 75, bounty: 25, mult: 1, fieldSkill: [2, 4.5], rivals: [], req: { kind: 'played', circuit: 'local', n: 2 }, title: L('Rei do Knockout Local', 'Local Knockout King', 'Rey del Knockout Local'), xp: 70, rep: 9 }),
  E({ id: 'local_duel', circuit: 'local', format: 'duel', name: L('Duelo com o Tito', 'Duel with Tito', 'Duelo con Tito'), sub: L('Frente a frente, vencedor leva tudo', 'Heads-up, winner takes all', 'Cara a cara, el ganador se lo lleva todo'), entrants: 2, tableSize: 2, ...S(1500, 30, 6), buyIn: 100, mult: 0.6, fieldSkill: [2, 2], rivals: ['tito'], req: { kind: 'played', circuit: 'local', n: 2 }, title: null, xp: 60, rep: 8, special: true, story: STORY.tito, payoutKind: 'wta' }),
  E({ id: 'local_mini', circuit: 'local', format: 'mtt', name: L('Mini-MTT do Bairro', 'Neighbourhood Mini-MTT', 'Mini-MTT del Barrio'), sub: L('18 jogadores, 2 mesas', '18 players, 2 tables', '18 jugadores, 2 mesas'), entrants: 18, tableSize: 9, ...S(3000, 50, 9), buyIn: 100, mult: 1, fieldSkill: [2.5, 5], rivals: ['tito', 'bartholomew'], req: { kind: 'played', circuit: 'local', n: 3 }, title: L('Campeão do Mini-MTT', 'Mini-MTT Champion', 'Campeón del Mini-MTT'), xp: 90, rep: 12 }),
  E({ id: 'local_final', circuit: 'local', format: 'mtt', name: L('Final do Circuito Local', 'Local Circuit Final', 'Final del Circuito Local'), sub: L('27 jogadores, 3 mesas', '27 players, 3 tables', '27 jugadores, 3 mesas'), entrants: 27, tableSize: 9, ...S(4000, 50, 10), buyIn: 150, mult: 1.5, fieldSkill: [3, 5.5], rivals: ['bartholomew', 'ingrid', 'rafa'], req: { kind: 'any', of: [{ kind: 'points', circuit: 'local', n: 30 }, { kind: 'played', circuit: 'local', n: 5 }] }, title: L('Campeão Local', 'Local Champion', 'Campeón Local'), xp: 150, rep: 20, circuitFinal: true, guarantee: 1000 }),
  // ---------------- REGIONAL ----------------
  E({ id: 'reg_open', circuit: 'regional', format: 'mtt', name: L('Open Regional', 'Regional Open', 'Open Regional'), sub: L('27 jogadores, 3 mesas', '27 players, 3 tables', '27 jugadores, 3 mesas'), entrants: 27, tableSize: 9, ...S(5000, 50, 10), buyIn: 500, mult: 2.5, fieldSkill: [4, 6.5], rivals: ['bartholomew', 'ingrid', 'koji'], req: null, title: L('Campeão do Open Regional', 'Regional Open Champion', 'Campeón del Open Regional'), xp: 130, rep: 25 }),
  E({ id: 'reg_night', circuit: 'regional', format: 'sitgo', name: L('Série Noturna', 'Night Series', 'Serie Nocturna'), sub: L('Sit & Go para 9 jogadores', '9-player sit & go', 'Sit & Go de 9 jugadores'), entrants: 9, tableSize: 9, ...S(3000, 50, 8), buyIn: 300, mult: 1.6, fieldSkill: [4, 6], rivals: ['nadia', 'mirella'], req: { kind: 'played', circuit: 'regional', n: 1 }, title: L('Campeão da Série Noturna', 'Night Series Champion', 'Campeón de la Serie Nocturna'), xp: 100, rep: 20 }),
  E({ id: 'reg_bounty', circuit: 'regional', format: 'ko', name: L('Caça-Prémios', 'Bounty Brawl', 'Caza-Recompensas'), sub: L('18 jogadores, bounty de 100', '18 players, 100 bounty', '18 jugadores, recompensa de 100'), entrants: 18, tableSize: 9, ...S(4000, 50, 9), buyIn: 300, bounty: 100, mult: 2, fieldSkill: [4, 6.5], rivals: ['koji', 'nadia'], req: { kind: 'played', circuit: 'regional', n: 2 }, title: L('Caçador de Prémios', 'Bounty Hunter', 'Cazarrecompensas'), xp: 110, rep: 22 }),
  E({ id: 'reg_three', circuit: 'regional', format: 'duel', name: L('Showdown a Três', 'Three-Handed Showdown', 'Showdown a Tres'), sub: L('Você, Ingrid e Koji', 'You, Ingrid and Koji', 'Tú, Ingrid y Koji'), entrants: 3, tableSize: 3, ...S(3000, 60, 8), buyIn: 500, mult: 1, fieldSkill: [6, 6], rivals: ['ingrid', 'koji'], req: { kind: 'played', circuit: 'regional', n: 2 }, title: null, xp: 90, rep: 18, special: true, story: STORY.three, payoutKind: 'wta' }),
  E({ id: 'reg_duel', circuit: 'regional', format: 'duel', name: L('O Desafio do Rafa', "Rafa's Challenge", 'El Desafío de Rafa'), sub: L('Duelo contra o seu rival', 'A duel against your rival', 'Un duelo contra tu rival'), entrants: 2, tableSize: 2, ...S(3000, 60, 6), buyIn: 800, mult: 1, fieldSkill: [7, 7], rivals: ['rafa'], req: { kind: 'played', circuit: 'regional', n: 3 }, title: null, xp: 120, rep: 25, special: true, story: STORY.rafa, payoutKind: 'wta', mainRival: true }),
  E({ id: 'reg_final', circuit: 'regional', format: 'mtt', name: L('Masters Regional', 'Regional Masters', 'Másters Regional'), sub: L('45 jogadores, 5 mesas', '45 players, 5 tables', '45 jugadores, 5 mesas'), entrants: 45, tableSize: 9, ...S(6000, 60, 10), buyIn: 1000, mult: 3, fieldSkill: [5, 7.5], rivals: ['rafa', 'elena', 'ingrid', 'mirella', 'bartholomew'], req: { kind: 'points', circuit: 'regional', n: 80 }, title: L('Campeão Regional', 'Regional Champion', 'Campeón Regional'), xp: 260, rep: 45, circuitFinal: true, guarantee: 15000 }),
  // ---------------- INTERNATIONAL ----------------
  E({ id: 'intl_open', circuit: 'intl', format: 'mtt', name: L('Open Internacional', 'International Open', 'Open Internacional'), sub: L('63 jogadores, 7 mesas', '63 players, 7 tables', '63 jugadores, 7 mesas'), entrants: 63, tableSize: 9, ...S(10000, 100, 10), buyIn: 2500, mult: 5, fieldSkill: [6, 8.5], rivals: ['rafa', 'elena', 'jun', 'koji', 'nadia', 'mirella'], req: null, title: L('Campeão do Open Internacional', 'International Open Champion', 'Campeón del Open Internacional'), xp: 320, rep: 70 }),
  E({ id: 'intl_ko', circuit: 'intl', format: 'ko', name: L('Knockout High Roller', 'High-Roller Knockout', 'Knockout High Roller'), sub: L('36 jogadores, bounty de 250', '36 players, 250 bounty', '36 jugadores, recompensa de 250'), entrants: 36, tableSize: 9, ...S(8000, 100, 10), buyIn: 2500, bounty: 250, mult: 4, fieldSkill: [6, 8], rivals: ['nadia', 'jun', 'mirella'], req: { kind: 'played', circuit: 'intl', n: 1 }, title: L('Rei do High Roller', 'High-Roller King', 'Rey del High Roller'), xp: 280, rep: 60 }),
  E({ id: 'intl_duel', circuit: 'intl', format: 'duel', name: L('Duelo com a Céleste', 'Duel with Céleste', 'Duelo con Céleste'), sub: L('Duelo de prestígio', 'A prestige duel', 'Un duelo de prestigio'), entrants: 2, tableSize: 2, ...S(5000, 100, 6), buyIn: 5000, mult: 2, fieldSkill: [8, 8], rivals: ['celeste'], req: { kind: 'played', circuit: 'intl', n: 2 }, title: null, xp: 200, rep: 50, special: true, story: STORY.celeste, payoutKind: 'wta' }),
  E({ id: 'intl_prestige', circuit: 'intl', format: 'mtt', name: L('Convite Prestígio', 'Prestige Invitational', 'Invitacional Prestigio'), sub: L('45 jogadores de elite', '45 elite players', '45 jugadores de élite'), entrants: 45, tableSize: 9, ...S(15000, 150, 12), buyIn: 5000, mult: 6, fieldSkill: [7, 9], rivals: ['celeste', 'jun', 'elena', 'koji'], req: { kind: 'any', of: [{ kind: 'played', circuit: 'intl', n: 3 }, { kind: 'points', circuit: 'intl', n: 100 }] }, title: L('Campeão do Convite Prestígio', 'Prestige Invitational Champion', 'Campeón del Invitacional Prestigio'), xp: 420, rep: 90, guarantee: 100000 }),
  E({ id: 'intl_sat', circuit: 'intl', format: 'satellite', name: L('Satélite do Mundial', 'Championship Satellite', 'Satélite del Mundial'), sub: L('18 jogadores, o vencedor leva o lugar', '18 players, the winner takes the seat', '18 jugadores, el ganador se lleva el asiento'), entrants: 18, tableSize: 9, ...S(4000, 50, 8), buyIn: 1000, mult: 1.5, fieldSkill: [6, 8], rivals: ['nadia'], req: { kind: 'played', circuit: 'intl', n: 2 }, title: L('Vencedor do Satélite', 'Satellite Winner', 'Ganador del Satélite'), xp: 200, rep: 30, payoutKind: 'wta', satellite: true }),
  E({ id: 'intl_final', circuit: 'intl', format: 'mtt', name: L('Grande Final Internacional', 'International Grand Final', 'Gran Final Internacional'), sub: L('90 jogadores, 10 mesas', '90 players, 10 tables', '90 jugadores, 10 mesas'), entrants: 90, tableSize: 9, ...S(15000, 150, 12), buyIn: 7500, mult: 7, fieldSkill: [7, 9], rivals: ['rafa', 'celeste', 'elena', 'jun'], req: { kind: 'points', circuit: 'intl', n: 150 }, title: L('Campeão Internacional', 'International Champion', 'Campeón Internacional'), xp: 600, rep: 140, circuitFinal: true, guarantee: 250000 }),
  // ---------------- WORLD ----------------
  E({ id: 'world_main', circuit: 'world', format: 'championship', name: L('Campeonato Mundial', 'World Championship', 'Campeonato Mundial'), sub: L('135 jogadores, 3 dias, 1 troféu', '135 players, 3 days, 1 trophy', '135 jugadores, 3 días, 1 trofeo'), entrants: 135, tableSize: 9, ...S(30000, 200, 12, { handsPerLevelFinal: 18 }), buyIn: 10000, mult: 12, fieldSkill: [7, 9.5], day2Frac: 0.4, rivals: ['rafa', 'celeste', 'elena', 'jun', 'koji', 'nadia', 'legend'], req: { kind: 'qualified' }, title: L('Campeão Mundial', 'World Champion', 'Campeón Mundial'), xp: 1500, rep: 400, circuitFinal: true, championship: true, guarantee: 500000 }),
  E({ id: 'world_legend_duel', circuit: 'world', format: 'duel', name: L('Duelo com a Lenda', 'Duel with the Legend', 'Duelo con la Leyenda'), sub: L('O último desafio', 'The last challenge', 'El último desafío'), entrants: 2, tableSize: 2, ...S(8000, 100, 8), buyIn: 20000, mult: 3, fieldSkill: [10, 10], rivals: ['legend'], req: { kind: 'champion' }, title: null, xp: 300, rep: 100, special: true, story: STORY.legend, payoutKind: 'wta' }),
  E({ id: 'world_legends_cup', circuit: 'world', format: 'mtt', name: L('Taça das Lendas', 'Legends Cup', 'Copa de las Leyendas'), sub: L('27 lendas, 3 mesas (modo lendas)', '27 legends, 3 tables (legends mode)', '27 leyendas, 3 mesas (modo leyendas)'), entrants: 27, tableSize: 9, ...S(20000, 200, 12), buyIn: 10000, mult: 6, fieldSkill: [8, 9.5], rivals: ['legend', 'rafa', 'celeste', 'jun'], req: { kind: 'champion' }, title: L('Campeão da Taça das Lendas', 'Legends Cup Champion', 'Campeón de la Copa de las Leyendas'), xp: 500, rep: 120 }),
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const eventsOf = (circuit) => EVENTS.filter((e) => e.circuit === circuit);

/** Runtime tournament def (what tournament.createTournament takes) for a career event. */
export function buildDef(eventId) {
  const e = EVENT_BY_ID[eventId];
  if (!e) throw new Error('unknown event ' + eventId);
  return {
    id: e.id, circuit: e.circuit, format: e.format === 'satellite' || e.format === 'ko' || e.format === 'duel' ? (e.format === 'duel' ? 'duel' : e.format) : e.format,
    entrants: e.entrants, tableSize: e.tableSize, startStack: e.startStack, structure: e.structure, buyIn: e.buyIn, bounty: e.bounty || 0, guarantee: e.guarantee || 0,
    mult: e.mult, fieldSkill: e.fieldSkill, rivals: e.rivals.map(rivalEntrant), payoutKind: e.payoutKind || 'auto', day2Frac: e.day2Frac,
  };
}

// ----- quick tournaments (not career) -----
export const QUICK_LEVELS = {
  easy: { fieldSkill: [2, 4], label: L('Fácil', 'Easy', 'Fácil') },
  medium: { fieldSkill: [4, 6.5], label: L('Médio', 'Medium', 'Medio') },
  hard: { fieldSkill: [6.5, 9], label: L('Difícil', 'Hard', 'Difícil') },
};
/** Quick sit & go def (6 or 9 seats). difficulty: easy|medium|hard. */
export function quickSitGoDef(difficulty = 'medium', seats = 6) {
  const q = QUICK_LEVELS[difficulty] || QUICK_LEVELS.medium;
  return { id: 'quick_sitgo', circuit: 'quick', format: 'sitgo', entrants: seats, tableSize: seats, startStack: 1500, structure: makeStructure({ bb: 30, handsPerLevel: 8 }), buyIn: 100, mult: 1, fieldSkill: q.fieldSkill, rivals: [], payoutKind: 'auto', quickDifficulty: difficulty };
}
/** Cash-style quick table: 6 seats, fixed blinds, busted players rebuy automatically (format 'quick'; never finishes). */
export function quickCashDef(difficulty = 'medium', seats = 6) {
  const q = QUICK_LEVELS[difficulty] || QUICK_LEVELS.medium;
  return { id: 'quick_cash', circuit: 'quick', format: 'quick', entrants: seats, tableSize: seats, startStack: 2000, structure: makeStructure({ bb: 20, levels: 1, handsPerLevel: 1000000 }), buyIn: 0, mult: 0, fieldSkill: q.fieldSkill, rivals: [], payoutKind: 'wta', quickDifficulty: difficulty };
}

/** Guided first hands: a gentle 4-player sit & go (rookie opponents); COACH_STEPS drive the coachmarks. Not part of career progression. */
export function tutorialDef() {
  return { id: 'tutorial', circuit: 'quick', format: 'sitgo', entrants: 4, tableSize: 4, startStack: 1500, structure: makeStructure({ bb: 30, handsPerLevel: 10, growth: 1.3 }), buyIn: 0, mult: 0, fieldSkill: [1, 2], rivals: [], payoutKind: 'auto', tutorial: true };
}

// ----- tutorial coach steps (keyed by trigger; C2 shows the text as a non-intrusive coachmark) -----
export const COACH_STEPS = [
  { id: 'welcome', trigger: 'first_hand', text: L('Cada jogador recebe duas cartas privadas. Cinco cartas comuns vão aparecer no centro.', 'Each player gets two private cards. Five shared cards will appear in the middle.', 'Cada jugador recibe dos cartas privadas. Aparecerán cinco cartas comunes en el centro.') },
  { id: 'blinds', trigger: 'first_blinds', text: L('Os blinds são apostas obrigatórias. O botão (D) gira a cada mão.', 'Blinds are forced bets. The dealer button (D) moves every hand.', 'Las ciegas son apuestas obligatorias. El botón (D) gira cada mano.') },
  { id: 'actions', trigger: 'first_turn', text: L('Na sua vez: desistir, passar/igualar ou aumentar. Passar só é possível sem aposta pendente.', 'On your turn: fold, check/call or raise. You can only check when there is no bet to match.', 'En tu turno: retirarte, pasar/igualar o subir. Solo puedes pasar si no hay apuesta pendiente.') },
  { id: 'pot_odds', trigger: 'first_facing_bet', text: L('Compare o que paga com o que pode ganhar (pot odds). Pague pouco para ganhar muito.', 'Compare what you pay with what you can win (pot odds). Pay little to win a lot.', 'Compara lo que pagas con lo que puedes ganar (pot odds). Paga poco para ganar mucho.') },
  { id: 'flop', trigger: 'first_flop', text: L('O flop mostra três cartas comuns. Combine-as com as suas para formar a melhor mão de cinco.', 'The flop shows three shared cards. Combine them with yours to make the best five-card hand.', 'El flop muestra tres cartas comunes. Combínalas con las tuyas para hacer la mejor mano de cinco.') },
  { id: 'allin', trigger: 'first_allin', text: L('All-in: apostar todas as fichas. Quem não consegue igualar fica com um pote lateral.', 'All-in: betting all your chips. Short stacks can only win the part of the pot they covered (side pots).', 'All-in: apostar todas tus fichas. Quien no puede igualar solo gana la parte que cubrió (botes laterales).') },
  { id: 'showdown', trigger: 'first_showdown', text: L('No showdown ganha a melhor mão de cinco cartas entre as sete disponíveis.', 'At showdown the best five-card hand out of seven wins.', 'En el showdown gana la mejor mano de cinco cartas de las siete disponibles.') },
  { id: 'level_up', trigger: 'first_level_up', text: L('Os blinds sobem com o tempo. Mantenha as fichas a trabalhar!', 'Blinds rise over time. Keep your chips working!', 'Las ciegas suben con el tiempo. ¡Mantén tus fichas trabajando!') },
  { id: 'bubble', trigger: 'bubble', text: L('Bolha: falta um eliminado para o dinheiro. Os jogadores ficam mais cautelosos.', 'Bubble: one more elimination and everyone is in the money. Players get more cautious.', 'Burbuja: falta una eliminación para entrar en premios. Los jugadores se vuelven más cautelosos.') },
];

// ---------- requirement evaluation (needs a career object; see career.js) ----------
const CN = (id) => CIRCUIT_BY_ID[id]?.name ?? L(id, id, id);
export function describeReq(req) {
  switch (req.kind) {
    case 'played': return req.circuit ? L(`Jogue ${req.n} torneio(s) no circuito (${CN(req.circuit).pt})`, `Play ${req.n} tournament(s) in ${CN(req.circuit).en}`, `Juega ${req.n} torneo(s) en ${CN(req.circuit).es}`) : L(`Jogue ${req.n} torneio(s)`, `Play ${req.n} tournament(s)`, `Juega ${req.n} torneo(s)`);
    case 'points': return L(`Acumule ${req.n} pontos (${CN(req.circuit).pt})`, `Earn ${req.n} points in ${CN(req.circuit).en}`, `Acumula ${req.n} puntos en ${CN(req.circuit).es}`);
    case 'title': return L(`Vença: ${EVENT_BY_ID[req.event]?.name.pt}`, `Win: ${EVENT_BY_ID[req.event]?.name.en}`, `Gana: ${EVENT_BY_ID[req.event]?.name.es}`);
    case 'titles': return L(`Conquiste ${req.n} título(s) em ${CN(req.circuit).pt}`, `Win ${req.n} title(s) in ${CN(req.circuit).en}`, `Gana ${req.n} título(s) en ${CN(req.circuit).es}`);
    case 'wins': return L(`Vença ${req.n} torneio(s) em ${CN(req.circuit).pt}`, `Win ${req.n} tournament(s) in ${CN(req.circuit).en}`, `Gana ${req.n} torneo(s) en ${CN(req.circuit).es}`);
    case 'level': return L(`Alcance o nível ${req.n}`, `Reach level ${req.n}`, `Alcanza el nivel ${req.n}`);
    case 'rank': return L(`Termine no top ${req.top} do ranking (${CN(req.circuit).pt}) após ${req.minEvents} eventos`, `Finish top ${req.top} in the ${CN(req.circuit).en} standings after ${req.minEvents} events`, `Termina en el top ${req.top} del ranking (${CN(req.circuit).es}) tras ${req.minEvents} eventos`);
    case 'qualified': return L('Qualifique-se para o Campeonato Mundial', 'Qualify for the World Championship', 'Clasifícate para el Campeonato Mundial');
    case 'champion': return L('Seja campeão mundial', 'Become world champion', 'Sé campeón mundial');
    case 'achievement': return L('Conquista: ' + req.id, 'Achievement: ' + req.id, 'Logro: ' + req.id);
    case 'any': return L(req.of.map((r) => describeReq(r).pt).join(' ou '), req.of.map((r) => describeReq(r).en).join(' or '), req.of.map((r) => describeReq(r).es).join(' o '));
    case 'all': return L(req.of.map((r) => describeReq(r).pt).join(' e '), req.of.map((r) => describeReq(r).en).join(' and '), req.of.map((r) => describeReq(r).es).join(' y '));
    default: return L('?', '?', '?');
  }
}
