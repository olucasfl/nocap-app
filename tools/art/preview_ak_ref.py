"""Fotos do modelo de AK-47 enviado pelo Lucas (arquivo .blend de terceiros, sem scripts executados) para conferir o formato."""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import photo, studio  # noqa: E402

SRC = sys.argv[-2]
OUT = sys.argv[-1]
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False, use_scripts=False)
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
muzzle = [o for o in meshes if o.name.startswith('Ca')][0]
cy = (muzzle.matrix_world @ Vector(muzzle.bound_box[0])).y
rig = bpy.data.objects.new('Rig', None)
bpy.context.collection.objects.link(rig)
for o in meshes:
    o.parent = rig
rig.scale = (0.1, 0.1, 0.1)
# boca da arma para +X
rig.rotation_euler = (0, 0, math.radians(90) if cy < 0 else math.radians(-90))
bpy.context.view_layer.update()
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'ak-ref-lado.png'), (0.0, -1.9, 0.0), (0.0, 0, -0.02), lens=50)
photo(os.path.join(OUT, 'ak-ref-34.png'), (0.8, -1.5, 0.5), (0.0, 0, -0.02), lens=50)
print('FEITO', 'muzzle_y', round(cy, 2))
