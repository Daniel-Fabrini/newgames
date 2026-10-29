import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#38d0ff', '#0a2a8a', samples=int(os.environ.get('S', 128)))
N, P, T = 9, 0.62, 0.52
cols = {'O': '#ff9a1f', 'P': '#ff4fa0', 'B': '#2f6bff', 'G': '#3ddc6a', 'Y': '#ffd21f', 'R': '#ff4a3a', 'V': '#9a5cff'}
mats = {k: glossy(v, 0.2, 0.8, name='b_' + k) for k, v in cols.items()}
glow = _mat('glow', '#bff6ff', 0.2, 0.0, 0.8, '#5fe8ff', 2.2)
cell = glossy('#3a5be0', 0.35, 0.4, name='cell')
rows = [  # bottom -> top
    "OOO.PPBBB",
    "O.GGGPYB.",
    "CCCCCCCCC",
    "..YY.RRV.",
    ".......V.",
]
objs = []
def pos(c, r): return ((c - (N - 1) / 2) * P, ((r - (N - 1) / 2)) * P)
for r in range(N):
    for c in range(N):
        ch = rows[r][c] if r < len(rows) else '.'
        x, z = pos(c, r)
        if ch == '.':
            objs.append(box((T, 0.1, T), cell, loc=(x, -0.02, z), bevel=0.07))
        else:
            m = glow if ch == 'C' else mats[ch]
            objs.append(box((T + 0.06, T + 0.06, T + 0.06), m, loc=(x, -0.14, z), bevel=0.1))
slab = box((N * P + 0.45, 0.4, N * P + 0.45), glossy('#1d2a8c', 0.3, 0.6, name='slab'), loc=(0, 0.2, 0), bevel=0.2)
objs.append(slab)
# floating pieces, in front of the board
def piece(cells, mat, ox, oz, y=-0.9):
    out = []
    for (cx, cz) in cells:
        out.append(box((T + 0.1, T + 0.1, T + 0.1), mat, loc=(ox + cx * P, y, oz + cz * P), bevel=0.11))
    return out
Lp = piece([(0, 0), (0, 1), (0, 2), (1, 0)], mats['O'], 1.5, 2.7)
Sq = piece([(0, 0), (1, 0), (0, 1), (1, 1)], mats['P'], -2.5, 2.9)
Ln = piece([(0, 0), (1, 0), (2, 0), (3, 0)], mats['G'], -2.2, 3.9, y=-0.7)
g = parent(objs, rot=(-4, 0, 0))
g2 = parent(Lp, rot=(0, 10, -14))
g3 = parent(Sq, rot=(0, -14, 12))
g4 = parent(Ln, rot=(0, 8, 6))
podium('#2457e6', 3.7, 0.5, z=-2.95)
fit(0.62, 0.55)
render('blocks')
