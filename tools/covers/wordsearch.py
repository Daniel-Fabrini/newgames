import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from props import *

new_scene('#6f7dff', '#161b78', samples=int(os.environ.get('S', 96)))
N = 5
T, GAP = 0.78, 0.1
grid = ["JMTEO", "ROGSA", "UPAVL", "BIEAR", "CDNLK"]
word_cells = {(0, 0), (1, 1), (2, 2), (3, 3), (4, 4)}   # diagonal J-O-G-A-R (row, col): letters set below
letters = [list(r) for r in grid]
for i, ch in enumerate("JOGAR"):
    letters[i][i] = ch
tile = glossy('#f3f5ff', 0.25, 0.6, name='tile')
hi = glossy('#ffc21a', 0.2, 0.8, name='tile_hi')
ink = glossy('#2a2fa8', 0.3, 0.6, name='ink')
ink_hi = glossy('#6a2a00', 0.3, 0.6, name='ink_hi')
pitch = T + GAP
objs = []
for r in range(N):
    for c in range(N):
        x = (c - (N - 1) / 2) * pitch
        z = ((N - 1) / 2 - r) * pitch
        h = (r, c) in word_cells
        b = box((T, T, T), hi if h else tile, loc=(x, 0, z), bevel=0.14)
        t = text(letters[r][c], ink_hi if h else ink, size=0.5, extrude=0.05, loc=(x, -T / 2 - 0.005, z), rot=(90, 0, 0), bevel=0.012)
        objs += [b, t]
        if h:   # raise highlighted tiles toward the viewer
            b.location.y -= 0.18
            t.location.y -= 0.18
slab = box((N * pitch + 0.35, 0.5, N * pitch + 0.35), glossy('#3a45d6', 0.3, 0.6, name='slab'), loc=(0, 0.6, 0), bevel=0.22)
objs.append(slab)
parent(objs, loc=(0, 0, 1.9), rot=(-6, 14, -8))
podium('#2a31b8', 3.0, 0.5, z=-0.35)
magnifier(0.95, loc=(0.8, -2.3, 1.5), ang=-50)
fit(0.82, 0.05)
render('wordsearch')
