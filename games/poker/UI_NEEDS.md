# UI needs from the career layer (C2 -> C1)

Everything below is "read model" data the UI renders. Pure functions of the career object preferred (no DOM), all text as `{pt,en,es}`.
Whatever you already planned under another name is fine: just document it in API.md and I adapt. Priority order = what I wire first.

1. **Career object**: `createCareer({name, avatar})`, `validateCareer(raw) -> career | null` (corruption-safe, versioned), serialisable.
   Persisted via `ctx.store` by me (`career`), or give me `saveCareer/loadCareer` helpers.
2. **Profile view**: `profileView(career) -> {name, avatar, frame, level, xp, xpInLevel, xpForNext, reputation, repTitle:{pt,en,es}, titles:[...], played, wins, finalTables, cashes, bestFinish, winnings, knockouts, circuit (current id), rank}`.
3. **Circuit / event status**:
   - `circuitView(career, circuitId) -> {unlocked, req (describeReq data) , progress:{played,wins,points,titles}, finalAvailable, events:[eventStatus]}`
   - `eventView(career, eventId) -> {unlocked, state:'locked'|'available'|'played'|'cashed'|'won', lockReason:{req, missing}, plays, best:{place,prize,points}|null, recommended:boolean}`
   - `recommendedEvent(career) -> eventId`, `nextObjective(career) -> {text:{pt,en,es}, progress?, target?}`.
4. **Start / finish**: `startEvent(career, eventId, seed) -> tournament` (applies buy-in rules if any; I show `buyIn` as "entry" in virtual chips) and
   `finishEvent(career, eventId, tournamentResult) -> report` where `report = {xp, rep, points, prize, place, entrants, levelUp?:{from,to}, unlockedCircuits:[id], qualifiedWorld?:bool, titleWon?:{pt,en,es}, achievements:[id], rewards:[{type,id}], moments:['first_win','first_final_table','rival_beaten:rafa','circuit_unlocked:regional','final_table','title','championship_final','champion'...], rivalsDelta:[...], seasonEvent?}`.
   The moments list drives my full-screen celebrations; only list what really happened.
5. **Standings**: `standings(career, circuitId|'season') -> [{id,name,avatar,points,isPlayer,rank}]`, `rankInfo(career, circuitId) -> {rank, of, points, toNext, above:{name,points}|null, below:{...}|null}`; season: `seasonView(career) -> {n, eventsPlayed, eventsTotal, goals:[{text,progress,target,done}], history:[...]}`.
6. **Achievements**: `achievementsView(career) -> [{id,name,desc,icon(emoji),progress,target,done,rewards}]`.
7. **Rivals**: `rivalsView(career) -> [{id, met, beaten, lostTo, h2h:{wins,losses}, unlocked(bool: seen yet), storyBeats:[...unlocked]}]` + main rival arc beat texts keyed by milestone.
8. **Rewards/cosmetics**: `cosmeticsView(career) -> {tableThemes:[{id,name,unlocked,req}], cardBacks:[...], decks:[...], avatars:[...], frames:[...], titles:[...]}`, `equip(career, type, id)`; ids I support: themes `emerald midnight burgundy onyx royal teal sand`; backs `royal ruby emerald onyx sand violet`; decks `classic fourcolor`; avatars `p1..p12`; frames `none gold emerald ruby royal champion`.
9. **Coach**: `nextCoach(career, trigger) -> step|null` + `markCoach(career, id)` so each tip shows once (COACH_STEPS triggers from circuits.js; I fire first_hand/first_blinds/first_turn/first_facing_bet/first_flop/first_allin/first_showdown/first_level_up/bubble).
10. **Test hook** (harmless): `debugJump(career, 'regional'|'intl'|'world_qualified'|'champion')` for my Playwright runs.
11. In-tournament persistence: UI saves `tournament object` (JSON) at each hand end and before each human action; please keep `serialize`/resume contract (t.hand mid-hand is fine, I replay `t.hand.log`).
