"""Fuzil de assalto do Fox Shot! com o formato de um AK-47 (coronha em degrau, caixa estampada, guarda-mão de madeira,
tubo de gás, massa de mira alta, carregador banana com nervuras). Peças móveis separadas e fotos para aprovação.

Convenção: X para a frente (boca em +X), Y para a esquerda da arma, Z para cima; a origem é o gatilho. Comprimento ~0,83 m.
"""
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
R = -1  # lado direito da arma (de onde se vê a janela de ejeção): -Y


def add(o, name=None):
    if name:
        o.name = name
    parts.append(o)
    return o


# ---- caixa da culatra (estampada, longa e baixa) e tampa superior
add(box('Receiver', (0.245, 0.040, 0.066), (0.008, 0, -0.004), 0.003, steel))
add(profile('DustCover', [(-0.112, 0.027), (0.115, 0.027), (0.125, 0.034), (0.10, 0.052), (-0.085, 0.056), (-0.112, 0.040)], 0.038, steel, 0.006))
add(box('Trunnion', (0.03, 0.044, 0.066), (0.125, 0, -0.004), 0.004, dark))
add(box('RearBlock', (0.026, 0.040, 0.055), (-0.118, 0, 0.002), 0.004, dark))
# janela de ejeção, alavanca de segurança e alavanca de armar (lado direito)
add(box('EjectionPort', (0.085, 0.002, 0.030), (0.018, R * 0.0205, 0.012), 0.0006, dark))
add(profile('SafetyLever', [(-0.095, -0.012), (-0.012, 0.012), (0.012, 0.016), (0.022, 0.010), (-0.005, 0.000), (-0.080, -0.026)], 0.004, steel, 0.0008, y=R * 0.024))
for i, x in enumerate((-0.09, -0.04, 0.0, 0.05, 0.095)):
    add(cyl(f'Rivet{i}', 0.0036, 0.003, (x, R * 0.0212, -0.022), 'Y', dark))
# ---- mira traseira (sobre o cano, logo à frente da caixa) e tampa do tubo de gás
add(profile('RearSightRamp', [(0.12, 0.058), (0.235, 0.072), (0.235, 0.078), (0.12, 0.076)], 0.026, dark, 0.002))
add(box('RearSightLeaf', (0.012, 0.028, 0.014), (0.185, 0, 0.088), 0.002, dark))
# ---- guarda-mãos de madeira
add(profile('HandguardLower', [(0.118, 0.036), (0.322, 0.030), (0.330, -0.004), (0.316, -0.042), (0.118, -0.044)], 0.060, wood, 0.011))
add(profile('HandguardUpper', [(0.130, 0.030), (0.316, 0.030), (0.320, 0.068), (0.245, 0.078), (0.130, 0.074)], 0.046, wood, 0.009))
add(box('HandguardRetainer', (0.016, 0.050, 0.092), (0.332, 0, 0.014), 0.003, fox))
for i in range(4):
    add(box(f'Groove{i}', (0.020, 0.0565, 0.006), (0.168 + i * 0.036, 0, -0.012), 0.0008, dark))
