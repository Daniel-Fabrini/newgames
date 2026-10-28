import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from props import *

new_scene('#ffae3a', '#a8340a', samples=int(os.environ.get('S', 96)))
shadow_catcher(0)
# floor glow
ground('#c8581a', 0.35)

fur = glossy('#b8743a', 0.55, 0.15, name='fur')
fur2 = glossy('#e7b27a', 0.55, 0.15, name='fur2')
dark = glossy('#1b1210', 0.15, 0.9, name='eye')
# teddy bear
z0 = 1.5
body = sphere(1.15, fur, loc=(0, 0, z0), scale=(1, 0.9, 1.1))
belly = sphere(0.75, fur2, loc=(0, -0.55, z0 - 0.05), scale=(1, 0.5, 1.0))
head = sphere(0.95, fur, loc=(0, -0.05, z0 + 1.75))
for sx in (-1, 1):
    sphere(0.38, fur, loc=(sx * 0.78, 0.0, z0 + 2.45))
    sphere(0.22, fur2, loc=(sx * 0.78, -0.18, z0 + 2.45), scale=(1, 0.5, 1))
    sphere(0.14, dark, loc=(sx * 0.36, -0.86, z0 + 1.95))
    sphere(0.04, matte('#ffffff', 0.1), loc=(sx * 0.33, -0.99, z0 + 2.0))
    sphere(0.45, fur, loc=(sx * 1.2, -0.1, z0 + 0.5), scale=(0.9, 0.9, 1.3), rot=(0, sx * 35, 0))   # arms
    sphere(0.5, fur, loc=(sx * 0.7, -0.35, z0 - 1.0), scale=(1, 1, 1.0))   # legs
    sphere(0.28, fur2, loc=(sx * 0.7, -0.78, z0 - 1.0), scale=(1, 0.5, 1))
muzzle = sphere(0.42, fur2, loc=(0, -0.78, z0 + 1.55), scale=(1.1, 0.8, 0.85))
sphere(0.16, dark, loc=(0, -1.12, z0 + 1.68), scale=(1.2, 0.8, 0.9))
bow = glossy('#e0243a', 0.25, 0.8, name='bow')
for sx in (-1, 1):
    sphere(0.3, bow, loc=(sx * 0.32, -0.7, z0 + 0.95), scale=(1.1, 0.6, 0.8), rot=(0, sx * -25, 0))
sphere(0.15, bow, loc=(0, -0.78, z0 + 0.95))

# toys: ball, duck, key
ball = glossy('#2f6bff', 0.2, 0.8, name='ball')
b = sphere(0.7, ball, loc=(-2.45, -1.0, 0.7))
for ang, col in ((0, '#ffd21f'), (120, '#ff3b3b')):
    pass
band = torus(0.7, 0.07, glossy('#ffd21f', 0.2, 0.8, name='bandy'), loc=(-2.45, -1.0, 0.7), rot=(70, 20, 0))
band2 = torus(0.7, 0.07, glossy('#ff3b3b', 0.2, 0.8, name='bandr'), loc=(-2.45, -1.0, 0.7), rot=(20, 70, 0))
# duck
yel = glossy('#ffd21f', 0.2, 0.8, name='duck')
org = glossy('#ff7a1a', 0.2, 0.8, name='beak')
dx, dy = 2.3, -1.1
sphere(0.65, yel, loc=(dx, dy, 0.65), scale=(1.2, 1, 0.85))
sphere(0.42, yel, loc=(dx - 0.35, dy - 0.2, 1.45))
sphere(0.3, yel, loc=(dx + 0.8, dy, 0.9), scale=(0.9, 0.5, 0.9))
sphere(0.2, org, loc=(dx - 0.62, dy - 0.55, 1.4), scale=(1, 1, 0.5))
sphere(0.06, dark, loc=(dx - 0.55, dy - 0.55, 1.62))
sphere(0.06, dark, loc=(dx - 0.12, dy - 0.5, 1.62))
# key
kc = metal('#ffcf3a', 0.2, name='key')
torus(0.3, 0.1, kc, loc=(1.0, -2.2, 0.15), rot=(0, 0, 0))
box((1.3, 0.2, 0.2), kc, loc=(1.9, -2.2, 0.15), bevel=0.05)
box((0.2, 0.2, 0.4), kc, loc=(2.35, -2.2, 0.15), bevel=0.04)
# magnifier in front
magnifier(1.15, loc=(-0.2, -3.2, 2.6), rot=(0, 0, 0))
render('findit')
