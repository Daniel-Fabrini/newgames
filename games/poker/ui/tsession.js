// Table-screen session over a tournament (tournament/tournament.js).
import * as T from '../tournament/tournament.js';
import { fmt } from './table.js';

export function createTournamentSession(tour, { heroFrame = '', rivalNames = {}, L = {}, tx = (o) => o } = {}) {
  const t = tour;
  let pendingRound = [];
  const metaFor = (state) =>
    state.players.map((p) => {
      const e = t.entrants.find((x) => x.id === p.id);
      return { id: p.id, name: e ? e.name : p.id, avatar: e ? e.avatar : 'p1', frame: e && e.isPlayer ? heroFrame : e && e.rivalId ? 'gold' : '', hero: p.id === t.playerId, rival: e && e.rivalId ? e.rivalId : null };
    });
  const sess = {
    kind: 'tournament',
    t,
    startHand() {
      if (t.phase === 'finished') return null;
      let events, hand;
      if (t.phase === 'hand' && t.hand) {
        // resume a saved hand: replay its log (the UI plays it back instantly)
        hand = t.hand;
        events = hand.log.filter((e) => e.t !== undefined);
        return { state: hand, events, meta: metaFor(hand), replay: true, roundEvents: [] };
      }
      const r = T.startNextHand(t, { interactive: true, spectate: false });
      if (!r.hand) {
        pendingRound = r.events || [];
        return null;
      }
      return { state: r.hand, events: r.handEvents, meta: metaFor(r.hand), roundEvents: [] };
    },
    state: () => t.hand,
    legal: () => T.legal(t),
    actor: () => {
      const a = T.actor(t);
      return a.kind ? a : null;
    },
    act(action) {
      const ev = T.act(t, action);
      return ev;
    },
    aiAct() {
      const r = T.aiAct(t);
      return { action: r.action, events: r.events };
    },
    /** round events produced when the last hand concluded (busts, level up, table moves…) */
    takeRoundEvents() {
      const e = t.events ? t.events.slice() : [];
      t.events = [];
      return e;
    },
    pendingRound: () => {
      const e = pendingRound;
      pendingRound = [];
      return e;
    },
    heroOut: () => T.human(t).out,
    isFinished: () => t.phase === 'finished',
    bb: () => T.blindsNow(t).bb,
    hud() {
      const s = T.standing(t);
      return [
        { label: L.blinds || 'Blinds', value: `${fmt(s.blinds.sb)}/${fmt(s.blinds.bb)}`, gold: true },
        { label: L.level || 'Level', value: s.level },
        { label: L.players || 'Players', value: String(s.remaining) },
        { label: L.rank || 'Rank', value: s.chipRank ? String(s.chipRank) : '-' },
      ];
    },
    standing: () => T.standing(t),
    strip() {
      const s = T.standing(t);
      const parts = [];
      if (s.bubble) parts.push(L.bubble || 'Bubble');
      else if (s.inMoney && s.entrants > s.paid + 1) parts.push(L.inMoney || 'In the money');
      parts.push((L.next || 'Next {blinds} in {n}').replace('{blinds}', `${fmt(s.nextBlinds.sb)}/${fmt(s.nextBlinds.bb)}`).replace('{n}', s.handsToNextLevel));
      if (s.blinds.ante) parts.push(`${L.ante || 'Ante'} ${fmt(s.blinds.ante)}`);
      parts.push(`${L.avg || 'Avg'} ${fmt(s.avgStack)}`);
      return parts.join(' · ');
    },
    simulate() {
      return T.simulateToEnd(t);
    },
    result: () => T.tournamentResult(t),
    serialize: () => t,
  };
  return sess;
}
