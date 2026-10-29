import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat
import bpy
from mathutils import Vector

new_scene('#46c6c0', '#06303a', samples=int(os.environ.get('S', 128)))
green = glossy('#7bd65a', 0.18, 0.8, name='goo_green')
blue = glossy('#58b8ff', 0.15, 0.85, name='goo_blue')
purple = glossy('#a98cf0', 0.25, 0.7, name='goo_purple')
amber = glossy('#ffc43d', 0.18, 0.8, name='goo_amber')
rod = glossy('#2b2236', 0.2, 0.6, name='rod')
white = glossy('#ffffff', 0.1, 0.9, name='eye_white')
black = glossy('#1b1426', 0.1, 0.9, name='eye_black')
objs = []


def ball(p, r, mat, look=(0.15, 0.0)):
    x, y, z = p
    objs.append(sphere(r, mat, loc=(x, y, z), seg=64))
    for s in (-1, 1):
        ex, ez = x + s * r * 0.38, z + r * 0.18
        e = sphere(r * 0.27, white, loc=(ex, y - r * 0.82, ez), seg=32)
        e.scale = (1.0, 0.45, 1.15)
        objs.append(e)
        objs.append(sphere(r * 0.13, black, loc=(ex + look[0] * r * 0.1, y - r * 1.0, ez - r * 0.02), seg=24))


def link(a, b, rr=0.075):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cylinder(rr, d.length, rod, loc=tuple((a + b) / 2), bevel=0.0, seg=24)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    objs.append(o)


R = 0.62
nodes = {
    'a': (-2.0, 0, 0.62), 'b': (0.0, 0, 0.62), 'c': (2.0, 0, 0.62),
    'd': (-1.0, 0, 2.0), 'e': (1.0, 0, 2.0),
    'f': (0.0, 0, 3.4),
}
for u, v in [('a', 'b'), ('b', 'c'), ('a', 'd'), ('b', 'd'), ('b', 'e'), ('c', 'e'), ('d', 'e'), ('d', 'f'), ('e', 'f')]:
    link(nodes[u], nodes[v])
for k, p in nodes.items():
    if k == 'c':
        ball(p, R, purple, look=(0.6, 0))
    elif k == 'f':
        ball(p, R, amber, look=(0.0, 0))
    else:
        ball(p, R, green, look=(0.3 if k in 'ad' else -0.3, 0))
# balloon floating above, tied to the top with a thin string
bp = (0.0, 0, 5.5)
link((0.0, 0, 3.9), (0.0, 0, 4.9), rr=0.03)
objs.append(sphere(0.78, blue, loc=bp, seg=64))
k = cone(0.17, 0.0, 0.3, blue, loc=(0.0, 0, 4.72), rot=(180, 0, 0))
objs.append(k)
for s in (-1, 1):
    ex = s * 0.3
    e = sphere(0.2, white, loc=(ex, -0.64, 5.62), seg=32)
    e.scale = (1.0, 0.45, 1.15)
    objs.append(e)
    objs.append(sphere(0.1, black, loc=(ex, -0.78, 5.6), seg=24))
g = parent(objs, rot=(0, 0, 0))
podium('#e0a526', 3.8, 0.5, z=0.0)
fit(0.5, 0.55)
render('goo')
