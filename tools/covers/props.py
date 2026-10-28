"""Shared props for covers (magnifier etc.)."""
from rig import *


def magnifier(scale=1.0, loc=(0, 0, 0), rot=(0, 0, 0), frame='#ffb020', handle='#7a3a12', lens_tint=(0.8, 0.95, 1.0), ang=-45):
    """Magnifier standing in XZ plane (facing -Y). Lens centre at local origin, handle goes down-right."""
    parts = []
    parts.append(torus(1.0, 0.16, metal(frame, 0.18, name='mag_frame'), rot=(90, 0, 0)))
    g = glass_material(lens_tint)
    lens = sphere(1.0, g, scale=(1, 0.08, 1))
    parts.append(lens)
    import math as m
    d = (m.cos(m.radians(ang)), 0, m.sin(m.radians(ang)))
    th = m.radians(90 - ang)
    fm = metal(frame, 0.18, name='mag_frame')
    hm = glossy(handle, 0.3, 0.7, name='mag_handle')
    c = cylinder(0.13, 0.5, fm, loc=(d[0] * 1.2, 0, d[2] * 1.2), bevel=0.02)
    c.rotation_euler = (0, th, 0)
    parts.append(c)
    h = cylinder(0.2, 1.5, hm, loc=(d[0] * 2.2, 0, d[2] * 2.2), bevel=0.06)
    h.rotation_euler = (0, th, 0)
    parts.append(h)
    parts.append(sphere(0.2, hm, loc=(d[0] * 2.95, 0, d[2] * 2.95)))
    return parent(parts, loc=loc, rot=rot, scale=scale)


def glass_material(tint=(0.8, 0.95, 1.0), ior=1.08, name='lens'):
    g = bpy.data.materials.new(name)
    g.use_nodes = True
    nt = g.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    gl = nt.nodes.new('ShaderNodeBsdfGlass')
    gl.inputs['Color'].default_value = (*tint, 1)
    gl.inputs['Roughness'].default_value = 0.0
    gl.inputs['IOR'].default_value = ior
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.35
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return g


def fit(scale=1.0, dz=0.0, dx=0.0):
    """Scale/shift everything built so far (not lights/camera) as one hero group, about the origin."""
    objs = [o for o in bpy.context.scene.objects if o.type not in ('LIGHT', 'CAMERA') and o.parent is None]
    e = bpy.data.objects.new('hero_grp', None)
    bpy.context.scene.collection.objects.link(e)
    for o in objs:
        o.parent = e
    e.scale = (scale,) * 3
    e.location = (dx, 0, dz)
    return e


def podium(color, r=3.3, h=0.5, z=0.0, rough=0.3):
    return cylinder(r, h, glossy(color, rough, 0.5, name='podium'), loc=(0, 0, z - h / 2), bevel=0.12, seg=96)
