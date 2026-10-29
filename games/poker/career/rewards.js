// Cosmetic rewards (never gameplay advantages). Slot ids: theme, back, deck, avatar, frame, title, winAnim, table.
// back ids map to shared card-back designs (C2 maps 'classic'..'gold' onto whatever games/_cards offers).
import { L } from './text.js';
import { evalReq } from './req.js';

const A = (id) => ({ kind: 'achievement', id });
export const COSMETICS = [
  { slot: 'theme', id: 'green', name: L('Feltro Clássico', 'Classic Felt', 'Fieltro Clásico'), req: null },
  { slot: 'theme', id: 'midnight', name: L('Azul Meia-Noite', 'Midnight Blue', 'Azul Medianoche'), req: { kind: 'level', n: 3 } },
  { slot: 'theme', id: 'burgundy', name: L('Bordeaux', 'Burgundy', 'Burdeos'), req: A('win_local_title') },
  { slot: 'theme', id: 'slate', name: L('Ardósia', 'Slate', 'Pizarra'), req: { kind: 'unlocked', circuit: 'regional' } },
  { slot: 'theme', id: 'gold_room', name: L('Sala Dourada', 'Gold Room', 'Sala Dorada'), req: A('champion') },
  { slot: 'back', id: 'classic', name: L('Clássico', 'Classic', 'Clásico'), req: null },
  { slot: 'back', id: 'midnight', name: L('Meia-Noite', 'Midnight', 'Medianoche'), req: { kind: 'level', n: 2 } },
  { slot: 'back', id: 'crimson', name: L('Carmesim', 'Crimson', 'Carmesí'), req: A('first_win') },
  { slot: 'back', id: 'emerald', name: L('Esmeralda', 'Emerald', 'Esmeralda'), req: A('regional_title') },
  { slot: 'back', id: 'royal', name: L('Real', 'Royal', 'Real'), req: A('win_intl_title') },
  { slot: 'back', id: 'gold', name: L('Ouro do Campeão', "Champion's Gold", 'Oro del Campeón'), req: A('champion') },
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
  { slot: 'frame', id: 'bronze', name: L('Bronze', 'Bronze', 'Bronce'), req: A('first_cash') },
  { slot: 'frame', id: 'silver', name: L('Prata', 'Silver', 'Plata'), req: A('regional_title') },
  { slot: 'frame', id: 'gold', name: L('Ouro', 'Gold', 'Oro'), req: A('win_intl_title') },
  { slot: 'frame', id: 'champion', name: L('Campeão', 'Champion', 'Campeón'), req: A('champion') },
  { slot: 'winAnim', id: 'chips', name: L('Chuva de fichas', 'Chip shower', 'Lluvia de fichas'), req: null },
  { slot: 'winAnim', id: 'confetti', name: L('Confete', 'Confetti', 'Confeti'), req: A('first_win') },
  { slot: 'winAnim', id: 'spotlight', name: L('Holofote', 'Spotlight', 'Foco'), req: A('win_intl_title') },
  { slot: 'winAnim', id: 'gold_rain', name: L('Chuva dourada', 'Golden rain', 'Lluvia dorada'), req: A('champion') },
  { slot: 'table', id: 'oval', name: L('Mesa oval', 'Oval table', 'Mesa ovalada'), req: null },
  { slot: 'table', id: 'legends_lounge', name: L('Salão das Lendas', 'Legends Lounge', 'Salón de las Leyendas'), req: { kind: 'champion' } },
];
export const DEFAULT_SELECTED = { theme: 'green', back: 'classic', deck: 'classic', avatar: 'p1', frame: 'none', winAnim: 'chips', table: 'oval', title: null };
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
