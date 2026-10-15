import * as THREE from 'three';
import type { AtravessaBiome, SweepKind } from '@nocap/games';
import { ATR_HALF_COLS } from '@nocap/games';
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
  const shell = biome === 'neon' ? 0x6a4cff : biome === 'deserto' ? 0x8a6a34 : 0x2f8a46;
  const rim = biome === 'neon' ? 0x3a2cb0 : biome === 'deserto' ? 0xc9a85a : 0xd9e07a;
  const plate = biome === 'neon' ? 0x19d3ff : biome === 'deserto' ? 0xd9bc72 : 0x7fcf5a;
  const skin = biome === 'neon' ? 0x9ad8c0 : biome === 'deserto' ? 0xb9a46a : 0x9ed36a;
  const skinDark = biome === 'neon' ? 0x6fb59d : biome === 'deserto' ? 0x8a774a : 0x6fae48;
  const glow = biome === 'neon' ? 0.8 : 0;
  const k = { cast: false } as const;
  const n = len > 2 ? 3 : 2;
  const shells: THREE.Group[] = [];
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const t = new THREE.Group();
    t.position.set(-len / 2 + step * (i + 0.5), 0, 0);
    // o casco em camadas: borda clara, base escura, cúpula com placas (o desenho que todo mundo reconhece)
    t.add(box(0.84, 0.07, 0.74, rim, 0, 0.11, 0));
    t.add(box(0.74, 0.13, 0.64, shell, 0, 0.2, 0));
    t.add(box(0.58, 0.1, 0.5, shell, 0, 0.31, 0));
    t.add(box(0.38, 0.08, 0.32, shell, 0, 0.4, 0, k));
    // as placas do casco: uma no meio e quatro em volta, mais claras
    t.add(box(0.22, 0.03, 0.2, plate, 0, 0.45, 0, { cast: false, emissive: glow }));
    for (const dx of [-0.2, 0.2]) {
      for (const dz of [-0.17, 0.17]) t.add(box(0.14, 0.03, 0.12, plate, dx, 0.37, dz, { cast: false, emissive: glow }));
    }
    for (const dz of [-0.31, 0.31]) t.add(box(0.5, 0.03, 0.06, rim, 0, 0.27, dz * 1.02, k));
    // a cabeça redonda na frente, com pescoço, olhos e sorriso
    t.add(box(0.14, 0.14, 0.18, skin, 0.46, 0.17, 0));
    t.add(box(0.26, 0.22, 0.28, skin, 0.6, 0.24, 0));
    t.add(box(0.2, 0.05, 0.22, skinDark, 0.62, 0.11, 0, k));
    for (const dz of [-0.1, 0.1]) {
      t.add(box(0.07, 0.07, 0.06, 0x14100c, 0.66, 0.31, dz, k));
      t.add(box(0.025, 0.025, 0.02, 0xffffff, 0.685, 0.335, dz * 1.1, { cast: false, emissive: 0.6 }));
    }
    t.add(box(0.03, 0.025, 0.12, 0x2a3a1a, 0.74, 0.2, 0, k)); // o sorriso
    // quatro nadadeiras grandes e achatadas, abertas para fora, e um rabinho
    for (const dz of [-1, 1]) {
      t.add(box(0.3, 0.06, 0.2, skin, 0.3, 0.1, dz * 0.42));
      t.add(box(0.26, 0.06, 0.18, skinDark, -0.28, 0.1, dz * 0.4));
    }
    t.add(box(0.14, 0.05, 0.08, skinDark, -0.46, 0.12, 0, k));
    bakeChildren(t);
    t.userData.keep = true;
    g.add(t);
    shells.push(t);
  }
  g.userData.shells = shells;
  return g;
}

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
    // laser: um raio de neon comprido na altura do herói, com um núcleo branco e o brilho no chão
    g.add(box(1.9, 0.16, 0.16, 0xff2fb3, 0, 0.55, 0, { emissive: 1.2, cast: false }));
    g.add(box(1.95, 0.06, 0.06, 0xffffff, 0, 0.55, 0, { emissive: 1, cast: false }));
    g.add(box(2.4, 0.04, 0.5, 0xff8fd8, 0, 0.04, 0, { emissive: 1, cast: false }));
  }
  return g;
}

