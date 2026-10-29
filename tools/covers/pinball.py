import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#7a3cff', '#0b0620', samples=int(os.environ.get('S', 128)))
plate = glossy('#2a1763', 0.35, 0.6, name='plate')
rail = glossy('#f0be3a', 0.22, 0.7, name='rail')
pink = glossy('#ff3da8', 0.2, 0.8, name='pink')
cyan = glossy('#35e0ff', 0.2, 0.8, name='cyan')
steel = metal('#d9dfe8', 0.1, name='steel')
glow = _mat('glow', '#fff1a8', 0.2, 0.0, 0.8, '#ffc93c', 3.0)
objs = [box((3.2, 4.2, 0.25), plate, loc=(0, 0, 0), bevel=0.12)]
T, H = 0.14, 0.3
for (x, y, w, d) in [(-1.65, 0, T, 4.3), (1.65, 0, T, 4.3), (0, 2.15, 3.4, T), (0, -2.15, 3.4, T)]:
    objs.append(box((w, d, H), rail, loc=(x, y, 0.2), bevel=0.04))
for (x, y, m) in [(-0.7, 0.9, pink), (0.7, 0.9, cyan), (0, 0.1, pink)]:
    objs.append(cylinder(0.42, 0.22, rail, loc=(x, y, 0.2), bevel=0.04))
    objs.append(cylinder(0.32, 0.34, m, loc=(x, y, 0.3), bevel=0.06))
for sx in (-1, 1):
    objs.append(box((0.9, 0.2, 0.28), rail, loc=(sx * 0.62, -1.55, 0.2), rot=(0, 0, sx * -28), bevel=0.06))
objs.append(cylinder(0.22, 0.05, glow, loc=(0, 1.55, 0.14), bevel=0.01))
g = parent(objs, rot=(58, 0, 12))
sphere(0.42, steel, loc=(0.3, -1.9, 1.5))
podium('#c9971c', 4.2, 0.5, z=-1.9)
fit(0.62, 0.5)
render('pinball')
