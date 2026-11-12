import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GP_CAR_LEN, GP_CAR_WID, type GpPaint } from '@nocap/games';
import type { CarModel } from './car-model';
import { buildFoxHead } from './fox-head';

/**
 * O kart do Arcade (spec 081, Fase 6): o modelo do `racing-kart.zip`, adaptado por `tools/art/kart/build_kart.py`
 * (peças com pivô, piloto simplificado e sem a cabeça, materiais por peça), carregado só quando o Arcade é usado. A
 * cabeça é a raposa feita em código (`fox-head.ts`); com `helmet`, o capacete do arquivo volta (plano B, opção da
 * garagem). Devolve a mesma interface do F1 (`CarModel`), mais `update` para as animações por código: rodas, volante,
 * mãos presas ao aro, braços por IK de dois ossos, pedais, orelhas e o motor vibrando.
 */

interface KartRig {
  steer: { center: number[]; axis: number[]; radius: number };
  arm_l: { shoulder: number[]; elbow: number[]; wrist: number[] };
  arm_r: { shoulder: number[]; elbow: number[]; wrist: number[] };
  head: { neck: number[]; top: number; center: number[] };
  wheel_fl: { center: number[]; radius: number };
  bounds: { min: number[]; max: number[] };
}

export interface KartState {
  steer: number;
  throttle: number;
  brake: number;
  speed: number;
  boost: number;
}

export interface KartModel extends CarModel {
  kart: true;
  update(dt: number, s: KartState): void;
}

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
let loading: Promise<void> | null = null;
let tpl: { scene: THREE.Group; lod: THREE.Group; rig: KartRig } | null = null;

