import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GpPaint } from '@nocap/games';
import { bluish } from './format';

/** Pintura padrão: o corpo segue o pelo e o detalhe é o azul do boné. */
export function defaultPaint(fur: number): GpPaint {
  return { body: fur, accent: bluish(fur) ? 0xff7d26 : 0x2f5bff, pattern: 'faixa', number: 7 };
}

export interface CarModel {
  group: THREE.Group;
  /** Corpo (balança nas batidas); a câmera de cockpit esconde ele. */
  body: THREE.Group;
  /** Rodas da frente: viram com o volante (giram em y). */
  wheelsF: THREE.Object3D[];
  /** Todas as rodas: giram com a velocidade (em x). */
  wheels: THREE.Object3D[];
  /** Raio da roda (m), para a rotação seguir a velocidade. */
  wheelR: number;
  /** A asa de trás que abre com o DRS (gira em x). */
  flap: THREE.Object3D;
  tail: THREE.Group;
  fox: THREE.Group;
  /** Materiais do carro (para o fantasma da classificação). */
  mats: THREE.Material[];
  dispose(): void;
}

// ---- construção (spec 080): copiada e adaptada do repositório de referência (MIT, ver THIRD_PARTY_LICENSES.md) ----
// O carro é montado nas medidas da referência (5,4 m, nariz para +Z) e depois reduzido para o tamanho do Fox GP e virado
// para −Z, que é para onde os carros do jogo olham.

/** Seção transversal em superelipse, de uma ponta à outra: [z, meia largura, y de baixo, y de cima]. */
function loft(sec: readonly (readonly [number, number, number, number])[], seg = 20, pw = 2.8) {
  const pos: number[] = [];
  const ind: number[] = [];
  for (const [z, hw, yb, yt] of sec) {
    const yc = (yb + yt) / 2;
    const hh = (yt - yb) / 2;
    for (let j = 0; j < seg; j++) {
      const t = (j / seg) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      pos.push(
        hw * Math.sign(c) * Math.abs(c) ** (2 / pw),
        yc + hh * Math.sign(s) * Math.abs(s) ** (2 / pw),
        z,
      );
    }
  }
  for (let r = 0; r < sec.length - 1; r++)
    for (let j = 0; j < seg; j++) {
      const a = r * seg + j;
      const b = r * seg + ((j + 1) % seg);
      ind.push(a, b, a + seg, b, b + seg, a + seg);
    }
  for (const [r, flip] of [
    [0, true],
    [sec.length - 1, false],
  ] as const) {
    const ci = pos.length / 3;
    const [z, , yb, yt] = sec[r]!;
    pos.push(0, (yb + yt) / 2, z);
    for (let j = 0; j < seg; j++) {
      const a = r * seg + j;
      const b = r * seg + ((j + 1) % seg);
      if (flip) ind.push(ci, b, a);
      else ind.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  return g.translate(x, y, z);
};
function rod(a: readonly number[], b: readonly number[], r = 0.022) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  const l = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, l, 6).translate(0, l / 2, 0);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize()),
  );
  return g.translate(va.x, va.y, va.z);
}
/** Só posição (e normal recalculada): as peças de um mesmo material viram uma malha só. */
const prep = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position') out.deleteAttribute(k);
  out.computeVertexNormals();
  return out;
};
const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map(prep))!;

const FW: readonly [number, number] = [1.75, 0.82];
const RW: readonly [number, number] = [-1.6, 0.8];
const WHEEL_R = 0.36;
/** Escala da referência para o carro do Fox GP (5,4 m para ~3,6 m: o corpo de colisão tem 3,5 m). */
const SCALE = 0.66;
const NOSE_Z = 2.95;
const TAIL_Z = -2.45;

