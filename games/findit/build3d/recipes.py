"""Scene recipes for Caça-Objetos (games/findit).

Each recipe is a function build(L, S) that receives the Blender helper module
(lib.py) and a settings dict, builds the set, places the furniture by hand and
then lets the Composer fill every support surface with themed props. The
module is importable without Blender (fetch.py reads the requirements).
"""
import math

SCENES = {}


def scene(sid, *, models=(), textures=(), hdris=(), seed=1, size=(2400, 1350)):
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
         side=True, rug=None, baseboard=True):
    """Floor, back wall, side walls and ceiling with world-scaled PBR textures."""
    coll = L.collection('set')
    fm = L.tex_material('floor', floor[0], tint=floor_tint, rough_mul=0.9)
    L.plane('floor', [(x0, front, 0), (x1, front, 0), (x1, back, 0), (x0, back, 0)], fm, coll, uv_scale=1 / floor[1])
    wm = L.tex_material('wall', wall[0], tint=wall_tint)
    zw = wainscot_h if wainscot else 0.0
    if h > 0:
        L.plane('wall_back', [(x0, back, zw), (x1, back, zw), (x1, back, h), (x0, back, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='xz')
    if side and h > 0:
        L.plane('wall_left', [(x0, front, zw), (x0, back, zw), (x0, back, h), (x0, front, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='yz')
        L.plane('wall_right', [(x1, back, zw), (x1, front, zw), (x1, front, h), (x1, back, h)], wm, coll, uv_scale=1 / wall[1], uv_axes='yz')
    if wainscot:
        pm = L.tex_material('wainscot', wainscot[0], rough_mul=0.8)
        L.box('wainscot_back', x0, back - 0.03, 0, x1, back, zw, pm, coll, uv_scale=1 / wainscot[1])
        L.box('wainscot_rail', x0, back - 0.05, zw - 0.01, x1, back, zw + 0.035, pm, coll, uv_scale=1 / wainscot[1])
        if side:
            L.box('wainscot_left', x0, front, 0, x0 + 0.03, back, zw, pm, coll, uv_scale=1 / wainscot[1])
            L.box('wainscot_right', x1 - 0.03, front, 0, x1, back, zw, pm, coll, uv_scale=1 / wainscot[1])
    elif baseboard:
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
    C.book_rows(bl)
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
    C.pack(tops, CURIOS, rows=(0.85, 0.45, 0.1), gap=(0.01, 0.08), fill_prob=0.8)
    C.fill(tops, CURIOS, 25)
    floor = L.flat_level(0.0, R['x0'] + 0.2, -1.6, R['x1'] - 0.2, R['back'] - 0.05, tag='floor')
    C.fill([floor], [('wicker_basket_01', 1), ('potted_plant_02', 1), 
                     ('brass_vase_01', 1), ('antique_ceramic_vase_01', 1), ('wooden_candlestick', 0.5), ('horse_statue_01', 0.5),
                     ('Lantern_01', 0.5), ('wine_bottles_01/*', 0.4), ('Ukulele_01', 0.4)], 12)
    C.decorate_wall(WALL_ART, W, R['x0'] + 0.3, R['x1'] - 0.3, 1.3, 2.75, 7)
    L.world_hdri('comfy_cafe', strength=0.25)
    L.area_light('window', (-3.45, -0.8, 2.3), (0.5, 1.4, 0.9), size=2.0, size_y=1.5, power=750, temp=4800)
    L.area_light('fill', (0.4, -3.2, 2.4), (0, 1.5, 1.0), size=3.0, power=90, temp=5600)
    L.area_light('rim', (3.4, 0.4, 2.7), (0, 1.6, 1.0), size=1.0, power=160, temp=3000)
    L.point_light('chand', (0.0, 0.0, R['h'] - 1.1), power=120, temp=2500, radius=0.2)
    L.point_light('desk_glow', (0.6, 0.3, 1.6), power=30, temp=2600, radius=0.2)
    return C, cam


# ---------------------------------------------------------------- generic composer
def compose(L, S, cfg):
    """Build a scene from a config dict (see the scenes below)."""
    R = room(L, **cfg['room'])
    if cfg.get('rug'):
        rug(L, cfg['rug'])
    for extra in cfg.get('extras', []):
        extra(L, R)
    cl, ct, lens = cfg['cam']
    cam = L.camera(cl, ct, lens=lens)
    C = L.Composer(S['seed'], cam)
    W = R['back']
    named = {}
    for e in cfg.get('back', []):
        name, spec, x = e[0], e[1], e[2]
        o = e[3] if len(e) > 3 else {}
        named[name] = against(L, C, spec, x, W, yaw=o.get('yaw', 0.0), scale=o.get('scale', 1.0), kind=o.get('kind', 'set'),
                              z=o.get('z', 0.0), gap=o.get('gap', 0.01))
    for e in cfg.get('free', []):
        name, spec, xy, yaw = e[0], e[1], e[2], e[3]
        o = e[4] if len(e) > 4 else {}
        named[name] = C.place_fixed(spec, (xy[0], xy[1], o.get('z', 0.0)), yaw, o.get('scale', 1.0), kind=o.get('kind', 'set'))
    for e in cfg.get('hung', []):
        spec, x, z = e[0], e[1], e[2]
        o = e[3] if len(e) > 3 else {}
        C.hang(spec, W, x, z, o.get('scale', 1.0), kind=o.get('kind', 'set'))
    C.build_occluder()
    pool = cfg['pool']
    shelves = levels_of(L, C, [named[n] for n in cfg.get('shelves', [])])
    if shelves:
        shelves_mixed(C, shelves, books=cfg.get('books', 0.4), curios=cfg.get('shelf_pool', pool))
    C.build_occluder()
    tops = levels_of(L, C, [named[n] for n in cfg.get('tops', [])])
    if tops:
        C.pack(tops, cfg.get('top_pool', pool), rows=(0.85, 0.45, 0.1), gap=(0.01, 0.07), fill_prob=0.85)
        C.fill(tops, cfg.get('top_pool', pool), cfg.get('top_extra', 25))
    fl = cfg.get('floor')
    if fl:
        C.build_occluder()
        lvs = [L.flat_level(0.0, *fl['region'], tag='floor')]
        C.fill(lvs, fl['pool'], fl['count'], jitter=fl.get('jitter', 0.8))
        if fl.get('small'):
            C.build_occluder()
            C.fill(lvs, fl['small'], fl.get('small_count', 20), jitter=1.2)
    art = cfg.get('wall_art')
    if art:
        C.decorate_wall(art['pool'], W, art.get('x0', R['x0'] + 0.3), art.get('x1', R['x1'] - 0.3), art['z0'], art['z1'], art['count'])
    cfg['light'](L, R)
    return C, cam


def warm_interior(hdri='comfy_cafe', key=750, key_temp=4800, fill=90, practical=120, side=-1, exposure=None):
    def f(L, R):
        L.world_hdri(hdri, strength=0.25)
        x = R['x0'] + 0.15 if side < 0 else R['x1'] - 0.15
        L.area_light('window', (x, -0.8, 2.3), (0.0, 1.4, 0.9), size=2.0, size_y=1.5, power=key, temp=key_temp)
        L.area_light('fill', (0.4, -3.2, 2.4), (0, 1.5, 1.0), size=3.0, power=fill, temp=5600)
        L.area_light('rim', (-x * 0.95, 0.4, 2.6), (0, 1.6, 1.0), size=1.0, power=160, temp=3000)
        if practical:
            L.point_light('practical', (0.0, 0.0, R['h'] - 1.0), power=practical, temp=2500, radius=0.2)
    return f


def daylight(hdri, strength=1.0, rot=0.0, sun=None, sun_strength=3.5, sun_temp=5400):
    def f(L, R):
        L.world_hdri(hdri, strength=strength, rot=rot, res='4k')
        if sun:
            L.sun_light('sun', sun, strength=sun_strength, temp=sun_temp, angle=1.5)
    return f


KITCHEN = [
    ('brass_pot_01', 0.8), ('brass_pot_02', 0.8), ('brass_pan_01', 0.8), ('jug_01', 1.0), ('metal_jug', 0.8), ('pot_enamel_01', 1.0),
    ('wooden_bowl_01', 0.8), ('wooden_bowl_02', 0.8), ('wooden_cutting_board', 0.6), ('wooden_spoon', 0.5), (TEAPOT, 0.8),
    (SUGAR, 0.5), (CUP, 0.8), ('tea_set_01/tea_set_01_saucer_circular_03', 0.4), ('wine_bottles_01/*', 1.0),
    ('food_apple_01', 1.0), ('food_pomegranate_01', 0.8), ('lemon', 0.8), ('food_lime_01', 0.8), ('food_kiwi_01', 0.6),
    ('food_pears_asian_01', 0.8), ('food_lychee_01', 0.4), ('yellow_onion', 0.8), ('sweet_potato', 0.6),
    ('bananas/bananas_bunch', 0.8), ('croissant', 0.8), ('carrot_cake', 0.5), ('strawberry_chocolate_cake', 0.5),
    ('hamburger_buns', 0.5), ('CheeseBox_01', 0.6), ('russian_food_cans_01/*', 0.6), ('long_life_food', 0.4),
    ('vintage_electric_kettle', 0.5), ('ceramic_pot', 0.4), ('wicker_basket_02', 0.6), ('ceramic_vase_01', 0.4),
    ('ceramic_vase_04', 0.4), ('antique_ceramic_vase_01', 0.4), ('carved_wooden_plate', 0.6), ('Lantern_01', 0.4),
    ('wooden_candlestick', 0.4), ('potted_plant_04', 0.5), ('modified_thermos', 0.3), ('brass_goblets/*', 0.4),
    ('magnifying_glass_01', 0.2), ('pocket_watch', 0.2), ('round_spectacles', 0.3),
]

TOOLS = [
    ('adjustable_wrench', 1.0, {'pre': 'lie_y'}), ('pipe_wrench', 0.8, {'pre': 'lie_y'}), ('combination_wrench', 0.8, {'pre': 'lie_y'}), ('ratchet_wrench', 0.6, {'pre': 'lie_y'}),
    ('cross_pein_hammer', 1.0, {'pre': 'lie_y'}), ('wooden_hammer_01', 0.8, {'pre': 'lie_y'}), ('screwdriver', 0.8, {'pre': 'lie_y'}), ('flathead_screwdriver', 0.6, {'pre': 'lie_y'}),
    ('screwdrivers_02/screwdrivers_02_a', 0.4), ('pliers', 0.8, {'pre': 'lie_y'}), ('tongue_groove_pliers', 0.6, {'pre': 'lie_y'}), ('handsaw_wood', 0.4),
    ('rusted_hacksaw', 0.5), ('Drill_01', 1.0), ('vintage_hand_drill', 0.5), ('hand_plane_no4', 0.8), ('bench_vice_01', 0.5),
    ('measuring_tape_01', 1.0), ('small_oil_can_01', 0.8), ('oil_tin', 0.8), ('spray_paint_bottles/*', 0.8),
    ('spray_paint_bottles_02', 0.6), ('lubricant_spray', 0.8), ('all_purpose_cleaner', 0.5), ('multi_cleaner_bottle', 0.5),
    ('bleach_bottle', 0.4), ('cleaner_tin_01', 0.8), ('leather_cleaner_can', 0.6), ('drain_cleaner', 0.4), ('metal_toolbox', 0.6),
    ('brass_blowtorch', 0.6), ('propane_torch', 0.5, {'pre': 'lie_y'}), ('retro_multimeter', 0.6), ('circuit_board', 0.5),
    ('vintage_flashlight', 0.6), ('signal_flashlight', 0.5), ('small_plastic_torch', 0.4), ('pastic_torch_6v', 0.4),
    ('lightbulb_01', 0.6), ('lightbulb_led', 0.5), ('modified_thermos', 0.4), ('garden_gloves_01', 0.4), ('can_rusted', 0.8),
    ('crowbar_01', 0.4, {'pre': 'lie_x'}), ('industrial_pipe_lamp', 0.3), ('medical_tape', 0.4), ('stationery_supplies', 0.3),
    ('vintage_stapler', 0.3), ('portable_cassette_player', 0.3), ('digital_wrist_watch', 0.3), ('cigarette_pack', 0.3),
    ('round_spectacles', 0.2), ('rubber_duck_toy', 0.2), ('baseball_01', 0.2), ('food_apple_01', 0.2),
]


# ---------------------------------------------------------------- 2. rustic kitchen
@scene('kitchen', seed=21,
       models=_assets(KITCHEN) | {'painted_wooden_cabinet_02', 'electric_stove', 'painted_wooden_cabinet', 'vintage_wooden_drawer_01',
                                  'wooden_display_shelves_01', 'Shelf_01', 'dining_table', 'painted_wooden_chair_01', 'wooden_stool_01',
                                  'wicker_basket_01', 'wooden_bucket_01', 'wine_barrel_01', 'wooden_crate_02', 'wall_clock',
                                  'hanging_picture_frame_02', 'lantern_chandelier_01'},
       textures={'terracotta_floor_tiles', 'white_plaster_rough_01', 'long_white_tiles', 'plastered_wall_04', 'wood_cabinet_worn_long'},
       hdris={'comfy_cafe'})
def kitchen(L, S):
    return compose(L, S, {
        'room': dict(floor=('terracotta_floor_tiles', 2.0), wall=('white_plaster_rough_01', 2.0), wall_tint=(0.95, 0.88, 0.76),
                     wainscot=('long_white_tiles', 1.0), wainscot_h=1.2, beams='wood_cabinet_worn_long', h=3.0),
        'cam': ((0.0, -3.0, 1.55), (0.0, 2.0, 1.2), 25),
        'back': [('hutch', 'painted_wooden_cabinet_02', -3.0), ('stove', 'electric_stove', -2.1),
                 ('counter', 'painted_wooden_cabinet', -1.05), ('dresser', 'vintage_wooden_drawer_01', 0.55),
                 ('display', 'wooden_display_shelves_01', 2.05), ('shelf', 'Shelf_01', 3.1)],
        'free': [('table', 'dining_table', (0.15, -0.35), 0.03), ('chair', 'painted_wooden_chair_01', (-1.35, -0.4), -1.45),
                 ('stool', 'wooden_stool_01', (1.7, -1.0), 0.4)],

        'shelves': ['hutch', 'display', 'shelf'], 'books': 0.12,
        'tops': ['stove', 'counter', 'dresser', 'table', 'stool', 'chair'],
        'pool': KITCHEN, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.7, 3.4, 1.9), 'count': 12,
                  'pool': [('wicker_basket_01', 1.0, {'stack': True}), ('wooden_bucket_01', 0.8), ('wine_barrel_01', 0.5, {'stack': True}),
                           ('wooden_crate_02', 0.8, {'stack': True}), ('wicker_basket_02', 0.8), ('jug_01', 0.5), ('ceramic_pot', 0.5),
                           ('pot_enamel_01', 0.5), ('bananas/bananas_bunch', 0.3)],
                  'small': KITCHEN, 'small_count': 18},
        'wall_art': {'pool': [('wall_clock', 0.6), ('hanging_picture_frame_02', 0.5, {'scale': (0.4, 0.55)}),
                              ('brass_pan_01', 0.8, {'pre': 'lie_x'}), ('carved_wooden_plate', 1.0, {'pre': 'lie_x'}),
                              ('wooden_cutting_board', 0.8, {'pre': 'lie_x'}), ('tea_set_01/tea_set_01_plate_large_circular_03', 0.6, {'pre': 'lie_x'}),
                              ('fancy_picture_frame_01', 0.5, {'scale': (0.4, 0.6)})], 'z0': 1.45, 'z1': 2.6, 'count': 7},
        'light': warm_interior(key=800, key_temp=5200, fill=110, practical=90),
    })


# ---------------------------------------------------------------- 3. workshop
@scene('workshop', seed=31,
       models=_assets(TOOLS) | {'steel_frame_shelves_01', 'worn_metal_rack', 'metal_office_desk', 'tool_cart', 'steel_frame_shelves_02',
                                'old_drill_press', 'metal_stool_02', 'hand_truck', 'metal_jerrycan', 'propane_tank', 'cardboard_box_01',
                                'plastic_crate_02', 'old_tyre', 'Barrel_02', 'metal_tool_chest', 'wooden_broom', 'dustpan',
                                'wooden_ladder', 'portable_generator', 'plastic_jerrycan', 'small_lpg_tank', 'desk_lamp_arm_01',
                                'hanging_industrial_lamp', 'dartboard', 'fire_alarm', 'korean_fire_extinguisher_01', 'sledgehammer_01',
                                'bolt_cutters_01', 'wooden_axe', 'rusted_spade_01'},
       textures={'concrete_floor_worn_001', 'brick_wall_001', 'plastered_wall_04'}, hdris={'comfy_cafe'})
def workshop(L, S):
    return compose(L, S, {
        'room': dict(floor=('concrete_floor_worn_001', 2.5), wall=('brick_wall_001', 1.8), wall_tint=(0.9, 0.85, 0.8), h=3.2,
                     beams='wood_cabinet_worn_long'),
        'cam': ((0.0, -3.0, 1.55), (0.0, 2.0, 1.2), 25),
        'back': [('rack1', 'steel_frame_shelves_01', -2.95), ('rack2', 'worn_metal_rack', -1.85),
                 ('bench', 'metal_office_desk', 0.0), ('cart', 'tool_cart', 1.75), ('rack3', 'steel_frame_shelves_02', 2.95)],
        'free': [('press', 'old_drill_press', (-0.9, -0.2), 0.5), ('stool', 'metal_stool_02', (0.4, -0.25), 0.3),
                 ('chest', 'metal_tool_chest', (1.6, -0.6), -0.3, {'kind': 'prop'})],

        'shelves': ['rack1', 'rack2', 'rack3'], 'books': 0.0,
        'shelf_pool': TOOLS + [('cardboard_box_01', 0.8, {'scale': (0.5, 0.7)}), ('plastic_crate_02', 0.5, {'scale': (0.7, 0.8)})],
        'tops': ['bench', 'cart', 'chest', 'stool'],
        'pool': TOOLS, 'top_extra': 35,
        'floor': {'region': (-3.4, -1.7, 3.4, 1.9), 'count': 14,
                  'pool': [('metal_jerrycan', 1.0), ('propane_tank', 0.6), ('cardboard_box_01', 1.0, {'stack': True}),
                           ('plastic_crate_02', 0.8, {'stack': True}), ('old_tyre', 0.6, {'stack': True}), ('Barrel_02', 0.6, {'stack': True}),
                           ('portable_generator', 0.4, {'stack': True}), ('plastic_jerrycan', 0.6), ('small_lpg_tank', 0.5),
                           ('korean_fire_extinguisher_01', 0.5), ('metal_toolbox', 0.6, {'stack': True}), ('can_rusted', 0.4)],
                  'small': TOOLS, 'small_count': 20},
        'wall_art': {'pool': [('handsaw_wood', 0.8), ('adjustable_wrench', 1.0), ('pipe_wrench', 1.0), ('cross_pein_hammer', 1.0),
                              ('sledgehammer_01', 0.5), ('bolt_cutters_01', 0.5), ('rusted_hacksaw', 0.6), ('dartboard', 0.6),
                              ('fire_alarm', 0.3), ('wooden_axe', 0.5), ('rusted_spade_01', 0.4), ('combination_wrench', 0.6),
                              ('measuring_tape_01', 0.4), ('garden_hose_wall_mounted_01', 0.3)], 'z0': 1.1, 'z1': 2.7, 'count': 12},
        'light': warm_interior(key=850, key_temp=5600, fill=120, practical=140),
    })


# ---------------------------------------------------------------- more pools
TOYS = [('rubber_duck_toy', 0.5, {'scale': (0.5, 0.65)}), ('baseball_01', 0.6), ('american_football', 0.4), ('dirty_football', 0.4),
        ('Ukulele_01', 0.5), ('chess_set', 0.4), ('sungka_board', 0.3)]
RETRO = [('boombox', 0.8), ('cassette_player', 0.8), ('portable_cassette_player', 0.8), ('gamepad', 0.8), ('gaming_console', 0.6),
         ('vintage_video_camera', 0.8), ('Camera_01', 0.8), ('filmstrip_projector_8mm', 0.4), ('Television_01', 0.3, {'scale': (0.7, 0.8)}),
         ('classic_laptop', 0.3), ('desk_lamp_arm_01', 0.4), ('lightbulb_01', 0.4), ('Megaphone_01', 0.3), ('digital_wrist_watch', 0.4)]
ATTIC = CURIOS + TOYS + RETRO + [('throw_pillows_01/*', 0.5), ('wicker_basket_01', 0.4), ('wooden_lantern_01', 0.5),
                                 ('decorative_book_set_01/*', 0.8, {'kind': 'set'})]
LAB = [('chemistry_set', 1.0), ('bunsen_burner', 1.0), ('vintage_microscope', 1.0), ('industrial_microscope', 0.6),
       ('magnifying_glass_01', 1.0), ('brass_vase_01', 0.6), ('brass_vase_03', 0.8), ('brass_vase_04', 0.8), ('brass_pot_01', 0.6),
       ('brass_goblets/*', 1.0), ('brass_candleholders/brass_candleholder_01', 0.8), ('brass_diya_lantern', 0.8),
       ('wooden_candlestick', 1.0), ('Lantern_01', 0.8), ('vintage_oil_lamp', 0.8), ('wine_bottles_01/*', 1.2), ('jug_01', 0.6),
       ('metal_jug', 0.6), ('ceramic_vase_04', 0.6), ('antique_ceramic_vase_01', 0.5), ('pot_enamel_01', 0.5), ('wooden_bowl_02', 0.8),
       ('lambis_shell', 0.8), ('horse_head', 0.6), ('lion_head', 0.6), ('bull_head', 0.5), ('marble_bust_01', 0.6),
       ('concrete_cat_statue', 0.5), ('seadogs_compass', 0.8), ('pocket_watch', 0.8), ('vintage_pocket_watch', 0.8),
       ('round_spectacles', 0.8), ('bronze_whale_statue', 0.4), ('bronze_ray_statue', 0.3), ('carved_wooden_elephant', 0.6),
       ('food_pomegranate_01', 0.6), ('lemon', 0.5), ('yellow_onion', 0.5), ('ornate_medieval_dagger', 0.5), ('cigarette_case', 0.4),
       ('potted_plant_04', 0.5), ('horse_statue_01', 0.5), ('chess_set', 0.3), ('vintage_spacecraft_instrument', 0.3)]
SEA = [('binoculars', 0.8), ('vintage_binocular', 0.8), ('seadogs_compass', 1.0), ('vintage_radio_transceiver', 0.5),
       ('signal_flashlight', 0.8), ('vintage_flashlight', 0.8), ('portable_searchlight', 0.5), ('old_gas_mask', 0.5, {'pre': 'lie_x'}),
       ('fishermans_hat', 0.8), ('modified_thermos', 0.6), ('plastic_thermos', 0.4), ('clipboard', 0.5), ('office_notepads', 0.4),
       ('binder_notebook', 0.4), ('stationery_supplies', 0.5), ('vintage_stapler', 0.4), ('cigarette_case', 0.5), ('cigarette_pack', 0.5),
       ('pocket_watch', 0.8), ('digital_wrist_watch', 0.5), ('round_spectacles', 0.6), ('bronze_whale_statue', 0.6),
       ('bronze_shark_statue', 0.6), ('bronze_ray_statue', 0.5), ('ammo_box', 0.5), ('medical_box', 0.4), ('medical_tape', 0.5),
       ('long_life_food', 0.5), ('russian_food_cans_01/*', 0.6), (TEAPOT, 0.4), (CUP, 0.5), ('fish_knife', 0.5),
       ('lambis_shell', 0.8), ('Lantern_01', 0.6), ('wooden_lantern_01', 0.6), ('vintage_oil_lamp', 0.5), ('vintage_electric_kettle', 0.4),
       ('television_02', 0.3), ('retro_multimeter', 0.4), ('circuit_board', 0.3), ('vintage_microscope', 0.3), ('Camera_01', 0.5),
       ('wine_bottles_01/*', 0.6), ('jug_01', 0.4), ('rubber_duck_toy', 0.3, {'scale': (0.5, 0.65)}), ('decorative_book_set_01/*', 0.6, {'kind': 'set'})]
ORIENT = [('ceramic_vase_01', 1.0), ('ceramic_vase_02', 1.0), ('ceramic_vase_04', 1.0), ('antique_ceramic_vase_01', 1.2),
          ('brass_vase_01', 0.6), ('brass_vase_02', 0.6), ('brass_pot_01', 0.6), ('brass_pot_02', 0.5), ('brass_goblets/*', 0.6),
          ('brass_diya_lantern', 0.8), (TEAPOT, 1.0), (SUGAR, 0.8), (CUP, 1.0), ('tea_set_01/tea_set_01_saucer_circular_03', 0.5),
          ('katana_stand_01', 0.6), ('sungka_board', 0.6), ('sungka_board_02', 0.4), ('carved_wooden_plate', 0.6), ('wooden_bowl_01', 0.6),
          ('wooden_bowl_02', 0.6), ('potted_plant_04', 0.8), ('chess_set', 0.4), ('brass_candleholders/brass_candleholder_01', 0.6),
          ('Lantern_01', 0.6), ('bronze_whale_statue', 0.3), ('carved_wooden_elephant', 1.0), ('horse_statue_01', 0.6),
          ('concrete_cat_statue', 0.5), ('lambis_shell', 0.8), ('jug_01', 0.4), ('pot_enamel_01', 0.4), ('food_lychee_01', 0.6),
          ('food_pomegranate_01', 0.6), ('food_kiwi_01', 0.4), ('food_lime_01', 0.4), ('magnifying_glass_01', 0.5),
          ('pocket_watch', 0.5), ('round_spectacles', 0.4), ('decorative_book_set_01/*', 0.5, {'kind': 'set'})]
ARMS = [('brass_goblets/*', 1.2), ('brass_candleholders/brass_candleholder_01', 0.8), ('brass_candleholders/brass_candleholder_02', 0.5),
        ('jug_01', 0.6), ('metal_jug', 0.8), ('brass_pot_01', 0.6), ('brass_pan_01', 0.5), ('wooden_bowl_01', 0.6), ('wooden_bowl_02', 0.6),
        ('carved_wooden_plate', 0.6), ('ornate_medieval_dagger', 1.0, {'pre': 'lie_y'}), ('chess_set', 0.5), ('Lantern_01', 0.8),
        ('wooden_candlestick', 1.0), ('vintage_oil_lamp', 0.5), ('brass_diya_lantern', 0.6), ('pocket_watch', 0.5), ('seadogs_compass', 0.5),
        ('food_pomegranate_01', 0.6), ('food_apple_01', 0.6), ('hamburger_buns', 0.4), ('croissant', 0.4), ('wine_bottles_01/*', 0.8),
        ('horse_statue_01', 0.5), ('marble_bust_01', 0.5), ('lion_head', 0.5), ('horse_head', 0.4), ('magnifying_glass_01', 0.4),
        ('wicker_basket_02', 0.4), ('treasure_chest', 0.2, {'scale': (0.35, 0.45)}), ('decorative_book_set_01/*', 0.6, {'kind': 'set'})]
WEAPONS = [('kite_shield', 1.0, {'scale': (0.7, 0.85)}), ('antique_estoc', 0.8), ('ornate_medieval_mace', 0.8), ('ornate_war_hammer', 0.8),
           ('wooden_axe', 0.6), ('wooden_axe_02', 0.6), ('wooden_handle_saber', 0.6), ('antique_katana_01', 0.5),
           ('lion_head', 0.6), ('bull_head', 0.6), ('horse_head', 0.5), ('fancy_picture_frame_02', 0.5, {'scale': (0.6, 0.8)}),
           ('ornate_mirror_01', 0.4, {'scale': (0.6, 0.7)})]
GARDEN = [('garden_gnome', 1.0, {'scale': (0.6, 0.8)}), ('watering_can_metal_01', 1.0), ('garden_gloves_01', 0.8), ('trowel_01', 0.8),
          ('garden_sprinkler_01', 0.6), ('seeding_tray_01', 0.6), ('planter_pot_clay', 1.0), ('potted_plant_04', 0.8),
          ('potted_plant_02', 0.5, {'scale': (0.5, 0.7)}), ('wooden_bucket_02', 0.4, {'scale': (0.6, 0.7)}), ('wicker_basket_01', 0.5),
          ('wicker_basket_02', 0.5), ('rubber_duck_toy', 0.4, {'scale': (0.6, 0.8)}), ('dirty_football', 0.5), ('baseball_01', 0.4),
          ('Lantern_01', 0.5), ('modified_thermos', 0.4), ('jug_01', 0.4), (CUP, 0.4), ('food_apple_01', 0.5), ('lemon', 0.5),
          ('food_pears_asian_01', 0.5), ('tire_pump', 0.4), ('hatchet', 0.5, {'pre': 'lie_y'}), ('concrete_cat_statue', 0.5),
          ('spray_paint_bottles/*', 0.4), ('small_oil_can_01', 0.4), ('can_rusted', 0.5), ('magnifying_glass_01', 0.3),
          ('all_purpose_cleaner', 0.3), ('multi_cleaner_bottle', 0.3), ('decorative_book_set_01/*', 0.3, {'kind': 'set'})]
PLANTS = [('potted_plant_01', 0.6, {'scale': (0.45, 0.6)}), ('potted_plant_02', 0.8, {'scale': (0.5, 0.75)}), ('potted_plant_04', 1.0),
          ('planter_pot_clay', 0.8), ('anthurium_botany_01', 0.4, {'scale': (0.2, 0.3)}), ('periwinkle_plant', 0.6, {'scale': (0.4, 0.5)})]
HARBOR = [('wooden_bucket_01', 0.8, {'stack': True}), ('wooden_bucket_02', 0.6), ('Barrel_01', 0.5, {'stack': True}),
          ('wine_barrel_01', 0.8, {'stack': True}), ('wooden_barrels_01/wooden_barrels_01_barrel01', 0.6, {'stack': True}),
          ('wooden_crate_01', 1.0, {'stack': True}), ('wooden_crate_02', 1.0, {'stack': True}), ('treasure_chest', 0.6, {'stack': True}),
          ('cement_bag', 0.4, {'stack': True}), ('wooden_military_crate', 0.5, {'stack': True}), ('rubber_boots', 0.4),
          ('life_jacket', 0.4, {'pre': 'lie_x', 'scale': (0.9, 1.0)}), ('lifebuoy', 0.5, {'pre': 'lie_x'}), ('wooden_lantern_01', 0.5)]
HARBOR_SMALL = [('brass_goblets/*', 0.8), ('brass_candleholders/brass_candleholder_01', 0.4), ('seadogs_compass', 0.8),
                ('vintage_binocular', 0.6), ('binoculars', 0.4), ('pocket_watch', 0.6), ('round_spectacles', 0.3), ('fishermans_hat', 0.8),
                ('fish_knife', 0.4), ('wine_bottles_01/*', 0.8), ('jug_01', 0.5), ('metal_jug', 0.5), ('pot_enamel_01', 0.4),
                ('bananas/bananas_bunch', 0.6), ('food_apple_01', 0.6), ('food_pomegranate_01', 0.5), ('lemon', 0.5), ('lambis_shell', 0.8),
                ('Lantern_01', 0.6), ('wooden_bowl_02', 0.5), ('ornate_medieval_dagger', 0.4, {'pre': 'lie_y'}), ('bronze_shark_statue', 0.4),
                ('bronze_whale_statue', 0.4), ('signal_flashlight', 0.4), ('modified_thermos', 0.3), ('wicker_basket_02', 0.5),
                ('brass_pot_02', 0.4), ('rubber_duck_toy', 0.2, {'scale': (0.5, 0.6)}), ('magnifying_glass_01', 0.3), ('cigarette_case', 0.3)]
CAMP = [('Lantern_01', 1.0), ('wooden_lantern_01', 0.8), ('vintage_flashlight', 0.8), ('modified_thermos', 0.8), ('plastic_thermos', 0.6),
        ('pot_enamel_01', 1.0), ('metal_jug', 0.6), ('wooden_bowl_01', 0.6), ('wooden_spoon', 0.5), (CUP, 0.5), ('hatchet', 0.8, {'pre': 'lie_y'}),
        ('wooden_axe_03', 0.6, {'pre': 'lie_y'}), ('machete', 0.5, {'pre': 'lie_y'}), ('binoculars', 0.8), ('seadogs_compass', 0.8),
        ('pocket_watch', 0.5), ('round_spectacles', 0.4), ('Ukulele_01', 0.6, {'pre': 'lie_x'}), ('rubber_boots', 0.6), ('fishermans_hat', 0.8),
        ('wicker_basket_01', 0.6), ('food_apple_01', 0.8), ('bananas/bananas_bunch', 0.6), ('croissant', 0.5), ('hamburger_buns', 0.5),
        ('russian_food_cans_01/*', 0.6), ('long_life_food', 0.4), ('decorative_book_set_01/*', 0.3, {'kind': 'set', 'pre': 'lie_y'}),
        ('Camera_01', 0.6), ('portable_cassette_player', 0.5), ('boombox', 0.4), ('plastic_jerrycan', 0.4), ('wooden_bucket_02', 0.4),
        ('propane_torch', 0.4, {'pre': 'lie_y'}), ('can_rusted', 0.5), ('garden_gloves_01', 0.5), ('magnifying_glass_01', 0.3),
        ('trowel_01', 0.4), ('baseball_01', 0.3), ('dirty_football', 0.3)]
MARKET = [('food_apple_01', 1.0), ('food_pears_asian_01', 1.0), ('food_pomegranate_01', 1.0), ('lemon', 1.0), ('food_lime_01', 1.0),
          ('food_kiwi_01', 0.8), ('food_lychee_01', 0.6), ('yellow_onion', 1.0), ('sweet_potato', 0.8), ('bananas/bananas_bunch', 1.0),
          ('croissant', 0.8), ('carrot_cake', 0.5), ('strawberry_chocolate_cake', 0.5), ('hamburger_buns', 0.6), ('CheeseBox_01', 0.6),
          ('jug_01', 0.8), ('ceramic_pot', 0.5), ('ceramic_vase_01', 0.5), ('antique_ceramic_vase_01', 0.5), ('brass_vase_02', 0.5),
          ('brass_pot_01', 0.5), ('carved_wooden_plate', 0.5), ('wooden_bowl_01', 0.6), ('wooden_bowl_02', 0.6), ('wooden_cutting_board', 0.4),
          ('wooden_spoon', 0.4), ('wicker_basket_02', 0.6), (TEAPOT, 0.4), (CUP, 0.5), ('wine_bottles_01/*', 0.8), ('russian_food_cans_01/*', 0.5),
          ('Lantern_01', 0.4), ('Camera_01', 0.3), ('cassette_player', 0.3), ('rubber_duck_toy', 0.3, {'scale': (0.5, 0.6)}),
          ('baseball_01', 0.3), ('chess_set', 0.3), ('planter_pot_clay', 0.5), ('potted_plant_04', 0.6), ('watering_can_metal_01', 0.3),
          ('magnifying_glass_01', 0.3), ('pocket_watch', 0.4), ('carved_wooden_elephant', 0.4), ('decorative_book_set_01/*', 0.5, {'kind': 'set'})]
JUNK = [('old_tyre', 1.0, {'stack': True}), ('rusted_wheel_rim_01', 0.6), ('rusted_wheel_rim_02', 0.6), ('Barrel_01', 0.8, {'stack': True}),
        ('Barrel_02', 0.6, {'stack': True}), ('barrel_03', 0.6, {'stack': True}), ('metal_jerrycan', 0.8), ('metal_jerrycan_green', 0.6),
        ('propane_tank', 0.6), ('small_lpg_tank', 0.6), ('portable_generator', 0.5, {'stack': True}), ('metal_tool_chest', 0.4, {'stack': True}),
        ('metal_toolbox', 0.5, {'stack': True}), ('wooden_military_crate', 0.6, {'stack': True}), ('old_military_crate', 0.4, {'stack': True}),
        ('plastic_crate_01', 0.6, {'stack': True}), ('plastic_crate_03', 0.6, {'stack': True}), ('cardboard_box_01', 0.6, {'stack': True}),
        ('trashbag', 0.6), ('WetFloorSign_01', 0.4), ('korean_fire_extinguisher_01', 0.5), ('Television_01', 0.5, {'stack': True}),
        ('television_02', 0.5), ('vintage_microwave', 0.4, {'stack': True}), ('boombox', 0.4), ('plastic_monobloc_chair_01', 0.4),
        ('metal_stool_01', 0.3), ('wheelchair_01', 0.2), ('hand_truck', 0.3), ('plastic_jerrycan', 0.5), ('can_rusted', 0.5)]
JUNK_SMALL = TOOLS[:30] + [('boombox', 0.4), ('cassette_player', 0.4), ('gamepad', 0.4), ('Megaphone_01', 0.4), ('street_rat', 0.5),
                           ('baseball_bat', 0.4, {'pre': 'lie_y'}), ('dirty_football', 0.4), ('rubber_duck_toy', 0.3, {'scale': (0.5, 0.6)}),
                           ('lightbulb_01', 0.4), ('vintage_flashlight', 0.4), ('old_gas_mask', 0.4, {'pre': 'lie_x'})]
ALLEY = [('wooden_crate_01', 0.8, {'stack': True}), ('wooden_crate_02', 0.8, {'stack': True}), ('plastic_crate_01', 0.8, {'stack': True}),
         ('plastic_crate_02', 0.6, {'stack': True}), ('cardboard_box_01', 0.8, {'stack': True}), ('old_tyre', 0.6, {'stack': True}),
         ('rusted_wheel_rim_01', 0.5), ('trashbag', 1.0), ('metal_jerrycan', 0.4), ('Barrel_01', 0.5, {'stack': True}),
         ('WetFloorSign_01', 0.4), ('plastic_monobloc_chair_01', 0.5), ('fire_hydrant', 0.4), ('korean_fire_extinguisher_01', 0.3),
         ('Television_01', 0.3, {'stack': True}), ('wooden_bucket_02', 0.3), ('metal_toolbox', 0.3, {'stack': True})]
ALLEY_SMALL = [('spray_paint_bottles/*', 1.0), ('spray_paint_bottles_02', 0.8), ('baseball_bat', 0.6, {'pre': 'lie_y'}), ('boombox', 0.6),
               ('street_rat', 0.8), ('can_rusted', 0.8), ('wine_bottles_01/*', 0.6), ('all_purpose_cleaner', 0.4), ('bleach_bottle', 0.4),
               ('cassette_player', 0.5), ('russian_food_cans_01/*', 0.5), ('cigarette_pack', 0.6), ('vintage_flashlight', 0.4),
               ('lightbulb_01', 0.4), ('dirty_football', 0.5), ('baseball_01', 0.4), ('garden_gloves_01', 0.4), ('modified_thermos', 0.4),
               ('oil_tin', 0.4), ('Megaphone_01', 0.3), ('gamepad', 0.4), ('rubber_duck_toy', 0.3, {'scale': (0.5, 0.6)}),
               ('pipe_wrench', 0.4, {'pre': 'lie_y'}), ('crowbar_01', 0.3, {'pre': 'lie_x'}), ('portable_cassette_player', 0.3),
               ('decorative_book_set_01/*', 0.4, {'kind': 'set', 'pre': 'lie_y'})]
COURT = [('potted_plant_01', 0.8, {'scale': (0.6, 0.8)}), ('potted_plant_02', 1.0, {'scale': (0.7, 0.9)}), ('planter_pot_clay', 0.8),
         ('planter_box_01', 0.4, {'stack': True}), ('anthurium_botany_01', 0.3, {'scale': (0.25, 0.3)}), ('concrete_cat_statue', 0.6),
         ('garden_gnome', 0.3, {'scale': (0.6, 0.7)}), ('wooden_bucket_02', 0.3), ('watering_can_metal_01', 0.6), ('wicker_basket_01', 0.4)]
COURT_SMALL = [(CUP, 0.6), (TEAPOT, 0.5), (SUGAR, 0.3), ('jug_01', 0.6), ('wine_bottles_01/*', 0.6), ('brass_goblets/*', 0.4),
               ('croissant', 0.5), ('food_apple_01', 0.5), ('lemon', 0.5), ('bananas/bananas_bunch', 0.4), ('Camera_01', 0.5),
               ('fishermans_hat', 0.5), ('round_spectacles', 0.5), ('Ukulele_01', 0.4), ('chess_set', 0.4), ('Lantern_01', 0.6),
               ('wooden_candlestick', 0.4), ('magnifying_glass_01', 0.3), ('pocket_watch', 0.4), ('concrete_cat_statue', 0.4),
               ('horse_statue_01', 0.4), ('marble_bust_01', 0.3), ('potted_plant_04', 0.8), ('garden_gloves_01', 0.4), ('trowel_01', 0.4),
               ('cassette_player', 0.3), ('rubber_duck_toy', 0.2, {'scale': (0.5, 0.6)}), ('decorative_book_set_01/*', 0.5, {'kind': 'set', 'pre': 'lie_y'})]


def _req(*pools):
    out = set()
    for p in pools:
        out |= _assets(p)
    return out


def water(L, y0, y1=80.0, x0=-60.0, x1=60.0, z=-0.7, color=(0.05, 0.09, 0.08)):
    """A calm sea: dark glossy surface with a gentle wave normal map."""
    m = L.bpy.data.materials.new('water')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = 0.04
    b.inputs['IOR'].default_value = 1.33
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 1.6
    tex.inputs['Detail'].default_value = 6
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    L.plane('water', [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], m, L.collection('set'))


def awning(L, x0, x1, y_wall, depth, z_wall, z_front, tex='fabric_pattern_07', tint=None):
    """A sloping cloth awning over a stall, fixed to the wall."""
    m = L.tex_material('awning_' + tex, tex, tint=tint, bump=0.5)
    L.plane('awning', [(x0, y_wall, z_wall), (x1, y_wall, z_wall), (x1, y_wall - depth, z_front), (x0, y_wall - depth, z_front)], m,
            L.collection('set'), uv_scale=1 / 0.4, uv_axes='xy')


# ---------------------------------------------------------------- 4. attic
@scene('attic', seed=41,
       models=_req(ATTIC) | {'wooden_bookshelf_worn', 'painted_wooden_cabinet', 'drawer_cabinet', 'painted_wooden_shelves', 'Shelf_01',
                             'Rockingchair_01', 'spinning_wheel_01', 'treasure_chest', 'wooden_crate_02', 'cardboard_box_01', 'vintage_suitcase',
                             'painted_wooden_stool', 'kite_shield', 'dartboard', 'vintage_crutches_01', 'metal_detector'},
       textures={'wood_planks_dirt', 'raw_plank_wall', 'wood_cabinet_worn_long'}, hdris={'hayloft'})
def attic(L, S):
    return compose(L, S, {
        'room': dict(floor=('wood_planks_dirt', 2.0), wall=('raw_plank_wall', 2.0), wall_tint=(0.8, 0.72, 0.62), h=2.8,
                     beams='wood_cabinet_worn_long', ceiling=('raw_plank_wall', 2.0)),
        'cam': ((0.0, -3.0, 1.45), (0.0, 2.0, 1.1), 25),
        'back': [('shelf', 'wooden_bookshelf_worn', -2.85), ('cab', 'painted_wooden_cabinet', -1.4), ('drawers', 'drawer_cabinet', 0.15),
                 ('small', 'painted_wooden_shelves', 1.2), ('wall', 'Shelf_01', 2.15), ('shelf2', 'wooden_bookshelf_worn', 3.4, {'scale': 0.92})],
        'free': [('rock', 'Rockingchair_01', (-2.0, -0.5), 0.6, {'kind': 'prop'}), ('wheel', 'spinning_wheel_01', (-0.6, 0.55), 0.35, {'kind': 'prop'}),
                 ('chest', 'treasure_chest', (0.6, -0.6), -0.2, {'kind': 'prop'}), ('crate', 'wooden_crate_02', (2.1, -0.4), 0.3, {'kind': 'prop'}),
                 ('case', 'vintage_suitcase', (-0.9, -0.9), 0.15, {'kind': 'prop'})],
        'shelves': ['shelf', 'cab', 'drawers', 'small', 'wall', 'shelf2'], 'books': 0.45, 'shelf_pool': ATTIC,
        'tops': ['chest', 'crate', 'case', 'rock'], 'pool': ATTIC, 'top_extra': 25,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 14,
                  'pool': [('cardboard_box_01', 1.0, {'stack': True}), ('wooden_crate_01', 0.6, {'stack': True}), ('vintage_suitcase', 0.6, {'stack': True}),
                           ('wicker_basket_01', 0.6), ('painted_wooden_stool', 0.5, {'stack': True}), ('Television_01', 0.4, {'stack': True}),
                           ('boombox', 0.4), ('metal_detector', 0.3), ('Lantern_01', 0.4), ('wooden_bucket_02', 0.3, {'scale': (0.6, 0.7)}),
                           ('standing_picture_frame_01', 0.4), ('Ukulele_01', 0.3)],
                  'small': ATTIC, 'small_count': 22},
        'wall_art': {'pool': WALL_ART + [('kite_shield', 0.5, {'scale': (0.6, 0.7)}), ('dartboard', 0.5)], 'z0': 1.4, 'z1': 2.4, 'count': 6},
        'light': warm_interior(hdri='hayloft', key=1100, key_temp=4300, fill=70, practical=60),
    })


# ---------------------------------------------------------------- 5. alchemist's lab
@scene('alchemy', seed=51,
       models=_req(LAB, BOOKROW) | {'GothicCabinet_01', 'wooden_display_shelves_01', 'Shelf_01', 'drawer_cabinet', 'wooden_bookshelf_worn',
                                    'round_wooden_table_01', 'GothicCommode_01', 'wooden_stool_02', 'wine_barrel_01', 'chinese_chandelier',
                                    'kite_shield'},
       textures={'castle_brick_07', 'cobblestone_floor_04', 'wood_cabinet_worn_long'}, hdris={'fireplace'})
def alchemy(L, S):
    return compose(L, S, {
        'room': dict(floor=('cobblestone_floor_04', 2.0), wall=('castle_brick_07', 2.5), wall_tint=(0.8, 0.7, 0.6), h=3.2,
                     beams='wood_cabinet_worn_long'),
        'cam': ((0.0, -3.0, 1.55), (0.0, 2.0, 1.2), 25),
        'back': [('gothic', 'GothicCabinet_01', -2.6), ('disp', 'wooden_display_shelves_01', -1.1), ('wall', 'Shelf_01', 0.15),
                 ('drawers', 'drawer_cabinet', 1.35), ('books', 'wooden_bookshelf_worn', 2.95)],
        'free': [('table', 'round_wooden_table_01', (0.1, -0.35), 0.0), ('commode', 'GothicCommode_01', (-1.75, -0.75), 0.35),
                 ('stool', 'wooden_stool_02', (1.3, -0.9), 0.0), ('barrel', 'wine_barrel_01', (2.25, -0.7), 0.4, {'kind': 'prop'})],
        'shelves': ['gothic', 'disp', 'wall', 'drawers', 'books'], 'books': 0.45, 'shelf_pool': LAB,
        'tops': ['table', 'commode', 'stool', 'barrel'], 'pool': LAB, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 10,
                  'pool': [('wooden_bucket_01', 0.6), ('wicker_basket_01', 0.6, {'stack': True}), ('treasure_chest', 0.5, {'stack': True}),
                           ('wooden_crate_02', 0.5, {'stack': True}), ('antique_ceramic_vase_01', 0.6), ('brass_vase_01', 0.6),
                           ('Lantern_01', 0.6), ('wine_bottles_01/*', 0.6), ('jug_01', 0.4)],
                  'small': LAB, 'small_count': 14},
        'wall_art': {'pool': WALL_ART + [('kite_shield', 0.4, {'scale': (0.6, 0.7)}), ('lion_head', 0.4), ('bull_head', 0.4)],
                     'z0': 1.5, 'z1': 2.8, 'count': 6},
        'light': warm_interior(hdri='fireplace', key=650, key_temp=4000, fill=60, practical=150),
    })


