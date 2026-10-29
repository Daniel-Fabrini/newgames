import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#ff4d14', '#5a0306', samples=int(os.environ.get('S', 128)), key_energy=1000)
# manilhas: 4 of clubs (zap), 7 of hearts, ace of spades
cs = [playing_card('A', 'spade', big=1.4), playing_card('7', 'heart'), playing_card('4', 'club')]
fan(cs, [-30, -6, 20], base=(-1.5, 1.2, 0.05), dx=0.06, dy=0.16, scale=1.45)
# raised fist
skin = glossy('#f0a878', 0.35, 0.5, name='skin')
sleeve = glossy('#d81f2c', 0.3, 0.6, name='sleeve')
fp = [cylinder(0.45, 1.8, skin, loc=(0, 0, -0.35), bevel=0.05, seg=48),
      cylinder(0.56, 0.8, sleeve, loc=(0, 0, -0.95), bevel=0.1, seg=48),
      box((1.5, 1.0, 1.0), skin, loc=(0, 0, 0.95), bevel=0.28)]
for i, x in enumerate([-0.54, -0.18, 0.18, 0.54]):
    fp.append(box((0.36, 0.4, 0.78), skin, loc=(x, -0.5, 1.12 - 0.03 * (i % 2)), bevel=0.15))
t = box((0.4, 0.42, 0.95), skin, loc=(-0.1, -0.62, 0.62), bevel=0.15)
t.rotation_euler = (0, math.radians(80), math.radians(-6))
fp.append(t)
parent(fp, loc=(2.2, 0.0, 0.9), rot=(-8, -12, 6), scale=1.15)
# speech bubble with exclamation
wm = glossy('#ffffff', 0.2, 0.8, name='bubble')
em = glossy('#e0141f', 0.25, 0.7, name='excl')
bb = [sphere(1.1, wm, scale=(1.15, 0.45, 0.9), seg=48),
      cone(0.45, 0.0, 0.8, wm, loc=(0.5, 0, -1.0), rot=(0, 0, 0), scale=(1, 0.5, 1)),
      box((0.36, 0.2, 0.95), em, loc=(0, -0.5, 0.22), bevel=0.12),
      sphere(0.23, em, loc=(0, -0.5, -0.5), scale=(1, 0.8, 1))]
bb[1].rotation_euler = (math.radians(180), 0, 0)
parent(bb, loc=(1.6, -0.8, 4.2), rot=(-8, -8, 8), scale=1.15)
# flames streaks behind
for x, z, l in [(-2.8, 3.3, 1.6), (-3.1, 2.4, 2.2), (3.4, 3.8, 1.2)]:
    b = box((l, 0.06, 0.12), flame('#ffd23a', 1.8, 'streak'), loc=(x, 2.2, z), bevel=0.05)
    b.rotation_euler = (0, math.radians(-18), 0)
felt_podium('#0e8a40', '#2fd070', 3.9)
fit(0.6, -0.05, 0.4)
render('truco')
