import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import *

new_scene('#1fa3b8', '#032a4a', samples=int(os.environ.get('S', 128)))
TILT = -72
def centered(objs):
    return parent(objs, loc=(0, 0, -1.05))
tr = parent([centered(playing_card('A', 'diamond', big=1.5))], rot=(0, 90, 0))
trg = parent([tr], loc=(-1.5, 0.02, 0))
stack = []
for i in range(9):
    b = centered(card_back('#1b4fb8', '#f2c230'))
    stack.append(parent([b], loc=(0.04 * ((i * 3) % 3 - 1), -0.1 - i * 0.085, 0), rot=(0, 0.8 * ((i * 7) % 5 - 2), 0)))
deck = parent(stack + [trg], loc=(0, 0, 0))
parent([deck], loc=(0.9, -1.0, 0.5), rot=(TILT, 0, -8), scale=1.5)
hand = [playing_card('Q', 'heart'), playing_card('7', 'club'), playing_card('K', 'spade')]
fan(hand, [-22, 0, 22], base=(0.3, 2.6, 0.05), dx=0.05, dy=-0.12, scale=1.35)
chip_stack(-2.7, -1.9, 0.05, ['#f2c230'] * 3, 0.9, 1, stripe='#8a5a10')
felt_podium('#0d7f88', '#e8b830', 3.8)
fit(0.7, 0.1, -0.2)
render('bisca')
