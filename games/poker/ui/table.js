// Poker table view: oval felt for portrait phones, seats on an arc, hero at the bottom.
// Pure view: render(snapshot) draws; fx helpers animate. No game logic lives here.
//
// Snapshot shape (built by ui/bridge.js from the engine state):
// {
//   seats: [ null | { id, name, avatar, frame, stack, bet, status: 'active'|'folded'|'allin'|'out',
//                     hero?: bool, hole?: ['As','Kd']|null, revealed?: bool, dealer?: bool,
//                     blind?: 'SB'|'BB'|null, toAct?: bool, last?: { type, amount }|null,
//                     bounty?: number, tag?: string, win?: number, handName?: string } ],
//   board: ['Ah','Kd',...], pot: number, pots: [{ amount, label? }],
//   street: 'preflop'|'flop'|'turn'|'river'|'showdown'|'idle', heroHand?: string, dealt?: bool
// }

import { avatarEl } from './avatars.js';
import { faceEl, backEl, flipEl, parse, cardLabel } from './cards.js';

// angle table (degrees clockwise from the hero, who sits at 0 = bottom centre)
const ARC = {
  2: [180],
  3: [125, 235],
  4: [100, 180, 260],
  5: [80, 140, 220, 280],
  6: [62, 112, 180, 248, 298],
  7: [55, 100, 150, 210, 260, 305],
  8: [50, 90, 130, 180, 230, 270, 310],
  9: [50, 87, 124, 161, 199, 236, 273, 310],
  10: [46, 78, 110, 142, 180, 218, 250, 282, 314],
};

export function seatPos(slot, n) {
  // slot 0 = hero
  if (slot === 0) return { x: 50, y: 95 };
  const arc = ARC[Math.min(10, Math.max(2, n))];
  const a = (arc[slot - 1] * Math.PI) / 180;
  let x = 50 - 44 * Math.sin(a);
  let y = 47 + 40 * Math.cos(a);
  x = Math.max(14, Math.min(86, x));
  y = Math.max(8, Math.min(86, y));
  return { x, y };
}

export function fmt(n, full = false) {
  n = Math.round(n || 0);
  if (full || n < 10000) return n.toLocaleString('en-US').replace(/,/g, ' ');
  if (n < 1e6) return (n / 1000).toFixed(n < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + 'M';
}

function chipStack(amount, cls = '') {
  // 1–4 stacked discs depending on the size of the bet
  const n = amount <= 0 ? 0 : Math.min(5, 1 + Math.floor(Math.log10(Math.max(1, amount)) * 0.9));
  const wrap = document.createElement('span');
  wrap.className = `pk-chips ${cls}`;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.style.setProperty('--k', i);
    d.className = 'c' + ((i + Math.floor(Math.log10(amount + 1))) % 4);
    wrap.append(d);
  }
  return wrap;
}
export { chipStack };

