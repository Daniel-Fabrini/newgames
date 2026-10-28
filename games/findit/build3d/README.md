# build3d — photorealistic scenes for Caça-Objetos

The scenes of the game are photographs rendered offline in Blender (Cycles) from
CC0 Poly Haven models, textures and HDRIs. Nothing here runs in the app: these
scripts only produce the files in `../scenes/`.

## What gets built

For every scene id in `recipes.py`:

| file | what |
|---|---|
| `scenes/<id>.webp` | the photo, 2400×1350, WebP q80 (≈300–500 KB) |
| `scenes/<id>_s.webp` | 480 px preview for the chapter cards |
| `scenes/<id>.json` | every visible prop: name key `k`, asset key `a`, bbox `b`, visible pixels `n`, visible fraction `v`, target flag `t`, outline polygons `p` |
| `scenes/thumbs/<asset>.webp` | 112 px tray icon of each prop that can be a target |
| `scenes/names.js` | pt / en / es names of the targets (from `names.py`) |

## How a scene is made

1. `recipes.py` builds the set (room or outdoor backdrop, PBR textures), places the
   furniture by hand, then the `Composer` (`lib.py`) finds every support surface
   with vertical ray casts (shelf boards, tabletops, crate lids, the floor) and fills
   it: rows of books, packed curios, piles, stacked boxes, things hung on the wall.
   Placement uses AABB tests (no intersections), keeps props in the camera view and
   skips spots the camera cannot see.
2. Every placed object gets its own pass index. `build_scene.py` renders the
   colour-managed photo (AgX, OpenImageDenoise) and saves all passes as a multilayer
   EXR, including the **object index** pass.
3. `post.py` reads the index pass: for each prop it counts the visible pixels,
   compares them with the projected bounding box (how hidden it is), and traces the
   visible region into simplified outline polygons (OpenCV). Props with at least
   420 visible pixels and 20 % visibility can be targets; smaller visible bits stay
   tappable (so tapping a tiny copy of a target never counts as a miss).
4. `thumbs.py` renders each target prop alone (3/4 studio view, transparent) and
   `post.py --thumbs` turns them into the small WebP icons.

In the game, `engine/scene.js` loads the JSON, hit-tests taps against the polygons
(with a more generous radius for small objects), and picks seeded target sets
whose difficulty grows with the level (bigger and fully visible objects first,
small and half-hidden ones later).

## Regenerating

Requirements (outside the repo): Blender ≥ 4.2 (5.x reads every Poly Haven file;
4.2 cannot open the newest ones), and a Python with `numpy opencv-python-headless
pillow OpenEXR` for `post.py`.

```sh
export HOG3D_CACHE=~/hog3d-cache           # downloads go here (≈2 GB)
export BLENDER=~/blender-5.2/blender
python3 fetch.py scenes                     # models (1k .blend), 2k textures, HDRIs
python3 make.py --preview study             # quick 900 px look (renders/<id>_p/beauty.png)
python3 make.py study kitchen --py /path/to/venv/bin/python   # final renders + game data, icons, names.js
```

A final scene takes about 10–15 min on 4 CPU cores. Add the scene to
`../scenes/index.js` (chapter order and names) when it is ready.

Other tools: `inspect_assets.py` lists the objects inside cached .blend files
(useful for set assets such as the tea set or the book collection). `thumbs.py` and
`post.py --thumbs/--index` can also be run on their own.

## Licence

All models, textures and HDRIs are from Poly Haven (CC0). See `../CREDITS.md`.
