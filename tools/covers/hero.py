import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from props import *

new_scene('#2fd070', '#06411f', samples=int(os.environ.get('S', 96)))
# pitch disc with line + little goal
pit = glossy('#1f9b4a', 0.7, 0.0, name='pitch')
cylinder(3.3, 0.5, pit, loc=(0, 0.3, -0.25), bevel=0.12, seg=96)
torus(1.5, 0.045, matte('#eafff0', 0.4, name='line'), loc=(0, 0.3, 0.0), rot=(0, 0, 0))
white = glossy('#ffffff', 0.25, 0.7, name='post')
netm = matte('#ffffff', 0.5, name='net')
gx, gy, gw, gh, gd = -1.1, 1.7, 2.4, 1.3, 0.8
for sx in (-1, 1):
    cylinder(0.07, gh, white, loc=(gx + sx * gw / 2, gy, gh / 2), bevel=0.02, seg=24)
    cylinder(0.04, gd, white, loc=(gx + sx * gw / 2, gy + gd / 2, 0.02), rot=(90, 0, 0), bevel=0.01, seg=16)
    cylinder(0.04, gh, white, loc=(gx + sx * gw / 2, gy + gd, gh / 2), bevel=0.01, seg=16)
    cylinder(0.04, gd, white, loc=(gx + sx * gw / 2, gy + gd / 2, gh), rot=(90, 0, 0), bevel=0.01, seg=16)
cylinder(0.07, gw, white, loc=(gx, gy, gh), rot=(0, 90, 0), bevel=0.02, seg=24)
cylinder(0.04, gw, white, loc=(gx, gy + gd, gh), rot=(0, 90, 0), bevel=0.01, seg=16)
for i in range(1, 9):   # back net
    x = gx - gw / 2 + gw * i / 9
    cylinder(0.012, gh, netm, loc=(x, gy + gd, gh / 2), bevel=0, seg=8)
for j in range(1, 5):
    cylinder(0.012, gw, netm, loc=(gx, gy + gd, gh * j / 5), rot=(0, 90, 0), bevel=0, seg=8)
for i in range(1, 9):   # top net
    x = gx - gw / 2 + gw * i / 9
    cylinder(0.012, gd, netm, loc=(x, gy + gd / 2, gh), rot=(90, 0, 0), bevel=0, seg=8)
# ball + trail
B = Vector((-0.1, -1.2, 2.3))
C = Vector((2.0, -1.3, 1.9))
E = Vector((3.2, -1.0, 3.7))
soccer_ball(1.0, loc=tuple(B), rot=(25, 20, -35))
def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))
def fcol(t):
    c = lerp((1.0, 0.86, 0.2), (0.96, 0.2, 0.04), min(1, t * 1.15))
    return '#%02x%02x%02x' % tuple(int(v * 255) for v in c)
n = 44
for i in range(n):
    t = 0.12 + 0.88 * (i + 1) / (n + 1)
    p = (1 - t) ** 2 * B + 2 * (1 - t) * t * C + t ** 2 * E
    r = 0.95 * ((1 - t) / 0.88) ** 0.85 + 0.06
    sphere(r, flame(fcol(t), 1.05 - 0.3 * t, f'tr{i}'), loc=tuple(p + Vector((0, 0.75 + 0.3 * t, 0))), seg=32)
# sparks
import random
random.seed(4)
for i in range(9):
    t = random.uniform(0.15, 1.0)
    p = (1 - t) ** 2 * B + 2 * (1 - t) * t * C + t ** 2 * E
    sphere(random.uniform(0.05, 0.11), flame(fcol(0.1), 1.2, 'sp'), loc=tuple(p + Vector((random.uniform(-.6, .6), -0.2, random.uniform(-.6, .6)))), seg=16)
fit(0.84, 0.0, -0.1)
render('hero')
