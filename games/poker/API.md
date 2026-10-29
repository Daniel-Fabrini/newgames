# games/poker — headless engine / AI / tournament / career API (C1)

Plain ES modules, no DOM, runs in node 22 and the WebView. Import everything from the barrel `career/index.js`
(or the individual modules). **All state is JSON-serialisable**; every deal / AI decision is derived from seeds, so a
reloaded state continues identically. Run tests: `node --test games/poker/tests/*.test.mjs`.

Conventions
- Cards are ints 0..51: `rank = c>>2` (0=2 … 12=A), `suit = c&3` (0 clubs, 1 diamonds, 2 hearts, 3 spades). `-1` = hidden card in `publicView`.
  `cardStr(c)` -> `'As'`, `parseCard('As')`, `parseCards('As Kd')`.
- Every localisable data text is `{pt,en,es}`; use `tx(obj, lang)` (career/text.js). Rival names are plain proper names.
- Player id in tournaments is `t.playerId` (`'hero'`); hand seats are indexes into `hand.players` (table order, clockwise).
- Chips are integers. Virtual only.

## engine/ (one hand)
- `engine/eval.js`: `evaluate(cards[5..7]) -> score` (bigger wins; ties equal), `describe(score) -> {cat, key, ranks}` with `key` in
  `royal_flush straight_flush quads full_house flush straight trips two_pair pair high_card`; `bestFive(cards)` (for highlighting).
- `engine/rng.js`: `mulberry32(seed)`, `mixSeed(...ints)`, `randomSeed()` (crypto), `shuffle(arr, rng)` (Fisher-Yates).
- `engine/hand.js`:
  - `createHand({players:[{id,stack}], button, sb, bb, ante, seed|rng, handNo}) -> {state, events}` (tournament.js does this for you).
  - `legalActions(state) -> null | {idx, id, toCall, canFold, canCheck, canCall, callAmount, canRaise, isBet, minRaiseTo, maxRaiseTo, allInTo, canAllIn, pot, stack, bet}`
    `bet`/`raise` take `to` = total bet for this street, `minRaiseTo..maxRaiseTo`. `canRaise:false` after an incomplete all-in raise (players who already
    acted may only call/fold). An all-in below the minimum raise is legal only as `{type:'allin'}`. `allin` when `!canRaise` is a call-all-in.
  - `applyAction(state, {type:'fold'|'check'|'call'|'bet'|'raise'|'allin', to?}) -> events[]` (throws on illegal; `validateAction(state, a)` -> `null | 'reason'`).
  - `state`: `{players:[{i,id,stack,startStack,bet,committed,folded,allIn,hole:[c,c],last,showed}], board:[…], street:'preflop'|'flop'|'turn'|'river', button, sbIdx, bbIdx, sb, bb, ante, currentBet, lastRaise, toAct (-1 when over), phase:'betting'|'done', result, log:[events], deck (SECRET, never display)}`
  - events (all carry `t`): `hand_start{handNo,button,sbIdx,bbIdx,sb,bb,ante,stacks}`, `deal_hole`, `post{p,kind:'ante'|'sb'|'bb',amount,allIn}`,
    `action{p,type:'fold'|'check'|'call'|'bet'|'raise',amount,to,allIn,full,street}`, `street{street,cards,board,pot}`, `uncalled{p,amount}`,
    `showdown{order:[p…],reveals:[{p,hole|null,score,hand,mucked}]}` (mucked = loser may hide; all-in hands always shown), `award{pot,amount,eligible,winners:[{p,amount}],hand,uncontested?}`, `hand_end{results}`.
  - `state.result = {showdown, pots:[{amount,eligible,winners,shares:[{p,amount}],hand}], uncalled:[{p,amount}], reveals, results:[{p,id,delta,stack,busted}], total, uncontestedWinner}`.
  - `potInfo(state) -> {total, pots:[{amount,eligible}], uncalled}` live side-pot display; `totalPot(state)`; `buildPots`.
  - `publicView(state, viewerIdx)` = state without deck and with other players' unrevealed hole cards as `-1`. **Use this (or tournament `humanView(t)`) for rendering.**
  - Rules implemented: no-limit; min raise = last full raise; incomplete all-in raise doesn't reopen; heads-up button = SB, acts first preflop and last postflop;
    button moves to the next occupied seat each hand and the blinds are always the next two occupied seats (no dead blinds); antes (posted by all, not a bet);
    side pots by committed layers, uncalled bets returned; odd chips go to the first winner left of the button; showdown order = last aggressor then clockwise;
    no burn cards (cosmetic); fair seeded Fisher-Yates.
