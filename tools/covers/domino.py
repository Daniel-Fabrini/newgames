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
def dom(top, bot, loc, tilt=0, yaw=0, big=1.0):
    parts = [box((W, D, Hh), ivory, bevel=0.1)]
    parts.append(box((W * 0.8, D + 0.02, 0.05), glossy('#2a8aa8', 0.3, 0.6, name='bar'), bevel=0.01))
    for half, n in ((0.5, top), (-0.5, bot)):
        for (px, pz) in PIPS[n]:
            s = sphere(0.12, redpip if n == 1 else pip, (px * 0.27, -D / 2 - 0.0, half * Hh * 0.98 + pz * 0.27 - (0.5 if half > 0 else -0.5) * 0.0 + (0 if True else 0) - half * 0.52 * 0 ), scale=(1, 0.35, 1))
            s.location.z = half * 1.0 + pz * 0.27 * 1.0
            parts.append(s)
    # tilt about the bottom-right edge
    g = parent(parts, loc=(0, 0, Hh / 2))
    pivot = bpy.data.objects.new('pv', None); bpy.context.scene.collection.objects.link(pivot)
    g.parent = pivot
    g.location = (-W / 2, 0, Hh / 2)
    pivot.location = loc
    pivot.rotation_euler = (0, math.radians(tilt), math.radians(yaw))
    pivot.scale = (big,) * 3
    return pivot
x0 = -2.5
pv = []
for i, (t, bt, tilt) in enumerate([(3, 5, 0), (2, 6, 0), (4, 1, 14), (6, 3, 36), (5, 2, 66)]):
    pv.append(dom(t, bt, (x0 + i * 1.18 + W / 2, 0, 0), tilt, 0))
parent(pv, loc=(0, 0, 0), rot=(0, 0, -24))
podium('#1a7fa8', 3.5, 0.5, z=0)
fit(0.8, 0.1, 0.0)
render('domino')
