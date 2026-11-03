"""Sniper do Fox Shot! a partir do modelo L96A1 enviado pelo Lucas (.fbx de terceiros, fora do repositório).

Só a geometria entra; as texturas do arquivo não são usadas (materiais do Fox Shot!). O arquivo vem como uma malha única
com 6 materiais: separo por material e depois por partes soltas, para o jogo poder animar o que for peça separada.

    python tools/art/sniper_from_ref.py "<Team3_Sanchez_L96A1.fbx>" tools/art/out
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, studio  # noqa: E402

SRC, OUT = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=SRC)
src = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = src
src.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
for o in [x for x in bpy.data.objects if x.type == 'MESH']:
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
parts = [x for x in bpy.data.objects if x.type == 'MESH']
bpy.context.view_layer.update()


def kind(o):
    m = o.data.materials[0].name if o.data.materials else ''
    for k in ('Stock', 'Body', 'Scope', 'Reticle', 'Ammunition', 'GenerealTexture'):
        if k in m:
            return k
    return 'Other'


def center(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


steel = material('steel', (0.11, 0.115, 0.125), metal=0.95, rough=0.33, wear=0.5, bump=0.12, scale=60)
metal = material('metal', (0.045, 0.048, 0.054), metal=0.9, rough=0.4, wear=0.5, bump=0.1, scale=80)
chassis = material('chassis', (0.055, 0.09, 0.03), metal=0.0, rough=0.5, wear=0.2, bump=0.2, scale=90)
brass = material('brass', (0.55, 0.36, 0.1), metal=1.0, rough=0.3, scale=40)
glass = material('glass', (0.02, 0.05, 0.09), metal=0.0, rough=0.05)
fox = material('fox', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.2, scale=30)
MAT = {'Stock': chassis, 'Body': metal, 'Scope': metal, 'Reticle': glass, 'Ammunition': brass, 'GenerealTexture': steel, 'Other': metal}

# nomes: peças grandes pelo tipo; o resto numerado por tamanho
count = {}
rig = bpy.data.objects.new('Sniper', None)
bpy.context.collection.objects.link(rig)
tris = 0
parts.sort(key=lambda o: -len(o.data.polygons))
for o in parts:
    k = kind(o)
    count[k] = count.get(k, 0) + 1
    o.name = f'{k}{count[k]}'
    o.data.materials.clear()
    o.data.materials.append(MAT[k])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    o.parent = rig

# comprimento ~1,18 m ao longo do eixo mais longo; a boca (lado oposto à coronha) para +X
allc = [center(o) for o in parts]
mn = Vector((min(c[i] for c in allc) for i in range(3)))
mx = Vector((max(c[i] for c in allc) for i in range(3)))
size = mx - mn
axis = max(range(3), key=lambda i: size[i])
scale = 1.18 / [max((o.matrix_world @ Vector(b))[axis] for o in parts for b in o.bound_box) - min((o.matrix_world @ Vector(b))[axis] for o in parts for b in o.bound_box)][0]
stock_c = center([o for o in parts if kind(o) == 'Stock'][0])
rest = Vector((sum(c[i] for c in allc) / len(allc) for i in range(3)))
d = rest - stock_c
ang = math.atan2(d.y, d.x) if axis != 2 else 0
rig.scale = (scale,) * 3
rig.rotation_euler = (0, 0, -ang)
bpy.context.view_layer.update()
rig.location = -sum((center(o) for o in parts), Vector()) / len(parts)
bpy.context.view_layer.update()

sc = bpy.context.scene
sc.render.resolution_percentage = 100
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'l96-lado.png'), (0.0, -2.2, 0.0), (0.0, 0, 0.0), lens=50)
photo(os.path.join(OUT, 'l96-34.png'), (1.2, -1.7, 0.55), (0.0, 0, 0.0), lens=50)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'l96.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO partes', len(parts), 'tris', tris, 'eixo', axis, 'ang', round(math.degrees(ang)), 'escala', round(scale, 3))
