# Shared card library (`games/_cards/`)

Plain ES modules + one CSS file, vanilla DOM, offline, no deps. All cards are inline SVG (crisp at any size).
Demo / visual QA: `games/_cards/demo.html` (serve the repo root, open `/games/_cards/demo.html`). Tests: `node --test games/_cards/tests/*.test.mjs`.

```js
// in games/<id>/main.js
import { createRng, shuffle, randomSeed } from '../_cards/rng.js';
import { createDeck52, createDeck40, createDoubleDeck, createUnoDeck, sortCards, cardName, setCardLang } from '../_cards/decks.js';
import { cardEl, unoCardEl, anyCardEl, setFaceDown, setCardState } from '../_cards/card.js';
import { createHand, createOpponentHand, sortButton } from '../_cards/hand.js';
import { createAnimator } from '../_cards/anim.js';
import * as T from '../_cards/table.js';           // createTable, deckPile, rulesModal, resultModal, …
import { createCardSfx } from '../_cards/sfx.js';
import { createMatchSave, createStats } from '../_cards/storage.js';

export async function mount(root, ctx) {
  await ctx.loadCSS(new URL('../_cards/cards.css', import.meta.url));
  setCardLang(ctx.lang);                    // names + aria labels (pt/en/es)
  const anim = createAnimator(); const sfx = createCardSfx(ctx);
  …
  return () => { anim.dispose(); hand.destroy(); };   // cleanup
}
```
Class prefixes: `dc-` cards/buttons, `dh-` hand, `doh-` opponent hand, `dt-` table/HUD. Scale every card with CSS var `--cw` (card width; height = 1.4 × width) on any ancestor, or pass `size`.

## rng.js
`createRng(seed?)` → `{ next(), int(n), range(a,b), chance(p), pick(arr), shuffle(arr), state (get/set, uint32, JSON-safe), restore(s), seed, fn, fork() }`.
`shuffle(arr, rng)` → new array (Fisher–Yates; rng = createRng obj, function, or omitted). `shuffleInPlace`, `randomSeed()` (crypto), `seedFrom(string|number)`.
Save `rng.state` in your game state; `createRng(0).restore(saved)` resumes the identical sequence.

## decks.js
Card = `{ r, s, id }`. French: ranks `A 2..9 T J Q K`, suits `s h d c` (♠♥♦♣). Joker `{r:'X', s:'r'|'b'}`. UNO-style: `r` `0-9|skip|reverse|draw2|wild|wild4`, `s` `R Y G B | W`.
Builders: `createDeck52({jokers:0|2})`, `createDeck40()` (A,2–7,J,Q,K), `createDoubleDeck()` (108, ids end `-0/-1`), `createUnoDeck()` (108). Unshuffled — `shuffle(deck, rng)`.
`code(card)`→`'As'`, `parseCode('Td')`, `makeCard(r,s)`, `cardName(card, lang)` → "Rei de copas" / "King of hearts" / "Rey de corazones", `suitName`, `rankName`, `isJoker`, `isUno`, `isRed`, `SUITS`, `SUIT_SYMBOL`, `RANKS_52`, `RANKS_40`.
Sorting: `sortCards(cards, { by:'suit'|'rank', suitOrder, rankOrder:[low…high], aceHigh, trump, desc })` (copy), `compareCards`, `sortUno`, `sortAuto`, `rankValue(r, {aceHigh, order})`.

