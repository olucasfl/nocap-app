"""
Leitura da pista do `.usdz` (spec 081, Fase 6B). Só ferramenta de trabalho (`pip install --user usd-core`, fora do
package.json). Devolve as malhas com os pontos no mundo (todas as transformações encadeadas aplicadas) e o caminho de cada
uma, para separar por grupo (`surfaces_asphalt`, `medium_tyres_rubber`...).
"""
import numpy as np
from pxr import Usd, UsdGeom


def load_meshes(path):
    stage = Usd.Stage.Open(path)
    cache = UsdGeom.XformCache()
    out = []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        mesh = UsdGeom.Mesh(prim)
        pts = mesh.GetPointsAttr().Get()
        if pts is None or len(pts) == 0:
            continue
        P = np.array(pts, dtype=np.float64)
        M = np.array(cache.GetLocalToWorldTransform(prim), dtype=np.float64)
        # USD usa vetor-linha: p' = p · M
        W = np.c_[P, np.ones(len(P))] @ M
        W = W[:, :3]
        counts = np.array(mesh.GetFaceVertexCountsAttr().Get() or [], dtype=np.int64)
        idx = np.array(mesh.GetFaceVertexIndicesAttr().Get() or [], dtype=np.int64)
        tris = []
        k = 0
        for c in counts:
            for j in range(1, c - 1):
                tris.append((idx[k], idx[k + j], idx[k + j + 1]))
            k += c
        out.append({'path': str(prim.GetPath()), 'name': prim.GetName(), 'P': W,
                    'T': np.array(tris, dtype=np.int64).reshape(-1, 3)})
    return stage, out


def xform_points(path, names):
    """Posição no mundo de objetos de referência (placas, linha de largada) pelo nome (contém)."""
    stage = Usd.Stage.Open(path)
    cache = UsdGeom.XformCache()
    found = {}
    for prim in stage.Traverse():
        n = prim.GetName()
        for want in names:
            if want in n and prim.IsA(UsdGeom.Xformable):
                M = np.array(cache.GetLocalToWorldTransform(prim), dtype=np.float64)
                found.setdefault(want, []).append((str(prim.GetPath()), M[3, :3].copy()))
    return found
