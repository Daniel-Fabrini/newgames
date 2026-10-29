import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from props import *

# hero = golden trophy on a podium with red / white / black banners, crest medallion on the base.
# Needs the crest as PNG (rendered from spfc_crest_master.svg): COVER_CREST=/path/crest.png
CREST = os.environ.get('COVER_CREST', os.path.join(os.environ.get('COVER_TMP', '/tmp'), 'crest.png'))

new_scene('#e0202c', '#2a0409', samples=int(os.environ.get('S', 96)), key_energy=820)
gold = metal('#f2b51c', 0.2, name='gold')
gold2 = metal('#ffd75a', 0.16, name='gold2')
black = glossy('#101014', 0.25, 0.7, name='blk')
red = glossy('#d4101c', 0.25, 0.7, name='red')
white = glossy('#f7f7f7', 0.3, 0.6, name='wht')

# podium: black drum, gold ring, red top
podium('#17171b', 3.5, 0.9, z=0.0)
torus(3.5, 0.09, gold, loc=(0, 0, 0.0), rot=(0, 0, 0))
cylinder(3.0, 0.14, red, loc=(0, 0, 0.07), bevel=0.05, seg=96)
torus(3.0, 0.06, gold2, loc=(0, 0, 0.14))
# red / white / black stripes on the drum front (decor)
for i, c in enumerate((red, white, black)):
    pass

# trophy plinth with the crest medallion
z0 = 0.14
box((2.0, 1.7, 0.7), black, loc=(0, 0, z0 + 0.35), bevel=0.1)
box((2.3, 1.95, 0.16), gold, loc=(0, 0, z0 + 0.08), bevel=0.05)
box((1.8, 1.5, 0.12), gold, loc=(0, 0, z0 + 0.76), bevel=0.04)
# medallion: white disc + crest picture facing the camera (-Y)
cylinder(0.62, 0.08, gold2, loc=(0, -0.86, z0 + 0.38), rot=(90, 0, 0), bevel=0.02, seg=64)
cylinder(0.55, 0.1, white, loc=(0, -0.88, z0 + 0.38), rot=(90, 0, 0), bevel=0.02, seg=64)
pl = plane((0.78, 0.78), image_material(CREST, 0.4, 0.3, name='crest'), loc=(0, -0.935, z0 + 0.38), rot=(90, 0, 0))

# stem + knobs
zs = z0 + 0.82
cylinder(0.26, 1.1, gold, loc=(0, 0, zs + 0.55), bevel=0.04)
sphere(0.42, gold2, loc=(0, 0, zs + 0.5), scale=(1, 1, 0.55))
sphere(0.36, gold2, loc=(0, 0, zs + 1.05), scale=(1, 1, 0.5))
cylinder(0.75, 0.16, gold, loc=(0, 0, zs + 1.3), bevel=0.05)
# bowl
zb = zs + 1.38
cone(0.7, 1.4, 2.2, gold, loc=(0, 0, zb + 1.1), seg=64)
sphere(0.7, gold, loc=(0, 0, zb + 0.02), scale=(1, 1, 0.8))
torus(1.4, 0.1, gold2, loc=(0, 0, zb + 2.2))
cylinder(1.35, 0.05, glossy("#3a1c00", 0.5, 0.2, name="inner"), loc=(0, 0, zb + 2.18), seg=64, bevel=0)
# handles
for sx in (-1, 1):
    torus(0.62, 0.12, gold, loc=(sx * 1.5, 0, zb + 1.6), rot=(90, 0, 0))
# reflective highlight band
cylinder(0.02, 0.01, gold, loc=(0, 0, 0))

# banners: two each side, red/white/black, hanging on poles, tilted
def banner(x, y, z, tilt, col, h=3.4, w=0.95):
    parts = [box((w, 0.07, h), col, loc=(0, 0, -h / 2), bevel=0.03)]
    parts.append(cylinder(0.06, w + 0.3, gold, loc=(0, 0, 0.04), rot=(0, 90, 0), bevel=0.01, seg=16))
    parts.append(box((w, 0.075, 0.12), gold, loc=(0, 0, -h + 0.06), bevel=0.02))
    return parent(parts, loc=(x, y, z), rot=(0, 0, tilt))
banner(-2.9, 1.6, 5.8, 6, red)
banner(-1.9, 2.2, 6.3, -4, white)
banner(2.9, 1.6, 5.8, -6, black)
banner(1.9, 2.2, 6.3, 4, red)
# confetti coins
gold_c = gold
for (x, y, z) in [(-2.6, -1.2, 0.3), (2.7, -1.0, 0.3), (-1.9, -1.9, 0.18), (2.2, -2.0, 0.18)]:
    cylinder(0.32, 0.08, gold_c, loc=(x, y, z), rot=(0, 0, 0), bevel=0.03, seg=48)
fit(0.68, -0.15)
render('tricolor')
