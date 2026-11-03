"""Fuzil do Fox Shot! a partir do modelo de AK-47 low poly enviado pelo Lucas (peças separadas e animação de tiro/recarga).

Entrada: o .blend de terceiros (fora do repositório; abre sem executar scripts). Saída: fotos e `ak.glb`.
Passos: boca para +X, escala em metros (~0,9 m), materiais do Fox Shot! (madeira avermelhada, aço escuro com desgaste, detalhes
laranja de raposa), nomes em inglês, chanfro leve para pegar brilho. As peças continuam separadas para a animação do jogo.

    python tools/art/ak_from_ref.py "<ak-47 animado.blend>" tools/art/out
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, studio, flatten_for_gltf  # noqa: E402

SRC, OUT = sys.argv[-2], sys.argv[-1]
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False, use_scripts=False)
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()

NAMES = {
    'Receptor': 'Receiver', 'Guardapolvo': 'DustCover', 'Culata': 'Stock', 'Agarradera': 'PistolGrip',
    'Apoya manos': 'HandguardLower', 'Protector de Apoya manos 1': 'HandguardShieldA',
    'Protector de Apoya manos 2': 'HandguardShieldB', 'Protector de Apoya manos 3': 'HandguardShieldC',
    'Cañon': 'Barrel', 'Pasador de Gas': 'GasBlock', 'Piston de Gas 1': 'GasTube', 'Piston de Gas 2': 'GasPiston',
    'Mira del Cañon': 'FrontSightBase', 'Mira del Cañon 1': 'FrontSightPost', 'Mira del Cañon 2': 'FrontEarL',
    'Mira del Cañon 3': 'FrontEarR', 'Mira': 'RearSight', 'Base de la mira': 'RearSightBase',
    'Ajustador de Mira': 'RearSightAdjuster', 'Seguro de Mira': 'RearSightLock', 'Cargador': 'Magazine',
    'Gatillo': 'Trigger', 'Protector del Gatillo': 'TriggerGuard', 'Mecanismo del Gatillo': 'TriggerMechanism',
    'Martillo': 'Hammer', 'Bala': 'Bullet', 'Casquillo': 'Casing', 'Varilla de Limpieza': 'CleaningRod',
    'Cambio de Disparo': 'SelectorLever', 'Agarradera de Salida de Bala': 'EjectionHandle',
    'Salida de la Bala': 'EjectionPort', 'Mecanismo de Descarga': 'MagRelease', 'Protector de Descarga': 'MagReleaseGuard',
    'Asegurador del Cañon': 'BarrelLock', 'Union Cañon-Mira cañon': 'BarrelSightJoint',
}
for o in bpy.data.objects:
    if o.name in NAMES:
        o.name = NAMES[o.name]

meshes = [o for o in bpy.data.objects if o.type == 'MESH']


def center(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


# a boca é para onde aponta o vetor da coronha até o cano
d = center(bpy.data.objects['Barrel']) - center(bpy.data.objects['Stock'])
ang = math.atan2(d.y, d.x)  # direção atual da boca no plano XY
rig = bpy.data.objects.new('Rifle', None)
bpy.context.collection.objects.link(rig)
for o in meshes:
    o.parent = rig
rig.scale = (0.1, 0.1, 0.1)
rig.rotation_euler = (0, 0, -ang)
bpy.context.view_layer.update()
# a origem no gatilho (como nas outras armas): leva a posição do gatilho para o zero
trig = center(bpy.data.objects['Trigger'])
rig.location = -Vector((trig.x, trig.y, trig.z))
bpy.context.view_layer.update()

steel = material('steel', (0.11, 0.115, 0.125), metal=0.95, rough=0.33, wear=0.9, bump=0.12, scale=60)
dark = material('darksteel', (0.03, 0.032, 0.036), metal=0.8, rough=0.5, wear=0.8, bump=0.1, scale=80)
wood = material('wood', (0.16, 0.055, 0.016), metal=0.0, rough=0.5, wear=0.2, bump=0.3, scale=10)
fox = material('foxaccent', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)
brass = material('brass', (0.55, 0.36, 0.1), metal=1.0, rough=0.3, scale=40)
PICK = {
    'Receiver': steel, 'DustCover': steel, 'Stock': wood, 'PistolGrip': wood, 'HandguardLower': wood,
    'HandguardShieldA': fox, 'HandguardShieldB': fox, 'HandguardShieldC': fox, 'Barrel': dark, 'GasBlock': dark,
    'GasTube': steel, 'GasPiston': steel, 'FrontSightBase': dark, 'FrontSightPost': dark, 'FrontEarL': dark,
    'FrontEarR': dark, 'RearSight': dark, 'RearSightBase': dark, 'RearSightAdjuster': dark, 'RearSightLock': dark,
    'Magazine': dark, 'Trigger': steel, 'TriggerGuard': steel, 'Hammer': steel, 'Bullet': brass, 'Casing': brass,
    'CleaningRod': steel, 'SelectorLever': steel, 'EjectionHandle': fox, 'MagRelease': steel,
}
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(PICK.get(o.name, dark))
    for p in o.data.polygons:
        p.use_smooth = False
    # chanfro bem leve nas peças grandes (pega brilho nas quinas sem pesar)
    if len(o.data.polygons) > 40 and o.name not in ('Bullet', 'Casing'):
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = 0.0016
        m.segments = 2
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(30)
# bala e cápsula só aparecem durante o tiro: escondidas na foto parada
for n in ('Bullet', 'Casing'):
    bpy.data.objects[n].hide_render = True

sc = bpy.context.scene
sc.render.resolution_percentage = 100
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'ak-lado.png'), (0.0, -1.9, 0.0), (0.0, 0, -0.07), lens=50)
photo(os.path.join(OUT, 'ak-34.png'), (0.85, -1.45, 0.45), (0.0, 0, -0.07), lens=50)
for n in ('Bullet', 'Casing'):
    bpy.data.objects[n].hide_render = False
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'ak.glb'), export_format='GLB', export_apply=True, export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'ak.blend'))
tris = sum(len(p.vertices) - 2 for o in meshes for p in o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().polygons)
print('FEITO tris', tris, 'ang', round(math.degrees(ang)))
