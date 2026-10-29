import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#ffb24f', '#4a1a06', samples=int(os.environ.get('S', 96)))
objs = []
PW, PD = 5.4, 3.4
wood = glossy('#b06a2a', 0.35, 0.6, name='wood')
objs.append(box((PW + 0.7, PD + 0.7, 0.6), wood, loc=(0, 0, 0.3), bevel=0.18))
gA, gB = glossy('#2fb857', 0.6, 0.0, name='grassA'), glossy('#25a04a', 0.6, 0.0, name='grassB')
n = 9
for i in range(n):
    objs.append(box((PW / n, PD, 0.1), gA if i % 2 == 0 else gB, loc=(-PW / 2 + PW * (i + 0.5) / n, 0, 0.62), bevel=0.0))
line = matte('#f4fff6', 0.5, name='line')
objs.append(box((0.07, PD, 0.12), line, loc=(0, 0, 0.66), bevel=0.0))
objs.append(torus(0.75, 0.04, line, loc=(0, 0, 0.68)))
dark = matte('#0c1117', 0.8, name='goaldark')
for sx in (-1, 1):
    objs.append(box((0.5, 1.5, 0.16), dark, loc=(sx * (PW / 2 + 0.05), 0, 0.68), bevel=0.04))
    objs.append(box((0.9, 1.9, 0.12), line, loc=(sx * (PW / 2 - 0.45), 0, 0.66), bevel=0.0))
    objs.append(box((0.8, 1.8, 0.14), gA if sx < 0 else gB, loc=(sx * (PW / 2 - 0.45), 0, 0.665), bevel=0.0))
steel = metal('#dfe5ec', 0.1, name='rodsteel')
rubber = glossy('#15161a', 0.6, 0.2, name='grip')
red = glossy('#ff3b30', 0.2, 0.8, name='kitred')
blue = glossy('#2f7cff', 0.2, 0.8, name='kitblue')
skin = glossy('#ffd2a8', 0.35, 0.4, name='skin')
def rod(x, kit, ys):
    z = 1.5
    objs.append(cylinder(0.055, PD + 1.9, steel, loc=(x, 0, z), rot=(90, 0, 0), bevel=0.0, seg=24))
    sgn = 1 if kit is red else -1
    objs.append(cylinder(0.14, 0.7, rubber, loc=(x, sgn * (PD / 2 + 1.25), z), rot=(90, 0, 0), bevel=0.04, seg=32))
    for y in ys:
        objs.append(box((0.3, 0.34, 0.62), kit, loc=(x, y, z - 0.46), bevel=0.07))
        objs.append(box((0.34, 0.4, 0.2), glossy('#1a1d24', 0.4, 0.4, name='shoe'), loc=(x, y, 0.85), bevel=0.05))
        objs.append(sphere(0.2, skin, loc=(x, y, z + 0.02)))
rod(-2.0, blue, [0.0])
rod(-0.8, red, [-1.0, 0.0, 1.0])
rod(0.5, blue, [-1.0, 0.0, 1.0])
rod(1.8, red, [-0.4, 0.4])
slab = parent(objs, loc=(0, 0.5, 2.0), rot=(46, 0, -16))
soccer_ball(1.0, loc=(-0.3, -2.5, 1.0), rot=(20, 10, 40))

fit(0.78, -0.35)
render('foosball')