# ---------------------------------------------------------------- 6. lighthouse keeper's room
@scene('keeper', seed=61,
       models=_req(SEA, BOOKROW) | {'worn_metal_rack', 'metal_office_desk', 'steel_frame_shelves_02', 'painted_wooden_cabinet',
                                    'wooden_display_shelves_01', 'metal_stool_03', 'industrial_storage_cart', 'old_military_crate',
                                    'wooden_military_crate', 'rubber_boots', 'life_jacket', 'lifebuoy', 'wooden_crate_01', 'metal_jerrycan',
                                    'propane_tank', 'wooden_bucket_01', 'vintage_telephone_wall_clock', 'wall_clock', 'fire_alarm',
                                    'industrial_caged_sconce', 'hanging_picture_frame_02', 'fancy_picture_frame_01'},
       textures={'wood_floor_worn', 'white_plaster_rough_02', 'blue_painted_planks'}, hdris={'comfy_cafe'})
def keeper(L, S):
    return compose(L, S, {
        'room': dict(floor=('wood_floor_worn', 2.0), wall=('white_plaster_rough_02', 2.0), wall_tint=(0.92, 0.94, 0.95),
                     wainscot=('blue_painted_planks', 1.6), wainscot_h=1.1, h=2.9),
        'cam': ((0.0, -3.0, 1.5), (0.0, 2.0, 1.15), 25),
        'back': [('rack', 'worn_metal_rack', -2.95), ('desk', 'metal_office_desk', -1.15), ('steel', 'steel_frame_shelves_02', 0.4),
                 ('cab', 'painted_wooden_cabinet', 1.45), ('disp', 'wooden_display_shelves_01', 2.85)],
        'free': [('stool', 'metal_stool_03', (-0.9, -0.15), 0.4), ('cart', 'industrial_storage_cart', (1.8, -0.75), -0.3),
                 ('crate', 'old_military_crate', (-0.3, -1.0), 0.15, {'kind': 'prop'})],
        'shelves': ['rack', 'steel', 'cab', 'disp'], 'books': 0.3, 'shelf_pool': SEA,
        'tops': ['desk', 'cart', 'crate', 'stool'], 'pool': SEA, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 12,
                  'pool': [('rubber_boots', 0.6), ('life_jacket', 0.5, {'pre': 'lie_x'}), ('wooden_crate_01', 0.6, {'stack': True}),
                           ('wooden_military_crate', 0.5, {'stack': True}), ('metal_jerrycan', 0.5), ('propane_tank', 0.3),
                           ('wooden_bucket_01', 0.4), ('wooden_lantern_01', 0.5), ('lifebuoy', 0.4, {'pre': 'lie_x'})],
                  'small': SEA, 'small_count': 16},
        'wall_art': {'pool': [('lifebuoy', 1.0, {'scale': (0.6, 0.7)}), ('vintage_telephone_wall_clock', 0.6), ('wall_clock', 0.6),
                              ('fire_alarm', 0.3), ('industrial_caged_sconce', 0.4, {'scale': (0.5, 0.6)}), ('hanging_picture_frame_02', 0.6, {'scale': (0.5, 0.7)}),
                              ('fancy_picture_frame_01', 0.5, {'scale': (0.5, 0.7)}), ('life_jacket', 0.5, {'scale': (0.7, 0.8)})],
                     'z0': 1.5, 'z1': 2.5, 'count': 6},
        'light': warm_interior(key=1100, key_temp=6200, fill=130, practical=60),
    })


