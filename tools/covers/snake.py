import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#6ee05a', '#0a5a2a', samples=int(os.environ.get('S', 128)))
green = glossy('#2fcf45', 0.2, 0.8, name='snake')
spot = glossy('#1f9a35', 0.25, 0.7, name='spot')
belly = glossy('#d8f56a', 0.3, 0.6, name='belly')
white = glossy('#ffffff', 0.15, 0.8, name='eye')
black = glossy('#101018', 0.1, 0.9, name='pupil')
pink = glossy('#ff7a9a', 0.4, 0.4, name='cheek')
red = glossy('#e32424', 0.15, 0.9, name='apple')
brown = glossy('#6a3a1a', 0.4, 0.4, name='stem')
leaf = glossy('#2fb52a', 0.3, 0.6, name='leaf')

def curve(points, radii, bevel, mat, smooth_pts=True):
    cd = bpy.data.curves.new('c', 'CURVE')
    cd.dimensions = '3D'
    cd.bevel_depth = bevel
    cd.bevel_resolution = 10
    cd.use_fill_caps = True
    sp = cd.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, pt, r in zip(sp.points, points, radii):
        p.co = (*pt, 1)
        p.radius = r
    o = bpy.data.objects.new('c', cd)
    bpy.context.scene.collection.objects.link(o)
    cd.materials.append(mat)
    return o

# body path: spiral inward/upward then neck up
pts, rad, spots_at = [], [], []
n = 160
turns = 2.2
Rb = 0.5
for i in range(n):
    u = i / (n - 1)
    th = math.radians(-90) - 2 * math.pi * turns * (1 - u) * 1.0
    if u < 0.78:
        v = u / 0.78
        r = 2.2 - 1.05 * v
        z = Rb + v * 1.25
        # tail tip taper starts at ground
        x, y = r * math.cos(th), r * math.sin(th)
    else:
        w = (u - 0.78) / 0.22
        r = 1.1 - 0.35 * math.sin(w * math.pi / 2)
        th2 = math.radians(-90)
        x, y = r * math.cos(th2) * 1.0, r * math.sin(th2)
        z = Rb + 1.25 + w * 1.6
    taper = min(1.0, 0.18 + u * 6) if u < 0.17 else 1.0
    if u < 0.78:
        z -= Rb * (1 - taper)
    pts.append((x, y, z))
    rad.append(taper)
body = curve(pts, rad, Rb, green)
# darker spots along top of the coil
for i in range(8, n - 40, 7):
    x, y, z = pts[i]
    s = sphere(0.17 * (rad[i]), spot, loc=(x, y, z + Rb * rad[i] * 0.92), scale=(1, 1, 0.35))
# head
hx, hy, hz = pts[-1]
hz += 0.12
head = sphere(0.82, green, loc=(hx, hy - 0.05, hz), scale=(1.05, 1.0, 0.88))
for sx in (-1, 1):
    ex = hx + sx * 0.33
    sphere(0.24, white, loc=(ex, hy - 0.62, hz + 0.28))
    sphere(0.12, black, loc=(ex + sx * 0.0, hy - 0.8, hz + 0.28))
    sphere(0.035, white, loc=(ex - 0.04, hy - 0.89, hz + 0.34))
    sphere(0.13, pink, loc=(hx + sx * 0.58, hy - 0.5, hz - 0.12), scale=(1, 0.4, 0.7))
    sphere(0.045, black, loc=(hx + sx * 0.1, hy - 0.8, hz + 0.0))
# smile
sm = [(hx + 0.32 * t, hy - 0.86, hz - 0.22 - 0.1 * (1 - t * t)) for t in [i / 8 - 1 for i in range(17)]]
curve(sm, [1] * len(sm), 0.03, black)
# tongue
tg = [(hx, hy - 0.84, hz - 0.3), (hx, hy - 1.05, hz - 0.42), (hx, hy - 1.3, hz - 0.5)]
curve(tg, [1, 1, 1], 0.045, red)
for sx in (-1, 1):
    curve([(hx, hy - 1.3, hz - 0.5), (hx + sx * 0.1, hy - 1.43, hz - 0.54)], [1, 1], 0.04, red)
# apple (front right)
ax, ay, az = 2.3, -2.3, 0.62
sphere(0.68, red, loc=(ax, ay, az), scale=(1, 1, 0.93))
sphere(0.4, red, loc=(ax - 0.05, ay + 0.0, az + 0.22), scale=(1.15, 1.0, 0.8))
cylinder(0.04, 0.35, brown, loc=(ax, ay, az + 0.72), rot=(0, 14, 0), bevel=0.01)
l = sphere(0.22, leaf, loc=(ax + 0.28, ay, az + 0.82), scale=(1.4, 0.4, 0.6))
l.rotation_euler = (0, math.radians(-25), 0)
sphere(0.12, glossy('#ffffff', 0.1, 1.0, name='hl'), loc=(ax - 0.28, ay - 0.5, az + 0.35), scale=(0.7, 0.3, 1.0))
podium('#f2dc6a', 3.4, 0.5, z=0.0)
h = fit(0.72, -0.2); h.rotation_euler = (math.radians(8), 0, 0)
render('snake')