interface Geos {
  paint: THREE.BufferGeometry;
  accent: THREE.BufferGeometry;
  carbon: THREE.BufferGeometry;
  flap: THREE.BufferGeometry;
  light: THREE.BufferGeometry;
  wheelF: THREE.BufferGeometry;
  wheelR: THREE.BufferGeometry;
  foxFur: THREE.BufferGeometry;
  foxWhite: THREE.BufferGeometry;
  foxDark: THREE.BufferGeometry;
  helmet: THREE.BufferGeometry;
  tailFur: THREE.BufferGeometry;
  tailWhite: THREE.BufferGeometry;
}

function wheelGeo(w: number) {
  const tire = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, w, 28, 1).rotateZ(Math.PI / 2);
  const rim: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.25, 0.25, w + 0.012, 20).rotateZ(Math.PI / 2),
  ];
  for (const sg of [1, -1])
    for (let k = 0; k < 5; k++)
      rim.push(
        new THREE.BoxGeometry(0.02, 0.44, 0.045)
          .rotateX((k * Math.PI) / 5)
          .translate(sg * (w / 2 + 0.012), 0, 0),
      );
  const stripe = [1, -1].map((sg) =>
    new THREE.TorusGeometry(WHEEL_R * 0.83, 0.016, 6, 28)
      .rotateY(Math.PI / 2)
      .translate(sg * (w / 2 + 0.004), 0, 0),
  );
  return mergeGeometries(
    [prep(tire), mergeGeometries(rim.map(prep))!, mergeGeometries(stripe.map(prep))!],
    true,
  )!;
}

/** Coordenadas de textura vistas de cima (x de lado a lado, z do nariz à traseira): é onde o desenho e o número vão. */
function topUv(g: THREE.BufferGeometry) {
  const p = g.attributes.position!;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + 1) / 2;
    uv[i * 2 + 1] = (p.getZ(i) - TAIL_Z) / (NOSE_Z - TAIL_Z);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

