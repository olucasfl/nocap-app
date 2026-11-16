import * as THREE from 'three';

/**
 * Cenário compacto de uma pista de modelo (spec 086): os pacotes `core` (estrada, castelo, morros: para todos) e `detail`
 * (vegetação, adereços e público: só no computador) gerados por `tools/art/track/build-castle.mjs`. Cada pacote é um
 * `.json` (grupos por material) e um `.bin` (posições em float32, normais em int8, uv em float32).
 */
interface Group {
  mat: string;
  tex: string | null;
  alpha?: boolean;
  n: number;
  pos: number;
  nor: number;
  uv: number;
}

async function loadPack(
  base: string,
  name: string,
  textures: THREE.Texture[],
  solids: THREE.Mesh[],
): Promise<THREE.Group> {
  const [meta, bin] = await Promise.all([
    fetch(`${base}${name}.json`).then((r) => r.json() as Promise<{ groups: Group[] }>),
    fetch(`${base}${name}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const out = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();
  for (const g of meta.groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(bin, g.pos, g.n * 3), 3),
    );
    geo.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Int8Array(bin, g.nor, g.n * 3), 3, true),
    );
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, g.uv, g.n * 2), 2));
    let map: THREE.Texture | null = null;
    if (g.tex) {
      map = cache.get(g.tex) ?? null;
      if (!map) {
        map = loader.load(`${base}${g.tex}`);
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = 4;
        cache.set(g.tex, map);
        textures.push(map);
      }
    }
    const mat = new THREE.MeshLambertMaterial({
      map,
      color: map ? 0xffffff : 0x9a9a9a,
      alphaTest: g.alpha ? 0.5 : 0,
      side: g.alpha ? THREE.DoubleSide : THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.name = g.mat;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    // o que a câmera não pode atravessar: tudo menos folhagem (recorte por transparência)
    if (!g.alpha) solids.push(mesh);
    out.add(mesh);
  }
  return out;
}

/** Carrega o cenário da pista (`/foxgp/<id>/`): sempre o `core`; o `detail` só quando `detail` é verdadeiro. */
export async function loadTrackModel(
  id: string,
  detail: boolean,
): Promise<{ group: THREE.Group; textures: THREE.Texture[]; solids: THREE.Mesh[] }> {
  const base = `/foxgp/${id}/`;
  const textures: THREE.Texture[] = [];
  const solids: THREE.Mesh[] = [];
  const group = new THREE.Group();
  group.add(await loadPack(base, 'core', textures, solids));
  if (detail) {
    // o detalhe chega depois e não segura a largada
    void loadPack(base, 'detail', textures, solids)
      .then((g) => group.add(g))
      .catch(() => undefined);
  }
  return { group, textures, solids };
}
