import * as THREE from 'three';

/** Um pose da faca: posição e giro da faca (e da mão que a segura) mais a mão esquerda, no espaço da câmera da arma. */
export interface KnifeKey {
  t: number;
  p: [number, number, number];
  r: [number, number, number];
  l: [number, number, number];
}

const HOLD: KnifeKey = { t: 0, p: [0.12, -0.16, -0.38], r: [0.6, 0.2, 0], l: [-0.12, -0.14, -0.36] };
const k = (t: number, p: KnifeKey['p'], r: KnifeKey['r'], l: KnifeKey['l'] = HOLD.l): KnifeKey => ({ t, p, r, l });

/** Corte: recua para a direita, varre para a esquerda e volta (0,35 s). */
export const KNIFE_SLASH: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.22, [0.26, -0.08, -0.32], [0.1, -0.5, -1.0]),
  k(0.55, [-0.2, -0.26, -0.42], [0.7, 1.0, 0.6]),
  k(1, HOLD.p, HOLD.r),
];
/** Estocada: puxa a faca para trás e empurra para a frente (0,55 s). */
export const KNIFE_STAB: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.28, [0.2, -0.22, -0.2], [0.15, 0.1, 0]),
  k(0.45, [0.1, -0.14, -0.7], [0.05, 0.05, 0]),
  k(0.62, [0.1, -0.15, -0.66], [0.05, 0.05, 0]),
  k(1, HOLD.p, HOLD.r),
];
/** Inspeção (F, 4,8 s): levanta a faca, gira nos dedos, mostra a lâmina para a câmera e a mão esquerda toca nela. */
export const KNIFE_INSPECT: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.08, [0.06, -0.12, -0.3], [0.95, 0.2, 0]),
  k(0.27, [0.05, -0.12, -0.3], [0.95, 0.2, Math.PI * 2]),
  k(0.4, [0.0, -0.13, -0.28], [0.7, -1.3, Math.PI * 2], [-0.05, -0.16, -0.26]),
  k(0.55, [0.0, -0.13, -0.28], [0.7, -1.3, Math.PI * 2], [-0.02, -0.17, -0.27]),
  k(0.75, [0.05, -0.12, -0.3], [0.95 + Math.PI * 2, 0.2, Math.PI * 2], HOLD.l),
  k(1, HOLD.p, [HOLD.r[0] + Math.PI * 2, HOLD.r[1], Math.PI * 2]),
];

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Pose da faca no instante `u` (0 a 1) de uma lista de quadros. */
export function sampleKnife(keys: KnifeKey[], u: number): KnifeKey {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1]!.t) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const f = smooth(Math.min(1, Math.max(0, (u - a.t) / Math.max(1e-6, b.t - a.t))));
  const mix = (x: number[], y: number[]) => x.map((v, n) => v + (y[n]! - v) * f) as [number, number, number];
  return { t: u, p: mix(a.p, b.p), r: mix(a.r, b.r), l: mix(a.l, b.l) };
}

export const KNIFE_HOLD = HOLD;

const SLEEVE = new THREE.MeshStandardMaterial({ color: 0xe07a1a, roughness: 0.85, metalness: 0 });
const PAW = new THREE.MeshStandardMaterial({ color: 0xf6f0e6, roughness: 0.8, metalness: 0 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8, metalness: 0 });

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

/** Cilindro unitário (altura 1 em Y) esticado entre dois pontos. */
function span(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmp.subVectors(b, a);
  const len = Math.max(1e-4, tmp.length());
  m.position.copy(a).addScaledVector(tmp, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len));
}

class Arm {
  readonly group = new THREE.Group();
  private upper: THREE.Mesh;
  private fore: THREE.Mesh;
  private elbow: THREE.Mesh;
  private paw = new THREE.Group();
  private e = new THREE.Vector3();
  private d = new THREE.Vector3();
  private pole = new THREE.Vector3();

