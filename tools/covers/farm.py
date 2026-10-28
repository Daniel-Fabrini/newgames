import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
S = int(os.environ.get('SAMPLES', 128))
new_scene('#ffe14a', '#3ccf3a', samples=S)
grass = glossy('#58d23c', 0.45, 0.4); dirt = glossy('#8a5a35', 0.5, 0.2)
red = glossy('#e0302c', 0.2, 0.7); white = glossy('#fbf8f0', 0.3, 0.5); black = glossy('#23252b', 0.45, 0.3)
yel = glossy('#ffc81e', 0.25, 0.6); glass = glossy('#8fd3ff', 0.05, 0.9); pink = glossy('#ffa9b8', 0.35, 0.4)
roofm = glossy('#8c3a22', 0.3, 0.4); stem = glossy('#2f9a2b', 0.4, 0.3); brown = glossy('#6b3f1d', 0.5, 0.3)
wheat = glossy('#f0c040', 0.4, 0.4); grey = glossy('#dfe6ee', 0.25, 0.6)
objs = []
objs.append(cylinder(3.5, 0.5, grass, (0, 0, -0.25), bevel=0.22, seg=96))
objs.append(cylinder(3.35, 0.7, dirt, (0, 0, -0.8), bevel=0.15, seg=96))
# barn
b = []
b.append(box((2.2, 1.7, 1.5), red, (0, 0, 0.75), bevel=0.06))
roof_l = box((2.5, 1.2, 0.18), roofm, (0, -0.5, 1.75), rot=(40, 0, 0), bevel=0.03)
roof_r = box((2.5, 1.2, 0.18), roofm, (0, 0.5, 1.75), rot=(-40, 0, 0), bevel=0.03)
b += [roof_l, roof_r]
b.append(box((0.9, 0.06, 1.0), white, (0, -0.87, 0.5), bevel=0.03))
b.append(box((0.75, 0.04, 0.85), red, (0, -0.9, 0.5), bevel=0.02))
for sx in (-1, 1):
    b.append(box((0.08, 0.04, 1.0), white, (0, -0.92, 0.5), rot=(0, 0, 0), bevel=0.01))
b.append(box((0.95, 0.06, 0.08), white, (0, -0.93, 0.5), rot=(0, 35, 0), bevel=0.01))
b.append(box((0.95, 0.06, 0.08), white, (0, -0.93, 0.5), rot=(0, -35, 0), bevel=0.01))
b.append(cylinder(0.2, 0.06, white, (0, -0.9, 1.3), rot=(90, 0, 0), bevel=0.02))
silo = [cylinder(0.5, 2.0, grey, (1.7, 0.4, 1.0)), sphere(0.5, grey, (1.7, 0.4, 2.0), scale=(1, 1, 0.8))]
objs.append(parent(b, loc=(-1.0, 1.6, 0), rot=(0, 0, 0)))
objs.append(parent(silo))
# tractor
t = []
t.append(box((1.3, 0.7, 0.45), red, (0.2, 0, 0.6), bevel=0.1))
t.append(box((0.55, 0.62, 0.35), red, (0.75, 0, 0.9), bevel=0.1))
t.append(box((0.65, 0.66, 0.65), glass, (-0.35, 0, 1.05), bevel=0.1))
t.append(box((0.8, 0.8, 0.1), red, (-0.35, 0, 1.45), bevel=0.04))
t.append(cylinder(0.04, 0.4, grey, (1.0, 0, 1.25), bevel=0.0))
for sy in (-1, 1):
    t.append(cylinder(0.62, 0.3, black, (-0.45, sy*0.55, 0.62), rot=(90, 0, 0), bevel=0.08))
    t.append(cylinder(0.32, 0.32, yel, (-0.45, sy*0.55, 0.62), rot=(90, 0, 0), bevel=0.04))
    t.append(cylinder(0.38, 0.24, black, (0.85, sy*0.45, 0.38), rot=(90, 0, 0), bevel=0.06))
    t.append(cylinder(0.2, 0.26, yel, (0.85, sy*0.45, 0.38), rot=(90, 0, 0), bevel=0.03))
objs.append(parent(t, loc=(0.0, -1.6, 0.0), rot=(0, 0, -25), scale=1.2))
# cow
c = []
c.append(box((1.1, 0.65, 0.65), white, (0, 0, 0.85), bevel=0.2))
c.append(box((0.5, 0.5, 0.48), white, (0.7, 0, 1.05), bevel=0.14))
c.append(box((0.3, 0.45, 0.2), pink, (0.97, 0, 0.95), bevel=0.08))
for sy in (-1, 1):
    c.append(sphere(0.07, black, (1.2, sy*0.12, 1.02)))
    c.append(sphere(0.08, black, (0.9, sy*0.15, 1.27), scale=(1, 1, 1)))
    c.append(cone(0.07, 0.0, 0.22, white, (0.65, sy*0.28, 1.4)))
    c.append(box((0.22, 0.07, 0.14), pink, (0.65, sy*0.3, 1.13), bevel=0.03))
for x in (-0.38, 0.38):
    for sy in (-1, 1):
        c.append(cylinder(0.1, 0.55, white, (x, sy*0.22, 0.3), bevel=0.03))
        c.append(cylinder(0.11, 0.1, black, (x, sy*0.22, 0.05), bevel=0.02))
c.append(sphere(0.2, black, (-0.2, 0.3, 1.0), scale=(1.3, 0.5, 1)))
c.append(sphere(0.18, black, (0.2, -0.3, 1.1), scale=(1.2, 0.5, 1)))
c.append(sphere(0.16, black, (-0.3, -0.3, 1.1), scale=(1.0, 0.5, 1)))
c.append(cylinder(0.025, 0.5, black, (-0.62, 0, 0.9), rot=(0, 30, 0)))
objs.append(parent(c, loc=(2.2, -1.0, 0), rot=(0, 0, -150), scale=1.1))
# sunflowers
def sunflower(x, y, h):
    f = [cylinder(0.05, h, stem, (0, 0, h/2), bevel=0.0, seg=16)]
    for i in range(12):
        a = i * math.pi / 6
        f.append(sphere(0.2, yel, (math.cos(a)*0.32, 0, h + math.sin(a)*0.32), scale=(0.6, 0.25, 1), rot=(0, -math.degrees(a)+90 if False else 0, 0)))
        f[-1].rotation_euler = (0, -a + math.pi/2, 0)
    f.append(cylinder(0.24, 0.14, brown, (0, -0.05, h), rot=(90, 0, 0), bevel=0.04))
    return parent(f, loc=(x, y, 0), rot=(0, 0, 0))
for x, y, h in [(-2.5, 0.2, 1.9), (-2.0, -0.6, 1.5), (2.5, -0.1, 1.7)]:
    objs.append(sunflower(x, y, h))
# wheat
for i in range(14):
    x = -2.7 + (i % 7) * 0.12 + (0.0); y = -1.0 + (i // 7)*0.15 - 1.2
    objs.append(cylinder(0.025, 0.9, wheat, (x - 0.2, y, 0.45), bevel=0, seg=8))
    objs.append(sphere(0.07, wheat, (x - 0.2, y, 0.95), scale=(1, 1, 2.2), seg=16))
parent(objs, loc=(0, 0, 0.35), rot=(16, 0, 0), scale=0.74)
render('farm')
