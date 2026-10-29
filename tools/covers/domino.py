import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#3fc8e8', '#0a4a78', samples=int(os.environ.get('S', 96)))
ivory = glossy('#fbf3dc', 0.22, 0.7, name='iv')
pip = glossy('#14323f', 0.25, 0.8, name='pip')
redpip = glossy('#e0303c', 0.25, 0.8, name='rp')
W, D, Hh = 1.0, 0.36, 2.0
PIPS = {1: [(0, 0)], 2: [(-1, 1), (1, -1)], 3: [(-1, 1), (0, 0), (1, -1)], 4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
        5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
def dom(top, bot, loc, tilt=0, big=1.0):
    parts = [box((D, W, Hh), ivory, bevel=0.1)]
    parts.append(box((D + 0.02, W * 0.8, 0.05), glossy('#2a8aa8', 0.3, 0.6, name='bar'), bevel=0.01))
    for half, n in ((1, top), (-1, bot)):
        for (px, pz) in PIPS[n]:
            parts.append(sphere(0.12, redpip if n == 1 else pip, (-D / 2, px * 0.27, half * 0.5 + pz * 0.27 * 1.0), scale=(0.35, 1, 1)))
    g = parent(parts, loc=(-D / 2, 0, Hh / 2))
    pivot = bpy.data.objects.new('pv', None); bpy.context.scene.collection.objects.link(pivot)
    g.parent = pivot
    pivot.location = loc
    pivot.rotation_euler = (0, math.radians(tilt), 0)
    return pivot
pv = []
s0 = 0.78
x0 = -2.4
for i, (t, bt, tilt) in enumerate([(3, 5, 0), (2, 6, 0), (4, 1, 15), (6, 3, 36), (5, 2, 62), (1, 4, 86)]):
    pv.append(dom(t, bt, (x0 + i * s0 + D / 2, 0, 0), tilt))
parent(pv, loc=(0, 0, 0), rot=(0, 0, 32))
podium('#1a7fa8', 2.9, 0.5, z=0)
fit(0.92, 0.4, 0.0)
render('domino')
