"""Shared studio rig for the DA Games cover renders (runs inside Blender 4.2).

Every cover uses the same camera, lights, backdrop construction, material look
and output size so the 15 covers read as one family:
  - 3D toy / glossy-plastic look, one hero object, soft studio light
  - saturated radial-gradient backdrop (colors per game), vignette
  - hero sits in the upper ~70% of the frame, the bottom ~28% stays calmer for the title

Usage (inside a cover script):
    from rig import *
    new_scene(bg_inner=(0.1,0.5,1.0), bg_outer=(0.02,0.08,0.3))
    ... build objects with glossy()/metal()/emit() materials ...
    render('flags')          # -> assets/covers/flags.webp (+ _debug.png in $COVER_TMP)
"""
import math
import os
import subprocess
import sys

import bpy
from mathutils import Vector

W, H = 640, 800
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'covers'))
TMP = os.environ.get('COVER_TMP', '/tmp')


def srgb(c):
    """(r,g,b) 0-1 or '#rrggbb' -> linear tuple, so colors can be written as in CSS."""
    if isinstance(c, str):
        c = c.lstrip('#')
        c = tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)


def new_scene(bg_inner='#3aa0ff', bg_outer='#06163a', samples=128, key_energy=900):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    # backdrop: world radial gradient (camera sees it directly)
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.5, 1.2, 1.5)
    mp.inputs['Location'].default_value = (-0.75, -0.74, 0)
    mp.inputs['Rotation'].default_value = (0, 0, 0)
    nt.links.new(tc.outputs['Window'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].color = (*srgb(bg_outer), 1)
    ramp.color_ramp.elements[1].color = (*srgb(bg_inner), 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    # floor-less studio lights: key (top-left), fill (right), rim (back)
    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy, d.size, d.color = energy, size, color
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o
    area('key', (-3.5, -4.5, 5.5), key_energy, 4.5, (1, 0.96, 0.9))
    area('fill', (5, -3.5, 2.0), key_energy * 0.35, 5, (0.9, 0.95, 1))
    area('rim', (1.5, 5, 4.5), key_energy * 0.8, 3, (1, 1, 1))
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 62
    cam_d.sensor_width = 36
    cam = bpy.data.objects.new('cam', cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    # hero sits around z~1; camera looks slightly down, framing shifted up so the title area is calm
    cam.location = (0, -13, 3.2)
    cam.rotation_euler = (math.radians(80), 0, 0)
    cam_d.shift_y = -0.06
    return sc


# ------------------------------------------------------------ materials
def _mat(name, base, rough=0.25, metal=0.0, coat=0.0, emit=None, emit_strength=0.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(base), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k in ('Coat Weight', 'Clearcoat'):
        if k in b.inputs:
            b.inputs[k].default_value = coat
            break
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def glossy(color, rough=0.22, coat=0.6, name=None):
    """Toy-plastic: slightly rough base with a clear coat."""
    return _mat(name or f'gl_{color}', color, rough, 0.0, coat)


def metal(color='#d4a62a', rough=0.22, name=None):
    return _mat(name or f'mt_{color}', color, rough, 1.0, 0.0)


def matte(color, rough=0.8, name=None):
    return _mat(name or f'mx_{color}', color, rough)


def emit(color, strength=3.0, name=None):
    return _mat(name or f'em_{color}', color, 0.5, 0.0, 0.0, color, strength)


def image_material(path, rough=0.35, coat=0.4, name=None):
    """Glossy material textured with an image (flag, label...). Needs UVs."""
    m = bpy.data.materials.new(name or os.path.basename(path))
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(path)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    for k in ('Coat Weight', 'Clearcoat'):
        if k in b.inputs:
            b.inputs[k].default_value = coat
            break
    return m


# ------------------------------------------------------------ geometry helpers
def _finish(o, mat, bevel=0.0, smooth=True, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    o.location, o.rotation_euler, o.scale = loc, tuple(math.radians(r) for r in rot), scale
    if mat:
        o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if bevel:
        bm = o.modifiers.new('bevel', 'BEVEL')
        bm.width, bm.segments, bm.limit_method = bevel, 4, 'ANGLE'
    return o


def sphere(r=1, mat=None, loc=(0, 0, 0), seg=64, **kw):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2)
    return _finish(bpy.context.active_object, mat, loc=loc, **kw)


def box(size=(1, 1, 1), mat=None, loc=(0, 0, 0), bevel=0.06, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.dimensions = size
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, mat, bevel=bevel, loc=loc, smooth=False, **kw)


def cylinder(r=1, depth=1, mat=None, loc=(0, 0, 0), bevel=0.04, seg=64, **kw):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=seg)
    return _finish(bpy.context.active_object, mat, bevel=bevel, loc=loc, **kw)


def cone(r1=1, r2=0, depth=1, mat=None, loc=(0, 0, 0), seg=48, **kw):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=seg)
    return _finish(bpy.context.active_object, mat, loc=loc, **kw)


def torus(R=1, r=0.2, mat=None, loc=(0, 0, 0), **kw):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=24)
    return _finish(bpy.context.active_object, mat, loc=loc, **kw)


def plane(size=(1, 1), mat=None, loc=(0, 0, 0), **kw):
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.dimensions = (size[0], size[1], 0)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, mat, loc=loc, smooth=False, **kw)


def text(s, mat=None, size=1.0, extrude=0.12, loc=(0, 0, 0), rot=(90, 0, 0), bevel=0.02):
    bpy.ops.object.text_add()
    o = bpy.context.active_object
    o.data.body = s
    o.data.size = size
    o.data.extrude = extrude
    o.data.bevel_depth = bevel
    o.data.align_x = 'CENTER'
    o.data.align_y = 'CENTER'
    o.location, o.rotation_euler = loc, tuple(math.radians(r) for r in rot)
    if mat:
        o.data.materials.append(mat)
    return o


def ground(color='#000000', rough=0.4, z=0.0, size=40):
    """Glossy floor that catches soft reflections under the hero."""
    return plane((size, size), _mat('ground', color, rough, 0, 0.0), loc=(0, 0, z))


def shadow_catcher(z=0.0):
    p = plane((60, 60), None, loc=(0, 0, z))
    p.is_shadow_catcher = True
    return p


def parent(children, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    e = bpy.data.objects.new('grp', None)
    bpy.context.scene.collection.objects.link(e)
    for c in children:
        c.parent = e
    e.location, e.rotation_euler, e.scale = loc, tuple(math.radians(r) for r in rot), (scale,) * 3
    return e


# ------------------------------------------------------------ output
def render(name, debug=False):
    sc = bpy.context.scene
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(TMP, f'{name}.png')
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = png
    bpy.ops.render.render(write_still=True)
    # PNG -> WebP via cwebp / PIL (done outside Blender to keep this script small)
    webp = os.path.join(OUT, f'{name}.webp')
    try:  # Blender's python has no PIL: use the system python
        subprocess.check_call(['python3', '-I', '-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=84,method=6)', png, webp])
    except Exception as e:
        print(f'WARN: webp conversion failed ({e}); PNG kept at {png}')
    print('cover:', name, png)
    return png
