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
        lv = L.flat_level(0.0, *fl['region'], tag='floor')
        C.fill([lv], fl['pool'], fl['count'], jitter=fl.get('jitter', 0.8))
        if fl.get('small'):
            C.build_occluder()
            C.fill([lv], fl['small'], fl.get('small_count', 20), jitter=1.2)
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
