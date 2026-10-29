# Blender (run with the project's blender binary): renders stylised 3D toy figures to transparent PNGs.
#   COVER_TMP=<outdir> blender -b -P figures.py
import os, sys, math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'tools', 'covers')))
import bpy
from mathutils import Vector
from rig import srgb, _mat, glossy, matte, emit, sphere, cylinder, cone, torus, box, _finish

OUT = os.environ.get('COVER_TMP', '/tmp')
SAMPLES = int(os.environ.get('S', 48))
RES = 512


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.75, 0.8, 0.95, 1)
    bg.inputs['Strength'].default_value = 0.35

    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy, d.size, d.color = energy, size, color
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.4)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('key', (-4, -6, 7), 520, 5, (1, 0.97, 0.92))
    area('fill', (5, -5, 3), 160, 6, (0.9, 0.95, 1))
    area('rim', (2, 5, 6), 500, 4)
    cd = bpy.data.cameras.new('cam')
    cd.lens = 80
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.location = (0, -10.5, 4.6)
    tgt = Vector((0, 0, 1.6))
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    return sc


def ell(r, loc, scale, mat, rot=(0, 0, 0)):
    o = sphere(r, mat, loc=loc, seg=48)
    o.scale = scale
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    return o


def eyes(x, y, z, r=0.11, mat=None, sep=None, hl=0.04):
    black = mat or glossy('#111118', 0.1, 0.9, name='eye')
    white = emit('#ffffff', 2.0, name='hl')
    for s in (-1, 1):
        ell(r, (s * x, y, z), (1, 0.6, 1.25), black)
        ell(hl * 1.6, (s * x + r * 0.25, y - r * 0.5, z + r * 0.5), (1, 0.6, 1), white)


def smile(x, y, z, w=0.2, mat=None, tilt=0):
    m = mat or glossy('#4a0d14', 0.4, 0.2, name='mouth')
    return ell(w * 0.55, (x, y, z), (1.0, 0.3, 0.55), m)


def pikachu():
    Y, B, R, K = glossy('#ffd51f', 0.3, 0.6, 'y'), glossy('#8a5a22', 0.4, 0.4, 'b'), glossy('#ee2a2a', 0.3, 0.6, 'r'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.85, (0, 0.1, 1.0), (1, 0.9, 1.1), Y)
    ell(0.85, (0, -0.05, 2.15), (1.2, 1.0, 0.95), Y)  # head
    for s in (-1, 1):
        ell(0.2, (s * 0.72, 0.0, 3.05), (0.8, 0.5, 2.0), Y, rot=(0, s * 24, 0))
        ell(0.17, (s * 1.02, 0.0, 3.62), (0.8, 0.5, 1.4), K, rot=(0, s * 24, 0))
        ell(0.2, (s * 0.7, -0.8, 1.85), (1, 0.5, 1), R)
        ell(0.2, (s * 0.7, -0.5, 1.2), (0.7, 0.7, 1.0), Y, rot=(0, s * 20, 0))
        ell(0.28, (s * 0.38, -0.5, 0.1), (1, 1.4, 0.6), Y)
    eyes(0.38, -0.88, 2.3, 0.15)
    ell(0.05, (0, -0.97, 2.12), (1.4, 0.7, 1), K)
    smile(0, -0.93, 1.92, 0.12)
    # tail: zigzag
    pts = [(0.6, 0.7, 0.5), (1.0, 0.75, 1.0), (0.65, 0.8, 1.4), (1.15, 0.8, 1.95), (0.85, 0.82, 2.45)]
    for i, p in enumerate(pts):
        box((0.7 - i * 0.04, 0.16, 0.5), Y if i else B, loc=p, rot=(0, 18 if i % 2 else -18, 0), bevel=0.04)


def charmander():
    O, C, K = glossy('#ff8a2a', 0.3, 0.6, 'o'), glossy('#ffe2a0', 0.35, 0.5, 'c'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.85, (0, 0.1, 1.1), (1, 0.85, 1.2), O)
    ell(0.62, (0, -0.55, 1.05), (1, 0.4, 1.15), C)
    ell(0.9, (0, -0.1, 2.35), (1.1, 1.0, 0.95), O)
    ell(0.45, (0, -0.75, 2.15), (1.1, 0.7, 0.7), O)
    for s in (-1, 1):
        ell(0.18, (s * 0.88, -0.2, 1.4), (0.8, 0.8, 1.2), O, rot=(0, s * 25, 0))
        ell(0.34, (s * 0.46, -0.45, 0.12), (1, 1.5, 0.6), O)
        ell(0.12, (s * 0.46, -0.9, 0.08), (1, 0.6, 0.4), C)
    eyes(0.42, -0.82, 2.55, 0.17, hl=0.05)
    smile(0, -1.1, 2.1, 0.15)
    # tail + flame
    ell(0.22, (0.7, 0.9, 0.6), (0.7, 0.7, 2.0), O, rot=(0, 25, 0))
    ell(0.35, (1.15, 0.9, 1.5), (0.9, 0.7, 2.0), emit('#ff4a00', 9.0, name='fl'), rot=(0, 15, 0))
    ell(0.2, (1.15, 0.85, 1.4), (0.9, 0.7, 1.6), emit('#ffd000', 12.0, name='fl2'), rot=(0, 15, 0))


