import * as THREE from 'three';
import type { AtravessaBiome, SweepKind } from '@nocap/games';
import { bakeChildren, box, mat, model } from './models';

/** Crocodilo, tartarugas, semáforo, varridas de aviso, arcos de marco e partículas (spec 029). */

/** Crocodilo olhando para +X: corpo baixo, cauda e uma cabeça com o maxilar de cima que abre. */
export function buildCroc(len: number, biome: AtravessaBiome): THREE.Group {
  return model(null, () => rawCroc(len, biome));
}

function rawCroc(len: number, biome: AtravessaBiome): THREE.Group {
  const g = new THREE.Group();
  const skin = biome === 'neon' ? 0x2ad49a : biome === 'deserto' ? 0x7a8a3a : 0x3f9a4a;
  const dark = biome === 'neon' ? 0x14916a : biome === 'deserto' ? 0x5a6a2a : 0x2c7436;
  const belly = 0xd8e2a8;
  const headX = len / 2 - 0.6;
  g.add(box(len - 1.2, 0.26, 0.72, skin, -0.6, 0.15, 0));
  g.add(box(len - 1.4, 0.1, 0.5, dark, -0.7, 0.33, 0, { cast: false }));
  for (let i = 0; i < 5; i++) g.add(box(0.16, 0.12, 0.16, dark, -len / 2 + 0.5 + i * 0.5, 0.42, 0, { cast: false }));
  g.add(box(0.7, 0.18, 0.4, skin, -len / 2 + 0.3, 0.12, 0)); // a cauda
  g.add(box(len * 0.5, 0.08, 0.7, belly, -0.4, 0.05, 0, { cast: false }));
  // a cabeça: o maxilar de baixo fica parado, o de cima gira no fundo dele
  g.add(box(1.2, 0.16, 0.6, skin, headX, 0.14, 0));
  const jaw = new THREE.Group();
  jaw.position.set(headX - 0.6, 0.24, 0);
  jaw.add(box(1.2, 0.16, 0.6, skin, 0.6, 0.08, 0));
  for (const z of [-0.25, 0.25]) jaw.add(box(0.14, 0.14, 0.14, 0xffe45a, 0.7, 0.22, z, { cast: false })); // os olhos
  for (let i = 0; i < 4; i++) jaw.add(box(0.07, 0.08, 0.07, 0xffffff, 0.35 + i * 0.22, -0.02, i % 2 ? 0.2 : -0.2, { cast: false }));
  bakeChildren(jaw);
  jaw.userData.keep = true;
  g.add(jaw);
  g.userData.jaw = jaw;
  return g;
}

/** Um grupo de tartarugas (2 ou 3) olhando para +X; `shells` é o que a cena inclina e afunda. */
export function buildTurtles(len: number, biome: AtravessaBiome): THREE.Group {
  return model(null, () => rawTurtles(len, biome));
}

function rawTurtles(len: number, biome: AtravessaBiome): THREE.Group {
  const g = new THREE.Group();
  const shell = biome === 'neon' ? 0x7a5cff : biome === 'deserto' ? 0x9b7a3c : 0x3f8a4a;
  const pattern = biome === 'neon' ? 0x19d3ff : biome === 'deserto' ? 0xc9a85a : 0x6cc76a;
  const n = len > 2 ? 3 : 2;
  const shells: THREE.Group[] = [];
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const t = new THREE.Group();
    t.position.set(-len / 2 + step * (i + 0.5), 0, 0);
    t.add(box(0.78, 0.26, 0.66, shell, 0, 0.2, 0));
    t.add(box(0.5, 0.1, 0.42, pattern, 0, 0.38, 0, { cast: false, emissive: biome === 'neon' ? 0.8 : 0 }));
    t.add(box(0.2, 0.18, 0.22, 0xb6d98a, 0.5, 0.2, 0)); // a cabeça
    for (const z of [-0.36, 0.36]) {
      t.add(box(0.26, 0.08, 0.16, 0xb6d98a, 0.22, 0.1, z, { cast: false }));
      t.add(box(0.26, 0.08, 0.16, 0xb6d98a, -0.22, 0.1, z, { cast: false }));
    }
    bakeChildren(t);
    t.userData.keep = true;
    g.add(t);
    shells.push(t);
  }
  g.userData.shells = shells;
  return g;
}

/** O semáforo: haste, caixa e três lâmpadas. A cena acende uma por vez. */
export function buildTrafficLight(): { group: THREE.Group; lamps: Record<'red' | 'amber' | 'green', THREE.Mesh> } {
  const g = new THREE.Group();
  g.add(box(0.14, 1.5, 0.14, 0x2a2a30, 0, 0.75, 0));
  g.add(box(0.46, 1.04, 0.36, 0x1b1b22, 0, 1.6, 0));
  const lamps = {
    red: box(0.28, 0.26, 0.1, 0x3a1010, 0, 1.92, 0.22, { cast: false }),
    amber: box(0.28, 0.26, 0.1, 0x3a2a08, 0, 1.6, 0.22, { cast: false }),
    green: box(0.28, 0.26, 0.1, 0x0c2a14, 0, 1.28, 0.22, { cast: false }),
  };
  for (const l of Object.values(lamps)) l.userData.keep = true;
  g.add(lamps.red, lamps.amber, lamps.green);
  return { group: model(null, () => g), lamps };
}

