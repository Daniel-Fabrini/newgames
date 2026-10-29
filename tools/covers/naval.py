import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
import bmesh
S = int(os.environ.get('SAMPLES', os.environ.get('S', 128)))
new_scene('#1f9ae0', '#031030', samples=S)
random.seed(3)
water = glossy('#0d5fc0', 0.1, 0.9, name='water'); foam = glossy('#f2fbff', 0.35, 0.3, name='foam')
grey = glossy('#9aa8bd', 0.25, 0.7, name='grey'); dgrey = glossy('#566278', 0.3, 0.5, name='dgrey')
navy = glossy('#2a3f66', 0.25, 0.7, name='navyhull'); red = glossy('#d63a3a', 0.25, 0.6, name='red')
steel = metal('#2c3340', 0.25, name='steel'); white = glossy('#f4f6fa', 0.3, 0.5, name='white')
radar = flame('#12c4ff', 1.1, 'radar'); radar2 = flame('#0a8fd8', 1.0, 'radar2')
drop = glossy('#bfe9ff', 0.1, 0.9, name='drop')


def hull(L, B, D, mat):
    """Pointed-bow ship hull lofted from cross-sections; x along length, bow at +x."""
    n = 14
    bm = bmesh.new()
    rings = []
    prof = [(0.0, -1.0), (0.55, -0.85), (0.92, -0.35), (1.0, 0.25), (0.97, 0.5), (0.0, 0.5)]  # half profile (y*B/2, z*D)
    for i in range(n):
        t = i / (n - 1)               # 0 stern -> 1 bow
        x = (t - 0.5) * L
        if t < 0.55:
            w = 1.0 - 0.18 * (1 - t / 0.55) ** 2
        else:
            u = (t - 0.55) / 0.45
            w = max(0.03, (1 - u ** 1.7) ** 0.62)
        rake = 0.55 * (max(0, t - 0.7) / 0.3) ** 2        # bow rises
        ring = []
        pts = [(-y, z) for y, z in reversed(prof[1:])] + prof  # left side then right side
        for y, z in pts:
            zz = z * D + (rake * D if z > 0 else rake * D * 0.4)
            ring.append(bm.verts.new((x, y * B / 2 * w, zz)))
        rings.append(ring)
    m = len(rings[0])
    for i in range(n - 1):
        for j in range(m - 1):
            bm.faces.new((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    mesh = bpy.data.meshes.new('hull')
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new('hull', mesh)
    bpy.context.scene.collection.objects.link(o)
    sm = o.modifiers.new('sub', 'SUBSURF')
    sm.levels = sm.render_levels = 2
    for p in mesh.polygons:
        p.use_smooth = True
    for mm in (mat, dgrey, red):
        o.data.materials.append(mm)
    for p in mesh.polygons:
        zc = p.center.z
        p.material_index = 1 if p.normal.z > 0.9 and zc > 0.2 * D else (2 if zc < -0.28 * D else 0)
    bpy.context.view_layer.objects.active = o
    return o


def ship(x, y, ang, sc, kind=0):
    p = [hull(3.5, 1.1, 0.6, grey)]
    p.append(box((1.0, 0.64, 0.4), white, (-0.5, 0, 0.5), bevel=0.1))
    p.append(box((0.62, 0.5, 0.3), white, (-0.55, 0, 0.85), bevel=0.09))
    p.append(box((0.74, 0.56, 0.06), steel, (-0.55, 0, 1.03), bevel=0.02))
    p.append(cylinder(0.035, 0.55, steel, (-0.55, 0, 1.3), bevel=0.0, seg=12))
    p.append(cylinder(0.15, 0.45, red, (0.0, 0, 0.62), bevel=0.04, seg=24))
    p.append(torus(0.17, 0.03, steel, (-0.55, 0, 1.2), rot=(90, 0, 0)))
    for tx, sz in ((0.8, 1.0), (1.35, 0.85)):
        p.append(cylinder(0.27 * sz, 0.18, dgrey, (tx, 0, 0.36), bevel=0.05, seg=32))
        p.append(box((0.4 * sz, 0.32 * sz, 0.14), grey, (tx, 0, 0.5), bevel=0.05))
        p.append(cylinder(0.055, 0.85 * sz, steel, (tx + 0.55 * sz, 0.0, 0.52), rot=(0, 90, 0), bevel=0.0, seg=16))
    return parent(p, loc=(x, y, 0.42 * sc), rot=(0, 0, ang), scale=sc)


objs = []
objs.append(cylinder(3.5, 0.9, water, (0, 0, -0.45), bevel=0.25, seg=96))
objs.append(torus(3.5, 0.08, glossy('#e8f6ff', 0.2, 0.8, name='rimw'), (0, 0, 0.0)))
for R, r in ((2.9, 0.045), (2.1, 0.04), (1.3, 0.035)):
    objs.append(torus(R, r, radar, (0, 0, 0.02)))
for a in (0, 90, 45, 135):
    b = box((6.0, 0.035, 0.02), radar2, (0, 0, 0.02), bevel=0.0)
    b.rotation_euler = (0, 0, math.radians(a))
    objs.append(b)
# sweep wedge
objs.append(ship(-0.6, -1.1, -10, 1.15))
objs.append(ship(1.3, 1.5, 8, 0.8))
# wake foam behind big ship
# crown splash (shell hit) front right
sx, sy = 2.0, -1.6
objs.append(torus(0.55, 0.12, foam, (sx, sy, 0.1), scale=(1, 1, 0.6)))
for k in range(9):
    a = k * 6.283 / 9
    c = cone(0.17, 0.02, 0.9, foam, (sx + 0.42 * math.cos(a), sy + 0.42 * math.sin(a), 0.55))
    c.rotation_euler = (math.sin(a) * -0.5, math.cos(a) * 0.5, 0)
    objs.append(c)
objs.append(cone(0.34, 0.08, 1.7, foam, (sx, sy, 0.95)))
for k in range(10):
    a = random.uniform(0, 6.28); r = random.uniform(0.5, 1.0)
    objs.append(sphere(random.uniform(0.07, 0.14), drop, (sx + math.cos(a) * r, sy + math.sin(a) * r * 0.8, random.uniform(0.5, 1.6)), seg=16))
fit_g = parent(objs, loc=(0, 0, 0.8), rot=(24, 0, -8), scale=0.76)
render('naval')
