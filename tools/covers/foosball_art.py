"""Pre-rendered art for the Foosball game (runs inside Blender).
   MODE=backdrop | rails | men | ball      OUTDIR=<dir for pngs>   S=<samples>   Q=<scale 0..1 preview>
Orthographic top-down so the art maps 1:1 onto the physics table (units: x 0..68, y 0..120, y down on screen)."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from rig import glossy, metal, matte, emit, box, cylinder, sphere, parent, srgb, _mat
from props import soccer_ball

MODE = os.environ.get('MODE', 'backdrop')
OUT = os.environ.get('OUTDIR', '/tmp')
S = int(os.environ.get('S', 64))
Q = float(os.environ.get('Q', 1))
CREST = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'games', 'foosball', 'assets', 'crest.png'))
TW, TH = 68.0, 120.0


def P(tx, ty, z=0):
    return (tx - 34.0, -(ty - 60.0), z)


def setup(w, h, ortho, sun_energy=3.2, world=0.5):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = S
    sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = int(w), int(h)
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.75, 0.82, 0.9, 1); bg.inputs['Strength'].default_value = world
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = ortho
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0, 0, 80); cam.rotation_euler = (0, 0, 0)
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = sun_energy; sd.angle = math.radians(7)
    sd.color = (1, 0.95, 0.88)
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
    so.rotation_euler = Vector((0.55, -0.6, -1.0)).to_track_quat('-Z', 'Y').to_euler()
    return sc


def table_camera(sc, h=105.0, zp=1.3):
    cam = sc.camera
    cam.data.type = 'PERSP'
    cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24
    half = 74.0
    cam.data.lens = 12.0 / (half / (h - zp))
    cam.location = (0, 0, h)
    # softbox gradient so glossy bevels pick up reflections
    wd = sc.world; nt = wd.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord'); gr = nt.nodes.new('ShaderNodeTexGradient')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, math.radians(35), math.radians(25))
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.04, 0.05, 0.06, 1)
    ramp.color_ramp.elements[1].position = 0.7; ramp.color_ramp.elements[1].color = (1, 0.97, 0.92, 1)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], gr.inputs['Vector'])
    nt.links.new(gr.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 2.2
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    sc.view_settings.look = 'AgX - High Contrast'


def render(name, sc):
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


def rect(x0, y0, x1, y1, z0, z1, mat, bevel=0.3, **kw):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    o = box((abs(x1 - x0), abs(y1 - y0), z1 - z0), mat, loc=P(cx, cy, (z0 + z1) / 2), bevel=bevel, **kw)
    return o


def poly_prism(pts, z0, z1, mat, bevel=0.0):
    me = bpy.data.meshes.new('pp'); o = bpy.data.objects.new('pp', me)
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new()
    vs = [bm.verts.new(P(x, y, z0)) for x, y in pts]
    f = bm.faces.new(vs)
    if f.normal.z < 0: f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in vv: v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
    return o


def strip(points, w, z, mat):
    """flat ribbon along a polyline (table coords)"""
    me = bpy.data.meshes.new('st'); o = bpy.data.objects.new('st', me)
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new()
    L, R = [], []
    n = len(points)
    for i, (x, y) in enumerate(points):
        a = points[max(0, i - 1)]; b = points[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l * w / 2, dx / l * w / 2
        L.append(bm.verts.new(P(x + nx, y + ny, z))); R.append(bm.verts.new(P(x - nx, y - ny, z)))
    for i in range(n - 1):
        bm.faces.new((L[i], L[i + 1], R[i + 1], R[i]))
    bm.to_mesh(me); bm.free()
    o.data.materials.append(mat)
    return o


def arc(cx, cy, r, a0, a1, w, z, mat, n=48):
    pts = [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    return strip(pts, w, z, mat)


def pline(pts, w, z, mat):
    return strip(pts, w, z, mat)


def wood_mat(name='wood', base1='#2f1608', base2='#6a3813', rough=0.16):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.2, 0.07, 1.2)
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 5; wv.inputs['Distortion'].default_value = 4.5; wv.inputs['Detail'].default_value = 3
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*srgb(base1), 1); ramp.color_ramp.elements[1].color = (*srgb(base2), 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    for k in ('Coat Weight', 'Clearcoat'):
        if k in b.inputs: b.inputs[k].default_value = 1.0; break
    return m


def grass_mat():
    m = bpy.data.materials.new('grass'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    # world y -> table y = 60 - y ; band = floor(ty/12) % 2
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY_ADD'; m1.inputs[1].default_value = -1 / 12; m1.inputs[2].default_value = 5.0
    nt.links.new(sep.outputs['Y'], m1.inputs[0])
    fl = nt.nodes.new('ShaderNodeMath'); fl.operation = 'FLOOR'; nt.links.new(m1.outputs[0], fl.inputs[0])
    md = nt.nodes.new('ShaderNodeMath'); md.operation = 'MODULO'; md.inputs[1].default_value = 2.0; nt.links.new(fl.outputs[0], md.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (*srgb('#14602c'), 1); mix.inputs[7].default_value = (*srgb('#2a9448'), 1)
    nt.links.new(md.outputs[0], mix.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 90; nz.inputs['Detail'].default_value = 6
    nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 3.0; nz2.inputs['Detail'].default_value = 2
    tc = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(tc.outputs['Object'], nz2.inputs['Vector'])
    mv = nt.nodes.new('ShaderNodeMix'); mv.data_type = 'RGBA'; mv.blend_type = 'MULTIPLY'; mv.inputs[0].default_value = 0.35
    nt.links.new(mix.outputs[2], mv.inputs[6]); nt.links.new(nz2.outputs['Color'], mv.inputs[7])
    nt.links.new(mv.outputs[2], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.05
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.9
    if 'Sheen Weight' in b.inputs: b.inputs['Sheen Weight'].default_value = 0.6
    return m


def image_decal(path, w, h, loc, name='decal'):
    img = bpy.data.images.load(path)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); mixs = nt.nodes.new('ShaderNodeMixShader')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); pb = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    pb.inputs['Roughness'].default_value = 0.55
    nt.links.new(tx.outputs['Color'], pb.inputs['Base Color'])
    nt.links.new(tx.outputs['Alpha'], mixs.inputs['Fac'])
    nt.links.new(tr.outputs[0], mixs.inputs[1]); nt.links.new(pb.outputs[0], mixs.inputs[2])
    nt.links.new(mixs.outputs[0], out.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.dimensions = (w, h, 0); bpy.ops.object.transform_apply(scale=True)
    o.location = loc; o.data.materials.append(m)
    return o


def build_table(only_rails=False):
    objs = {}
    woodm = wood_mat(); woodd = wood_mat('wood_d', '#3e2210', '#6b3f1c', 0.4)
    dark = matte('#06090c', 0.9, name='pocket')
    objs['rails'] = []
    # rails (hold rod holes in reality)
    for x0, x1 in ((-6.5, 0), (68, 74.5)):
        objs['rails'].append(rect(x0, -14, x1, 134, 0, 2.7, woodm, bevel=1.3))
    gold0 = metal('#e0b650', 0.16, name='gold')
    for x in (-3.25, 71.25):
        objs['rails'].append(rect(x - 0.3, -11.5, x + 0.3, 131.5, 2.5, 2.95, gold0, bevel=0.15))
    if only_rails:
        return objs
    rect(-6.5, -14, 74.5, 134, -0.4, 1.0, woodd, bevel=0.2)
    for y0, y1, s0, s1 in ((-14, 0, -14, -9), (120, 134, 129, 134)):
        rect(0, y0, 22, y1, 0, 2.7, woodm, bevel=1.1)
        rect(46, y0, 68, y1, 0, 2.7, woodm, bevel=1.1)
        rect(22, s0, 46, s1, 0, 2.7, woodm, bevel=1.1)
    # pocket floor + nets
    for y0, y1, top in ((-9, 0, True), (120, 129, False)):
        rect(22, y0, 46, y1, 0.9, 1.15, dark, bevel=0.0)
        netm = _mat('net', '#e8f0ff', 0.5, 0.0, 0.0)
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=18, y_subdivisions=7, size=1)
        g = bpy.context.active_object; g.dimensions = (24, 9, 0); bpy.ops.object.transform_apply(scale=True)
        for v in g.data.vertices:
            u = (v.co.x / 24 + 0.5); w = (v.co.y / 9 + 0.5)
            v.co.z = 2.6 - 1.1 * math.sin(math.pi * u) * math.sin(math.pi * w) ** 0.7
        g.location = P(34, (y0 + y1) / 2, 0)
        wf = g.modifiers.new('wf', 'WIREFRAME'); wf.thickness = 0.07; wf.use_even_offset = True
        g.data.materials.append(netm)
        # posts + crossbar
        yp = 0 if top else 120
        for x in (22, 46):
            cylinder(0.85, 3.3, glossy('#f6f8fb', 0.2, 0.8, name='post'), loc=P(x, yp, 1.55), bevel=0.15, seg=32)
            sphere(0.95, glossy('#f6f8fb', 0.2, 0.8, name='post'), loc=P(x, yp, 3.2), seg=24)
        cylinder(0.45, 24, glossy('#f6f8fb', 0.2, 0.8, name='post'), loc=P(34, yp, 3.05), rot=(0, 90, 0), bevel=0.0, seg=24)
    # playfield
    b = 8.0
    field = [(b, 0), (22, 0), (46, 0), (68 - b, 0), (68, b), (68, 120 - b), (68 - b, 120), (46, 120), (22, 120), (b, 120), (0, 120 - b), (0, b)]
    poly_prism(field, 0.9, 1.3, grass_mat())
    # corner bevels (wood wedges)
    for tri in (((0, 0), (b, 0), (0, b)), ((68, 0), (68 - b, 0), (68, b)), ((0, 120), (b, 120), (0, 120 - b)), ((68, 120), (68 - b, 120), (68, 120 - b))):
        poly_prism(list(tri), 0.9, 2.7, woodm, bevel=0.3)
    # markings
    wm = _mat('line', '#f5fbf5', 0.55)
    Z = 1.34; w = 0.5
    pline([(0.6, 60), (67.4, 60)], w, Z, wm)
    arc(34, 60, 10, 0, 2 * math.pi, w, Z, wm, 72)
    sd = matte('#ffffff', 0.5, name='dot')
    cylinder(0.8, 0.05, sd, loc=P(34, 60, Z + 0.02), bevel=0, seg=24)
    for top in (True, False):
        sgn = 1 if top else -1; y0 = 0 if top else 120
        def Y(d): return y0 + sgn * d
        pline([(14, Y(0.3)), (14, Y(15)), (54, Y(15)), (54, Y(0.3))], w, Z, wm)
        pline([(21, Y(0.3)), (21, Y(6)), (47, Y(6)), (47, Y(0.3))], w, Z, wm)
        a0, a1 = (0.2, math.pi - 0.2) if top else (math.pi + 0.2, 2 * math.pi - 0.2)
        arc(34, Y(15), 6.5, a0, a1, w, Z, wm, 32)
        cylinder(0.55, 0.05, sd, loc=P(34, Y(10.5), Z + 0.02), bevel=0, seg=16)
    pline([(0.6, 8.6), (8.6, 0.6)], w * 0.8, Z, wm)
    for a in ([(0.6, 8.6), (8.6, 0.6)], [(59.4, 0.6), (67.4, 8.6)], [(0.6, 111.4), (8.6, 119.4)], [(59.4, 119.4), (67.4, 111.4)]):
        pline(a, w * 0.8, Z, wm)
    pline([(0.6, 8.6), (0.6, 111.4)], w, Z, wm); pline([(67.4, 8.6), (67.4, 111.4)], w, Z, wm)
    # crest decal in the centre circle
    image_decal(CREST, 14.0, 16.0, P(34, 60, 1.37), 'crest')
    # score beads on the end strips
    gold = metal('#d9b04a', 0.18, name='gold')
    for yy, c1 in ((-11.5, '#2f7cff'), (131.5, '#e4372f')):
        cylinder(0.22, 52, metal('#cfd6df', 0.15, name='bead_rod'), loc=P(34, yy, 3.4), rot=(0, 90, 0), bevel=0, seg=16)
        for x in (8, 60):
            cylinder(0.6, 1.4, gold, loc=P(x, yy, 3.0), bevel=0.1, seg=16)
        for i in range(10):
            col = c1 if i < 5 else '#f4f4f4'
            x = 11 + i * 1.5 if i < 5 else 49 + (i - 5) * 1.5
            sphere(0.62, glossy(col, 0.18, 0.9, name='bead' + col), loc=P(x, yy, 3.45), seg=24)
    # corner caps + screws
    for x, y in ((-3.25, -11), (71.25, -11), (-3.25, 131), (71.25, 131)):
        cylinder(2.3, 0.5, gold, loc=P(x, y, 2.85), bevel=0.15, seg=48)
        cylinder(0.6, 0.15, metal('#7a5a1c', 0.3, name='screw'), loc=P(x, y, 3.15), bevel=0.02, seg=16)
    # shadow catcher
    bpy.ops.mesh.primitive_plane_add(size=400)
    pl = bpy.context.active_object; pl.location = (0, 0, -0.45); pl.is_shadow_catcher = True
    return objs


if MODE == 'backdrop':
    W_, H_ = int(1045 * Q), int(1628 * Q)
    sc = setup(W_, H_, 95.0 * 148 / 148, sun_energy=3.0, world=0.55)
    table_camera(sc)
    build_table()
    sp = bpy.data.lights.new('vig', 'AREA'); sp.energy = 6500; sp.size = 40; sp.shape = 'SQUARE'
    vo = bpy.data.objects.new('vig', sp); sc.collection.objects.link(vo); vo.location = (0, 0, 60)
    render('backdrop', sc)
elif MODE == 'rails':
    W_, H_ = int(1045 * Q), int(1628 * Q)
    sc = setup(W_, H_, 148.0, sun_energy=3.0, world=0.55)
    table_camera(sc)
    build_table(only_rails=True)
    sp = bpy.data.lights.new('vig', 'AREA'); sp.energy = 6500; sp.size = 40; sp.shape = 'SQUARE'
    vo = bpy.data.objects.new('vig', sp); sc.collection.objects.link(vo); vo.location = (0, 0, 60)
    render('rails', sc)
elif MODE == 'men':
    CW, CH, PPU = 168, 336, 14
    sc = setup(CW, CH, 24.0, sun_energy=5.2, world=1.3)
    skin = glossy('#ffd8b5', 0.4, 0.3, name='skin'); hair = glossy('#7a4f2a', 0.4, 0.4, name='hair')
    shoe = glossy('#111317', 0.25, 0.8, name='shoe'); sole = matte('#f2f2f2', 0.5, name='sole')
    kits = {
        0: dict(shirt='#f6f6f6', stripe1='#d8202a', stripe2='#111111', shorts='#111111', sock='#d8202a'),
        1: dict(shirt='#2f7cff', stripe1='#ffffff', stripe2='#163f9c', shorts='#ffffff', sock='#2f7cff'),
    }
    figs = {}
    for team in (0, 1):
        k = kits[team]
        sh = _mat(f'shirt{team}', k['shirt'], 0.35, 0.0, 0.5, '#ffffff' if team == 0 else '#2f7cff', 0.5 if team == 0 else 0.15); s1 = glossy(k['stripe1'], 0.3, 0.6, name=f's1{team}')
        s2 = glossy(k['stripe2'], 0.3, 0.6, name=f's2{team}'); sho = glossy(k['shorts'], 0.35, 0.5, name=f'shorts{team}')
        sk = glossy(k['sock'], 0.35, 0.5, name=f'sock{team}')
        steel_ = metal('#dfe5ec', 0.12, name='rodsteel2')
        dark_ = glossy('#101114', 0.4, 0.3, name='eye')
        parts = [
            # torso (shirt) with the kit band across the chest, sleeves and arms reaching forward
            box((5.0, 3.8, 5.2), sh, loc=(0, -1.0, -1.9), bevel=0.8),
            box((5.15, 0.8, 5.3), s1, loc=(0, 0.15, -1.9), bevel=0.15),
            box((5.15, 0.7, 5.3), s2, loc=(0, 0.9, -1.9), bevel=0.15),
            sphere(1.15, sh, loc=(-2.75, -1.1, 0.2), seg=24), sphere(1.15, sh, loc=(2.75, -1.1, 0.2), seg=24),
            box((1.25, 3.4, 1.25), sh, loc=(-3.05, 0.4, -0.5), bevel=0.4), box((1.25, 3.4, 1.25), sh, loc=(3.05, 0.4, -0.5), bevel=0.4),
            sphere(0.72, skin, loc=(-3.05, 2.3, -0.5), seg=20), sphere(0.72, skin, loc=(3.05, 2.3, -0.5), seg=20),
            # head: face towards +y (nose, eyes), hair cap behind
            sphere(1.5, skin, loc=(0, -1.5, 2.2), seg=32),
            sphere(0.33, skin, loc=(0, -0.05, 2.1), seg=16),
            sphere(0.2, dark_, loc=(-0.55, -0.2, 2.6), seg=12), sphere(0.2, dark_, loc=(0.55, -0.2, 2.6), seg=12),
            sphere(0.38, skin, loc=(-1.5, -1.6, 2.1), seg=14), sphere(0.38, skin, loc=(1.5, -1.6, 2.1), seg=14),
            sphere(1.55, hair, loc=(0, -2.0, 2.75), seg=32, scale=(1, 0.85, 0.62)),
            # chrome rod through the body with collars
            cylinder(0.5, 9.0, steel_, loc=(0, 0, 0), rot=(0, 90, 0), bevel=0, seg=20),
            cylinder(0.9, 0.55, steel_, loc=(-3.0, 0, 0), rot=(0, 90, 0), bevel=0.08, seg=24),
            cylinder(0.9, 0.55, steel_, loc=(3.0, 0, 0), rot=(0, 90, 0), bevel=0.08, seg=24),
            # shorts, socks, boots
            box((4.2, 2.8, 2.8), sho, loc=(0, -0.3, -5.7), bevel=0.5),
            box((3.2, 2.0, 2.8), sk, loc=(0, -0.1, -7.7), bevel=0.4),
            box((3.8, 3.4, 1.3), shoe, loc=(0, 0, -8.8), bevel=0.6),
            box((2.2, 0.35, 1.35), sole, loc=(0, 0.9, -8.75), bevel=0.05),
            box((3.9, 3.5, 0.3), sole, loc=(0, 0, -9.35), bevel=0.1),
        ]
        figs[team] = (parent(parts), parts)
    NA = 16
    th_list = [-1.0 + (2.1 * i / (NA - 1)) for i in range(NA)]
    for team in (0, 1):
        for i, th in enumerate(th_list):
            for t2, (e2, ps) in figs.items():
                for pp in ps: pp.hide_render = (t2 != team)
            f = figs[team][0]
            f.rotation_euler = (th, 0, math.pi if team == 1 else 0)
            render(f'man_{team}_{i:02d}', sc)
    print('TH', th_list)
elif MODE == 'ball':
    sc = setup(120, 120, 6.0, sun_energy=3.2, world=0.8)
    b = soccer_ball(2.2, loc=(0, 0, 0))
    NF = 12
    for i in range(NF):
        b.rotation_euler = (math.radians(360 * i / NF), math.radians(18), 0)
        render(f'ball_{i:02d}', sc)
