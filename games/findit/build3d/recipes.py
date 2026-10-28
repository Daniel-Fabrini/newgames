"""Scene recipes for Caça-Objetos (games/findit).

Each recipe is a function build(L, S) that receives the Blender helper module
(lib.py) and a settings dict, builds the set, places the furniture by hand and
then lets the Composer fill every support surface with themed props. The
module is importable without Blender (fetch.py reads the requirements).
"""
import math

SCENES = {}


def scene(sid, *, models=(), textures=(), hdris=(), seed=1, size=(2560, 1440)):
    def deco(fn):
        SCENES[sid] = {'id': sid, 'build': fn, 'models': set(models), 'textures': set(textures), 'hdris': set(hdris),
                       'seed': seed, 'size': size}
        return fn

    return deco


def _assets(pool):
    out = set()
    for e in pool:
        s = e[0] if isinstance(e, tuple) else e
        if isinstance(s, dict):
            s = s['asset']
        out.add(s.split('/')[0])
    return out


def all_requirements(ids=None):
    req = {'models': set(), 'textures': set(), 'hdris': set()}
    for sid, sc in SCENES.items():
        if ids and sid not in ids:
            continue
        for k in req:
            req[k] |= set(sc[k])
    return req


# ---------------------------------------------------------------- shared pieces
def room(L, *, x0=-3.6, x1=3.6, back=2.0, front=-3.6, h=3.1, floor=('herringbone_parquet', 3.4), wall=('patterned_plaster_wall', 1.8),
         wall_tint=None, wainscot=None, wainscot_h=0.95, floor_tint=None, ceiling=('plastered_wall_04', 3.2), beams=None,
         side=True, rug=None):
    """Floor, back wall, side walls and ceiling with world-scaled PBR textures."""
    coll = L.collection('set')
    fm = L.tex_material('floor', floor[0], tint=floor_tint, rough_mul=0.9)
    L.plane('floor', [(x0, front, 0), (x1, front, 0), (x1, back, 0), (x0, back, 0)], fm, coll, uv_scale=1 / floor[1])
    wm = L.tex_material('wall', wall[0], tint=wall_tint)
    zw = wainscot_h if wainscot else 0.0
    L.plane('wall_back', [(x0, back, zw), (x1, back, zw), (x1, back, h), (x0, back, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='xz')
    if side:
        L.plane('wall_left', [(x0, front, zw), (x0, back, zw), (x0, back, h), (x0, front, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='yz')
        L.plane('wall_right', [(x1, back, zw), (x1, front, zw), (x1, front, h), (x1, back, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='yz')
    if wainscot:
        pm = L.tex_material('wainscot', wainscot[0], rough_mul=0.8)
        L.box('wainscot_back', x0, back - 0.03, 0, x1, back, zw, pm, coll, uv_scale=1 / wainscot[1])
        L.box('wainscot_rail', x0, back - 0.05, zw - 0.01, x1, back, zw + 0.035, pm, coll, uv_scale=1 / wainscot[1])
        if side:
            L.box('wainscot_left', x0, front, 0, x0 + 0.03, back, zw, pm, coll, uv_scale=1 / wainscot[1])
            L.box('wainscot_right', x1 - 0.03, front, 0, x1, back, zw, pm, coll, uv_scale=1 / wainscot[1])
    else:
        bm = L.flat_material('baseboard', (0.09, 0.055, 0.03), 0.45)
        L.box('baseboard', x0, back - 0.02, 0, x1, back, 0.12, bm, coll)
    if ceiling:
        cm = L.tex_material('ceiling', ceiling[0])
        L.plane('ceiling', [(x0, back, h), (x0, front, h), (x1, front, h), (x1, back, h)], cm, coll, uv_scale=1 / ceiling[1])
    if beams:
        bmat = L.tex_material('beam', beams, rough_mul=0.9)
        for k in range(5):
            y = back - 0.6 - k * 1.2
            L.box(f'beam{k}', x0, y - 0.11, h - 0.24, x1, y + 0.11, h, bmat, coll, uv_scale=1 / 1.5)
    if rug:
        tex, scale, (rx0, ry0, rx1, ry1) = rug
        rm = L.tex_material('rug', tex, rough_mul=1.0, bump=0.6)
        L.box('rug', rx0, ry0, 0, rx1, ry1, 0.012, rm, coll, uv_scale=1 / scale)
    return {'x0': x0, 'x1': x1, 'back': back, 'front': front, 'h': h}


def against(L, C, spec, x, wall_y, yaw=0.0, scale=1.0, gap=0.01, kind='set', z=0.0):
    """Put furniture with its back against the back wall."""
    hx, hy = L.proto(spec).footprint(yaw, scale)
    return C.place_fixed(spec, (x, wall_y - hy - gap, z), yaw, scale, kind=kind)


def levels_of(L, items, **kw):
    out = []
    for it in items:
        out += L.scan_levels(it['objs'], **kw)
    return out


# ---------------------------------------------------------------- pools
CURIOS = [
    ('brass_vase_01', 1.0), ('brass_vase_02', 1.0), ('brass_vase_03', 1.2), ('brass_vase_04', 1.2), ('brass_pot_01', 1.0),
    ('brass_pot_02', 0.8), ('brass_goblets', 0.8), ('brass_candleholders', 0.5), ('brass_diya_lantern', 0.8),
    ('antique_ceramic_vase_01', 1.0), ('ceramic_vase_01', 1.0), ('ceramic_vase_02', 1.0), ('ceramic_vase_03', 1.0), ('ceramic_vase_04', 1.0),
    ('carved_wooden_elephant', 1.4), ('carved_wooden_plate', 0.6), ('mantel_clock_01', 1.0), ('alarm_clock_01', 1.2),
    ('Lantern_01', 1.0), ('vintage_oil_lamp', 0.8), ('wooden_candlestick', 1.2), ('magnifying_glass_01', 1.0),
    ('marble_bust_01', 0.8), ('horse_statue_01', 1.0), ('concrete_cat_statue', 0.8), ('lambis_shell', 1.2),
    ('pocket_watch', 1.0), ('vintage_pocket_watch', 1.0), ('round_spectacles', 1.0), ('seadogs_compass', 1.2),
    ('vintage_binocular', 1.0), ('Camera_01', 1.0), ('standing_picture_frame_01', 1.0), ('standing_picture_frame_02', 1.0),
    ('jug_01', 0.8), ('metal_jug', 0.8), ('wooden_bowl_02', 0.8), ('pot_enamel_01', 0.6), ('chess_set', 0.5),
    ('cigarette_case', 0.6), ('vintage_lighter', 0.8), ('food_apple_01', 0.8), ('food_pomegranate_01', 0.8), ('lemon', 0.6),
    ('potted_plant_04', 0.8), ('wicker_basket_02', 0.6), ('rubber_duck_toy', 0.5), ('baseball_01', 0.5),
    ('cassette_player', 0.6), ('vintage_stapler', 0.5), ('ornate_medieval_dagger', 0.6), ('tea_set_01', 0.4),
    ('horse_head', 0.5), ('lion_head', 0.5), ('bull_head', 0.4), ('Ukulele_01', 0.3), ('wine_bottles_01', 0.4),
]

BOOKS = [('book_encyclopedia_set_01', 1.0, {'kind': 'set', 'jitter': 0.05, 'scale': (0.95, 1.05)})]


# ---------------------------------------------------------------- 1. antique study
@scene('study', seed=11,
       models=_assets(CURIOS) | {'wooden_bookshelf_worn', 'GothicCabinet_01', 'ArmChair_01', 'WoodenTable_03', 'Shelf_01',
                                 'vintage_grandfather_clock_01', 'side_table_tall_01', 'Chandelier_01', 'treasure_chest',
                                 'vintage_suitcase', 'fancy_picture_frame_01', 'fancy_picture_frame_02', 'hanging_picture_frame_01',
                                 'hanging_picture_frame_02', 'hanging_picture_frame_03', 'wall_clock', 'ornate_mirror_01',
                                 'book_encyclopedia_set_01', 'decorative_book_set_01', 'potted_plant_02', 'wicker_basket_01'},
       textures={'herringbone_parquet', 'dark_paneled_wood', 'patterned_plaster_wall', 'plastered_wall_04', 'quatrefoil_jacquard_fabric'},
       hdris={'comfy_cafe'})
def study(L, S):
    R = room(L, x0=-3.6, x1=3.6, back=2.0, front=-3.4, h=3.2, floor=('herringbone_parquet', 3.4),
             wall=('patterned_plaster_wall', 1.8), wall_tint=(0.85, 0.62, 0.42), wainscot=('dark_paneled_wood', 1.4),
             rug=('quatrefoil_jacquard_fabric', 0.28, (-1.6, -0.4, 1.9, 1.3)))
    cam = L.camera((0.0, -3.0, 1.55), (0.0, 2.0, 1.3), lens=24)
    C = L.Composer(S['seed'], cam)
    W = R['back']
    shelf_l = against(L, C, 'wooden_bookshelf_worn', -2.75, W)
    hutch = against(L, C, 'GothicCabinet_01', -0.95, W)
    wall_shelf = against(L, C, 'Shelf_01', 0.6, W)
    clock = against(L, C, 'vintage_grandfather_clock_01', 1.6, W)
    shelf_r = against(L, C, 'wooden_bookshelf_worn', 2.75, W)
    desk = C.place_fixed('WoodenTable_03', (0.15, 0.55, 0), yaw=0.08)
    chair = C.place_fixed('ArmChair_01', (-1.9, -0.35, 0), yaw=0.65)
    stand = C.place_fixed('side_table_tall_01', (2.2, -0.2, 0), yaw=0.3)
    chest = C.place_fixed('treasure_chest', (1.15, -0.55, 0), yaw=-0.35, kind='prop')
    case = C.place_fixed('vintage_suitcase', (-0.9, -0.6, 0), yaw=0.2, kind='prop')
    C.place_fixed('Chandelier_01', (0.0, 0.2, R['h'] - 0.8), kind='set')
    C.build_occluder()
    # shelves: books first, then curios
    shelves = levels_of(L, [shelf_l, shelf_r, wall_shelf, hutch])
    C.fill([l for l in shelves], BOOKS, 18)
    C.build_occluder()
    tops = levels_of(L, [desk, stand, clock, chest, case])
    C.fill(shelves + tops, CURIOS, 140)
    floor = L.flat_level(0.0, R['x0'] + 0.2, -1.4, R['x1'] - 0.2, R['back'] - 0.05, tag='floor')
    C.fill([floor], [('wicker_basket_01', 1), ('potted_plant_02', 1), ('decorative_book_set_01', 0.5, {'kind': 'set'}),
                     ('brass_vase_01', 1), ('antique_ceramic_vase_01', 1), ('wooden_candlestick', 0.5), ('horse_statue_01', 0.5),
                     ('Lantern_01', 0.5), ('ceramic_vase_03', 0.5)], 10)
    # wall decoration
    for spec, x, z, s in [('fancy_picture_frame_02', 0.15, 2.45, 0.9), ('hanging_picture_frame_03', -1.95, 2.55, 0.8),
                          ('wall_clock', 1.0, 2.55, 0.9), ('hanging_picture_frame_01', 2.0, 2.65, 0.55),
                          ('fancy_picture_frame_01', -0.3, 1.45, 0.45), ('ornate_mirror_01', 3.2, 2.5, 0.6)]:
        C.hang(spec, W, x, z, s)
    # light: soft window light from the left, warm practicals, cool fill
    L.world_hdri('comfy_cafe', strength=0.35)
    L.area_light('window', (-3.4, -0.6, 2.4), (0.5, 1.4, 0.9), size=2.2, size_y=1.6, power=900, temp=5200)
    L.area_light('fill', (0.4, -3.2, 2.2), (0, 1.5, 1.0), size=3.0, power=220, temp=6000)
    L.area_light('rim', (3.3, 0.6, 2.6), (0, 1.6, 1.0), size=1.2, power=180, temp=3200)
    L.point_light('chand', (0.0, 0.2, R['h'] - 1.05), power=90, temp=2600, radius=0.15)
    L.point_light('desk_glow', (0.6, 0.4, 1.5), power=25, temp=2700, radius=0.2)
    return C, cam
