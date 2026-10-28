import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from globe import globe_material
from mathutils import Vector, Quaternion
new_scene('#5fe0e8', '#0a6f9e', samples=int(os.environ.get('SAMPLES', 128)))
Z = 1.3
C = Vector((0, 0, Z))
R = 1.6
sphere(R, globe_material(ocean='#1d8fe0', land='#52c43a', land2='#38a03a', thresh=0.5, seed=7.0), loc=C)

def frame(d, dist, scale=1.0):
    e = bpy.data.objects.new('f', None)
    bpy.context.scene.collection.objects.link(e)
    d = Vector(d).normalized()
    e.rotation_mode = 'QUATERNION'
    e.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    e.location = C + d * dist
    e.scale = (scale,) * 3
    return e

# map pin (local +Z points away from globe)
red = glossy('#f0262c', 0.2, 0.8)
white = glossy('#ffffff', 0.3, 0.4)
pin = frame((0.18, -0.55, 0.8), R - 0.02, 1.15)
head = sphere(0.5, red, loc=(0, 0, 1.12))
cn = cone(0.4, 0.0, 1.1, red, loc=(0, 0, 0.55), rot=(180, 0, 0))
hole = sphere(0.2, white, loc=(0, 0, 1.12 - 0.0))
# push hole to the camera-facing side: slightly offset along local -Y is arbitrary; keep it at center top
hole.location = (0, 0, 1.12 + 0.36)
hole.scale = (1, 1, 0.35)
for o in (head, cn, hole):
    o.parent = pin
ring = torus(0.2, 0.05, white, loc=(0, 0, 0.02))
ring.scale = (1.3, 1.3, 0.5); ring.parent = pin

def flag(d, cols, vertical=True, s=1.0):
    f = frame(d, R - 0.03, s)
    pole = cylinder(0.04, 1.5, metal('#e8e8f0', 0.15), loc=(0, 0, 0.75), bevel=0.01, seg=24)
    ball = sphere(0.08, metal('#e8c040', 0.2), loc=(0, 0, 1.52))
    pole.parent = ball.parent = f
    n = len(cols)
    for i, c in enumerate(cols):
        w = 0.8 / n
        b = box((0.04, w, 0.5) if not vertical else (0.04, w, 0.5), glossy(c, 0.35, 0.3), loc=(0, 0.04 + w / 2 + i * w, 1.22), bevel=0.01)
        b.parent = f
    return f
flag((-0.8, -0.35, 0.55), ['#0b8a3a', '#ffffff', '#d0202e'], s=1.0)
flag((0.95, -0.2, 0.25), ['#f6d21f', '#1f4fb5', '#d0202e'], s=0.9)
shadow_catcher(0.0)
render('mapquiz')