## ai/
- `ai/profiles.js`: `ARCHETYPES` {rookie, calling_station, wall, grinder, shark, trickster, professor, closer, maniac, legend, balanced}; params
  `{tight, aggr, bluff, position, risk, adapt, tiltRes (0..1), skill (1..10)}`; `makeProfile(name, overrides)`, `randomProfile(rng, skill)`.
- `ai/decide.js`: `decide(view, profile, rng, ctx) -> action` (always legal). `view = viewFor(state, idx)` — the AI's information set (own cards + public info only;
  tests prove changing opponents' hole cards / the deck never changes the decision). `ctx = {stats, agent:{tilt}, fast, pressure:{bubble,finalTable,avgStack}}`.
  Equity: `ai/equity.js equity(hole, board, cuts[], rng, iters)` Monte-Carlo vs ranges. ~0.2 ms/decision on node, fast mode for simulated tables.
  Difficulty = estimate noise, pot-odds blindness and blunder rate (no hidden-card or deck tricks).
## tournament/
- `tournament/structures.js`: `makeStructure({bb, levels, growth, anteFrom, handsPerLevel, handsPerLevelFinal})`, `levelAt(structure, k)`, `payoutLadder(entrants, kind)`, `prizeAmounts(pool, ladder)`, `placePoints({place, entrants, tableSize, paid, ko, mult})`.
- `tournament/tournament.js` (state `t`, JSON):
  - `createTournament(def, {player:{id,name,avatar}, seed}) -> t`. `def` comes from `buildDef(eventId)`, `quickSitGoDef(difficulty, seats)`, `quickCashDef(difficulty, seats)`, `tutorialDef()`.
  - **Interactive loop**
    ```
    const r = startNextHand(t, {interactive:true, spectate:false}) // simulates the other tables one hand, deals yours
    // r = {events (round events), hand (live state | null), handEvents (hand_start/post…), instant?, finishedHand?}
    while (t.phase === 'hand') {
      const a = actor(t);                 // {kind:'human'|'ai'|null, idx, id}
      if (a.kind === 'human') { L = legal(t); events = act(t, {type:'call'}); }   // UI input
      else { {action, events} = aiAct(t); }                                       // UI adds think-time delay
    }
    // hand over: t.lastHand = {handNo, board, showdown, pots, results, reveals, log, players:[{id,hole,folded,showed}], playerIdx, pot}
    // t.phase is now 'between' (call startNextHand again) or 'finished'.
    ```
    `r.hand === null` means nothing to play: the player is out (and not spectating), or an all-in-from-the-blinds hand was resolved instantly (`r.instant`, `r.finishedHand`, `t.lastHand`).
    While the player is out call `simulateToEnd(t)` (skip) or `startNextHand(t, {spectate:true})` repeatedly (watch one table with `aiAct`).
  - round events in `r.events` / `t.events`: `bust{id,place,by,table,isPlayer,rivalId}`, `table_broken{table,players,playerAffected}`, `player_moved{from,to,seat,broken?}`, `balanced`, `level_up{level,blinds}`,
    `stage{stage:'day1'|'day2'|'final'}`, `final_table`, `bubble`, `in_the_money`, `finished{winner}`, `rebuy{id,isPlayer}` (quick cash).
  - read-only helpers: `standing(t)` -> `{entrants, remaining, avgStack, level, blinds:{sb,bb,ante}, nextBlinds, handsToNextLevel, stage, playerOut, playerPlace, playerStack, chipRank, tablesLeft, paid, inMoney, bubble, nextPrize, prizePool, round, finalTable}`;
    `playerTableInfo(t)` -> `{id, seats:[entrant|null]}`; `humanView(t)` (hidden-card-safe hand view); `human(t)` (player entrant); `tournamentResult(t)`.
  - `t.entrants[i]`: `{idx,id,name,avatar,isPlayer,rivalId,profile,stack,out,place,bustedBy,ko,table,seat}`; avatar `'f0'..'f11'` fillers, rival id for rivals, player's avatar string.
  - `tournamentResult(t) -> {defId, place, entrants, paid, prize, points, ko, finalTable, won, cashed, rounds, rivals:[{id,place,beatPlayer,playerBeat,knockedOutPlayer,knockedOutByPlayer}], feats:{handsPlayed,handsWon,biggestPot,bluffWins,allInWins,comeback,…}, finished, playerOut}`.
  - Headless: `simulateToEnd(t)`, `botAct(t, profile)` (bot plays the human seat), `simulateWithBot(t, profile)`.
  - Formats: `sitgo` (6/9), `ko` (bounty per knockout), `mtt` (other tables simulated hand-for-hand with the same engine; table breaking/balancing; final table),
    `duel` (2 or 3 players, winner takes all), `satellite`, `championship` (135 entrants, Day 1/Day 2/Final, slower final structure), `quick` (cash-style: fixed blinds, auto-rebuy, never finishes).