def squirtle():
    Bl, C, Br, K = glossy('#58c4e8', 0.3, 0.6, 'bl'), glossy('#ffe9a8', 0.35, 0.5, 'c'), glossy('#a9692a', 0.35, 0.5, 'br'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.9, (0, 0.2, 1.1), (1, 0.9, 1.1), Br)  # shell behind
    ell(0.8, (0, -0.15, 1.05), (1, 0.7, 1.15), C)
    ell(0.9, (0, -0.1, 2.3), (1.1, 1.0, 0.95), Bl)
    for s in (-1, 1):
        ell(0.18, (s * 0.8, -0.35, 1.45), (0.8, 0.8, 1.2), Bl, rot=(0, s * 25, 0))
        ell(0.34, (s * 0.5, -0.45, 0.12), (1, 1.5, 0.6), Bl)
    eyes(0.43, -0.88, 2.4, 0.17, mat=glossy('#3a1c10', 0.1, 0.9, 'brn'), hl=0.05)
    smile(0, -0.98, 1.98, 0.2)
    t = torus(0.55, 0.16, Bl, loc=(0.9, 0.9, 0.7), rot=(80, 10, 30))


def bulbasaur():
    T, Dk, G, Rd, W = glossy('#5fc4a8', 0.35, 0.5, 't'), glossy('#2f8f78', 0.4, 0.4, 'dt'), glossy('#3fae3a', 0.3, 0.6, 'g'), glossy('#e0242a', 0.2, 0.8, 'rd'), emit('#ffffff', 2, 'w')
    ell(1.0, (0, 0.1, 1.0), (1.15, 1.0, 0.85), T)
    ell(0.95, (0, -0.55, 1.45), (1.15, 0.9, 0.9), T)
    ell(0.48, (0, -1.25, 1.2), (1.1, 0.8, 0.7), T)
    for s in (-1, 1):
        ell(0.3, (s * 0.55, -0.95, 2.2), (0.8, 0.5, 1.2), T, rot=(0, s * 20, 0))
        ell(0.34, (s * 0.7, -0.9, 0.1), (1, 1.4, 0.6), T)
        ell(0.34, (s * 0.7, 0.8, 0.1), (1, 1.4, 0.6), T)
        ell(0.12, (s * 0.75, -0.2, 1.7), (1, 1, 1), Dk)
        ell(0.18, (s * 0.46, -1.24, 1.6), (1, 0.5, 1.2), Rd)
        ell(0.07, (s * 0.46 + 0.03, -1.3, 1.65), (1, 0.5, 1.2), W)
    ell(0.9, (0, 0.6, 2.0), (1, 1, 1), G)
    cone(0.5, 0.0, 0.9, G, loc=(0, 0.6, 2.9))
    smile(0, -1.55, 1.05, 0.12)


def eevee():
    Br, C, K = glossy('#b9793c', 0.5, 0.3, 'br'), glossy('#ffe8c0', 0.5, 0.3, 'c'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.8, (0, 0.1, 1.0), (1, 0.9, 1.05), Br)
    ell(0.95, (0, -0.1, 2.15), (1.2, 1.0, 0.95), Br)
    for s in (-1, 1):
        ell(0.28, (s * 0.8, 0.0, 3.0), (0.7, 0.4, 1.9), Br, rot=(0, s * 14, 0))
        ell(0.12, (s * 0.8, -0.1, 3.5), (0.7, 0.4, 1.0), C, rot=(0, s * 14, 0))
        ell(0.34, (s * 0.4, -0.5, 0.1), (1, 1.4, 0.6), Br)
    for i, a in enumerate(range(-60, 61, 30)):
        cone(0.22, 0.0, 0.6, C, loc=(math.sin(math.radians(a)) * 0.6, -0.75, 1.3), rot=(100, 0, a))
    ell(0.55, (0, -0.55, 1.15), (1.1, 0.5, 0.8), C)
    eyes(0.44, -0.92, 2.2, 0.17, hl=0.05)
    ell(0.05, (0, -1.0, 1.98), (1.4, 0.7, 1), K)
    ell(0.6, (0.9, 0.9, 1.2), (0.9, 0.9, 1.5), Br, rot=(0, 25, 0))
    ell(0.38, (1.25, 0.9, 1.95), (0.9, 0.9, 1.0), C)


