# games/poker — engine / AI / tournament / career API (C1)

All modules are plain ES modules, headless (node 22), no DOM. State is JSON-serialisable. Cards are ints 0..51
(`rank = c>>2` 0=deuce..12=ace, `suit = c&3` clubs,diamonds,hearts,spades); `-1` = hidden card in `publicView`.
Localised data text is always an object `{pt,en,es}` (use `tx(obj, lang)` from `career/text.js`).

## engine/
- `engine/eval.js`: `evaluate(cards[5..7]) -> score` (higher wins), `describe(score) -> {cat,key,ranks}` (`key` in
  royal_flush straight_flush quads full_house flush straight trips two_pair pair high_card), `bestFive(cards)`, `cardStr(c)` ('As'), `parseCard('As')`, `parseCards('As Kd')`, `rankOf`, `suitOf`.
- `engine/rng.js`: `mulberry32(seed)`, `mixSeed(...ints)`, `randomSeed()` (crypto), `shuffle(arr,rng)`.
- `engine/hand.js` (one hand, NL Hold'em):
  - `createHand({players:[{id,stack}], button, sb, bb, ante, seed|rng, handNo}) -> {state, events}`
  - `legalActions(state) -> null | {idx,toCall,canFold,canCheck,canCall,callAmount,canRaise,isBet,minRaiseTo,maxRaiseTo,allInTo,canAllIn,pot,stack,bet}`
    (`raise`/`bet` take `to` = total bet for the street; `minRaiseTo`..`maxRaiseTo`; all-in short of min is legal only as `allin`.)
  - `applyAction(state, {type:'fold'|'check'|'call'|'bet'|'raise'|'allin', to?}) -> events[]` (throws on illegal; `validateAction(state,a)` -> null|error string)
  - `state`: `{players:[{i,id,stack,startStack,bet,committed,folded,allIn,hole,last,showed}], board, street('preflop'|'flop'|'turn'|'river'), button, sbIdx, bbIdx, sb,bb,ante, currentBet, lastRaise, toAct(-1 when done), phase('betting'|'done'), result, log}`
  - events: `hand_start, deal_hole, post{p,kind:'ante'|'sb'|'bb',amount}, action{p,type,amount,to,allIn,street}, street{street,cards,board,pot}, uncalled{p,amount}, showdown{order,reveals:[{p,hole|null,score,hand,mucked}]}, award{pot,amount,winners:[{p,amount}],hand}, hand_end{results}`
  - `state.result = {showdown, pots:[{amount,eligible,winners,shares}], uncalled, reveals, results:[{p,id,delta,stack,busted}], total}`
  - `potInfo(state)` live pot + side pots; `totalPot`; `buildPots`; `publicView(state, viewerIdx)` hides deck and unrevealed holes; `viewFor(state, idx)` = the AI's information set.
  - Rules: button moves to next occupied seat, blinds = next two occupied seats (no dead blinds); heads-up button=SB acts first preflop/last postflop; incomplete all-in raise does not reopen betting for players who already acted; odd chips go to first winner left of the button; uncalled bets returned; no burn cards.
## ai/
- `ai/profiles.js`: `PROFILES` (archetype params), `makeProfile(archetype|params)`; params `{tight,aggr,bluff,position,risk,adapt,tiltRes,skill}` (0..1, skill 1..10).
- `ai/decide.js`: `decide(view, profile, rng, ctx) -> action` (always legal). `ctx={pressure:{bubble,finalTable,playersLeft,paid}, stats:{[id]:{hands,vpip,pfr,bets,calls}}, agent:{tilt}, fast:bool}`.
  `equity(hole, board, nOpp, rng, iters, rangeCut)`, `preflopPct(hole)` (0=AA..1=worst).
## tournament/
- `tournament/structures.js`: `blindLevels(kind)`, `payoutLadder(entrants, kind)`, `placePoints(...)`.
- `tournament/tournament.js`: see header comments. Loop for UI:
  1. `t = createTournament(def, {player:{id,name,avatar}, seed, rivals})`
  2. `r = startNextHand(t, {interactive:true})` -> `{events, hand}`; round events (balancing, bust-outs elsewhere, level up) in `r.events`.
  3. while `t.phase==='hand'`: `a = actor(t)` -> `{kind:'human'|'ai', idx}`; human: `act(t, action)`; ai: `aiAct(t)` -> `{action, events}` (UI adds delay).
  4. when hand completes `t.phase` becomes `'between'` (or `'finished'`); `t.lastHand` = summary; go to 2.
  5. `simulateToEnd(t)` fast-forwards (player eliminated / skip). `tournamentResult(t)` when finished.
## career/
- `career/career.js`, `career/circuits.js`, `career/rivals.js`, `career/achievements.js`, `career/rewards.js`, `career/store.js` — see headers there (filled in below as they land).