/** Baixa o kart (uma vez por aparelho). Só o Arcade chama: o Realista nunca baixa o arquivo. */
export function preloadKart(): Promise<void> {
  if (!loading) {
    const loader = new GLTFLoader();
    loading = Promise.all([
      loader.loadAsync(`${base}models/foxgp/kart.glb`),
      loader.loadAsync(`${base}models/foxgp/kart-lod.glb`),
      fetch(`${base}models/foxgp/kart-rig.json`).then((r) => r.json() as Promise<KartRig>),
    ]).then(([g, l, rig]) => {
      tpl = { scene: g.scene, lod: l.scene, rig };
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

export const kartReady = () => tpl !== null;

/**
 * Escala do modelo nas prévias: o kart tem a largura da caixa de colisão (a cena da pista ainda multiplica pela escala de
 * pista, a mesma do F1).
 */
const PREVIEW_PER_TRACK = 3.56 / GP_CAR_LEN;

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export function buildKart(opts: {
  fur: number;
  paint?: GpPaint | null;
  pbr?: boolean;
  /** Plano B: o capacete do arquivo no lugar da cabeça de raposa. */
  helmet?: boolean;
  /** Versão simples para longe (sem pedais nem capacete). */
  lod?: boolean;
}): KartModel {
  if (!tpl) throw new Error('kart ainda não carregado: chame preloadKart()');
  const rig = tpl.rig;
  const src = opts.lod ? tpl.lod : tpl.scene;
  const root = src.clone(true);
  const width = rig.bounds.max[0]! - rig.bounds.min[0]!;
  const scale = (GP_CAR_WID * PREVIEW_PER_TRACK) / width;
  root.scale.setScalar(scale);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(root);

  // ---- materiais por peça (cada carro tem os seus: a pintura muda por código) ----
  const paint = opts.paint;
  const mats: THREE.Material[] = [];
  const colorOf = (name: string, now: THREE.Color) => {
    if (!paint) return now.getHex();
    if (name === 'Body' || name === 'Hub_wheel') return paint.body;
    if (name === 'Lines2') return paint.accent;
    if (name === 'Glove') return paint.body;
    if (name === 'Mono1') return paint.accent;
    return now.getHex();
  };
  const node = (n: string) => root.getObjectByName(n);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const src = m.material as THREE.MeshStandardMaterial;
    const color = new THREE.Color(colorOf(src.name, src.color));
    const mm =
      opts.pbr === false
        ? new THREE.MeshLambertMaterial({ color, name: src.name })
        : new THREE.MeshStandardMaterial({
            color,
            name: src.name,
            roughness: src.name === 'Body' || src.name === 'Lines2' ? 0.35 : src.roughness,
            metalness: src.metalness,
          });
    mats.push(mm);
    m.material = mm;
  });

  // ---- cabeça de raposa ou capacete (plano B) ----
  const helmet = node('helmet');
  if (helmet) helmet.visible = !!opts.helmet;
  const head = buildFoxHead({
    fur: opts.fur,
    collar: paint?.accent ?? 0x2b3a7a,
    pbr: opts.pbr,
  });
  head.group.visible = !opts.helmet;
  head.group.position.copy(v3(rig.head.neck));
  head.group.scale.setScalar(((rig.head.top - rig.head.neck[1]!) / 0.39) * 1.1);
  root.add(head.group);
  mats.push(...head.mats);

  // ---- rodas: pivô de esterço (frente) e giro ----
  const wheels: THREE.Object3D[] = [];
  const wheelsF: THREE.Object3D[] = [];
  for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = node(n);
    if (!w) continue;
    const piv = new THREE.Group();
    piv.position.copy(w.position);
    root.add(piv);
    w.position.set(0, 0, 0);
    piv.add(w);
    wheels.push(w);
    if (n.endsWith('fl') || n.endsWith('fr')) wheelsF.push(piv);
  }

  // ---- volante: o aro gira em torno do próprio eixo; as mãos vão junto com ele ----
  const rim = node('steer_rim');
  const rimAxis = v3(rig.steer.axis).normalize();
  const hands = ['hand_l', 'hand_r'].map((n) => node(n));
  for (const h of hands) if (h && rim) rim.attach(h);
  const arms = (['l', 'r'] as const).map((sd) => {
    const r = rig[`arm_${sd}`];
    const S = v3(r.shoulder);
    const E0 = v3(r.elbow);
    const W0 = v3(r.wrist);
    return {
      arm: node(`arm_${sd}`),
      fore: node(`forearm_${sd}`),
      hand: node(`hand_${sd}`),
      S,
      E0,
      W0,
      L1: E0.distanceTo(S),
      L2: W0.distanceTo(E0),
      restUp: E0.clone().sub(S).normalize(),
      restFore: W0.clone().sub(E0).normalize(),
    };
  });
  const pedals = ['pedal_l', 'pedal_r'].map((n) => node(n));
  const engine = node('engine');
  const engineY = engine?.position.y ?? 0;
  const tmpT = new THREE.Vector3();
  const tmpU = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpE = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  let steerShown = 0;
  let t = 0;

  /** IK de dois ossos: o cotovelo no plano que tem o cotovelo de antes; ombro fixo e mão presa ao aro. */
  const solveArm = (a: (typeof arms)[number]) => {
    if (!a.arm || !a.fore || !a.hand) return;
    root.updateMatrixWorld(true);
    a.hand.getWorldPosition(tmpT);
    root.worldToLocal(tmpT);
    tmpU.copy(tmpT).sub(a.S);
    const d = THREE.MathUtils.clamp(tmpU.length(), Math.abs(a.L1 - a.L2) + 1e-4, a.L1 + a.L2 - 1e-4);
    tmpU.normalize();
    tmpV.copy(a.E0).sub(a.S);
    tmpV.addScaledVector(tmpU, -tmpV.dot(tmpU)).normalize();
    const along = (a.L1 * a.L1 - a.L2 * a.L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a.L1 * a.L1 - along * along));
    tmpE.copy(a.S).addScaledVector(tmpU, along).addScaledVector(tmpV, h);
    tmpQ.setFromUnitVectors(a.restUp, tmpV.copy(tmpE).sub(a.S).normalize());
    a.arm.quaternion.copy(tmpQ);
    a.fore.position.copy(tmpE);
    a.fore.quaternion.setFromUnitVectors(a.restFore, tmpV.copy(tmpT).sub(tmpE).normalize());
  };

  const radius = rig.wheel_fl.radius * scale;
  return {
    kart: true,
    group,
    body,
    wheelsF,
    wheels,
    wheelR: radius,
    flap: new THREE.Object3D(),
    tail: new THREE.Group(),
    fox: head.group,
    mats,
    update(dt, s) {
      t += dt;
      // o volante segue o do jogador (±100°), suave
      steerShown += (s.steer - steerShown) * Math.min(1, dt * 14);
      if (rim) rim.quaternion.setFromAxisAngle(rimAxis, -steerShown * THREE.MathUtils.degToRad(100));
      for (const a of arms) solveArm(a);
      // pedais: acelerador (direita) e freio (esquerda)
      if (pedals[1]) pedals[1].rotation.x = s.throttle * 0.45;
      if (pedals[0]) pedals[0].rotation.x = s.brake * 0.45;
      // cabeça inclina para dentro da curva; orelhas balançam com a velocidade e o turbo
      head.group.rotation.z = steerShown * 0.18;
      head.group.rotation.y = -steerShown * 0.25;
      const flap = Math.min(1, Math.abs(s.speed) / 28) * (0.12 + s.boost * 0.06);
      for (const [i, e] of head.ears.entries())
        e.rotation.x = -flap * (1 + Math.sin(t * (14 + s.boost * 6) + i * 1.7) * 0.5);
      // o motor vibra com o giro
      if (engine) engine.position.y = engineY + Math.sin(t * 90) * 0.003 * (0.4 + s.throttle);
    },
    dispose() {
      for (const m of mats) m.dispose();
      head.dispose();
    },
  };
}
