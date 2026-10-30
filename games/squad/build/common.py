"""Shared helpers for the War Command sprite renders (run inside Blender 4.2+/5.x).

Every sprite is rendered with a transparent background by an orthographic camera
that looks down at the game's view angle (ELEV degrees above the horizon), so the
pre-rendered units match the pseudo-3D road drawn by render.js.

Each render writes a PNG frame into $SQUAD_TMP/frames/<name>.png plus a small JSON
sidecar with the pixel position of the anchor (world origin = feet / ground point)
and the pixels-per-metre used, so pack.py can build the atlases and atlas.js.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'tools', 'covers'))
sys.path.insert(0, COVERS)
from rig import srgb  # noqa: E402  (shared colour helper of the cover renders)

TMP = os.environ.get('SQUAD_TMP', '/tmp/squad_build')
FRAMES = os.path.join(TMP, 'frames')
os.makedirs(FRAMES, exist_ok=True)
SAMPLES = int(os.environ.get('SAMPLES', 32))
ELEV = 38.0  # camera elevation in degrees (matches render.js PITCH at mid screen)
HDRI = os.environ.get('PH_HDRI', '/tmp/claude-0/-home-user-newgames/337c13fa-8c03-56c4-b57a-40498e6cdc26/scratchpad/hog3d/cache/hdris/construction_yard_4k.hdr')
MODELS = os.environ.get('PH_MODELS', '/tmp/claude-0/-home-user-newgames/337c13fa-8c03-56c4-b57a-40498e6cdc26/scratchpad/hog3d/cache/models')


def reset(world_color='#b9c9e6', world_strength=0.55, sun=4.0, sun_dir=(-35, 0, -40), rim=1.6, hdri=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
    sc.render.film_transparent = True
    sc.render.filter_size = 1.2
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb(world_color), 1)
    bg.inputs['Strength'].default_value = world_strength
    if hdri and os.path.exists(HDRI):
        # CC0 outdoor HDRI: gives metals (gold statues) something to reflect
        env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
        env.image = bpy.data.images.load(HDRI)
        mp = w.node_tree.nodes.new('ShaderNodeMapping')
        tc = w.node_tree.nodes.new('ShaderNodeTexCoord')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(120))
        w.node_tree.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
        w.node_tree.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        w.node_tree.links.new(env.outputs['Color'], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = world_strength * hdri
    # key sun: from the camera side, upper left
    d = bpy.data.lights.new('sun', 'SUN')
    d.energy = sun
    d.angle = math.radians(8)
    o = bpy.data.objects.new('sun', d)
    sc.collection.objects.link(o)
    o.rotation_euler = tuple(math.radians(a) for a in sun_dir)
    # warm rim from behind
    if rim:
        d2 = bpy.data.lights.new('rim', 'SUN')
        d2.energy = rim
        d2.color = (1.0, 0.9, 0.75)
        o2 = bpy.data.objects.new('rim', d2)
        sc.collection.objects.link(o2)
        o2.rotation_euler = (math.radians(-60), 0, math.radians(160))
    cam_d = bpy.data.cameras.new('cam')
    cam_d.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc


def camera(ppm, w, h, look=(0, 0, 0.9), elev=ELEV, yaw=0.0):
    """Ortho camera: `ppm` pixels per metre, w×h pixels, centred on `look`.
    yaw rotates the view around Z (degrees, + looks to the left)."""
    sc = bpy.context.scene
    cam = sc.camera
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    cam.data.ortho_scale = max(w, h) / ppm
    el = math.radians(elev)
    yw = math.radians(yaw)
    dist = 30
    dirv = Vector((-math.sin(yw) * math.cos(el), math.cos(yw) * math.cos(el), -math.sin(el)))  # camera looks along +Y, down
    cam.location = Vector(look) - dirv * dist
    cam.rotation_euler = (math.radians(90) - el, 0, yw)
    cam.data.clip_end = 200
    return cam


def project(p):
    sc = bpy.context.scene
    v = world_to_camera_view(sc, sc.camera, Vector(p))
    return (v.x * sc.render.resolution_x, (1 - v.y) * sc.render.resolution_y)


def shoot(name, ppm, anchors=None):
    """Render the current scene into frames/<name>.png with anchor metadata."""
    sc = bpy.context.scene
    path = os.path.join(FRAMES, name + '.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    meta = {'ppm': ppm, 'a': project((0, 0, 0))}
    for k, p in (anchors or {}).items():
        meta[k] = project(p)
    with open(os.path.join(FRAMES, name + '.json'), 'w') as f:
        json.dump(meta, f)
    print('frame', name)


# ------------------------------------------------------------ materials
def mat(name, color, rough=0.35, metal=0.0, coat=0.3, emit=None, estr=0.0, sss=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = estr
    return m


def gold():
    return mat('gold', '#ffd04a', rough=0.3, metal=0.78, coat=0.35)


# ------------------------------------------------------------ primitives (parented to `par`)
def _fin(o, m, par, smooth=True, bevel=0.0):
    if m:
        o.data.materials.append(m)
    if smooth and o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = True
    if bevel:
        bm = o.modifiers.new('bv', 'BEVEL')
        bm.width, bm.segments, bm.limit_method = bevel, 3, 'ANGLE'
    if par is not None:
        o.parent = par
    return o


def box(size, loc, m, par=None, bevel=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=tuple(math.radians(r) for r in rot))
    o = bpy.context.active_object
    o.scale = (size[0] / 1, size[1] / 1, size[2] / 1)
    bpy.ops.object.transform_apply(scale=True)
    o = _fin(o, m, None, smooth=False, bevel=bevel)
    _reparent(o, par)
    return o


def ball(r, loc, m, par=None, scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object
    o.scale = scale
    _fin(o, m, None)
    _reparent(o, par)
    return o


def cyl(r, depth, loc, m, par=None, rot=(0, 0, 0), seg=20, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=seg, rotation=tuple(math.radians(a) for a in rot))
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, vertices=seg, rotation=tuple(math.radians(a) for a in rot))
    o = bpy.context.active_object
    _fin(o, m, None, bevel=bevel)
    _reparent(o, par)
    return o


def limb(a, b, r, m, par=None, r2=None, seg=16):
    """Capsule-ish cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=seg) if r2 is None else bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=d.length, location=(a + b) / 2, vertices=seg)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    _fin(o, m, None)
    _reparent(o, par)
    ball(r, tuple(a), m, par, seg=12)
    ball(r2 if r2 is not None else r, tuple(b), m, par, seg=12)
    return o


