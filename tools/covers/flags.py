import os, sys, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from globe import globe_material
subprocess.check_call(['python3', '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flagstrip.py')], env=dict(os.environ))
new_scene('#2f8cff', '#04163f', samples=int(os.environ.get('SAMPLES', 128)))
Z = 1.25
sphere(1.55, globe_material(ocean='#1250c8', thresh=0.47), loc=(0, 0, Z))
strip = image_material(os.path.join(TMP, 'flagstrip.png'), rough=0.5, coat=0.15)
from mathutils import Euler
def band(R, h, rot, off):
    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=h, vertices=128, end_fill_type='NOTHING')
    o = bpy.context.active_object
    o.data.materials.append(strip)
    for p in o.data.polygons: p.use_smooth = True
    s = o.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.08; s.offset = 1
    b = o.modifiers.new('b', 'BEVEL'); b.width = 0.02; b.segments = 3
    e = Euler(tuple(math.radians(r) for r in rot))
    ax = e.to_matrix() @ Vector((0, 0, 1))
    o.location = Vector((0, 0, Z)) + ax * off
    o.rotation_euler = e
    return o
band(1.46, 0.66, (-12, -18, 0), 0.62)
band(1.46, 0.66, (-12, -18, 0), -0.68)
shadow_catcher(0.0)
render('flags')