let cache: Geos | null = null;
/** As formas são as mesmas para todos os carros: montadas uma vez (cada carro só tem os seus materiais). */
function geos(): Geos {
  if (cache) return cache;
  const sphere = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
    new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz).translate(x, y, z);
  const cone = (r: number, h: number, x: number, y: number, z: number, rx: number, rz = 0) =>
    new THREE.ConeGeometry(r, h, 10).rotateX(rx).rotateZ(rz).translate(x, y, z);
  // a raposa sentada sob o halo (a cabeça fica onde a referência põe o capacete), olhando para +Z
  const hx = 0;
  const hy = 0.8;
  const hz = 0.16;
  cache = {
    paint: topUv(
      merge([
        loft([
          [2.95, 0.05, 0.22, 0.3],
          [2.6, 0.12, 0.18, 0.38],
          [1.8, 0.22, 0.14, 0.5],
          [1.0, 0.35, 0.12, 0.62],
          [0.4, 0.42, 0.12, 0.66],
          [-0.1, 0.42, 0.12, 0.72],
          [-0.4, 0.3, 0.12, 0.98],
          [-0.9, 0.3, 0.12, 0.88],
          [-1.6, 0.24, 0.12, 0.66],
          [-2.2, 0.14, 0.14, 0.48],
          [-2.45, 0.04, 0.2, 0.36],
        ]),
        loft([
          [0.55, 0.45, 0.12, 0.3],
          [0.35, 0.84, 0.12, 0.52],
          [-0.3, 0.84, 0.12, 0.55],
          [-1.2, 0.56, 0.12, 0.45],
          [-1.9, 0.25, 0.14, 0.35],
        ]),
        box(0.02, 0.3, 1.1, 0, 0.9, -1.15),
        box(0.035, 0.52, 0.62, 0.52, 0.8, -2.2),
        box(0.035, 0.52, 0.62, -0.52, 0.8, -2.2),
      ]),
    ),
    accent: merge([
      box(0.03, 0.24, 0.6, 0.96, 0.18, 2.6),
      box(0.03, 0.24, 0.6, -0.96, 0.18, 2.6),
      box(1.72, 0.025, 0.24, 0, 0.2, 2.5, -0.35),
      loft(
        [
          [0.32, 0.24, 0.3, 0.52],
          [0.0, 0.84, 0.46, 0.54],
          [-0.6, 0.8, 0.48, 0.55],
          [-1.2, 0.5, 0.42, 0.47],
        ],
        16,
      ),
    ]),
    carbon: merge([
      box(1.5, 0.04, 3.9, 0, 0.08, 0.1),
      box(1.1, 0.22, 0.35, 0, 0.18, -2.2),
      box(1.92, 0.03, 0.44, 0, 0.1, 2.64),
      box(1.04, 0.035, 0.34, 0, 0.9, -2.26),
      box(0.92, 0.03, 0.2, 0, 0.46, -2.32),
      box(0.05, 0.48, 0.12, 0, 0.66, -2.15),
      new THREE.TorusGeometry(0.36, 0.03, 8, 22, Math.PI)
        .rotateX(Math.PI / 2)
        .translate(0, 0.98, 0.16),
      rod([0.36, 0.98, 0.16], [0.36, 0.66, 0.05], 0.03),
      rod([-0.36, 0.98, 0.16], [-0.36, 0.66, 0.05], 0.03),
      rod([0, 0.98, 0.52], [0, 0.6, 0.98], 0.03),
      box(0.16, 0.07, 0.04, 0.58, 0.74, 0.55),
      box(0.16, 0.07, 0.04, -0.58, 0.74, 0.55),
      rod([0.3, 0.6, 0.55], [0.54, 0.73, 0.55], 0.012),
      rod([-0.3, 0.6, 0.55], [-0.54, 0.73, 0.55], 0.012),
      ...[FW, RW].flatMap(([z, x]) =>
        [1, -1].flatMap((sg) => [
          rod([sg * 0.25, 0.46, z + 0.18], [sg * (x - 0.12), 0.44, z]),
          rod([sg * 0.25, 0.46, z - 0.18], [sg * (x - 0.12), 0.44, z]),
          rod([sg * 0.22, 0.22, z + 0.15], [sg * (x - 0.12), 0.26, z]),
          rod([sg * 0.22, 0.22, z - 0.15], [sg * (x - 0.12), 0.26, z]),
        ]),
      ),
    ]),
    flap: prep(box(1.04, 0.03, 0.24, 0, 0, -0.12)),
    light: new THREE.BoxGeometry(0.12, 0.08, 0.03).translate(0, 0.3, -2.47),
    wheelF: wheelGeo(0.36),
    wheelR: wheelGeo(0.42),
    // cabeça redonda, focinho afinado para a frente, bochechas brancas, orelhas com o lado de dentro claro
    foxFur: merge([
      sphere(0.17, hx, hy, hz, 1, 0.95, 1),
      cone(0.085, 0.24, hx, hy - 0.04, hz + 0.24, Math.PI / 2),
      cone(0.07, 0.2, hx - 0.1, hy + 0.2, hz - 0.01, 0, 0.25),
      cone(0.07, 0.2, hx + 0.1, hy + 0.2, hz - 0.01, 0, -0.25),
    ]),
    foxWhite: merge([
      sphere(0.075, hx - 0.09, hy - 0.06, hz + 0.1, 1, 0.8, 1),
      sphere(0.075, hx + 0.09, hy - 0.06, hz + 0.1, 1, 0.8, 1),
      sphere(0.05, hx, hy - 0.08, hz + 0.24, 1.1, 0.7, 1.6),
      cone(0.04, 0.12, hx - 0.1, hy + 0.19, hz + 0.02, 0, 0.25),
      cone(0.04, 0.12, hx + 0.1, hy + 0.19, hz + 0.02, 0, -0.25),
    ]),
    foxDark: merge([
      sphere(0.025, hx, hy - 0.02, hz + 0.36),
      sphere(0.022, hx - 0.065, hy + 0.04, hz + 0.15),
      sphere(0.022, hx + 0.065, hy + 0.04, hz + 0.15),
    ]),
    // capacete aberto: a casca de trás e de cima, com a frente livre (o rosto aparece)
    helmet: prep(
      new THREE.SphereGeometry(
        0.2,
        18,
        12,
        Math.PI * 0.62,
        Math.PI * 1.76,
        0,
        Math.PI * 0.62,
      ).translate(hx, hy + 0.01, hz),
    ),
    // a cauda, só de enfeite, saindo por trás do santo antônio
    tailFur: merge([
      sphere(0.09, 0, 0.98, -0.9, 0.9, 0.9, 1.6),
      sphere(0.11, 0, 1.06, -1.18, 1, 1, 1.4),
    ]),
    tailWhite: merge([sphere(0.085, 0, 1.12, -1.42, 1, 1, 1.2)]),
  };
  return cache;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A pintura vista de cima: a cor da carroceria com o desenho escolhido e o número no bico e na tampa do motor. */
