import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from props import *

new_scene('#3fd86a', '#07461f', samples=int(os.environ.get('S', 96)))
objs = []
PW, PD = 5.2, 3.4
# wooden table frame + stripes
frame = box((PW + 0.5, PD + 0.5, 0.5), glossy('#fff7e6', 0.35, 0.6, name='rim'), loc=(0, 0, 0.25), bevel=0.15)
objs.append(frame)
gA, gB = glossy('#2fb857', 0.6, 0.0, name='grassA'), glossy('#25a04a', 0.6, 0.0, name='grassB')
n = 8
for i in range(n):
    objs.append(box((PW / n, PD, 0.1), gA if i % 2 == 0 else gB, loc=(-PW / 2 + PW * (i + 0.5) / n, 0, 0.52), bevel=0.0))
line = matte('#f4fff6', 0.5, name='line')
objs.append(box((0.07, PD, 0.12), line, loc=(0, 0, 0.55), bevel=0.0))
objs.append(torus(0.8, 0.04, line, loc=(0, 0, 0.58)))
for sx in (-1, 1):   # goal mouths (flat) and boxes
    objs.append(box((0.9, 1.7, 0.12), line, loc=(sx * (PW / 2 - 0.45), 0, 0.55), bevel=0.0))
    objs.append(box((0.8, 1.6, 0.14), gA if sx < 0 else gB, loc=(sx * (PW / 2 - 0.45 + 0.0), 0, 0.553), bevel=0.0))
# goal on the right end, facing the field (small, white)
white = glossy('#ffffff', 0.25, 0.7, name='post')
gx = PW / 2 - 0.1
for sy in (-1, 1):
    objs.append(cylinder(0.06, 0.9, white, loc=(gx, sy * 0.75, 1.0), bevel=0.02, seg=24))
objs.append(cylinder(0.06, 1.5, white, loc=(gx, 0, 1.45), rot=(90, 0, 0), bevel=0.02, seg=24))
netm = matte('#ffffff', 0.5, name='net')
for j in range(1, 6):
    objs.append(cylinder(0.012, 0.9, netm, loc=(gx + 0.35, -0.75 + 1.5 * j / 6, 1.0), bevel=0, seg=8))
for j in range(1, 4):
    objs.append(cylinder(0.012, 1.5, netm, loc=(gx + 0.35, 0, 0.6 + 0.9 * j / 4), rot=(90, 0, 0), bevel=0, seg=8))
for sy in (-1, 1):
    objs.append(cylinder(0.05, 0.4, white, loc=(gx + 0.17, sy * 0.75, 1.45), rot=(0, 90, 0), bevel=0.01, seg=16))
slab = parent(objs, loc=(0, 0.8, 1.9), rot=(38, 0, -14))
# ball + flicked disc (world space, in front)
soccer_ball(1.0, loc=(-1.2, -2.0, 1.25), rot=(20, 10, 40))
red = glossy('#ff3b30', 0.2, 0.8, name='disc')
wh = glossy('#ffffff', 0.2, 0.8, name='discw')
def disc(loc, s=1.0, tilt=8):
    parts = [cylinder(0.62, 0.28, red, loc=(0, 0, 0), bevel=0.08, seg=64)]
    parts.append(torus(0.4, 0.05, wh, loc=(0, 0, 0.15)))
    parts.append(cylinder(0.2, 0.3, wh, loc=(0, 0, 0.01), bevel=0.04, seg=48))
    return parent(parts, loc=loc, rot=(tilt, 0, 15), scale=s)
disc((1.7, -2.0, 1.05), 1.25, 22)
podium('#1e8a42', 4.2, 0.35, z=-0.0) if False else None
fit(0.82, 0.0)
render('soccer')
