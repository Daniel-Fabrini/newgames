import os, sys, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from globe import globe_material
subprocess.check_call(['python3', '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flagstrip.py')], env=dict(os.environ))
new_scene('#2f8cff', '#04163f', samples=int(os.environ.get('SAMPLES', 128)))
Z = 1.9
sphere(1.5, globe_material(), loc=(0, 0, Z))
strip = image_material(os.path.join(TMP, 'flagstrip.png'), rough=0.3, coat=0.5)
def band(R, h, rot, spin):
    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=h, vertices=128, end_fill_type='NOTHING')
    o = bpy.context.active_object
    o.data.materials.append(strip)
    for p in o.data.polygons: p.use_smooth = True
    s = o.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.07; s.offset = 1
    b = o.modifiers.new('b', 'BEVEL'); b.width = 0.015; b.segments = 2
    o.location = (0, 0, Z)
    o.rotation_euler = tuple(math.radians(r) for r in rot)
    return o
band(1.72, 0.62, (68, 0, 8), 0)
band(1.72, 0.55, (-62, 0, -14), 0)
# ground glow/shadow
ground('#0a3c9a', 0.35, z=0.0)
render('flags')