# ---------------------------------------------------------------- 7. oriental tea room
@scene('teahouse', seed=71,
       models=_req(ORIENT, BOOKROW) | {'chinese_cabinet', 'chinese_screen_panels', 'chinese_console_table', 'chinese_tea_table',
                                       'chinese_armchair', 'chinese_stool', 'chinese_chandelier', 'antique_katana_01', 'katana_stand_01'},
       textures={'red_plaster_weathered', 'dark_wooden_planks', 'wooden_panels'}, hdris={'comfy_cafe'})
def teahouse(L, S):
    return compose(L, S, {
        'room': dict(floor=('dark_wooden_planks', 2.0), wall=('red_plaster_weathered', 2.0), wall_tint=(0.55, 0.22, 0.16),
                     wainscot=('wooden_panels', 1.4), wainscot_h=0.9, h=3.2),
        'rug': (-1.6, -1.0, 1.8, 0.9),
        'cam': ((0.0, -3.0, 1.5), (0.0, 2.0, 1.15), 25),
        'back': [('cab', 'chinese_cabinet', -2.9, {'scale': 0.82}), ('screen', 'chinese_screen_panels', -1.55),
                 ('console', 'chinese_console_table', 0.25), ('cab2', 'chinese_cabinet', 1.85, {'scale': 0.82}),
                 ('console2', 'chinese_console_table', 3.2, {'scale': 0.6})],
        'free': [('tea', 'chinese_tea_table', (0.1, -0.4), 0.05), ('arm', 'chinese_armchair', (-1.45, -0.6), 0.45),
                 ('stool', 'chinese_stool', (1.35, -0.75), -0.2), ('lamp', 'chinese_chandelier', (0.1, 0.4), 0.0, {'z': 2.4, 'scale': 0.8})],
        'shelves': ['cab', 'cab2'], 'books': 0.25, 'shelf_pool': ORIENT,
        'tops': ['console', 'console2', 'tea', 'stool', 'arm'], 'pool': ORIENT, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 10,
                  'pool': [('antique_ceramic_vase_01', 1.0), ('ceramic_vase_03', 0.6), ('brass_vase_01', 0.6), ('potted_plant_02', 0.5, {'scale': (0.6, 0.8)}),
                           ('katana_stand_01', 0.5), ('Lantern_01', 0.5), ('wicker_basket_02', 0.4), ('brass_pot_01', 0.4)],
                  'small': ORIENT, 'small_count': 14},
        'wall_art': {'pool': [('fancy_picture_frame_01', 0.6, {'scale': (0.6, 0.8)}), ('hanging_picture_frame_03', 0.6, {'scale': (0.6, 0.8)}),
                              ('antique_katana_01', 0.6, {'pre': 'lie_y'}), ('wall_clock', 0.4), ('ornate_mirror_01', 0.4, {'scale': (0.6, 0.7)}),
                              ('carved_wooden_plate', 0.6, {'pre': 'lie_x'}), ('hanging_picture_frame_02', 0.5, {'scale': (0.5, 0.6)})],
                     'z0': 1.4, 'z1': 2.7, 'count': 6},
        'light': warm_interior(key=700, key_temp=4600, fill=90, practical=160),
    })


