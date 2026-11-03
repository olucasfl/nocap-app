"""Pistola silenciada do Fox Shot!: ferrolho com serrilha e janela de ejeção, armação com guarda-mato longo, cabo inclinado
com carregador, silenciador longo. Peças móveis separadas (Slide, Magazine, Trigger). Origem no gatilho; X para a frente."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import arc_pts, box, child, cyl, material, photo, profile, reset, studio  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
reset()
slide_m = material('slide', (0.035, 0.037, 0.042), metal=0.85, rough=0.38, wear=0.9, bump=0.1, scale=90)
frame_m = material('frame', (0.03, 0.03, 0.034), metal=0.0, rough=0.55, wear=0.35, bump=0.25, scale=160)
steel = material('steel', (0.05, 0.052, 0.058), metal=0.85, rough=0.4, wear=0.6, scale=60)
silver = material('silver', (0.5, 0.52, 0.55), metal=1.0, rough=0.25, wear=0.2, scale=60)
supp = material('supp', (0.05, 0.052, 0.058), metal=0.9, rough=0.42, wear=0.7, bump=0.1, scale=70)
fox = material('fox', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)

parts = []
R = -1


def add(o, name=None):
    if name:
        o.name = name
    parts.append(o)
    return o


# ---- ferrolho (peça móvel): corpo, serrilha atrás, janela de ejeção, mira
slide = box('Slide', (0.172, 0.030, 0.034), (-0.008, 0, 0.033), 0.004, slide_m)
parts.append(slide)
fr = []
for i in range(7):
    s = box(f'Serration{i}', (0.0028, 0.0316, 0.026), (-0.080 + i * 0.0065, 0, 0.034), 0.0006, steel)
    child(slide, s)
fr.append(None)
port = box('EjectionPort', (0.058, 0.020, 0.004), (-0.026, 0, 0.0505), 0.0006, silver)
child(slide, port)
block = box('SlideBlock', (0.040, 0.030, 0.014), (0.050, 0, 0.056), 0.004, slide_m)
child(slide, block)
lug = box('BarrelLug', (0.030, 0.028, 0.036), (0.082, 0, 0.034), 0.004, slide_m)
child(slide, lug)
fsight = box('FrontSight', (0.010, 0.006, 0.008), (0.078, 0, 0.0545), 0.001, slide_m)
child(slide, fsight)
rsight = box('RearSight', (0.012, 0.016, 0.007), (-0.088, 0, 0.054), 0.001, slide_m)
child(slide, rsight)
cap = box('SlideCap', (0.004, 0.0305, 0.030), (0.0795, 0, 0.033), 0.002, slide_m)
child(slide, cap)
# ---- armação: parte de baixo do ferrolho, guarda-mato longo e cabo inclinado com carregador
add(profile('Frame', [(-0.098, 0.016), (0.088, 0.016), (0.088, 0.000), (0.052, -0.003), (0.052, -0.026), (0.034, -0.032), (-0.004, -0.030), (-0.008, -0.004), (-0.012, -0.003), (-0.034, -0.004)], 0.026, frame_m, 0.003))
add(profile('Grip', [(-0.030, 0.010), (-0.094, 0.016), (-0.112, -0.114), (-0.056, -0.114)], 0.030, frame_m, 0.005))
add(profile('TriggerGuard', arc_pts(0.030, -0.014, 0.024, 0.017, 180, 360, 12), 0.010, frame_m, 0.0015))
add(profile('BackStrap', [(-0.094, 0.016), (-0.106, 0.012), (-0.124, -0.114), (-0.112, -0.114)], 0.026, steel, 0.002))
trig = profile('Trigger', [(0.020, -0.012), (0.027, -0.012), (0.030, -0.034), (0.022, -0.034)], 0.007, steel, 0.001)
trig.name = 'Trigger'
parts.append(trig)
mag = box('Magazine', (0.050, 0.026, 0.020), (-0.084, 0, -0.120), 0.004, steel, rot=(0, math.radians(-9), 0))
parts.append(mag)
add(box('MagFloorPlate', (0.062, 0.030, 0.010), (-0.086, 0, -0.133), 0.003, fox, rot=(0, math.radians(-9), 0)))
add(box('GripPanelL', (0.040, 0.002, 0.066), (-0.072, 0.0155, -0.052), 0.002, steel, rot=(0, math.radians(10), 0)))
add(box('SlideStop', (0.024, 0.003, 0.008), (-0.040, R * 0.0145, 0.010), 0.001, steel))
add(box('Rail', (0.044, 0.022, 0.008), (0.064, 0, -0.008), 0.001, frame_m))
add(cyl('UnderLight', 0.0075, 0.030, (0.075, 0, -0.018), 'X', frame_m, bevel=0.0015))
# ---- cano e silenciador longo (com anéis laranja)
add(cyl('BarrelStub', 0.0070, 0.040, (0.100, 0, 0.034), 'X', steel))
add(cyl('Adapter', 0.0105, 0.016, (0.108, 0, 0.034), 'X', supp, bevel=0.002))
add(cyl('Suppressor', 0.0128, 0.150, (0.191, 0, 0.034), 'X', supp, bevel=0.002))
add(cyl('SuppRingA', 0.0132, 0.006, (0.186, 0, 0.034), 'X', fox, bevel=0.0012))
add(cyl('SuppRingB', 0.0132, 0.006, (0.244, 0, 0.034), 'X', supp, bevel=0.0012))
add(cyl('SuppTip', 0.0118, 0.010, (0.269, 0, 0.034), 'X', supp, bevel=0.0015))

root = bpy.data.objects.new('Pistol', None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'pistola-lado.png'), (0.12, -0.9, 0.02), (0.1, 0, -0.04), lens=62)
photo(os.path.join(OUT, 'pistola-34.png'), (0.55, -0.7, 0.28), (0.1, 0, -0.04), lens=62)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'pistola.blend'))
print('FEITO')
