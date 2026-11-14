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
  const normal = h.face.normal.clone().transformDirection(hull.matrixWorld).normalize();
  const upW = up.clone().transformDirection(frame.matrixWorld);
  const upT = upW.addScaledVector(normal, -upW.dot(normal)).normalize();
  const right = new THREE.Vector3().crossVectors(upT, normal).normalize();
  const orient = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, upT, normal));
  const k = frame.getWorldScale(new THREE.Vector3()).x;
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
