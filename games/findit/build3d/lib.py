"""Blender helpers for the hidden-object scene builder (runs inside Blender 4.2).

Scenes are composed procedurally but art-directed by the recipes: a room or an
outdoor set, furniture placed by hand, then every support surface (shelf
boards, tabletops, crate lids, the floor) is found with ray casts and densely
populated with props from a themed pool, without intersections (AABB tests)
and only where the camera can see them.

Every placed prop gets its own pass index, so the Cycles object-index pass
tells post.py exactly which pixels belong to which object.
"""
import json
import math
import os
import random

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

CACHE = os.environ.get('HOG3D_CACHE') or os.path.expanduser('~/.cache/hog3d')


# ---------------------------------------------------------------- basics
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def model_path(asset):
    return os.path.join(CACHE, 'models', asset, asset + '.blend')


def tex_dir(name):
    return os.path.join(CACHE, 'textures', name)


def hdri_path(name, res='2k'):
    return os.path.join(CACHE, 'hdris', f'{name}_{res}.hdr')


# ---------------------------------------------------------------- materials
def _img(path, colorspace='sRGB'):
    im = bpy.data.images.load(path, check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def tex_material(name, tex, scale=1.0, tint=None, rough_mul=1.0, bump=1.0, rot=0.0, mapping='UV'):
    """PBR material from a Poly Haven texture folder (diff/nor/rough/arm)."""
    key = f'{name}'
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    d = tex_dir(tex)
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale)
    mp.inputs['Rotation'].default_value[2] = rot
    nt.links.new(tc.outputs['Object' if mapping == 'OBJECT' else 'UV'], mp.inputs['Vector'])
    diff = nt.nodes.new('ShaderNodeTexImage')
    diff.image = _img(os.path.join(d, 'diff.jpg'))
    if mapping == 'BOX':
        diff.projection = 'BOX'
        diff.projection_blend = 0.2
    nt.links.new(mp.outputs['Vector'], diff.inputs['Vector'])
    col = diff.outputs['Color']
    if tint:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(col, mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        col = mix.outputs[2]
    nt.links.new(col, bsdf.inputs['Base Color'])
    rp = os.path.join(d, 'rough.jpg')
    if os.path.exists(rp):
        r = nt.nodes.new('ShaderNodeTexImage')
        r.image = _img(rp, 'Non-Color')
        if mapping == 'BOX':
            r.projection = 'BOX'
            r.projection_blend = 0.2
        nt.links.new(mp.outputs['Vector'], r.inputs['Vector'])
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.use_clamp = True
        mul.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs['Color'], mul.inputs[0])
        nt.links.new(mul.outputs[0], bsdf.inputs['Roughness'])
    np_ = os.path.join(d, 'nor.jpg')
    if os.path.exists(np_) and bump > 0:
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = _img(np_, 'Non-Color')
        if mapping == 'BOX':
            n.projection = 'BOX'
            n.projection_blend = 0.2
        nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = bump
        nt.links.new(n.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def flat_material(name, color, rough=0.6, metal=0.0, emit=None, emit_strength=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


# ---------------------------------------------------------------- simple geometry
def box(name, x0, y0, z0, x1, y1, z1, mat=None, coll=None, uv_scale=1.0):
    """Axis-aligned box with world-size UVs (1 UV unit = 1 m * uv_scale)."""
    import bmesh

    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res['verts']:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            c = l.vert.co
            if abs(n.z) > 0.5:
                u, v = c.x, c.y
            elif abs(n.x) > 0.5:
                u, v = c.y, c.z
            else:
                u, v = c.x, c.z
            l[uv].uv = (u * uv_scale, v * uv_scale)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    if mat:
        me.materials.append(mat)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def plane(name, verts, mat=None, coll=None, uv_scale=1.0, uv_axes='xy'):
    """Quad from 4 world-space corners with world-size UVs."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    me.uv_layers.new()
    ia, ib = {'x': 0, 'y': 1, 'z': 2}[uv_axes[0]], {'x': 0, 'y': 1, 'z': 2}[uv_axes[1]]
    for li, loop in enumerate(me.loops):
        co = verts[loop.vertex_index]
        me.uv_layers[0].data[li].uv = (co[ia] * uv_scale, co[ib] * uv_scale)
    ob = bpy.data.objects.new(name, me)
    if mat:
        me.materials.append(mat)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


# ---------------------------------------------------------------- assets
_loaded = {}


def load_asset(asset):
    """Append every object of a cached Poly Haven .blend (unlinked)."""
    if asset in _loaded:
        return _loaded[asset]
    path = model_path(asset)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    objs = [o for o in dst.objects if o is not None]
    meshes = [o for o in objs if o.type == 'MESH']
    for o in objs:
        if o.type not in ('MESH', 'EMPTY'):
            bpy.data.objects.remove(o)
    _loaded[asset] = meshes
    return meshes


class Proto:
    """A placeable thing: an asset (or some named parts of it), optionally
    pre-rotated, with its bounding box measured after that rotation."""

    def __init__(self, asset, parts=None, pre=None, exclude=None, key=None):
        self.asset = asset
        self.key = key or asset
        meshes = load_asset(asset)
        if parts:
            meshes = [o for o in meshes if any(p.lower() in o.name.lower() for p in parts)]
        if exclude:
            meshes = [o for o in meshes if not any(p.lower() in o.name.lower() for p in exclude)]
        if not meshes:
            raise ValueError(f'{asset}: no mesh parts {parts}')
        self.src = meshes
        self.pre = pre or Matrix.Identity(4)
        pts = []
        for o in meshes:
            mw = self.pre @ o.matrix_world
            me = o.data
            n = len(me.vertices)
            co = np.empty(n * 3, dtype=np.float32)
            me.vertices.foreach_get('co', co)
            co = co.reshape(-1, 3)
            if n > 4000:
                co = co[:: max(1, n // 4000)]
            M = np.array(mw)
            w = co @ M[:3, :3].T + M[:3, 3]
            pts.append(w)
        P = np.concatenate(pts)
        self.pts = P
        self.min = Vector(P.min(axis=0))
        self.max = Vector(P.max(axis=0))
        self.size = self.max - self.min
        self.base = Vector(((self.min.x + self.max.x) / 2, (self.min.y + self.max.y) / 2, self.min.z))

    def footprint(self, yaw, scale):
        """Half extents (x, y) of the AABB after yaw rotation and scale."""
        c, s = abs(math.cos(yaw)), abs(math.sin(yaw))
        hx = (self.size.x * c + self.size.y * s) / 2 * scale
        hy = (self.size.x * s + self.size.y * c) / 2 * scale
        return hx, hy

    def matrix(self, loc, yaw=0.0, scale=1.0, extra=None):
        M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(yaw, 4, 'Z')
        if extra is not None:
            M = M @ extra
        return M @ Matrix.Scale(scale, 4) @ Matrix.Translation(-self.base) @ self.pre

    def instance(self, loc, yaw=0.0, scale=1.0, coll=None, index=0, extra=None):
        M = self.matrix(loc, yaw, scale, extra)
        out = []
        for o in self.src:
            c = o.copy()
            c.parent = None
            c.matrix_world = M @ o.matrix_world
            c.pass_index = index
            (coll or bpy.context.scene.collection).objects.link(c)
            out.append(c)
        return out


_protos = {}


def proto(spec):
    """spec: 'asset' | 'asset/part1,part2' | dict(asset=, parts=, pre=, key=)."""
    if isinstance(spec, Proto):
        return spec
    if isinstance(spec, str):
        if '/' in spec:
            a, p = spec.split('/', 1)
            spec = {'asset': a, 'parts': p.split(','), 'key': spec}
        else:
            spec = {'asset': spec}
    k = json.dumps({k: (str(v) if k == 'pre' else v) for k, v in spec.items()}, sort_keys=True)
    if k not in _protos:
        pre = spec.get('pre')
        if isinstance(pre, str):
            pre = {
                'lie_x': Matrix.Rotation(math.pi / 2, 4, 'X'),
                'lie_y': Matrix.Rotation(math.pi / 2, 4, 'Y'),
                'lie_-x': Matrix.Rotation(-math.pi / 2, 4, 'X'),
                'flip': Matrix.Rotation(math.pi, 4, 'Z'),
                'side': Matrix.Rotation(math.pi / 2, 4, 'Z'),
            }[pre]
        _protos[k] = Proto(spec['asset'], spec.get('parts'), pre, spec.get('exclude'), spec.get('key'))
    return _protos[k]


# ---------------------------------------------------------------- world-space BVH
def bvh_of(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        mw = o.matrix_world
        n = len(me.vertices)
        co = np.empty(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        M = np.array(mw)
        w = co @ M[:3, :3].T + M[:3, 3]
        base = len(verts)
        verts.extend(map(tuple, w))
        me.calc_loop_triangles()
        tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
        me.loop_triangles.foreach_get('vertices', tri)
        tri = tri.reshape(-1, 3) + base
        polys.extend(map(tuple, tri))
        ev.to_mesh_clear()
    if not polys:
        return None
    return BVHTree.FromPolygons(verts, polys, all_triangles=True, epsilon=0.0)


def aabb_of(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, p))
            mx = Vector(map(max, mx, p))
    return mn, mx


# ---------------------------------------------------------------- support levels
class Level:
    """A horizontal support region at height z sampled on a grid."""

    def __init__(self, z, x0, y0, cell, mask, clear, tag=''):
        self.z = z
        self.x0 = x0
        self.y0 = y0
        self.cell = cell
        self.mask = mask  # bool [ny, nx]
        self.clear = clear  # float [ny, nx] free height above
        self.tag = tag
        self.area = mask.sum() * cell * cell
        ys, xs = np.nonzero(mask)
        self.cells = list(zip(xs, ys))

    def fits(self, x, y, hx, hy, h):
        c = self.cell
        i0 = int(math.floor((x - hx - self.x0) / c))
        i1 = int(math.floor((x + hx - self.x0) / c))
        j0 = int(math.floor((y - hy - self.y0) / c))
        j1 = int(math.floor((y + hy - self.y0) / c))
        ny, nx = self.mask.shape
        if i0 < 0 or j0 < 0 or i1 >= nx or j1 >= ny:
            return False
        m = self.mask[j0:j1 + 1, i0:i1 + 1]
        if not m.all():
            return False
        return self.clear[j0:j1 + 1, i0:i1 + 1].min() >= h

    def random_point(self, rnd):
        i, j = self.cells[rnd.randrange(len(self.cells))]
        return (self.x0 + (i + rnd.random()) * self.cell, self.y0 + (j + rnd.random()) * self.cell)


def scan_levels(objs, cell=0.02, min_area=0.012, max_clear=0.9, tag='', bvh=None, region=None, min_clear=0.04):
    """Find the up-facing support surfaces of some objects with vertical rays."""
    bvh = bvh or bvh_of(objs)
    mn, mx = aabb_of(objs)
    if region:
        mn = Vector((max(mn.x, region[0]), max(mn.y, region[1]), mn.z))
        mx = Vector((min(mx.x, region[2]), min(mx.y, region[3]), mx.z))
    if mx.x - mn.x > 12 or mx.y - mn.y > 12:
        return []
    nx = max(1, int((mx.x - mn.x) / cell))
    ny = max(1, int((mx.y - mn.y) / cell))
    top = mx.z + 0.05
    hits = {}
    for j in range(ny):
        y = mn.y + (j + 0.5) * cell
        for i in range(nx):
            x = mn.x + (i + 0.5) * cell
            z = top
            seq = []
            for _ in range(24):
                loc, nor, _, _ = bvh.ray_cast(Vector((x, y, z)), Vector((0, 0, -1)), z - mn.z + 0.01)
                if loc is None:
                    break
                seq.append((loc.z, nor.z))
                z = loc.z - 0.004
            hits[(i, j)] = seq
    zs = sorted(z for seq in hits.values() for (z, nz) in seq if nz > 0.9)
    clusters = []
    for z in zs:
        if clusters and z - clusters[-1][-1] < 0.012:
            clusters[-1].append(z)
        else:
            clusters.append([z])
    levels = []
    for cl in clusters:
        if len(cl) * cell * cell < min_area:
            continue
        zc = float(np.median(cl))
        mask = np.zeros((ny, nx), bool)
        clear = np.zeros((ny, nx), np.float32)
        for (i, j), seq in hits.items():
            prev = None
            for k, (z, nz) in enumerate(seq):
                if nz > 0.9 and abs(z - zc) < 0.012:
                    above = seq[k - 1][0] if k > 0 else z + max_clear
                    mask[j, i] = True
                    clear[j, i] = min(max_clear, above - z)
                    break
        # drop thin slivers: erode once
        er = mask.copy()
        er[1:, :] &= mask[:-1, :]
        er[:-1, :] &= mask[1:, :]
        er[:, 1:] &= mask[:, :-1]
        er[:, :-1] &= mask[:, 1:]
        mask = er & (clear > min_clear)
        if mask.sum() * cell * cell < min_area:
            continue
        levels.append(Level(zc, mn.x, mn.y, cell, mask, clear, tag))
    return levels


def flat_level(z, x0, y0, x1, y1, cell=0.04, clear=3.0, tag='floor', holes=None):
    nx, ny = max(1, int((x1 - x0) / cell)), max(1, int((y1 - y0) / cell))
    mask = np.ones((ny, nx), bool)
    if holes:
        for (a, b, c, d) in holes:
            i0, i1 = int((a - x0) / cell), int(math.ceil((c - x0) / cell))
            j0, j1 = int((b - y0) / cell), int(math.ceil((d - y0) / cell))
            mask[max(0, j0):max(0, j1), max(0, i0):max(0, i1)] = False
    return Level(z, x0, y0, cell, mask, np.full((ny, nx), clear, np.float32), tag)


# ---------------------------------------------------------------- the composer
class Composer:
    def __init__(self, seed, cam=None):
        self.rnd = random.Random(seed)
        self.boxes = []  # (min, max) of everything placed (AABB)
        self.grid = {}
        self.items = []  # placed props: dict(index, key, asset, objs, kind)
        self.next_index = 1
        self.cam = cam
        self.occluder = None  # BVH used for camera visibility of candidates
        self.coll_props = collection('props')
        self.coll_set = collection('set')
        self.stats = {}

    # --- AABB registry
    def _cells(self, mn, mx):
        g = 0.25
        for i in range(int(math.floor(mn.x / g)), int(math.floor(mx.x / g)) + 1):
            for j in range(int(math.floor(mn.y / g)), int(math.floor(mx.y / g)) + 1):
                yield (i, j)

    def add_box(self, mn, mx, owner=None):
        k = len(self.boxes)
        self.boxes.append((mn.copy(), mx.copy(), owner))
        for c in self._cells(mn, mx):
            self.grid.setdefault(c, []).append(k)

    def collides(self, mn, mx, pad=0.0, ignore=()):
        seen = set()
        for c in self._cells(mn, mx):
            for k in self.grid.get(c, ()):
                if k in seen:
                    continue
                seen.add(k)
                a, b, ow = self.boxes[k]
                if ow is not None and ow in ignore:
                    continue
                if mn.x < b.x - pad and mx.x > a.x + pad and mn.y < b.y - pad and mx.y > a.y + pad and mn.z < b.z - pad and mx.z > a.z + pad:
                    return True
        return False

    # --- camera helpers
    def face_yaw(self, x, y):
        if not self.cam:
            return 0.0
        c = self.cam.matrix_world.translation
        return math.atan2(c.x - x, -(c.y - y))

    def in_view(self, p, margin=0.0):
        if not self.cam:
            return True
        sc = bpy.context.scene
        v = world_to_camera_view(sc, self.cam, Vector(p))
        return v.z > 0.05 and -margin <= v.x <= 1 + margin and -margin <= v.y <= 1 + margin

    def visible_from_cam(self, pts, need=1):
        if not self.occluder or not self.cam:
            return True
        o = self.cam.matrix_world.translation
        ok = 0
        for p in pts:
            d = Vector(p) - o
            dist = d.length
            loc, _, _, _ = self.occluder.ray_cast(o, d.normalized(), dist - 0.01)
            if loc is None:
                ok += 1
                if ok >= need:
                    return True
        return False

    # --- placing
    def place_fixed(self, spec, loc, yaw=0.0, scale=1.0, kind='set', key=None, register=True, extra=None, index=None):
        p = proto(spec)
        idx = self.next_index if index is None else index
        if index is None:
            self.next_index += 1
        objs = p.instance(loc, yaw, scale, self.coll_set if kind == 'set' else self.coll_props, idx, extra)
        mn, mx = aabb_of(objs)
        if register:
            self.add_box(mn, mx, idx)
        it = {'index': idx, 'key': key or p.key, 'asset': p.asset, 'objs': objs, 'kind': kind, 'min': mn, 'max': mx}
        self.items.append(it)
        return it

    def try_on_level(self, level, spec, scale=1.0, yaw=None, tries=12, face=0.0, jitter=0.6, pad=0.002, key=None,
                     need_visible=True, xy=None, kind='prop', min_vis=1):
        """Try to put one prop on a support level (face: yaw or 'cam')."""
        p = proto(spec)
        r = self.rnd
        for _ in range(tries):
            x, y = xy if xy else level.random_point(r)
            base = self.face_yaw(x, y) if face == 'cam' else face
            yw = (base + r.uniform(-jitter, jitter)) if yaw is None else yaw
            hx, hy = p.footprint(yw, scale)
            h = p.size.z * scale
            if not level.fits(x, y, hx, hy, h + 0.004):
                self.stats['fit'] = self.stats.get('fit', 0) + 1
                if xy:
                    return None
                continue
            z = level.z + 0.0008
            mn = Vector((x - hx, y - hy, z + 0.001))
            mx = Vector((x + hx, y + hy, z + h))
            if self.collides(mn, mx, pad, getattr(level, 'ignore', ())):
                self.stats['collide'] = self.stats.get('collide', 0) + 1
                if xy:
                    return None
                continue
            c = (mn + mx) / 2
            if not self.in_view(c, 0.02):
                self.stats['view'] = self.stats.get('view', 0) + 1
                continue
            if need_visible:
                pts = [c, Vector((x, y, z + h * 0.9)), Vector((x - hx * 0.6, y - hy, z + h * 0.5)), Vector((x + hx * 0.6, y - hy, z + h * 0.5))]
                if not self.visible_from_cam(pts, min_vis):
                    self.stats['hidden'] = self.stats.get('hidden', 0) + 1
                    continue
            return self.place_fixed(spec, (x, y, z), yw, scale, kind=kind, key=key)
        return None

    def fill(self, levels, pool, count, face='cam', jitter=0.6, scale=(0.9, 1.1), stack_kinds=(), tries=10, size_bias=0.0):
        """Scatter `count` props from `pool` ([(spec, weight, opts)]) over levels."""
        r = self.rnd
        total = sum(l.area for l in levels) or 1
        placed = []
        specs = [(e if isinstance(e, tuple) else (e, 1.0, {})) for e in pool]
        specs = [(s[0], s[1] if len(s) > 1 else 1.0, s[2] if len(s) > 2 else {}) for s in specs]
        weights = [s[1] for s in specs]
        for _ in range(count * 3):
            if len(placed) >= count:
                break
            lv = r.choices(levels, [l.area for l in levels])[0] if len(levels) > 1 else levels[0]
            spec, w, opt = r.choices(specs, weights)[0]
            sc = r.uniform(*opt.get('scale', scale))
            it = self.try_on_level(lv, spec, sc, yaw=opt.get('yaw'), tries=tries, face=opt.get('face', face),
                                   jitter=opt.get('jitter', jitter), kind=opt.get('kind', 'prop'))
            if it:
                placed.append(it)
                if opt.get('stack') or it['asset'] in stack_kinds:
                    for nl in scan_levels(it['objs'], cell=0.02, max_clear=lv_clear_above(lv, it), tag='stack'):
                        if nl.z > it['min'].z + 0.02:
                            nl.ignore = {it['index']} | set(getattr(lv, 'ignore', ()))
                            levels.append(nl)
        return placed

    def pack(self, levels, pool, rows=(0.75, 0.3), gap=(0.004, 0.05), skip=0.12, face='cam', jitter=0.35, scale=(0.9, 1.08), fill_prob=0.92):
        """Pack levels row by row (left to right), like a real shelf: a front row
        and, where the board is deep enough, a back row of taller things."""
        r = self.rnd
        specs = [(e if isinstance(e, tuple) else (e, 1.0, {})) for e in pool]
        specs = [(s[0], s[1] if len(s) > 1 else 1.0, s[2] if len(s) > 2 else {}) for s in specs]
        placed = []
        for lv in levels:
            ys, xs = np.nonzero(lv.mask)
            if not len(xs):
                continue
            x0 = lv.x0 + xs.min() * lv.cell
            x1 = lv.x0 + (xs.max() + 1) * lv.cell
            y0 = lv.y0 + ys.min() * lv.cell
            y1 = lv.y0 + (ys.max() + 1) * lv.cell
            depth = y1 - y0
            row_list = [rows[0]] if depth < 0.28 else list(rows)
            for rf in row_list:
                x = x0 + r.uniform(0.0, 0.04)
                while x < x1 - 0.02:
                    if r.random() > fill_prob:
                        x += r.uniform(0.04, skip)
                        continue
                    ok = None
                    for _ in range(6):
                        spec, w, opt = r.choices(specs, [s[1] for s in specs])[0]
                        p = proto(spec)
                        sc = r.uniform(*opt.get('scale', scale))
                        base = self.face_yaw(x, (y0 + y1) / 2) if opt.get('face', face) == 'cam' else opt.get('face', face)
                        yw = base + r.uniform(-1, 1) * opt.get('jitter', jitter) if opt.get('yaw') is None else opt['yaw']
                        hx, hy = p.footprint(yw, sc)
                        if 2 * hy > depth - 0.01:
                            continue
                        # front row hugs the front edge, back row the back
                        yc = y0 + hy + 0.01 + (depth - 2 * hy - 0.02) * (1 - rf) + r.uniform(-0.01, 0.01)
                        yc = min(max(yc, y0 + hy + 0.005), y1 - hy - 0.005)
                        xc = x + hx
                        it = self.try_on_level(lv, spec, sc, yaw=yw, tries=1, xy=(xc, yc), kind=opt.get('kind', 'prop'),
                                               need_visible=opt.get('kind', 'prop') == 'prop')
                        if it:
                            ok = it
                            break
                    if ok:
                        placed.append(ok)
                        x = ok['max'].x + r.uniform(*gap)
                    else:
                        x += 0.03
        return placed

    # --- walls
    def hang(self, spec, wall_y, x, z, scale=1.0, kind='prop', key=None, normal=-1, wall_x=None):
        """Hang something flat against the back wall (y = wall_y) or a side wall (x = wall_x)."""
        p = proto(spec)
        if wall_x is None:
            depth = p.size.y * scale
            loc = (x, wall_y + normal * depth / 2 - normal * 0.002, z - p.size.z * scale / 2)
            yaw = 0.0 if normal < 0 else math.pi
        else:
            depth = p.size.y * scale
            yaw = -math.pi / 2 if normal > 0 else math.pi / 2
            loc = (wall_x + normal * depth / 2 - normal * 0.002, x, z - p.size.z * scale / 2)
        hx, hy = p.footprint(yaw, scale)
        mn = Vector((loc[0] - hx, loc[1] - hy, loc[2]))
        mx = Vector((loc[0] + hx, loc[1] + hy, loc[2] + p.size.z * scale))
        if self.collides(mn, mx, 0.0):
            return None
        if not self.in_view((mn + mx) / 2, 0.0):
            return None
        return self.place_fixed(spec, loc, yaw, scale, kind=kind, key=key)

    def levels(self, item, **kw):
        lv = scan_levels(item['objs'], **kw)
        for l in lv:
            l.ignore = {item['index']} | set(kw.get('ignore', ()))
        return lv

    def build_occluder(self, objs=None):
        objs = objs if objs is not None else [o for it in self.items for o in it['objs']] + list(self.coll_set.all_objects)
        self.occluder = bvh_of(list({o.name: o for o in objs}.values()))


def lv_clear_above(level, it):
    return max(0.05, 0.9 - (it['max'].z - it['min'].z))


# ---------------------------------------------------------------- lights, camera, world
def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=30.0, sensor=36.0, shift_x=0.0, shift_y=0.0):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.sensor_width = sensor
    cd.shift_x = shift_x
    cd.shift_y = shift_y
    cd.clip_start = 0.05
    cd.clip_end = 2000
    ob = bpy.data.objects.new('cam', cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    look_at(ob, target)
    bpy.context.scene.camera = ob
    bpy.context.view_layer.update()
    return ob


def kelvin(t):
    """Approximate RGB of a black body (1000-12000 K)."""
    t = t / 100.0
    if t <= 66:
        r = 255
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
        b = 255
    f = lambda v: max(0.0, min(1.0, v / 255.0)) ** 2.2  # noqa: E731
    return (f(r), f(g), f(b))


def area_light(name, loc, target, size=1.0, size_y=None, power=200, temp=5000, spread=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = power
    ld.color = kelvin(temp)
    if size_y:
        ld.shape = 'RECTANGLE'
        ld.size = size
        ld.size_y = size_y
    else:
        ld.size = size
    if spread:
        ld.spread = spread
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    look_at(ob, target)
    return ob


def point_light(name, loc, power=30, temp=2700, radius=0.05):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = power
    ld.color = kelvin(temp)
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    return ob


def sun_light(name, direction, strength=3.0, temp=5600, angle=1.0):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = strength
    ld.color = kelvin(temp)
    ld.angle = math.radians(angle)
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    return ob


def world_hdri(name, strength=1.0, rot=0.0, res='2k', bg_strength=None, bg_color=None):
    w = bpy.data.worlds.new('world')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = rot
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(hdri_path(name, res))
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    if bg_strength is None and bg_color is None:
        nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
        return w
    # different strength for camera rays (visible background) vs lighting
    bg2 = nt.nodes.new('ShaderNodeBackground')
    if bg_color:
        bg2.inputs['Color'].default_value = (*bg_color, 1)
    else:
        nt.links.new(env.outputs['Color'], bg2.inputs['Color'])
    bg2.inputs['Strength'].default_value = bg_strength if bg_strength is not None else strength
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bg.outputs['Background'], mix.inputs[1])
    nt.links.new(bg2.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return w


# ---------------------------------------------------------------- render
def setup_render(w, h, samples=160, out_dir='.', look='AgX - Medium High Contrast', exposure=0.0, threads=0,
                 noise=0.025, bounces=6):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = noise
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.denoising_prefilter = 'ACCURATE'
    cy.max_bounces = bounces
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 6
    cy.transparent_max_bounces = 16
    cy.volume_bounces = 0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 6.0
    cy.blur_glossy = 1.0
    cy.use_light_tree = True
    cy.texture_limit_render = '2048'
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.threads_mode = 'FIXED' if threads else 'AUTO'
    if threads:
        sc.render.threads = threads
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = look
    except TypeError:
        pass
    sc.view_settings.exposure = exposure
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    sc.render.filepath = os.path.join(out_dir, 'beauty.png')
    vl = sc.view_layers[0]
    vl.use_pass_object_index = True
    sc.render.use_compositing = False
    sc.render.use_sequencer = False
    return sc


def render(out_dir):
    """Render the color-managed photo (PNG) and save every pass, including the
    object index, as a multilayer EXR (no compositor needed)."""
    sc = bpy.context.scene
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images['Render Result']
    st = sc.render.image_settings
    if 'media_type' in st.bl_rna.properties:
        st.media_type = 'MULTI_LAYER_IMAGE'
    st.file_format = 'OPEN_EXR_MULTILAYER'
    st.color_depth = '32'
    st.exr_codec = 'ZIP'
    img.save_render(os.path.join(out_dir, 'passes.exr'), scene=sc)
    if 'media_type' in st.bl_rna.properties:
        st.media_type = 'IMAGE'
    st.file_format = 'PNG'
    st.color_depth = '8'
    return os.path.join(out_dir, 'beauty.png')


def project_bbox(cam, mn, mx, w, h):
    sc = bpy.context.scene
    xs, ys = [], []
    for x in (mn.x, mx.x):
        for y in (mn.y, mx.y):
            for z in (mn.z, mx.z):
                v = world_to_camera_view(sc, cam, Vector((x, y, z)))
                if v.z <= 0:
                    continue
                xs.append(v.x * w)
                ys.append((1 - v.y) * h)
    if not xs:
        return None
    return [min(xs), min(ys), max(xs), max(ys)]


def write_manifest(path, comp, cam, w, h, extra=None):
    items = []
    for it in comp.items:
        bb = project_bbox(cam, it['min'], it['max'], w, h)
        items.append({'index': it['index'], 'key': it['key'], 'asset': it['asset'], 'kind': it['kind'], 'bbox': bb,
                      'size': [round(v, 3) for v in (it['max'] - it['min'])]})
    data = {'w': w, 'h': h, 'items': items}
    if extra:
        data.update(extra)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)
