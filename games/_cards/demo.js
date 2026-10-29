import { createDeck52, createDoubleDeck, createUnoDeck, createDeck40, sortCards, setCardLang } from './decks.js';
import { createRng, shuffle } from './rng.js';
import { cardEl, unoCardEl } from './card.js';
import { BACKS } from './backs.js';
import { createHand, createOpponentHand, sortButton } from './hand.js';
import { createAnimator } from './anim.js';
import * as T from './table.js';
import { createCardSfx } from './sfx.js';

const lang = new URLSearchParams(location.search).get('lang') || 'pt';
setCardLang(lang);
const app = document.getElementById('app');
const anim = createAnimator();
const rng = createRng(7);
const sfx = { tone() {}, noise() {}, vibrate() {} };
const cs = createCardSfx({ sfx });
const sec = (title, ...els) => { const d = document.createElement('div'); d.className = 'sec'; d.innerHTML = `<h3>${title}</h3>`; d.append(...els); app.append(d); return d; };
const row = (els, cls = 'row') => { const r = document.createElement('div'); r.className = cls; r.append(...els); return r; };
const deck = createDeck52({ jokers: 2 });

sec('Faces 96px', row(deck.filter(c => ['A','K','Q','J','T','7'].includes(c.r) && c.s !== 'c').map(c => cardEl(c, { size: 96 }))));
sec('Faces 56px — all 54', row(deck.map(c => cardEl(c, { size: 56 }))));
sec('4-colour + large index 72px', row(deck.slice(0, 26).map(c => cardEl(c, { size: 72, deck: 'fourcolor-large' }))));
sec('Backs', row(BACKS.map(b => cardEl(null, { size: 80, back: b.id }))));
sec('UNO-style', row(createUnoDeck().filter((c, i) => i % 3 === 0).slice(0, 36).map(c => unoCardEl(c, { size: 64 }))));

// hands
const handBox = (n, size, opts = {}) => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:360px;max-width:calc(100vw - 24px);background:#15603f;border-radius:12px;padding:10px 0 6px';
  const cards = shuffle(createDeck52(), rng).slice(0, n);
  const hand = createHand(wrap, { cards, size, select: 'multi', ...opts });
  return { wrap, hand };
};
const h7 = handBox(7, 64, { select: 'single', isPlayable: (c) => c.s !== 'c' });
const h11 = handBox(11, 56);
const h27 = handBox(27, 52, { maxRows: 1 });
const h27b = handBox(27, 52, { maxRows: 2 });
const hd = handBox(9, 60, { draggable: true, dragToPlay: true, onActivate: (c) => console.log('play', c.id) });
sec('Hand 7 (single select, clubs disabled)', h7.wrap, sortButton(h7.hand, { label: 'Sort' }));
sec('Hand 11 (multi)', h11.wrap);
sec('Hand 27 one row', h27.wrap);
sec('Hand 27 two rows', h27b.wrap);
sec('Hand 9 draggable', hd.wrap);

// opponents
const opp = document.createElement('div'); opp.style.cssText = 'display:flex;gap:30px;align-items:center;padding:20px;background:#17336b;border-radius:12px;max-width:100%;box-sizing:border-box';
const o1 = createOpponentHand(opp, { count: 7, size: 'xs', orientation: 'top', maxSpan: 150 });
const o2 = createOpponentHand(opp, { count: 10, size: 'xs', orientation: 'left', maxSpan: 160 });
const o3 = createOpponentHand(opp, { count: 5, size: 'xs', orientation: 'right', maxSpan: 160 });
sec('Opponent hands (top/left/right)', opp);

// tables
const tables = document.createElement('div'); tables.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px';
const mk = (surface, rim, shape, n, w = 340, h = 440) => {
  const box = document.createElement('div'); box.style.cssText = `width:${w}px;max-width:100%;height:${h}px;position:relative;background:#0e0f13;border-radius:14px;overflow:hidden;padding:0`;
  const t = T.createTable(box, { surface, rim, shape, seats: n });
  t.layout.forEach((p, i) => {
    t.seatEls[i].append(T.playerChip({ name: ['You','Ana','Rui','Eva','Leo','Zoe','Max','Ivo','Lia'][i], avatar: i * 2, stack: 1000 - i * 50, active: i === 1, role: i === 0 ? 'D' : '', color: i % 2 ? '#2f7fd4' : '#d94f5c', size: 'sm' }));
  });
  const d = T.deckPile({ count: 30, size: 40 }); const dis = T.discardPile({ size: 40 }); dis.setCards(createDeck52().slice(3, 7));
  t.center.append(d, dis);
  tables.append(box);
  return t;
};
mk('felt', 'wood', 'oval', 4); mk('midnight', 'charcoal', 'oval', 6); mk('burgundy', 'gold', 'rect', 5); mk('charcoal', 'none', 'oval', 9);
mk('felt', 'wood', 'oval', 2, 440, 320); mk('felt', 'wood', 'oval', 3); mk('midnight', 'wood', 'oval', 8, 440, 320);
sec('Tables', tables);

