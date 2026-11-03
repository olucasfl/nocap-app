"""Fuzil de assalto do Fox Shot! (tipo AK): modelo com peças móveis separadas e fotos para aprovação."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import arc_pts, box, cyl, material, photo, profile, reset, studio  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
reset()

steel = material('steel', (0.11, 0.115, 0.125), metal=0.95, rough=0.33, wear=0.9, bump=0.12, scale=60)
dark = material('darksteel', (0.03, 0.032, 0.036), metal=0.8, rough=0.5, wear=0.8, bump=0.1, scale=80)
wood = material('wood', (0.16, 0.055, 0.016), metal=0.0, rough=0.5, wear=0.2, bump=0.3, scale=10)
poly = material('polymer', (0.045, 0.045, 0.05), metal=0.0, rough=0.62, wear=0.3, bump=0.2, scale=120)
fox = material('foxaccent', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)

parts = []

def add(o, name=None):
    if name:
        o.name = name
    parts.append(o)
    return o

# ---- corpo
add(box('Receiver', (0.40, 0.046, 0.066), (-0.02, 0, 0.0), 0.004, steel))
add(box('DustCover', (0.36, 0.044, 0.030), (-0.02, 0, 0.046), 0.006, steel))
add(box('RearBlock', (0.05, 0.04, 0.05), (-0.20, 0, 0.012), 0.004, dark))
# ---- cano, tubo de gás e mira
add(cyl('Barrel', 0.0082, 0.42, (0.36, 0, 0.018), 'X', dark))
add(cyl('GasTube', 0.0078, 0.30, (0.30, 0, 0.046), 'X', steel))
add(box('GasBlock', (0.045, 0.026, 0.05), (0.50, 0, 0.034), 0.004, dark))
add(box('FrontSightBase', (0.03, 0.022, 0.028), (0.56, 0, 0.04), 0.003, dark))
add(box('FrontSightPost', (0.006, 0.006, 0.034), (0.565, 0, 0.074), 0.001, dark))
add(cyl('MuzzleBrake', 0.0135, 0.058, (0.605, 0, 0.018), 'X', dark, bevel=0.002))
for i in range(3):
    add(cyl(f'MuzzleSlot{i}', 0.0142, 0.004, (0.59 + i * 0.012, 0, 0.018), 'X', steel))
add(box('RearSightRamp', (0.07, 0.03, 0.016), (0.07, 0, 0.074), 0.003, dark))
add(box('RearSightLeaf', (0.012, 0.03, 0.02), (0.045, 0, 0.088), 0.002, dark))
# ---- guarda-mão de madeira
add(box('HandguardLower', (0.25, 0.052, 0.046), (0.28, 0, -0.005), 0.009, wood))
add(box('HandguardUpper', (0.22, 0.046, 0.026), (0.27, 0, 0.038), 0.008, wood))
add(box('HandguardCap', (0.012, 0.054, 0.05), (0.41, 0, -0.003), 0.003, fox))
# ---- coronha e cabo
add(profile('Stock', [(-0.17, 0.034), (-0.46, 0.030), (-0.475, -0.085), (-0.44, -0.095), (-0.17, -0.034)], 0.040, wood, 0.01))
add(profile('ButtPlate', [(-0.462, 0.032), (-0.478, 0.03), (-0.49, -0.086), (-0.472, -0.095)], 0.044, poly, 0.003))
add(profile('PistolGrip', [(-0.075, -0.030), (-0.03, -0.030), (-0.055, -0.150), (-0.105, -0.150)], 0.036, wood, 0.008))
add(profile('GripCap', [(-0.106, -0.150), (-0.055, -0.150), (-0.055, -0.162), (-0.108, -0.162)], 0.038, fox, 0.003))
# ---- guarda-mato e gatilho
add(profile('TriggerGuard', arc_pts(0.0, -0.035, 0.040, 0.033, 180, 360, 12), 0.012, steel, 0.0015))
# ---- peças móveis (cada uma é um objeto, para animar no jogo)
def banana(n=14, w=0.028):
    right, left = [], []
    for i in range(n + 1):
        t = i / n
        cx, cz = 0.085 + 0.13 * t ** 1.7, -0.03 - 0.215 * t
        right.append((cx + w, cz))
        left.append((cx - w, cz))
    return right + left[::-1]


mag = profile('Magazine', banana(), 0.030, dark, 0.004)
mag.name = 'Magazine'
parts.append(mag)
add(profile('MagFloor', [(0.178, -0.246), (0.236, -0.246), (0.242, -0.26), (0.172, -0.26)], 0.034, fox, 0.002))
for i in range(4):
    add(box(f'MagRib{i}', (0.052, 0.032, 0.003), (0.1 + 0.012 * i + 0.01 * i * i * 0.3, 0, -0.07 - 0.04 * i), 0.0005, steel, rot=(0, math.radians(-14), 0)))
add(box('MagWell', (0.07, 0.036, 0.024), (0.085, 0, -0.045), 0.003, steel))
trig = profile('Trigger', [(-0.010, -0.034), (0.002, -0.034), (0.008, -0.066), (-0.003, -0.066)], 0.010, dark, 0.001)
trig.name = 'Trigger'; parts.append(trig)
add(box('ChargingHandle', (0.045, 0.012, 0.012), (0.01, 0.034, 0.05), 0.002, dark))
add(cyl('ChargingKnob', 0.011, 0.014, (0.0, 0.040, 0.05), 'Y', fox, bevel=0.002))
add(box('SafetyLever', (0.09, 0.004, 0.02), (-0.06, 0.025, 0.004), 0.001, steel))
add(box('EjectionPort', (0.06, 0.002, 0.026), (-0.01, 0.0235, 0.03), 0.0005, dark))

# detalhes: rebites, ventilação do guarda-mão, anel da massa de mira
for i, x in enumerate((-0.18, -0.10, 0.0, 0.09, 0.17)):
    add(cyl(f'Rivet{i}', 0.0042, 0.003, (x, -0.0245, 0.012), 'Y', dark))
for i in range(6):
    add(box(f'Vent{i}', (0.014, 0.0545, 0.016), (0.19 + i * 0.03, 0, -0.012), 0.001, dark))
add(cyl('SightHood', 0.0155, 0.014, (0.558, 0, 0.056), 'X', dark, bevel=0.002))
add(box('MagCatch', (0.012, 0.03, 0.02), (0.045, 0, -0.058), 0.002, dark))
add(box('Trunnion', (0.03, 0.05, 0.07), (0.18, 0, 0.0), 0.004, dark))

# um pai para mover/rodar tudo junto
root = bpy.data.objects.new('Rifle', None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

# ---- fotos
studio(res=(1024, 576), samples=48)
root.rotation_euler = (0, 0, 0)
photo(os.path.join(OUT, 'rifle-lado.png'), (0.05, -1.9, 0.0), (0.05, 0, -0.07), lens=50)
photo(os.path.join(OUT, 'rifle-34.png'), (0.95, -1.45, 0.5), (0.04, 0, -0.07), lens=50)
photo(os.path.join(OUT, 'rifle-frente.png'), (1.5, -0.7, 0.3), (0.08, 0, -0.06), lens=55)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'rifle.blend'))
print('FEITO')
