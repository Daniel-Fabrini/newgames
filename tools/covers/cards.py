"""Shared card-game props: playing cards (procedural pips), colour cards, chips, joker, felt podium.
Cards stand in the XZ plane facing -Y, pivot at bottom centre (local x +-0.75, z 0..2.1)."""
import math
from props import *
from rig import _mat

CW, CH = 1.5, 2.1


def mats():
    return dict(card=glossy('#fbfbf6', 0.25, 0.7, name='card'), red=glossy('#d8182c', 0.25, 0.6, name='suit_red'),
                blk=glossy('#17171f', 0.25, 0.6, name='suit_blk'))


def suit(kind, s, cx, cz, m, y=-0.03):
    o = []

    def sp(r, x, z, sy=0.22):
        return sphere(r * s, m, loc=(cx + x * s, y, cz + z * s), scale=(1, sy, 1), seg=32)

    def sq(side, x, z, rot=45, sz=1.0):
        b = box((side * s, 0.07, side * s * sz), m, loc=(cx + x * s, y, cz + z * s), bevel=0.01)
        b.rotation_euler = (0, math.radians(rot), 0)
        return b

    def stem(z):
        return cone(0.3 * s, 0.05 * s, 0.7 * s, m, loc=(cx, y, cz + z * s), scale=(1, 0.2, 1), seg=24)
    if kind in ('heart', 'spade'):
        f = 1 if kind == 'heart' else -1
        o += [sq(1.0, 0, -0.1 * f), sp(0.5, -0.354, f * (0.354 - 0.1)), sp(0.5, 0.354, f * (0.354 - 0.1))]
        if kind == 'spade':
            o.append(stem(-0.85))
    elif kind == 'diamond':
        o.append(sq(1.0, 0, 0, 45, 1.45))
    elif kind == 'club':
        o += [sp(0.38, 0, 0.42), sp(0.38, -0.4, -0.12), sp(0.38, 0.4, -0.12), stem(-0.62)]
    return o


def card_back(color='#1d4fd0', accent='#f2c230'):
    o = [box((CW, 0.07, CH), glossy('#fbfbf6', 0.25, 0.7, name='card'), loc=(0, 0, CH / 2), bevel=0.07)]
    o.append(box((CW - 0.2, 0.08, CH - 0.2), glossy(color, 0.3, 0.6, name='back' + color), loc=(0, -0.01, CH / 2), bevel=0.05))
    d = box((0.75, 0.09, 0.75), glossy(accent, 0.3, 0.6, name='backa' + accent), loc=(0, -0.03, CH / 2), bevel=0.02)
    d.rotation_euler = (0, math.radians(45), 0)
    o.append(d)
    o.append(sphere(0.2, glossy(color, 0.3, 0.6, name='back' + color), loc=(0, -0.08, CH / 2), scale=(1, 0.3, 1)))
    return o


def playing_card(rank, kind, big=1.0, face=None):
    M = mats()
    col = M['red'] if kind in ('heart', 'diamond') else M['blk']
    o = [box((CW, 0.07, CH), M['card'], loc=(0, 0, CH / 2), bevel=0.07)]
    if rank in ('K', 'Q', 'J'):  # court: framed coloured panel with big letter + suit
        pm = glossy('#f2c230' if kind in ('heart', 'diamond') else '#3a8ee0', 0.3, 0.6, name='court' + kind)
        o.append(box((1.0, 0.075, 1.25), pm, loc=(0.0, -0.01, 1.05), bevel=0.04))
        o.append(box((0.84, 0.08, 1.09), M['card'], loc=(0.0, -0.02, 1.05), bevel=0.03))
        o.append(text(rank, col, size=0.95, extrude=0.05, loc=(0, -0.07, 1.25), bevel=0.015))
        o += suit(kind, 0.3, 0, 0.62, col, y=-0.07)
    elif rank.isdigit():  # number card: big numeral + suit
        o.append(text(rank, col, size=1.2, extrude=0.06, loc=(0, -0.07, 1.25), bevel=0.02))
        o += suit(kind, 0.34, 0, 0.55, col, y=-0.07)
    else:
        o += suit(kind, 0.55 * big, 0, 1.05 - 0.1, col)
    o += suit(kind, 0.15, -0.5, 1.58 if rank not in ('K', 'Q', 'J') else 1.55, col)
    o.append(text(rank, col, size=0.36, extrude=0.03, loc=(-0.5, -0.05, 1.86), bevel=0.01))
    return o