## career/
- `career/index.js` barrel. Static data: `CIRCUITS` (4), `EVENTS` (21), `EVENT_BY_ID`, `RIVALS` (11; ids tito bartholomew ingrid rafa koji elena nadia celeste jun legend mirella; `avatar` = id; `MAIN_RIVAL='rafa'`, `FINAL_RIVAL='legend'`),
  `ACHIEVEMENTS` (29), `COSMETICS`, `STORY_BEATS`, `COACH_STEPS`, `QUAL_WORLD`.
  Event fields: `{id, circuit, format, name, sub, entrants, tableSize, startStack, structure, buyIn, bounty?, mult, fieldSkill, rivals:[ids], req (requirement DSL|null), title:{pt,en,es}|null, xp, rep, special?, story?:{intro,win,lose}, tutorial?, circuitFinal?, championship?}`.
  Rival fields: `{id,name,nick,avatar,origin,style,archetype,profile,circuits,events,blurb,bio,quotes[],arc?,finalBoss?}`.
- Career object `c` (create with `newCareer({name, avatar, seed, now})`):
  `{v:1, createdAt, seed, seq, profile:{name,avatar}, xp, level, rep, unlocked:['local',…], qualifiedWorld, champion, titles:[eventIds], wonEvents:{id:n}, playedEvents:{id:n}, stats:{played,wins,duelWins,finalTables,cashes,bestPlace,winnings,ko,hands,handsWon,biggestPot,bluffWins,allInWins,comebacks}, byCircuit:{circuit:{played,wins,cashes,finalTables,best}}, pts:{season|local|regional|intl|world:{you, rivalId…}}, season:{n,events,wins}, seasonHistory:[{n,events,wins,points,rank,leader,champion}], rivals:{id:{met,beaten,lostTo,koByYou,koOnYou,lastPlace}}, results:[{eventId,circuit,place,entrants,prize,points,xp,ko,at,season,won,cashed,finalTable}] (latest 100), achievements:{id:{at}}, cosmetics:{unlocked:['slot:id'],selected:{theme,back,deck,avatar,frame,winAnim,table,title}}, story:{seen:[beatIds]}, flags:{tutorialDone}, tournament: t|null, tournamentEvent}`
- Flow: `eventStatus(c,id)` / `listEvents(c, circuit?)` -> `{id,event,unlocked,circuitUnlocked,req:{met,cur,target,label,children?},played,wins,completed}`; `circuitInfo(c,id)`; `progressionMap(c)` (4 nodes: unlocked/current/completed/unlockReq);
  `recommendedEvent(c)`, `nextObjective(c)`, `championshipQualification(c) -> {qualified, via:['title'|'satellite'|'ranking'], conditions:[…progress]}`;
  `startEvent(c, eventId, {seed?, player?}) -> t` (stores `c.tournament`; throws if locked / one already running); play it with the tournament loop;
  when the player is out: `finishEvent(c) -> report` (simulates the rest, records the result, clears `c.tournament`);
  quitting a running event: `forfeitEvent(c)` (counts as elimination at the current position — no free retries).
  `report = {eventId, result, xpGain, level, levelUp, repGain, points, titleWon:{event,name,repeat?}|null, newCircuits:[], qualifiedNow, championNow, seasonEnded|null, newAchievements:[ids], newCosmetics:[{slot,id,name}], storyBeats:[ids], moments:[…]}`;
  `moments` strings for full-screen moments: `first_tournament, first_win, first_final_table, final_table, title, circuit_unlocked:<circuit>, eliminated_rival:<id>, qualified_world, champion`.
  Progression ONLY from results: Regional opens with the first tournament win (not duel) in Local; International with 220 regional points or the Regional Masters title;
  World Championship via an International title, the satellite win, or top 4 in the International standings after 4 events; Legends mode (duel + cup) after becoming champion.
