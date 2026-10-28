import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from globe import globe_material
from mathutils import Vector, Quaternion
new_scene('#5fe0e8', '#0a6f9e', samples=int(os.environ.get('SAMPLES', 128)))
Z = 1.55
C = Vector((0, 0, Z))
R = 1.4
sphere(R, globe_material(ocean='#1479d8', land='#52c43a', land2='#38a03a', thresh=0.5, seed=7.0), loc=C)

def frame(d, dist, scale=1.0, upright=False):
    e = bpy.data.objects.new('f', None)
    bpy.context.scene.collection.objects.link(e)
    d = Vector(d).normalized()
    e.rotation_mode = 'QUATERNION'
    if not upright:
        e.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    e.location = C + d * dist
    e.scale = (scale,) * 3
    return e

# map pin (local +Z points away from globe)
red = glossy('#d8121e', 0.2, 0.8)
white = glossy('#ffffff', 0.3, 0.4)
pin = frame((0.12, -0.3, 0.95), R - 0.02, 0.85)
head = sphere(0.5, red, loc=(0, 0, 1.12))
cn = cone(0.4, 0.0, 1.1, red, loc=(0, 0, 0.55), rot=(180, 0, 0))
hole = sphere(0.2, white, loc=(0, 0, 1.12 - 0.0))
# push hole to the camera-facing side: slightly offset along local -Y is arbitrary; keep it at center top
hole.location = (0, -0.42, 1.12)
hole.scale = (1, 0.3, 1)
for o in (head, cn, hole):
    o.parent = pin

def flag(d, cols, sgn=1, s=1.0):
    f = frame(d, R - 0.03, s, upright=True)
    pole = cylinder(0.04, 1.5, metal('#e8e8f0', 0.15), loc=(0, 0, 0.75), bevel=0.01, seg=24)
    ball = sphere(0.08, metal('#e8c040', 0.2), loc=(0, 0, 1.52))
    pole.parent = ball.parent = f
    n = len(cols)
    for i, c in enumerate(cols):
        w = 1.0 / n
        b = box((w, 0.04, 0.6), glossy(c, 0.35, 0.3), loc=(sgn * (0.04 + w / 2 + i * w), 0, 1.18), bevel=0.01)
        b.parent = f
    return f
flag((-0.9, -0.3, 0.1), ['#0b8a3a', '#ffffff', '#d0202e'], sgn=-1, s=0.8)
flag((0.85, -0.45, -0.15), ['#f6d21f', '#1f4fb5', '#d0202e'], sgn=1, s=0.7)
shadow_catcher(0.0)
render('mapquiz')
