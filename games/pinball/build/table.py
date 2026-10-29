# Blender: top-down (slightly tilted, orthographic) render of the playfield from the SAME geometry the physics uses.
#   TID=neon PASS=base|ramp COVER_TMP=<scratch> blender -b -P table.py     (needs <scratch>/<id>.json from export.mjs and paint_<id>.png)
import os, sys, json, math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'tools', 'covers')))
import bpy, bmesh
from mathutils import Vector
from rig import srgb, _mat, glossy, metal, matte, emit, cylinder, sphere

TID = os.environ.get('TID', 'neon')
PASS = os.environ.get('PASS', 'base')
SCR = os.environ.get('COVER_TMP', '/tmp')
SAMPLES = int(os.environ.get('S', 64))
TILT = 7.0
RW, RH = 800, int(round(1600 * math.cos(math.radians(TILT))))
U = 0.01
data = json.load(open(os.path.join(SCR, f'{TID}.json')))
CFG = {
    'neon': dict(bumper_tops=['#e8262c', '#e8262c', '#e8262c'], big=('#e8262c', 62, 118, 26), wall='#14224e', rail='#e8edf5', post='#d9232b'),
    'space': dict(bumper_tops=['#2a6fe0', '#2a6fe0', '#f2c21c'], big=('#2a6fe0', 62, 118, 26), wall='#2a1060', rail='#e4e0ff', post='#8a2fd0'),
}[TID]


def B(x, y, z=0.0):
    return ((x - 200) * U, (400 - y) * U, z)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = RW, RH
sc.render.film_transparent = PASS == 'ramp'
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
bg = w.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.8, 0.85, 1.0, 1)
bg.inputs['Strength'].default_value = 0.9


def light(kind, loc, energy, size=1.0, target=(0, 0, 0), color=(1, 1, 1), angle=None):
    d = bpy.data.lights.new('l', kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    if kind == 'SUN' and angle is not None:
        d.angle = angle
    o = bpy.data.objects.new('l', d)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


light('SUN', (-3, 3, 8), 2.4, angle=0.06, color=(1, 0.97, 0.92))
light('AREA', (-1.0, 1.6, 6.5), 260, size=3.5)
light('AREA', (1.5, -2, 5), 120, size=4, color=(0.9, 0.95, 1))

cd = bpy.data.cameras.new('cam')
cd.type = 'ORTHO'
cd.sensor_fit = 'HORIZONTAL'
cd.ortho_scale = 4.0
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam
t = math.radians(TILT)
cam.location = (0, -10 * math.sin(t), 10 * math.cos(t))
cam.rotation_euler = (t, 0, 0)

ALL = []
RAMP = []


def reg(o, ramp=False):
    (RAMP if ramp else ALL).append(o)
    return o


# ---- playfield
img = bpy.data.images.load(os.path.join(SCR, f'paint_{TID}.png'))
pm = bpy.data.materials.new('paint')
pm.use_nodes = True
nt = pm.node_tree
bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.2
bsdf.inputs['Coat Weight'].default_value = 1.0
bsdf.inputs['Coat Roughness'].default_value = 0.05
bpy.ops.mesh.primitive_plane_add(size=1)
pf = bpy.context.active_object
pf.dimensions = (4.0, 8.0, 0)
bpy.ops.object.transform_apply(scale=True)
pf.data.materials.append(pm)
reg(pf)

navy = glossy(CFG['wall'], 0.3, 0.7, 'wall')
chrome = metal('#e8ecf4', 0.08, 'chrome')
red = glossy(CFG['post'], 0.4, 0.5, 'post')
dark = glossy('#0a0a12', 0.5, 0.2, 'dark')
white = glossy('#f6f6fa', 0.25, 0.6, 'white')


def bar(x1, y1, x2, y2, h, th, mat, z0=0.0):
    (ax, ay, _), (bx, by, _) = B(x1, y1), B(x2, y2)
    L = math.hypot(bx - ax, by - ay)
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.dimensions = (L + th * 0.5, th, h)
    o.location = ((ax + bx) / 2, (ay + by) / 2, z0 + h / 2)
    o.rotation_euler = (0, 0, math.atan2(by - ay, bx - ax))
    o.data.materials.append(mat)
    m = o.modifiers.new('b', 'BEVEL')
    m.width, m.segments = th * 0.35, 2
    return reg(o)


def tube(x1, y1, x2, y2, r, z, mat, ramp=False):
    (ax, ay, _), (bx, by, _) = B(x1, y1), B(x2, y2)
    L = math.hypot(bx - ax, by - ay)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=14)
    o = bpy.context.active_object
    o.location = ((ax + bx) / 2, (ay + by) / 2, z)
    o.rotation_euler = (0, math.pi / 2, math.atan2(by - ay, bx - ax))
    o.data.materials.append(mat)
    for p in (o,):
        for q in p.data.polygons:
            q.use_smooth = True
    reg(o, ramp)
    return o


