"""Pistola silenciada do Fox Shot!: ferrolho com serrilha e janela de ejeção, armação com guarda-mato longo, cabo inclinado
com carregador, silenciador longo. Peças móveis separadas (Slide, Magazine, Trigger). Origem no gatilho; X para a frente."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import arc_pts, box, cyl, material, photo, profile, reset, studio  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
reset()
slide_m = material('slide', (0.035, 0.037, 0.042), metal=0.85, rough=0.38, wear=0.9, bump=0.1, scale=90)
frame_m = material('frame', (0.03, 0.03, 0.034), metal=0.0, rough=0.55, wear=0.35, bump=0.25, scale=160)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.3, wear=0.8, scale=60)
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
slide = box('Slide', (0.185, 0.030, 0.034), (-0.003, 0, 0.033), 0.004, slide_m)
parts.append(slide)
fr = []
for i in range(7):
    s = box(f'Serration{i}', (0.0028, 0.0316, 0.026), (-0.080 + i * 0.0065, 0, 0.034), 0.0006, steel)
    s.parent = slide
fr.append(None)
port = box('EjectionPort', (0.050, 0.002, 0.016), (0.018, R * 0.0152, 0.040), 0.0006, steel)
port.parent = slide
fsight = box('FrontSight', (0.012, 0.006, 0.008), (0.083, 0, 0.054), 0.001, slide_m)
fsight.parent = slide
rsight = box('RearSight', (0.012, 0.016, 0.007), (-0.088, 0, 0.054), 0.001, slide_m)
rsight.parent = slide
cap = box('SlideCap', (0.006, 0.031, 0.034), (0.090, 0, 0.033), 0.002, fox)
cap.parent = slide
# ---- armação: parte de baixo do ferrolho, guarda-mato longo e cabo inclinado com carregador
add(profile('Frame', [(-0.098, 0.016), (0.088, 0.016), (0.088, 0.000), (0.052, -0.003), (0.052, -0.026), (0.034, -0.032), (-0.004, -0.030), (-0.008, -0.004), (-0.012, -0.003), (-0.034, -0.004)], 0.026, frame_m, 0.003))
add(profile('Grip', [(-0.104, 0.016), (-0.012, -0.002), (-0.020, -0.050), (-0.050, -0.118), (-0.122, -0.118)], 0.030, frame_m, 0.005))
add(profile('TriggerGuard', arc_pts(0.030, -0.014, 0.024, 0.017, 180, 360, 12), 0.010, frame_m, 0.0015))
add(profile('BackStrap', [(-0.104, 0.016), (-0.125, 0.012), (-0.128, -0.050), (-0.122, -0.118), (-0.116, -0.118)], 0.026, steel, 0.002))
trig = profile('Trigger', [(0.020, -0.012), (0.027, -0.012), (0.030, -0.034), (0.022, -0.034)], 0.007, steel, 0.001)
trig.name = 'Trigger'
parts.append(trig)
mag = box('Magazine', (0.068, 0.026, 0.020), (-0.088, 0, -0.124), 0.004, steel)
parts.append(mag)
add(box('MagFloorPlate', (0.074, 0.030, 0.010), (-0.090, 0, -0.139), 0.003, fox))
add(box('GripPanelL', (0.050, 0.002, 0.070), (-0.074, 0.0155, -0.058), 0.002, steel, rot=(0, math.radians(14), 0)))
add(box('SlideStop', (0.024, 0.003, 0.008), (-0.040, R * 0.0145, 0.010), 0.001, steel))
add(box('Rail', (0.040, 0.020, 0.006), (0.062, 0, -0.008), 0.001, steel))
# ---- cano e silenciador longo (com anéis laranja)
add(cyl('BarrelStub', 0.0075, 0.060, (0.116, 0, 0.034), 'X', steel))
add(cyl('Adapter', 0.014, 0.020, (0.140, 0, 0.034), 'X', steel, bevel=0.002))
add(cyl('Suppressor', 0.0205, 0.190, (0.245, 0, 0.034), 'X', supp, bevel=0.003))
add(cyl('SuppRingA', 0.0215, 0.008, (0.185, 0, 0.034), 'X', fox, bevel=0.0015))
add(cyl('SuppRingB', 0.0215, 0.008, (0.305, 0, 0.034), 'X', steel, bevel=0.0015))
add(cyl('SuppTip', 0.0155, 0.012, (0.346, 0, 0.034), 'X', steel, bevel=0.002))

root = bpy.data.objects.new('Pistol', None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'pistola-lado.png'), (0.12, -0.9, 0.02), (0.1, 0, -0.04), lens=62)
photo(os.path.join(OUT, 'pistola-34.png'), (0.55, -0.7, 0.28), (0.1, 0, -0.04), lens=62)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'pistola.blend'))
print('FEITO')
