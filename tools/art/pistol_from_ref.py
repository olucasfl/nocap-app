"""Pistola do Fox Shot! a partir do modelo (Glock 17 com lanterna) enviado pelo Lucas em .usdz (fora do repositório).

Usa só a geometria (reduzida) e materiais do Fox Shot!; as texturas do arquivo (marcas, brasão, gravações) não são usadas.
Peças separadas: Slide (anima ao atirar), Frame, Magazine (anima ao recarregar), Light e LightLens.

    python tools/art/pistol_from_ref.py "<scene.usdc>" tools/art/out
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
bpy.ops.wm.usd_import(filepath=SRC)

KEEP = {
    'g17_gen5_g17_gen5_slide_0': ('Slide', 3600),
    'g17_gen5_g17_gen5_frame_0': ('Frame', 3600),
    'mag_empty_g17_gen5_mag_fde_0': ('Magazine', 1500),
    'body_low_olight_pl2_valkyrie_0': ('Light', 1800),
    'body_low_olight_pl2_valkyrie_lens_0': ('LightLens', 170),
}
objs = {}
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name in KEEP:
        objs[KEEP[o.name][0]] = o
    elif o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
# tira o pai (os "empties" do arquivo) mantendo o lugar no mundo
for o in objs.values():
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()


def center(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


# a boca é para onde a lanterna (que fica na frente da armação) está em relação ao ferrolho
d = center(objs['Light']) - center(objs['Slide'])
ang = math.atan2(d.y, d.x)
slide = objs['Slide']
s_len = slide.dimensions.y
scale = 0.186 / s_len  # ferrolho de ~18,6 cm
rig = bpy.data.objects.new('Pistol', None)
bpy.context.collection.objects.link(rig)
mats = {
    'Slide': material('slide', (0.035, 0.037, 0.042), metal=0.85, rough=0.38, wear=0.9, bump=0.1, scale=90),
    'Frame': material('frame', (0.03, 0.03, 0.034), metal=0.0, rough=0.55, wear=0.35, bump=0.25, scale=160),
    'Magazine': material('mag', (0.03, 0.03, 0.034), metal=0.0, rough=0.55, wear=0.3, bump=0.25, scale=160),
    'Light': material('light', (0.05, 0.052, 0.058), metal=0.85, rough=0.4, wear=0.6, scale=60),
    'LightLens': material('lens', (0.9, 0.9, 0.85), metal=0.0, rough=0.1),
}
tris = 0
for name, o in objs.items():
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mats[name])
    target = [v[1] for v in KEEP.values() if v[0] == name][0]
    have = len(o.data.polygons)
    if have > target:
        m = o.modifiers.new('dec', 'DECIMATE')
        m.ratio = target / have
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='dec')
    for p in o.data.polygons:
        p.use_smooth = True
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    o.parent = rig
rig.scale = (scale,) * 3
rig.rotation_euler = (0, 0, -ang)
bpy.context.view_layer.update()
# origem no centro do ferrolho, apoiada no eixo Z do mundo
rig.location = -center(slide)
bpy.context.view_layer.update()

sc = bpy.context.scene
sc.render.resolution_percentage = 100
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'g17-lado.png'), (0.0, -0.8, 0.0), (0.0, 0, -0.05), lens=62)
photo(os.path.join(OUT, 'g17-34.png'), (0.5, -0.65, 0.25), (0.0, 0, -0.05), lens=62)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'g17.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO tris', tris, 'ang', round(math.degrees(ang)), 'scale', round(scale, 4))
