// Achievements: objective, verifiable, progress derived from recorded career data only.
import { L } from './text.js';
import { circuitWins, circuitTitles } from './req.js';
import { EVENT_BY_ID } from './circuits.js';

const st = (c) => c.stats;
const beaten = (c, id) => c.rivals[id]?.beaten || 0;
const wonEv = (c, id) => (c.wonEvents[id] > 0 ? 1 : 0);
export const ACHIEVEMENTS = [
  { id: 'first_tournament', icon: 'cards', target: 1, cur: (c) => st(c).played, name: L('Primeira mesa', 'First Table', 'Primera mesa'), desc: L('Termine o seu primeiro torneio.', 'Finish your first tournament.', 'Termina tu primer torneo.') },
  { id: 'tutorial_done', icon: 'book', target: 1, cur: (c) => (c.flags.tutorialDone ? 1 : 0), name: L('Aprendiz', 'Apprentice', 'Aprendiz'), desc: L('Complete o tutorial.', 'Complete the tutorial.', 'Completa el tutorial.') },
  { id: 'first_cash', icon: 'coin', target: 1, cur: (c) => st(c).cashes, name: L('Primeiro prêmio', 'First Cash', 'Primer premio'), desc: L('Termine nos lugares premiados.', 'Finish in the money.', 'Termina en los puestos premiados.') },
  { id: 'first_final', icon: 'table', target: 1, cur: (c) => st(c).finalTables, name: L('Mesa final', 'Final Table', 'Mesa final'), desc: L('Chegue a uma mesa final de um torneio de várias mesas.', 'Reach the final table of a multi-table event.', 'Llega a la mesa final de un torneo de varias mesas.') },
  { id: 'first_win', icon: 'trophy', target: 1, cur: (c) => st(c).wins, name: L('Primeira vitória', 'First Win', 'Primera victoria'), desc: L('Vença um torneio.', 'Win a tournament.', 'Gana un torneo.') },
  { id: 'ten_tournaments', icon: 'cards', target: 10, cur: (c) => st(c).played, name: L('Veterano de mesa', 'Table Veteran', 'Veterano de mesa'), desc: L('Jogue 10 torneios.', 'Play 10 tournaments.', 'Juega 10 torneos.') },
  { id: 'five_wins', icon: 'trophy', target: 5, cur: (c) => st(c).wins, name: L('Cinco vitórias', 'Five Wins', 'Cinco victorias'), desc: L('Vença 5 torneios.', 'Win 5 tournaments.', 'Gana 5 torneos.') },
  { id: 'heads_up_winner', icon: 'duel', target: 1, cur: (c) => st(c).duelWins, name: L('Mestre do frente a frente', 'Heads-Up Master', 'Maestro del cara a cara'), desc: L('Vença um duelo especial.', 'Win a special duel.', 'Gana un duelo especial.') },
  { id: 'qualify_regional', icon: 'map', target: 1, cur: (c) => (c.unlocked.includes('regional') ? 1 : 0), name: L('Circuito Regional', 'Regional Bound', 'Rumbo al Regional'), desc: L('Abra o Circuito Regional.', 'Unlock the Regional Tour.', 'Abre el Circuito Regional.') },
  { id: 'qualify_intl', icon: 'map', target: 1, cur: (c) => (c.unlocked.includes('intl') ? 1 : 0), name: L('Palco internacional', 'International Stage', 'Escenario internacional'), desc: L('Abra o Circuito Internacional.', 'Unlock the International Tour.', 'Abre el Circuito Internacional.') },
  { id: 'qualify_world', icon: 'globe', target: 1, cur: (c) => (c.qualifiedWorld ? 1 : 0), name: L('Rumo ao Mundial', 'Road to the Worlds', 'Rumbo al Mundial'), desc: L('Qualifique-se para o Campeonato Mundial.', 'Qualify for the World Championship.', 'Clasifícate para el Campeonato Mundial.') },
  { id: 'win_local_title', icon: 'trophy', target: 1, cur: (c) => circuitWins(c, 'local') > 0 ? 1 : 0, name: L('Campeão de bairro', 'Neighbourhood Champ', 'Campeón de barrio'), desc: L('Vença um torneio local.', 'Win a Local tournament.', 'Gana un torneo local.') },
  { id: 'win_regional_title', icon: 'trophy', target: 1, cur: (c) => circuitWins(c, 'regional') > 0 ? 1 : 0, name: L('Rei regional', 'Regional King', 'Rey regional'), desc: L('Vença um torneio regional.', 'Win a Regional tournament.', 'Gana un torneo regional.') },
  { id: 'win_intl_title', icon: 'trophy', target: 1, cur: (c) => circuitTitles(c, 'intl'), name: L('Título internacional', 'International Title', 'Título internacional'), desc: L('Vença um título internacional.', 'Win an International title.', 'Gana un título internacional.') },
  { id: 'win_each_circuit', icon: 'crown', target: 4, cur: (c) => ['local', 'regional', 'intl', 'world'].filter((k) => circuitWins(c, k) > 0).length, name: L('Todos os circuitos', 'All Circuits', 'Todos los circuitos'), desc: L('Vença pelo menos um torneio em cada circuito.', 'Win at least one tournament in every circuit.', 'Gana al menos un torneo en cada circuito.') },
  { id: 'champion', icon: 'crown', target: 1, cur: (c) => c.champion, name: L('Campeão do Mundo', 'World Champion', 'Campeón del Mundo'), desc: L('Vença o Campeonato Mundial.', 'Win the World Championship.', 'Gana el Campeonato Mundial.') },
  { id: 'beat_main_rival', icon: 'duel', target: 1, cur: (c) => beaten(c, 'rafa'), name: L('Fora da Sombra', 'Out of the Shadow', 'Fuera de la sombra'), desc: L('Termine à frente do Rafa Mendes num torneio.', 'Finish ahead of Rafa Mendes in a tournament.', 'Termina por delante de Rafa Mendes en un torneo.') },
  { id: 'beat_rafa_duel', icon: 'duel', target: 1, cur: (c) => wonEv(c, 'reg_duel'), name: L('Acerto de contas', 'Settling the Score', 'Ajuste de cuentas'), desc: L('Vença o duelo contra o Rafa.', 'Win the duel against Rafa.', 'Gana el duelo contra Rafa.') },
  { id: 'beat_legend', icon: 'duel', target: 1, cur: (c) => beaten(c, 'legend'), name: L('Aluno supera a Lenda', 'Beating the Legend', 'Superar a la Leyenda'), desc: L('Termine à frente de Aurelio Vance num torneio.', 'Finish ahead of Aurelio Vance in a tournament.', 'Termina por delante de Aurelio Vance en un torneo.') },
  { id: 'rival_hunter', icon: 'target', target: 1, cur: (c) => Object.values(c.rivals).reduce((s, r) => s + (r.koByYou || 0), 0), name: L('Caçador de rivais', 'Rival Hunter', 'Cazador de rivales'), desc: L('Elimine pessoalmente um rival nomeado.', 'Personally knock out a named rival.', 'Elimina personalmente a un rival con nombre.') },
  { id: 'knockouts_10', icon: 'target', target: 10, cur: (c) => st(c).ko, name: L('Dez eliminações', 'Ten Knockouts', 'Diez eliminaciones'), desc: L('Elimine 10 jogadores no total.', 'Knock out 10 players in total.', 'Elimina a 10 jugadores en total.') },
  { id: 'big_pot', icon: 'chips', target: 20000, cur: (c) => st(c).biggestPot, name: L('Pote gigante', 'Monster Pot', 'Bote gigante'), desc: L('Ganhe um pote com 20.000 fichas ou mais.', 'Win a pot of 20,000 chips or more.', 'Gana un bote de 20.000 fichas o más.') },
  { id: 'bluff_artist', icon: 'mask', target: 5, cur: (c) => st(c).bluffWins, name: L('Artista do blefe', 'Bluff Artist', 'Artista del farol'), desc: L('Ganhe 5 potes com um blefe (sem par, todos desistem).', 'Win 5 pots with a bluff (no pair, everyone folds).', 'Gana 5 botes con un farol (sin pareja, todos se retiran).') },
  { id: 'comeback_kid', icon: 'bolt', target: 1, cur: (c) => st(c).comebacks, name: L('A volta por cima', 'Comeback Kid', 'La remontada'), desc: L('Recupere de 6 big blinds ou menos até o stack inicial.', 'Recover from 6 big blinds or less back to your starting stack.', 'Recupérate de 6 ciegas grandes o menos hasta tu stack inicial.') },
  { id: 'allin_hero', icon: 'bolt', target: 5, cur: (c) => st(c).allInWins, name: L('Herói do all-in', 'All-In Hero', 'Héroe del all-in'), desc: L('Ganhe 5 potes em showdown com um adversário all-in.', 'Win 5 showdown pots against an all-in opponent.', 'Gana 5 botes en showdown contra un rival all-in.') },
  { id: 'winnings_100k', icon: 'coin', target: 100000, cur: (c) => st(c).winnings, name: L('Cem mil', 'Six Figures', 'Cien mil'), desc: L('Acumule 100.000 em prêmios virtuais.', 'Earn 100,000 in virtual prizes.', 'Acumula 100.000 en premios virtuales.') },
  { id: 'level_10', icon: 'star', target: 10, cur: (c) => c.level, name: L('Nível 10', 'Level 10', 'Nivel 10'), desc: L('Alcance o nível 10.', 'Reach level 10.', 'Alcanza el nivel 10.') },
  { id: 'season_champion', icon: 'crown', target: 1, cur: (c) => c.seasonHistory.filter((s) => s.rank === 1).length, name: L('Campeão da temporada', 'Season Champion', 'Campeón de la temporada'), desc: L('Termine uma temporada em 1.º lugar do ranking.', 'Finish a season ranked first.', 'Termina una temporada en 1.er lugar del ranking.') },
  { id: 'regional_title', icon: 'trophy', target: 1, cur: (c) => wonEv(c, 'reg_final'), name: L('Masters Regional', 'Regional Masters', 'Másters Regional'), desc: L('Vença o Masters Regional.', 'Win the Regional Masters.', 'Gana los Másters Regional.') },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export function achievementProgress(c, a) { const cur = Math.max(0, a.cur(c) || 0); return { id: a.id, cur: Math.min(cur, a.target), target: a.target, unlocked: !!c.achievements[a.id], at: c.achievements[a.id]?.at ?? null }; }
export const listAchievements = (c) => ACHIEVEMENTS.map((a) => ({ ...a, cur: undefined, ...achievementProgress(c, a) }));
/** Records newly satisfied achievements; returns their ids. Never awards anything not satisfied by recorded data. */
export function evaluateAchievements(c, now = 0) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (c.achievements[a.id]) continue;
    if ((a.cur(c) || 0) >= a.target) { c.achievements[a.id] = { at: now }; out.push(a.id); }
  }
  return out;
}
void EVENT_BY_ID;
