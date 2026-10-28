"""Procedural toy globe (ocean + continents) shared by flags.py and mapquiz.py."""
import bpy
from rig import *


def globe_material(ocean='#1f6fe0', land='#3fbf3a', land2='#2a9a30', scale=1.6, seed=3.0, thresh=0.52):
    m = bpy.data.materials.new('globe')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (seed, seed * 0.7, seed * 1.3)
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 6
    n.inputs['Roughness'].default_value = 0.55
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ce = ramp.color_ramp
    ce.interpolation = 'CONSTANT'
    ce.elements[0].position = 0.0
    ce.elements[0].color = (*srgb(ocean), 1)
    ce.elements[1].position = thresh
    ce.elements[1].color = (*srgb(land), 1)
    e3 = ce.elements.new(thresh + 0.13)
    e3.color = (*srgb(land2), 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.22
    b.inputs['Coat Weight'].default_value = 0.7
    return m
