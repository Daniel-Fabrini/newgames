import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#ffb62e', '#b8400a', samples=int(os.environ.get('S', 96)))
T = 1.0
cols = {2: ('#f6ecd9', '#6b5a45'), 4: ('#f8dfae', '#6b5a45'), 8: ('#ff9a4a', '#ffffff'), 16: ('#ff7a3a', '#ffffff'),
        32: ('#ff5a3a', '#ffffff'), 64: ('#e8322a', '#ffffff'), 128: ('#f7d56a', '#ffffff')}
objs = []
def tile(n, x, y, z, big=1.0, gold=False):
    if gold:
        m = glossy('#ffa300', 0.14, 0.9, name='goldt'); ic = glossy('#7a3a00', 0.3, 0.6, name='goldink')
    else:
        m = glossy(cols[n][0], 0.22, 0.7, name=f't{n}'); ic = glossy(cols[n][1], 0.3, 0.6, name=f'i{n}')
    objs.append(box((T * big, T * big, T * big), m, loc=(x, y, z + T * big / 2), bevel=0.15 * big))
    sz = 0.62 if n < 100 else (0.5 if n < 1000 else 0.42)
    objs.append(text(str(n), ic, size=sz * big, extrude=0.05, loc=(x, y - T * big / 2 - 0.005, z + T * big / 2), rot=(90, 0, 0), bevel=0.012))
# staircase going up to the right: columns of height 1..4 ; each top tile numbered
steps = [(2, 1), (4, 2), (8, 3), (16, 4)]
xs = [-1.65, -0.55, 0.55, 1.65]
vals = [[2], [4, 2], [8, 4, 2], [2048]]
# stairs of stacked blocks: base tiles in each column
heights = [1, 2, 3, 4]
base = [[2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64]]
tops = [2, 4, 8, 16]
for i, x in enumerate(xs):
    h = heights[i]
    for k in range(h - 1):
        n = [2, 4, 8, 16, 32, 64][(i + k) % 6]
        tile(n, x, 0, k * T)
    if i == 3:
        tile(2048, x, 0, (h - 1) * T, gold=True)
    else:
        tile(tops[i] * 2 ** 0, x, 0, (h - 1) * T)
parent(objs, loc=(0, 0, 0.0), rot=(0, 0, -16))
# sparkles / coins
g = metal('#ffc21f', 0.2, name='coin')
for (x, y, z) in [(-2.3, -1.6, 0.18), (2.2, -1.4, 0.18)]:
    cylinder(0.3, 0.1, g, (x, y, z), bevel=0.03)
podium('#d9470f', 3.3, 0.5, z=0.0)
fit(0.82, 0.1, -0.2)
render('g2048')
