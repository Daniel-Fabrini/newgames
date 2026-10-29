import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#ffb43a', '#b83c06', samples=int(os.environ.get('S', 128)))
N, T, GAP = 4, 0.92, 0.12
pitch = T + GAP
nums = [[7, 3, 5, 1],
        [8, 2, 9, 4],
        [6, 5, 3, 7],
        [1, 9, 2, 8]]
pair = {(0, 0), (2, 3)}      # two glowing 7s
palette = ['#ff5a3c', '#ffc21a', '#2fc7b0', '#ff7aa8', '#6a7bff', '#ff9a1f', '#ffe9c2']
ink = glossy('#3b1608', 0.3, 0.6, name='ink')
hi = _mat('tile_hi', '#ffd23a', 0.2, 0.0, 0.8, '#ffb020', 1.2)
objs = []
for r in range(N):
    for c in range(N):
        x = (c - (N - 1) / 2) * pitch
        z = ((N - 1) / 2 - r) * pitch
        h = (r, c) in pair
        m = hi if h else glossy(palette[(r * 3 + c * 2 + r // 2) % len(palette)], 0.22, 0.8, name=f'tl{r}{c}')
        y = -0.3 if h else 0
        if h: objs.append(box((T + 0.34, 0.1, T + 0.34), _mat('halo', '#ff8a00', 0.5, 0.0, 0.0, '#ff7a00', 2.5), loc=(x, y + 0.1, z), bevel=0.3))
        objs.append(box((T, 0.4, T), m, loc=(x, y, z), bevel=0.2))
        objs.append(text(str(nums[r][c]), ink, size=0.66, extrude=0.06, loc=(x, y - 0.2 - 0.005, z), bevel=0.015))
slab = box((N * pitch + 0.4, 0.5, N * pitch + 0.4), glossy('#8c2a06', 0.3, 0.6, name='slab'), loc=(0, 0.45, 0), bevel=0.24)
objs.append(slab)
# link line between the two glowing tiles (centres)
def cen(r, c): return ((c - (N - 1) / 2) * pitch, ((N - 1) / 2 - r) * pitch)
(x1, z1), (x2, z2) = cen(0, 0), cen(2, 3)
import mathutils
a0 = mathutils.Vector((x1, -0.62, z1)); b0 = mathutils.Vector((x2, -0.62, z2))
u = (b0 - a0).normalized(); a = a0 + u * 0.5; b = b0 - u * 0.5
mid = (a + b) / 2; d = b - a
line = glossy('#ffffff', 0.1, 0.9, name='line')
lm = _mat('linemat', '#fff6c8', 0.2, 0.0, 0.0, '#ffd23a', 3.0)
cyl = cylinder(0.07, d.length, lm, loc=tuple(mid), bevel=0.0, seg=24, smooth=False)
cyl.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
objs.append(cyl)
for p in (a, b):
    objs.append(sphere(0.17, lm, loc=tuple(p)))
parent(objs, loc=(0, 0, 1.75), rot=(-4, 9, -5))
podium('#ffd23a', 3.4, 0.5, z=-0.35)
fit(0.82, 0.05)
render('numbers')
