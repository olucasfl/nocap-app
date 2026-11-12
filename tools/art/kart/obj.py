"""Leitor de OBJ (spec 081, Fase 6): objetos, materiais por face, posições, normais e UVs. Só ferramenta de trabalho."""
import numpy as np


def load_obj(path):
    V, VT, VN = [], [], []
    objects = {}
    cur = None
    mat = None
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            if not line or line[0] == '#':
                continue
            p = line.split()
            if not p:
                continue
            t = p[0]
            if t == 'v':
                V.append([float(p[1]), float(p[2]), float(p[3])])
            elif t == 'vt':
                VT.append([float(p[1]), float(p[2])])
            elif t == 'vn':
                VN.append([float(p[1]), float(p[2]), float(p[3])])
            elif t in ('o', 'g'):
                cur = p[1] if len(p) > 1 else 'default'
                objects.setdefault(cur, [])
            elif t == 'usemtl':
                mat = p[1]
            elif t == 'f':
                idx = []
                for q in p[1:]:
                    a = q.split('/')
                    vi = int(a[0])
                    ti = int(a[1]) if len(a) > 1 and a[1] else 0
                    ni = int(a[2]) if len(a) > 2 and a[2] else 0
                    idx.append((vi, ti, ni))
                if cur is None:
                    cur = 'default'
                    objects.setdefault(cur, [])
                for k in range(1, len(idx) - 1):
                    objects[cur].append((mat, idx[0], idx[k], idx[k + 1]))
    V = np.array(V, dtype=np.float64)
    VT = np.array(VT, dtype=np.float64) if VT else np.zeros((1, 2))
    VN = np.array(VN, dtype=np.float64) if VN else np.zeros((1, 3))
    return V, VT, VN, objects


def tris_of(V, faces):
    """Triângulos de uma lista de faces: posições (n, 3, 3)."""
    ids = np.array([[f[1][0], f[2][0], f[3][0]] for f in faces], dtype=np.int64)
    ids = np.where(ids > 0, ids - 1, len(V) + ids)
    return V[ids]