def ball(x, y, z, r, mat, ramp=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8)
    o = bpy.context.active_object
    o.location = (x, y, z)
    o.data.materials.append(mat)
    for q in o.data.polygons:
        q.use_smooth = True
    reg(o, ramp)
    return o


# ---- walls / rails (skip sling edges, they are drawn as rubber prisms)
sling_pts = set()
for s in data['slings']:
    for p in s['pts']:
        sling_pts.add((round(p[0], 2), round(p[1], 2)))
for s in data['segs']:
    if s['kind'] == 'sling':
        continue
    if s['kind'] == 'wall':
        a, b = (round(s['x1'], 2), round(s['y1'], 2)), (round(s['x2'], 2), round(s['y2'], 2))
        if a in sling_pts and b in sling_pts:
            continue
        bar(s['x1'], s['y1'], s['x2'], s['y2'], 0.12, 0.06, navy)
        tube(s['x1'], s['y1'], s['x2'], s['y2'], 0.024, 0.14, chrome)
        bx_, by_, _ = B(s['x2'], s['y2'])
        ball(bx_, by_, 0.14, 0.024, chrome)
    elif s['kind'] == 'gate':
        tube(s['x1'], s['y1'], s['x2'], s['y2'], 0.016, 0.07, chrome)
    elif s['kind'] == 'standup':
        mat = glossy('#ff7a1c', 0.25, 0.7, 'stand')
        bar(s['x1'], s['y1'], s['x2'], s['y2'], 0.07, 0.06, mat)
        bar(s['x1'], s['y1'], s['x2'], s['y2'], 0.012, 0.03, white, z0=0.07)
    elif s['kind'] == 'drop':
        bar(s['x1'], s['y1'], s['x2'], s['y2'], 0.012, 0.05, dark)

# ---- slingshots
rubber = glossy('#d8202c', 0.5, 0.35, 'rubber')
for s in data['slings']:
    pts = [B(p[0], p[1]) for p in s['pts']]
    me = bpy.data.meshes.new('sling')
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], p[1], 0.0)) for p in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, 0.1), verts=vv)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('sling', me)
    sc.collection.objects.link(o)
    o.data.materials.append(rubber)
    m = o.modifiers.new('b', 'BEVEL')
    m.width, m.segments = 0.02, 3
    reg(o)
    # white ridge along the kicking face (A -> C)
    bar(s['pts'][0][0], s['pts'][0][1], s['pts'][2][0], s['pts'][2][1], 0.015, 0.02, white, z0=0.1)
    for p in pts:
        ball(p[0], p[1], 0.11, 0.032, chrome)


# ---- poke-ball style dome bumpers
def pokeball(cx, cy, r, top_hex, z, ramp=False):
    mats = [glossy(top_hex, 0.12, 0.9, 'bt'), glossy('#f4f4f8', 0.12, 0.9, 'bw'), glossy('#14141c', 0.2, 0.7, 'bb')]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24)
    o = bpy.context.active_object
    for m in mats:
        o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
        c = p.center
        zz = c.z / r
        p.material_index = 2 if abs(zz) < 0.1 else (0 if zz < 0 else 1)
    # button on local +Y
    bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.3, depth=r * 0.12, vertices=32, location=(0, r * 0.97, 0), rotation=(math.pi / 2, 0, 0))
    btn = bpy.context.active_object
    btn.data.materials.append(mats[1])
    bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.32, minor_radius=r * 0.07, location=(0, r * 0.97, 0), rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=12)
    ring = bpy.context.active_object
    ring.data.materials.append(mats[2])
    e = bpy.data.objects.new('pb', None)
    sc.collection.objects.link(e)
    for c in (o, btn, ring):
        c.parent = e
    e.location = (cx, cy, z)
    e.rotation_euler = (math.radians(100), 0, 0)
    e.scale = (1, 1, 0.9)
    for c in (o, btn, ring):
        reg(c)
    return e