# ---- cano, tubo de gás, massa de mira e boca
add(cyl('Barrel', 0.0098, 0.62, (0.275, 0, 0.012), 'X', dark))
add(cyl('GasTube', 0.0105, 0.31, (0.275, 0, 0.038), 'X', steel))
add(cyl('CleaningRod', 0.0045, 0.42, (0.340, 0, -0.014), 'X', steel))
add(box('GasBlock', (0.040, 0.034, 0.054), (0.418, 0, 0.026), 0.004, dark))
add(box('FrontSightBase', (0.036, 0.028, 0.080), (0.462, 0, 0.050), 0.004, dark))
add(box('FrontEarL', (0.012, 0.005, 0.042), (0.462, 0.0115, 0.100), 0.001, dark))
add(box('FrontEarR', (0.012, 0.005, 0.042), (0.462, -0.0115, 0.100), 0.001, dark))
add(box('FrontPost', (0.005, 0.005, 0.052), (0.462, 0, 0.108), 0.0005, dark))
add(cyl('BayonetLug', 0.007, 0.024, (0.436, 0, -0.014), 'X', dark))
add(cyl('MuzzleNut', 0.0140, 0.024, (0.505, 0, 0.012), 'X', dark, bevel=0.002))
add(cyl('MuzzleBrake', 0.0125, 0.050, (0.542, 0, 0.012), 'X', dark, bevel=0.002))
add(box('MuzzleSlant', (0.040, 0.024, 0.011), (0.542, 0, 0.028), 0.002, dark, rot=(0, math.radians(-12), 0)))
# ---- coronha de madeira com degrau e placa da soleira
add(profile('Stock', [(-0.105, 0.027), (-0.190, 0.025), (-0.232, 0.013), (-0.315, 0.004), (-0.385, -0.002), (-0.395, -0.122), (-0.366, -0.132), (-0.248, -0.082), (-0.105, -0.043)], 0.036, wood, 0.009))
add(profile('ButtPlate', [(-0.385, 0.000), (-0.402, -0.002), (-0.406, -0.125), (-0.389, -0.133)], 0.040, poly, 0.003))
# ---- cabo de pistola inclinado e guarda-mato
add(profile('PistolGrip', [(-0.038, -0.034), (-0.088, -0.034), (-0.128, -0.150), (-0.078, -0.156)], 0.032, wood, 0.008))
add(profile('GripCap', [(-0.130, -0.150), (-0.078, -0.157), (-0.077, -0.166), (-0.133, -0.160)], 0.036, fox, 0.003))
add(profile('TriggerGuard', arc_pts(0.012, -0.034, 0.044, 0.037, 180, 360, 14), 0.012, steel, 0.0015))
trig = profile('Trigger', [(0.002, -0.034), (0.012, -0.034), (0.020, -0.070), (0.009, -0.070)], 0.010, dark, 0.001)
trig.name = 'Trigger'
parts.append(trig)
# ---- carregador banana com nervuras (peça móvel; as nervuras são filhas dele)
def centerline(n=16):
    return [(0.092 + 0.125 * (i / n) ** 1.5, -0.034 - 0.225 * (i / n)) for i in range(n + 1)]


def band(dx0, dx1, n=16):
    c = centerline(n)
    return [(x + dx1, z) for x, z in c] + [(x + dx0, z) for x, z in c][::-1]


mag = profile('Magazine', band(-0.028, 0.028), 0.028, dark, 0.004)
mag.name = 'Magazine'
parts.append(mag)
ribs = []
for i, dx in enumerate((-0.014, 0.0, 0.014)):
    r = profile(f'MagRib{i}', band(dx - 0.0035, dx + 0.0035), 0.0305, steel, 0.0008)
    r.parent = mag
    ribs.append(r)
add(profile('MagFloor', [(0.187, -0.254), (0.250, -0.266), (0.254, -0.280), (0.183, -0.270)], 0.034, fox, 0.002))
add(box('MagWell', (0.072, 0.036, 0.026), (0.092, 0, -0.042), 0.003, steel))
add(box('MagCatch', (0.012, 0.030, 0.020), (0.040, 0, -0.058), 0.002, dark))
# alavanca de armar (lado direito, com a bolinha laranja)
add(box('ChargingHandle', (0.040, 0.012, 0.010), (0.075, R * 0.030, 0.034), 0.002, dark))
add(cyl('ChargingKnob', 0.011, 0.014, (0.060, R * 0.038, 0.034), 'Y', fox, bevel=0.002))

root = bpy.data.objects.new('Rifle', None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'rifle-lado.png'), (0.08, -1.85, 0.0), (0.08, 0, -0.07), lens=50)
photo(os.path.join(OUT, 'rifle-34.png'), (0.95, -1.5, 0.48), (0.08, 0, -0.07), lens=50)
photo(os.path.join(OUT, 'rifle-frente.png'), (1.4, -0.65, 0.28), (0.08, 0, -0.06), lens=55)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'rifle.blend'))
print('FEITO')