def joker():
    M = mats()
    o = [box((CW, 0.07, CH), M['card'], loc=(0, 0, CH / 2), bevel=0.07)]
    cols = ['#e0222e', '#2a56e8', '#f2c230', '#22b455']
    # star burst of four coloured balls + jester hat
    for i, c in enumerate(cols):
        a = math.radians(45 + 90 * i)
        o.append(sphere(0.3, glossy(c, 0.25, 0.7, name='jk' + c), loc=(0.42 * math.cos(a), -0.1, 1.05 + 0.42 * math.sin(a)), scale=(1, 0.5, 1)))
    o.append(sphere(0.34, glossy('#a020d0', 0.25, 0.7, name='jkp'), loc=(0, -0.12, 1.05), scale=(1, 0.5, 1)))
    o.append(text('*', M['red'], size=0.5, extrude=0.03, loc=(-0.5, -0.05, 1.86)))
    return o


def color_card(color, symbol=None, wild=False):
    """Glossy rounded colour card with tilted white oval and a symbol (+4 / skip / number)."""
    body = glossy('#14141c' if wild else color, 0.22, 0.8, name='cc' + ('wild' if wild else color))
    wh = glossy('#ffffff', 0.25, 0.7, name='ccw')
    o = [box((CW, 0.1, CH), glossy('#fbfbf6', 0.25, 0.7, name='card'), loc=(0, 0, CH / 2), bevel=0.1)]
    o.append(box((CW - 0.16, 0.12, CH - 0.16), body, loc=(0, -0.01, CH / 2), bevel=0.09))
    ov = sphere(0.5, wh, loc=(0, -0.07, CH / 2), scale=(1.0, 0.1, 1.55))
    ov.rotation_euler = (0, math.radians(32), 0)
    o.append(ov)
    if wild:
        quad = ['#e0222e', '#f2c230', '#22b455', '#2a56e8']
        for i, c in enumerate(quad):
            a = math.radians(32 + 90 * i)
            dx, dz = 0.2 * math.cos(a + 0.5), 0.2 * math.sin(a + 0.5)
            q = sphere(0.2, glossy(c, 0.25, 0.7, name='wq' + c), loc=(dx, -0.12, CH / 2 + dz * 1.3), scale=(1.1, 0.4, 1.3))
            o.append(q)
    else:
        sm = glossy(color, 0.25, 0.7, name='ccs' + color)
        if symbol == 'skip':
            o.append(torus(0.42, 0.09, sm, loc=(0, -0.12, CH / 2), rot=(90, 0, 0)))
            b = box((0.95, 0.1, 0.17), sm, loc=(0, -0.13, CH / 2), bevel=0.04)
            b.rotation_euler = (0, math.radians(45), 0)
            o.append(b)
        elif symbol:
            o.append(text(symbol, sm, size=0.8, extrude=0.06, loc=(0, -0.14, CH / 2), bevel=0.02))
    return o


def chip(x, y, z, col, scale=1.0, stripe='#ffffff'):
    o = [cylinder(0.5, 0.2, glossy(col, 0.25, 0.7, name='chip' + col), bevel=0.05, seg=48)]
    w = glossy(stripe, 0.3, 0.6, name='chipw' + stripe)
    for k in range(8):
        a = k * math.pi / 4
        b = box((0.18, 0.16, 0.22), w, loc=(0.47 * math.cos(a), 0.47 * math.sin(a), 0), bevel=0.02)
        b.rotation_euler = (0, 0, a)
        o.append(b)
    o.append(torus(0.3, 0.025, w, loc=(0, 0, 0.1)))
    return parent(o, loc=(x, y, z), scale=scale)


def chip_stack(x, y, z, cols, scale=1.0, rot=0, stripe=None):
    for i, c in enumerate(cols):
        chip(x + 0.02 * math.sin(i * 2.1 + rot), y + 0.02 * math.cos(i * 1.7 + rot), z + 0.2 * scale * i, c, scale, stripe or ('#ffffff' if c not in ('#f2c230', '#ffffff') else '#8a5a10'))


def fan(card_objs, angs, base=(0, 0.9, 0.05), dx=0.03, dy=0.14, tilt=-9, scale=1.35, pivot_dx=0.0):
    for i, (o, a) in enumerate(zip(card_objs, angs)):
        parent(o, loc=(base[0] + a * dx, base[1] - i * dy, base[2]), rot=(tilt, a, 0), scale=scale)


def felt_podium(felt='#0a7a48', rim='#e8b830', r=3.4):
    cylinder(r, 0.5, _mat('felt', felt, 0.95, 0.0, 0.0), loc=(0, 0, -0.25), bevel=0.1, seg=96)
    torus(r, 0.09, metal(rim, 0.25, name='rim' + rim), loc=(0, 0, 0.0))
