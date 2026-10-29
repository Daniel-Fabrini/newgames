import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#3ee0c0', '#07484a', samples=int(os.environ.get('S', 128)))
steel = glossy('#23262f', 0.18, 1.0, name='steel')
steel2 = glossy('#5d6270', 0.25, 0.8, name='steel2')
gold = metal('#f0bd3a', 0.2, name='gold')
red = glossy('#e32424', 0.18, 0.9, name='flag')
tile = glossy('#5a6488', 0.3, 0.8, name='tile')
tileo = glossy('#1b2a33', 0.4, 0.5, name='tileo')
spark = _mat('spark', '#ffd24a', 0.3, 0.0, 0.0, '#ffb020', 5.0)

before = set(bpy.data.objects)
# board of tiles under the mine
N, P, T = 5, 0.95, 0.86
for r in range(N):
    for c in range(N):
        x, y = (c - (N - 1) / 2) * P, (r - (N - 1) / 2) * P
        opened = (abs(x) < 1.0 and abs(y) < 1.0) or (r + c) % 4 == 0 and r > 0 and False
        box((T, T, 0.28), tileo if (abs(x) < 1.3 and abs(y) < 1.3) else tile, loc=(x, y, 0.0 if (abs(x) < 1.3 and abs(y) < 1.3) else 0.1), bevel=0.07)
# big mine
R = 1.3
zc = 1.7
sphere(R, steel, loc=(0, 0, zc), seg=96)
for i in range(14):
    # fibonacci sphere directions
    k = (i + 0.5) / 14
    phi = math.acos(1 - 2 * k)
    th = math.pi * (1 + 5 ** 0.5) * i
    d = (math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), math.cos(phi))
    c = cone(0.27, 0.0, 0.75, steel2, loc=(d[0] * (R + 0.25), d[1] * (R + 0.25), zc + d[2] * (R + 0.25)), seg=32)
    c.rotation_euler = Vector(d).to_track_quat('Z', 'Y').to_euler()
sphere(0.2, steel2, loc=(0, 0, zc + R + 0.05))
cylinder(0.14, 0.35, steel2, loc=(0, 0, zc + R + 0.22), bevel=0.04)
# fuse
pts = [(0, 0, zc + R + 0.4), (0.15, 0, zc + R + 0.7), (0.4, 0, zc + R + 0.85)]
cd = bpy.data.curves.new('f', 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = 0.04
sp = cd.splines.new('POLY'); sp.points.add(2)
for p, pt in zip(sp.points, pts): p.co = (*pt, 1)
fo = bpy.data.objects.new('f', cd); bpy.context.scene.collection.objects.link(fo); cd.materials.append(matte('#c9a36a'))
sphere(0.2, spark, loc=(0.44, 0, zc + R + 0.9))
sphere(0.075, glossy('#ffffff', 0.1, 1, name='hl'), loc=(-0.45, -0.85, zc + 0.5), scale=(0.9, 0.3, 1.3))
# gold flag front-right
fx, fy = 1.75, -1.5
cylinder(0.05, 1.6, gold, loc=(fx, fy, 0.9), bevel=0.01)
sphere(0.09, gold, loc=(fx, fy, 1.72))
tri = bpy.data.meshes.new('flagm')
tri.from_pydata([(0, 0, 0), (0.8, 0, -0.32), (0, 0, -0.64)], [], [[0, 1, 2]]); tri.update()
fl = bpy.data.objects.new('flag', tri); bpy.context.scene.collection.objects.link(fl)
fl.location = (fx + 0.04, fy, 1.68)
so = fl.modifiers.new('s', 'SOLIDIFY'); so.thickness = 0.06
fl.data.materials.append(red)
for p in fl.data.polygons: p.use_smooth = True
board = [o for o in bpy.data.objects if o not in before and o.parent is None]
parent(board, loc=(0, 0.2, 0.25), rot=(16, 0, -12))
podium('#0e6e68', 3.9, 0.5, z=-0.25)
fit(0.62, 0.15)
render('mines')
