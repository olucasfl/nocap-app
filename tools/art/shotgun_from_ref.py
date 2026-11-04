"""Shotgun do Counter Fox a partir do modelo (pump com empunhadura de pistola) enviado pelo Lucas em .fbx (fora do repositório).

Peças: Body, Pump (a empunhadura da frente: anda para trás e para a frente a cada tiro), Loader, Shell (cartucho, usado na recarga) e
Trigger. Boca para +X, ~0,95 m, origem no gatilho, materiais do Counter Fox (as texturas do arquivo não são usadas).

    python tools/art/shotgun_from_ref.py "<shotgun.fbx>" tools/art/out
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, studio, flatten_for_gltf  # noqa: E402

SRC, OUT = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=SRC)
NAMES = {'base': 'Body', 'pump': 'Pump', 'loader': 'Loader', 'slug': 'Shell', 'trigger': 'Trigger'}
meshes = {}
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name in NAMES:
        meshes[NAMES[o.name]] = o
    elif o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
# solta dos pais do arquivo mantendo o lugar no mundo
for o in meshes.values():
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
for o in meshes.values():
    o.name = [k for k, v in meshes.items() if v is o][0]
# no arquivo a boca aponta para -Y: gira 90 graus em Z para a boca ir para +X; ~0,95 m (o arquivo tem 1,38 m)
rig = bpy.data.objects.new('Shotgun', None)
bpy.context.collection.objects.link(rig)
for o in meshes.values():
    o.parent = rig
rig.rotation_euler = (0, 0, math.pi / 2)
rig.scale = (0.69, 0.69, 0.69)
bpy.context.view_layer.update()
c = sum((meshes['Trigger'].matrix_world @ Vector(b) for b in meshes['Trigger'].bound_box), Vector()) / 8
rig.location = -c
bpy.context.view_layer.update()

dark = material('darksteel', (0.035, 0.037, 0.042), metal=0.7, rough=0.45, wear=0.7, bump=0.08, scale=80)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
wood = material('wood', (0.16, 0.055, 0.016), metal=0.0, rough=0.5, wear=0.2, bump=0.3, scale=10)
red = material('shell', (0.7, 0.08, 0.05), metal=0.1, rough=0.5, scale=30)
PICK = {'Body': dark, 'Pump': wood, 'Loader': steel, 'Shell': red, 'Trigger': steel}
for n, o in meshes.items():
    o.data.materials.clear()
    o.data.materials.append(PICK[n])
    for p in o.data.polygons:
        p.use_smooth = False
meshes['Shell'].hide_render = True
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'shotgun-lado.png'), (0.0, -2.2, 0.0), (0.0, 0, -0.03), lens=50)
photo(os.path.join(OUT, 'shotgun-34.png'), (0.95, -1.7, 0.5), (0.0, 0, -0.03), lens=50)
meshes['Shell'].hide_render = False
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'shotgun.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO shotgun', {k: len(v.data.polygons) for k, v in meshes.items()})