export const LAMP_ON: Record<'red' | 'amber' | 'green', number> = { red: 0xff3030, amber: 0xffb020, green: 0x35e06a };
export const LAMP_OFF: Record<'red' | 'amber' | 'green', number> = { red: 0x3a1010, amber: 0x3a2a08, green: 0x0c2a14 };
const lampCache = new Map<string, THREE.Material>();
export const lampMaterial = (c: 'red' | 'amber' | 'green', on: boolean): THREE.Material => {
  const key = `${c}${on}`;
  let m = lampCache.get(key);
  if (!m) {
    m = on ? mat(LAMP_ON[c], 1) : mat(LAMP_OFF[c]);
    lampCache.set(key, m);
  }
  return m;
};

/** O perigo que atravessa a linha. Olha para +X; a cena gira e posiciona. */
export function buildSweepHazard(kind: SweepKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'barril') {
    const body = new THREE.Group();
    body.position.y = 0.5;
    body.add(box(0.9, 0.9, 0.9, 0x9a6a3a, 0, 0, 0));
    body.add(box(0.94, 0.12, 0.94, 0x2a2a30, 0, 0.26, 0, { cast: false }));
    body.add(box(0.94, 0.12, 0.94, 0x2a2a30, 0, -0.26, 0, { cast: false }));
    g.add(body);
    g.userData.spin = body;
  } else if (kind === 'feno') {
    const ball = new THREE.Group();
    ball.position.y = 0.5;
    for (let i = 0; i < 3; i++) {
      const b = box(0.8, 0.8, 0.8, i === 1 ? 0xd9b45a : 0xc79a3c, 0, 0, 0);
      b.rotation.set(i * 0.6, i * 0.8, i * 0.5);
      ball.add(b);
    }
    g.add(ball);
    g.userData.spin = ball;
  } else if (kind === 'redemoinho') {
    const col = new THREE.Group();
    const layers: THREE.Object3D[] = [];
    for (let i = 0; i < 6; i++) {
      const w = 0.5 + i * 0.28;
      const l = box(w, 0.34, w, i % 2 ? 0xe6c88a : 0xd2ac6a, 0, 0.2 + i * 0.34, 0, { cast: false });
      col.add(l);
      layers.push(l);
    }
    g.add(col);
    g.userData.layers = layers;
  } else {
    // laser: um feixe fino e comprido de neon na altura do herói, e o brilho no chão
    g.add(box(0.14, 1.5, 0.14, 0xff2fb3, 0, 0.8, 0, { emissive: 1.2, cast: false }));
    g.add(box(0.3, 0.04, 0.9, 0xff8fd8, 0, 0.04, 0, { emissive: 1, cast: false }));
    g.add(box(0.05, 1.5, 0.05, 0xffffff, 0, 0.8, 0, { emissive: 1, cast: false }));
  }
  return g;
}

/**
 * O aviso na própria linha: listras de perigo que piscam ao longo de toda a pista, setas apontando
 * por onde ele vem e uma placa de "!" na ponta de onde vem. `side` = para onde o perigo anda.
 */
export function buildSweepWarning(side: 1 | -1): { group: THREE.Group; blink: THREE.Mesh[]; sign: THREE.Object3D } {
  const g = new THREE.Group();
  const blink: THREE.Mesh[] = [];
  for (let i = -5; i <= 5; i++) {
    const m = box(0.6, 0.03, 0.8, i % 2 ? 0xffd23f : 0xff3030, i * 1.0, 0.02, 0, { cast: false, emissive: 0.7 });
    g.add(m);
    blink.push(m);
  }
  // setas no chão apontando para onde ele vai
  for (const x of [-4.8, 4.8]) {
    const a = new THREE.Group();
    a.position.set(x, 0.05, 0);
    a.add(box(0.5, 0.03, 0.16, 0xffffff, -0.05 * side, 0, 0, { cast: false, emissive: 0.8 }));
    a.add(box(0.16, 0.03, 0.4, 0xffffff, 0.22 * side, 0, 0, { cast: false, emissive: 0.8 }));
    g.add(a);
  }
  // a placa na ponta de onde ele vem
  const sign = new THREE.Group();
  sign.position.set(-side * 5.8, 0, 0);
  sign.add(box(0.12, 1.2, 0.12, 0x2a2a30, 0, 0.6, 0));
  sign.add(box(0.8, 0.8, 0.12, 0xffd23f, 0, 1.4, 0, { emissive: 0.6 }));
  sign.add(box(0.12, 0.34, 0.14, 0x111111, 0, 1.5, 0.02, { cast: false }));
  sign.add(box(0.12, 0.12, 0.14, 0x111111, 0, 1.2, 0.02, { cast: false }));
  g.add(sign);
  return { group: g, blink, sign };
}

