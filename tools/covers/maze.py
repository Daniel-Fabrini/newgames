import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#3a4a66', '#06080f', samples=int(os.environ.get('S', 128)))
gold = glossy('#f0be3a', 0.25, 0.7, name='gold')
steel = metal('#cfd6df', 0.12, name='steel')
plate = glossy('#1b1e27', 0.3, 0.5, name='plate')
dark = _mat('hole', '#000000', 0.9, 0.0, 0.0)
glow = _mat('goal', '#fff1a8', 0.2, 0.0, 0.8, '#ffc93c', 3.0)
objs = [box((3.4, 3.4, 0.25), plate, loc=(0, 0, 0.0), bevel=0.1)]
# walls (a small hand-made maze)
T, H = 0.12, 0.34
def wall(x0, y0, x1, y1):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    objs.append(box((abs(x1 - x0) + T, abs(y1 - y0) + T, H), gold, loc=(cx, cy, 0.125 + H / 2), bevel=0.03))
for a in [(-1.6, -1.6, 1.6, -1.6), (-1.6, 1.6, 1.6, 1.6), (-1.6, -1.6, -1.6, 1.6), (1.6, -1.6, 1.6, 1.6),
          (-1.6, -0.6, 0.4, -0.6), (0.4, -0.6, 0.4, 0.6), (-0.6, 0.6, 1.6, 0.6), (-0.6, -1.6, -0.6, -0.6), (0.6, 1.6, 0.6, 0.6)]:
    wall(*a)
# holes
for (x, y) in [(1.0, -1.1), (-1.1, 0.1), (1.1, 0.0)]:
    objs.append(cylinder(0.26, 0.05, dark, loc=(x, y, 0.15), bevel=0.01))
    objs.append(torus(0.27, 0.035, gold, loc=(x, y, 0.16)))
objs.append(cylinder(0.3, 0.04, glow, loc=(-1.1, 1.1, 0.15), bevel=0.01))
objs.append(sphere(0.3, steel, loc=(1.1, -0.15, 0.4)))
g = parent(objs, rot=(62, 0, 14))
podium('#c9971c', 4.2, 0.5, z=-1.7)
fit(0.62, 0.55)
render('maze')
