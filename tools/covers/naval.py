import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
S = int(os.environ.get('SAMPLES', 128))
new_scene('#1f8fd0', '#04122e', samples=S)
water = glossy('#0f5fb5', 0.12, 0.9); foam = glossy('#eaf6ff', 0.3, 0.3)
grey = glossy('#8d9bb0', 0.28, 0.6); dgrey = glossy('#5b677c', 0.3, 0.5)
red = glossy('#d63a3a', 0.25, 0.6); steel = metal('#2c3340', 0.25)
cy = emit('#35e6ff', 1.6); white = glossy('#f4f6fa', 0.3, 0.5); yel = glossy('#ffc22e', 0.3, 0.5)
objs = []
objs.append(cylinder(3.3, 0.9, water, (0, 0, -0.45), bevel=0.25))
objs.append(torus(3.0, 0.06, cy, (0, 0, 0.0)))
objs.append(torus(2.2, 0.05, cy, (0, 0, 0.0)))
objs.append(torus(1.4, 0.04, cy, (0, 0, 0.0)))
for a in (0, 90):
    objs.append(box((6.0 if a == 0 else 0.06, 0.06 if a == 0 else 6.0, 0.03), cy, (0, 0, 0.0), bevel=0.0))
def ship(x, y, ang, sc, hullc, big=True):
    p = []
    p.append(sphere(1, hullc, (0, 0, 0.1), scale=(2.3, 0.66, 0.5)))
    p.append(box((2.9, 0.78, 0.12), dgrey, (0, 0, 0.5), bevel=0.04))
    p.append(box((0.9, 0.62, 0.45), white, (-0.5, 0, 0.8), bevel=0.08))
    p.append(box((0.5, 0.5, 0.35), white, (-0.5, 0, 1.2), bevel=0.08))
    p.append(box((0.62, 0.55, 0.08), steel, (-0.5, 0, 1.43), bevel=0.02))
    p.append(cylinder(0.04, 0.5, steel, (-0.5, 0, 1.7), bevel=0.0))
    p.append(cylinder(0.13, 0.4, red, (-1.0, 0, 0.78), bevel=0.04))
    for tx in (0.9, 1.5):
        p.append(cylinder(0.3, 0.2, grey, (tx, 0, 0.62), bevel=0.05))
        p.append(cylinder(0.07, 0.8, steel, (tx + 0.5, 0.0, 0.68), rot=(0, 90, 0), bevel=0.0))
    p.append(box((3.2, 0.1, 0.12), red, (0, 0.62, 0.22), bevel=0.03))
    e = parent(p, loc=(x, y, 0), rot=(0, 0, ang), scale=sc)
    return e
objs.append(ship(-0.4, -0.9, -12, 1.25, grey))
objs.append(ship(0.9, 1.3, 6, 0.85, glossy('#a05c3a', 0.3, 0.5)))
# splash: foam spheres + droplets
import random; random.seed(3)
for i in range(14):
    a = random.uniform(0, 6.28); r = random.uniform(0.3, 0.7)
    objs.append(sphere(random.uniform(0.1, 0.25), foam, (-2.3 + math.cos(a)*r, -1.7 + math.sin(a)*r*0.6, random.uniform(0.1, 0.9))))
objs.append(torus(0.7, 0.12, foam, (-2.3, -1.7, 0.05)))
objs.append(cone(0.3, 0.05, 1.2, foam, (-2.3, -1.7, 0.6)))
parent(objs, loc=(0, 0, 0.8), rot=(24, 0, -8), scale=0.66)
render('naval')
