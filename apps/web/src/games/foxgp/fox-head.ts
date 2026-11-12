import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Cabeça de raposa arredondada (spec 081, Fases 6.2 e 7.3), feita em código para o kart e o F1: crânio e focinho em
 * esferas deformadas, bochechas brancas, nariz e olhos com brilho, orelhas triangulares de contorno suave com o lado de
 * dentro claro. Sem cauda. Olha para −Z (a frente dos carros do jogo); a origem é a base do pescoço; altura ~0,32.
 * Com `helmet`, um capacete aberto que envolve o crânio com aberturas para as orelhas (o rosto fica à mostra).
 */
export interface FoxHead {
  group: THREE.Group;
  /** As orelhas (balançam com a velocidade e o turbo). */
  ears: THREE.Object3D[];
  mats: THREE.Material[];
  dispose(): void;
}

const ell = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, seg = 18) =>
  new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)).scale(sx, sy, sz).translate(x, y, z);

/** Orelha: um triângulo arredondado com volume (cone achatado), apontando para cima. */
function earGeo(r: number, h: number) {
  const g = new THREE.ConeGeometry(r, h, 14, 1);
  g.scale(1, 1, 0.42);
  g.translate(0, h / 2, 0);
  return g;
}

let geoCache: {
  fur: THREE.BufferGeometry;
  white: THREE.BufferGeometry;
  dark: THREE.BufferGeometry;
  shine: THREE.BufferGeometry;
  ear: THREE.BufferGeometry;
  earIn: THREE.BufferGeometry;
  helmet: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
} | null = null;

function geos() {
  if (geoCache) return geoCache;
  const hy = 0.17;
  geoCache = {
    // pescoço fino, crânio redondo e focinho afinado para a frente (−Z)
    fur: mergeGeometries([
      new THREE.CylinderGeometry(0.055, 0.07, 0.1, 14).translate(0, 0.04, 0),
      ell(0.125, 0, hy, 0, 1, 0.95, 1.05),
      ell(0.07, 0, hy - 0.03, -0.12, 0.85, 0.7, 1.35),
    ])!,
    white: mergeGeometries([
      ell(0.06, -0.07, hy - 0.05, -0.07, 1, 0.85, 1),
      ell(0.06, 0.07, hy - 0.05, -0.07, 1, 0.85, 1),
      ell(0.045, 0, hy - 0.065, -0.17, 1.05, 0.6, 1.3),
    ])!,
    dark: mergeGeometries([
      ell(0.022, 0, hy - 0.02, -0.225, 1.1, 0.9, 0.9, 12),
      ell(0.019, -0.05, hy + 0.03, -0.1, 1, 1.15, 0.7, 12),
      ell(0.019, 0.05, hy + 0.03, -0.1, 1, 1.15, 0.7, 12),
    ])!,
    shine: mergeGeometries([
      ell(0.006, -0.044, hy + 0.04, -0.115, 1, 1, 1, 8),
      ell(0.006, 0.056, hy + 0.04, -0.115, 1, 1, 1, 8),
    ])!,
    ear: earGeo(0.055, 0.13),
    earIn: earGeo(0.032, 0.085).translate(0, 0.008, -0.012),
    // capacete aberto: a calota de trás e de cima, com a frente livre e as laterais abertas para as orelhas
    helmet: new THREE.SphereGeometry(0.142, 22, 14, Math.PI * 0.72, Math.PI * 1.56, 0, Math.PI * 0.56).translate(
      0,
      hy + 0.005,
      0.01,
    ),
    neck: new THREE.CylinderGeometry(0.075, 0.085, 0.05, 16).translate(0, 0.005, 0),
  };
  return geoCache;
}

export function buildFoxHead(opts: { fur: number; helmet?: number | null; collar?: number; pbr?: boolean }): FoxHead {
  const G = geos();
  const mats: THREE.Material[] = [];
  const mat = (color: number, rough: number, metal = 0) => {
    const m = opts.pbr === false
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    mats.push(m);
    return m;
  };
  const fur = mat(opts.fur, 0.9);
  const white = mat(0xfff3e2, 0.85);
  const dark = mat(0x15100c, 0.35);
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mats.push(shine);
  const group = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = true;
    parent.add(x);
    return x;
  };
  add(G.fur, fur);
  add(G.white, white);
  add(G.dark, dark);
  add(G.shine, shine);
  // gola do macacão: esconde a emenda do pescoço
  add(G.neck, mat(opts.collar ?? 0x2b3a7a, 0.7));
  const ears: THREE.Object3D[] = [];
  for (const sg of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sg * 0.075, 0.26, 0.015);
    piv.rotation.z = -sg * 0.32;
    add(G.ear, fur, piv);
    add(G.earIn, white, piv);
    group.add(piv);
    ears.push(piv);
  }
  if (opts.helmet != null) add(G.helmet, mat(opts.helmet, 0.3, 0.1));
  return {
    group,
    ears,
    mats,
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}
