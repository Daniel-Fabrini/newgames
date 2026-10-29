// Card model + deck builders + sort/compare + names (pt / en / es).
//
// Card = { r: rankId, s: suitId, id }       (plain JSON, safe to store in saves)
//   French ranks: 'A','2'..'9','T'(=10),'J','Q','K'   suits: 's' ♠  'h' ♥  'd' ♦  'c' ♣
//   Joker:        r:'X', s:'r' (red) | 'b' (black)
//   UNO-style:    r:'0'..'9','skip','reverse','draw2','wild','wild4'   s:'R','Y','G','B' | 'W'
// `id` is unique inside one deck (double decks add "-0"/"-1" copy suffix).
// code(card) → 'As', 'Td', 'Xr' (no copy suffix); parseCode('Td') → card.

export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR = { s: 'black', c: 'black', h: 'red', d: 'red' };
export const RANKS_52 = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const RANKS_40 = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
export const UNO_COLORS = ['R', 'Y', 'G', 'B'];

const NAMES = {
  pt: {
    ranks: { A: 'Ás', 2: 'Dois', 3: 'Três', 4: 'Quatro', 5: 'Cinco', 6: 'Seis', 7: 'Sete', 8: 'Oito', 9: 'Nove', T: 'Dez', J: 'Valete', Q: 'Dama', K: 'Rei' },
    suits: { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' },
    suitsSingular: { s: 'Espadas', h: 'Copas', d: 'Ouros', c: 'Paus' },
    of: ' de ',
    joker: { r: 'Coringa vermelho', b: 'Coringa preto' },
    uno: { R: 'vermelho', Y: 'amarelo', G: 'verde', B: 'azul', W: 'curinga', skip: 'Bloqueio', reverse: 'Inverter', draw2: 'Mais dois', wild: 'Curinga', wild4: 'Curinga mais quatro' },
  },
  en: {
    ranks: { A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King' },
    suits: { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' },
    suitsSingular: { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' },
    of: ' of ',
    joker: { r: 'Red joker', b: 'Black joker' },
    uno: { R: 'red', Y: 'yellow', G: 'green', B: 'blue', W: 'wild', skip: 'Skip', reverse: 'Reverse', draw2: 'Draw two', wild: 'Wild', wild4: 'Wild draw four' },
  },
  es: {
    ranks: { A: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis', 7: 'Siete', 8: 'Ocho', 9: 'Nueve', T: 'Diez', J: 'Sota', Q: 'Reina', K: 'Rey' },
    suits: { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' },
    suitsSingular: { s: 'Picas', h: 'Corazones', d: 'Diamantes', c: 'Tréboles' },
    of: ' de ',
    joker: { r: 'Comodín rojo', b: 'Comodín negro' },
    uno: { R: 'rojo', Y: 'amarillo', G: 'verde', B: 'azul', W: 'comodín', skip: 'Salto', reverse: 'Inversión', draw2: 'Roba dos', wild: 'Comodín', wild4: 'Comodín roba cuatro' },
  },
};

let defaultLang = 'pt';
/** Sets the language used by cardName()/aria labels when no `lang` is passed. Call once with ctx.lang. */
export function setCardLang(lang) {
  if (NAMES[lang]) defaultLang = lang;
}
export function getCardLang() {
  return defaultLang;
}

export function suitName(s, lang = defaultLang) {
  return (NAMES[lang] || NAMES.en).suitsSingular[s] || '';
}
export function rankName(r, lang = defaultLang) {
  return (NAMES[lang] || NAMES.en).ranks[r] || String(r);
}

/** Full spoken name, e.g. cardName({r:'K',s:'h'},'pt') → 'Rei de copas'. */
export function cardName(card, lang = defaultLang) {
  if (!card) return '';
  const N = NAMES[lang] || NAMES.en;
  if (card.r === 'X') return N.joker[card.s] || N.joker.r;
  if (isUno(card)) {
    const n = N.uno;
    const base = /^\d$/.test(card.r) ? card.r : n[card.r];
    if (card.s === 'W') return base;
    return lang === 'en' ? `${n[card.s][0].toUpperCase()}${n[card.s].slice(1)} ${base}` : `${base} ${n[card.s]}`;
  }
  return N.ranks[card.r] + N.of + N.suits[card.s];
}

export const isJoker = (c) => !!c && c.r === 'X';
export const isUno = (c) => !!c && (c.s === 'W' || UNO_COLORS.includes(c.s));
export const isRed = (c) => !!c && (c.r === 'X' ? c.s === 'r' : c.s === 'h' || c.s === 'd');

/** 'As', 'Td', 'Xr' */
export const code = (c) => c.r + c.s;
export const cardCode = code;

/** Build a card from a code. copy → adds the "-copy" id suffix (double decks). */
export function parseCode(str, copy = null) {
  const r = str[0];
  const s = str[1];
  return { r, s, id: copy === null ? str : `${str}-${copy}` };
}

export const makeCard = (r, s, copy = null) => ({ r, s, id: copy === null ? r + s : `${r}${s}-${copy}` });

/** French 52-card deck. opts.jokers = 0|2 (Xr, Xb). Order: ♠ A..K, ♥, ♦, ♣ (unshuffled). */
export function createDeck52({ jokers = 0, copy = null } = {}) {
  const out = [];
  for (const s of SUITS) for (const r of RANKS_52) out.push(makeCard(r, s, copy));
  if (jokers >= 1) out.push(makeCard('X', 'r', copy));
  if (jokers >= 2) out.push(makeCard('X', 'b', copy));
  return out;
}

/** 40-card Portuguese-game deck (A,2–7,J,Q,K) with French suits — Sueca / Bisca. */
export function createDeck40() {
  const out = [];
  for (const s of SUITS) for (const r of RANKS_40) out.push(makeCard(r, s));
  return out;
}

/** Buraco deck: 2 × 52 + 4 jokers = 108 cards. ids carry -0/-1 copy suffix. */
export function createDoubleDeck() {
  return [...createDeck52({ jokers: 2, copy: 0 }), ...createDeck52({ jokers: 2, copy: 1 })];
}

/** UNO-style 108-card deck (original naming): per colour one 0, two of 1–9, 2 skip, 2 reverse, 2 draw2; 4 wild, 4 wild4. */
export function createUnoDeck() {
  const out = [];
  for (const s of UNO_COLORS) {
    out.push({ r: '0', s, id: `${s}0-0` });
    for (let copy = 0; copy < 2; copy++) {
      for (const r of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']) out.push({ r, s, id: `${s}${r}-${copy}` });
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({ r: 'wild', s: 'W', id: `Wwild-${i}` });
    out.push({ r: 'wild4', s: 'W', id: `Wwild4-${i}` });
  }
  return out;
}

// ---------- ordering ----------

/** Numeric strength of a rank. aceHigh → A=14; custom `order` array (low→high) overrides. */
export function rankValue(r, { aceHigh = true, order = null } = {}) {
  if (r === 'X') return 99;
  if (order) return order.indexOf(r);
  const i = RANKS_52.indexOf(r) + 1; // A=1 … K=13
  return r === 'A' && aceHigh ? 14 : i;
}

const DEFAULT_SUIT_ORDER = ['s', 'h', 'c', 'd']; // alternating colours reads best

/**
 * compare(a,b,{ by:'suit'|'rank', suitOrder, rankOrder, aceHigh, trump, desc })
 *  by 'suit' (default): grouped by suit, then rank.   by 'rank': by rank, then suit.
 *  trump: that suit goes first.   Jokers always last.
 */
export function compareCards(a, b, o = {}) {
  const { by = 'suit', suitOrder = DEFAULT_SUIT_ORDER, rankOrder = null, aceHigh = true, trump = null, desc = false } = o;
  if (isJoker(a) || isJoker(b)) return isJoker(a) === isJoker(b) ? a.s.localeCompare(b.s) : isJoker(a) ? 1 : -1;
  const order = trump ? [trump, ...suitOrder.filter((x) => x !== trump)] : suitOrder;
  const sa = order.indexOf(a.s);
  const sb = order.indexOf(b.s);
  const ra = rankValue(a.r, { aceHigh, order: rankOrder });
  const rb = rankValue(b.r, { aceHigh, order: rankOrder });
  const dir = desc ? -1 : 1;
  if (by === 'rank') return (ra - rb || sa - sb) * dir;
  return sa - sb || (ra - rb) * dir;
}

/** Returns a sorted COPY. */
export function sortCards(cards, o = {}) {
  return cards.slice().sort((a, b) => compareCards(a, b, o));
}

/** Sort for UNO-style cards: by colour then number/action. */
export function sortUno(cards) {
  const ro = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'];
  const co = ['R', 'Y', 'G', 'B', 'W'];
  return cards.slice().sort((a, b) => co.indexOf(a.s) - co.indexOf(b.s) || ro.indexOf(a.r) - ro.indexOf(b.r));
}

/** Deck-aware auto compare: picks the right ordering for French / UNO cards. */
export function sortAuto(cards, o = {}) {
  return cards.length && isUno(cards[0]) ? sortUno(cards) : sortCards(cards, o);
}
