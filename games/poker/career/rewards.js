// Cosmetic rewards (never gameplay advantages). Slot ids: theme, back, deck, avatar, frame, title, winAnim, table.
// ids follow C2's supported sets: themes emerald midnight burgundy sand onyx teal royal; backs royal onyx ruby sand emerald violet; frames none gold emerald ruby royal champion.
import { L } from './text.js';
import { evalReq } from './req.js';

const A = (id) => ({ kind: 'achievement', id });
export const COSMETICS = [
  { slot: 'theme', id: 'emerald', name: L('Esmeralda', 'Emerald', 'Esmeralda'), req: null },
  { slot: 'theme', id: 'midnight', name: L('Azul Meia-Noite', 'Midnight Blue', 'Azul Medianoche'), req: { kind: 'level', n: 3 } },
  { slot: 'theme', id: 'burgundy', name: L('Bordeaux', 'Burgundy', 'Burdeos'), req: A('win_local_title') },
  { slot: 'theme', id: 'sand', name: L('Areia', 'Sand', 'Arena'), req: A('first_cash') },
  { slot: 'theme', id: 'onyx', name: L('Ônix', 'Onyx', 'Ônix'), req: { kind: 'unlocked', circuit: 'regional' } },
  { slot: 'theme', id: 'teal', name: L('Petróleo', 'Teal', 'Petróleo'), req: { kind: 'level', n: 8 } },
  { slot: 'theme', id: 'royal', name: L('Azul Real', 'Royal Blue', 'Azul Real'), req: A('win_intl_title') },
  { slot: 'back', id: 'royal', name: L('Real', 'Royal', 'Real'), req: null },
  { slot: 'back', id: 'onyx', name: L('Ônix', 'Onyx', 'Ônix'), req: { kind: 'level', n: 2 } },
  { slot: 'back', id: 'ruby', name: L('Rubi', 'Ruby', 'Rubí'), req: A('first_win') },
  { slot: 'back', id: 'sand', name: L('Areia', 'Sand', 'Arena'), req: A('first_final') },
  { slot: 'back', id: 'emerald', name: L('Esmeralda', 'Emerald', 'Esmeralda'), req: A('regional_title') },
  { slot: 'back', id: 'violet', name: L('Violeta do Campeão', "Champion's Violet", 'Violeta del Campeón'), req: A('champion') },
  { slot: 'deck', id: 'classic', name: L('Baralho Clássico', 'Classic Deck', 'Baraja Clásica'), req: null },
  { slot: 'deck', id: 'fourcolor', name: L('Quatro Cores', 'Four-Colour Deck', 'Cuatro Colores'), req: { kind: 'level', n: 4 } },
  ...[1, 2, 3, 4].map((n) => ({ slot: 'avatar', id: 'p' + n, name: L('Avatar ' + n, 'Avatar ' + n, 'Avatar ' + n), req: null })),
  { slot: 'avatar', id: 'p5', name: L('Avatar 5', 'Avatar 5', 'Avatar 5'), req: { kind: 'level', n: 2 } },
  { slot: 'avatar', id: 'p6', name: L('Avatar 6', 'Avatar 6', 'Avatar 6'), req: { kind: 'level', n: 4 } },
  { slot: 'avatar', id: 'p7', name: L('Avatar 7', 'Avatar 7', 'Avatar 7'), req: A('first_cash') },
  { slot: 'avatar', id: 'p8', name: L('Avatar 8', 'Avatar 8', 'Avatar 8'), req: A('first_final') },
  { slot: 'avatar', id: 'p9', name: L('Avatar 9', 'Avatar 9', 'Avatar 9'), req: { kind: 'level', n: 8 } },
  { slot: 'avatar', id: 'p10', name: L('Avatar 10', 'Avatar 10', 'Avatar 10'), req: A('beat_main_rival') },
  { slot: 'avatar', id: 'p11', name: L('Avatar 11', 'Avatar 11', 'Avatar 11'), req: A('qualify_world') },
  { slot: 'avatar', id: 'p12', name: L('Avatar 12', 'Avatar 12', 'Avatar 12'), req: A('champion') },
  { slot: 'frame', id: 'none', name: L('Sem moldura', 'No frame', 'Sin marco'), req: null },
  { slot: 'frame', id: 'gold', name: L('Ouro', 'Gold', 'Oro'), req: A('first_win') },
  { slot: 'frame', id: 'emerald', name: L('Esmeralda', 'Emerald', 'Esmeralda'), req: A('first_cash') },
  { slot: 'frame', id: 'ruby', name: L('Rubi', 'Ruby', 'Rubí'), req: A('regional_title') },
  { slot: 'frame', id: 'royal', name: L('Real', 'Royal', 'Real'), req: A('win_intl_title') },
  { slot: 'frame', id: 'champion', name: L('Campeão', 'Champion', 'Campeón'), req: A('champion') },
  { slot: 'winAnim', id: 'chips', name: L('Chuva de fichas', 'Chip shower', 'Lluvia de fichas'), req: null },
  { slot: 'winAnim', id: 'confetti', name: L('Confete', 'Confetti', 'Confeti'), req: A('first_win') },
  { slot: 'winAnim', id: 'spotlight', name: L('Holofote', 'Spotlight', 'Foco'), req: A('win_intl_title') },
  { slot: 'winAnim', id: 'gold_rain', name: L('Chuva dourada', 'Golden rain', 'Lluvia dorada'), req: A('champion') },
  { slot: 'table', id: 'oval', name: L('Mesa oval', 'Oval table', 'Mesa ovalada'), req: null },
  { slot: 'table', id: 'legends_lounge', name: L('Salão das Lendas', 'Legends Lounge', 'Salón de las Leyendas'), req: { kind: 'champion' } },
];
export const DEFAULT_SELECTED = { theme: 'emerald', back: 'royal', deck: 'classic', avatar: 'p1', frame: 'none', winAnim: 'chips', table: 'oval', title: null };
export const isUnlockedCosmetic = (c, item) => !item.req || evalReq(c, item.req).met;
/** Adds newly satisfied cosmetics to c.cosmetics.unlocked; returns the new items [{slot,id}]. */
export function refreshUnlocks(c) {
  const out = [];
  for (const it of COSMETICS) {
    const key = it.slot + ':' + it.id;
    if (c.cosmetics.unlocked.includes(key)) continue;
    if (isUnlockedCosmetic(c, it)) { c.cosmetics.unlocked.push(key); out.push({ slot: it.slot, id: it.id, name: it.name }); }
  }
  return out;
}
export function listCosmetics(c, slot) {
  return COSMETICS.filter((i) => !slot || i.slot === slot).map((i) => ({ ...i, unlocked: c.cosmetics.unlocked.includes(i.slot + ':' + i.id), selected: c.cosmetics.selected[i.slot] === i.id, reqInfo: i.req ? evalReq(c, i.req) : null }));
}
