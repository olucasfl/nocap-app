import * as THREE from 'three';
import { GOLF_BALL_RADIUS, type GolfBallLook } from '@nocap/games';
import { ballColorMap, ballNormal } from './textures';

/** A bola pronta (esfera com furinhos em relevo, verniz e o acabamento escolhido), usada no jogo e na prévia. */
export function buildBallMesh(look: GolfBallLook): THREE.Mesh {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: ballColorMap(look.color, look.finish, look.color2),
    roughness: 0.32,
    metalness: 0.02,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    normalMap: ballNormal(),
    normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(GOLF_BALL_RADIUS, 40, 24), mat);
  m.castShadow = true;
  return m;
}

/** Troca cor e acabamento de uma bola que já existe (libera a textura antiga). */
export function applyBallLook(mesh: THREE.Mesh, look: GolfBallLook) {
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  mat.map?.dispose();
  mat.map = ballColorMap(look.color, look.finish, look.color2);
  mat.needsUpdate = true;
}
