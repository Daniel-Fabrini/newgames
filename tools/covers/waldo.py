import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
import rig
from mathutils import Vector
new_scene('#b57cff', '#2d0f70', samples=int(os.environ.get('SAMPLES', 128)), key_energy=700)

skin = glossy('#ffc29a', 0.35, 0.3, 'skin')
hair = glossy('#ff5a14', 0.3, 0.6, 'hair')
coat = glossy('#c8884a', 0.4, 0.4, 'coat')
coat2 = glossy('#a86a34', 0.4, 0.4, 'coat2')
hat = glossy('#7a4524', 0.35, 0.5, 'hat')
band = glossy('#e0323a', 0.3, 0.6, 'band')
white = glossy('#ffffff', 0.15, 0.9, 'white')
black = glossy('#14161c', 0.1, 0.9, 'black')
gold = metal('#f2b829', 0.2, 'gold')
shirt = glossy('#fff4e6', 0.4, 0.3, 'shirt')
cheek = glossy('#ff8a8a', 0.4, 0.2, 'cheek')
brown = glossy('#4a2a14', 0.35, 0.5, 'handle')
glass = rig._mat('glass', '#d8f4ff', 0.03, 0.0, 0.0)
b = glass.node_tree.nodes['Principled BSDF']
b.inputs['Transmission Weight'].default_value = 0.92
b.inputs['IOR'].default_value = 1.1

def ell(r, sc, mat, loc, rot=(0, 0, 0)):
    o = sphere(r, mat, loc=loc, rot=rot, seg=48)
    o.scale = sc
    return o

def rod(a, bb, rad, mat):
    a, bb = Vector(a), Vector(bb)
    d = bb - a
    o = cylinder(rad, d.length, mat, loc=(a + bb) / 2, bevel=0.02, seg=32)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o

# body: trench coat
ell(1, (1.55, 1.0, 1.25), coat, (0, 0.1, 0.55))
ell(1, (0.55, 0.35, 0.75), shirt, (0, -0.8, 1.3))
# lapels
for s in (-1, 1):
    ell(1, (0.38, 0.22, 0.8), coat2, (s * 0.55, -0.82, 1.2), rot=(0, s * 22, s * -8))
# tie
ell(1, (0.17, 0.12, 0.5), band, (0, -0.95, 1.0))
ell(1, (0.22, 0.14, 0.15), band, (0, -0.97, 1.5))
# head
ell(1.15, (1.0, 0.95, 1.02), skin, (0, 0, 2.75))
# ears
for s in (-1, 1):
    ell(0.22, (0.6, 0.8, 1), skin, (s * 1.12, 0.0, 2.65))
# hair
for s in (-1, 1):
    ell(0.5, (0.9, 0.9, 1.0), hair, (s * 0.95, 0.15, 3.0))
    ell(0.34, (1, 0.9, 1.1), hair, (s * 1.08, -0.1, 2.65))
ell(0.9, (1.0, 0.8, 0.5), hair, (0, 0.35, 3.25))
# eyes (behind glasses)
for s in (-1, 1):
    ell(0.27, (1, 0.5, 1.05), white, (s * 0.46, -1.0, 2.82))
    ell(0.14, (1, 0.5, 1.1), black, (s * 0.46 + s * -0.02, -1.14, 2.82))
    ell(0.05, (1, 0.5, 1), white, (s * 0.46 + 0.04, -1.2, 2.89))
    ell(0.2, (1.3, 0.4, 0.8), cheek, (s * 0.78, -0.95, 2.3))
    # eyebrows raised
    ell(0.2, (1.3, 0.35, 0.28), hair, (s * 0.5, -0.98, 3.28), rot=(0, s * 12, 0))
# glasses
for s in (-1, 1):
    torus(0.38, 0.055, gold, loc=(s * 0.46, -1.06, 2.82), rot=(90, 0, 0))
rod((-0.1, -1.08, 2.85), (0.1, -1.08, 2.85), 0.03, gold)
# nose + smile
ell(0.16, (1, 0.9, 0.9), glossy('#ffa882', 0.3, 0.4, 'nose'), (0, -1.12, 2.55))
ell(0.28, (1.2, 0.3, 0.17), black, (0, -1.04, 2.1))
ell(0.3, (1.35, 0.4, 0.18), skin, (0, -1.08, 2.19))
# fedora
cone(0.98, 0.78, 0.8, hat, loc=(0, 0.05, 3.9))
cylinder(0.99, 0.18, band, loc=(0, 0.05, 3.62), bevel=0.04, seg=64)
brim = cylinder(1.75, 0.12, hat, loc=(0, -0.05, 3.5), rot=(-4, 0, 0), bevel=0.05, seg=64)
ell(0.35, (1.4, 1.1, 0.4), hat, (0, 0.05, 4.32))  # soft top dent
# magnifier
lens_c = (1.75, -1.7, 2.1)
torus(0.95, 0.14, gold, loc=lens_c, rot=(90, 0, 0))
cylinder(0.93, 0.05, glass, loc=lens_c, rot=(90, 0, 0), bevel=0.0, seg=64)
rod((lens_c[0] + 0.62, lens_c[1], lens_c[2] - 0.72), (2.55, -1.7, 0.75), 0.16, brown)
ell(0.2, (1, 1, 1), gold, (lens_c[0] + 0.75, -1.7, lens_c[2] - 0.87))
ell(0.34, (1, 0.9, 0.9), skin, (2.62, -1.78, 0.7))
for i, (dx, dz) in enumerate([(-0.12, 0.18), (0.0, 0.26), (0.12, 0.2)]):
    ell(0.12, (1, 1, 1.2), skin, (2.62 + dx * 1.3, -1.98, 0.7 + dz))
# glint on lens
ell(0.1, (0.5, 0.2, 2.2), white, (lens_c[0] - 0.45, -1.78, lens_c[2] + 0.3), rot=(0, 35, 0))
for o in bpy.data.objects:
    if o.parent is None and o.type in ('MESH', 'EMPTY'):
        o.location.z += 0.1
shadow_catcher(0.0)
render('waldo')
