"""Ferramentas comuns dos scripts de arte do Fox Shot! (Blender via `bpy`, só ferramenta de trabalho).

Como rodar (fora do repositório, nada disso entra no package.json):
    python3 -m venv ~/bpyenv && ~/bpyenv/bin/pip install bpy
    ~/bpyenv/bin/python tools/art/rifle.py   # gera dist em tools/art/out/
Convenção: X para a frente (boca da arma em +X), Y para o lado, Z para cima; metros.
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _finish(obj, bevel=0.0, segs=2, smooth=True):
    if bevel > 0:
        m = obj.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = segs
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(35)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def box(name, size, loc, bevel=0.002, mat=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    _finish(o, bevel)
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, r, length, loc, axis='X', mat=None, verts=24, bevel=0.0):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    _finish(o, bevel)
    if mat:
        o.data.materials.append(mat)
    return o


def profile(name, pts, thick, mat=None, bevel=0.002, y=0.0):
    """Perfil lateral (x, z) extrudado em Y (espessura `thick`, centrado em `y`): a silhueta de coronha, cabo, carregador."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new((x, -thick / 2, z)) for x, z in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    verts = [v for v in r['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, thick, 0), verts=verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = (0, y, 0)
    bpy.context.view_layer.objects.active = o
    _finish(o, bevel)
    if mat:
        o.data.materials.append(mat)
    return o


def arc_pts(cx, cz, r_out, r_in, a0, a1, n=10):
    """Faixa curva (para carregador banana e guarda-mato) entre dois raios."""
    out, inn = [], []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        out.append((cx + r_out * math.cos(a), cz + r_out * math.sin(a)))
        inn.append((cx + r_in * math.cos(a), cz + r_in * math.sin(a)))
    return out + inn[::-1]


def material(name, color, metal=0.0, rough=0.5, wear=0.0, bump=0.0, scale=40.0):
    """Material principal com variação de cor por ruído e desgaste nas bordas (aparência de uso)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 8
    nt.links.new(tex.outputs['Object'], noise.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (color[0] * 0.75, color[1] * 0.75, color[2] * 0.75, 1)
    ramp.color_ramp.elements[1].color = (color[0], color[1], color[2], 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    base = ramp.outputs['Color']
    if wear > 0:
        bev = nt.nodes.new('ShaderNodeBevel')
        bev.inputs['Radius'].default_value = 0.004
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        nt.links.new(bev.outputs['Normal'], dot.inputs[0])
        nt.links.new(geo.outputs['Normal'], dot.inputs[1])
        edge = nt.nodes.new('ShaderNodeMapRange')
        edge.inputs['From Min'].default_value = 0.93
        edge.inputs['From Max'].default_value = 0.995
        edge.inputs['To Min'].default_value = wear
        edge.inputs['To Max'].default_value = 0.0
        nt.links.new(dot.outputs['Value'], edge.inputs['Value'])
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.inputs['Color2'].default_value = (0.62, 0.6, 0.57, 1)
        nt.links.new(edge.outputs['Result'], mix.inputs['Fac'])
        nt.links.new(base, mix.inputs['Color1'])
        base = mix.outputs['Color']
    nt.links.new(base, bsdf.inputs['Base Color'])
    # o glTF só leva a cor sólida do material (os nós de ruído/desgaste não exportam): guarda a cor principal no próprio Base Color
    bsdf.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if bump > 0:
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        nt.links.new(noise.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def studio(res=(1280, 720), samples=64):
    """Estúdio de fotografia: fundo, três luzes e câmera. Renderiza em Cycles (CPU)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.05, 0.055, 0.07, 1)
    bg.inputs['Strength'].default_value = 0.9
    sc.world = w

    def light(name, kind, loc, energy, color=(1, 1, 1), size=1.5):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o

    light('key', 'AREA', (1.2, -1.6, 1.4), 220, (1.0, 0.93, 0.82), 1.4)
    light('rim', 'AREA', (-1.4, 1.2, 1.0), 160, (0.7, 0.8, 1.0), 1.2)
    light('fill', 'AREA', (0.4, 1.6, 0.4), 60, (1, 1, 1), 2.0)
    floor = bpy.data.meshes.new('floor')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4)
    bm.to_mesh(floor)
    bm.free()
    fo = bpy.data.objects.new('floor', floor)
    fo.location = (0, 0, -0.3)
    bpy.context.collection.objects.link(fo)
    fm = material('floor', (0.12, 0.12, 0.14), 0.0, 0.8)
    fo.data.materials.append(fm)


def photo(path, loc, look=(0, 0, 0), lens=70):
    if os.environ.get('ART_SKIP_RENDER'):
        return
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    co = bpy.data.objects.new('cam', cam)
    co.location = loc
    bpy.context.collection.objects.link(co)
    co.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = co
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def cut(obj, cutter, keep_cutter=False):
    """Subtrai `cutter` de `obj` (boolean) e aplica: abre furos (aro de dedão da coronha, janelas, estrias)."""
    m = obj.modifiers.new('cut', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cutter
    m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='cut')
    if not keep_cutter:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return obj


def sphere(name, r, loc, mat=None, segs=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=segs // 2)
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    if mat:
        o.data.materials.append(mat)
    return o


def child(parent, o):
    """Prende `o` a `parent` mantendo onde `o` está no mundo (sem somar a posição do pai de novo)."""
    bpy.context.view_layer.update()
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def flatten_for_gltf():
    """O glTF só leva a cor sólida: solta os nós de ruído/desgaste do Base Color (a cor principal já está no valor do material).
    Também tira do arquivo o estúdio de fotos (chão, luzes, câmeras), que não faz parte da peça."""
    for o in list(bpy.data.objects):
        if o.name == 'floor' or o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                for name in ('Base Color', 'Normal'):
                    for lk in list(n.inputs[name].links):
                        m.node_tree.links.remove(lk)
