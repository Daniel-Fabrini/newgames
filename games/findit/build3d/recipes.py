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


def rug(L, rect, inner=('velour_velvet', 0.5, (0.42, 0.08, 0.07)), border=('caban', 0.6, (0.35, 0.22, 0.1))):
    """A rug: patterned border band around a velvet field."""
    coll = L.collection('set')
    x0, y0, x1, y1 = rect
    bm = L.tex_material('rug_border', border[0], tint=border[2], bump=0.5)
    L.box('rug_border', x0, y0, 0, x1, y1, 0.010, bm, coll, uv_scale=1 / border[1])
    im = L.tex_material('rug_field', inner[0], tint=inner[2], bump=0.5)
    L.box('rug_field', x0 + 0.14, y0 + 0.14, 0, x1 - 0.14, y1 - 0.14, 0.013, im, coll, uv_scale=1 / inner[1])


def against(L, C, spec, x, wall_y, yaw=0.0, scale=1.0, gap=0.01, kind='set', z=0.0):
    """Put furniture with its back against the back wall."""
    hx, hy = L.proto(spec).footprint(yaw, scale)
    return C.place_fixed(spec, (x, wall_y - hy - gap, z), yaw, scale, kind=kind)


def levels_of(L, C, items, **kw):
    out = []
    for it in items:
        out += C.levels(it, **kw)
    return out


# ---------------------------------------------------------------- pools
TEAPOT = {'asset': 'tea_set_01', 'parts': ['tea_set_01_teapot_01', 'tea_set_01_teapot_01_lid'], 'key': 'tea_set_01/teapot_01'}
SUGAR = {'asset': 'tea_set_01', 'parts': ['tea_set_01_sugar_cup_01', 'tea_set_01_sugar_cup_01_lid'], 'key': 'tea_set_01/sugar_cup_01'}
CUP = 'tea_set_01/tea_set_01_cup_small_01'

CURIOS = [
    ('brass_vase_01', 1.0), ('brass_vase_02', 1.0), ('brass_vase_03', 1.2), ('brass_vase_04', 1.2), ('brass_pot_01', 0.8),
    ('brass_pot_02', 0.6), ('brass_goblets/*', 1.2), ('brass_candleholders/brass_candleholder_01', 0.6),
    ('brass_candleholders/brass_candleholder_02', 0.4), ('brass_diya_lantern', 0.8),
    ('antique_ceramic_vase_01', 0.8), ('ceramic_vase_01', 0.6), ('ceramic_vase_02', 0.6), ('ceramic_vase_04', 0.6),
    ('carved_wooden_elephant', 1.4), ('carved_wooden_plate', 0.5), ('Lantern_01', 1.0), ('vintage_oil_lamp', 0.8),
    ('wooden_candlestick', 1.2), ('magnifying_glass_01', 1.0), ('marble_bust_01', 0.8), ('horse_statue_01', 1.0),
    ('concrete_cat_statue', 0.8), ('lambis_shell', 1.2), ('pocket_watch', 1.0), ('vintage_pocket_watch', 1.0),
    ('round_spectacles', 1.0), ('seadogs_compass', 1.2), ('vintage_binocular', 1.0), ('Camera_01', 1.0),
    ('standing_picture_frame_01', 0.8), ('standing_picture_frame_02', 0.8), ('jug_01', 0.8), ('metal_jug', 0.6),
    ('wooden_bowl_02', 0.8), ('pot_enamel_01', 0.5), ('chess_set', 0.4), ('cigarette_case', 0.6), ('food_apple_01', 0.8),
    ('food_pomegranate_01', 0.8), ('lemon', 0.5), ('potted_plant_04', 0.8), ('wicker_basket_02', 0.5),
    ('rubber_duck_toy', 0.4), ('baseball_01', 0.4), ('cassette_player', 0.5), ('vintage_stapler', 0.4),
    ('ornate_medieval_dagger', 0.6, {'face': 0.0, 'jitter': 0.3}), (TEAPOT, 0.6), (SUGAR, 0.4), (CUP, 0.6),
    ('horse_head', 0.6), ('lion_head', 0.5), ('bull_head', 0.4), ('wine_bottles_01/*', 0.6),
    ('vintage_telephone_wall_clock', 0.3), ('vintage_microscope', 0.4), ('vintage_flashlight', 0.4),
    ('bronze_whale_statue', 0.3), ('bronze_shark_statue', 0.3), ('vintage_video_camera', 0.4),
    ('portable_cassette_player', 0.3), ('sungka_board', 0.3), ('digital_wrist_watch', 0.3),
]