def torus(R, r, loc, m, par=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=tuple(math.radians(a) for a in rot), major_segments=40, minor_segments=12)
    o = bpy.context.active_object
    _fin(o, m, None)
    _reparent(o, par)
    return o


def empty(name, loc, par=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    bpy.context.view_layer.update()
    _reparent(e, par)
    bpy.context.view_layer.update()
    return e


def _reparent(o, par):
    if par is None:
        return
    bpy.context.view_layer.update()
    keep = o.matrix_world.copy()
    o.parent = par
    o.matrix_parent_inverse = par.matrix_world.inverted()
    o.matrix_world = keep


def set_all_materials(root, m):
    """Replace every material under `root` with m (golden statues, grey corpses)."""
    stack = [root]
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type in ('MESH', 'CURVE', 'FONT') and o.data:
            o.data.materials.clear()
            o.data.materials.append(m)


def append_model(name, lod=None):
    """Append a cached Poly Haven (CC0) model's mesh objects; returns them."""
    path = os.path.join(MODELS, name, name + '.blend')
    with bpy.data.libraries.load(path) as (src, dst):
        want = [n for n in src.objects if (lod is None or n.endswith(lod))]
        dst.objects = want
    out = []
    for o in dst.objects:
        if o is None:
            continue
        bpy.context.scene.collection.objects.link(o)
        out.append(o)
    return out
