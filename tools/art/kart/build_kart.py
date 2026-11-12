"""
Adapta o kart do `racing-kart.zip` (GoCart.obj) para o Fox GP (spec 081, Fase 6). Só ferramenta de trabalho (fora do
package.json); roda com o Python do sistema e numpy:

    python -P -E tools/art/kart/build_kart.py <GoCart.obj> apps/web/public/models/foxgp

O que faz (sem Blender):
- separa as peças pelo objeto e, no piloto, por região: corpo e pernas, braço e antebraço de cada lado, mãos (presas ao
  aro do volante no jogo), capacete (plano B) e corta a cabeça por um plano acima dos ombros;
- separa o aro do volante (que gira) da coluna (que fica) e acha o eixo do aro;
- recentraliza o pivô de cada roda;
- duplica os materiais compartilhados por peça (Rims_wheel, Tires_wheel, Rims_steer...) para a garagem pintar cada um;
- simplifica por agrupamento de vértices numa grade (mãos e corpo são os mais pesados);
- grava `kart.glb` (completo) e `kart-lod.glb` (para longe, sem peças pequenas), sem texturas, com a frente em −Z (o
  sentido dos carros do jogo) e em metros (o jogo escala para a caixa de colisão);
- grava `kart-rig.json` com os pontos do rig (ombros, cotovelos, punhos, eixo do aro, centros das rodas e pedais).
"""
import json
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from obj import load_obj  # noqa: E402

NECK_Y = 0.80  # plano do pescoço: acima disto, no fundo do kart, é cabeça
HEAD_Z = -0.12
ELBOW_Z = -0.15  # o cotovelo: o braço vai do ombro até aqui e o antebraço daqui ao punho


def tri_ids(V, faces):
    ids = np.array([[f[1][0], f[2][0], f[3][0]] for f in faces], dtype=np.int64)
    return np.where(ids > 0, ids - 1, len(V) + ids)


