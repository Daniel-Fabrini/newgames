import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat

new_scene('#8a4dff', '#150644', samples=int(os.environ.get('S', 128)))

def sector(a0, a1, r_in, r_out, h, mat, z=0.0, seg=28):
    pts = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        pts.append((r_out * math.cos(a), r_out * math.sin(a), 0))
    for i in range(seg, -1, -1):
        a = a0 + (a1 - a0) * i / seg
        pts.append((r_in * math.cos(a), r_in * math.sin(a), 0))
    me = bpy.data.meshes.new('sec')
    me.from_pydata(pts, [], [list(range(len(pts)))])
    me.update()
    o = bpy.data.objects.new('sec', me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.location = (0, 0, z)
    so = o.modifiers.new('solid', 'SOLIDIFY')
    so.thickness, so.offset = h, 1
    bv = o.modifiers.new('bevel', 'BEVEL')
    bv.width, bv.segments = 0.09, 5
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o

green = glossy('#0c9c3a', 0.2, 0.9, name='g')
red = glossy('#d00c28', 0.2, 0.9, name='r')
blue = glossy('#1048f0', 0.2, 0.9, name='b')
ylw = _mat('y', '#ffd21f', 0.2, 0.0, 0.9, '#ffb300', 1.0)   # the lit pad
rim = metal('#e8b83a', 0.22, name='rim')
dark = glossy('#15101f', 0.35, 0.6, name='dark')

before = set(bpy.data.objects)
gap = math.radians(5)
mats = [green, red, ylw, blue]
starts = [math.radians(90), math.radians(0), math.radians(-90), math.radians(180)]
# order: far-left green, far-right red, near-right yellow(lit), near-left blue
quad = [(math.radians(90) + gap / 2, math.radians(180) - gap / 2, green),
        (math.radians(0) + gap / 2, math.radians(90) - gap / 2, red),
        (math.radians(-90) + gap / 2, math.radians(0) - gap / 2, ylw),
        (math.radians(180) + gap / 2, math.radians(270) - gap / 2, blue)]
for a0, a1, m in quad:
    lift = 0.12 if m is ylw else 0.0
    sector(a0, a1, 0.85, 2.55, 0.55, m, z=0.05 + lift)
# ring base + hub
cylinder(2.8, 0.34, dark, loc=(0, 0, -0.12), bevel=0.12)
torus(2.72, 0.1, rim, loc=(0, 0, 0.1))
cylinder(0.92, 0.7, rim, loc=(0, 0, 0.4), bevel=0.14)
sphere(0.78, glossy('#18121f', 0.15, 1.0, name='hub'), loc=(0, 0, 0.74), scale=(1, 1, 0.55))
board = [o for o in bpy.data.objects if o not in before and o.parent is None]
parent(board, loc=(0, 0, 2.55), rot=(66, 0, 14))
podium('#2b1a6e', 3.7, 0.5, z=-0.3)
fit(0.7, 0.0)
render('lights')