// HUD
const av = row(Array.from({ length: 16 }, (_, i) => T.avatarEl(i, 48)));
sec('Avatars', av);
sec('Chips', row([1, 5, 10, 25, 50, 100, 500, 1000].map(d => T.chipEl({ denom: d, size: 40 }))), row([T.chipStack({ amount: 1385, size: 30 }), T.potDisplay({ amount: 1385 })]));
const sp = T.scorePanel({ title: 'Score', rows: [{ id: 'a', label: 'Nós', value: 54, team: '#2f7fd4', lead: true }, { id: 'b', label: 'Eles', value: 31, team: '#d94f5c' }], collapsible: true });
const lg = T.historyLog({ collapsed: false }); lg.add('Round 1', { round: true }); lg.add('Ana joga Rei de copas'); lg.add('Você ganha a vaza', { tone: 'good' });
const felt = document.createElement('div'); felt.style.cssText = 'position:relative;height:260px;width:340px;background:#15603f;border-radius:12px;padding:10px;overflow:hidden';
const tr = T.trickArea({ seats: T.seatLayout(4), size: 52 }); tr.el.style.cssText += ';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)';
[0, 1, 2, 3].forEach((s) => tr.place(s, createDeck52()[s * 5 + 3]));
felt.append(tr.el);
const bar = T.actionBar([{ id: 'a', label: 'Jogar', kind: 'primary' }, { id: 'b', label: 'Passar', kind: 'secondary', disabled: true, reason: 'Não é sua vez' }, { id: 'c', label: 'Desistir', kind: 'danger' }]);
sec('Panels / trick / actions', row([sp, lg]), felt, bar, T.turnIndicator('Sua vez', { mine: true }));
const btns = document.createElement('div'); btns.className = 'row';
const b = (label, fn) => { const x = document.createElement('button'); x.className = 'dc-btn'; x.textContent = label; x.onclick = fn; btns.append(x); };
b('Rules', () => T.rulesModal({ title: 'Regras', sections: [{ title: 'Objetivo', text: 'Ganhe vazas.' }, { title: 'Pontos', items: ['Ás 11', 'Sete 10', 'Rei 4']}, { title: 'x', text: 'lorem '.repeat(120) }] }));
b('Win', () => T.resultModal({ outcome: 'win', subtitle: 'Parabéns!', stats: [{ label: 'Pontos', value: 120 }, { label: 'Vazas', value: 7 }], actions: [{ label: 'Menu', value: 'm' }, { label: 'Jogar de novo', value: 'again', primary: true }] }));
b('Lose', () => T.resultModal({ outcome: 'lose', stats: [{ label: 'Pontos', value: 40 }] }));
b('Banner', () => T.banner(document.body, 'Truco!', { sub: 'Ana pede 3' }));
b('Deal', async () => { cs.deal(); const slots = [...h7.wrap.querySelectorAll('.dc')]; const src = h7.wrap.getBoundingClientRect(); await anim.deal({ left: src.left + 150, top: src.top - 100, width: 40, height: 56 }, slots.map(el => ({ el }))); });
b('Collect', () => anim.collect([...h7.wrap.querySelectorAll('.dc')], { left: 20, top: 20, width: 40, height: 56 }));
b('Flip', () => anim.flip(h7.wrap.querySelector('.dc')));
b('Shake', () => anim.shake(h7.wrap.querySelector('.dc')));
b('Chips', () => anim.chipToss(btns, { left: 200, top: 100, width: 10, height: 10 }, { count: 5 }));
sec('Actions', btns);
window.__demo = { h7, anim };
document.body.dataset.ready = '1';
