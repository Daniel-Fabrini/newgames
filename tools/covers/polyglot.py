import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from mathutils import Vector
new_scene('#46e0b0', '#0a5f66', samples=int(os.environ.get('SAMPLES', 128)))

green = glossy('#27c93f', 0.25, 0.7, 'green')
belly = glossy('#c4f255', 0.3, 0.5, 'belly')
wing = glossy('#12a56a', 0.25, 0.7, 'wing')
teal = glossy('#1583c4', 0.25, 0.7, 'tail')
orange = glossy('#ff7a1a', 0.2, 0.8, 'orange')
yellow = glossy('#ffc21a', 0.25, 0.7, 'yellow')
white = glossy('#ffffff', 0.15, 0.9, 'white')
black = glossy('#12151a', 0.1, 0.9, 'black')
dark = glossy('#2a2f3c', 0.3, 0.6, 'dark')

def ell(r, sc, mat, loc, rot=(0, 0, 0)):
    o = sphere(r, mat, loc=loc, rot=rot)
    o.scale = sc
    return o

def rod(a, b, rad, mat):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cylinder(rad, d.length, mat, loc=(a + b) / 2, bevel=0.0, seg=24)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o

# pedestal
cylinder(1.75, 0.5, glossy('#0f8f95', 0.3, 0.6, 'ped'), loc=(0, 0.1, -0.25), bevel=0.12)
# tail feathers (behind)
for i, (x, rz, m) in enumerate([(-0.35, -14, teal), (0.0, 0, green), (0.35, 14, teal)]):
    ell(1, (0.28, 0.16, 1.15), m, (x * 1.3, 0.9, 0.05), rot=(-18, 0, rz))
# body
ell(1, (1.0, 0.9, 1.2), green, (0, 0.05, 1.0))
ell(1, (0.74, 0.55, 1.0), belly, (0, -0.42, 0.95))
# wings
ell(1, (0.3, 0.55, 0.95), wing, (-0.98, 0.0, 1.1), rot=(0, -8, 8))
ell(1, (0.3, 0.55, 0.95), wing, (0.98, 0.0, 1.1), rot=(0, 8, -8))
# feet
for x in (-0.38, 0.38):
    ell(1, (0.3, 0.38, 0.14), orange, (x, -0.62, 0.0))
# head
ell(1, (1.0, 0.95, 0.95), green, (0, 0, 2.5))
# crest
for x, rz, h in [(-0.22, 22, 0.5), (0.0, 0, 0.62), (0.22, -22, 0.5)]:
    ell(1, (0.14, 0.12, h), yellow if x == 0 else belly, (x * 1.1, 0.0, 3.35), rot=(0, -rz, 0))
# face patch + eyes
ell(1, (0.8, 0.3, 0.55), belly, (0, -0.72, 2.45))
for x in (-0.38, 0.38):
    ell(0.3, (1, 0.55, 1.05), white, (x, -0.82, 2.62))
    ell(0.17, (1, 0.6, 1.1), black, (x * 0.93, -0.96, 2.62))
    ell(0.06, (1, 0.6, 1), white, (x * 0.93 + 0.05, -1.04, 2.7))
# cheeks
for x in (-0.68, 0.68):
    ell(0.15, (1.2, 0.4, 0.8), glossy('#ff6a7a', 0.3, 0.3, 'cheek'), (x, -0.72, 2.2))
# beak
ell(1, (0.36, 0.46, 0.38), yellow, (0, -0.98, 2.3), rot=(-25, 0, 0))
ell(1, (0.27, 0.32, 0.17), orange, (0, -0.96, 2.02))
# headphones
tor = torus(1.12, 0.09, orange, loc=(0, 0.02, 2.5), rot=(90, 0, 0))
for s in (-1, 1):
    cylinder(0.46, 0.34, orange, loc=(s * 1.06, 0.0, 2.38), rot=(0, 90, 0), bevel=0.1)
    cylinder(0.33, 0.1, dark, loc=(s * 1.26, 0.0, 2.38), rot=(0, 90, 0), bevel=0.04)
# mic boom
rod((-1.22, -0.1, 2.3), (-0.9, -0.95, 1.85), 0.045, dark)
ell(0.11, (1, 1, 1), dark, (-0.88, -0.98, 1.83))

def bubble(x, z, w, h, mat, side, dots=True, dotmat=None):
    box((w, 0.34, h), mat, loc=(x, -0.5, z), bevel=0.28)
    # tail toward the parrot
    t = cone(0.26, 0.0, 0.5, mat, loc=(x - side * w * 0.28, -0.5, z - h / 2 - 0.12), rot=(0, 0, 0))
    t.scale = (1, 0.55, 1)
    t.rotation_euler = (0, math.radians(180), 0)
    if dots:
        for i in (-1, 0, 1):
            sphere(0.12, dotmat, loc=(x + i * 0.38, -0.7, z), seg=24)
    else:
        for j, ww in enumerate((1.0, 0.7)):
            box((ww * w * 0.62, 0.1, 0.13), dotmat, loc=(x - (1 - ww) * w * 0.31, -0.72, z + 0.17 - j * 0.34), bevel=0.05)
bubble(-1.8, 3.6, 1.45, 0.95, white, -1, True, glossy('#1583c4', 0.3, 0.5, 'd1'))
bubble(1.95, 2.75, 1.5, 1.0, glossy('#ffd23a', 0.25, 0.6, 'bub2'), 1, False, glossy('#e0561a', 0.3, 0.5, 'd2'))
shadow_catcher(-0.02)
render('polyglot')