/**
 * O aviso (spec 029): uma linha fina e limpa que desce pela coluna do herói, um "!" que desliza por
 * ela e para onde o herói está (ou estava), e um anel pulsando nesse lugar. Tudo olhando para a câmera,
 * sem listras nem quadrados.
 */
const warnColor = 0xff4a3d;

/** A linha: uma caixa fina e comprida ao longo de Z, de `len` casas, com o centro na origem. */
export function buildSweepLine(len: number): THREE.Mesh {
  const mat3 = new THREE.MeshBasicMaterial({ color: warnColor, transparent: true, opacity: 0.9, depthWrite: false });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, len), mat3);
  m.renderOrder = 5;
  return m;
}

/** O ponto de exclamação: um círculo vermelho com borda branca, que sempre olha para a câmera. */
export function buildBang(): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#ff3b30';
  c.strokeStyle = '#ffffff';
  c.lineWidth = 9;
  c.beginPath();
  c.arc(64, 64, 52, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.roundRect(55, 26, 18, 48, 8);
  c.fill();
  c.beginPath();
  c.arc(64, 94, 10, 0, Math.PI * 2);
  c.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(1.0, 1.0, 1);
  sp.renderOrder = 10;
  return sp;
}

/** O anel no chão do alvo: um quadrado vazado de linhas finas. */
export function buildTargetRing(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: warnColor, transparent: true, opacity: 0.95, depthWrite: false });
  const geoLong = new THREE.BoxGeometry(1.0, 0.04, 0.07);
  const geoSide = new THREE.BoxGeometry(0.07, 0.04, 1.0);
  for (const z of [-0.5, 0.5]) {
    const a = new THREE.Mesh(geoLong, m);
    a.position.z = z;
    g.add(a);
  }
  for (const x of [-0.5, 0.5]) {
    const a = new THREE.Mesh(geoSide, m);
    a.position.x = x;
    g.add(a);
  }
  g.renderOrder = 5;
  return g;
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
 * `kind`: 'recorde' (dourado), 'marco' (azul e branco, discreto), 'checkpoint' (verde) ou 'chegada'
 * (vermelho e branco) nas salas.
 */
export type GateKind = 'recorde' | 'marco' | 'checkpoint' | 'chegada';
const GATE_COLORS: Record<GateKind, [number, number]> = {
  recorde: [0xffc928, 0x111111],
  marco: [0x2f5bff, 0xf4f4ef],
  checkpoint: [0x33c27f, 0xf4f4ef],
  chegada: [0xe5303a, 0xf4f4ef],
};
export function buildGate(kind: GateKind, label: string, floorTop: number): THREE.Group {
  const g = new THREE.Group();
  const [main, alt] = GATE_COLORS[kind];
  // a faixa quadriculada fica só nas duas bordas da pista: o meio fica livre, e dá para ver a água, a
  // estrada e tudo que passa por baixo (tora, carro, trem)
  for (let i = -ATR_HALF_COLS; i <= ATR_HALF_COLS; i++) {
    g.add(box(1, 0.03, 0.12, (i + ATR_HALF_COLS) % 2 === 0 ? main : alt, i, floorTop + 0.02, -0.44, { cast: false }));
    g.add(box(1, 0.03, 0.12, (i + ATR_HALF_COLS) % 2 === 0 ? alt : main, i, floorTop + 0.02, 0.44, { cast: false }));
  }
  // o checkpoint é minimalista: só a faixa no chão, sem postes, placa nem viga (não tapa a visão)
  if (kind === 'checkpoint') return model(null, () => g);
  for (const x of [-(ATR_HALF_COLS + 1.1), ATR_HALF_COLS + 1.1]) {
    g.add(box(0.2, 2.6, 0.2, 0x2a2a30, x, floorTop + 1.3, 0));
    g.add(box(0.5, 0.34, 0.06, main, x + (x < 0 ? 0.3 : -0.3), floorTop + 2.35, 0, { cast: false }));
  }
  const label3d = makeLabel(label, '#111111', kind === 'recorde' ? '#ffd23f' : kind === 'chegada' ? '#ffb3b8' : '#f4f4ef');
  label3d.position.set(0, floorTop + 3.1, 0);
  g.add(label3d);
  g.add(box(ATR_HALF_COLS * 2 + 2.4, 0.16, 0.12, main, 0, floorTop + 2.6, 0, { cast: false }));
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