/** Uma placa de texto que sempre olha para a câmera (o número do marco, "SEU RECORDE"). */
export function makeLabel(text: string, fg: string, bg: string): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = bg;
  c.strokeStyle = '#111111';
  c.lineWidth = 8;
  const r = 28;
  c.beginPath();
  c.moveTo(r + 6, 6);
  c.arcTo(506, 6, 506, 122, r);
  c.arcTo(506, 122, 6, 122, r);
  c.arcTo(6, 122, 6, 6, r);
  c.arcTo(6, 6, 506, 6, r);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = fg;
  // o texto sempre cabe: encolhe a fonte até caber na placa
  let px = 64;
  c.font = `900 ${px}px "Archivo", "Arial Black", system-ui, sans-serif`;
  while (c.measureText(text).width > 440 && px > 24) {
    px -= 4;
    c.font = `900 ${px}px "Archivo", "Arial Black", system-ui, sans-serif`;
  }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.6, 0.9, 1);
  return sp;
}

/**
 * Um arco que atravessa a pista: faixa quadriculada no chão, dois postes com bandeirinhas e a placa.
 * `kind`: 'recorde' (dourado) ou 'marco' (azul e branco, discreto).
 */
export function buildGate(kind: 'recorde' | 'marco', label: string, floorTop: number): THREE.Group {
  const g = new THREE.Group();
  const main = kind === 'recorde' ? 0xffc928 : 0x2f5bff;
  const alt = kind === 'recorde' ? 0x111111 : 0xf4f4ef;
  for (let i = -4; i <= 4; i++) {
    g.add(box(1, 0.03, 0.5, (i + 4) % 2 === 0 ? main : alt, i, floorTop + 0.02, -0.25, { cast: false }));
    g.add(box(1, 0.03, 0.5, (i + 4) % 2 === 0 ? alt : main, i, floorTop + 0.02, 0.25, { cast: false }));
  }
  for (const x of [-5.1, 5.1]) {
    g.add(box(0.2, 2.6, 0.2, 0x2a2a30, x, floorTop + 1.3, 0));
    g.add(box(0.5, 0.34, 0.06, main, x + (x < 0 ? 0.3 : -0.3), floorTop + 2.35, 0, { cast: false }));
  }
  const label3d = makeLabel(label, kind === 'recorde' ? '#111111' : '#111111', kind === 'recorde' ? '#ffd23f' : '#f4f4ef');
  label3d.position.set(0, floorTop + 3.1, 0);
  g.add(label3d);
  g.add(box(10.4, 0.16, 0.12, main, 0, floorTop + 2.6, 0, { cast: false }));
  return model(null, () => g);
}

/** Pedacinhos de bloco que voam (poeira, respingo, estilhaço): uma piscina reaproveitada. */
export class Burst {
  readonly group = new THREE.Group();
  private bits: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private age = 99;

  constructor(count = 18) {
    for (let i = 0; i < count; i++) {
      const m = box(0.16, 0.16, 0.16, 0xffffff, 0, 0, 0, { cast: false, receive: false });
      m.visible = false;
      this.group.add(m);
      this.bits.push({ m, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  /** Solta os pedaços em `origin`, com as `colors`, para o lado `dir` (-1, 0 ou 1). */
  fire(origin: THREE.Vector3, colors: number[], dir: number, power = 1) {
    this.age = 0;
    this.bits.forEach((b, i) => {
      b.m.material = mat(colors[i % colors.length]!);
      b.m.position.copy(origin);
      b.m.scale.setScalar(0.6 + ((i * 37) % 10) / 12);
      b.v.set(dir * (1 + (i % 5) * 0.7) * power + ((i % 3) - 1) * 0.8, (2.4 + (i % 4) * 1.1) * power, ((i % 7) - 3) * 0.4);
      b.spin.set(((i * 13) % 7) - 3, ((i * 17) % 5) - 2, ((i * 11) % 9) - 4);
      b.life = 0.7 + ((i * 29) % 10) / 20;
      b.m.visible = true;
      b.m.rotation.set(0, 0, 0);
    });
  }

  update(dt: number) {
    this.age += dt;
    for (const b of this.bits) {
      if (!b.m.visible) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.m.visible = false;
        continue;
      }
      b.v.y -= 9.5 * dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += b.spin.x * dt;
      b.m.rotation.y += b.spin.y * dt;
      b.m.rotation.z += b.spin.z * dt;
      b.m.scale.multiplyScalar(1 - 0.5 * dt);
    }
  }
}