def cluster(P, T, cell):
    """Simplifica juntando os vértices de cada célula da grade (média) e tirando os triângulos que somem."""
    if cell <= 0 or len(T) == 0:
        return P, T
    key = np.floor(P / cell).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    n = inv.max() + 1
    acc = np.zeros((n, 3))
    np.add.at(acc, inv, P)
    cnt = np.bincount(inv, minlength=n)[:, None]
    P2 = acc / np.maximum(cnt, 1)
    T2 = inv[T]
    ok = (T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2])
    T2 = T2[ok]
    # triângulos repetidos (mesmos 3 vértices) saem
    s = np.sort(T2, axis=1)
    _, keep = np.unique(s, axis=0, return_index=True)
    T2 = T2[np.sort(keep)]
    used = np.unique(T2)
    remap = -np.ones(n, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return P2[used], remap[T2]


def weld(V, ids):
    """Triângulos (índices no OBJ) → vértices próprios e índices locais."""
    used, inv = np.unique(ids.reshape(-1), return_inverse=True)
    return V[used].copy(), inv.reshape(-1, 3)


def normals(P, T):
    n = np.zeros_like(P)
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    for k in range(3):
        np.add.at(n, T[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(ln, 1e-12)


class Part:
    def __init__(self, name, pivot=(0.0, 0.0, 0.0)):
        self.name = name
        self.pivot = np.array(pivot, dtype=np.float64)
        self.prims = []  # (material, P, T)

    def add(self, mat, P, T):
        if len(T):
            self.prims.append((mat, P, T))

    def tris(self):
        return sum(len(t) for _, _, t in self.prims)


def build(obj_path, out_dir):
    V, _, _, objs = load_obj(obj_path)
    # a frente do jogo é −Z: gira 180° em torno de Y (x → −x, z → −z)
    V = V * np.array([-1.0, 1.0, -1.0])
    parts = {}
    rig = {}

    def part(name, pivot=(0.0, 0.0, 0.0)):
        if name not in parts:
            parts[name] = Part(name, pivot)
        return parts[name]

    def add(pname, mat, faces, cell):
        if not faces:
            return
        P, T = weld(V, tri_ids(V, faces))
        P, T = cluster(P, T, cell)
        part(pname).add(mat, P, T)

    # ---- peças fixas do kart (material por peça) ----
    for oname, pname, cell in [('Chassis', 'chassis', 0.016), ('Body', 'body', 0.0), ('Engine', 'engine', 0.014)]:
        by = {}
        for f in objs[oname]:
            m = f[0]
            m = {'Rims': f'Rims_{pname}', 'Tires': f'Tires_{pname}'}.get(m, m)
            by.setdefault(m, []).append(f)
        for m, fs in by.items():
            add(pname, m, fs, cell)

    # ---- rodas: pivô no centro de cada uma ----
    for oname, pname in [('FL_Wheel', 'wheel_fl'), ('FR_Wheel', 'wheel_fr'), ('RL_Wheel', 'wheel_rl'), ('RR_Wheel', 'wheel_rr')]:
        ids = tri_ids(V, objs[oname])
        pts = V[ids.reshape(-1)]
        c = (pts.min(0) + pts.max(0)) / 2
        p = part(pname, c)
        by = {}
        for f in objs[oname]:
            by.setdefault({'Rims': 'Rims_wheel', 'Tires': 'Tires_wheel', 'Body': 'Hub_wheel'}[f[0]], []).append(f)
        for m, fs in by.items():
            P, T = weld(V, tri_ids(V, fs))
            p.add(m, P, T)
        rig[pname] = {'center': c.round(4).tolist(), 'radius': round(float((pts.max(0) - pts.min(0))[1] / 2), 4),
                      'width': round(float((pts.max(0) - pts.min(0))[0]), 4)}

    # ---- pedais ----
    for oname, pname in [('Left_Pedal', 'pedal_l'), ('Right_Pedal', 'pedal_r')]:
        ids = tri_ids(V, objs[oname])
        pts = V[ids.reshape(-1)]
        # pivô embaixo (o pedal gira em torno da base)
        c = np.array([(pts[:, 0].min() + pts[:, 0].max()) / 2, pts[:, 1].min(), (pts[:, 2].min() + pts[:, 2].max()) / 2])
        p = part(pname, c)
        P, T = weld(V, ids)
        p.add('Rims_pedal', P, T)
        rig[pname] = {'pivot': c.round(4).tolist()}

    # ---- volante: aro (gira) e coluna (fica) ----
    sw = objs['Steerwheel']
    ids = tri_ids(V, sw)
    cen = V[ids].mean(1)
    tires = np.array([f[0] == 'Tires' for f in sw])
    ring = V[ids[tires].reshape(-1)]
    rc = ring.mean(0)
    # o eixo do aro: a direção de menor espalhamento dos pontos do anel
    _, _, vt = np.linalg.svd(ring - rc)
    axis = vt[2]
    if axis[2] > 0:
        axis = -axis  # aponta para o piloto (+Z depois do giro é para trás)
    rr = np.linalg.norm((ring - rc) - np.outer((ring - rc) @ axis, axis), axis=1).max()
    on_rim = np.linalg.norm(cen - rc, axis=1) < rr * 1.15
    rim_faces = [f for f, k in zip(sw, on_rim) if k]
    col_faces = [f for f, k in zip(sw, on_rim) if not k]
    p = part('steer_rim', rc)
    for m, mat in [('Tires', 'Tires_grip'), ('Rims', 'Rims_steer')]:
        fs = [f for f in rim_faces if f[0] == m]
        if fs:
            P, T = weld(V, tri_ids(V, fs))
            p.add(mat, P, T)
    add('steer_col', 'Rims_steer', col_faces, 0.0)
    rig['steer'] = {'center': rc.round(4).tolist(), 'axis': axis.round(4).tolist(), 'radius': round(float(rr), 4)}

    # ---- piloto: por região ----
    dv = objs['drivers']
    ids = tri_ids(V, dv)
    c = V[ids].mean(1)
    mats = np.array([f[0] for f in dv])
    # depois do giro: o piloto senta em +Z (atrás), o volante fica em −Z
    zf = -c[:, 2]  # profundidade no sentido do arquivo (frente = +), para usar os cortes medidos no OBJ original
    head = (c[:, 1] > NECK_Y) & (zf < HEAD_Z)
    hands = (mats == 'Piel') & (c[:, 1] > 0.33) & (c[:, 1] < 0.67) & (zf > -0.12)
    cuffs = (mats == 'Casco2') & (c[:, 1] > 0.38) & (c[:, 1] < 0.6) & (zf > -0.26) & (zf < 0.02)
    arm = (mats == 'Mono1') & (c[:, 1] > 0.38) & (c[:, 1] < 0.74) & (np.abs(c[:, 0]) > 0.125) & (zf > -0.36) & (zf < 0.05)
    helmet = head & np.isin(mats, ['Casco', 'Casco2', 'Visera'])
    torso = ~(head | hands | cuffs | arm)

    def faces_of(mask):
        return [f for f, k in zip(dv, mask) if k]

    for side, sgn in [('l', 1), ('r', -1)]:
        # depois do giro, a esquerda do piloto é −x (ele olha para −Z)
        sel = (np.sign(-c[:, 0]) == sgn)
        hand_f = faces_of((hands | cuffs) & sel)
        hids = tri_ids(V, hand_f)
        hp = V[hids.reshape(-1)]
        # o punho: a ponta das mãos mais perto do corpo (maior z depois do giro)
        wrist = hp[hp[:, 2] > np.percentile(hp[:, 2], 85)].mean(0)
        grip = hp.mean(0)
        hpart = part(f'hand_{side}', wrist)
        for m in ['Piel', 'Casco2']:
            fs = [f for f in hand_f if f[0] == m]
            if fs:
                P, T = weld(V, tri_ids(V, fs))
                P, T = cluster(P, T, 0.02)
                hpart.add('Glove' if m == 'Piel' else 'Cuff', P, T)
        arm_f = faces_of(arm & sel)
        aids = tri_ids(V, arm_f)
        ac = V[aids].mean(1)
        upper = [f for f, k in zip(arm_f, -ac[:, 2] < ELBOW_Z) if k]
        fore = [f for f, k in zip(arm_f, -ac[:, 2] < ELBOW_Z) if not k]
        up_pts = V[tri_ids(V, upper).reshape(-1)]
        fo_pts = V[tri_ids(V, fore).reshape(-1)]
        shoulder = up_pts[up_pts[:, 2] > np.percentile(up_pts[:, 2], 90)].mean(0)
        shoulder[0] = np.sign(shoulder[0]) * (abs(shoulder[0]) - 0.03)
        elbow = np.concatenate([up_pts[up_pts[:, 2] < np.percentile(up_pts[:, 2], 12)],
                                fo_pts[fo_pts[:, 2] > np.percentile(fo_pts[:, 2], 88)]]).mean(0)
        P, T = weld(V, tri_ids(V, upper))
        P, T = cluster(P, T, 0.026)
        part(f'arm_{side}', shoulder).add('Mono1', P, T)
        P, T = weld(V, tri_ids(V, fore))
        P, T = cluster(P, T, 0.026)
        part(f'forearm_{side}', elbow).add('Mono1', P, T)
        rig[f'arm_{side}'] = {'shoulder': shoulder.round(4).tolist(), 'elbow': elbow.round(4).tolist(),
                              'wrist': wrist.round(4).tolist(), 'grip': grip.round(4).tolist()}

    for m, cell in [('Mono1', 0.034), ('Mono2', 0.02), ('Piel', 0.02), ('Casco2', 0.02), ('Visera', 0.015), ('Casco', 0.015)]:
        fs = [f for f in faces_of(torso) if f[0] == m]
        add('driver', {'Piel': 'Neck'}.get(m, m), fs, cell)
    # o capacete fica como plano B (com aberturas para as orelhas feitas no jogo, ou só a calota)
    for m in ['Casco', 'Casco2', 'Visera']:
        fs = [f for f in faces_of(helmet) if f[0] == m]
        add('helmet', m, fs, 0.012)
    neck = V[tri_ids(V, faces_of(head & (mats == 'Piel'))).reshape(-1)]
    hp = V[tri_ids(V, faces_of(head)).reshape(-1)]
    rig['head'] = {'neck': [0.0, NECK_Y, float(neck[:, 2].mean()) if len(neck) else float(hp[:, 2].mean())],
                   'top': float(hp[:, 1].max()), 'center': hp.mean(0).round(4).tolist()}
    lo = np.min([np.min(P, 0) for pp in parts.values() for _, P, _ in pp.prims], 0)
    hi = np.max([np.max(P, 0) for pp in parts.values() for _, P, _ in pp.prims], 0)
    rig['bounds'] = {'min': lo.round(4).tolist(), 'max': hi.round(4).tolist()}

    os.makedirs(out_dir, exist_ok=True)
    full = list(parts.values())
    write_glb(os.path.join(out_dir, 'kart.glb'), full)
    # para longe: sem pedais, mãos/braços mais simples, rodas inteiras
    lod = []
    for p in full:
        if p.name.startswith('pedal') or p.name in ('helmet',):
            continue
        q = Part(p.name, p.pivot)
        cell = 0.035 if p.name in ('driver',) or p.name.startswith(('arm', 'forearm', 'hand')) else 0.03
        for m, P, T in p.prims:
            P2, T2 = cluster(P, T, cell)
            q.add(m, P2, T2)
        lod.append(q)
    write_glb(os.path.join(out_dir, 'kart-lod.glb'), lod)
    with open(os.path.join(out_dir, 'kart-rig.json'), 'w', encoding='utf-8') as f:
        json.dump(rig, f, indent=1)
    for name, pp in [('kart', full), ('kart-lod', lod)]:
        print(name, sum(p.tris() for p in pp), 'triângulos', {p.name: p.tris() for p in pp})
    print('arquivos:', {n: os.path.getsize(os.path.join(out_dir, n)) for n in ('kart.glb', 'kart-lod.glb', 'kart-rig.json')})


# cor base de cada material (do .mtl original; a garagem troca por código)
BASE = {
    'Body': (0.91, 0.28, 0.28), 'Lines2': (0.77, 0.64, 0.11), 'Chassis': (0.12, 0.12, 0.12), 'Engine': (0.64, 0.64, 0.64),
    'Deposit': (0.87, 0.87, 0.87), 'Mono1': (0.23, 0.25, 0.48), 'Mono2': (0.6, 0.59, 0.18), 'Neck': (0.8, 0.71, 0.64),
    'Glove': (0.8, 0.71, 0.64), 'Cuff': (0.42, 0.42, 0.42), 'Casco': (0.88, 0.88, 0.88), 'Casco2': (0.42, 0.42, 0.42),
    'Visera': (0.16, 0.16, 0.16), 'Hub_wheel': (0.91, 0.28, 0.28),
}


def color_of(m):
    if m in BASE:
        return BASE[m]
    if m.startswith('Rims'):
        return (0.48, 0.48, 0.48)
    if m.startswith('Tires'):
        return (0.18, 0.18, 0.18)
    return (0.6, 0.6, 0.6)


def write_glb(path, parts):
    """glTF 2.0 binário: um nó por peça (posição = pivô), uma malha com uma primitiva por material."""
    bin_ = bytearray()
    views, accs, meshes, nodes = [], [], [], []
    mat_index = {}
    materials = []

    def view(data, target):
        while len(bin_) % 4:
            bin_.append(0)
        off = len(bin_)
        bin_.extend(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
        return len(views) - 1

    for p in parts:
        prims = []
        for m, P, T in p.prims:
            if m not in mat_index:
                mat_index[m] = len(materials)
                r, g, b = color_of(m)
                materials.append({'name': m, 'pbrMetallicRoughness': {'baseColorFactor': [r, g, b, 1.0],
                                                                     'metallicFactor': 0.1 if not m.startswith('Rims') else 0.6,
                                                                     'roughnessFactor': 0.55}})
            Pl = (P - p.pivot).astype(np.float32)
            N = normals(P, T).astype(np.float32)
            big = len(Pl) > 65535
            I = T.astype(np.uint32 if big else np.uint16).reshape(-1)
            vp = view(Pl.tobytes(), 34962)
            accs.append({'bufferView': vp, 'componentType': 5126, 'count': len(Pl), 'type': 'VEC3',
                         'min': Pl.min(0).tolist(), 'max': Pl.max(0).tolist()})
            ap = len(accs) - 1
            vn = view(N.tobytes(), 34962)
            accs.append({'bufferView': vn, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
            an = len(accs) - 1
            vi = view(I.tobytes(), 34963)
            accs.append({'bufferView': vi, 'componentType': 5125 if big else 5123, 'count': len(I), 'type': 'SCALAR'})
            ai = len(accs) - 1
            prims.append({'attributes': {'POSITION': ap, 'NORMAL': an}, 'indices': ai, 'material': mat_index[m]})
        meshes.append({'name': p.name, 'primitives': prims})
        nodes.append({'name': p.name, 'mesh': len(meshes) - 1, 'translation': p.pivot.astype(float).round(5).tolist()})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'nocap tools/art/kart/build_kart.py'},
        'scene': 0,
        'scenes': [{'nodes': list(range(len(nodes)))}],
        'nodes': nodes,
        'meshes': meshes,
        'materials': materials,
        'accessors': accs,
        'bufferViews': views,
        'buffers': [{'byteLength': len(bin_)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    while len(bin_) % 4:
        bin_.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942))
        f.write(bin_)


if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
