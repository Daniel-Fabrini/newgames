// Quick table ("cash-style") session: 1 hero vs N AI, fixed blinds, chips can be reset at any time.
// Implements the table-screen session contract on top of engine/hand.js + ai/decide.js.
import { createHand, applyAction, legalActions, viewFor } from '../engine/hand.js';
import { mulberry32, mixSeed } from '../engine/rng.js';
import { decide } from '../ai/decide.js';

export function createCashSession({ hero, opps, stack = 2000, sb = 10, bb = 20, seed = 1, handNo = 0, button = 0, stacks = null, stats = null, labels = {} }) {
  const seats = [hero, ...opps];
  const S = {
    seed,
    handNo,
    button,
    stack,
    sb,
    bb,
    stacks: stacks ? stacks.slice() : seats.map(() => stack),
    hand: null,
    stats: stats || {}, // observed opponent tendencies by id
    sessionStart: stack,
    heroRebuys: 0,
    handsPlayed: 0,
    heroWon: 0,
    biggest: 0,
    biggestPot: 0,
  };
  const heroSeat = 0;
  let rng = mulberry32(1);

  function startHand() {
    // AI busts rebuy automatically
    for (let i = 1; i < seats.length; i++) if (S.stacks[i] < S.bb) S.stacks[i] = S.stack;
    if (S.stacks[heroSeat] < S.bb) return null; // the UI must offer a rebuy first
    S.handNo++;
    S.button = (S.button + 1) % seats.length;
    const players = seats.map((p, i) => ({ id: p.id, name: p.name, stack: S.stacks[i] }));
    const r = createHand({ players, button: S.button, sb: S.sb, bb: S.bb, ante: 0, seed: mixSeed(S.seed, S.handNo) });
    S.hand = r.state;
    rng = mulberry32(mixSeed(S.seed, S.handNo, 7));
    return { state: r.state, events: r.events, meta: seats.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, frame: p.frame, hero: i === heroSeat })) };
  }
  const afterEvents = (evs) => {
    for (const e of evs) {
      if (e.t === 'action') {
        const id = seats[e.p].id;
        const st = (S.stats[id] = S.stats[id] || { hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0 });
        if (e.type === 'bet' || e.type === 'raise') st.bets++;
        if (e.type === 'call') st.calls++;
      }
      if (e.t === 'hand_end') {
        S.handsPlayed++;
        for (const r of e.results) {
          S.stacks[r.p] = r.stack;
          if (r.p === heroSeat && r.delta > 0) {
            S.heroWon++;
            S.biggest = Math.max(S.biggest, r.delta);
          }
        }
      }
      if (e.t === 'award') S.biggestPot = Math.max(S.biggestPot, e.amount || 0);
    }
    return evs;
  };
  return {
    kind: 'cash',
    S,
    startHand,
    state: () => S.hand,
    legal: () => (S.hand ? legalActions(S.hand) : null),
    actor() {
      if (!S.hand || S.hand.phase !== 'betting') return null;
      return { kind: S.hand.toAct === heroSeat ? 'human' : 'ai', idx: S.hand.toAct };
    },
    act: (a) => afterEvents(applyAction(S.hand, a)),
    aiAct() {
      const idx = S.hand.toAct;
      const view = viewFor(S.hand, idx);
      const prof = seats[idx].profile;
      const a = decide(view, prof, rng, { pressure: {}, stats: S.stats, agent: {}, fast: true });
      return { action: a, events: afterEvents(applyAction(S.hand, a)) };
    },
    hud() {
      const net = S.stacks[heroSeat] - S.sessionStart * (1 + S.heroRebuys);
      return [
        { label: labels.blinds || 'Blinds', value: `${S.sb}/${S.bb}`, gold: true },
        { label: labels.stack || 'Stack', value: S.stacks[heroSeat].toLocaleString('en-US').replace(/,/g, ' ') },
        { label: labels.net || 'Net', value: (net >= 0 ? '+' : '') + net.toLocaleString('en-US').replace(/,/g, ' ') },
        { label: labels.hand || 'Hand', value: '#' + S.handNo },
      ];
    },
    strip: () => null,
    heroOut: () => S.stacks[heroSeat] < S.bb,
    isFinished: () => false,
    roundText: () => null,
    bb: () => S.bb,
    rebuy() {
      S.stacks[heroSeat] = S.stack;
      S.heroRebuys++;
    },
    serialize() {
      return { seed: S.seed, handNo: S.handNo, button: S.button, stacks: S.stacks, stats: S.stats, rebuys: S.heroRebuys, won: S.heroWon, biggest: S.biggest, played: S.handsPlayed, sb: S.sb, bb: S.bb, stack: S.stack };
    },
  };
}