- Views: `profileSummary(c)`, `levelInfo(c)`, `reputationInfo(c)`, `standings(c, 'season'|circuit) -> {rows:[{id,name,pts,isYou,rank}], you:{rank,pts,above,below,toNext}, season}`,
  `listRivals(c)` (rival + `record` head-to-head + `met`), `listAchievements(c)` (`{id,name,desc,icon,cur,target,unlocked,at}`), `listCosmetics(c, slot?)`, `availableTitles(c)`.
  Edits: `setProfile(c,{name,avatar,title})`, `selectCosmetic(c, slot, id)` (only owned items), `markTutorialDone(c)`.
  Avatars `p1..p12` (player). Cosmetic ids follow UI_NEEDS.md: themes `emerald midnight burgundy sand onyx teal royal`, backs `royal onyx ruby sand emerald violet`, decks `classic fourcolor`, frames `none gold emerald ruby royal champion`, win animations `chips confetti spotlight gold_rain`, tables `oval legends_lounge`.
- `career/testing.js` (QA hooks, harmless): `careerAt('new'|'regional'|'intl'|'world'|'champion')` returns a legal career positioned there (built through `recordResult`); `fakeResult`, `record`.
## UI read-model (career/views.js, answers UI_NEEDS.md; all in the barrel)
`createCareer` (= newCareer), `profileView(c)`, `circuitView(c,id)`, `eventView(c,id)` (state locked|available|played|cashed|won, lockReason.missing[], best, recommended), `rankInfo(c, scope)`, `standingsView(c, scope)`,
`seasonView(c)` (goals/history), `achievementsView(c)`, `rivalsView(c)` (h2h, storyBeats seen), `cosmeticsView(c)`, `equip(c, 'tableTheme'|'cardBack'|'deck'|'avatar'|'frame'|'title', id)`,
`nextCoach(c, trigger)` / `markCoach(c, id)` (persisted in `c.flags.coachSeen`), `startEvent(c, id, seed|{seed})`, `finishEvent(c)` (report also has aliases `xp, rep, prize, place, entrants, unlockedCircuits, achievements, rewards:[{type,id}], rivalsDelta`; `levelUp` = `{from,to}|null`;
extra moments `rival_beaten:<id>`, `championship_final`), `debugJump(c, 'regional'|'intl'|'world_qualified'|'champion')` (career/testing.js, uses real recordResult). `tutorialDef()` = guided 4-player sit&go (seed it with any fixed number).
Note: `t.lastHand.players[].hole` holds every player's cards for the *finished* hand (use `showed`/`reveals` to decide what to display); never read `t.hand.deck`.
## persistence (career/store.js)
- `loadCareer(ctx.store) -> c | null` (validates, sanitises, falls back to the backup copy; an invalid in-progress tournament is dropped, the career kept), `saveCareer(ctx.store, c)` (keeps `poker.career.bak`),
  `resetCareer(store)` (UI must confirm first), `hasCareer(store)`. Save after every completed hand (cheap) and after `finishEvent`. Keys: `poker.career`, `poker.career.bak`, `poker.quick`, `poker.prefs` (free for C2).
  Quick modes: `loadQuick/saveQuick/recordQuickSitGo` (sit&go stats, cash stats, tutorialDone).
- Saved tournaments resume mid-hand (state includes the hand and the secret deck); the UI must never read `hand.deck`.
## Tests (node --test games/poker/tests/*.test.mjs)
eval (known hands, kickers, wheel, flush/SF, full-house ties, 7-card vs best-of-21, frequencies), hand (blinds/order/min-raise/incomplete raise/side pots/odd chip/uncalled/showdown order/fuzz 4000 hands),
ai (legality fuzz 3000 hands, no-peeking, timing, personalities, strength), tournament (balancing, pacing, stages, resume mid-hand, quick cash, spectate), career (progression, gating, achievements, persistence/corruption),
career_sim (a bot plays the whole career Local → Regional → International → World with invariants checked after every result).
