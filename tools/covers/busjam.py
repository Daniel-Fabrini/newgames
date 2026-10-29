import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from mathutils import Vector
new_scene('#7fd6ff', '#1470c8', samples=int(os.environ.get('SAMPLES', 128)), key_energy=480)

import rig
yellow = rig._mat('yel', '#ffbe00', 0.3, 0.0, 0.2)
orange = glossy('#ff7a1a', 0.2, 0.8, 'or')
glass = glossy('#1d3f8f', 0.05, 1.0, 'glass')
black = glossy('#1a1d24', 0.35, 0.4, 'blk')
grey = glossy('#c9d2e0', 0.25, 0.6, 'grey')
white = glossy('#ffffff', 0.2, 0.8, 'wh')

def ell(r, sc, mat, loc):
    o = sphere(r, mat, loc=loc, seg=32)
    o.scale = sc
    return o

# diorama base
cylinder(2.7, 0.3, glossy('#f2fbff', 0.35, 0.6, 'base'), loc=(-0.1, -0.1, -0.15), bevel=0.12, seg=96)
cylinder(2.45, 0.06, glossy('#3d4a63', 0.5, 0.2, 'road'), loc=(-0.1, -0.1, 0.02), bevel=0.0, seg=96)

parts = []
def add(o):
    parts.append(o)
    return o
add(box((3.4, 1.55, 1.45), yellow, loc=(0, 0, 1.2), bevel=0.28))
add(box((3.44, 1.58, 0.16), orange, loc=(0, 0, 0.85), bevel=0.04))
add(box((3.0, 1.1, 0.14), white, loc=(-0.1, 0, 1.97), bevel=0.06))
add(box((0.12, 1.2, 0.62), glass, loc=(1.69, 0, 1.5), bevel=0.05))
for s in (-1, 1):
    for i in range(4):
        add(box((0.58, 0.05, 0.5), glass, loc=(-1.05 + i * 0.7, s * 0.78, 1.5), bevel=0.05))
    for x in (-0.95, 0.95):
        add(cylinder(0.42, 0.3, black, loc=(x, s * 0.7, 0.42), rot=(90, 0, 0), bevel=0.06))
        add(cylinder(0.2, 0.34, grey, loc=(x, s * 0.7, 0.42), rot=(90, 0, 0), bevel=0.04))
    add(ell(0.17, (0.5, 1, 1), white, (1.7, s * 0.5, 0.95)))
add(box((0.18, 1.6, 0.22), grey, loc=(1.72, 0, 0.55), bevel=0.07))
add(box((0.56, 0.05, 0.9), glass, loc=(0.35, -0.78, 1.15), bevel=0.05))  # door
parent(parts, loc=(0.2, 0.2, 0.0), rot=(0, 0, -32), scale=1.05)

cols = ['#ff3b4a', '#2fd16a', '#a24dff', '#ff8a1f']
pos = [(-0.6, -1.0), (-1.2, -0.75), (-1.75, -0.45), (-2.25, -0.15)]
for (x, y), c, i in zip(pos, cols, range(4)):
    s = 1.2 - i * 0.05
    m = glossy(c, 0.2, 0.9, f'p{i}')
    ell(0.4 * s, (1, 1, 1.12), m, (x, y, 0.5 * s))
    for e in (-1, 1):
        ell(0.12 * s, (1, 0.5, 1.2), white, (x + e * 0.15 * s, y - 0.34 * s, 0.62 * s))
        ell(0.065 * s, (1, 0.5, 1.2), black, (x + e * 0.15 * s, y - 0.4 * s, 0.62 * s))
for o in bpy.data.objects:
    if o.parent is None and o.type in ('MESH', 'EMPTY'):
        o.location.z += 1.1
shadow_catcher(0.85)
render('busjam')
