# build — offline scene painter for "Detetive dos Personagens"

Nothing here runs in the app (the APK/artifact builders skip `build/`). `./build.sh` regenerates
`../scenes/*.webp|json` and `../sprites/*.webp`.

* `render.mjs` opens headless Chromium (Playwright), loads `art/*.js` and paints each scene on a
  3200x2000 canvas (seeded, so the output is reproducible), then writes `out/<id>.png` + `out/<id>.json`.
  `--icons` renders the "wanted" portraits.
* `encode.py` fits every picture into <= 800 KB of WebP (quality/size ladder), writes the 480 px
  preview and the hit-data JSON (`targets[id].bb = [x0,y0,x1,y1]` in picture pixels).
* `art/core.js` helpers, `people.js` inked figure drawing (hair, hats, glasses, beards, outfits,
  poses, props), `gen.js` random crowd members + the hero (Ruivinho) and his near-miss decoys,
  `creatures.js` animals/monsters/robots, `props.js` scenery sprites, `targets.js` the 8 hidden
  characters/items and their decoys, `compose.js` the layout engine (zones, depth sorting,
  occlusion masks, keep-clear areas, decoys), `themes/*.js` one file per scene.
* Env: `WALDO_OUT` (raw output dir, default `out/`), `WALDO_BUDGET` (bytes per picture).