## card.js
```js
const el = cardEl({ r:'K', s:'h', id:'Kh' }, { size:'md', back:'classic', deck:'fourcolor-large', highlight, disabled, selected, faceDown, lang });
cardEl(null)                 // face-down placeholder (opponent card)
unoCardEl(card, { size })    // UNO-style;  anyCardEl(card) picks the right one
setFaceDown(el, false)       // instant reveal (anim.flip animates);  setCard(el, card, {faceDown})
setCardState(el, { selected, highlight, disabled });  setBack(el, 'deco')
```
Sizes: `'xs'(40) 'sm'(56) 'md'(72) 'lg'(96) 'xl'(128)` or a number; omit to inherit `--cw`. `deck`: `'classic' | 'fourcolor' | 'large' | 'fourcolor-large'` or `{fourColor, largeIndex}` (players' option). `selected` lifts via the CSS `translate` property (does not clash with `transform`).
`el.firstChild` structure: `.dc > .dc-inner > .dc-front + .dc-back`. `el._card` holds the model.

## backs.js
`BACKS` = `[{id,name:{pt,en,es},tier}]` ids: `classic emerald crimson royal mono deco` (+ internal `uno`). `backSvg(id)`.

## hand.js
```js
const hand = createHand(container, { cards, size:'md', mode:'fan'|'line', arc:true, select:'single'|'multi'|'none',
  isPlayable:(c)=>bool,           // false → dimmed + aria-disabled, can't be selected
  canSelect:(c)=>bool, onChange:(selectedCards)=>{}, onActivate:(card, el)=>{}, onDisabledTap:(card)=>{},
  draggable:false /* reorder */, dragToPlay:false /* drag up to activate */, onReorder:(cards)=>{},
  faceDown:false, back, deck, lang, maxRows:1 /* 2 for Buraco */, minStep:0.28 });
```
`select:'single'`: tap selects (lifts), tap again / Enter / double-click / drag-up → `onActivate`. `select:'none'`: tap → `onActivate`. `'multi'`: tap toggles, read `hand.selected()`; `onActivate` on dblclick/Enter.
Methods: `setCards(cards,{animate})`, `getCards()`, `add(card,index)`→el, `remove(id)`→el, `selected()`, `select(id)`, `deselect(id)`, `clearSelection()`, `setPlayable(fn)`, `setFaceDown(bool)`, `sort(opts|fn)`, `cardEl(id)`, `rectOf(id)`, `layout()`, `setSize(size)`, `focus()`, `destroy()`. Auto-fits any count into the container width (no clipping, ResizeObserver); keyboard: ←/→/Home/End move (roving tabindex), Space toggle, Enter select/activate, Esc clear. Pure `computeLayout()` is exported and tested. `sortButton(hand, {label})`.
Opponent: `createOpponentHand(el, { count, size:'xs', orientation:'top'|'bottom'|'left'|'right', maxSpan:px, back })` → `{ el, setCount(n), cardEl(i), rect(), destroy() }` (count badge included).

## anim.js
```js
const anim = createAnimator();          // one per game; dispose() in unmount
await anim.flyCard(el, fromRect|el, toRect|el|null, { duration, delay, arc, fromRotate, toRotate, faceDownFrom, keepHidden })
```
`el` must already be at its final place in the DOM (it is hidden while a ghost clone flies; `toRect` null = el's current rect). `await anim.deal(deckEl|rect, [{ el, delay?, onArrive? }…], { stagger:90 })`, `anim.collect(els, toEl, { remove:true })`, `anim.flip(el, faceDown?)`, `shake`, `pulse`, `bump`, `chipToss(from, to, { count, denom })`, `skip()` (finish all now), `dispose()`, `active`. All promises resolve (never reject, also when skipped/disposed). Honour `prefers-reduced-motion` and `motion.speed` (export; set `motion.speed = 2` for "fast", `0` for instant). `wait(ms)` helper. Overlays are `pointer-events:none` — input is never blocked.

## table.js (+ cards.css)
- `createTable(root, { surface:'felt|midnight|burgundy|charcoal', rim:'wood|charcoal|gold|none', shape:'oval|rect', seats:n, portrait:'auto' })` → `{ el, felt, center, seatEls[], layout, setSurface, setRim, setSeats, seatPoint(i), destroy }`. Put things in `seatEls[i]` (centred on seat i; seat 0 = you, bottom; clockwise) and the pile/trick in `center`.
- `seatLayout(n, { shape, portrait, rx, ry })` → `[{ i, x, y (%), side, orient:'h'|'v', tx, ty }]` for 2–9 seats.
- `deckPile({ count, size, back, label, onClick })` → `.setCount(n)`, `.topEl`; `discardPile({size})` → `.setCards(cards)`; `trickArea({ seats: layout, size })` → `.place(seat, card)`, `.slotRect(seat)`, `.clear()`, `.cards()`.
- `playerChip({ name, avatar:0-15, color, role:'D', stack, score, sub, active, folded, size:'sm|md|lg', layout:'col|row' })` → `.update(patch)`; `avatarEl(id,size)`, `avatarIdForName(name)`, `AVATAR_COUNT=16`.
- HUD: `turnIndicator(text,{mine})`→`.set()`, `scorePanel({title, rows:[{id,label,value,team,sub,lead}], collapsible})`→`.update(rows)`, `historyLog()`→`.add(text,{tone,round})`, `banner(root,text,{sub,tone,ms})`, `toast(root,text)`, `coachmark(anchor,text,{key,store})`, `countUp(el,to)`.
- `actionBar([{id,label,kind:'primary|secondary|danger',disabled,reason,onClick,hidden,icon}])` → `.set(id,patch)`, `.setAll()`; disabled buttons show `reason` in a bubble when tapped. Button class `dc-btn is-primary|is-secondary|is-danger` usable anywhere.
- Modals (append to `root`, Promise of pressed action `value`): `rulesModal({root,title,sections:[{title,text,items}]})` (sticky close), `resultModal({root,outcome:'win|lose|draw',title,subtitle,stats:[{label,value}],actions})` (animated counters + restrained confetti), generic `modal({root,title,body,actions,dismissible})`, `burst(root)`.
- Chips: `chipEl({denom,size})`, `chipStack({amount|chips,size})`, `potDisplay({amount})`→`.set(n)`, `breakdownChips(amount)`.

## sfx.js
`createCardSfx(ctx)` → `deal flip place slide shuffle chipSingle chipStack(n) check fold select error turn win lose special('skip'|'reverse'|'draw') yell(1..3)`; `.enabled`, `.volume`, `.haptics`. Uses `ctx.sfx.tone/noise/vibrate` (app mute honoured).

## storage.js
`createMatchSave(ctx.store, 'match', { version, validate })` → `save(state) load()→state|null clear() exists() savedAt()`.
`createStats(ctx.store, 'stats', { historyMax:20, better })` → `record({result:'win|loss|draw', score?, …})`, `get()` → `{games,wins,losses,draws,best,streak,bestStreak,history:[{t,result,…}]}`, `reset()`.

## Known limits
Card faces use the page font `Nunito` (loaded by the app) with a system fallback. Rotated hand cards use `transform` on `.dh-slot`; don't style `.dh-slot` transforms yourself. `flyCard` assumes the element is not inside a scaled ancestor. Court cards are original, simple stylised designs.