WALL_ART = [('fancy_picture_frame_01', 1.0, {'scale': (0.6, 0.9)}), ('fancy_picture_frame_02', 1.0, {'scale': (0.6, 0.85)}),
            ('hanging_picture_frame_01', 0.6, {'scale': (0.45, 0.6)}), ('hanging_picture_frame_02', 0.8, {'scale': (0.5, 0.7)}),
            ('hanging_picture_frame_03', 0.8, {'scale': (0.6, 0.8)}), ('wall_clock', 0.6, {'scale': (0.8, 1.0)}),
            ('ornate_mirror_01', 0.5, {'scale': (0.6, 0.75)}), ('vintage_telephone_wall_clock', 0.3, {'scale': (0.9, 1.0)})]

BOOKROW = [('decorative_book_set_01/*', 1.0, {'kind': 'set', 'jitter': 0.05, 'scale': (0.88, 1.03)}),
           ('book_encyclopedia_set_01/*', 0.7, {'kind': 'set', 'jitter': 0.03, 'scale': (0.9, 0.98)})]


def shelves_mixed(C, levels, books=0.55, curios=CURIOS):
    """Some boards get rows of books with gaps, the rest get curios; then
    curios go into every gap that is left."""
    r = C.rnd
    bl = [l for l in levels if r.random() < books]
    C.pack(bl, BOOKROW, rows=(0.9,), gap=(0.0, 0.003), fill_prob=0.9, skip=0.16, jitter=0.03)
    C.build_occluder()
    C.pack(levels, curios, rows=(0.8, 0.25), gap=(0.005, 0.05), fill_prob=0.85)


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
    R = room(L, x0=-3.6, x1=3.6, back=2.0, front=-3.4, h=3.1, floor=('herringbone_parquet', 3.4), floor_tint=(0.62, 0.48, 0.38),
             wall=('red_plaster_weathered', 2.0), wall_tint=(0.62, 0.42, 0.36), wainscot=('wooden_panels', 1.6), wainscot_h=1.05,
             beams='wood_cabinet_worn_long')
    rug(L, (-1.7, -0.9, 1.9, 1.25))
    cam = L.camera((0.0, -3.0, 1.5), (0.0, 2.0, 1.25), lens=25)
    C = L.Composer(S['seed'], cam)
    W = R['back']
    shelf_l = against(L, C, 'wooden_bookshelf_worn', -2.78, W)
    hutch = against(L, C, 'vintage_cabinet_01', -0.9, W)
    wall_shelf = against(L, C, 'Shelf_01', 0.64, W)
    clock = against(L, C, 'vintage_grandfather_clock_01', 1.66, W)
    shelf_r = against(L, C, 'wooden_bookshelf_worn', 2.82, W)
    desk = C.place_fixed('ClassicConsole_01', (0.2, 0.45, 0), yaw=0.05)
    chair = C.place_fixed('ArmChair_01', (-2.0, -0.45, 0), yaw=0.7)
    stand = C.place_fixed('side_table_tall_01', (2.3, -0.35, 0), yaw=0.3)
    chest = C.place_fixed('treasure_chest', (1.2, -0.75, 0), yaw=-0.35, kind='prop')
    case = C.place_fixed('vintage_suitcase', (-0.75, -0.85, 0), yaw=0.15, kind='prop')
    C.place_fixed('Chandelier_01', (0.0, 0.0, R['h'] - 0.85), kind='set')
    C.build_occluder()
    shelves = levels_of(L, C, [shelf_l, shelf_r, wall_shelf, hutch])
    shelves_mixed(C, shelves)
    C.build_occluder()
    tops = levels_of(L, C, [desk, stand, clock, chest, case, chair])
    C.fill(tops, CURIOS + [('decorative_book_set_01/*', 0.6, {'kind': 'set', 'stack': True})], 40)
    floor = L.flat_level(0.0, R['x0'] + 0.2, -1.6, R['x1'] - 0.2, R['back'] - 0.05, tag='floor')
    C.fill([floor], [('wicker_basket_01', 1), ('potted_plant_02', 1), 
                     ('brass_vase_01', 1), ('antique_ceramic_vase_01', 1), ('wooden_candlestick', 0.5), ('horse_statue_01', 0.5),
                     ('Lantern_01', 0.5), ('wine_bottles_01', 0.4), ('Ukulele_01', 0.4)], 12)
    C.decorate_wall(WALL_ART, W, R['x0'] + 0.3, R['x1'] - 0.3, 1.3, 2.75, 7)
    L.world_hdri('comfy_cafe', strength=0.25)
    L.area_light('window', (-3.45, -0.8, 2.3), (0.5, 1.4, 0.9), size=2.0, size_y=1.5, power=750, temp=4800)
    L.area_light('fill', (0.4, -3.2, 2.4), (0, 1.5, 1.0), size=3.0, power=90, temp=5600)
    L.area_light('rim', (3.4, 0.4, 2.7), (0, 1.6, 1.0), size=1.0, power=160, temp=3000)
    L.point_light('chand', (0.0, 0.0, R['h'] - 1.1), power=120, temp=2500, radius=0.2)
    L.point_light('desk_glow', (0.6, 0.3, 1.6), power=30, temp=2600, radius=0.2)
    return C, cam
