# Game API

NewGames is a static web app (no build step, plain ES modules) that runs on phones
in the browser and can be installed as a PWA. The hub (`js/main.js`) lists the
games registered in `js/games.js`; each game lives in `games/<id>/`.

## File layout of a game

```
games/<id>/
  main.js       required — exports mount(root, ctx)
  strings.js    required — UI text in pt / en / es
  style.css     optional — loaded with ctx.loadCSS(new URL('./style.css', import.meta.url))
  *.js          any other modules (levels, data, engine…), imported relatively
```

Rules:

- Only touch files inside your own `games/<id>/` folder. Shared files (`js/`, `css/`,
  `assets/`, `index.html`) belong to the shell.
- Prefix every CSS class you define with `g-<id>-` (or nest under `.g-<id>`), so
  games never collide. The game root element already has class `game g-<id>`.
- No external network requests at runtime (no CDNs, no APIs). Everything must
  work offline. Bundle any data inside the folder.
- No new dependencies or build tools. Vanilla JS, DOM, SVG, Canvas 2D.
- Use relative imports with `.js` extensions. Use `new URL('./file', import.meta.url)`
  for assets inside your folder so paths work wherever the app is hosted.

## mount(root, ctx)

```js
export async function mount(root, ctx) {
  const t = ctx.makeT(STRINGS);       // translator for this game's strings
  // build UI inside `root` (position:absolute; inset:0; overflow:hidden)
  ctx.onBack(() => {                   // optional: header back / Android back button
    if (inLevel) { showMenu(); return true; } // handled → stay in the game
    return false;                      // not handled → shell goes back to the hub
  });
  return () => { /* cleanup: cancel rAF loops, timers, listeners on window/document */ };
}
```

`root` fills the screen under the 54px top bar (title + back button). Size your
layout from `root.clientWidth/clientHeight` and handle `resize`.

### ctx

| member | description |
|---|---|
| `ctx.lang` | `'pt' \| 'en' \| 'es'` — UI language at mount time (the hub is the only place it changes) |
| `ctx.makeT(strings)` | returns `t(key, params)`; strings shaped `{ pt: {...}, en: {...}, es: {...} }`; `{name}` placeholders; a value can be a function `(params, lang) => string` for plurals |
| `ctx.pick(obj)` | picks `obj[lang]` from an inline `{ pt, en, es }` object |
| `ctx.store` | persistent storage namespaced to the game: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `update(key, fn, fallback)` (JSON values) |
| `ctx.sfx` | `play(name)` with names `tap select success error coin pop whoosh kick hit shoot explosion whistle goal win lose levelup`; `tone({freq,to,dur,type,vol,delay})`, `noise({dur,vol,freq,q,delay})`, `vibrate(ms or pattern)`. Mute/vibration settings are respected automatically |
| `ctx.ui.h(tag, attrs, ...children)` | DOM builder: `h('button', { class: 'btn primary', onclick }, 'Play')` |
| `ctx.ui.clear(el)` | removes all children |
| `ctx.ui.toast(msg)` | short message at the bottom |
| `ctx.ui.modal({ title, body, actions, dismissible })` | returns a Promise of the chosen action `value`; `actions: [{ label, value, primary, danger }]`; `body` is a string or a Node |
| `ctx.ui.confetti()` | celebration burst |
| `ctx.loadCSS(url)` | loads a stylesheet once |
| `ctx.setTitle(text)` | changes the top bar title (pass nothing to restore the game name) |
| `ctx.setHeaderRight(node)` | puts a node (e.g. a coins pill or a help button) on the right of the top bar; `null` clears it |
| `ctx.onBack(fn)` | registers the back handler described above |
| `ctx.exit()` | goes back to the hub |

Shared helpers you can import directly (relative to your folder):

```js
import { shuffle, rng, norm, stars } from '../../js/core/ui.js';
// shuffle(array, rnd?) → new array; rng(seed) → deterministic Math.random replacement;
// norm(str) → lowercase without accents/punctuation, for comparing typed answers;
// stars(n, max=3) → '★★☆'
import { COUNTRIES, CONTINENTS, flagUrl, byCode } from '../../js/data/countries.js';
```

## Shared CSS components (css/app.css)

Use these so every game looks like part of the same app (dark theme, chunky
rounded buttons, Nunito font):

- Layout: `.screen` (full-size scrolling column with padding — use for menus),
  `.screen.center`, `.stack`, `.row`, `.row.wrap`, `.spacer`, `.grid-2`, `.grid-3`
- Text: `.title-xl`, `.title-l`, `.section-title`, `.muted`, `.small`, `.big-emoji`
- Surfaces: `.card`
- Buttons: `.btn` + `.primary | .accent | .good | .danger | .ghost` + `.big | .small | .block`;
  `.icon-btn` (42px square)
- Menus: `.list` > `button.list-item` > `.li-icon`, `.li-body` > (`.li-title`, `.li-sub`), `.li-right`
- Choices: `.chips` > `button.chip(.active)`
- HUD: `.hud`, `.stat` (pill), `.progress > i` (set `i.style.width`)
- Levels: `.level-grid` > `button.level-btn(.done|.current|.locked)` with `<small>★★☆</small>`
- Quiz: `button.answer-btn(.correct|.wrong|.dim)`
- Feedback: `.stars`, animations `.shake`, `.pop-in`, `.fade-in`, `.spinner`

CSS variables: `--bg --bg-2 --surface --surface-2 --surface-3 --line --text --text-2 --text-3
--primary (yellow) --accent (blue) --good (green) --bad (red) --warn --radius --safe-bottom --font`.

## Quality bar

- Mobile first: design for a 360–430px wide portrait phone, touch input
  (pointer events), big tap targets (≥ 44px). Must also work with a mouse on desktop.
- No horizontal page scroll; respect `var(--safe-bottom)` at the bottom.
- Every visible string goes through `t()` and exists in pt, en and es
  (natural Brazilian Portuguese, natural Latin-American/neutral Spanish).
- Save progress with `ctx.store` (unlocked levels, stars, best scores, coins).
- Clean up on unmount: no rAF loops or timers left running after leaving the game.
- Zero console errors.
