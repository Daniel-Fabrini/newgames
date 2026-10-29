import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
import bmesh
random.seed(5)
S = int(os.environ.get('SAMPLES', 128))
new_scene('#ff9a3a', '#3a0c34', samples=S)
sand = glossy('#c98a45', 0.55, 0.2); sand2 = glossy('#8f5a2c', 0.55, 0.2)
tan = glossy('#e0c07a', 0.35, 0.5); olive = glossy('#7d8f45', 0.35, 0.5); brown = glossy('#8a5a2b', 0.35, 0.5)
trk = glossy('#3a3a3e', 0.5, 0.2); steel = metal('#4d4f55', 0.35); wheelm = glossy('#6d6a60', 0.4, 0.3)
fire1 = flame('#ff3a00', 0.9, 'f1'); fire2 = flame('#ffa800', 1.1, 'f2'); fire3 = flame('#c81000', 0.8, 'f3')
smoke = glossy('#3a3236', 0.8, 0.0); smoke2 = glossy('#5e5258', 0.8, 0.0); rub = glossy('#9a7a55', 0.6, 0.1)
def wedge(L, W, H, h2, mat, loc):
    """side profile: rear height H, front height h2 (sloped glacis), along +x, width W (y)."""
    bm = bmesh.new()
    pr = [(-L / 2, 0), (L / 2, 0), (L / 2, h2), (-L / 2, H)]
    a = [bm.verts.new((x, -W / 2, z)) for x, z in pr]
    b = [bm.verts.new((x, W / 2, z)) for x, z in pr]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    for i in range(4):
        bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    me = bpy.data.meshes.new('wedge'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('wedge', me); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.data.materials.append(mat)
    bv = o.modifiers.new('bv', 'BEVEL'); bv.width = 0.1; bv.segments = 4
    return o


objs = []
objs.append(cylinder(3.3, 0.5, sand, (0, 0, -0.25), bevel=0.22, seg=96))
objs.append(cylinder(3.25, 0.6, sand2, (0, 0, -0.75), bevel=0.15, seg=96))
# explosion behind
fx = [(2.0, 1.2, 1.0, 1.0, fire3), (2.6, 1.0, 1.4, 0.8, fire1), (1.4, 1.4, 1.4, 0.7, fire1), (2.0, 0.8, 1.5, 0.5, fire2),
      (2.5, 0.7, 1.0, 0.5, fire2), (1.0, 1.4, 1.0, 0.45, fire3)]
for x, y, z, r, m in fx:
    objs.append(sphere(r, m, (x, y, z), seg=32))
for x, y, z, h, m in [(1.4, 1.2, 1.9, 1.5, fire1), (2.0, 1.1, 2.2, 1.9, fire2), (2.6, 1.0, 2.0, 1.4, fire1), (1.8, 1.0, 1.7, 1.2, fire3), (2.3, 0.8, 1.8, 1.3, fire2)]:
    objs.append(cone(0.55, 0.0, h, m, (x, y, z), seg=24))
for x, z, r, m in [(2.2, 2.9, 0.8, smoke), (1.4, 2.6, 0.6, smoke2), (3.0, 2.8, 0.55, smoke2), (2.4, 3.6, 0.55, smoke), (3.4, 2.0, 0.5, smoke)]:
    objs.append(sphere(r, m, (x, 1.3, z), seg=32))
for i in range(10):
    a = random.uniform(0, 6.28)
    objs.append(sphere(random.uniform(0.08, 0.15), fire2, (2.1 + math.cos(a)*random.uniform(1.2, 1.8), 0.6, 1.8 + math.sin(a)*random.uniform(1.0, 1.4)), seg=12))
# tank
t = []
t.append(box((3.2, 0.5, 0.8), trk, (0, -1.0, 0.55), bevel=0.2))
t.append(box((3.2, 0.5, 0.8), trk, (0, 1.0, 0.55), bevel=0.2))
for sy in (-1, 1):
    for x in (-1.2, -0.6, 0, 0.6, 1.2):
        t.append(cylinder(0.33, 0.56, wheelm, (x, sy*1.0, 0.5), rot=(90, 0, 0), bevel=0.05))
    t.append(cylinder(0.12, 0.58, trk, (1.45, sy*1.0, 0.55), rot=(90, 0, 0), bevel=0.02))
    t.append(box((3.0, 0.62, 0.12), tan, (0, sy*1.0, 0.95), bevel=0.04))
t.append(box((2.8, 1.8, 0.55), tan, (0, 0, 0.95), bevel=0.14))
t.append(wedge(1.1, 1.8, 0.55, 0.2, tan, (1.95, 0, 0.7)))
# camo patches
for x, y, c in [(-0.8, -0.5, olive), (0.4, 0.45, brown), (-0.3, 0.6, olive), (0.9, -0.55, brown), (-1.2, 0.3, brown)]:
    t.append(sphere(0.4, c, (x, y, 1.2), scale=(1.3, 1.0, 0.14)))
# turret
t.append(cylinder(0.85, 0.42, tan, (-0.15, 0, 1.45), bevel=0.14))
t.append(box((1.3, 1.1, 0.5), tan, (-0.1, 0, 1.75), bevel=0.15))
t.append(sphere(0.3, olive, (-0.1, 0.25, 2.1), scale=(1.4, 1.0, 0.3)))
t.append(cylinder(0.2, 0.12, steel, (-0.5, -0.2, 2.05), bevel=0.03))
t.append(cylinder(0.17, 0.5, tan, (0.4, 0, 1.8), rot=(0, 90, 0), bevel=0.04))
t.append(cylinder(0.12, 2.0, steel, (1.6, 0, 1.8), rot=(0, 90, 0), bevel=0.02))
t.append(cylinder(0.17, 0.3, steel, (2.55, 0, 1.8), rot=(0, 90, 0), bevel=0.04))
t.append(cylinder(0.04, 0.9, steel, (-0.8, 0.4, 2.3), rot=(0, 0, 0), bevel=0.0))
objs.append(parent(t, loc=(-0.7, -0.9, 0.0), rot=(0, 0, -25), scale=1.05))
# rubble
for x, y, s in [(-2.4, 0.8, 0.5), (-2.0, 1.4, 0.38), (-2.7, 0.2, 0.3), (2.7, -0.6, 0.35), (2.4, -1.4, 0.28), (-1.4, 1.9, 0.3)]:
    objs.append(box((s, s*1.2, s*0.8), rub, (x, y, s*0.4), rot=(random.uniform(0, 30), random.uniform(0, 30), random.uniform(0, 90)), bevel=0.06))
parent(objs, loc=(0, 0, 0.0), rot=(17, 0, 0), scale=0.72)
render('squad')