export function createTable(host, { t, lang, reduce = () => false }) {
  const el = document.createElement('div');
  el.className = 'pk-table';
  el.innerHTML = `
    <div class="pk-felt"><div class="pk-felt-in"></div></div>
    <div class="pk-pot-area">
      <div class="pk-pot" aria-live="off"><span class="pk-pot-chips"></span><span class="pk-pot-lbl"></span><b class="pk-pot-amt">0</b></div>
      <div class="pk-sidepots"></div>
    </div>
    <div class="pk-board" role="group"></div>
    <div class="pk-layer-bets"></div>
    <div class="pk-layer-seats"></div>
    <div class="pk-hero-area">
      <div class="pk-hero-cards"></div>
      <div class="pk-hero-hand" hidden></div>
    </div>
    <div class="pk-fx"></div>`;
  host.append(el);
  const q = (s) => el.querySelector(s);
  const potLbl = q('.pk-pot-lbl');
  const potAmt = q('.pk-pot-amt');
  const potChips = q('.pk-pot-chips');
  const sideEl = q('.pk-sidepots');
  const boardEl = q('.pk-board');
  const betsEl = q('.pk-layer-bets');
  const seatsEl = q('.pk-layer-seats');
  const heroCards = q('.pk-hero-cards');
  const heroHandEl = q('.pk-hero-hand');
  const fx = q('.pk-fx');
  potLbl.textContent = t('pot');

  let seatNodes = []; // by seat index
  let prev = null;
  let layoutKey = '';
  let slotOf = []; // seat index → slot (0 = hero)
  let heroIdx = -1;
  const boardNodes = [];
  let heroKey = '';
  let timers = [];
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  };

  function pctStyle(node, p) {
    node.style.left = p.x + '%';
    node.style.top = p.y + '%';
  }

  function buildLayout(snap) {
    layoutKey = snap.seats.map((s) => (s ? s.id : '-')).join('|');
    seatsEl.textContent = '';
    betsEl.textContent = '';
    seatNodes = [];
    heroIdx = snap.seats.findIndex((s) => s && s.hero);
    const n = snap.seats.length;
    // clockwise order starting at hero (or seat 0 when spectating w/o hero)
    const start = heroIdx >= 0 ? heroIdx : 0;
    slotOf = [];
    for (let k = 0; k < n; k++) slotOf[(start + k) % n] = k;
    snap.seats.forEach((s, i) => {
      const slot = slotOf[i];
      const pos = seatPos(slot, n);
      const isHero = i === heroIdx;
      const seat = document.createElement('div');
      seat.className = 'pk-seat' + (isHero ? ' hero' : '') + (s ? '' : ' empty');
      seat.dataset.i = i;
      pctStyle(seat, pos);
      if (s) {
        const av = avatarEl(s.avatar, { size: isHero ? 50 : 42, frame: s.frame });
        const info = document.createElement('div');
        info.className = 'pk-seat-info';
        info.innerHTML = '<span class="pk-nm"></span><b class="pk-stk"></b>';
        const cards = document.createElement('div');
        cards.className = 'pk-seat-cards';
        const lab = document.createElement('div');
        lab.className = 'pk-act';
        const tag = document.createElement('div');
        tag.className = 'pk-tags';
        const ring = document.createElement('span');
        ring.className = 'pk-ring';
        const avw = document.createElement('div');
        avw.className = 'pk-av-wrap';
        avw.append(ring, av);
        seat.append(cards, avw, info, lab, tag);
      }
      seatsEl.append(seat);
      // bet marker toward the table centre
      const bp = {
        x: isHero ? 50 : pos.x + (50 - pos.x) * 0.5,
        y: isHero ? 66 : pos.y + (47 - pos.y) * 0.46 + (pos.y > 47 ? 1 : 0),
      };
      const bet = document.createElement('div');
      bet.className = 'pk-bet';
      bet.dataset.i = i;
      pctStyle(bet, bp);
      betsEl.append(bet);
      seatNodes[i] = { seat, bet, pos, bp, s: null, slot };
    });
    prev = null;
  }

  function seatCenter(i) {
    const r = el.getBoundingClientRect();
    const sn = seatNodes[i];
    return { x: (sn.pos.x / 100) * r.width, y: (sn.pos.y / 100) * r.height };
  }
  function betCenter(i) {
    const r = el.getBoundingClientRect();
    const sn = seatNodes[i];
    return { x: (sn.bp.x / 100) * r.width, y: (sn.bp.y / 100) * r.height };
  }
  function potCenter() {
    const r = el.getBoundingClientRect();
    const p = q('.pk-pot').getBoundingClientRect();
    return { x: p.left - r.left + p.width / 2, y: p.top - r.top + p.height / 2 };
  }

  function ghostChips(from, to, amount, { dur = 480, delay = 0, cls = '' } = {}) {
    if (reduce()) return;
    const g = document.createElement('div');
    g.className = 'pk-ghost ' + cls;
    g.append(chipStack(amount));
    g.style.left = from.x + 'px';
    g.style.top = from.y + 'px';
    fx.append(g);
    g.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.9)`, opacity: 1, offset: 0.85 },
        { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.7)`, opacity: 0 },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' },
    ).onfinish = () => g.remove();
  }

  function floatText(at, text, cls = '') {
    const f = document.createElement('div');
    f.className = 'pk-float ' + cls;
    f.textContent = text;
    f.style.left = at.x + 'px';
    f.style.top = at.y + 'px';
    fx.append(f);
    if (reduce()) {
      later(() => f.remove(), 1400);
      return;
    }
    f.animate(
      [
        { transform: 'translate(-50%,0)', opacity: 0 },
        { transform: 'translate(-50%,-14px)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-34px)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-46px)', opacity: 0 },
      ],
      { duration: 1500, easing: 'ease-out', fill: 'both' },
    ).onfinish = () => f.remove();
  }

  function actLabel(last) {
    if (!last) return '';
    const base = t('act.' + last.type);
    return last.amount && last.type !== 'fold' && last.type !== 'check' ? `${base} ${fmt(last.amount)}` : base;
  }

  function renderSeat(i, s, snap) {
    const sn = seatNodes[i];
    if (!sn || !s) return;
    const seat = sn.seat;
    const was = sn.s;
    seat.classList.toggle('folded', s.status === 'folded');
    seat.classList.toggle('out', s.status === 'out');
    seat.classList.toggle('allin', s.status === 'allin');
    seat.classList.toggle('turn', !!s.toAct);
    seat.classList.toggle('win', !!s.win);
    seat.querySelector('.pk-nm').textContent = s.name;
    const stk = seat.querySelector('.pk-stk');
    stk.textContent = s.status === 'out' ? t('out') : s.status === 'allin' && !s.stack ? t('act.allin') : fmt(s.stack);
    // hole cards of the opponent (backs / revealed faces)
    const cardsEl = seat.querySelector('.pk-seat-cards');
    if (!s.hero) {
      const live = s.status !== 'folded' && s.status !== 'out' && (s.hasCards !== false);
      const key = (live ? 'L' : 'D') + (s.revealed && s.hole ? s.hole.join('') : '');
      if (cardsEl.dataset.k !== key) {
        cardsEl.dataset.k = key;
        cardsEl.textContent = '';
        if (live) {
          for (let k = 0; k < 2; k++) {
            if (s.revealed && s.hole && s.hole[k]) {
              const f = flipEl(s.hole[k], { cls: 'mini', faceUp: false });
              cardsEl.append(f);
              requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('up')));
            } else cardsEl.append(backEl('mini'));
          }
        }
      }
    }
    // action label
    const lab = seat.querySelector('.pk-act');
    const txt = s.win ? `+${fmt(s.win)}` : actLabel(s.last);
    const cls = s.win ? 'win' : s.last ? 'a-' + s.last.type : '';
    if (lab.dataset.k !== txt + cls) {
      lab.dataset.k = txt + cls;
      lab.textContent = txt;
      lab.className = 'pk-act ' + cls + (txt ? ' on' : '');
      if (txt && !reduce()) lab.animate([{ transform: 'translate(-50%,6px) scale(.8)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
    // tags: dealer / blinds / handName
    const tags = seat.querySelector('.pk-tags');
    const tkey = [s.dealer ? 'D' : '', s.blind || '', s.handName && s.revealed ? s.handName : '', s.bounty ? 'B' : ''].join('|');
    if (tags.dataset.k !== tkey) {
      tags.dataset.k = tkey;
      tags.textContent = '';
      if (s.dealer) tags.append(Object.assign(document.createElement('span'), { className: 'pk-btn-d', textContent: 'D', title: t('dealer') }));
      if (s.blind) tags.append(Object.assign(document.createElement('span'), { className: 'pk-blind ' + s.blind, textContent: s.blind }));
      if (s.handName && s.revealed) tags.append(Object.assign(document.createElement('span'), { className: 'pk-handname', textContent: s.handName }));
    }
    // bets
    const bet = sn.bet;
    const amt = s.bet || 0;
    if (bet.dataset.k !== String(amt)) {
      const before = Number(bet.dataset.k || 0);
      bet.dataset.k = amt;
      bet.textContent = '';
      if (amt > 0) {
        bet.append(chipStack(amt), Object.assign(document.createElement('b'), { textContent: fmt(amt) }));
        bet.classList.add('on');
        if (!reduce() && amt > before) {
          ghostChips(seatCenter(i), betCenter(i), amt - before, { dur: 320 });
          bet.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 260, delay: 200, fill: 'backwards', easing: 'ease-out' });
        }
      } else bet.classList.remove('on');
    }
    if (s.toAct && !(was && was.toAct)) seat.animate?.([{ transform: 'translate(-50%,-50%) scale(1.06)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 260, easing: 'ease-out' });
    sn.s = s;
  }

  function renderHero(s, snap) {
    if (!s) {
      heroCards.textContent = '';
      heroKey = '';
      return;
    }
    const hole = s.hole && s.hole.length ? s.hole : null;
    const live = s.status !== 'out' && snap.dealt !== false && hole;
    const key = (live ? hole.join('') : '') + s.status + (snap.handId || '');
    if (key !== heroKey) {
      const newHand = !heroKey.startsWith(live ? hole.join('') : '~') || !live;
      heroKey = key;
      const dealtNow = live && newHand;
      if (dealtNow || !live) heroCards.textContent = '';
      if (live && !heroCards.children.length) {
        hole.forEach((c, k) => {
          const f = faceEl(c, { cls: 'hero' });
          f.dataset.k = k;
          f.setAttribute('role', 'img');
          f.setAttribute('aria-label', cardLabel(c, lang));
          if (!reduce()) f.animate([{ transform: `translate(${k ? -60 : 60}px,-90px) rotate(${k ? 20 : -20}deg) scale(.6)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: 80 + k * 140, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
          heroCards.append(f);
        });
      }
    }
    heroCards.classList.toggle('folded', s.status === 'folded');
  }

  function renderBoard(board, snap) {
    const n = board.length;
    while (boardNodes.length < 5) {
      const slot = document.createElement('div');
      slot.className = 'pk-slot';
      boardEl.append(slot);
      boardNodes.push({ slot, code: null });
    }
    const win = snap.winCards ? new Set(snap.winCards) : null;
    for (let i = 0; i < 5; i++) {
      const bn = boardNodes[i];
      const c = board[i] || null;
      if (bn.code !== c) {
        bn.slot.textContent = '';
        bn.code = c;
        if (c) {
          const f = faceEl(c, { cls: 'board' });
          f.setAttribute('role', 'img');
          f.setAttribute('aria-label', cardLabel(c, lang));
          bn.slot.append(f);
          if (!reduce()) {
            const idx = i < 3 ? i : 0;
            f.animate([{ transform: 'translateY(-30px) rotateY(90deg) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, delay: idx * 130, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
          }
        }
      }
      const f = bn.slot.firstChild;
      if (f) {
        f.classList.toggle('dim', !!win && !win.has(c));
        f.classList.toggle('hl', !!win && win.has(c));
      }
    }
    boardEl.classList.toggle('empty', n === 0);
  }

  function render(snap) {
    const key = snap.seats.map((s) => (s ? s.id : '-')).join('|');
    if (key !== layoutKey) buildLayout(snap);
    snap.seats.forEach((s, i) => renderSeat(i, s, snap));
    // hero status in seat for non-hero visuals
    renderHero(heroIdx >= 0 ? snap.seats[heroIdx] : null, snap);
    renderBoard(snap.board || [], snap);
    potAmt.textContent = fmt(snap.pot, true);
    potChips.textContent = '';
    if (snap.pot > 0) potChips.append(chipStack(snap.pot));
    el.querySelector('.pk-pot').classList.toggle('on', snap.pot > 0);
    sideEl.textContent = '';
    if (snap.pots && snap.pots.length > 1) {
      snap.pots.forEach((p, k) => {
        sideEl.append(Object.assign(document.createElement('span'), { className: 'pk-sp', textContent: `${k === 0 ? t('mainPot') : t('sidePot') + ' ' + k} ${fmt(p.amount)}` }));
      });
    }
    heroHandEl.hidden = !snap.heroHand;
    heroHandEl.textContent = snap.heroHand || '';
    el.dataset.street = snap.street || '';
    prev = snap;
  }

  // sweep all bets into the pot (end of a betting round)
  function sweepBets(snap) {
    if (!snap) return;
    const pc = potCenter();
    snap.seats.forEach((s, i) => {
      if (s && s.bet > 0 && seatNodes[i]) ghostChips(betCenter(i), pc, s.bet, { dur: 420 });
    });
  }
  function awardTo(i, amount) {
    if (!seatNodes[i]) return;
    const pc = potCenter();
    ghostChips(pc, seatCenter(i), amount, { dur: 700 });
    later(() => floatText(seatCenter(i), `+${fmt(amount)}`, 'win'), 520);
  }
  function banner(text, cls = '') {
    const b = document.createElement('div');
    b.className = 'pk-banner ' + cls;
    b.textContent = text;
    el.append(b);
    later(() => b.remove(), 1700);
  }
  function destroy() {
    timers.forEach(clearTimeout);
    timers = [];
    el.remove();
  }
  return { el, render, sweepBets, awardTo, floatText, banner, ghostChips, seatCenter, betCenter, potCenter, destroy, get heroIdx() { return heroIdx; } };
}
