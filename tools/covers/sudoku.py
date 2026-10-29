import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#6f7dff', '#12186e', samples=int(os.environ.get('S', 96)))
T, GAP = 0.9, 0.1
P = T + GAP
cube = glossy('#f4f6ff', 0.25, 0.6, name='cube')
cube2 = glossy('#cdd6ff', 0.25, 0.6, name='cube2')
ink = glossy('#2a2fa8', 0.3, 0.6, name='ink')
inkb = glossy('#d63a5a', 0.3, 0.6, name='inkr')
green = glossy('#27d27a', 0.18, 0.9, name='grn')
nums = [[5, 3, 7], [6, 1, 9], [8, 4, 2]]
objs = []
for r in range(3):
    for c in range(3):
        x = (c - 1) * P; z = (1 - r) * P
        if (r, c) == (0, 2):
            continue   # gap for the tile being placed
        objs.append(box((T, T * 0.9, T), cube if (r + c) % 2 == 0 else cube2, loc=(x, 0, z), bevel=0.14))
        objs.append(text(str(nums[r][c]), ink if (r + c) % 3 else inkb, size=0.62, extrude=0.05, loc=(x, -T * 0.45 - 0.005, z), rot=(90, 0, 0), bevel=0.012))
objs.append(box((3 * P + 0.35, 0.5, 3 * P + 0.35), glossy('#3a45d6', 0.3, 0.6, name='slab'), loc=(0, 0.6, 0), bevel=0.22))
# slot highlight
objs.append(box((T + 0.05, 0.08, T + 0.05), glossy('#8fffc0', 0.3, 0.6, name='slot'), loc=(P, 0.3, P), bevel=0.08))
parent(objs, loc=(0, 0, 1.6), rot=(-6, 12, -6))
# floating tile being placed, glowing green with check mark
tx = bpy.data.objects.new('t', None); bpy.context.scene.collection.objects.link(tx)
parts = [box((T, T * 0.9, T), glossy('#ffd23a', 0.2, 0.8, name='gold_t'), bevel=0.14)]
parts.append(text('4', glossy('#7a3a00', 0.3, 0.6, name='ink4'), size=0.62, extrude=0.05, loc=(0, -T * 0.45 - 0.005, 0), rot=(90, 0, 0), bevel=0.012))
for p in parts: p.parent = tx
tx.location = (1.45, -1.3, 3.2); tx.rotation_euler = (math.radians(-6), math.radians(12), math.radians(14)); tx.scale = (1.15,) * 3
# glow ring + check bubble
chk = cylinder(0.42, 0.14, green, loc=(2.0, -2.3, 1.2), rot=(90, 0, 0), bevel=0.05)
w = glossy('#ffffff', 0.2, 0.8, name='chk')
a = box((0.12, 0.1, 0.3), w, loc=(1.86, -2.42, 1.16), bevel=0.03, rot=(0, 0, 0)); a.rotation_euler = (0, math.radians(-45), 0)
b = box((0.12, 0.1, 0.55), w, loc=(2.12, -2.42, 1.26), bevel=0.03); b.rotation_euler = (0, math.radians(45), 0)
# pencil
pen = []
yel = glossy('#ffc21a', 0.25, 0.7, name='pen')
pen.append(cylinder(0.14, 1.7, yel, bevel=0.02, seg=6))
pen.append(cone(0.14, 0.04, 0.45, glossy('#f2c99a', 0.4, 0.3, name='wood'), loc=(0, 0, -1.07), seg=24))
pen.append(cone(0.05, 0.0, 0.12, glossy('#222222', 0.3, 0.5, name='lead'), loc=(0, 0, -1.34), seg=16))
pen.append(cylinder(0.15, 0.2, metal('#c8ccd8'), loc=(0, 0, 0.9), bevel=0.02))
pen.append(cylinder(0.14, 0.2, glossy('#ff6a8a', 0.3, 0.6, name='eraser'), loc=(0, 0, 1.08), bevel=0.05))
parent(pen, loc=(-0.6, -2.5, 0.55), rot=(0, 78, -10), scale=1.0)
podium('#2a31b8', 3.2, 0.5, z=-0.15)
fit(0.9, 0.2, -0.15)
render('sudoku')
