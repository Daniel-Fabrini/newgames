import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#2fd0a8', '#04504a', samples=int(os.environ.get('S', 128)))
cardm = glossy('#fbfbf6', 0.25, 0.7, name='card')
redm = glossy('#d8182c', 0.25, 0.6, name='suit_red')
blkm = glossy('#17171f', 0.25, 0.6, name='suit_blk')
felt = _mat_felt = None
from rig import _mat
felt = _mat('felt', '#0a7a48', 0.95, 0.0, 0.0)
rimm = metal('#e8b830', 0.25, name='goldrim')
FY = 0.16   # suit thickness (flattened)

def suit(kind, s, cx, cz, m):
    """suit shape in the card plane (XZ), returns objects (local coords)."""
    o = []
    def sp(r, x, z, sy=0.22): return sphere(r * s, m, loc=(cx + x * s, -0.03, cz + z * s), scale=(1, sy, 1), seg=32)
    def sq(side, x, z, rot=45, sz=1.0):
        b = box((side * s, 0.07, side * s * sz), m, loc=(cx + x * s, -0.03, cz + z * s), bevel=0.01)
        b.rotation_euler = (0, math.radians(rot), 0)
        return b
    def stem(z, flip=1):
        c = cone(0.3 * s, 0.05 * s, 0.7 * s, m, loc=(cx, -0.03, cz + z * s), scale=(1, 0.2, 1), seg=24)
        return c
    if kind in ('heart', 'spade'):
        f = 1 if kind == 'heart' else -1
        o += [sq(1.0, 0, -0.1 * f), sp(0.5, -0.354, f * (0.354 - 0.1)), sp(0.5, 0.354, f * (0.354 - 0.1))]
        if kind == 'spade':
            o.append(stem(-0.85))
    elif kind == 'diamond':
        o.append(sq(1.0, 0, 0, 45, 1.45))
    elif kind == 'club':
        o += [sp(0.38, 0, 0.42), sp(0.38, -0.4, -0.12), sp(0.38, 0.4, -0.12), stem(-0.62)]
    return o

def card(rank, kind, big=1.0):
    col = redm if kind in ('heart', 'diamond') else blkm
    CW, CH = 1.5, 2.1
    o = [box((CW, 0.07, CH), cardm, loc=(0, 0, CH / 2), bevel=0.07)]
    o += suit(kind, 0.55 * big, 0, 1.05 - 0.1, col)
    o += suit(kind, 0.17, -0.5, 1.58, col)
    o.append(text(rank, col, size=0.36, extrude=0.03, loc=(-0.5, -0.05, 1.86), bevel=0.01))
    return o

# fan: back -> front
specs = [('J', 'club'), ('K', 'diamond'), ('A', 'spade'), ('Q', 'heart')]
specs = [('J', 'club'), ('K', 'diamond'), ('Q', 'heart'), ('A', 'spade')]
angs = [-40, -14, 12, 38]
for i, ((rk, kd), a) in enumerate(zip(specs, angs)):
    o = card(rk, kd, 1.0 if i == 3 else 1.0)
    parent(o, loc=(a * 0.03, 0.9 - i * 0.14, 0.05), rot=(-9, a, 0), scale=1.35)
# chips
def chip(x, y, z, col):
    o = [cylinder(0.5, 0.2, glossy(col, 0.25, 0.7, name='chip' + col), bevel=0.05, seg=48)]
    w = glossy('#ffffff', 0.3, 0.6, name='chipw')
    for k in range(8):
        a = k * math.pi / 4
        b = box((0.18, 0.16, 0.22), w, loc=(0.47 * math.cos(a), 0.47 * math.sin(a), 0), bevel=0.02)
        b.rotation_euler = (0, 0, a)
        o.append(b)
    o.append(torus(0.3, 0.025, w, loc=(0, 0, 0.1)))
    return parent(o, loc=(x, y, z))
for i in range(4):
    chip(2.0, -1.7, 0.1 + 0.2 * i + 0.0, '#e0222e')
chip(1.0, -2.45, 0.1, '#2a56e8')
chip(1.15, -2.6, 0.3, '#2a56e8')
# podium (felt) with gold rim
cylinder(3.4, 0.5, felt, loc=(0, 0, -0.25), bevel=0.1, seg=96)
torus(3.4, 0.09, rimm, loc=(0, 0, -0.0))
fit(0.72, -0.35)
render('solitaire')