# ---------------------------------------------------------------- 8. 80s living room
@scene('livingroom', seed=81,
       models=_req(CURIOS, TOYS, RETRO, BOOKROW) | {'wooden_display_shelves_01', 'painted_wooden_shelves', 'modern_wooden_cabinet', 'Shelf_01',
                                                   'drawer_cabinet', 'Sofa_01', 'coffee_table_round_01', 'mid_century_lounge_chair',
                                                   'side_table_01', 'throw_pillows_01', 'potted_plant_01', 'Television_01', 'vintage_telephone_wall_clock'},
       textures={'beige_wall_002', 'wood_floor_worn', 'wooden_panels'}, hdris={'comfy_cafe'})
def livingroom(L, S):
    pool = TOYS + RETRO + CURIOS[:40] + [(CUP, 0.6), ('carrot_cake', 0.4), ('bananas/bananas_bunch', 0.4), ('throw_pillows_01/*', 0.4)]
    return compose(L, S, {
        'room': dict(floor=('wood_floor_worn', 2.0), wall=('beige_wall_002', 2.0), wall_tint=(0.88, 0.76, 0.58),
                     wainscot=('wooden_panels', 1.4), wainscot_h=0.9, h=2.9),
        'rug': (-1.9, -1.3, 1.7, 0.7),
        'cam': ((0.0, -3.1, 1.45), (0.0, 2.0, 1.1), 25),
        'back': [('disp', 'wooden_display_shelves_01', -2.95), ('small', 'painted_wooden_shelves', -1.95),
                 ('tv', 'modern_wooden_cabinet', -0.2), ('wall', 'Shelf_01', 1.75), ('drawers', 'drawer_cabinet', 3.0)],
        'free': [('sofa', 'Sofa_01', (-1.7, -0.85), 0.35), ('table', 'coffee_table_round_01', (0.15, -0.55), 0.0),
                 ('chair', 'mid_century_lounge_chair', (1.75, -0.75), -0.6), ('side', 'side_table_01', (2.85, -0.35), -0.2)],
        'shelves': ['disp', 'small', 'wall', 'drawers'], 'books': 0.45, 'shelf_pool': pool,
        'tops': ['tv', 'table', 'side', 'sofa', 'chair'], 'pool': pool, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 12,
                  'pool': [('potted_plant_01', 0.5, {'scale': (0.6, 0.75)}), ('potted_plant_02', 0.6, {'scale': (0.6, 0.8)}), ('boombox', 0.5),
                           ('Television_01', 0.4, {'stack': True}), ('cardboard_box_01', 0.4, {'stack': True}), ('wicker_basket_01', 0.4),
                           ('Ukulele_01', 0.4), ('dirty_football', 0.4), ('american_football', 0.3), ('throw_pillows_01/*', 0.4)],
                  'small': pool, 'small_count': 16},
        'wall_art': {'pool': WALL_ART + [('vintage_telephone_wall_clock', 0.5), ('dartboard', 0.4)], 'z0': 1.4, 'z1': 2.5, 'count': 6},
        'light': warm_interior(key=900, key_temp=5000, fill=110, practical=100, side=1),
    })


