"""List the objects inside every cached Poly Haven .blend (names, types, sizes).

    blender -b --factory-startup -P inspect_assets.py -- out.json [asset ...]

Used while writing recipes: some "set" assets (tea set, book sets, food packs)
contain several separate objects that can be placed one by one.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

CACHE = os.environ.get('HOG3D_CACHE') or os.path.expanduser('~/.cache/hog3d')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = argv[0] if argv else 'inspect.json'
names = argv[1:] or sorted(os.listdir(os.path.join(CACHE, 'models')))
res = {}
if os.path.exists(out):
    with open(out) as f:
        res = json.load(f)
for asset in names:
    if asset in res:
        continue
    path = os.path.join(CACHE, 'models', asset, asset + '.blend')
    if not os.path.exists(path):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    items = []
    for ob in bpy.data.objects:
        info = {'name': ob.name, 'type': ob.type, 'parent': ob.parent.name if ob.parent else None}
        if ob.type == 'MESH':
            mw = ob.matrix_world
            pts = [mw @ Vector(c) for c in ob.bound_box]
            mn = [min(p[i] for p in pts) for i in range(3)]
            mx = [max(p[i] for p in pts) for i in range(3)]
            info['min'] = [round(v, 3) for v in mn]
            info['max'] = [round(v, 3) for v in mx]
            info['tris'] = sum(len(p.vertices) - 2 for p in ob.data.polygons)
            info['mats'] = [m.name for m in ob.data.materials if m]
        items.append(info)
    res[asset] = items
    with open(out, 'w') as f:
        json.dump(res, f, indent=0)
print('inspected', len(res))
