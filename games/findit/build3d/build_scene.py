"""Build and render one scene.

    blender -b --factory-startup -P build_scene.py -- <scene_id> <out_dir> [--preview] [--samples N] [--save-blend]

Writes <out_dir>/beauty.png (the photo), index_0001.exr (object-index pass)
and manifest.json (which index is which asset, projected boxes). post.py turns
these into the game files.
"""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import lib  # noqa: E402
import recipes  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
sid, out = argv[0], os.path.abspath(argv[1])
preview = '--preview' in argv
samples = None
if '--samples' in argv:
    samples = int(argv[argv.index('--samples') + 1])
scale = 1.0
if '--scale' in argv:
    scale = float(argv[argv.index('--scale') + 1])
os.makedirs(out, exist_ok=True)

R = recipes.SCENES[sid]
t0 = time.time()
lib.reset()
S = {'seed': R['seed'], 'preview': preview}
C, cam = R['build'](lib, S)
w, h = R['size']
if preview:
    w, h = int(w * 0.375 * scale), int(h * 0.375 * scale)
else:
    w, h = int(w * scale), int(h * scale)
lib.setup_render(w, h, samples=samples or (24 if preview else 72), out_dir=out, noise=0.05 if preview else 0.03,
                 **R.get('render', {}))
bpy.context.view_layer.update()
print(f'[{sid}] built in {time.time() - t0:.1f}s: {len(C.items)} items, {sum(1 for i in C.items if i["kind"] == "prop")} props {C.stats}', flush=True)
for it in C.items:
    sz = it['max'] - it['min']
    if max(sz) > 2.2: print('BIG', it['key'], tuple(round(v, 2) for v in sz), tuple(round(v,2) for v in it['min']))
lib.write_manifest(os.path.join(out, 'manifest.json'), C, cam, w, h, {'scene': sid})
if '--save-blend' in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'scene.blend'))
if '--norender' in argv:
    sys.exit(0)
t1 = time.time()
lib.render(out)
print(f'[{sid}] rendered {w}x{h} in {time.time() - t1:.1f}s', flush=True)