# ---------------------------------------------------------------- 9. castle hall
@scene('castle', seed=91,
       models=_req(ARMS, WEAPONS, BOOKROW) | {'GothicCabinet_01', 'GothicCommode_01', 'WoodenTable_01', 'wooden_bookshelf_worn',
                                              'gothic_coffee_table', 'treasure_chest', 'wine_barrel_01', 'WoodenChair_01', 'Chandelier_03',
                                              'wooden_barrels_01', 'brass_candleholders'},
       textures={'castle_brick_07', 'medieval_blocks_02', 'wood_cabinet_worn_long'}, hdris={'fireplace'})
def castle(L, S):
    return compose(L, S, {
        'room': dict(floor=('medieval_blocks_02', 2.5), wall=('castle_brick_07', 2.5), wall_tint=(0.75, 0.72, 0.7), h=3.6,
                     beams='wood_cabinet_worn_long'),
        'rug': (-1.4, -1.2, 1.6, 0.6),
        'cam': ((0.0, -3.2, 1.6), (0.0, 2.0, 1.35), 25),
        'back': [('gothic', 'GothicCabinet_01', -2.55), ('commode', 'GothicCommode_01', -0.9), ('table', 'WoodenTable_01', 0.75),
                 ('books', 'wooden_bookshelf_worn', 2.95)],
        'free': [('ctable', 'gothic_coffee_table', (0.05, -0.55), 0.0), ('chest', 'treasure_chest', (-1.55, -0.85), 0.35, {'kind': 'prop'}),
                 ('barrel', 'wine_barrel_01', (2.1, -0.6), 0.2, {'kind': 'prop'}), ('throne', 'WoodenChair_01', (-3.0, -0.3), 0.55),
                 ('chand', 'Chandelier_03', (0.0, 0.2), 0.0, {'z': 2.55, 'scale': 0.9})],
        'shelves': ['gothic', 'books'], 'books': 0.5, 'shelf_pool': ARMS,
        'tops': ['commode', 'table', 'ctable', 'chest', 'barrel'], 'pool': ARMS, 'top_extra': 30,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 12,
                  'pool': [('wooden_barrels_01/wooden_barrels_01_barrel01', 0.6, {'stack': True}), ('wooden_crate_02', 0.5, {'stack': True}),
                           ('treasure_chest', 0.4, {'stack': True, 'scale': (0.6, 0.7)}), ('wooden_bucket_01', 0.4), ('kite_shield', 0.4, {'pre': 'lie_x'}),
                           ('brass_candleholders/brass_candleholder_03', 0.4), ('antique_ceramic_vase_01', 0.4), ('metal_jug', 0.4),
                           ('Lantern_01', 0.5)],
                  'small': ARMS, 'small_count': 16},
        'wall_art': {'pool': WEAPONS, 'z0': 1.3, 'z1': 3.1, 'count': 10},
        'light': warm_interior(hdri='fireplace', key=750, key_temp=4200, fill=70, practical=200),
    })


