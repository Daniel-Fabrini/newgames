import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#b46bff', '#2c0a78', samples=int(os.environ.get('S', 128)))
R, HT = 0.5, 3.0
glass = glass_material((0.92, 0.96, 1.0), 1.06, 'tube')
cols = {'O': '#ff8a1f', 'C': '#22d3ee', 'K': '#ff4fa0', 'G': '#4cd964', 'Y': '#ffd21f', 'B': '#3a6bff'}
lm = {k: glossy(v, 0.1, 0.9, name='liq_' + k) for k, v in cols.items()}
rim = glossy('#ffffff', 0.15, 0.9, name='rim')

def tube(layers, h_unit=0.55):
    """local: bottom on z=0, axis +z. layers bottom->top letters."""
    o = []
    o.append(sphere(R, glass, loc=(0, 0, R)))
    o.append(cylinder(R, HT - R, glass, loc=(0, 0, R + (HT - R) / 2), bevel=0.0, smooth=False, seg=96))
    o.append(torus(R, 0.07, rim, loc=(0, 0, HT)))
    z = R
    r = R - 0.07
    for i, ch in enumerate(layers):
        if i == 0:
            o.append(sphere(r, lm[ch], loc=(0, 0, R), scale=(1, 1, 1)))
            h = h_unit * 0.9
            o.append(cylinder(r, h, lm[ch], loc=(0, 0, R + h / 2), bevel=0.0, smooth=False, seg=96))
            z = R + h
        else:
            o.append(cylinder(r, h_unit, lm[ch], loc=(0, 0, z + h_unit / 2), bevel=0.0, smooth=False, seg=96))
            z += h_unit
    return o, z

xs = [-2.5, -1.3, -0.1]
sets = ['OCKG', 'KGOC', 'CK']
tops = []
for x, s in zip(xs, sets):
    o, top = tube(s)
    parent(o, loc=(x, 0, 0))
    tops.append(top)
# pouring tube: tilted, mouth above third tube
ang = -112
d = (math.sin(math.radians(ang)), 0, math.cos(math.radians(ang)))
mouth = (0.05, 0.0, 4.15)
base = (mouth[0] - d[0] * HT, 0, mouth[2] - d[2] * HT)
o, _ = tube('GO', 0.5)
parent(o, loc=base, rot=(0, ang, 0))
# stream from mouth down to liquid surface of tube 3
sz = tops[2]
sx = -0.1
cyl = cylinder(0.07, mouth[2] - sz - 0.05, lm['O'], loc=(sx, 0, (mouth[2] - 0.1 + sz) / 2), bevel=0.0, seg=24, smooth=False)
sphere(0.16, lm['O'], loc=(sx, 0, sz + 0.06), scale=(1.5, 1.5, 0.45))
# fourth standing tube at far right
o, _ = tube('BYG')
parent(o, loc=(1.35, 0, 0))
podium('#7a2fe0', 3.5, 0.5, z=-0.0)
fit(0.78, -0.5)
render('water')
