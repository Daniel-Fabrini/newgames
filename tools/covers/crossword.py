import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#ff5a78', '#6a0a2a', samples=int(os.environ.get('S', 96)))
T, GAP = 0.82, 0.1
P = T + GAP
cream = glossy('#fff4e8', 0.25, 0.6, name='cr')
black = glossy('#2a1020', 0.3, 0.7, name='blk')
ink = glossy('#a01840', 0.3, 0.6, name='ink')
hi = glossy('#ffc21a', 0.2, 0.8, name='hi')
inkh = glossy('#6a2a00', 0.3, 0.6, name='inkh')
# 5x5 layout: JOGO across row 1 (cols 0-3); vertical word down col 1 "OLA" etc. '#' = block, '.' = empty cell, letters
grid = ["#....",
        "JOGO.",
        "#L..#",
        "#A.#.",
        "....#"]
grid = ["#.#..",
        "JOGO.",
        "#L#.#",
        "#A...",
        "....#"]
objs = []
N = 5
for r in range(N):
    for c in range(N):
        ch = grid[r][c]
        x = (c - 2) * P; z = (2 - r) * P
        if ch == '#':
            objs.append(box((T, T * 0.7, T), black, loc=(x, 0.1, z), bevel=0.12))
            continue
        isw = ch != '.'
        top = hi if (r == 1 and isw) else cream
        b = box((T, T * 0.9, T), top, loc=(x, 0, z), bevel=0.14)
        objs.append(b)
        if isw:
            t = text(ch, inkh if r == 1 else ink, size=0.56, extrude=0.05, loc=(x, -T * 0.45 - 0.005, z), rot=(90, 0, 0), bevel=0.012)
            objs.append(t)
        if r == 1 and isw:
            b.location.y -= 0.12; 
            if isw: t.location.y -= 0.12
objs.append(box((N * P + 0.35, 0.5, N * P + 0.35), glossy('#c9204a', 0.3, 0.6, name='slab'), loc=(0, 0.6, 0), bevel=0.22))
parent(objs, loc=(0, 0, 1.75), rot=(-6, 12, -6))
# golden pencil (lying in front)
pen = []
gold = glossy('#ffb81a', 0.18, 0.9, name='gpen')
pen.append(cylinder(0.17, 2.4, gold, bevel=0.02, seg=6))
pen.append(cone(0.17, 0.05, 0.55, glossy('#f4d3a6', 0.4, 0.3, name='wood'), loc=(0, 0, -1.47), seg=24))
pen.append(cone(0.06, 0.0, 0.16, glossy('#222222', 0.3, 0.5, name='lead'), loc=(0, 0, -1.82), seg=16))
pen.append(cylinder(0.18, 0.24, metal('#e8e8f0'), loc=(0, 0, 1.3), bevel=0.02))
pen.append(cylinder(0.17, 0.26, glossy('#ff5a8a', 0.3, 0.6, name='eraser'), loc=(0, 0, 1.55), bevel=0.06))
parent(pen, loc=(0.4, -2.45, 0.6), rot=(0, 80, 6))
podium('#8a1034', 3.4, 0.5, z=-0.1)
fit(0.74, 0.1, -0.1)
render('crossword')
