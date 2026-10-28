import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from props import *

new_scene('#9a4dff', '#1b0a5c', samples=int(os.environ.get('S', 96)), key_energy=720)
random.seed(7)
gold = glossy('#f2b000', 0.3, 0.25, name='gold')
gold2 = glossy('#ffd230', 0.3, 0.25, name='gold2')
wood = glossy('#4a1a0a', 0.45, 0.4, name='wood')
wood2 = glossy('#8f2f1a', 0.45, 0.4, name='wood2')
band = glossy('#e8a000', 0.35, 0.25, name='band')

# chest body (open): lower box + front lid hinged open at back
W_, D_, Hh = 3.2, 2.0, 1.4
body = box((W_, D_, Hh), wood2, loc=(0, 0, Hh / 2 + 0.05), bevel=0.14)
for x in (-1.15, 0, 1.15):
    box((0.22, D_ + 0.08, Hh + 0.08), band, loc=(x, 0, Hh / 2 + 0.05), bevel=0.05)
box((W_ + 0.1, D_ + 0.1, 0.2), band, loc=(0, 0, 0.12), bevel=0.05)
box((W_ + 0.12, D_ + 0.12, 0.2), band, loc=(0, 0, Hh + 0.0), bevel=0.05)
# gold pile inside, rising above the rim
pile = sphere(1.0, gold, loc=(0, 0, Hh + 0.1), scale=(1.45, 0.9, 0.85))
# lid: tilted back, open
lid = []
lid.append(box((W_, 0.35, 1.9), wood, loc=(0, 0, 0.95), bevel=0.14))
for x in (-1.15, 0, 1.15):
    lid.append(box((0.22, 0.42, 1.95), band, loc=(x, 0, 0.95), bevel=0.05))
parent(lid, loc=(0, D_ / 2 + 0.05, Hh + 0.2), rot=(-18, 0, 0))
# lock plate on front
box((0.5, 0.12, 0.6), gold2, loc=(0, -D_ / 2 - 0.08, Hh - 0.25), bevel=0.05)
sphere(0.09, glossy('#2a1200', 0.3, 0.5, name='keyhole'), loc=(0, -D_ / 2 - 0.16, Hh - 0.28))

def coin(loc, rot=(0, 0, 0), r=0.42, m=gold):
    c = cylinder(r, 0.1, m, loc=loc, rot=rot, bevel=0.03, seg=48)
    cylinder(r * 0.78, 0.115, gold2 if m is gold else gold, loc=loc, rot=rot, bevel=0.02, seg=48)  # inner emboss
    return c
# coins heaped on pile
for i in range(44):
    a = random.uniform(0, 6.28)
    rr = random.uniform(0, 1.0) ** 0.7
    x, y = math.cos(a) * rr * 1.2, math.sin(a) * rr * 0.65 - 0.1
    z = Hh + 0.55 + (1 - rr) * 0.5
    coin((x, y, z), rot=(random.uniform(-60, 60), random.uniform(-60, 60), random.uniform(0, 360)), r=random.uniform(0.36, 0.5), m=random.choice([gold, gold, gold2]))
# overflow coins falling out front + scattered on floor
for (x, y, z, rx) in [(-1.2, -1.4, 0.07, 0), (-0.5, -1.9, 0.07, 0), (1.5, -1.5, 0.07, 0), (2.1, -1.0, 0.07, 0), (0.8, -2.2, 0.07, 0), (-2.0, -0.9, 0.07, 0)]:
    coin((x, y, z), rot=(rx, 0, random.uniform(0, 360)), r=0.4)
coin((1.4, -1.5, 0.4), rot=(0, 0, 0), r=0.4)  # stacked
coin((-1.2, -1.4, 0.18), rot=(0, 0, 0), r=0.4)
coin((-1.2, -1.4, 0.29), rot=(0, 0, 0), r=0.4)
# gems
def gem(loc, color, s=0.5, rot=(0, 0, 0)):
    m = glass_material(srgb(color) if False else (0.5, 0.5, 0.5), 1.45, name='g' + color)
    m = glossy(color, 0.08, 1.0, name='gem' + color)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=s, subdivisions=1)
    o = bpy.context.active_object
    o.scale = (1, 1, 1.15)
    o.location = loc
    o.rotation_euler = tuple(math.radians(r) for r in rot)
    o.data.materials.append(m)
    return o
gem((-1.25, -0.3, Hh + 1.05), '#ff2f6e', 0.42, (10, 20, 30))
gem((1.35, -0.2, Hh + 0.95), '#2fe0ff', 0.4, (30, 10, 0))
gem((0.7, -0.9, Hh + 0.75), '#3dff8a', 0.32, (0, 40, 20))
gem((-2.1, -1.8, 0.35), '#ff2f6e', 0.3, (0, 0, 0))
gem((2.4, -1.9, 0.3), '#2fe0ff', 0.28, (0, 0, 10))
# "?" coin: big coin standing on the pile with question mark
q = cylinder(0.85, 0.2, glossy('#f5b400', 0.3, 0.25, name='qcoin'), loc=(0.15, -1.05, Hh + 1.75), rot=(90, 0, 0), bevel=0.06, seg=64)
torus(0.8, 0.07, gold2, loc=(0.15, -1.17, Hh + 1.75), rot=(90, 0, 0))
qm = glossy('#6a22d9', 0.25, 0.8, name='qmark')
qt = text('?', qm, size=1.25, extrude=0.1, loc=(0.15, -1.22, Hh + 1.72), rot=(90, 0, 0), bevel=0.03)
podium('#7a2fe0', 3.6, 0.45, z=0.0)
fit(0.88, 0.0)
render('million')
