import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#e0303c', '#3a0610', samples=int(os.environ.get('S', 96)))
N, T = 4, 1.0
dark = glossy('#1b1417', 0.3, 0.6, name='dk')
light = glossy('#f3e6cf', 0.3, 0.5, name='lt')
red = glossy('#e3202e', 0.18, 0.9, name='red')
white = glossy('#fbf6ee', 0.18, 0.9, name='wh')
gold = metal('#ffc933', 0.2, name='gold')
objs = []
for r in range(N):
    for c in range(N):
        objs.append(box((T, T, 0.3), dark if (r + c) % 2 else light, loc=((c - 1.5) * T, (r - 1.5) * T, 0.15), bevel=0.04))
objs.append(box((N * T + 0.4, N * T + 0.4, 0.35), glossy('#7a1520', 0.3, 0.6, name='frame'), loc=(0, 0, -0.1), bevel=0.15))

def disc(x, y, z, mat, rim, k=1.0):
    objs.append(cylinder(0.4 * k, 0.2, mat, (x, y, z + 0.1), bevel=0.07))
    objs.append(torus(0.25 * k, 0.035, rim, (x, y, z + 0.2)))
# squares on dark cells: (r+c) odd. positions
def cell(r, c): return ((c - 1.5) * T, (r - 1.5) * T)
# king stack of 3 red + crown
x, y = cell(1, 2)
for i in range(3):
    disc(x, y, 0.3 + i * 0.22, red, glossy('#ff6a6a', 0.2, 0.9, name='rr'), 1.2)
zt = 0.3 + 3 * 0.22
objs.append(cylinder(0.36, 0.2, gold, (x, y, zt + 0.1), bevel=0.04))
for k in range(5):
    a = k * 2 * math.pi / 5
    objs.append(cone(0.1, 0.0, 0.45, gold, (x + 0.3 * math.cos(a), y + 0.3 * math.sin(a), zt + 0.4)))
    objs.append(sphere(0.065, glossy('#ff2a4a', 0.1, 1, name='jw'), (x + 0.3 * math.cos(a), y + 0.3 * math.sin(a), zt + 0.66)))
# other discs
for (r, c, m, rim) in [(0, 1, white, 'w'), (0, 3, white, 'w'), (1, 0, red, 'r'), (2, 3, red, 'r'), (3, 0, white, 'w'), (2, 1, white, 'w')]:
    x2, y2 = cell(r, c)
    disc(x2, y2, 0.3, m, glossy('#ffd0d0', 0.2, 0.9, name='rw') if rim == 'w' else glossy('#ff6a6a', 0.2, 0.9, name='rr'))
# a white disc stacked & a loose one in front leaning
x2, y2 = cell(0, 1); disc(x2, y2, 0.52, white, glossy('#ffd0d0', 0.2, 0.9, name='rw'))
parent(objs, loc=(0, 0, 0.55), rot=(38, 0, -14))
podium('#1d1216', 3.2, 0.5, z=-0.5)
fit(0.8, 0.3)
render('checkers')