# ---------------------------------------------------------------- 10. antique shop
@scene('antiques', seed=101,
       models=_req(CURIOS, RETRO, TOYS, BOOKROW) | {'vintage_cabinet_01', 'wooden_display_shelves_01', 'drawer_cabinet', 'wooden_bookshelf_worn',
                                                   'ClassicConsole_01', 'CashRegister_01', 'Rockingchair_01', 'GreenChair_01', 'Ottoman_01',
                                                   'vintage_grandfather_clock_01', 'Chandelier_02', 'standing_chalkboard_01', 'wicker_basket_01'},
       textures={'diagonal_parquet', 'wooden_panels', 'beige_wall_002'}, hdris={'decor_shop'})
def antiques(L, S):
    pool = CURIOS + RETRO + TOYS
    return compose(L, S, {
        'room': dict(floor=('diagonal_parquet', 2.0), wall=('beige_wall_002', 2.0), wall_tint=(0.55, 0.62, 0.52),
                     wainscot=('wooden_panels', 1.4), wainscot_h=1.0, h=3.2),
        'cam': ((0.0, -3.0, 1.55), (0.0, 2.0, 1.2), 25),
        'back': [('cab', 'vintage_cabinet_01', -2.55), ('disp', 'wooden_display_shelves_01', -0.9), ('clock', 'vintage_grandfather_clock_01', 0.05),
                 ('drawers', 'drawer_cabinet', 1.1), ('books', 'wooden_bookshelf_worn', 2.65)],
        'free': [('counter', 'ClassicConsole_01', (0.5, -0.45), -0.05), ('register', 'CashRegister_01', (0.85, -0.42), -0.25, {'z': 0.951, 'scale': 0.7, 'kind': 'prop'}),
                 ('rock', 'Rockingchair_01', (-1.9, -0.7), 0.55, {'kind': 'prop'}), ('ott', 'Ottoman_01', (-0.6, -1.0), 0.1),
                 ('green', 'GreenChair_01', (2.3, -0.8), -0.5, {'kind': 'set'}), ('chalk', 'standing_chalkboard_01', (-3.2, -0.6), 0.5, {'scale': 0.8}),
                 ('chand', 'Chandelier_02', (0.3, 0.0), 0.0, {'z': 2.35, 'scale': 0.9})],
        'shelves': ['cab', 'disp', 'drawers', 'books'], 'books': 0.3, 'shelf_pool': pool,
        'tops': ['counter', 'ott', 'rock', 'clock', 'green'], 'pool': pool, 'top_extra': 35,
        'floor': {'region': (-3.4, -1.8, 3.4, 1.9), 'count': 12,
                  'pool': [('antique_ceramic_vase_01', 0.6), ('brass_vase_01', 0.6), ('wicker_basket_01', 0.5), ('vintage_suitcase', 0.5, {'stack': True}),
                           ('treasure_chest', 0.4, {'stack': True}), ('Television_01', 0.3, {'stack': True}), ('boombox', 0.3),
                           ('spinning_wheel_01', 0.3), ('horse_statue_01', 0.3), ('standing_picture_frame_02', 0.4), ('Lantern_01', 0.4)],
                  'small': pool, 'small_count': 18},
        'wall_art': {'pool': WALL_ART + [('vintage_telephone_wall_clock', 0.5), ('kite_shield', 0.3, {'scale': (0.5, 0.6)})],
                     'z0': 1.5, 'z1': 2.8, 'count': 8},
        'light': warm_interior(hdri='decor_shop', key=800, key_temp=5000, fill=110, practical=120),
    })


