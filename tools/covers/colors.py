import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#2a4fd0', '#050a26', samples=int(os.environ.get('S', 128)))
R, Y, G, B = '#e8202c', '#f7c01c', '#1eb356', '#2563eb'
# speed streaks (hot accent) behind
hot = flame('#ff4a1c', 2.2, 'streak')
hot2 = flame('#ffb020', 2.2, 'streak2')
for i, (x, z, l, m) in enumerate([(-2.6, 2.3, 2.4, hot), (-2.2, 1.0, 3.0, hot2), (-2.9, 0.3, 1.6, hot), (2.9, 3.2, 1.8, hot2), (2.5, 2.4, 2.4, hot)]):
    b = box((l, 0.08, 0.1), m, loc=(x, 1.6, z + 0.4), bevel=0.04)
    b.rotation_euler = (0, math.radians(-12), 0)
specs = [(B, '5'), (G, 'skip'), (Y, '7'), (R, '+2')]
angs = [-58, -34, -10, 14]
cs = [color_card(c, s) for c, s in specs] 
fan(cs, angs, base=(-0.8, 1.1, 0.05), dx=0.045, dy=0.14, scale=1.5)
# wild card on top, tilted forward and bigger
w = color_card(None, wild=True)
parent(w, loc=(1.5, -0.6, 0.05), rot=(-9, 10, 0), scale=1.7)
# +4 badge
bd = [sphere(0.55, glossy('#ffffff', 0.2, 0.8, name='badge'), loc=(0, 0, 0), scale=(1, 0.3, 1)),
      text('+4', glossy('#e8202c', 0.25, 0.7, name='badget'), size=0.55, extrude=0.05, loc=(0, -0.2, 0), bevel=0.015)]
parent(bd, loc=(2.7, -1.1, 3.0), rot=(-9, 8, 0), scale=1.0)
felt_podium('#0b1c66', '#ff6a2a', 4.0)
fit(0.6, 0.1, 0.55)
render('colors')
