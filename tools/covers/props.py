"""Shared props for covers (magnifier etc.)."""
from rig import *


def magnifier(scale=1.0, loc=(0, 0, 0), rot=(0, 0, 0), frame='#ffb020', handle='#7a3a12', lens_tint=(0.8, 0.95, 1.0)):
    """Magnifier standing in XZ plane (facing -Y). Lens centre at local origin, handle goes down-right."""
    parts = []
    parts.append(torus(1.0, 0.16, metal(frame, 0.18, name='mag_frame'), rot=(90, 0, 0)))
    g = bpy.data.materials.new('lens')
    g.use_nodes = True
    b = g.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lens_tint, 1)
    b.inputs['Roughness'].default_value = 0.02
    for k in ('Transmission Weight', 'Transmission'):
        if k in b.inputs:
            b.inputs[k].default_value = 0.9
            break
    b.inputs['IOR'].default_value = 1.15
    lens = sphere(1.0, g, scale=(1, 0.08, 1))
    parts.append(lens)
    # handle: collar + grip along direction 45deg down-right
    import math as m
    ang = -45
    d = (m.cos(m.radians(ang)), 0, m.sin(m.radians(ang)))
    c = cylinder(0.13, 0.5, metal(frame, 0.18, name='mag_frame'), loc=(d[0] * 1.2, 0, d[2] * 1.2), rot=(0, 90 - ang - 90 + 90 - 90 + 0, 0), bevel=0.02)
    c.rotation_euler = (0, m.radians(90 - ang), 0)
    c.rotation_euler = (0, m.radians(-ang + 90 - 90 + 90), 0) if False else (0, m.radians(90 + 45), 0)
    parts.append(c)
    h = cylinder(0.2, 1.5, glossy(handle, 0.3, 0.7, name='mag_handle'), loc=(d[0] * 2.2, 0, d[2] * 2.2), bevel=0.06)
    h.rotation_euler = (0, m.radians(135), 0)
    parts.append(h)
    cap = sphere(0.2, glossy(handle, 0.3, 0.7, name='mag_handle'), loc=(d[0] * 2.95, 0, d[2] * 2.95))
    parts.append(cap)
    return parent(parts, loc=loc, rot=rot, scale=scale)