# ---------------------------------------------------------------- outdoor
def outdoor_room(ground, wall, h=4.0, back=2.5, x0=-7.0, x1=7.0, front=-8.0, wall_tint=None, ground_tint=None):
    return dict(x0=x0, x1=x1, back=back, front=front, h=h, floor=ground, wall=wall, wall_tint=wall_tint, floor_tint=ground_tint,
                side=False, ceiling=None, baseboard=False)


OUT_CAM = ((0.0, -3.4, 1.6), (0.0, 2.5, 1.15), 26)


# 11. back alley
@scene('alley', seed=111,
       models=_req(ALLEY, ALLEY_SMALL) | {'rollershutter_door', 'utility_box_02', 'modular_industrial_pipes_01', 'korean_public_payphone_01',
                                          'metal_trash_can', 'barrel_stove', 'concrete_road_barrier_02', 'covered_car', 'exterior_aircon_unit',
                                          'security_light', 'industrial_wall_lamp', 'security_camera_01', 'fire_alarm', 'water_manhole_cover'},
       textures={'cobblestone_floor_01', 'red_brick_plaster_patch_02'}, hdris={'german_town_street'})
def alley(L, S):
    return compose(L, S, {
        'room': outdoor_room(('cobblestone_floor_01', 2.0), ('red_brick_plaster_patch_02', 3.0), h=6.5),
        'cam': OUT_CAM,
        'back': [('door', 'rollershutter_door', -2.4), ('util', 'utility_box_02', 0.25), ('phone', 'korean_public_payphone_01', -0.65),
                 ('pipes', 'modular_industrial_pipes_01', 3.6), ('bin', 'metal_trash_can', 1.85)],
        'free': [('stove', 'barrel_stove', (3.0, 0.6), 0.3, {'kind': 'prop'}), ('barrier', 'concrete_road_barrier_02', (-4.3, 0.9), 0.35),
                 ('car', 'covered_car', (5.6, -0.6), 1.25), ('manhole', 'water_manhole_cover', (0.4, -0.8), 0.0, {'kind': 'prop'})],
        'hung': [('exterior_aircon_unit', 1.1, 3.1, {'kind': 'set'}), ('security_light', -2.4, 3.2), ('industrial_wall_lamp', 0.3, 2.6),
                 ('security_camera_01', 2.6, 3.4)],
        'tops': ['util', 'bin', 'stove', 'barrier', 'car'], 'pool': ALLEY_SMALL, 'top_extra': 20,
        'floor': {'region': (-5.5, -1.2, 5.5, 2.4), 'count': 26, 'pool': ALLEY, 'small': ALLEY_SMALL, 'small_count': 30},
        'wall_art': {'pool': [('fire_alarm', 0.5), ('garden_hose_wall_mounted_01', 0.4), ('industrial_caged_sconce', 0.4, {'scale': (0.5, 0.6)}),
                              ('dartboard', 0.3), ('wall_clock', 0.3)], 'z0': 1.4, 'z1': 2.6, 'count': 3},
        'light': daylight('german_town_street', strength=1.1, rot=1.2, sun=(-0.5, 0.8, -0.55), sun_strength=3.0),
    })


# 12. gardener's backyard
@scene('backyard', seed=121,
       models=_req(GARDEN, PLANTS) | {'planter_box_03', 'steel_frame_shelves_02', 'WoodenTable_03', 'planter_box_01', 'planter_box_02',
                                      'painted_wooden_bench', 'outdoor_table_chair_set_01', 'plastic_monobloc_chair_01', 'stone_fire_pit',
                                      'Barrel_02', 'wooden_bucket_01', 'compost_bag_02', 'garden_hose_wall_mounted_01', 'rusted_spade_01',
                                      'picke_dirty_01', 'wooden_ladder', 'fern_02', 'shrub_04'},
       textures={'leafy_grass', 'weathered_planks'}, hdris={'garden_nook'})
def backyard(L, S):
    return compose(L, S, {
        'room': outdoor_room(('leafy_grass', 2.0), ('weathered_planks', 2.0), h=2.1, wall_tint=(0.85, 0.8, 0.72)),
        'cam': ((0.0, -3.4, 1.65), (0.0, 2.5, 0.95), 26),
        'back': [('raised', 'planter_box_03', -3.4), ('rack', 'steel_frame_shelves_02', -2.4), ('bench', 'WoodenTable_03', -1.05),
                 ('box1', 'planter_box_01', 0.6), ('box2', 'planter_box_02', 2.0), ('pbench', 'painted_wooden_bench', 3.6)],
        'free': [('set', 'outdoor_table_chair_set_01', (-1.2, -1.2), 1.5), ('chair', 'plastic_monobloc_chair_01', (2.4, -0.9), -0.5),
                 ('pit', 'stone_fire_pit', (0.7, -1.7), 0.0), ('barrel', 'Barrel_02', (4.3, 0.6), 0.0, {'kind': 'prop'}),
                 ('ladder', 'wooden_ladder', (-4.6, 0.9), 0.3)],
        'shelves': ['raised', 'rack', 'box1', 'box2'], 'books': 0.0, 'shelf_pool': PLANTS + GARDEN[:12],
        'tops': ['bench', 'set', 'chair', 'pbench', 'barrel'], 'pool': GARDEN, 'top_extra': 25,
        'floor': {'region': (-5.5, -1.4, 5.5, 2.4), 'count': 18,
                  'pool': [('compost_bag_02', 0.6), ('wooden_bucket_01', 0.5), ('planter_pot_clay', 0.8), ('potted_plant_02', 0.6, {'scale': (0.7, 0.9)}),
                           ('potted_plant_01', 0.4, {'scale': (0.6, 0.8)}), ('watering_can_metal_01', 0.6), ('garden_gnome', 0.5),
                           ('rusted_spade_01', 0.4, {'pre': 'lie_y'}), ('picke_dirty_01', 0.3, {'pre': 'lie_y'}), ('wicker_basket_01', 0.5),
                           ('fern_02', 0.4, {'scale': (0.35, 0.5)}), ('shrub_04', 0.4, {'scale': (0.8, 1.0)}), ('garden_sprinkler_01', 0.4)],
                  'small': GARDEN, 'small_count': 26},
        'wall_art': {'pool': [('garden_hose_wall_mounted_01', 0.8), ('rusted_spade_01', 0.5), ('trowel_01', 0.5), ('garden_gloves_01', 0.4),
                              ('wall_clock', 0.3), ('handsaw_wood', 0.4), ('hatchet', 0.4)], 'z0': 1.0, 'z1': 1.8, 'count': 5},
        'light': daylight('garden_nook', strength=1.0, rot=0.6, sun=(0.45, 0.75, -0.6), sun_strength=3.2),
    })


# 13. smugglers' harbor
def _harbor_set(L, R):
    water(L, R['back'] + 0.0)
    m = L.tex_material('pier_beam', 'wood_floor_deck', rough_mul=0.9, tint=(0.35, 0.3, 0.26))
    for k in range(9):
        x = -6.4 + k * 1.6
        L.box(f'post{k}', x - 0.09, R['back'] - 0.18, -1.6, x + 0.09, R['back'], 0.9, m, L.collection('set'), uv_scale=0.6)


@scene('harbor', seed=131,
       models=_req(HARBOR, HARBOR_SMALL) | {'dutch_ship_medium', 'cannon_01', 'ocean_buoy', 'lateral_sea_marker', 'modular_wooden_pier'},
       textures={'wood_floor_deck'}, hdris={'petit_port'})
def harbor(L, S):
    cfg = {
        'room': dict(x0=-7, x1=7, back=2.6, front=-8, h=0.0, floor=('wood_floor_deck', 2.0), wall=('wood_floor_deck', 2.0), side=False,
                     ceiling=None, baseboard=False),
        'extras': [_harbor_set],
        'cam': ((0.0, -3.0, 2.0), (0.0, 4.0, 0.75), 26),
        'free': [('ship', 'dutch_ship_medium', (1.0, 15.0), math.pi / 2 + 0.08, {'z': -3.2}),
                 ('cannon', 'cannon_01', (-3.6, 0.7), 1.25, {'kind': 'prop', 'scale': 0.9}),
                 ('buoy', 'ocean_buoy', (-6.0, 6.5), 0.4, {'z': -1.6}), ('marker', 'lateral_sea_marker', (7.5, 11.0), 0.2, {'z': -2.4, 'scale': 0.8})],
        'tops': ['cannon'], 'pool': HARBOR_SMALL, 'top_extra': 6,
        'floor': {'region': (-5.6, -0.6, 5.6, 2.35), 'count': 34, 'pool': HARBOR, 'small': HARBOR_SMALL, 'small_count': 44},
        'light': daylight('petit_port', strength=1.0, rot=2.2, sun=(0.35, 0.85, -0.45), sun_strength=3.4, sun_temp=5000),
    }
    return compose(L, S, cfg)


# 14. forest campsite
def _forest_set(L, R):
    pass


CAMP_BIG = [('tree_stump_01', 0.8, {'scale': (0.45, 0.6)}), ('tree_stump_02', 0.8, {'scale': (0.45, 0.6)}), ('rock_07', 0.8, {'scale': (1.5, 2.5)}),
            ('stone_01', 0.6, {'scale': (1.5, 3.0)}), ('fern_02', 1.0, {'scale': (0.3, 0.45)}), ('dry_branches_medium_01', 0.6, {'scale': (0.6, 0.9)}),
            ('folding_wooden_stool', 0.5), ('wooden_stool_01', 0.4), ('wicker_basket_01', 0.5), ('wooden_bucket_01', 0.4),
            ('plastic_jerrycan', 0.4), ('wooden_crate_01', 0.5, {'stack': True}), ('treasure_chest', 0.2, {'scale': (0.5, 0.6), 'stack': True}),
            ('moss_01', 0.4, {'scale': (0.5, 0.8)})]


