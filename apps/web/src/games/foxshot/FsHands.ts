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
    this.upper = cyl(0.032, 0.028);
    this.fore = cyl(0.028, 0.025);
    this.elbow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), SLEEVE);
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
    this.pole.set(0.7 * this.side, -1, 0.35);
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
  private r = new Arm(1, new THREE.Vector3(0.3, -0.5, 0.3));
  private l = new Arm(-1, new THREE.Vector3(-0.3, -0.5, 0.3));

  constructor() {
    this.group.add(this.r.group, this.l.group);
  }

  set(right: THREE.Vector3, rightAim: THREE.Vector3, left: THREE.Vector3, leftAim: THREE.Vector3) {
    this.r.reach(right, rightAim);
    this.l.reach(left, leftAim);
  }
}

/**
 * A faca tática: lâmina preta com ponta, fio de aço brilhante, costas serrilhadas, canal central, guarda com argola para o
 * dedo, cabo emborrachado com ranhuras e argola no fim. Origem na mão, ponta para -Z, fio para baixo.
 */
export function makeKnife(): THREE.Group {
  const g = new THREE.Group();
  const matrix = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0));
  const extrude = (shape: THREE.Shape, depth: number, z0 = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, z0 - depth / 2);
    geo.applyMatrix4(matrix);
    return geo;
  };
  // lâmina: fio reto embaixo (v = -0,014), costas em cima com 5 dentes de serra e ponta curva
  const blade = new THREE.Shape();
  blade.moveTo(0, -0.014);
  blade.lineTo(0.17, -0.014);
  blade.quadraticCurveTo(0.225, -0.012, 0.245, 0.006);
  blade.lineTo(0.2, 0.014);
  for (let i = 0; i < 5; i++) {
    const x1 = 0.185 - i * 0.026;
    blade.lineTo(x1, 0.018);
    blade.lineTo(x1 - 0.013, 0.014);
  }
  blade.lineTo(0, 0.02);
  blade.closePath();
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.55, roughness: 0.42 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.95, roughness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85, metalness: 0.05 });
  const b = new THREE.Mesh(extrude(blade, 0.007), dark);
  b.position.z = -0.02;
  // fio: faixa fina de aço na borda de baixo
  const edge = new THREE.Shape();
  edge.moveTo(0.004, -0.0145);
  edge.lineTo(0.171, -0.0145);
  edge.quadraticCurveTo(0.226, -0.0125, 0.247, 0.0055);
  edge.lineTo(0.238, 0.0075);
  edge.quadraticCurveTo(0.218, -0.0045, 0.168, -0.0075);
  edge.lineTo(0.004, -0.0075);
  edge.closePath();
  const e = new THREE.Mesh(extrude(edge, 0.0078), steel);
  e.position.z = -0.02;
  // canal central (sulco claro ao longo da lâmina)
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.0035, 0.15), steel);
  fuller.position.set(0, 0.0045, -0.11);
  // guarda com argola para o dedo
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.009), dark);
  guard.position.z = -0.018;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 16), steel);
  ring.position.set(0, -0.026, -0.006);
  ring.rotation.y = Math.PI / 2;
  // cabo com ranhuras de borracha
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0185, 0.115, 12), rubber);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.043;
  g.add(b, e, fuller, guard, ring, grip);
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.0182, 0.0016, 6, 14), dark);
    r.position.z = -0.005 + i * 0.019;
    g.add(r);
  }
  // argola no fim do cabo
  const pommel = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 8, 16), steel);
  pommel.position.z = 0.105;
  g.add(pommel);
  g.traverse((o) => {
    o.frustumCulled = false;
  });
  return g;
}
