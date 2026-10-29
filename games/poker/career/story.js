// Story beats (main rival arc). Triggered once, by recorded milestones. `when(c, r)`: r = {event, result, newCircuits, qualifiedNow, championNow}.
import { L } from './text.js';
export const STORY_BEATS = [
  { id: 'rafa_first_meeting', rival: 'rafa', when: (c, r) => r.event.id === 'local_final' && r.result.rivals.some((x) => x.id === 'rafa'),
    title: L('Um rosto familiar', 'A Familiar Face', 'Un rostro familiar'),
    text: L('Na final local, um jogador de olhar calmo observa cada jogada sua: Rafa "Sombra" Mendes. Já circula pelos torneios regionais — e parece interessado em você.', 'At the local final a calm-eyed player studies your every move: Rafa "Shadow" Mendes. He already plays the regional events, and he seems interested in you.', 'En la final local, un jugador de mirada tranquila observa cada jugada tuya: Rafa "Sombra" Mendes. Ya juega los torneos regionales y parece interesado en ti.') },
  { id: 'regional_open', rival: 'rafa', when: (c, r) => r.newCircuits.includes('regional'),
    title: L('O Circuito Regional abre', 'The Regional Tour Opens', 'Se abre el Circuito Regional'),
    text: L('O título local abre para você as portas do circuito regional. Rafa deixa uma mensagem: "Nos vemos na mesa. Não me decepcione."', 'Your local title opens the regional tour. Rafa leaves a message: "See you at the table. Do not disappoint me."', 'Tu título local abre las puertas del circuito regional. Rafa deja un mensaje: "Nos vemos en la mesa. No me decepciones."') },
  { id: 'rafa_duel_done', rival: 'rafa', when: (c, r) => r.event.id === 'reg_duel',
    title: L('Primeiro confronto', 'First Showdown', 'Primer enfrentamiento'),
    text: L('O duelo com o Rafa mudou algo: agora ele sabe o seu nome — e você sabe o dele. Há uma aposta maior à espera.', 'The duel with Rafa changed something: now he knows your name, and you know his. A bigger stake awaits.', 'El duelo con Rafa cambió algo: ahora él sabe tu nombre y tú el suyo. Te espera una apuesta mayor.') },
  { id: 'intl_welcome', rival: 'rafa', when: (c, r) => r.newCircuits.includes('intl'),
    title: L('Palco internacional', 'The International Stage', 'El escenario internacional'),
    text: L('Salas maiores, luzes mais fortes. Rafa já chegou ao Circuito Internacional — e Céleste Moreau, a finalizadora, também está atenta.', 'Bigger rooms, brighter lights. Rafa is already on the International Tour, and Céleste Moreau, the closer, is watching too.', 'Salas más grandes, luces más fuertes. Rafa ya está en el Circuito Internacional y Céleste Moreau, la cerradora, también observa.') },
  { id: 'worlds_invite', rival: 'legend', when: (c, r) => r.qualifiedNow,
    title: L('O convite', 'The Invitation', 'La invitación'),
    text: L('Chegou o convite para o Campeonato Mundial. Entre os inscritos: Rafa, Céleste... e Aurelio Vance, a Lenda, que pediu para ver quem se qualificou.', 'The invitation to the World Championship has arrived. Among the entrants: Rafa, Céleste... and Aurelio Vance, the Legend, who asked to see who qualified.', 'Llegó la invitación al Campeonato Mundial. Entre los inscritos: Rafa, Céleste... y Aurelio Vance, la Leyenda, que pidió ver quién se clasificó.') },
  { id: 'world_final_table', rival: 'legend', when: (c, r) => r.event.id === 'world_main' && r.result.finalTable,
    title: L('A mesa final', 'The Final Table', 'La mesa final'),
    text: L('Nove cadeiras, um troféu. O silêncio na sala é total quando as cartas voltam a cair.', 'Nine seats, one trophy. The room falls silent as the cards fly again.', 'Nueve asientos, un trofeo. La sala guarda silencio cuando vuelven a repartirse las cartas.') },
  { id: 'champion_crowned', rival: 'legend', when: (c, r) => r.championNow,
    title: L('Campeão do Mundo', 'World Champion', 'Campeón del Mundo'),
    text: L('O troféu é seu. Aurelio Vance aplaude de pé. "Agora o jogo precisa de novos desafios", diz, e propõe um último duelo — e uma temporada de lendas.', 'The trophy is yours. Aurelio Vance applauds on his feet. "Now the game needs new challenges," he says, proposing one last duel and a legends season.', 'El trofeo es tuyo. Aurelio Vance aplaude de pie. "Ahora el juego necesita nuevos desafíos", dice, y propone un último duelo y una temporada de leyendas.') },
];
export const STORY_BY_ID = Object.fromEntries(STORY_BEATS.map((b) => [b.id, b]));
