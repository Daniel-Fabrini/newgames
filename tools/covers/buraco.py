import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#8b3fd8', '#1c0640', samples=int(os.environ.get('S', 128)))
ranks = ['3', '4', '5', '6', '7', '8', '9']
angs = [-60, -40, -20, 0, 20, 40, 60]
cs = [playing_card(r, 'heart') for r in ranks]
fan(cs, angs, base=(0, 1.9, 0.05), dx=0.036, dy=-0.07, tilt=-9, scale=1.35)
# second sequence (3 spades) laid in a short row, front-left, partly overlapped
for i, r in enumerate(['J', 'Q', 'K']):
    parent(playing_card(r, 'spade'), loc=(-2.5 + i * 0.65, -1.9 - i * 0.04, 0.05), rot=(-9, -6, 0), scale=0.85)
# joker front right
parent(joker(), loc=(2.4, -1.8, 0.05), rot=(-9, 12, 0), scale=1.05)
chip_stack(0.5, -2.7, 0.05, ['#f2c230'] * 3, 0.8, 1, stripe='#8a5a10')
felt_podium('#0f8a4a', '#e8b830', 4.0)
fit(0.62, 0.3)
render('buraco')