  constructor(
    private side: 1 | -1,
    private shoulder: THREE.Vector3,
    private len = 0.36,
  ) {
    const cyl = (r0: number, r1: number) => {
      const g = new THREE.CylinderGeometry(r1, r0, 1, 12);
      return new THREE.Mesh(g, SLEEVE);
    };
    this.upper = cyl(0.04, 0.035);
    this.fore = cyl(0.035, 0.03);
    this.elbow = new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), SLEEVE);
    // pata: palma redonda, quatro dedos curvos e o polegar (tudo pequeno, para ficar barato)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), PAW);
    palm.scale.set(1, 0.85, 1.15);
    this.paw.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.03, 4, 8), PAW);
      f.rotation.x = Math.PI / 2;
      f.position.set(-0.03 + i * 0.02, -0.018, -0.045);
      this.paw.add(f);
    }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.025, 4, 8), PAW);
    th.position.set(0.045 * side, 0, -0.01);
    th.rotation.z = 0.7 * side;
    this.paw.add(th);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 12), SLEEVE);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0, 0.05);
    this.paw.add(cuff);
    this.paw.scale.setScalar(0.72);
    this.group.add(this.upper, this.fore, this.elbow, this.paw);
    this.group.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  /** Põe a mão em `hand` (a pata aponta para `aim`) e dobra o cotovelo para baixo e para fora (duas juntas de mesmo tamanho). */
  reach(hand: THREE.Vector3, aim: THREE.Vector3) {
    const S = this.shoulder;
    this.d.subVectors(hand, S);
    const dist = Math.min(this.d.length(), this.len * 2 - 0.004);
    this.d.normalize();
    const h = Math.sqrt(Math.max(0, this.len * this.len - (dist / 2) ** 2));
    // cotovelo para baixo e um pouco para fora
    this.pole.set(0.35 * this.side, -1, 0.15);
    this.pole.addScaledVector(this.d, -this.pole.dot(this.d)).normalize();
    this.e.copy(S).addScaledVector(this.d, dist / 2).addScaledVector(this.pole, h);
    const end = S.clone().addScaledVector(this.d, dist);
    span(this.upper, S, this.e);
    span(this.fore, this.e, end);
    this.elbow.position.copy(this.e);
    this.paw.position.copy(end);
    this.paw.lookAt(aim);
    this.paw.position.copy(end);
  }
}

/** As duas patas de raposa na tela: braço laranja com pata branca, cada uma presa a um ombro perto da câmera. */
export class FsHands {
  readonly group = new THREE.Group();
  private r = new Arm(1, new THREE.Vector3(0.26, -0.42, 0.2));
  private l = new Arm(-1, new THREE.Vector3(-0.26, -0.42, 0.2));

  constructor() {
    this.group.add(this.r.group, this.l.group);
  }

  set(right: THREE.Vector3, rightAim: THREE.Vector3, left: THREE.Vector3, leftAim: THREE.Vector3) {
    this.r.reach(right, rightAim);
    this.l.reach(left, leftAim);
  }
}

/** A faca: lâmina de aço com ponta, guarda e cabo escuro; origem na mão, ponta para -Z. */
export function makeKnife(): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.012);
  shape.lineTo(0.17, -0.012);
  shape.lineTo(0.225, 0.004);
  shape.lineTo(0.17, 0.017);
  shape.lineTo(0, 0.017);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false });
  geo.translate(0, 0, -0.003);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
  const steel = new THREE.MeshStandardMaterial({ color: 0xd3d9e0, metalness: 0.9, roughness: 0.28 });
  const blade = new THREE.Mesh(geo, steel);
  blade.position.z = -0.02;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.008), DARK);
  guard.position.z = -0.018;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.11, 10), DARK);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.04;
  g.add(blade, guard, grip);
  g.traverse((o) => {
    o.frustumCulled = false;
  });
  return g;
}
