"""Sniper de ferrolho do Fox Shot! (formato de AWP): cano longo com freio de boca, luneta grande, coronha com furo de
polegar, cabo, guarda-mato, carregador curto e alavanca do ferrolho. Peças móveis separadas (Bolt, Magazine, Trigger).
Origem no gatilho; X para a frente; ~1,18 m."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import arc_pts, box, child, cut, cyl, material, photo, profile, reset, sphere, studio, flatten_for_gltf  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
reset()
metal = material('metal', (0.045, 0.048, 0.054), metal=0.9, rough=0.4, wear=0.9, bump=0.1, scale=80)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.3, wear=0.8, scale=60)
chassis = material('chassis', (0.055, 0.09, 0.03), metal=0.0, rough=0.5, wear=0.35, bump=0.3, scale=90)
rubber = material('rubber', (0.02, 0.02, 0.022), metal=0.0, rough=0.8, wear=0.1, bump=0.4, scale=200)
fox = material('fox', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)
glass = material('glass', (0.02, 0.05, 0.09), metal=0.0, rough=0.05)

parts = []
R = -1


def add(o, name=None):
    if name:
        o.name = name
    parts.append(o)
    return o


# ---- ação (tubo), cano longo e freio de boca
add(cyl('Receiver', 0.0215, 0.30, (-0.02, 0, 0.012), 'X', metal, bevel=0.003))
add(box('RecoilLug', (0.03, 0.05, 0.036), (0.135, 0, -0.004), 0.004, metal))
add(cyl('Barrel', 0.0115, 0.66, (0.45, 0, 0.012), 'X', metal))
add(cyl('BarrelCollar', 0.017, 0.030, (0.14, 0, 0.012), 'X', steel, bevel=0.002))
add(cyl('MuzzleBrake', 0.0185, 0.075, (0.805, 0, 0.012), 'X', metal, bevel=0.002))
for i in range(3):
    add(cyl(f'BrakeSlot{i}', 0.0192, 0.004, (0.787 + i * 0.016, 0, 0.012), 'X', steel))
add(cyl('MuzzleTip', 0.0125, 0.012, (0.847, 0, 0.012), 'X', steel))
# ---- chassi: guarda-mão longo e fino, caixa, cabo, coronha com furo de polegar (cortado com boolean)
add(profile('Forend', [(0.130, 0.020), (0.560, 0.004), (0.560, -0.026), (0.130, -0.038)], 0.040, chassis, 0.008))
add(profile('ForendTip', [(0.556, 0.006), (0.585, 0.004), (0.585, -0.024), (0.556, -0.026)], 0.036, fox, 0.003))
stock = profile('Stock', [(-0.160, 0.034), (-0.300, 0.038), (-0.440, 0.036), (-0.462, 0.018), (-0.462, -0.150), (-0.430, -0.156), (-0.360, -0.120), (-0.300, -0.070), (-0.200, -0.085), (-0.170, -0.150), (-0.095, -0.158), (-0.075, -0.052), (-0.045, -0.040), (0.130, -0.038), (0.130, 0.020)], 0.042, chassis, 0.008)
hole = cyl('ThumbHole', 0.034, 0.10, (-0.245, 0, -0.026), 'Y')
cut(stock, hole)
parts.append(stock)
add(box('CheekRiser', (0.130, 0.040, 0.020), (-0.330, 0, 0.047), 0.006, chassis))
add(cyl('RiserKnob', 0.010, 0.016, (-0.260, R * 0.024, 0.047), 'Y', fox, bevel=0.002))
add(box('ButtPad', (0.032, 0.046, 0.170), (-0.478, 0, -0.070), 0.006, rubber))
add(box('ButtSpacer', (0.012, 0.046, 0.170), (-0.456, 0, -0.070), 0.002, fox))
add(profile('TriggerGuard', arc_pts(0.005, -0.040, 0.050, 0.043, 180, 360, 12), 0.012, metal, 0.0015))
trig = profile('Trigger', [(-0.005, -0.040), (0.004, -0.040), (0.010, -0.066), (0.000, -0.066)], 0.008, steel, 0.001)
trig.name = 'Trigger'
parts.append(trig)
add(profile('PistolGrip', [(-0.090, -0.044), (-0.040, -0.044), (-0.060, -0.140), (-0.112, -0.140)], 0.038, chassis, 0.008))
mag = box('Magazine', (0.075, 0.034, 0.075), (0.040, 0, -0.082), 0.005, metal)
parts.append(mag)
add(box('MagFloor', (0.080, 0.038, 0.010), (0.040, 0, -0.123), 0.002, fox))
# ---- ferrolho: alavanca grande no lado direito com a bola
bolt = cyl('BoltBody', 0.0135, 0.07, (-0.12, 0, 0.026), 'X', steel, bevel=0.002)
bolt.name = 'Bolt'
parts.append(bolt)
arm = cyl('BoltArm', 0.0055, 0.075, (-0.115, R * 0.040, 0.026), 'Y', steel)
child(bolt, arm)
knob = sphere('BoltKnob', 0.0155, (-0.115, R * 0.082, 0.026), fox)
child(bolt, knob)
# ---- luneta
add(cyl('ScopeTube', 0.0165, 0.34, (0.0, 0, 0.088), 'X', metal, bevel=0.002))
add(cyl('ScopeObjective', 0.0285, 0.075, (0.2, 0, 0.088), 'X', metal, bevel=0.003))
add(cyl('ObjectiveLens', 0.0262, 0.004, (0.239, 0, 0.088), 'X', glass))
add(cyl('ScopeEyepiece', 0.0235, 0.055, (-0.195, 0, 0.088), 'X', metal, bevel=0.003))
add(cyl('EyeLens', 0.0205, 0.004, (-0.224, 0, 0.088), 'X', glass))
add(cyl('TurretTop', 0.0105, 0.022, (0.01, 0, 0.115), 'Z', steel, bevel=0.002))
add(cyl('TurretSide', 0.0105, 0.022, (0.01, R * 0.025, 0.088), 'Y', steel, bevel=0.002))
add(cyl('FocusRing', 0.0225, 0.020, (-0.12, 0, 0.088), 'X', fox, bevel=0.002))
for i, x in enumerate((-0.07, 0.10)):
    add(box(f'Mount{i}', (0.040, 0.034, 0.030), (x, 0, 0.050), 0.004, metal))
    add(cyl(f'Ring{i}', 0.0215, 0.030, (x, 0, 0.088), 'X', metal, bevel=0.002))
add(box('RailBase', (0.26, 0.030, 0.012), (0.0, 0, 0.034), 0.002, metal))
root = bpy.data.objects.new('Sniper', None)
bpy.context.collection.objects.link(root)
for o in parts:
    o.parent = root

studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'sniper-lado.png'), (0.18, -2.2, 0.0), (0.18, 0, -0.01), lens=50)
photo(os.path.join(OUT, 'sniper-34.png'), (1.2, -1.7, 0.55), (0.18, 0, -0.01), lens=50)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'sniper.glb'), export_format='GLB', export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'sniper.blend'))
print('FEITO')
