import * as THREE from 'three';

/** Um pose da faca: posição e giro da faca (e da mão que a segura) mais a mão esquerda, no espaço da câmera da arma. */
export interface KnifeKey {
  /** Chega a este quadro rápido e desacelera (golpes): sem isso a faca "acordava" devagar. */
  e?: 'out';
  t: number;
  p: [number, number, number];
  r: [number, number, number];
  l: [number, number, number];
}

const HOLD: KnifeKey = { t: 0, p: [0.12, -0.16, -0.38], r: [0.6, 0.2, 0], l: [-0.12, -0.14, -0.36] };
const k = (t: number, p: KnifeKey['p'], r: KnifeKey['r'], l: KnifeKey['l'] = HOLD.l, e?: 'out'): KnifeKey => ({ t, p, r, l, e });

/**
 * Corte (0,3 s): sai NA HORA (o primeiro quadro já é o armar rápido, 0,03 s), cruza a tela de cima-direita para baixo-esquerda no
 * meio da animação (o dano é no instante do clique) e termina com um embalo antes de voltar. Alterna com o corte espelhado.
 */
export const KNIFE_SLASH: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.1, [0.24, -0.06, -0.32], [0.2, -0.55, -0.9], [-0.14, -0.16, -0.34], 'out'),
  k(0.4, [0.0, -0.2, -0.5], [0.55, 0.15, -0.1], [-0.16, -0.18, -0.34], 'out'),
  k(0.58, [-0.24, -0.28, -0.42], [0.75, 1.05, 0.65], [-0.2, -0.2, -0.3], 'out'),
  k(0.72, [-0.2, -0.26, -0.4], [0.7, 0.95, 0.55], [-0.18, -0.19, -0.32]),
  k(1, HOLD.p, HOLD.r),
];
const mirror = (key: KnifeKey): KnifeKey => ({
  ...key,
  p: [-key.p[0] + HOLD.p[0] * 2 * (key.t === 0 || key.t === 1 ? 1 : 0), key.p[1], key.p[2]],
  r: [key.r[0], -key.r[1], -key.r[2]],
  l: key.l,
});
/** Corte espelhado (da esquerda para a direita), para o segundo golpe seguido não ser igual ao primeiro. */
export const KNIFE_SLASH_B: KnifeKey[] = KNIFE_SLASH.map((kf, i) => (i === 0 || i === KNIFE_SLASH.length - 1 ? kf : mirror(kf)));
/** Estocada (0,45 s): puxa um palmo e empurra rápido; o dano é no instante do clique. */
export const KNIFE_STAB: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.1, [0.2, -0.2, -0.22], [0.2, 0.1, 0], HOLD.l, 'out'),
  k(0.24, [0.08, -0.15, -0.74], [0.0, 0.05, 0], [-0.1, -0.14, -0.5], 'out'),
  k(0.5, [0.08, -0.15, -0.7], [0.0, 0.05, 0], [-0.1, -0.14, -0.48]),
  k(1, HOLD.p, HOLD.r),
];
/** Facada nas costas: levanta a faca bem alto e crava de cima para baixo, segura um instante torcendo e volta (0,9 s). */
export const KNIFE_BACKSTAB: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.2, [0.14, 0.02, -0.26], [1.35, 0.1, 0.1], [-0.1, -0.12, -0.34]),
  k(0.38, [0.06, -0.2, -0.62], [-0.85, 0.05, 0], [-0.06, -0.14, -0.5]),
  k(0.5, [0.06, -0.22, -0.64], [-0.85, 0.05, 0.5], [-0.06, -0.15, -0.52]),
  k(0.68, [0.06, -0.22, -0.64], [-0.85, 0.05, -0.4], [-0.06, -0.15, -0.52]),
  k(1, HOLD.p, HOLD.r),
];
const TAU = Math.PI * 2;
/**
 * Inspeção da faca (F, 4 s), ao estilo dos jogos de tiro táticos: sai NA HORA (primeiro quadro já em movimento), levanta a faca
 * e mostra a lâmina, gira ao redor do próprio eixo, joga de ponta a ponta sobre os dedos, a outra mão toca a lâmina, mostra o outro
 * lado, gira de novo no dedo e assenta. As voltas completas (múltiplos de 2π) acabam na mesma pose da mão, então não há salto ao terminar.
 */
export const KNIFE_INSPECT: KnifeKey[] = [
  { ...HOLD, t: 0 },
  k(0.05, [0.05, -0.11, -0.31], [0.95, -0.3, 0.2], [-0.13, -0.17, -0.34], 'out'),
  k(0.13, [0.0, -0.1, -0.28], [0.45, -1.15, 0.45], [-0.1, -0.14, -0.3], 'out'),
  k(0.22, [0.0, -0.1, -0.28], [0.45, -1.15, 0.45 + TAU], [-0.14, -0.17, -0.33], 'out'),
  k(0.32, [0.02, -0.07, -0.3], [0.45 + TAU, -0.7, 0.45 + TAU], [-0.16, -0.18, -0.35], 'out'),
  k(0.42, [0.03, -0.1, -0.29], [0.7 + TAU, 0.85, -0.5 + TAU], [-0.12, -0.15, -0.3], 'out'),
  k(0.52, [0.01, -0.1, -0.28], [0.7 + TAU, 0.95, -0.5 + TAU], [-0.03, -0.14, -0.26], 'out'),
  k(0.6, [0.01, -0.1, -0.28], [0.7 + TAU, 0.95, -0.5 + TAU], [-0.02, -0.15, -0.27]),
  k(0.7, [0.04, -0.09, -0.3], [0.7 + TAU, 0.2, -0.5 + TAU * 2], [-0.14, -0.17, -0.34], 'out'),
  k(0.82, [0.1, -0.13, -0.34], [0.62 + TAU, 0.2, TAU * 2 + 0.05], [-0.14, -0.18, -0.36], 'out'),
  k(1, HOLD.p, [HOLD.r[0] + TAU, HOLD.r[1], TAU * 2 + HOLD.r[2]]),
];

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Pose da faca no instante `u` (0 a 1) de uma lista de quadros. */
export function sampleKnife(keys: KnifeKey[], u: number): KnifeKey {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1]!.t) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const x = Math.min(1, Math.max(0, (u - a.t) / Math.max(1e-6, b.t - a.t)));
  const f = b.e === 'out' ? 1 - (1 - x) * (1 - x) * (1 - x) : smooth(x);
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

  /** Pistolas se seguram com uma mão só: a esquerda fica escondida (aparece só na recarga). */
  setLeftVisible(v: boolean) {
    this.l.group.visible = v;
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