@scene('campsite', seed=141,
       models=_req(CAMP, CAMP_BIG) | {'stone_fire_pit', 'dead_tree_trunk', 'dead_tree_trunk_02', 'boulder_01', 'fir_sapling', 'rock_moss_set_02',
                                      'pine_roots', 'tree_stump_01'},
       textures={'forest_leaves_02'}, hdris={'phalzer_forest_01'})
def campsite(L, S):
    return compose(L, S, {
        'room': dict(x0=-9, x1=9, back=6.0, front=-8, h=0.0, floor=('forest_leaves_02', 2.5), wall=('forest_leaves_02', 2.5), side=False,
                     ceiling=None, baseboard=False),
        'cam': ((0.0, -3.2, 2.3), (0.0, 3.2, 0.1), 26),
        'free': [('pit', 'stone_fire_pit', (0.2, 0.4), 0.3), ('log', 'dead_tree_trunk', (-0.6, 2.4), 0.12, {'scale': 0.75}),
                 ('log2', 'dead_tree_trunk_02', (3.8, 3.4), -0.5, {'scale': 0.6}), ('boulder', 'boulder_01', (-4.4, 3.8), 0.6, {'scale': 0.9}),
                 ('rocks', 'rock_moss_set_02', (1.0, 7.5), 0.0, {'scale': 0.6}), ('fir', 'fir_sapling', (-2.8, 5.5), 0.3, {'scale': 1.3}),
                 ('fir2', 'fir_sapling', (4.6, 6.2), 1.3, {'scale': 1.1}), ('roots', 'pine_roots', (-3.4, 1.2), 0.8, {'scale': 0.7}),
                 ('stump', 'tree_stump_01', (2.3, 0.9), 0.4, {'scale': 0.55})],
        'tops': ['log', 'stump', 'pit', 'boulder', 'log2'], 'pool': CAMP, 'top_extra': 20,
        'floor': {'region': (-5.5, -1.2, 5.5, 4.2), 'count': 30, 'pool': CAMP_BIG, 'small': CAMP, 'small_count': 46},
        'light': daylight('phalzer_forest_01', strength=1.2, rot=0.4, sun=(0.3, 0.6, -0.75), sun_strength=2.6, sun_temp=5200),
    })


# 15. street market
def _market_set(L, R):
    awning(L, -5.4, -1.3, R['back'], 1.7, 2.75, 2.25, tex='fabric_pattern_07')
    awning(L, 0.9, 5.0, R['back'], 1.7, 2.75, 2.25, tex='fabric_pattern_07')


@scene('market', seed=151,
       models=_req(MARKET) | {'large_castle_door', 'rollershutter_window_03', 'WoodenTable_01', 'wooden_table_02', 'small_wooden_table_01',
                              'wooden_crate_01', 'wooden_crate_02', 'wicker_basket_01', 'wine_barrel_01', 'CashRegister_01', 'street_lamp_02',
                              'gallinera_table', 'Barrel_01'},
       textures={'cobblestone_floor_01', 'yellow_plaster', 'fabric_pattern_07', 'fabric_pattern_05'}, hdris={'german_town_street'})
def market(L, S):
    stall = MARKET
    return compose(L, S, {
        'room': outdoor_room(('cobblestone_floor_01', 2.0), ('yellow_plaster', 2.5), h=5.5, wall_tint=(0.95, 0.82, 0.62)),
        'extras': [_market_set],
        'cam': OUT_CAM,
        'back': [('door', 'large_castle_door', -0.3, {'scale': 0.9}), ('shutter', 'rollershutter_window_03', 3.0, {'z': 0.9, 'scale': 0.8})],
        'free': [('t1', 'WoodenTable_01', (-3.3, 1.2), 0.0, {'scale': 1.1}), ('t2', 'wooden_table_02', (2.4, 1.15), 0.0),
                 ('t3', 'small_wooden_table_01', (-1.0, -0.5), 0.15), ('t4', 'gallinera_table', (4.8, 0.2), -0.4),
                 ('lamp', 'street_lamp_02', (-0.3, 2.2), 0.0, {'z': 2.9, 'scale': 0.6})],
        'tops': ['t1', 't2', 't3', 't4'], 'pool': stall, 'top_extra': 30,
        'floor': {'region': (-5.6, -1.0, 5.6, 2.35), 'count': 26,
                  'pool': [('wooden_crate_01', 1.0, {'stack': True}), ('wooden_crate_02', 1.0, {'stack': True}), ('wicker_basket_01', 0.8, {'stack': True}),
                           ('wine_barrel_01', 0.5, {'stack': True}), ('Barrel_01', 0.3, {'stack': True}), ('wicker_basket_02', 0.6),
                           ('ceramic_pot', 0.4), ('potted_plant_02', 0.5, {'scale': (0.6, 0.8)}), ('planter_pot_clay', 0.5), ('jug_01', 0.4)],
                  'small': stall, 'small_count': 36},
        'light': daylight('german_town_street', strength=1.1, rot=2.6, sun=(0.55, 0.7, -0.5), sun_strength=3.2),
    })


# 16. scrapyard
@scene('scrapyard', seed=161,
       models=_req(JUNK, JUNK_SMALL) | {'modular_chainlink_fence', 'covered_car', 'old_military_compressor', 'portable_welding_cart',
                                        'utility_box_01', 'concrete_road_barrier', 'old_drill_press', 'electric_stove', 'metal_trash_can',
                                        'korean_public_payphone_01'},
       textures={'gravel_ground_01', 'rusty_metal_02'}, hdris={'construction_yard'})
def scrapyard(L, S):
    return compose(L, S, {
        'room': outdoor_room(('gravel_ground_01', 2.0), ('rusty_metal_02', 2.5), h=2.6, wall_tint=(0.8, 0.75, 0.7)),
        'cam': ((0.0, -3.4, 1.7), (0.0, 2.5, 0.95), 26),
        'free': [('car', 'covered_car', (-3.3, 1.2), 1.45), ('comp', 'old_military_compressor', (1.4, 1.6), 1.7, {'kind': 'prop'}),
                 ('weld', 'portable_welding_cart', (3.1, 1.7), 0.2, {'kind': 'prop'}), ('box', 'utility_box_01', (4.3, 2.1), 0.0),
                 ('barrier', 'concrete_road_barrier', (-0.3, 1.9), 0.1), ('stove', 'electric_stove', (-1.3, -0.2), 0.5, {'kind': 'prop'}),
                 ('press', 'old_drill_press', (5.2, 0.7), -0.6, {'kind': 'prop'}), ('bin', 'metal_trash_can', (2.8, -0.9), -0.3)],
        'tops': ['car', 'barrier', 'comp', 'stove', 'bin', 'box'], 'pool': JUNK_SMALL, 'top_extra': 30,
        'floor': {'region': (-5.6, -1.2, 5.6, 2.35), 'count': 32, 'pool': JUNK, 'small': JUNK_SMALL, 'small_count': 34},
        'wall_art': {'pool': [('fire_alarm', 0.4), ('industrial_wall_lamp', 0.5), ('garden_hose_wall_mounted_01', 0.3), ('lifebuoy', 0.3),
                              ('dartboard', 0.3)], 'z0': 1.2, 'z1': 2.1, 'count': 3},
        'light': daylight('construction_yard', strength=1.1, rot=0.9, sun=(-0.4, 0.75, -0.55), sun_strength=3.3),
    })


# 17. flowery courtyard
@scene('courtyard', seed=171,
       models=_req(COURT, COURT_SMALL) | {'large_castle_door', 'painted_wooden_bench', 'outdoor_table_chair_set_01', 'round_wooden_table_02',
                                          'gothic_statue', 'street_lamp_01', 'street_lamp_02', 'side_table_tall_01', 'marble_bust_01',
                                          'planter_box_03', 'chinese_stool', 'bar_chair_round_01'},
       textures={'patterned_cobblestone', 'white_stucco'}, hdris={'courtyard'})
def courtyard(L, S):
    return compose(L, S, {
        'room': outdoor_room(('patterned_cobblestone', 2.0), ('white_stucco', 2.5), h=5.0, wall_tint=(0.96, 0.9, 0.8)),
        'cam': OUT_CAM,
        'back': [('door', 'large_castle_door', 0.4, {'scale': 0.95}), ('bench', 'painted_wooden_bench', -2.4),
                 ('raised', 'planter_box_03', 2.6), ('raised2', 'planter_box_03', -4.3)],
        'free': [('statue', 'gothic_statue', (-4.6, 0.6), 0.5, {'scale': 0.9}), ('lamp', 'street_lamp_01', (4.4, 0.9), 0.0),
                 ('set', 'outdoor_table_chair_set_01', (-1.2, -0.9), 1.45), ('rtable', 'round_wooden_table_02', (1.5, -0.6), 0.0),
                 ('stool', 'bar_chair_round_01', (2.4, -1.0), 0.3), ('ped', 'side_table_tall_01', (-3.3, -0.5), 0.0),
                 ('bust', 'marble_bust_01', (-3.3, -0.5), 0.4, {'z': 0.762, 'scale': 0.8, 'kind': 'prop'})],
        'hung': [('street_lamp_02', -1.3, 3.2, {'kind': 'set', 'scale': 0.6}), ('street_lamp_02', 2.0, 3.2, {'kind': 'set', 'scale': 0.6})],
        'shelves': ['raised', 'raised2'], 'books': 0.0, 'shelf_pool': PLANTS,
        'tops': ['bench', 'set', 'rtable', 'stool'], 'pool': COURT_SMALL, 'top_extra': 25,
        'floor': {'region': (-5.6, -1.2, 5.6, 2.35), 'count': 24, 'pool': COURT, 'small': COURT_SMALL, 'small_count': 28},
        'wall_art': {'pool': [('fancy_picture_frame_01', 0.3), ('wall_clock', 0.4), ('garden_hose_wall_mounted_01', 0.4),
                              ('carved_wooden_plate', 0.5, {'pre': 'lie_x'}), ('vintage_telephone_wall_clock', 0.3)], 'z0': 1.5, 'z1': 2.4, 'count': 4},
        'light': daylight('courtyard', strength=1.1, rot=1.8, sun=(-0.5, 0.65, -0.6), sun_strength=3.4),
    })