for i, b in enumerate(data['bumpers']):
    x, y, _ = B(b['x'], b['y'])
    cyl = cylinder(0.215, 0.05, navy, loc=(x, y, 0.025), seg=48)
    reg(cyl)
    t_ = bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.02, location=(x, y, 0.06), major_segments=48, minor_segments=12)
    to = bpy.context.active_object
    to.data.materials.append(chrome)
    reg(to)
    pokeball(x, y, 0.16, CFG['bumper_tops'][i % len(CFG['bumper_tops'])], 0.17)

# big dome feature
topc, bx0, by0, br = CFG['big']
x, y, _ = B(bx0, by0)
reg(cylinder(br * U * 1.12, 0.05, navy, loc=(x, y, 0.025), seg=48))
bpy.ops.mesh.primitive_torus_add(major_radius=br * U * 1.08, minor_radius=0.025, location=(x, y, 0.06), major_segments=48, minor_segments=12)
reg_o = bpy.context.active_object
reg_o.data.materials.append(chrome)
reg(reg_o)
pokeball(x, y, br * U * 1.0, topc, 0.2)

# posts
for p in data['posts']:
    x, y, _ = B(p['x'], p['y'])
    reg(cylinder(p['r'] * U * 1.1, 0.1, red, loc=(x, y, 0.05), seg=24))
    ball(x, y, 0.1, p['r'] * U * 0.8, chrome)

# ---- ramps (clear tube + chrome rails). Rendered as a separate transparent layer; in the base pass they only cast shadows.
glass = bpy.data.materials.new('glass')
glass.use_nodes = True
gn = glass.node_tree
for n in list(gn.nodes):
    gn.nodes.remove(n)
outn = gn.nodes.new('ShaderNodeOutputMaterial')
mix = gn.nodes.new('ShaderNodeMixShader')
tr = gn.nodes.new('ShaderNodeBsdfTransparent')
gl = gn.nodes.new('ShaderNodeBsdfGlossy')
gl.inputs['Roughness'].default_value = 0.08
gl.inputs['Color'].default_value = (0.8, 0.95, 1.0, 1)
mix.inputs['Fac'].default_value = 0.2
gn.links.new(tr.outputs[0], mix.inputs[1])
gn.links.new(gl.outputs[0], mix.inputs[2])
gn.links.new(mix.outputs[0], outn.inputs['Surface'])
ZR = 0.24
for r in data['ramps']:
    path = r['path']
    n = len(path)
    L, R_ = [], []
    for i in range(n):
        a = path[max(0, i - 1)]
        b = path[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        L.append((path[i][0] + nx * 12.5, path[i][1] + ny * 12.5))
        R_.append((path[i][0] - nx * 12.5, path[i][1] - ny * 12.5))
    # glass floor strip
    me = bpy.data.meshes.new('strip')
    bm = bmesh.new()
    vl = [bm.verts.new((*B(*p)[:2], ZR - 0.02)) for p in L]
    vr = [bm.verts.new((*B(*p)[:2], ZR - 0.02)) for p in R_]
    for i in range(n - 1):
        bm.faces.new([vl[i], vl[i + 1], vr[i + 1], vr[i]])
    bm.to_mesh(me)
    bm.free()
    so = bpy.data.objects.new('strip', me)
    sc.collection.objects.link(so)
    so.data.materials.append(glass)
    reg(so, True)
    for side in (L, R_):
        for i in range(n - 1):
            tube(side[i][0], side[i][1], side[i + 1][0], side[i + 1][1], 0.022, ZR, chrome, True)
            bx_, by_, _ = B(*side[i + 1])
            ball(bx_, by_, ZR, 0.022, chrome, True)
        for i in range(0, n, 4):
            x, y, _ = B(*side[i])
            c = cylinder(0.012, ZR, chrome, loc=(x, y, ZR / 2), seg=8)
            reg(c, True)
    # entry flare cups
    for p in (path[0], path[-1]):
        x, y, _ = B(*p)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.02, location=(x, y, ZR), major_segments=24, minor_segments=8)
        o = bpy.context.active_object
        o.data.materials.append(chrome)
        reg(o, True)

# ---- pass visibility
if PASS == 'base':
    for o in RAMP:
        o.visible_camera = False
else:
    for o in ALL:
        o.visible_camera = False
    sc.render.film_transparent = True

out_png = os.path.join(SCR, f'table_{TID}_{PASS}.png')
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA' if PASS == 'ramp' else 'RGB'
sc.render.filepath = out_png
bpy.ops.render.render(write_still=True)
print('table done', out_png)
