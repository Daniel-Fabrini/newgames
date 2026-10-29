// Original rival characters. Avatar ids = rival id (C2 draws SVG avatars keyed by these ids).
// profile = AI personality params (see ai/profiles.js). circuits = where they appear; arc = main rival arc.
import { L } from './text.js';
import { ARCHETYPES } from '../ai/profiles.js';

const P = (arch, over = {}) => ({ ...ARCHETYPES[arch], ...over, arch });

export const RIVALS = [
  {
    id: 'tito', name: 'Tito Bravo', nick: L('O Calouro', 'The Rookie', 'El Novato'), avatar: 'tito', origin: L('Brasil', 'Brazil', 'Brasil'),
    style: L('Solto e imprevisível', 'Loose and unpredictable', 'Suelto e impredecible'), archetype: 'rookie', profile: P('rookie', { aggr: 0.35, skill: 2 }), circuits: ['local'], events: ['local_cafe', 'local_friday', 'local_duel', 'local_mini'],
    blurb: L('Entra em quase todas as mãos e adora um all-in de vez em quando.', 'Plays almost every hand and loves the odd all-in.', 'Juega casi todas las manos y adora un all-in de vez en cuando.'),
    bio: L('Dono da padaria da esquina, Tito aprendeu poker com os amigos. Não tem estratégia, mas tem coragem de sobra.', 'Owner of the corner bakery, Tito learned poker from friends. No strategy, but plenty of nerve.', 'Dueño de la panadería de la esquina, Tito aprendió póker con amigos. Sin estrategia, pero con mucho coraje.'),
    quotes: [L('Quem não arrisca não petisca!', 'Nothing ventured, nothing gained!', '¡Quien no arriesga no gana!'), L('Eu senti que era a carta certa.', 'I had a feeling about that card.', 'Tenía un presentimiento con esa carta.')],
  },
  {
    id: 'bartholomew', name: 'Bartholomew Finch', nick: L('O Paciente', 'The Patient One', 'El Paciente'), avatar: 'bartholomew', origin: L('Inglaterra', 'England', 'Inglaterra'),
    style: L('Jogador paciente, calcula tudo', 'Patient grinder, calculates everything', 'Jugador paciente, lo calcula todo'), archetype: 'grinder', profile: P('grinder', { skill: 5 }), circuits: ['local', 'regional'], events: ['local_friday', 'local_final', 'reg_open', 'reg_night'],
    blurb: L('Ganha fichas aos poucos e raramente comete erros grandes.', 'Grinds out chips and rarely makes big mistakes.', 'Gana fichas poco a poco y rara vez comete grandes errores.'),
    bio: L('Ex-contador, joga torneios locais há trinta anos com a mesma garrafa de chá ao lado.', 'A retired accountant who has played local tournaments for thirty years with the same flask of tea beside him.', 'Contable jubilado, juega torneos locales desde hace treinta años con el mismo termo de té a su lado.'),
    quotes: [L('Paciência vence a pressa.', 'Patience beats haste.', 'La paciencia vence a la prisa.'), L('As fichas sabem esperar.', 'Chips know how to wait.', 'Las fichas saben esperar.')],
  },
  {
    id: 'ingrid', name: 'Ingrid Halvorsen', nick: L('A Muralha', 'The Wall', 'La Muralla'), avatar: 'ingrid', origin: L('Noruega', 'Norway', 'Noruega'),
    style: L('Extremamente seletiva', 'Extremely selective', 'Extremadamente selectiva'), archetype: 'wall', profile: P('wall', { skill: 6 }), circuits: ['local', 'regional'], events: ['local_final', 'reg_open', 'reg_three', 'reg_final'],
    blurb: L('Só joga mãos fortes e quase nunca blefa. Quando aposta forte, respeite.', 'Only plays strong hands and almost never bluffs. When she bets big, respect it.', 'Solo juega manos fuertes y casi nunca farolea. Cuando apuesta fuerte, respétala.'),
    bio: L('Engenheira de pontes: constrói posições sólidas e espera que os outros se quebrem contra elas.', 'A bridge engineer: builds solid positions and waits for others to crash against them.', 'Ingeniera de puentes: construye posiciones sólidas y espera a que los demás se estrellen.'),
    quotes: [L('Não tenho pressa nenhuma.', 'I am in no hurry.', 'No tengo ninguna prisa.'), L('Dobrar também é uma jogada.', 'Folding is also a play.', 'Retirarse también es una jugada.')],
  },
  {
    id: 'rafa', name: 'Rafa Mendes', nick: L('Sombra', 'Shadow', 'Sombra'), avatar: 'rafa', origin: L('Portugal', 'Portugal', 'Portugal'),
    style: L('Tubarão agressivo', 'Aggressive shark', 'Tiburón agresivo'), archetype: 'shark', profile: P('shark', { skill: 7 }), circuits: ['local', 'regional', 'intl', 'world'], events: ['local_final', 'reg_duel', 'reg_final', 'intl_open', 'intl_duel', 'intl_final', 'world_main'], arc: true,
    blurb: L('Pressiona sem parar. Aparece em cada circuito, sempre um passo à sua frente.', 'Relentless pressure. Shows up in every circuit, always one step ahead of you.', 'Presiona sin parar. Aparece en cada circuito, siempre un paso por delante.'),
    bio: L('Começou nos mesmos clubes que você. Cresceu mais depressa e não esconde que o título mundial é só dele.', 'Started in the same clubs as you. Rose faster and makes no secret that the world title is his alone.', 'Empezó en los mismos clubes que tú. Creció más rápido y no oculta que el título mundial es solo suyo.'),
    quotes: [L('Eu vi você chegar. Vamos ver até onde vai.', 'I saw you coming. Let us see how far you go.', 'Te vi llegar. Veamos hasta dónde llegas.'), L('Cada ficha é um território.', 'Every chip is territory.', 'Cada ficha es territorio.')],
  },
  {
    id: 'koji', name: 'Koji Arata', nick: L('O Ilusionista', 'The Illusionist', 'El Ilusionista'), avatar: 'koji', origin: L('Japão', 'Japan', 'Japón'),
    style: L('Trapaceiro: blefes criativos', 'Trickster: creative bluffs', 'Tramposo: faroles creativos'), archetype: 'trickster', profile: P('trickster', { skill: 7 }), circuits: ['regional', 'intl'], events: ['reg_open', 'reg_three', 'reg_bounty', 'intl_open', 'intl_prestige'],
    blurb: L('Ninguém sabe o que ele tem. Talvez nem ele.', 'Nobody knows what he holds. Maybe not even him.', 'Nadie sabe qué tiene. Quizá ni él.'),
    bio: L('Ex-mágico de palco. Troca o ritmo das apostas como quem troca de cartola.', 'A former stage magician. Changes the rhythm of his bets like swapping top hats.', 'Antiguo mago de escenario. Cambia el ritmo de sus apuestas como quien cambia de chistera.'),
    quotes: [L('Olhe para a minha mão esquerda.', 'Watch my left hand.', 'Mira mi mano izquierda.'), L('A melhor carta é a dúvida.', 'The best card is doubt.', 'La mejor carta es la duda.')],
  },
  {
    id: 'elena', name: 'Prof. Elena Vásquez', nick: L('A Professora', 'The Professor', 'La Profesora'), avatar: 'elena', origin: L('Espanha', 'Spain', 'España'),
    style: L('Analítica e adaptável', 'Analytical and adaptable', 'Analítica y adaptable'), archetype: 'professor', profile: P('professor', { skill: 9 }), circuits: ['regional', 'intl', 'world'], events: ['reg_final', 'intl_open', 'intl_prestige', 'intl_final', 'world_main'],
    blurb: L('Estuda cada adversário e muda de estilo para explorar as suas fugas.', 'Studies every opponent and shifts style to exploit their leaks.', 'Estudia a cada rival y cambia de estilo para explotar sus fugas.'),
    bio: L('Professora de probabilidade em Salamanca. Diz que o poker é só estatística com suspense.', 'Probability professor in Salamanca. Says poker is just statistics with suspense.', 'Profesora de probabilidad en Salamanca. Dice que el póker es solo estadística con suspense.'),
    quotes: [L('Os números não mentem, as pessoas sim.', 'Numbers do not lie, people do.', 'Los números no mienten, las personas sí.'), L('Interessante. Você mudou o padrão.', 'Interesting. You changed your pattern.', 'Interesante. Cambiaste tu patrón.')],
  },
  {
    id: 'nadia', name: 'Nadia Okafor', nick: L('A Faísca', 'The Spark', 'La Chispa'), avatar: 'nadia', origin: L('Nigéria', 'Nigeria', 'Nigeria'),
    style: L('Agressiva e ousada', 'Aggressive and daring', 'Agresiva y atrevida'), archetype: 'maniac', profile: P('maniac', { tight: 0.3, aggr: 0.85, bluff: 0.5, skill: 6, risk: 0.9 }), circuits: ['regional', 'intl'], events: ['reg_bounty', 'reg_night', 'intl_ko', 'intl_open', 'intl_sat'],
    blurb: L('Ataca de qualquer posição. Quando acerta, esmaga a mesa.', 'Attacks from any position. When she hits, she crushes the table.', 'Ataca desde cualquier posición. Cuando acierta, aplasta la mesa.'),
    bio: L('Campeã de torneios de rua em Lagos. Joga rápido e sem medo.', 'Street-tournament champion from Lagos. Plays fast and fearless.', 'Campeona de torneos callejeros en Lagos. Juega rápido y sin miedo.'),
    quotes: [L('Vamos acelerar isto!', 'Let us speed this up!', '¡Aceleremos esto!'), L('Medo é para quem tem pouco a ganhar.', 'Fear is for those with little to win.', 'El miedo es para quien tiene poco que ganar.')],
  },
  {
    id: 'celeste', name: 'Céleste Moreau', nick: L('A Finalizadora', 'The Closer', 'La Cerradora'), avatar: 'celeste', origin: L('França', 'France', 'Francia'),
    style: L('Domina as mesas finais', 'Dominates final tables', 'Domina las mesas finales'), archetype: 'closer', profile: P('closer', { skill: 8 }), circuits: ['intl', 'world'], events: ['intl_duel', 'intl_final', 'intl_prestige', 'world_main'],
    blurb: L('Paciente no início, letal quando restam poucos jogadores.', 'Patient early, lethal when few players remain.', 'Paciente al inicio, letal cuando quedan pocos jugadores.'),
    bio: L('Três mesas finais consecutivas em Monte Carlo. Diz que a pressão é o seu oxigênio.', 'Three consecutive final tables in Monte Carlo. Says pressure is her oxygen.', 'Tres mesas finales consecutivas en Montecarlo. Dice que la presión es su oxígeno.'),
    quotes: [L('É agora que o jogo começa.', 'This is where the game begins.', 'Ahora es cuando empieza el juego.'), L('Cheguei aqui para terminar.', 'I came here to finish it.', 'Vine hasta aquí para terminar.')],
  },
  {
    id: 'jun', name: 'Jun Park', nick: L('O Prodígio', 'The Prodigy', 'El Prodigio'), avatar: 'jun', origin: L('Coreia do Sul', 'South Korea', 'Corea del Sur'),
    style: L('Equilibrado e preciso', 'Balanced and precise', 'Equilibrado y preciso'), archetype: 'balanced', profile: P('balanced', { skill: 8, aggr: 0.6, position: 0.9, adapt: 0.8 }), circuits: ['intl', 'world'], events: ['intl_open', 'intl_ko', 'intl_prestige', 'world_main'],
    blurb: L('Cresceu jogando milhares de mãos por dia. Quase não tem fugas.', 'Grew up playing thousands of hands a day. Almost no leaks.', 'Creció jugando miles de manos al día. Casi sin fugas.'),
    bio: L('Aos 19 anos já era o mais jovem finalista da história do circuito internacional.', 'At 19 he was already the youngest finalist in the international circuit\'s history.', 'A los 19 años ya era el finalista más joven de la historia del circuito internacional.'),
    quotes: [L('Já vi esta situação mil vezes.', 'I have seen this spot a thousand times.', 'He visto esta situación mil veces.'), L('Nada pessoal, só probabilidades.', 'Nothing personal, just odds.', 'Nada personal, solo probabilidades.')],
  },
  {
    id: 'legend', name: 'Aurelio Vance', nick: L('A Lenda', 'The Legend', 'La Leyenda'), avatar: 'legend', origin: L('Itália', 'Italy', 'Italia'),
    style: L('Elite absoluta', 'Absolute elite', 'Élite absoluta'), archetype: 'legend', profile: P('legend', { skill: 10 }), circuits: ['world'], events: ['world_main', 'world_legend_duel', 'world_legends_cup'], finalBoss: true,
    blurb: L('Campeão mundial por três vezes. Não há leitura que ele não faça.', 'Three-time world champion. There is no read he cannot make.', 'Tres veces campeón del mundo. No hay lectura que no haga.'),
    bio: L('Aurelio Vance venceu o primeiro título mundial antes de você nascer. Agora procura um último adversário à altura.', 'Aurelio Vance won his first world title before you were born. Now he is looking for one last worthy opponent.', 'Aurelio Vance ganó su primer título mundial antes de que nacieras. Ahora busca un último rival a su altura.'),
    quotes: [L('Só um de nós levanta o troféu.', 'Only one of us lifts the trophy.', 'Solo uno de nosotros levanta el trofeo.'), L('Mostre-me o que aprendeu.', 'Show me what you have learned.', 'Muéstrame lo que has aprendido.')],
  },
  {
    id: 'mirella', name: 'Mirella Duarte', nick: L('A Veterana', 'The Veteran', 'La Veterana'), avatar: 'mirella', origin: L('Argentina', 'Argentina', 'Argentina'),
    style: L('Sólida e experiente', 'Solid and experienced', 'Sólida y experimentada'), archetype: 'grinder', profile: P('grinder', { skill: 7, tight: 0.55, aggr: 0.55 }), circuits: ['regional', 'intl'], events: ['reg_final', 'reg_night', 'intl_open', 'intl_ko'],
    blurb: L('Jogadora de mesa de café que chegou ao circuito internacional lendo os rivais.', 'A coffee-house player who reached the international circuit by reading opponents.', 'Jugadora de café que llegó al circuito internacional leyendo a los rivales.'),
    bio: L('Aprendeu em Buenos Aires com apostas de rua, e hoje é quem os novatos mais temem encontrar.', 'Learned in Buenos Aires street games and is now the one rookies fear most to meet.', 'Aprendió en Buenos Aires con partidas callejeras y hoy es la que más temen los novatos.'),
    quotes: [L('Já vi esse olhar antes.', 'I have seen that look before.', 'Ya vi esa mirada antes.')],
  },
];
export const RIVAL_BY_ID = Object.fromEntries(RIVALS.map((r) => [r.id, r]));
export const MAIN_RIVAL = 'rafa';
export const FINAL_RIVAL = 'legend';
/** Rival entrant descriptor for tournament.createTournament */
export const rivalEntrant = (id) => { const r = RIVAL_BY_ID[id]; return { id: 'r_' + r.id, name: r.name, avatar: r.avatar, profile: r.profile, rivalId: r.id }; };
