import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#c0304a', '#2e0510', samples=int(os.environ.get('S', 128)))
specs = [('J', 'club'), ('K', 'spade'), ('7', 'heart'), ('A', 'heart')]
angs = [-42, -16, 10, 36]
fan([playing_card(r, k) for r, k in specs], angs, base=(-0.7, 1.0, 0.05), dx=0.04, dy=0.14, scale=1.45)
# trunfo marker: gold disc on a stand with a heart, in front-right
g = metal('#e8b830', 0.2, name='gold')
hm = glossy('#d8182c', 0.25, 0.7, name='suit_red')
d = [cylinder(0.85, 0.2, g, rot=(90, 0, 0), bevel=0.06, seg=64),
     cylinder(0.65, 0.22, glossy('#fff4d6', 0.3, 0.6, name='cream'), loc=(0, -0.02, 0), rot=(90, 0, 0), bevel=0.04, seg=64)]
d += suit('heart', 0.55, 0, 0, hm, y=-0.14)
d.append(cylinder(0.3, 0.12, g, loc=(0, 0, -0.95), bevel=0.04, seg=32))
d.append(box((0.18, 0.12, 0.5), g, loc=(0, 0.0, -0.7), bevel=0.03))
parent(d, loc=(2.6, -1.6, 1.0), rot=(-8, -10, 0), scale=1.0)
# small stack of cards (face down) at left front
for i in range(4):
    c = card_back('#8a1020', '#e8b830')
    parent(c, loc=(-2.4, -1.5 + 0.0, 0.1 + i * 0.09), rot=(-90, 0, 20 - i * 3), scale=0.8)
chip_stack(1.0, -2.5, 0.05, ['#e8b830', '#e8b830'], 0.8, 3, stripe='#8a5a10')
felt_podium('#0f7a46', '#e8b830', 3.8)
fit(0.64, -0.1, 0.3)
render('sueca')
