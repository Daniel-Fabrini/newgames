import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#22c58a', '#023a2c', samples=int(os.environ.get('S', 128)))
a = playing_card('A', 'spade', big=1.7)
k = playing_card('K', 'heart')
parent(k, loc=(0.75, 1.0, 0.05), rot=(-9, 16, 0), scale=1.7)
parent(a, loc=(-0.85, 0.7, 0.05), rot=(-9, -14, 0), scale=1.7)
# chips: stacks red/black/gold + one leaning
chip_stack(-2.3, -1.9, 0.05, ['#d81f2c'] * 5, 1.0)
chip_stack(2.35, -1.7, 0.05, ['#1c1c24', '#1c1c24', '#1c1c24', '#1c1c24'], 1.0, 1, stripe='#e8b830')
chip_stack(1.2, -2.5, 0.05, ['#f2c230'] * 3, 0.95, 2)
c = chip(-1.0, -2.7, 0.08, '#d81f2c', 0.95)
felt_podium('#0a7a48', '#e8b830', 3.8)
fit(0.7, -0.15)
render('blackjack')
