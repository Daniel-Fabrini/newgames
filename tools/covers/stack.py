import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#ffc65a', '#4a1f06', samples=int(os.environ.get('S', 128)))
W, Hh, Ln = 0.62, 0.38, 1.86
tones = ['#c98a45', '#b8742f', '#d99b57', '#a9672a']
mats = [glossy(t, 0.35, 0.35, name='w%d' % i) for i, t in enumerate(tones)]
objs = []
layers = 9
for l in range(layers):
    z = l * (Hh + 0.012) + Hh / 2
    for s in range(3):
        off = (s - 1) * (W + 0.02)
        if l == 4 and s == 1:
            continue
        m = mats[(l * 3 + s) % 4]
        if l % 2 == 0:
            objs.append(box((Ln, W, Hh), m, loc=(0, off, z), bevel=0.05))
        else:
            objs.append(box((W, Ln, Hh), m, loc=(off, 0, z), bevel=0.05))
# the pulled block, sticking out towards the camera
z4 = 4 * (Hh + 0.012) + Hh / 2
objs.append(box((Ln, W, Hh), glossy('#ffd88a', 0.3, 0.5, name='pulled'), loc=(0, -1.55, z4), bevel=0.05))
# top block placed crosswise
objs.append(box((W, Ln, Hh), mats[2], loc=(0, 0, layers * (Hh + 0.012) + Hh / 2), bevel=0.05))
g = parent(objs, rot=(0, 0, -28))
podium('#c9971c', 3.4, 0.5, z=0.05)
fit(0.85, 0.62)
render('stack')
