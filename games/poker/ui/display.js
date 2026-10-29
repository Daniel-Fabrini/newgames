// Display model of one hand: advanced event by event so the UI can animate each step
// even though the engine has already moved on (it mutates the hand in place).
// Only information legitimately visible to the viewer is stored (hero hole cards, revealed holes).

import { cardStr } from '../engine/eval.js';

export function createDisplay(startEv, { seatMeta, heroIdx, holes }) {
  // startEv: hand_start event. seatMeta[i] = {id,name,avatar,frame}. holes: hero hole ints (or null)
  const n = startEv.stacks.length;
  const D = {
    n,
    handNo: startEv.handNo,
    button: startEv.button,
    sbIdx: startEv.sbIdx,
    bbIdx: startEv.bbIdx,
    bb: startEv.bb,
    sb: startEv.sb,
    ante: startEv.ante,
    street: 'preflop',
    board: [],
    pot: 0, // collected chips only
    toAct: -1,
    heroIdx,
    dealt: false,
    winners: {}, // idx -> amount
    winCards: null,
    seats: startEv.stacks.map((stack, i) => ({
      i,
      meta: seatMeta[i],
      stack,
      start: stack,
      bet: 0,
      folded: false,
      allIn: false,
      last: null,
      hole: i === heroIdx && holes ? holes.map(cardStr) : null,
      revealed: false,
      handName: null,
      mucked: false,
    })),
  };

  const sumBets = () => D.seats.reduce((s, x) => s + x.bet, 0);

  /** Apply an engine event; returns a descriptor for the UI: { kind, ... } */
  function apply(ev) {
    switch (ev.t) {
      case 'post': {
        const s = D.seats[ev.p];
        s.stack -= ev.amount;
        if (ev.kind === 'ante') {
          D.pot += ev.amount;
          return { kind: 'ante', p: ev.p, amount: ev.amount };
        }
        s.bet += ev.amount;
        if (ev.allIn) s.allIn = true;
        return { kind: 'post', p: ev.p, amount: ev.amount, post: ev.kind };
      }
      case 'deal_hole':
        D.dealt = true;
        return { kind: 'deal' };
      case 'action': {
        const s = D.seats[ev.p];
        D.toAct = -1;
        if (ev.type === 'fold') {
          s.folded = true;
          s.last = { type: 'fold' };
        } else if (ev.type === 'check') {
          s.last = { type: 'check' };
        } else if (ev.type === 'call') {
          s.stack -= ev.amount;
          s.bet += ev.amount;
          if (ev.allIn) s.allIn = true;
          s.last = { type: ev.allIn ? 'allin' : 'call', amount: s.bet };
        } else {
          s.stack -= ev.amount;
          s.bet = ev.to;
          if (ev.allIn) s.allIn = true;
          s.last = { type: ev.allIn ? 'allin' : ev.type, amount: s.bet };
        }
        return { kind: 'action', p: ev.p, type: ev.type, amount: ev.amount, to: ev.to, allIn: !!ev.allIn, street: ev.street };
      }
      case 'street': {
        const swept = D.seats.map((s) => s.bet);
        D.pot += sumBets();
        for (const s of D.seats) {
          s.bet = 0;
          s.last = null;
        }
        D.street = ev.street;
        D.board = ev.board.map(cardStr);
        return { kind: 'street', street: ev.street, cards: ev.cards.map(cardStr), swept };
      }
      case 'uncalled': {
        const s = D.seats[ev.p];
        s.stack += ev.amount;
        s.bet = Math.max(0, s.bet - ev.amount);
        return { kind: 'uncalled', p: ev.p, amount: ev.amount };
      }
      case 'showdown': {
        const swept = D.seats.map((s) => s.bet);
        D.pot += sumBets();
        for (const s of D.seats) {
          s.bet = 0;
          s.last = s.folded ? s.last : null;
        }
        D.street = 'showdown';
        for (const r of ev.reveals) {
          const s = D.seats[r.p];
          if (r.mucked || !r.hole) {
            s.mucked = true;
            continue;
          }
          s.hole = r.hole.map(cardStr);
          s.revealed = true;
          s.handKey = r.hand;
        }
        return { kind: 'showdown', order: ev.order, reveals: ev.reveals, swept };
      }
      case 'award': {
        // when the hand ends uncontested the pending bets are swept to the winner
        let swept = null;
        if (ev.uncontested) {
          swept = D.seats.map((s) => s.bet);
          D.pot += sumBets();
          for (const s of D.seats) {
            s.bet = 0;
            if (!s.folded) s.last = null;
          }
        }
        for (const w of ev.winners) {
          D.seats[w.p].stack += w.amount;
          D.winners[w.p] = (D.winners[w.p] || 0) + w.amount;
        }
        D.pot = Math.max(0, D.pot - ev.winners.reduce((s, w) => s + w.amount, 0));
        return { kind: 'award', winners: ev.winners, hand: ev.hand || null, uncontested: !!ev.uncontested, swept, pot: ev.pot };
      }
      case 'hand_end': {
        for (const r of ev.results) {
          const s = D.seats[r.p];
          s.stack = r.stack;
          s.busted = r.busted;
        }
        D.pot = 0;
        D.toAct = -1;
        return { kind: 'end', results: ev.results };
      }
      default:
        return { kind: ev.t || 'other', ev };
    }
  }

  /** Snapshot for ui/table.js. */
  function snapshot({ pots = null, handLabel = null, hideHeroHand = true } = {}) {
    return {
      handId: D.handNo,
      dealt: D.dealt,
      street: D.street,
      board: D.board.slice(),
      pot: D.pot,
      pots: pots || [],
      winCards: D.winCards,
      seats: D.seats.map((s, i) => {
        const m = s.meta || {};
        const status = s.busted && s.stack === 0 ? 'active' : s.folded ? 'folded' : s.allIn ? 'allin' : 'active';
        return {
          id: m.id || 's' + i,
          name: m.name || '',
          avatar: m.avatar || 'p1',
          frame: m.frame || '',
          hero: i === D.heroIdx,
          stack: s.stack,
          bet: s.bet,
          status,
          hole: s.hole,
          revealed: s.revealed || (i === D.heroIdx && D.street === 'showdown' && !s.folded && !s.mucked),
          dealer: i === D.button,
          blind: i === D.sbIdx ? (D.n === 2 ? 'SB' : 'SB') : i === D.bbIdx ? 'BB' : null,
          toAct: D.toAct === i,
          last: s.last,
          win: D.winners[i] || 0,
          handName: s.handName || null,
          bounty: m.bounty || 0,
          hasCards: D.dealt,
        };
      }),
    };
  }

  return { D, apply, snapshot };
}
