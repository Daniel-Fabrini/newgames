import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
S = int(os.environ.get('SAMPLES', 128))
new_scene('#56c0ff', '#0b2d86', samples=S)
tbl = glossy('#1650d0', 0.15, 0.8); white = glossy('#ffffff', 0.3, 0.4); red = glossy('#e8262c', 0.3, 0.6)
wood = glossy('#d9a15a', 0.35, 0.4); orange = glossy('#ff8a1a', 0.2, 0.7); dark = glossy('#1a2540', 0.4, 0.3)
net = glossy('#f2f5fa', 0.5, 0.2); glow = emit('#ffd36a', 2.0)
objs = []
objs.append(box((5.2, 3.1, 0.3), tbl, (0, 0, 1.1), bevel=0.1))
objs.append(box((5.2, 0.06, 0.02), white, (0, -1.4, 1.26), bevel=0))
objs.append(box((5.2, 0.06, 0.02), white, (0, 1.4, 1.26), bevel=0))
objs.append(box((0.06, 3.1, 0.02), white, (-2.5, 0, 1.26), bevel=0))
objs.append(box((0.06, 3.1, 0.02), white, (2.5, 0, 1.26), bevel=0))
for sx in (-2.3, 2.3):
    for sy in (-1.2, 1.2):
        objs.append(box((0.3, 0.3, 1.0), dark, (sx, sy, 0.5), bevel=0.05))
# net
objs.append(box((0.08, 3.3, 0.6), net, (0, 0, 1.55), bevel=0.02))
objs.append(box((0.1, 3.3, 0.1), white, (0, 0, 1.88), bevel=0.04))
for sy in (-1.65, 1.65):
    objs.append(cylinder(0.07, 0.8, dark, (0, sy, 1.55), bevel=0.02))
# paddle
p = [cylinder(0.85, 0.16, red, (0, 0, 0), rot=(90, 0, 0), bevel=0.05, seg=96),
     cylinder(0.72, 0.19, glossy('#c4151b', 0.5, 0.2), (0, 0, 0), rot=(90, 0, 0), bevel=0.02, seg=96),
     box((0.22, 0.2, 0.9), wood, (0, 0, -1.1), bevel=0.08),
     cylinder(0.14, 0.24, red, (0, 0, -1.55), rot=(90, 0, 0), bevel=0.04)]
p[1].location.y = 0
objs.append(parent(p, loc=(-1.5, -0.9, 3.5), rot=(0, -28, -30), scale=1.75))
BX, BY, BZ = 1.5, -0.9, 3.9
objs.append(sphere(0.6, orange, (BX, BY, BZ)))
for dx, dz, r in [(-0.85, -0.2, 0.42), (-1.4, -0.35, 0.28), (-1.8, -0.45, 0.17)]:
    objs.append(sphere(r, glossy('#ffc067', 0.3, 0.3), (BX + dx, BY, BZ + dz)))
# shadow ring
objs.append(torus(0.5, 0.03, glow, (BX, BY, 1.27)))
parent(objs, loc=(0, 0, -0.2), rot=(22, 0, -14), scale=0.72)
render('pingpong')
