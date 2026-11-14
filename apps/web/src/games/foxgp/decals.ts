import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

/**
 * Adesivo colado no casco (14/11/2026): o DecalGeometry recorta a malha do adesivo do próprio casco, então ele acompanha a
 * curva e nunca fica flutuando. Tudo é calculado no mundo (é onde o DecalGeometry trabalha) e a malha final vai para o espaço
 * do casco atingido, como filha dele (anda e gira junto com o carro).
 *
 * `from`, `dir` e `up` estão no espaço de `frame` (o carro): o raio sai de `from` na direção `dir`; `up` é para onde aponta
 * o topo do texto (projetado na superfície). `size` é o lado do adesivo no espaço do `frame`.
 */
export function stickDecal(opts: {
  frame: THREE.Object3D;
  targets: THREE.Object3D[];
  material: THREE.Material;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  up: THREE.Vector3;
  size: number;
}): boolean {
  const { frame, targets, material, from, dir, up, size } = opts;
  frame.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.set(frame.localToWorld(from.clone()), dir.clone().transformDirection(frame.matrixWorld));
  const h = ray.intersectObjects(targets, false)[0];
  if (!h || !h.face) return false;
  const hull = h.object as THREE.Mesh;
  const rayDir = ray.ray.direction.clone();
  const normal = h.face.normal.clone().transformDirection(hull.matrixWorld).normalize();
  // a malha pode ter as faces para dentro (o casco do F1 é desenhado dos dois lados): o adesivo olha para quem lança o raio,
  // senão ele sai espelhado e de cabeça para baixo
  if (normal.dot(rayDir) > 0) normal.negate();
  const upW = up.clone().transformDirection(frame.matrixWorld);
  const upT = upW.addScaledVector(normal, -upW.dot(normal)).normalize();
  const right = new THREE.Vector3().crossVectors(upT, normal).normalize();
  const k0 = frame.getWorldScale(new THREE.Vector3()).x;
  const half = (size * k0) / 2;
  // o lugar tem que ser liso (os quatro cantos na mesma superfície, quase sem curva) ...
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const o = h.point.clone().addScaledVector(right, a * half).addScaledVector(upT, b * half).addScaledVector(normal, half * 2);
    const r = new THREE.Raycaster(o, normal.clone().negate());
    const c = r.intersectObjects(targets, false)[0];
    if (!c || !c.face) return false;
    const cn = c.face.normal.clone().transformDirection((c.object as THREE.Mesh).matrixWorld).normalize();
    if (Math.abs(cn.dot(normal)) < 0.5) return false;
  }
  // ... e livre: nada do carro (asa, entrada de ar, roda, halo) pode ficar na frente dele
  const blockers: THREE.Object3D[] = [];
  frame.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !targets.includes(o) && o.userData.tag !== 'number' && (o as THREE.Mesh).visible) blockers.push(o);
  });
  const block = new THREE.Raycaster(h.point.clone().addScaledVector(normal, 0.01 * k0), normal, 0, half * 3);
  if (block.intersectObjects(blockers, false).length) return false;
  const orient = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, upT, normal));
  const k = k0;
  const geo = new DecalGeometry(hull, h.point, orient, new THREE.Vector3(size * k, size * k, 0.35 * k));
  if (!geo.attributes.position || geo.attributes.position.count < 3) return false;
  geo.applyMatrix4(new THREE.Matrix4().copy(hull.matrixWorld).invert());
  const mesh = new THREE.Mesh(geo, material);
  mesh.userData.tag = 'number';
  hull.add(mesh);
  return true;
}

/** Material do adesivo: não escreve profundidade e fica um pouco à frente da tinta (sem piscar). */
export function decalMaterial(map: THREE.Texture, pbr: boolean): THREE.Material {
  const common = { map, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  return pbr ? new THREE.MeshStandardMaterial({ ...common, roughness: 0.55 }) : new THREE.MeshLambertMaterial(common);
}
