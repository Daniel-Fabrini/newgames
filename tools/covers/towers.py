import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
S = int(os.environ.get('SAMPLES', 128))
new_scene('#5cc0ff', '#0a3a8a', samples=S)
stone = glossy('#d9d2c4', 0.35, 0.3); stone2 = glossy('#b9b09f', 0.35, 0.3)
roof = glossy('#e23b3b', 0.2, 0.7); grass = glossy('#4fcf3a', 0.4, 0.4)
dirt = glossy('#8a5a35', 0.5, 0.2); wood = glossy('#7a4a28', 0.4, 0.3)
iron = metal('#3a3f4a', 0.3); gold = metal('#ffc933', 0.2); win = glossy('#2a3550', 0.2, 0.5)
objs = []
# floating island
objs.append(cylinder(2.9, 0.5, grass, (0, 0, 0.25), bevel=0.2))
objs.append(cone(2.9, 1.1, 1.8, dirt, (0, 0, -0.9), rot=(0, 0, 0)))
objs.append(cone(1.1, 0.2, 1.0, dirt, (0, 0, -2.2)))
for x, y, s in [(-2.0, -1.4, 0.35), (2.1, -1.2, 0.3), (1.6, -2.0, 0.22)]:
    objs.append(sphere(s, grass, (x, y, 0.55 + s*0.5)))
    objs.append(cylinder(0.05, 0.3, wood, (x, y, 0.55)))
def tower(x, y, h, r, rf):
    objs.append(cylinder(r, h, stone, (x, y, 0.5 + h/2), bevel=0.05))
    objs.append(cylinder(r+0.1, 0.18, stone2, (x, y, 0.5 + h), bevel=0.05))
    objs.append(cone(r+0.18, 0.0, rf, roof, (x, y, 0.5 + h + 0.09 + rf/2)))
    objs.append(sphere(0.09, gold, (x, y, 0.5 + h + 0.09 + rf + 0.05)))
    objs.append(box((0.16, 0.08, 0.3), win, (x, y - r + 0.02, 0.5 + h*0.65), bevel=0.03))
# keep
objs.append(box((2.0, 1.4, 1.7), stone, (0, 0.3, 1.35), bevel=0.08))
for i in (-0.8, -0.27, 0.27, 0.8):
    objs.append(box((0.36, 0.3, 0.3), stone2, (i, -0.3, 2.35), bevel=0.04))
tower(-1.5, 0.2, 2.5, 0.55, 1.1)
tower(1.5, 0.2, 2.5, 0.55, 1.1)
tower(0, 1.0, 3.3, 0.7, 1.4)
# gate
objs.append(box((0.8, 0.12, 1.0), wood, (0, -0.42, 0.95), bevel=0.04))
objs.append(cylinder(0.4, 0.12, wood, (0, -0.42, 1.45), rot=(90, 0, 0), bevel=0.02))
# flag
objs.append(cylinder(0.03, 0.8, iron, (0, 1.0, 0.5 + 3.3 + 0.09 + 1.4 + 0.35)))
objs.append(box((0.6, 0.04, 0.35), glossy('#ffd23a'), (0.3, 1.0, 0.5 + 3.3 + 0.09 + 1.4 + 0.6), bevel=0.01))
# cannon
objs.append(cylinder(0.3, 1.1, iron, (-1.9, -1.75, 0.95), rot=(0, 75, 25), bevel=0.05))
objs.append(sphere(0.34, iron, (-2.28, -1.9, 0.78)))
for dx in (-0.1, 0.5):
    objs.append(cylinder(0.3, 0.12, wood, (-1.95 + dx*0.2, -1.5 - 0.0, 0.8), rot=(90, 0, 25), bevel=0.02))
objs.append(sphere(0.22, iron, (-0.6, -2.4, 0.75)))
objs.append(sphere(0.22, iron, (-0.2, -2.55, 0.75)))
g = parent(objs, loc=(0, 0, 1.3), rot=(0, 0, -12), scale=0.9)
render('towers')
