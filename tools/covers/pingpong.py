import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
S = int(os.environ.get('SAMPLES', 128))
new_scene('#56c0ff', '#0b2d86', samples=S)
tbl = glossy('#1650d0', 0.15, 0.8); white = glossy('#ffffff', 0.3, 0.4); red = glossy('#e8262c', 0.3, 0.6)
wood = glossy('#d9a15a', 0.35, 0.4); orange = glossy('#ff8a1a', 0.2, 0.7); dark = glossy('#1a2540', 0.4, 0.3)
net = glossy('#f2f5fa', 0.5, 0.2); glow = emit('#ffd36a', 2.0)
objs = []
objs.append(box((5.2, 3.1, 0.3), tbl, (0, 0, 1.1), bevel=0.1))
objs.append(box((5.2, 0.06, 0.02), white, (0, -1.4, 1.26), bevel=0))
objs.append(box((5.2, 0.06, 0.02), white, (0, 1.4, 1.26), bevel=0))
objs.append(box((0.06, 3.1, 0.02), white, (-2.5, 0, 1.26), bevel=0))
objs.append(box((0.06, 3.1, 0.02), white, (2.5, 0, 1.26), bevel=0))
for sx in (-2.3, 2.3):
    for sy in (-1.2, 1.2):
        objs.append(box((0.3, 0.3, 1.0), dark, (sx, sy, 0.5), bevel=0.05))
# table texture: subtle noise + speckle in the blue
_nt = tbl.node_tree
_b = _nt.nodes['Principled BSDF']
_n = _nt.nodes.new('ShaderNodeTexNoise'); _n.inputs['Scale'].default_value = 60; _n.inputs['Detail'].default_value = 6
_tc = _nt.nodes.new('ShaderNodeTexCoord')
_r = _nt.nodes.new('ShaderNodeValToRGB')
_r.color_ramp.elements[0].color = (*srgb('#0f3fb0'), 1); _r.color_ramp.elements[1].color = (*srgb('#2a74f0'), 1)
_nt.links.new(_tc.outputs['Object'], _n.inputs['Vector']); _nt.links.new(_n.outputs['Fac'], _r.inputs['Fac'])
_nt.links.new(_r.outputs['Color'], _b.inputs['Base Color'])
objs.append(box((5.0, 2.9, 0.02), glossy('#2468e8', 0.12, 0.9, name='inner'), (0, 0, 1.255), bevel=0.0))
objs.append(box((5.2, 3.15, 0.14), dark, (0, 0, 0.93), bevel=0.05))
# net
thread = glossy('#e9eef8', 0.4, 0.2, name='thread')
for k in range(34):
    objs.append(box((0.03, 0.03, 0.62), thread, (0, -1.65 + k * 0.1, 1.57), bevel=0.01))
for z in (1.33, 1.5, 1.67):
    objs.append(box((0.03, 3.3, 0.03), thread, (0, 0, z), bevel=0.01))
objs.append(box((0.1, 3.3, 0.12), white, (0, 0, 1.9), bevel=0.04))
for sy in (-1.65, 1.65):
    objs.append(cylinder(0.07, 0.8, dark, (0, sy, 1.55), bevel=0.02))
# paddle
p = [cylinder(0.85, 0.16, red, (0, 0, 0), rot=(90, 0, 0), bevel=0.05, seg=96),
     cylinder(0.72, 0.19, glossy('#c4151b', 0.5, 0.2), (0, 0, 0), rot=(90, 0, 0), bevel=0.02, seg=96),
     box((0.22, 0.2, 0.9), wood, (0, 0, -1.1), bevel=0.08),
     cylinder(0.14, 0.24, red, (0, 0, -1.55), rot=(90, 0, 0), bevel=0.04)]
p[1].location.y = 0
objs.append(parent(p, loc=(-1.5, -0.9, 3.5), rot=(0, -28, -30), scale=1.75))
BX, BY, BZ = 1.5, -0.9, 3.9
objs.append(sphere(0.6, orange, (BX, BY, BZ)))
for k, (dx, dz, l, r) in enumerate([(-1.0, -0.2, 1.5, 0.38), (-1.0, 0.2, 1.0, 0.2)]):
    c = cone(r, 0.0, l, glossy('#ffd9a0', 0.3, 0.4, name='trail'), (BX + dx - 0.2, BY, BZ + dz - 0.1), seg=24)
    c.rotation_euler = (0, math.radians(-90 + 12), 0)
    objs.append(c)
objs.append(cylinder(3.8, 0.5, glossy('#1a4fc4', 0.25, 0.7, name='podium'), (0, 0, -0.25), bevel=0.15, seg=96))
objs.append(torus(3.8, 0.07, white, (0, 0, 0.0)))
# shadow ring
objs.append(torus(0.5, 0.03, glow, (BX, BY, 1.27)))
parent(objs, loc=(0, 0, -0.2), rot=(22, 0, -14), scale=0.72)
render('pingpong')
