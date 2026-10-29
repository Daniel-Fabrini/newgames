import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

# Five Dice cover: five glossy dice mid-tumble over a dark podium, every die showing an ace
# (blue accent pip), one onyx die in the middle, deep navy backdrop with a blue accent light.
new_scene('#1b3d9a', '#030615', samples=int(os.environ.get('S', 128)), key_energy=1100)

ivory = glossy('#fbf3dc', 0.2, 0.8, name='iv')
onyx = glossy('#0c0f1c', 0.14, 1.0, name='onyx')
pip = glossy('#101a36', 0.25, 0.8, name='pip')
pip_w = glossy('#f4f1e6', 0.25, 0.8, name='pipw')
ace = _mat('ace', '#2d6df0', 0.2, 0.0, 0.9, emit='#2d6df0', emit_strength=0.7)

PIPS = {1: [(0, 0)], 2: [(-1, 1), (1, -1)], 3: [(-1, 1), (0, 0), (1, -1)], 4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
        5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
# face: (normal, u axis, w axis, value). -Y faces the camera and is the ace.
FACES = [((0, -1, 0), (-1, 0, 0), (0, 0, 1), 1), ((0, 1, 0), (1, 0, 0), (0, 0, 1), 6),
         ((0, 0, 1), (1, 0, 0), (0, 1, 0), 2), ((0, 0, -1), (1, 0, 0), (0, -1, 0), 5),
         ((1, 0, 0), (0, 1, 0), (0, 0, 1), 3), ((-1, 0, 0), (0, -1, 0), (0, 0, 1), 4)]


def die(s, loc, rot, body, pipmat):
    h = s / 2
    parts = [box((s, s, s), body, bevel=s * 0.11)]
    for n, u, w, v in FACES:
        n, u, w = Vector(n), Vector(u), Vector(w)
        for (a, b) in PIPS[v]:
            p = n * (h - s * 0.012) + u * a * s * 0.25 + w * b * s * 0.25
            r = s * (0.145 if v == 1 else 0.092)
            o = sphere(r * (1.35 if v == 1 else 1.0), ace if v == 1 else pipmat, tuple(p), seg=24)
            o.scale = (1, 1, 0.34)
            o.rotation_euler = n.to_track_quat('Z', 'Y').to_euler()
            parts.append(o)
    return parent(parts, loc=loc, rot=rot)


S = 1.3
dice = [
    die(S, (-1.95, 0.9, S / 2), (0, 0, -38), ivory, pip),
    die(S, (1.95, 0.7, S / 2), (0, 0, 36), ivory, pip),
    die(S * 1.08, (0, -0.95, S * 0.54), (0, 0, -16), onyx, pip_w),
    die(S, (-0.95, 0.7, 2.35), (28, 12, -34), ivory, pip),
    die(S, (1.0, 0.1, 2.95), (-26, -14, 38), ivory, pip),
]
podium('#0f1a42', 3.05, 0.55, z=0, rough=0.22)
# glowing accent ring around the podium edge
torus(3.05, 0.045, emit('#6fa4ff', 7.0, name='ring'), loc=(0, 0, 0.0))
torus(3.05, 0.1, glossy('#0b1230', 0.2, 0.8, name='rimmat'), loc=(0, 0, -0.04))
# blue accent light behind and below the dice
d = bpy.data.lights.new('acc', 'POINT')
d.energy, d.color, d.shadow_soft_size = 2600, (0.3, 0.55, 1.0), 1.2
o = bpy.data.objects.new('acc', d)
bpy.context.scene.collection.objects.link(o)
o.location = (0, 2.5, 1.6)
d2 = bpy.data.lights.new('acc2', 'POINT')
d2.energy, d2.color, d2.shadow_soft_size = 900, (0.35, 0.6, 1.0), 1.0
o2 = bpy.data.objects.new('acc2', d2)
bpy.context.scene.collection.objects.link(o2)
o2.location = (0, -3.5, 0.5)
fit(0.86, 0.5, 0.0)
render('dice')
