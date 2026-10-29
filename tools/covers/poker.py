import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#34459a', '#050618', samples=int(os.environ.get('S', 128)))
g = glossy('#f7b81c', 0.2, 0.9, name='goldp')
# trophy cup behind
tp = [cylinder(0.95, 0.35, g, loc=(0, 0, 0.17), bevel=0.1, seg=48),
      cylinder(0.55, 0.3, g, loc=(0, 0, 0.5), bevel=0.08, seg=48),
      cylinder(0.2, 1.0, g, loc=(0, 0, 1.15), bevel=0.05, seg=32),
      cone(0.35, 1.0, 1.5, g, loc=(0, 0, 2.2), seg=64),
      torus(1.0, 0.07, g, loc=(0, 0, 2.95)),
      torus(0.38, 0.08, g, loc=(-1.1, 0, 2.55)), torus(0.38, 0.08, g, loc=(1.1, 0, 2.55)),
      sphere(0.28, glossy('#d81f2c', 0.2, 0.8, name='ruby'), loc=(0, -0.7, 2.5), scale=(1, 0.5, 1))]
for t in tp[5:7]:
    t.rotation_euler = (math.radians(90), 0, 0)
parent(tp, loc=(0.4, 3.2, 1.5), scale=1.45)
cylinder(1.3, 1.5, glossy('#16256e', 0.3, 0.6, name='plinth'), loc=(0.4, 3.2, 0.7), bevel=0.1, seg=64)
torus(1.3, 0.07, g, loc=(0.4, 3.2, 1.45))
# hole cards: two aces
a1, a2 = playing_card('A', 'spade', big=1.45), playing_card('A', 'heart', big=1.45)
parent(a1, loc=(-1.0, 0.0, 0.05), rot=(-9, -14, 0), scale=1.55)
parent(a2, loc=(0.6, -0.3, 0.05), rot=(-9, 12, 0), scale=1.55)
# chips
chip_stack(-2.7, -1.7, 0.05, ['#f2c230'] * 5, 1.0, 0, stripe='#8a5a10')
chip_stack(2.7, -1.5, 0.05, ['#1c1c24'] * 4, 1.0, 1, stripe='#f2c230')
chip_stack(1.8, -2.5, 0.05, ['#1c1c24', '#f2c230', '#1c1c24'], 0.9, 2, stripe='#ffffff')
# dealer button
db = [cylinder(0.6, 0.14, glossy('#ffffff', 0.2, 0.8, name='dbtn'), bevel=0.04, seg=48),
      torus(0.45, 0.04, g, loc=(0, 0, 0.07)),
      text('D', glossy('#15151c', 0.3, 0.6, name='dtxt'), size=0.85, extrude=0.03, loc=(0, 0, 0.1), rot=(0, 0, 0))]
parent(db, loc=(-0.6, -2.6, 0.12), rot=(0, 0, 0), scale=1.0)
felt_podium('#0d1a52', '#f0b82a', 3.9)
fit(0.6, -0.1)
render('poker')
