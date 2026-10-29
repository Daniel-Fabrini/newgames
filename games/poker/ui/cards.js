// Card faces/backs for the poker table (DOM + CSS, scales with --cw).
// Accepts a card as a code ('As', 'Td') or {r,s}.

export const SUIT_SYM = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_TXT = { T: '10' };
const FACE = { J: 'J', Q: 'Q', K: 'K', A: 'A' };

export function parse(c) {
  if (!c) return null;
  if (typeof c === 'string') return { r: c[0], s: c[1] };
  return { r: c.r, s: c.s };
}
export const codeOf = (c) => {
  const p = parse(c);
  return p ? p.r + p.s : '';
};

const NAMES = {
  pt: { A: 'Ás', 2: 'Dois', 3: 'Três', 4: 'Quatro', 5: 'Cinco', 6: 'Seis', 7: 'Sete', 8: 'Oito', 9: 'Nove', T: 'Dez', J: 'Valete', Q: 'Dama', K: 'Rei', of: ' de ', s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' },
  en: { A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', of: ' of ', s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' },
  es: { A: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis', 7: 'Siete', 8: 'Ocho', 9: 'Nueve', T: 'Diez', J: 'Sota', Q: 'Reina', K: 'Rey', of: ' de ', s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' },
};
export function cardLabel(c, lang = 'en') {
  const p = parse(c);
  if (!p) return '';
  const N = NAMES[lang] || NAMES.en;
  return N[p.r] + N.of + N[p.s];
}

/** Face-up card element. */
export function faceEl(c, { cls = '', small = false } = {}) {
  const p = parse(c);
  const el = document.createElement('div');
  el.className = `pk-card face s-${p.s} ${cls}`;
  el.dataset.code = p.r + p.s;
  const rank = RANK_TXT[p.r] || p.r;
  const isFace = p.r === 'J' || p.r === 'Q' || p.r === 'K';
  el.innerHTML =
    `<span class="pk-ci pk-ci-tl"><b>${rank}</b><i>${SUIT_SYM[p.s]}</i></span>` +
    (small
      ? ''
      : `<span class="pk-ci pk-ci-br"><b>${rank}</b><i>${SUIT_SYM[p.s]}</i></span>`) +
    `<span class="pk-cmid ${isFace ? 'is-face' : ''}">${isFace ? `<em>${FACE[p.r]}</em>` : ''}<i>${SUIT_SYM[p.s]}</i></span>`;
  return el;
}

/** Back element. */
export function backEl(cls = '') {
  const el = document.createElement('div');
  el.className = `pk-card back ${cls}`;
  el.innerHTML = '<span class="pk-back-in"></span>';
  return el;
}

/** Flip container: back on one face, front on the other (animated with CSS). */
export function flipEl(c, { cls = '', faceUp = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `pk-flip ${faceUp ? 'up' : ''} ${cls}`;
  const inner = document.createElement('div');
  inner.className = 'pk-flip-in';
  if (c) inner.append(faceEl(c), backEl());
  else inner.append(backEl());
  wrap.append(inner);
  return wrap;
}

export const BACKS = ['royal', 'ruby', 'emerald', 'onyx', 'sand', 'violet'];
export const DECK_STYLES = ['classic', 'fourcolor'];