def meowth():
    C, Dk, Gd, K = glossy('#f6e4b0', 0.4, 0.4, 'c'), glossy('#6a3a20', 0.4, 0.4, 'dk'), glossy('#ffc933', 0.2, 0.8, 'gd'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.7, (0, 0.1, 0.8), (1, 0.9, 1.1), C)
    ell(1.0, (0, -0.1, 2.0), (1.35, 1.0, 0.95), C)
    for s in (-1, 1):
        cone(0.4, 0.0, 0.9, Dk, loc=(s * 1.0, 0.0, 3.0), rot=(0, s * 22, 0))
        cone(0.22, 0.0, 0.5, glossy('#ffd0c8', 0.4, 0.3, 'pk'), loc=(s * 0.95, -0.2, 2.9), rot=(0, s * 22, 0))
        ell(0.2, (s * 0.5, -0.85, 1.55), (1, 0.6, 1), Dk)
        ell(0.28, (s * 0.35, -0.3, 0.1), (1, 1.4, 0.6), Dk)
        for j in (-1, 0, 1):
            cylinder(0.012, 0.9, K, loc=(s * 1.3, -0.8, 1.95 + j * 0.14), rot=(0, 90, s * (-j) * 8))
    cylinder(0.24, 0.07, Gd, loc=(0, -0.95, 2.75), rot=(90, 0, 0), bevel=0.01)
    eyes(0.5, -0.88, 2.2, 0.17, hl=0.05)
    ell(0.07, (0, -1.0, 1.95), (1.4, 0.7, 1), glossy('#e8708a', 0.3, 0.5, 'nose'))
    smile(0, -0.98, 1.78, 0.2)
    ell(0.2, (0.9, 0.8, 1.2), (0.7, 0.7, 2.2), C, rot=(0, 40, 0))


def snorlax():
    Dk, C, K = glossy('#2f5c6e', 0.45, 0.3, 'dk'), glossy('#f6e8c8', 0.5, 0.3, 'c'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(1.8, (0, 0.1, 1.5), (1.15, 1.0, 1.0), Dk)
    ell(1.3, (0, -0.8, 1.35), (1.15, 0.6, 1.0), C)
    ell(1.1, (0, -0.4, 3.2), (1.3, 1.0, 0.95), Dk)
    ell(0.8, (0, -0.95, 3.0), (1.3, 0.5, 0.8), C)
    for s in (-1, 1):
        cone(0.28, 0.0, 0.6, Dk, loc=(s * 0.9, -0.3, 4.2), rot=(0, s * 18, 0))
        torus(0.2, 0.03, K, loc=(s * 0.5, -1.05, 3.35), rot=(90, 0, 0)).scale = (1, 1, 0.4)
        ell(0.6, (s * 1.9, -0.2, 1.4), (0.7, 0.8, 1.0), Dk)
        ell(0.55, (s * 0.8, -1.4, 0.2), (1, 1.2, 0.5), C)
    smile(0, -1.35, 2.9, 0.2)


def ditto():
    P = glossy('#c79af2', 0.25, 0.7, 'p')
    ell(1.2, (0, 0, 0.8), (1.5, 1.1, 0.7), P)
    ell(0.7, (-1.0, -0.1, 0.5), (1.2, 1.0, 0.5), P)
    eyes(0.4, -0.85, 1.15, 0.09)
    smile(0, -0.9, 0.95, 0.18)


def mewtwo():
    G, P, K = glossy('#c8bcd8', 0.35, 0.5, 'g'), glossy('#8a5ab0', 0.35, 0.5, 'pu'), glossy('#16161c', 0.3, 0.6, 'k')
    ell(0.7, (0, 0.1, 1.5), (1, 0.8, 1.8), G)
    ell(0.55, (0, -0.15, 3.2), (1, 0.9, 1.1), G)
    for s in (-1, 1):
        cone(0.18, 0.0, 0.9, G, loc=(s * 0.38, 0.0, 4.0), rot=(0, s * 12, 0))
        ell(0.15, (s * 1.0, -0.2, 2.2), (0.6, 0.6, 2.0), G, rot=(0, s * 14, 0))
        ell(0.25, (s * 0.5, -0.4, 0.1), (1, 1.5, 0.5), G)
        ell(0.12, (s * 0.25, -0.62, 3.25), (1.6, 0.5, 0.5), glossy('#7a2a9a', 0.2, 0.7, 'eye'))
    ell(0.5, (0, -0.35, 2.0), (1, 0.6, 1.2), P)
    ell(0.5, (1.0, 1.0, 0.9), (1, 1, 1), P)


FIGS = ['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'eevee', 'meowth', 'snorlax', 'ditto', 'mewtwo']

if __name__ == '__main__':
    only = os.environ.get('ONLY')
    for name in FIGS:
        if only and name not in only.split(','):
            continue
        sc = reset()
        globals()[name]()
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGBA'
        sc.render.filepath = os.path.join(OUT, f'fig_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('fig', name)
