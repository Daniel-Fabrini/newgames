# PlayVerse inside DA Games

This folder is a vendored copy of **PlayVerse** (React 19 + TypeScript + Vite, 10 minigames: Block Puzzle, Water Sort,
Snake, Number Match, Paciência, Damas, Dominó, Sudoku, 2048, Palavras Cruzadas). It is Daniel Aleixo's own code (clone of
`manygames`, commit c7a291b). DA Games runs the real games in an iframe, in **embed mode**.

## Layout

- `src/` – the app (engines, UI, i18n, services) plus the embed additions below. The 619 + 23 original unit tests live next
  to the code and still run.
- `vite.config.ts` – the standalone PlayVerse PWA build (service worker, manifest). Not used by DA Games.
- `vite.embed.config.ts` – the DA Games build: `base: './'`, no service worker, no manifest/icons, no source maps,
  output to `../games/pv/app/`.
- Not vendored: `android/`, `resources/`, `dist/`, `node_modules/`, e2e scripts, docs of the standalone app.

## Commands

```bash
cd playverse
npm ci
npm test            # vitest (unit tests of the engines, services and the embed back-stack)
npm run typecheck
npm run lint
node ../tools/build-pv.mjs     # or: npm run build:embed → rebuilds ../games/pv/app/ (commit the output)
```

DA Games has no build step at runtime, so `games/pv/app/` is committed. Rebuild it after every change in `src/`.

## Embed mode

URL: `games/pv/app/index.html?embed=1&lang=pt|en|es[&sound=0][&haptics=0][&mode=<hint>]#/game/<pv game id>`

Embed mode only activates when the page really is inside an iframe (`window.parent !== window`). Code: `src/app/embed.ts`.

- Renders only the game page (`EmbedShell` in `App.tsx`): no home, bottom nav, brand hero, language chip, skip link.
  The game's own title row is reduced to its help/pause buttons (DA Games already shows back + title).
- Never registers the service worker or the install prompt; never touches the native status bar.
- Settings are in memory only (`services/settings.ts`): language from `lang`, sound/vibration from the host, theme dark.
  Nothing is persisted that could fight DA's own settings. Game data (saves, stats, level progress) still uses PlayVerse's
  `localStorage` keys (`playverse:*`), which do not collide with DA's `ng:*` keys.
- The pause menu hides PlayVerse's language/sound switches (DA's settings gear owns them).
- Black & gold theme: `src/styles/embed.css`, every rule scoped to `html[data-embed]`.

### Messages

| direction | message | meaning |
| --- | --- | --- |
| child → parent | `{type:'pv-ready'}` | page is up and listening |
| child → parent | `{type:'pv-exit'}` | leave the game (back button at the root, "exit to home", result dialogs) |
| child → parent | `{type:'pv-result', game, outcome, score?, level}` | a real match/level finished (`recordMatch`; `level` is true when `completeLevel` ran just before) |
| child → parent | `{type:'pv-handled'}` | answer to `pv-back`: the game stayed open (closed a dialog / went to its menu) |
| parent → child | `{type:'pv-back'}` | Android/header back |

Back handling (`registerBackHandler` / `useBackHandler` / `requestBack`): the most recently registered handler is asked
first. Every `Modal` registers while open (a dismissible dialog closes), then the game registers one while a match is in
progress (go to its setup / level map / pause, see each `index.tsx`). With nothing to handle, `pv-exit` is posted.
The in-game back arrow is hidden in embed mode; `goBack()` posts `pv-exit`.

`?mode=` hints (from the DA lobby buttons): `checkers` and `domino` `ai|2p` (start a new match when nothing is in progress,
otherwise open the setup screen with that type), `solitaire` `draw1|draw3`, `sudoku` `easy|medium|hard`, `snake`
`classic|endless`, `numbers` `classic|challenge`.

The host side is `games/pv/host.js` (XP, back, cleanup).