function paintTexture(paint: GpPaint): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  // v = 0 é a traseira e v = 1 o nariz; no canvas y = 0 é o topo: y = (1 − v) · H
  const yOf = (z: number) => (1 - (z - TAIL_Z) / (NOSE_Z - TAIL_Z)) * H;
  const xOf = (x: number) => ((x + 1) / 2) * W;
  if (g) {
    g.fillStyle = hex(paint.body);
    g.fillRect(0, 0, W, H);
    g.fillStyle = hex(paint.accent);
    if (paint.pattern === 'faixa') {
      g.fillRect(xOf(-0.09), 0, xOf(0.09) - xOf(-0.09), H);
    } else if (paint.pattern === 'listras') {
      for (const x of [-0.62, 0.5])
        g.fillRect(xOf(x), yOf(0.5), xOf(x + 0.12) - xOf(x), yOf(-1.8) - yOf(0.5));
      g.fillStyle = '#fff3e2';
      for (const x of [-0.07, 0.04]) g.fillRect(xOf(x), 0, xOf(x + 0.03) - xOf(x), H);
    } else if (paint.pattern === 'chevron') {
      g.lineWidth = 14;
      g.strokeStyle = hex(paint.accent);
      for (const z of [2.5, 1.9, 1.3]) {
        g.beginPath();
        g.moveTo(xOf(-0.45), yOf(z - 0.35));
        g.lineTo(xOf(0), yOf(z));
        g.lineTo(xOf(0.45), yOf(z - 0.35));
        g.stroke();
      }
    }
    // o número: círculo claro com o número na cor do carro
    for (const [z, r] of [
      [1.55, 30],
      [-1.05, 36],
    ] as const) {
      const cx = xOf(0);
      const cy = yOf(z);
      g.save();
      g.translate(cx, cy);
      g.fillStyle = '#fff3e2';
      g.beginPath();
      g.ellipse(0, 0, r * 0.62, r, 0, 0, Math.PI * 2);
      g.fill();
      // vista de cima com o nariz para cima no canvas: o número fica de pé para quem olha de trás
      g.rotate(Math.PI);
      g.scale(0.55, 1);
      g.fillStyle = hex(paint.body);
      g.font = `italic 900 ${Math.round(r * 1.25)}px "Saira Condensed", Inter, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(paint.number), 0, 2);
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * O carro de F1 do Fox GP (spec 080): carroceria em loft de superelipse, asas, halo e suspensão da referência, numa
 * malha por material (pintura com verniz, detalhe, carbono, asa móvel do DRS, luz de trás); rodas com pneu, aro e faixa
 * (as da frente esterçam, todas giram). A pintura da garagem: carroceria = cor e desenho (textura vista de cima, com o
 * número no bico e na tampa do motor); detalhe = asas, entradas de ar e topo das laterais; pelo = a raposa, de capacete
 * aberto na cor do carro. Olha para −Z.
 */
export function buildCar(opts: { fur: number; paint?: GpPaint | null; pbr?: boolean }): CarModel {
  const paint = opts.paint ?? defaultPaint(opts.fur);
  const pbr = opts.pbr ?? true;
  const G = geos();
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const mat = (o: {
    color: number;
    map?: THREE.Texture;
    metal?: number;
    rough?: number;
    clear?: boolean;
    emissive?: number;
  }) => {
    let m: THREE.Material;
    if (!pbr)
      m = new THREE.MeshLambertMaterial({
        color: o.color,
        map: o.map ?? null,
        side: THREE.DoubleSide,
      });
    else if (o.clear)
      m = new THREE.MeshPhysicalMaterial({
        color: o.color,
        map: o.map ?? null,
        metalness: o.metal ?? 0.05,
        roughness: o.rough ?? 0.45,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.7,
        side: THREE.DoubleSide,
      });
    else
      m = new THREE.MeshStandardMaterial({
        color: o.color,
        metalness: o.metal ?? 0,
        roughness: o.rough ?? 0.7,
        emissive: o.emissive ?? 0x000000,
        emissiveIntensity: o.emissive ? 1.5 : 1,
        side: THREE.DoubleSide,
      });
    mats.push(m);
    return m;
  };
  const tex = paintTexture(paint);
  textures.push(tex);
  const body = mat({ color: 0xffffff, map: tex, clear: true });
  const accent = mat({ color: paint.accent, clear: true });
  const carbon = mat({ color: 0x141518, rough: 0.42, metal: 0.35 });
  const tail = mat({ color: 0x400000, emissive: 0xff1010 });
  const tyre = mat({ color: 0x161618, rough: 0.85 });
  const rimM = mat({ color: 0x2c2c30, metal: 0.85, rough: 0.35 });
  const band = mat({ color: 0xffd400, rough: 0.6 });
  const fur = mat({ color: opts.fur, rough: 0.9 });
  const white = mat({ color: 0xfff3e2, rough: 0.8 });
  const dark = mat({ color: 0x15100c, rough: 0.4 });
  const helmetM = mat({ color: paint.body, clear: true, rough: 0.3 });

  const group = new THREE.Group();
  // o carro na escala e no sentido do jogo
  const car = new THREE.Group();
  car.rotation.y = Math.PI;
  car.scale.setScalar(SCALE);
  group.add(car);
  const add = (
    geo: THREE.BufferGeometry,
    m: THREE.Material | THREE.Material[],
    parent: THREE.Object3D = car,
  ) => {
    const x = new THREE.Mesh(geo, m);
    x.castShadow = true;
    x.receiveShadow = true;
    parent.add(x);
    return x;
  };
  add(G.paint, body);
  add(G.accent, accent);
  add(G.carbon, carbon);
  add(G.light, tail);
  const flap = add(G.flap, accent);
  flap.position.set(0, 1.02, -2.1);
  // a raposa e o capacete
  const fox = new THREE.Group();
  add(G.foxFur, fur, fox);
  add(G.foxWhite, white, fox);
  add(G.foxDark, dark, fox);
  add(G.helmet, helmetM, fox);
  car.add(fox);
  const tailG = new THREE.Group();
  // gira em torno da base da cauda (atrás do santo antônio)
  tailG.position.set(0, 0.98, -0.82);
  const tf = add(G.tailFur, fur, tailG);
  const tw = add(G.tailWhite, white, tailG);
  tf.position.set(0, -0.98, 0.82);
  tw.position.set(0, -0.98, 0.82);
  car.add(tailG);
  // rodas: o pivô vira (frente) e a roda gira
  const wheels: THREE.Object3D[] = [];
  const wheelsF: THREE.Object3D[] = [];
  for (const [[z, x], geo, front] of [
    [FW, G.wheelF, true],
    [RW, G.wheelR, false],
  ] as const) {
    for (const sg of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(sg * x, WHEEL_R, z);
      car.add(piv);
      const w = new THREE.Mesh(geo, [tyre, rimM, band]);
      w.castShadow = true;
      piv.add(w);
      wheels.push(w);
      if (front) wheelsF.push(piv);
    }
  }
  return {
    group,
    body: car,
    wheelsF,
    wheels,
    wheelR: WHEEL_R * SCALE,
    flap,
    tail: tailG,
    fox,
    mats,
    dispose() {
      for (const m of mats) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
