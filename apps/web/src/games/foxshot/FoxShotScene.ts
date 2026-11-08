import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FsHands, KNIFE_BACKSTAB, KNIFE_HOLD, KNIFE_INSPECT, KNIFE_SLASH, KNIFE_SLASH_B, KNIFE_STAB, makeKnife, sampleKnife, type KnifeKey } from './FsHands';
import {
  FS_ARENA,
  FS_BOTS,
  FS_DUST_BOXES,
  FS_MAP_DUNA,
  type FsMapApi,
  FS_DUST_DECALS,
  FS_DUST_DECOR,
  FS_DUST_HALF,
  FS_DUST_LABELS,
  FS_DUST_MARKS,
  FS_MOVE_SIGNS,
  FS_TRAIN_LABELS,
  FS_TARGETS,
  fsDustFloorY,
  fsDustHeight,
  fsDustRectWorld,
  type FsBotSpec,
  type FsBox,
  type FsGrenadeId,
  type FsTargetSpec,
  type FsWeaponId,
} from '@nocap/games';

/** O mundo que a cena monta: a arena de teste (alvos, bots de treino, placas) ou o mapa Duna (com os bots do mata-mata). */
export interface FsWorld {
  style: 'train' | 'dust' | 'glb';
  /** O mapa (nos mapas de partida): bombas, bases, chão. */
  map?: FsMapApi;
  boxes: readonly FsBox[];
  targets: readonly FsTargetSpec[];
  bots: readonly FsBotSpec[];
  /** Bots do mata-mata: nascem em (x, z) e não mostram nome. */
  dm: readonly { id: string; x: number; z: number }[];
  /** Meio-tamanho do mapa (x, z). */
  half: readonly [number, number];
  /** Nomes das áreas (mapa grande). */
  labels: readonly { x: number; z: number; text: string }[];
  /** Placas no ar (texto). */
  signs: readonly { text: string; x: number; y: number; z: number; big?: boolean }[];
}
export const FS_WORLD_TRAIN: FsWorld = { style: 'train', boxes: FS_ARENA, targets: FS_TARGETS, bots: FS_BOTS, dm: [], half: [45, 27], labels: FS_TRAIN_LABELS, signs: FS_MOVE_SIGNS };
export const fsWorldDust = (dm: FsWorld['dm']): FsWorld => ({ style: 'dust', map: FS_MAP_DUNA, boxes: FS_DUST_BOXES, targets: [], bots: [], dm, half: FS_DUST_HALF, labels: FS_DUST_LABELS, signs: [] });
/** O mundo de um mapa de partida: a Duna (desenhada por caixas e decoração) ou um mapa com modelo 3D. */
export const fsWorldFor = (map: FsMapApi, dm: FsWorld['dm']): FsWorld =>
  map.visual.kind === 'dust' ? fsWorldDust(dm) : { style: 'glb', map, boxes: map.solids, targets: [], bots: [], dm, half: map.half, labels: map.labels, signs: [] };

export type Quality = 'low' | 'mid' | 'high';

/** Onde cada arma fica na mão (modelo em metros, boca em +X, origem no gatilho). */
interface VmCfg {
  scale: number;
  hip: [number, number, number];
  ads: [number, number, number];
  /** Nós móveis que a animação conhece (por nome, com alternativas). */
  mag: string[];
  bolt: string[];
  slide: string[];
  /** Giro do modelo em Y (os fuzis têm a boca em +X; os braços da faca já olham para +Z). */
  rotY?: number;
}

const VM: Record<FsWeaponId, VmCfg> = {
  ak: {
    scale: 0.8,
    hip: [0.16, -0.18, -0.37],
    ads: [0.0, -0.138, -0.3],
    mag: ['Magazine'],
    bolt: ['ChargingHandle', 'EjectionHandle'],
    slide: [],
  },
  pistol: {
    scale: 1.0,
    hip: [0.17, -0.17, -0.3],
    ads: [0.0, -0.118, -0.26],
    mag: ['Magazine'],
    bolt: [],
    slide: ['Slide'],
  },
  sniper: {
    scale: 0.62,
    hip: [0.2, -0.2, -0.36],
    ads: [0.0, -0.17, -0.3],
    mag: ['Magazine', 'Ammunition1'],
    bolt: ['Bolt'],
    slide: [],
  },
  smg: { scale: 0.74, hip: [0.16, -0.17, -0.38], ads: [0.0, -0.13, -0.3], mag: ['Magazine'], bolt: [], slide: [] },
  shotgun: { scale: 0.8, hip: [0.17, -0.17, -0.38], ads: [0.0, -0.13, -0.3], mag: [], bolt: ['Pump'], slide: [] },
  m4: { scale: 0.85, hip: [0.16, -0.18, -0.37], ads: [0.0, -0.135, -0.3], mag: ['Magazine'], bolt: ['Bolt'], slide: [] },
  // modelo com silenciador (~0,45 m): escala menor para o corpo e o cabo ficarem do tamanho da Glock; origem no gatilho
  usp: { scale: 0.62, hip: [0.12, -0.075, -0.34], ads: [0.0, -0.06, -0.28], mag: [], bolt: [], slide: ['Slide'] },
  // a faca e as mãos são desenhadas em FsHands, já no espaço da câmera
  knife: { scale: 1, hip: [0, 0, 0], ads: [0, 0, 0], mag: [], bolt: [], slide: [], rotY: 0 },
};

/** Os modelos de referência têm outra origem (Glock no centro do ferrolho, L96 no centro da arma): posições à parte. */
const VM_REF: Partial<Record<FsWeaponId, VmCfg>> = {
  pistol: {
    scale: 1.0,
    hip: [0.115, -0.09, -0.35],
    ads: [0.0, -0.058, -0.28],
    mag: ['Magazine'],
    bolt: [],
    slide: ['Slide'],
  },
  sniper: {
    scale: 0.62,
    hip: [0.16, -0.12, -0.48],
    ads: [0.0, -0.06, -0.42],
    mag: ['Ammunition1'],
    bolt: [],
    slide: [],
  },
};
const TEX = 256;

function canvasTex(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noise(g: CanvasRenderingContext2D, amount: number, size = 2) {
  for (let i = 0; i < 2600; i++) {
    const v = Math.random() * amount;
    g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${v / 255})`;
    g.fillRect(Math.random() * TEX, Math.random() * TEX, size, size);
  }
}

/** Texturas de 2 m por 2 m, geradas por código (sem arquivos): concreto, caixote de madeira, tábua e placa de aço. */
function materials(): Record<FsBox['mat'] | 'ground', THREE.MeshStandardMaterial> {
  const wall = canvasTex((g) => {
    g.fillStyle = '#d9c7a6';
    g.fillRect(0, 0, TEX, TEX);
    noise(g, 40);
    g.strokeStyle = 'rgba(70,55,35,.35)';
    g.lineWidth = 3;
    g.strokeRect(2, 2, TEX - 4, TEX - 4);
    g.beginPath();
    g.moveTo(TEX / 2, 0);
    g.lineTo(TEX / 2, TEX);
    g.stroke();
  });
  const crate = canvasTex((g) => {
    g.fillStyle = '#9a6a3a';
    g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#8e5f32' : '#a4723f';
      g.fillRect(0, i * 32, TEX, 30);
      g.fillStyle = 'rgba(40,20,5,.5)';
      g.fillRect(0, i * 32 + 30, TEX, 2);
    }
    g.strokeStyle = '#3b2a1a';
    g.lineWidth = 14;
    g.strokeRect(7, 7, TEX - 14, TEX - 14);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(TEX, TEX);
    g.stroke();
    noise(g, 50);
  });
  const wood = canvasTex((g) => {
    g.fillStyle = '#c99a5c';
    g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#bd8b4e' : '#d3a468';
      g.fillRect(i * 42, 0, 40, TEX);
      g.fillStyle = 'rgba(60,35,10,.5)';
      g.fillRect(i * 42 + 40, 0, 2, TEX);
    }
    noise(g, 40);
  });
  const metal = canvasTex((g) => {
    g.fillStyle = '#5e6670';
    g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = 3;
    for (let i = -TEX; i < TEX * 2; i += 28) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + TEX, TEX);
      g.stroke();
    }
    noise(g, 30);
  });
  const ground = canvasTex((g) => {
    g.fillStyle = '#6f6a5f';
    g.fillRect(0, 0, TEX, TEX);
    noise(g, 80, 3);
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 40; i++)
      g.fillRect(Math.random() * TEX, Math.random() * TEX, 30 + Math.random() * 40, 2);
    g.strokeStyle = 'rgba(40,35,30,.45)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, TEX, TEX);
  });
  const brick = canvasTex((g) => {
    g.fillStyle = '#7a4a36';
    g.fillRect(0, 0, TEX, TEX);
    for (let r = 0; r < 8; r++) {
      for (let c = -1; c < 4; c++) {
        const x = c * 64 + (r % 2 ? 32 : 0);
        g.fillStyle = (r * 7 + c * 3) % 3 === 0 ? '#8a5640' : (r + c) % 2 ? '#6e4230' : '#7e4e39';
        g.fillRect(x + 2, r * 32 + 2, 60, 28);
      }
    }
    noise(g, 45);
  });
  // ---- texturas do Duna (geradas por código, nada de arquivo): reboco ocre, arenito em blocos, ladrilho, pedra e terra
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const plaster = canvasTex((g) => {
    g.fillStyle = '#d6b273';
    g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '120,80,30' : '255,235,190'},${rnd(0.04, 0.12)})`;
      g.fillRect(rnd(0, TEX), rnd(0, TEX), rnd(30, 120), rnd(14, 60));
    }
    g.fillStyle = 'rgba(95,60,25,.28)';
    g.fillRect(0, TEX - 22, TEX, 22);
    g.fillStyle = 'rgba(255,240,200,.35)';
    g.fillRect(0, TEX - 24, TEX, 2);
    noise(g, 34);
  });
  const sandstone = canvasTex((g) => {
    g.fillStyle = '#c79d62';
    g.fillRect(0, 0, TEX, TEX);
    for (let r = 0; r < 4; r++) {
      for (let c = -1; c < 3; c++) {
        const x = c * 128 + (r % 2 ? 64 : 0);
        const v = rnd(0.94, 1.08);
        g.fillStyle = `rgb(${(200 * v) | 0},${(162 * v) | 0},${(108 * v) | 0})`;
        g.fillRect(x + 3, r * 64 + 3, 122, 58);
      }
    }
    noise(g, 40);
  });
  const tile = canvasTex((g) => {
    g.fillStyle = '#69808f';
    g.fillRect(0, 0, TEX, TEX);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillStyle = (r + c) % 2 ? '#7a909e' : '#72889a';
        g.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);
      }
    }
    noise(g, 36);
  });
  const cobble = canvasTex((g) => {
    g.fillStyle = '#4d463d';
    g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 70; i++) {
      const x = rnd(0, TEX);
      const y = rnd(0, TEX);
      const w = rnd(30, 52);
      const h = rnd(22, 38);
      const v = rnd(0.85, 1.12);
      g.fillStyle = `rgb(${(138 * v) | 0},${(124 * v) | 0},${(104 * v) | 0})`;
      g.beginPath();
      g.roundRect(x, y, w, h, 8);
      g.fill();
    }
    noise(g, 44);
  });
  const concrete = canvasTex((g) => {
    g.fillStyle = '#a6a39b';
    g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = 'rgba(60,58,52,.5)';
    g.lineWidth = 4;
    g.strokeRect(1, 1, TEX - 2, TEX - 2);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = `rgba(80,76,66,${rnd(0.03, 0.09)})`;
      g.fillRect(rnd(0, TEX), rnd(0, TEX), rnd(30, 100), rnd(20, 70));
    }
    noise(g, 50);
  });
  const dirt = canvasTex((g) => {
    g.fillStyle = '#b89c6c';
    g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '90,64,30' : '236,214,160'},${rnd(0.05, 0.14)})`;
      g.beginPath();
      g.ellipse(rnd(0, TEX), rnd(0, TEX), rnd(8, 34), rnd(4, 16), rnd(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    noise(g, 70, 3);
  });
  const mk = (map: THREE.Texture, rough: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ map, roughness: rough, metalness });
  return {
    wall: mk(wall, 0.92),
    crate: mk(crate, 0.85),
    wood: mk(wood, 0.8),
    metal: mk(metal, 0.5, 0.5),
    floorpad: mk(ground, 0.95),
    brick: mk(brick, 0.9),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.1, depthWrite: false }),
    plaster: mk(plaster, 0.95),
    sandstone: mk(sandstone, 0.92),
    tile: mk(tile, 0.8),
    cobble: mk(cobble, 0.95),
    concrete: mk(concrete, 0.95),
    dirt: mk(dirt, 1),
    ground: mk(ground, 0.95),
  };
}

/** Multiplica o UV de cada face pelo tamanho em metros / 2 (a textura se repete a cada 2 m, sem esticar). */
function worldUV(geo: THREE.BoxGeometry, sx: number, sy: number, sz: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [
    [sz, sy],
    [sz, sy],
    [sx, sz],
    [sx, sz],
    [sx, sy],
    [sx, sy],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f]![0]) / 2, (uv.getY(i) * dims[f]![1]) / 2);
    }
  }
}

/**
 * Placa do mapa de treino: painel escuro com faixa laranja e o texto inteiro (quebra em duas linhas se for comprido, sem cortar).
 * Tem profundidade (as paredes escondem) e some com a distância: as de nome de sala aparecem de longe, as pequenas só de perto.
 */
function signSprite(text: string, big: boolean): { sprite: THREE.Sprite; range: number } {
  const font = `700 ${big ? 46 : 36}px Rajdhani, "Segoe UI", system-ui, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const up = text.toUpperCase();
  const maxChars = big ? 26 : 20;
  let lines = [up];
  if (up.length > maxChars) {
    // quebra no espaço mais perto do meio
    const mid = up.length / 2;
    let cut = -1;
    for (let i = 0; i < up.length; i++) if (up[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    if (cut > 0) lines = [up.slice(0, cut), up.slice(cut + 1)];
  }
  const px = big ? 46 : 36;
  const lh = Math.round(px * 1.15);
  const padX = Math.round(px * 0.7);
  const padY = Math.round(px * 0.38);
  const bar = 10;
  const textW = Math.max(...lines.map((l) => probe.measureText(l).width));
  const w = Math.ceil(textW + padX * 2 + bar);
  const h = lines.length * lh + padY * 2;
  const c = document.createElement('canvas');
  c.width = w + 8;
  c.height = h + 8;
  const g = c.getContext('2d')!;
  g.translate(4, 4);
  g.fillStyle = 'rgba(10,16,34,0.94)';
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(0, 0, w, h, 12);
  g.fill();
  g.stroke();
  g.fillStyle = '#ff6a2b';
  g.beginPath();
  g.roundRect(0, 0, bar, h, [12, 0, 0, 12]);
  g.fill();
  g.font = font;
  g.fillStyle = '#f4efe6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, bar + (w - bar) / 2, padY + lh * (i + 0.5) + 2));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, depthWrite: false, transparent: true }));
  const per = big ? 0.0058 : 0.0052;
  sprite.scale.set(c.width * per, c.height * per, 1);
  sprite.renderOrder = 10;
  return { sprite, range: big ? 42 : 15 };
}

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.strokeStyle = '#1b1535';
  g.lineWidth = 6;
  const r = 14;
  g.beginPath();
  g.roundRect(6, 8, 244, 48, r);
  g.fill();
  g.stroke();
  g.fillStyle = color;
  g.font = '800 24px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 128, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }),
  );
  s.scale.set(1.5, 0.375, 1);
  s.renderOrder = 10;
  return s;
}

interface FoxView {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  label: THREE.Sprite;
  hitT: number;
  /** Animação tocando agora (bots) e a velocidade dela. */
  anim: string;
  /** Morte: empurrão que perde força e giro de queda. */
  vel: THREE.Vector3;
  fall: number;
  dead: boolean;
  home: THREE.Vector3;
  /** Giro suave do corpo para cair na direção do tiro. */
  turn: { from: number; to: number; t: number } | null;
  yaw0: number;
  /** Aliado (mesmo time): silhueta que aparece por trás das paredes e o nome em cima da cabeça. */
  ghost?: THREE.Object3D[];
  ghostMat?: THREE.MeshBasicMaterial;
  tag?: THREE.Sprite;
  tagText?: string;
}

interface Puff {
  s: THREE.Sprite;
  age: number;
  life: number;
  grow: number;
}

interface Tracer {
  m: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  th: number;
  tail: number;
}

/**
 * A cena do Fox Shot! (fase 0): arena, raposas-alvo com esqueleto e animação, arma na mão (cena e câmera à parte para a arma
 * não entrar nas paredes), clarão, rastro da bala e poeira de impacto. Qualidade em três níveis (sombra, resolução, alcance).
 */
export class FoxShotScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(75, 1, 0.05, 160);
  /** O céu acompanha a câmera (os mapas grandes têm bordas longe do centro). */
  private sky: THREE.Mesh | null = null;
  private signSprites: { sprite: THREE.Sprite; range: number }[] = [];
  private furMats: { t: THREE.Material; ct: THREE.Material } | null = null;
  private vmScene = new THREE.Scene();
  private vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 5);
  private sun: THREE.DirectionalLight;
  private foxes = new Map<string, FoxView>();
  private weapons = new Map<FsWeaponId, THREE.Group>();
  private vm = new THREE.Group();
  private vmPivot = new THREE.Group();
  private muzzle = new Map<FsWeaponId, THREE.Vector3>();
  private flash: THREE.Sprite;
  private flashT = 0;
  private puffs: Puff[] = [];
  private tracers: Tracer[] = [];
  private puffTex: THREE.Texture;
  private quality: Quality = 'high';
  private maxDpr = 2;
  private cur: FsWeaponId = 'ak';
  private nodes = new Map<string, THREE.Object3D | null>();
  // animação da arma
  private t = 0;
  private bob = 0;
  private kickZ = 0;
  private kickVel = 0;
  private kickRot = 0;
  private kickRotVel = 0;
  private adsK = 0;
  /** Quanto a mira está fechada (0 a 1): a página liga a luneta junto com isso, sem esperar o HUD. */
  get adsAmount() {
    return this.adsK;
  }
  private drawK = 1;
  private reloadK = -1;
  private boltK = -1;
  private hands = new FsHands();
  // ---- granadas: modelos, a que está na mão (com a animação do pino e do arremesso), as que voam e o clarão da explosão
  private nadeTpl: Partial<Record<FsGrenadeId, THREE.Object3D>> = {};
  private nadeHand: Partial<Record<FsGrenadeId, THREE.Object3D>> = {};
  private nadeWorld = new Map<number, THREE.Object3D>();
  private nadeSeq = 0;
  private nade: { kind: FsGrenadeId; phase: 'idle' | 'pin' | 'charge' | 'throw'; t: number; charge: number; style: 'far' | 'mid' | 'near' } | null = null;
  private blast: THREE.PointLight | null = null;
  private blastT = 0;
  private blastDur = 0.4;
  private blastPeak = 40;
  private slashParity = false;
  /** Risco branco do corte: tempo desde o golpe (0 = parado) e a malha. */
  private arcT = 0;
  private arc = new THREE.Mesh(
    new THREE.RingGeometry(0.27, 0.292, 32, 1, 0.1, Math.PI * 0.75),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, fog: false }),
  );
  /** Recarga: carregador novo na mão, carregador velho caindo e o que já foi feito. */
  private heldMag: THREE.Object3D | null = null;
  private fallMag: { o: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; t: number } | null = null;
  private magDropped = false;
  private boltPhase = 0;
  /** Inspeção da arma (F): 0 a 1 enquanto toca, -1 parada. */
  private inspK = -1;
  private inspDur = 3;
  private knifeObj = makeKnife();
  private knifeAnim: { keys: KnifeKey[]; t: number; dur: number; inspect: boolean; freeze?: boolean } | null = null;
  /** Onde as mãos seguram cada arma (no espaço do modelo da arma). */
  private grips = new Map<FsWeaponId, { r: THREE.Vector3; l: THREE.Vector3 }>();
  private view = { fov: 75 };
  usingRef = { ak: false, pistol: false, sniper: false, knife: false, smg: false, shotgun: false, m4: false, usp: false } as Record<FsWeaponId, boolean>;

  constructor(canvas: HTMLCanvasElement, private world: FsWorld = FS_WORLD_TRAIN) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // reflexo para os metais (sem isso o aço sai preto): uma sala de estúdio pequena virou mapa de ambiente
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.vmScene.environment = env;
    this.scene.environmentIntensity = 0.55;
    this.vmScene.environmentIntensity = 0.9;
    pm.dispose();
    // céu em gradiente e névoa quente
    this.scene.background = new THREE.Color(0xbfd8f2);
    this.scene.fog = new THREE.Fog(0xe9d8bd, 28, 95);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(80, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x5f9ee8) },
          bot: { value: new THREE.Color(0xf7dcb1) },
        },
        vertexShader:
          'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
        fragmentShader:
          'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-0.05, 0.55, h)),1.0); }',
      }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x7a6850, 1.0));
    this.sun = new THREE.DirectionalLight(0xffe0b0, 2.8);
    this.sun.position.set(-18, 30, 14);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 26;
    this.sun.shadow.camera.bottom = -26;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(this.cam);

    this.vmScene.add(new THREE.HemisphereLight(0xe6efff, 0x6a5a48, 1.35));
    const vsun = new THREE.DirectionalLight(0xffe6c0, 2.4);
    vsun.position.set(-1, 2, 1.5);
    this.vmScene.add(vsun);
    this.vmScene.add(this.vmCam);
    this.vmCam.add(this.vm);
    this.vm.add(this.vmPivot);

    const pc = document.createElement('canvas');
    pc.width = pc.height = 64;
    const pg = pc.getContext('2d')!;
    const grad = pg.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = grad;
    pg.fillRect(0, 0, 64, 64);
    this.puffTex = new THREE.CanvasTexture(pc);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.puffTex,
        color: 0xffc977,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
      }),
    );
    this.flash.visible = false;
    this.flash.renderOrder = 20;
    this.vm.add(this.flash);
    this.buildArena();
  }

  private buildArena() {
    // mapa com modelo 3D: o desenho vem do arquivo (`buildGlbMap`); aqui não há chão nem caixas
    if (this.world.style === 'glb') {
      this.scene.fog = new THREE.Fog(0xe9d8bd, 45, 150);
      return;
    }
    const mats = materials();
    const dust = this.world.style === 'dust';
    const gsize = Math.max(...this.world.half) * 2 + 60;
    const rep = (gsize / 80) * 14;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gsize, gsize), mats.ground);
    ground.rotation.x = -Math.PI / 2;
    (ground.material as THREE.MeshStandardMaterial).map!.repeat.set(rep, rep);
    ground.receiveShadow = true;
    this.scene.add(ground);
    for (const b of this.world.boxes) {
      const sx = b.max[0] - b.min[0],
        sy = b.max[1] - b.min[1],
        sz = b.max[2] - b.min[2];
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      worldUV(geo, sx, sy, sz);
      const m = new THREE.Mesh(geo, mats[b.mat]);
      m.position.set(
        (b.min[0] + b.max[0]) / 2,
        (b.min[1] + b.max[1]) / 2,
        (b.min[2] + b.max[2]) / 2,
      );
      m.castShadow = b.mat !== 'glass';
      m.receiveShadow = b.mat !== 'glass';
      this.scene.add(m);
    }
    for (const m of Object.values(mats)) if (m.map) m.map.repeat.set(1, 1);
    (mats.ground.map as THREE.Texture).repeat.set(rep, rep);
    if (dust) this.buildDustDecor();
  }

  /** Chão do Duna: cada zona com o seu piso (terra, pedra, ladrilho, tijolo) e as marcas de A, B e das bases. Só decoração, sem colisão. */
  private buildDustDecor() {
    const mats = materials();
    for (const d of FS_DUST_DECALS) {
      const w = d.x1 - d.x0;
      const h = d.z1 - d.z0;
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * h) / 2);
      const m = new THREE.Mesh(geo, mats[d.mat]);
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      (m.material as THREE.MeshStandardMaterial).polygonOffset = true;
      (m.material as THREE.MeshStandardMaterial).polygonOffsetFactor = -1;
      m.rotation.x = -Math.PI / 2;
      m.position.set((d.x0 + d.x1) / 2, 0.006, (d.z0 + d.z1) / 2);
      m.receiveShadow = true;
      this.scene.add(m);
    }
    const paint = (id: string, color: string, letter: string, c0: number, r0: number, c1: number, r1: number) => {
      const r = fsDustRectWorld({ c0, r0, c1, r1 });
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      const tex = canvasTex((g) => {
        g.clearRect(0, 0, TEX, TEX);
        g.globalAlpha = 0.9;
        g.strokeStyle = color;
        g.lineWidth = 8;
        g.strokeRect(5, 5, TEX - 10, TEX - 10);
        g.globalAlpha = 0.5;
        g.fillStyle = color;
        g.font = '900 170px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(letter, TEX / 2, TEX / 2 + 8);
      });
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const y = fsDustHeight(Math.floor((c0 + c1) / 2), Math.floor((r0 + r1) / 2)) + 0.014;
      const sz = Math.min(w, d);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(sz, sz),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
      this.scene.add(m);
      void id;
    };
    paint('A', '#ff7d26', 'A', 44, 12, 52, 16);
    paint('B', '#2f7bff', 'B', 8, 19, 16, 23);
    paint('CT', '#4aa3ff', 'CT', 23, 19, 32, 22);
    paint('TR', '#ff9a3a', 'TR', 6, 56, 14, 60);
  }

  /** Carrega raposa e armas. Tenta primeiro os modelos de referência (se existirem) e cai nos modelos do jogo. */
  async load(): Promise<void> {
    const loader = new GLTFLoader();
    const base = `${import.meta.env.BASE_URL ?? '/'}models/foxshot/`.replace('//', '/');
    const tryLoad = async (names: string[]) => {
      for (const n of names) {
        try {
          const g = await loader.loadAsync(base + n);
          return { g, name: n };
        } catch {
          /* tenta o próximo */
        }
      }
      throw new Error(`modelo não encontrado: ${names.join(', ')}`);
    };
    const [fox, ...ws] = await Promise.all([
      tryLoad(['fox.glb']),
      tryLoad(['ref/ak.glb', 'rifle.glb']),
      tryLoad(['ref/pistol.glb', 'pistol.glb']),
      tryLoad(['ref/sniper.glb', 'sniper.glb']),
      // as armas novas (modelos do Lucas); se algum não abrir, usa o modelo parecido que já existe
      tryLoad(['ref/smg.glb', 'ref/ak.glb', 'rifle.glb']),
      tryLoad(['ref/shotgun.glb', 'ref/sniper.glb', 'sniper.glb']),
      tryLoad(['ref/m4.glb', 'ref/ak.glb', 'rifle.glb']),
      tryLoad(['ref/usp.glb', 'ref/pistol.glb', 'pistol.glb']),
    ]);
    const ids: FsWeaponId[] = ['ak', 'pistol', 'sniper', 'smg', 'shotgun', 'm4', 'usp'];
    ws.forEach((w, i) => {
      const id = ids[i]!;
      this.usingRef[id] = w.name.startsWith('ref/');
      const g = w.g.scene;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = false;
          m.frustumCulled = false;
        }
      });
      const holder = new THREE.Group();
      holder.add(g);
      holder.visible = false;
      // a boca: ponta do modelo em +X, na altura do cano (perto do meio da caixa)
      const box = new THREE.Box3().setFromObject(g);
      this.muzzle.set(
        id,
        new THREE.Vector3(
          box.max.x,
          box.min.y + (box.max.y - box.min.y) * 0.55,
          (box.min.z + box.max.z) / 2,
        ),
      );
      this.weapons.set(id, holder);
      this.vmPivot.add(holder);
      // onde as patas pegam: cabo/gatilho atrás e a mão da frente mais adiante, em frações da caixa do modelo
      const L = box.max.x - box.min.x;
      const Hh = box.max.y - box.min.y;
      const zc = (box.min.z + box.max.z) / 2;
      const f: Record<string, [number, number, number, number]> = {
        ak: [0.34, 0.3, 0.62, 0.5],
        pistol: [0.3, 0.42, 0.4, 0.32],
        sniper: [0.3, 0.3, 0.55, 0.4],
        smg: [0.42, 0.28, 0.2, 0.2],
        shotgun: [0.34, 0.32, 0.62, 0.48],
        m4: [0.34, 0.3, 0.64, 0.5],
        usp: [0.15, 0.3, 0.3, 0.2],
      };
      const q = f[id]!;
      this.grips.set(id, {
        r: new THREE.Vector3(box.min.x + L * q[0], box.min.y + Hh * q[1], zc),
        l: new THREE.Vector3(box.min.x + L * q[2], box.min.y + Hh * q[3], zc),
      });
    });
    const kHolder = new THREE.Group();
    kHolder.visible = false;
    this.muzzle.set('knife', new THREE.Vector3());
    this.weapons.set('knife', kHolder);
    this.vmPivot.add(kHolder);
    this.vm.add(this.hands.group, this.knifeObj);
    // granadas (modelos do Lucas; se faltarem, uma forma simples)
    for (const [kind, file] of [['frag', 'ref/frag.glb'], ['flash', 'ref/flash.glb']] as const) {
      let tpl: THREE.Object3D;
      try {
        const g = await loader.loadAsync(base + file);
        tpl = g.scene;
      } catch {
        tpl = new THREE.Mesh(
          kind === 'frag' ? new THREE.SphereGeometry(0.045, 12, 10) : new THREE.CylinderGeometry(0.03, 0.03, 0.13, 12),
          new THREE.MeshStandardMaterial({ color: kind === 'frag' ? 0x2a3a1a : 0x8a8d94, roughness: 0.6, metalness: 0.4 }),
        );
      }
      tpl.traverse((o) => {
        (o as THREE.Mesh).frustumCulled = false;
      });
      this.nadeTpl[kind] = tpl;
      const hand = tpl.clone(true);
      hand.visible = false;
      this.vm.add(hand);
      this.nadeHand[kind] = hand;
    }

    // C4 do modo Bomba (modelo do Lucas; sem o arquivo usa uma caixa)
    try {
      this.c4Tpl = (await loader.loadAsync(base + 'c4.glb')).scene;
    } catch {
      this.c4Tpl = null;
    }

    // raposas-alvo e bots de treino
    const makeFox = (id: string, x: number, z: number, yaw: number, text: string, color: string) => {
      const root = new THREE.Group();
      const model = SkeletonUtils.clone(fox.g.scene);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.frustumCulled = false;
        }
      });
      root.add(model);
      root.position.set(x, 0, z);
      root.rotation.y = yaw;
      const mixer = new THREE.AnimationMixer(model);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of fox.g.animations) actions[clip.name] = mixer.clipAction(clip);
      actions.idle?.play();
      if (actions.idle) actions.idle.time = Math.random() * 2;
      for (const n of ['hit', 'jump'])
        if (actions[n]) {
          actions[n]!.setLoop(THREE.LoopOnce, 1);
          actions[n]!.clampWhenFinished = false;
        }
      for (const dn of ['death_back', 'death_front'])
        if (actions[dn]) {
          actions[dn]!.setLoop(THREE.LoopOnce, 1);
          actions[dn]!.clampWhenFinished = true;
        }
      const label = labelSprite(text, color);
      label.position.set(0, 1.85, 0);
      root.add(label);
      this.scene.add(root);
      this.foxes.set(id, { root, mixer, actions, label, hitT: 0, anim: 'idle', vel: new THREE.Vector3(), fall: 0, dead: false, home: new THREE.Vector3(x, 0, z), turn: null, yaw0: yaw });
    };
    for (const spec of this.world.targets) {
      // olham para onde `facing` manda (no plano x, z); a cena gira o modelo pelo ângulo de rumo
      const f = spec.facing ?? [0, 1];
      makeFox(spec.id, spec.x, spec.z, -Math.atan2(f[1], f[0]), spec.label, spec.armor > 0 ? '#2f5bff' : '#c4571a');
      this.foxes.get(spec.id)!.label.visible = false;
    }
    for (const d of this.world.dm) {
      makeFox(d.id, d.x, d.z, 0, '', '#1f7a3a');
      this.foxes.get(d.id)!.label.visible = false;
    }
    for (const spec of this.world.bots) {
      makeFox(spec.id, spec.x, spec.z, 0, spec.label, '#1f7a3a');
      // o nome do movimento fica na placa da raia, não em cima do bot
      this.foxes.get(spec.id)!.label.visible = false;
    }
    // placas no ar (nome das salas, o que fazer em cada canto, marcas de distância)
    for (const sg of this.world.signs) {
      const { sprite, range } = signSprite(sg.text, !!sg.big);
      sprite.position.set(sg.x, sg.y, sg.z);
      this.scene.add(sprite);
      this.signSprites.push({ sprite, range });
    }
    if (this.world.style === 'dust') {
      this.buildSiteMarkers();
      await this.buildDustProps(loader, base).catch(() => undefined);
    } else if (this.world.style === 'glb') {
      await this.buildGlbMap(loader, base).catch(() => undefined);
      this.buildSiteMarkers();
    }
    this.selectWeapon('ak', true);
  }

  /** Enfeites do Duna (modelos de terceiros, ver docs/CREDITS-3D.md): fachadas, postes, barreiras e o horizonte de prédios, tudo instanciado. */
  /**
   * Raposa do mesmo time que você (como o CS): o nome fica em cima da cabeça e o corpo aparece em azul por trás das paredes
   * (só onde está escondido). Vale só para aliados: os outros continuam escondidos pelo mapa.
   */
  setAlly(id: string, ally: boolean, name = '', team: 'ct' | 't' = 'ct', ghost = true) {
    const f = this.foxes.get(id);
    if (!f) return;
    if (ally && ghost && !f.ghost) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.5, depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false });
      f.ghost = [];
      f.ghostMat = mat;
      const skins: THREE.SkinnedMesh[] = [];
      f.root.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh);
      });
      for (const sk of skins) {
        if (!sk.parent) continue;
        const g = new THREE.SkinnedMesh(sk.geometry, mat);
        g.bind(sk.skeleton, sk.bindMatrix);
        g.frustumCulled = false;
        g.renderOrder = 4;
        g.position.copy(sk.position);
        g.quaternion.copy(sk.quaternion);
        g.scale.copy(sk.scale);
        sk.parent.add(g);
        f.ghost.push(g);
      }
    }
    // a silhueta só aparece atrás de parede (`ghost`); o nome aparece sempre; morto não mostra nenhum dos dois
    f.ghost?.forEach((g) => (g.visible = ally && ghost));
    f.ghostMat?.color.set(team === 't' ? 0xff9a3c : 0x4da3ff);
    if (ally) {
      const tagKey = `${name}|${team}`;
      if (!f.tag || f.tagText !== tagKey) {
        if (f.tag) f.root.remove(f.tag);
        const tag = labelSprite(name, team === 't' ? '#d9660a' : '#1f5fe0');
        tag.position.set(0, 1.95, 0);
        tag.scale.set(1.6, 0.4, 1);
        tag.renderOrder = 12;
        f.root.add(tag);
        f.tag = tag;
        f.tagText = tagKey;
      }
      f.tag.visible = true;
    } else if (f.tag) f.tag.visible = false;
  }

  /**
   * Time da raposa: contra-terrorista com pelo azul, terrorista com o pelo laranja de sempre. Só o material do pelo troca
   * (os dois materiais são compartilhados entre as raposas).
   */
  setTeam(id: string, team: 'ct' | 't') {
    const f = this.foxes.get(id);
    if (!f) return;
    f.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      if (!this.furMats) {
        if (mat.name !== 'fur') return;
        const ct = mat.clone() as THREE.MeshStandardMaterial;
        ct.color.set('#2f6bff');
        this.furMats = { t: mat, ct };
      }
      const cur = m.material as THREE.Material;
      if (cur === this.furMats.t || cur === this.furMats.ct) m.material = team === 'ct' ? this.furMats.ct : this.furMats.t;
    });
  }

  /** O sinal das bombas A e B dentro do jogo: um selo no chão e a letra grande no ar (as bases só aparecem nos mapas). */
  /** Mapa com modelo 3D: carrega o arquivo (já em metros, no mesmo eixo do jogo) com material simples e sem sombras (são milhares de triângulos). */
  private async buildGlbMap(loader: GLTFLoader, base: string) {
    const v = this.world.map!.visual;
    if (v.kind !== 'glb') return;
    const gltf = await loader.loadAsync(base + v.url);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeVertexNormals();
      const old = m.material as THREE.MeshStandardMaterial;
      m.material = new THREE.MeshLambertMaterial({ map: old.map ?? null, color: old.color ?? 0xffffff, alphaTest: old.alphaTest || 0, side: THREE.DoubleSide });
      m.castShadow = false;
      m.receiveShadow = false;
    });
    this.scene.add(gltf.scene);
  }

  private buildSiteMarkers() {
    for (const mk of (this.world.map?.marks ?? FS_DUST_MARKS)) {
      if (mk.kind !== 'site') continue;
      const y = this.world.map ? this.world.map.floorY(mk.x, mk.z) : fsDustFloorY(mk.x, mk.z);
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, 512, 512);
      g.lineWidth = 22;
      g.strokeStyle = 'rgba(255,179,71,0.95)';
      g.fillStyle = 'rgba(10,16,34,0.35)';
      g.beginPath();
      g.arc(256, 256, 228, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.lineWidth = 8;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(256, 256, 196, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(255,179,71,0.95)';
      g.font = '900 300px "Saira Stencil One", Rajdhani, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(mk.short, 256, 276);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(mk.x, y + 0.03, mk.z);
      floor.renderOrder = 2;
      this.scene.add(floor);
      // a letra no ar, vista de longe
      const badge = document.createElement('canvas');
      badge.width = badge.height = 256;
      const b = badge.getContext('2d')!;
      b.fillStyle = 'rgba(10,16,34,0.88)';
      b.strokeStyle = '#ffb347';
      b.lineWidth = 14;
      b.beginPath();
      b.arc(128, 128, 112, 0, Math.PI * 2);
      b.fill();
      b.stroke();
      b.fillStyle = '#ffb347';
      b.font = '900 170px "Saira Stencil One", Rajdhani, system-ui, sans-serif';
      b.textAlign = 'center';
      b.textBaseline = 'middle';
      b.fillText(mk.short, 128, 142);
      const bt = new THREE.CanvasTexture(badge);
      bt.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, transparent: true, depthTest: true, depthWrite: false }));
      sprite.scale.set(2.4, 2.4, 1);
      sprite.position.set(mk.x, y + 4.2, mk.z);
      sprite.renderOrder = 9;
      this.scene.add(sprite);
    }
  }

  private async buildDustProps(loader: GLTFLoader, base: string) {
    const names = [...new Set(FS_DUST_DECOR.map((p) => p.model))];
    for (const name of names) {
      let gltf;
      try {
        gltf = await loader.loadAsync(`${base}map/${name}.glb`);
      } catch {
        continue;
      }
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const hgt = Math.max(0.01, new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y);
      const places = FS_DUST_DECOR.filter((p) => p.model === name);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const inst = new THREE.InstancedMesh(m.geometry, m.material, places.length);
        const rel = m.matrixWorld.clone();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        places.forEach((p, i) => {
          const k = p.h > 0 ? p.h / hgt : 1;
          e.set(0, p.rot, 0);
          q.setFromEuler(e);
          const mat = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(k, k, k));
          inst.setMatrixAt(i, mat.multiply(rel));
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = false;
        inst.castShadow = !name.startsWith('bld_');
        inst.receiveShadow = true;
        this.scene.add(inst);
      });
    }
  }

  // ---- câmera e tamanho
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    this.vmCam.aspect = w / h;
    this.vmCam.updateProjectionMatrix();
  }

  setQuality(q: Quality, dprCap?: number) {
    this.quality = q;
    this.maxDpr = dprCap ?? (q === 'high' ? 2 : q === 'mid' ? 1.5 : 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    (this.scene.fog as THREE.Fog).far = q === 'low' ? 70 : 95;
    this.cam.far = 120;
    this.cam.updateProjectionMatrix();
  }
  get fovNow(): number {
    return this.view.fov;
  }
  get level(): Quality {
    return this.quality;
  }

  /** Mostra ou esconde a arma na mão (some quando o jogador morre). */
  hideViewmodel = false;
  setView(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov: number, rollDeg = 0) {
    this.cam.position.set(x, y, z);
    this.sky?.position.set(x, y, z);
    {
      // a sombra cobre só o que está perto de quem joga: o sol acompanha a câmera
      this.sun.target.position.set(x, 0, z);
      this.sun.position.set(x - 18, 30, z + 14);
      this.sun.target.updateMatrixWorld();
    }
    this.cam.rotation.set((pitchDeg * Math.PI) / 180, (yawDeg * Math.PI) / 180, (rollDeg * Math.PI) / 180, 'YXZ');
    if (Math.abs(fov - this.view.fov) > 0.01) {
      this.view.fov = fov;
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
  }

  // ---- arma na mão
  selectWeapon(id: FsWeaponId, instant = false) {
    this.cur = id;
    for (const [k, g] of this.weapons) g.visible = k === id;
    const cfg = this.cfgOf(id);
    const g = this.weapons.get(id);
    if (g) {
      g.scale.setScalar(cfg.scale);
      g.rotation.y = cfg.rotY ?? Math.PI / 2;
    }
    this.nodes.clear();
    this.knifeAnim = null;
    this.inspK = -1;
    this.magDropped = false;
    // os carregadores soltos são do modelo da arma anterior
    if (this.heldMag) this.vm.remove(this.heldMag);
    this.heldMag = null;
    if (this.fallMag) this.vm.remove(this.fallMag.o);
    this.fallMag = null;
    this.drawK = instant ? 1 : 0;
    this.reloadK = -1;
    this.boltK = -1;
  }

  private cfgOf(id: FsWeaponId): VmCfg {
    return (this.usingRef[id] ? VM_REF[id] : undefined) ?? VM[id];
  }
  private cfg(): VmCfg {
    return this.cfgOf(this.cur);
  }

  private node(names: string[]): THREE.Object3D | null {
    const key = this.cur + ':' + names.join(',');
    if (this.nodes.has(key)) return this.nodes.get(key)!;
    let found: THREE.Object3D | null = null;
    const g = this.weapons.get(this.cur);
    if (g)
      for (const n of names) {
        const o = g.getObjectByName(n);
        if (o) {
          found = o;
          break;
        }
      }
    this.nodes.set(key, found);
    return found;
  }

  /** Coice da arma ao atirar (`power`: 0,4 pistola, 1 fuzil, 2,4 sniper) e clarão. */
  fireFx(power: number) {
    this.kickVel += 2.2 * power;
    this.kickRotVel += 7 * power;
    this.flashT = 0.045;
    if (this.cur === 'sniper' || this.cur === 'shotgun') this.boltK = -0.3;
  }
  /** Corte (botão de atirar) ou estocada (botão de mirar) com a faca. */
  knifeSwing(kind: 'slash' | 'stab' | 'backstab') {
    if (kind === 'backstab') {
      this.knifeAnim = { keys: KNIFE_BACKSTAB, t: 0, dur: 0.7, inspect: false };
      this.kickVel += 5;
      return;
    }
    if (kind === 'slash') {
      // cortes alternados (direita para esquerda e volta), com um risco branco que some e um tranco na câmera da arma
      this.slashParity = !this.slashParity;
      this.knifeAnim = { keys: this.slashParity ? KNIFE_SLASH : KNIFE_SLASH_B, t: 0, dur: 0.3, inspect: false };
      this.kickRotVel += this.slashParity ? 4 : -4;
    } else {
      this.knifeAnim = { keys: KNIFE_STAB, t: 0, dur: 0.45, inspect: false };
      this.kickVel += 3.2;
    }
  }
  /** Inspeção da arma na mão (F): olha de um lado, do outro e volta. */
  gunInspect(on: boolean, seconds = 3) {
    this.inspK = on ? 0 : -1;
    this.inspDur = seconds;
  }
  /** Só para conferir o visual: congela a animação num ponto (0 a 1). */
  debugKnife(kind: 'slash' | 'stab' | 'inspect' | null, u = 0) {
    if (!kind) {
      this.knifeAnim = null;
      return;
    }
    const keys = kind === 'slash' ? KNIFE_SLASH : kind === 'stab' ? KNIFE_STAB : KNIFE_INSPECT;
    this.knifeAnim = { keys, t: u * 4.8, dur: 4.8, inspect: false, freeze: true };
  }
  /** Inspeção da faca (tecla F): levanta, gira e mostra a lâmina. */
  knifeInspect(on: boolean, seconds = 4) {
    if (on) this.knifeAnim = { keys: KNIFE_INSPECT, t: 0, dur: seconds, inspect: true };
    else if (this.knifeAnim?.inspect) this.knifeAnim = null;
  }
  // ---- armas no chão (a página limita quantas existem)
  private drops = new Map<number, THREE.Object3D>();
  private dropSeq = 0;
  addDrop(id: FsWeaponId, x: number, z: number): number {
    const src = this.weapons.get(id)?.children[0];
    const h = ++this.dropSeq;
    if (!src || id === 'knife') return h;
    const o = src.clone();
    o.scale.setScalar(this.cfgOf(id).scale * 1.15);
    o.position.set(x, 0.12, z);
    o.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.scene.add(o);
    this.drops.set(h, o);
    return h;
  }
  /** Move uma arma no chão (em voo ou parada; parada ela balança de leve). */
  setDrop(h: number, x: number, y: number, z: number, landed: boolean) {
    const o = this.drops.get(h);
    if (!o) return;
    o.position.set(x, y, z);
    this.dropFloat.set(h, landed);
    if (!landed) o.rotation.x += 0.2;
    else o.rotation.x = 0;
  }
  // ---- bomba C4 do modo Bomba (spec 059): modelo do Lucas (c4.glb) com luz que pisca, teclado (ativando), alicate (desarmando) e luz vermelha
  private c4Tpl: THREE.Object3D | null = null;
  private bombRig: {
    g: THREE.Group;
    model: THREE.Object3D;
    led: THREE.Mesh;
    ring: THREE.Mesh;
    keys: THREE.Mesh[];
    keypad: THREE.Group;
    pliers: THREE.Group;
    blades: THREE.Mesh[];
    wires: THREE.Mesh[];
    light: THREE.PointLight;
  } | null = null;
  private bombDropObj: THREE.Group | null = null;
  // ---- C4 na mão (terrorista): aparece no lugar da arma; ao plantar a mão abaixa e treme
  private bombHand: THREE.Group | null = null;
  private bombHandK = 0;
  private bombHandOn = false;
  private bombHandPlant = 0;
  /** Põe a C4 na mão (some a arma) ou guarda; `plant` de 0 a 1 é o progresso do plantio. */
  setBombInHand(on: boolean, plant = 0) {
    this.bombHandOn = on;
    this.bombHandPlant = plant;
    if (on && !this.bombHand) {
      const g = new THREE.Group();
      const m = this.c4Model();
      m.traverse((o) => {
        (o as THREE.Mesh).frustumCulled = false;
      });
      m.scale.setScalar(0.3);
      m.rotation.set(0.0, Math.PI * 0.5, 0);
      g.add(m);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2e }));
      led.name = 'led';
      led.position.set(0.05, 0.13, 0.02);
      g.add(led);
      // duas patas segurando
      const fur = new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.8 });
      for (const sx of [-1, 1]) {
        const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), fur);
        paw.position.set(sx * 0.1, -0.03, 0.08);
        paw.rotation.set(Math.PI / 2.4, 0, sx * 0.4);
        g.add(paw);
      }
      g.position.set(0.1, -0.2, -0.42);
      g.rotation.set(0.35, -0.5, 0.05);
      this.vmCam.add(g);
      this.bombHand = g;
    }
  }
  private updateBombHand(dt: number) {
    const g = this.bombHand;
    const target = this.bombHandOn ? 1 : 0;
    this.bombHandK += Math.sign(target - this.bombHandK) * Math.min(Math.abs(target - this.bombHandK), dt * 4);
    this.vm.visible = this.bombHandK < 0.3;
    if (!g) return;
    g.visible = this.bombHandK > 0.02;
    const up = this.bombHandK * this.bombHandK * (3 - 2 * this.bombHandK);
    const p = this.bombHandPlant;
    g.position.set(0.06 + Math.sin(this.t * 38) * 0.004 * p, -0.15 - (1 - up) * 0.4 - p * 0.05, -0.46 + p * 0.05);
    const led = g.getObjectByName('led') as THREE.Mesh | undefined;
    if (led) (led.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(this.t * (p > 0 ? 20 : 4) * Math.PI) > 0 ? 0xff3b2e : 0x3a0a06);
  }
  private c4Model(): THREE.Object3D {
    if (this.c4Tpl) return this.c4Tpl.clone(true);
    // sem o arquivo: uma caixa com tijolos de C4
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a4d3a, roughness: 0.7 }));
    body.position.y = 0.06;
    g.add(body);
    return g;
  }
  private buildBombRig() {
    const g = new THREE.Group();
    const model = this.c4Model();
    model.traverse((o) => {
      (o as THREE.Mesh).frustumCulled = false;
    });
    g.add(model);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    led.position.set(0.05, 0.215, -0.18);
    g.add(led);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    g.add(ring);
    const keypad = new THREE.Group();
    keypad.position.set(0, 0.62, 0);
    const keys: THREE.Mesh[] = [];
    for (let k = 0; k < 12; k++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.012), new THREE.MeshBasicMaterial({ color: 0x1b2a1b }));
      cell.position.set(((k % 3) - 1) * 0.08, (1 - Math.floor(k / 3)) * 0.075 - 0.04, 0);
      keypad.add(cell);
      keys.push(cell);
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.01), new THREE.MeshBasicMaterial({ color: 0x0b0d14, transparent: true, opacity: 0.8 }));
    panel.position.z = -0.012;
    keypad.add(panel);
    g.add(keypad);
    const wires: THREE.Mesh[] = [];
    for (const [dx, c] of [[-0.05, 0xdd2222], [0.05, 0x2266dd]] as const) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), new THREE.MeshBasicMaterial({ color: c }));
      w.rotation.x = Math.PI / 2;
      w.position.set(dx, 0.235, 0.05);
      g.add(w);
      wires.push(w);
    }
    const pliers = new THREE.Group();
    pliers.position.set(0, 0.3, 0.05);
    const blades: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.8, roughness: 0.3 }));
      b.position.set(s * 0.012, 0, -0.06);
      b.rotation.y = s * 0.2;
      pliers.add(b);
      blades.push(b);
    }
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0xd22a2a, roughness: 0.6 }));
    grip.position.set(0, 0, -0.2);
    pliers.add(grip);
    g.add(pliers);
    const light = new THREE.PointLight(0xff2a1a, 0, 7, 2);
    light.position.set(0, 0.35, 0);
    g.add(light);
    g.visible = false;
    this.scene.add(g);
    this.bombRig = { g, model, led, ring, keys, keypad, pliers, blades, wires, light };
  }
  /**
   * A C4 no chão. `mode`: 'planting' (sendo ativada: sobe do chão, anel e teclado), 'armed' (ativa: luz pisca mais rápido perto do fim e
   * um brilho vermelho que todo mundo vê) e 'defusing' (alicate corta os fios e a luz vira verde). `progress` vai de 0 a 1.
   */
  setBomb(x: number, y: number, z: number, mode: 'off' | 'planting' | 'armed' | 'defusing', info: { left?: number; now?: number; progress?: number; yaw?: number } = {}) {
    if (mode === 'off') {
      if (this.bombRig) this.bombRig.g.visible = false;
      return;
    }
    if (!this.bombRig) this.buildBombRig();
    const r = this.bombRig!;
    const now = info.now ?? 0;
    const p = Math.max(0, Math.min(1, info.progress ?? 0));
    const left = info.left ?? 40;
    r.g.visible = true;
    r.g.position.set(x, y, z);
    if (info.yaw !== undefined) r.g.rotation.y = info.yaw;
    const ledMat = r.led.material as THREE.MeshBasicMaterial;
    r.ring.visible = mode === 'planting';
    r.keypad.visible = mode === 'planting';
    r.pliers.visible = mode === 'defusing';
    r.model.position.y = mode === 'planting' ? -0.14 * (1 - p) : 0;
    r.wires[0]!.visible = !(mode === 'defusing' && p > 0.45);
    r.wires[1]!.visible = !(mode === 'defusing' && p > 0.9);
    if (mode === 'planting') {
      // ativando: teclado acende um número por vez, anel se abre e a luz pisca rápido
      r.keys.forEach((k, i) => (k.material as THREE.MeshBasicMaterial).color.setHex(i < Math.floor(p * 12) ? 0x66ff66 : i === Math.floor(p * 12) ? 0xffe066 : 0x1b2a1b));
      const pulse = (now * 1.6) % 1;
      r.ring.scale.setScalar(0.6 + pulse * 0.9);
      (r.ring.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * 0.8;
      ledMat.color.setHex(Math.sin(now * 20 * Math.PI) > 0 ? 0xff9a2a : 0x301800);
      r.light.intensity = 0.6;
      r.light.color.setHex(0xff9a2a);
    } else if (mode === 'defusing') {
      // desarmando: o alicate chega, corta o fio vermelho e depois o azul; a luz vai do vermelho ao verde
      const wireX = p < 0.45 ? -0.05 : 0.05;
      const close = Math.abs(Math.sin(now * 9)) * 0.22;
      r.pliers.position.set(wireX, 0.3 - 0.05 * Math.min(1, p * 6), 0.05 + (1 - Math.min(1, p * 4)) * 0.1);
      r.blades.forEach((b, i) => (b.rotation.y = (i === 0 ? -1 : 1) * (0.2 - close)));
      ledMat.color.setRGB(1 - p, p, 0.1);
      r.light.intensity = 0.7;
      r.light.color.setRGB(1 - p, p * 0.9 + 0.1, 0.1);
    } else {
      const rate = left > 10 ? 1.2 : left > 5 ? 3 : 8;
      const on = Math.sin(now * rate * Math.PI * 2) > 0;
      ledMat.color.setHex(on ? 0xff2020 : 0x300000);
      // brilho vermelho que pulsa junto: todo mundo vê que a bomba está ativa
      r.light.color.setHex(0xff2a1a);
      r.light.intensity = on ? 2.2 : 0.2;
    }
  }
  /** A C4 largada no chão (antes de ser plantada): quieta, com a luz piscando devagar. */
  setBombDrop(x: number, y: number, z: number, visible: boolean, now = 0) {
    if (!this.bombDropObj) {
      const g = new THREE.Group();
      const m = this.c4Model();
      m.traverse((o) => {
        (o as THREE.Mesh).frustumCulled = false;
      });
      g.add(m);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb02a }));
      led.name = 'led';
      led.position.set(0.05, 0.215, -0.18);
      g.add(led);
      g.visible = false;
      this.scene.add(g);
      this.bombDropObj = g;
    }
    const g = this.bombDropObj;
    g.visible = visible;
    if (!visible) return;
    g.position.set(x, y, z);
    ((g.getObjectByName('led') as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(Math.sin(now * 3.2 * Math.PI) > 0 ? 0xffb02a : 0x402800);
  }
  private dropFloat = new Map<number, boolean>();
  removeDrop(h: number) {
    const o = this.drops.get(h);
    if (!o) return;
    this.scene.remove(o);
    this.drops.delete(h);
  }
  /** Só para conferir o visual: põe a recarga num ponto (0 a 1) ou desliga (null). */
  debugReload(u: number | null) {
    this.reloadK = u ?? -1;
  }
  /** Só para conferir: posição e giro da arma na tela (para achar tremedeira). */
  debugVm() {
    return [this.vm.position.x, this.vm.position.y, this.vm.position.z, this.vm.rotation.x, this.vm.rotation.y, this.vm.rotation.z, this.cam.fov];
  }
  // ---- granadas
  /** Põe a granada na mão (null = volta a mostrar a arma). */
  selectNade(kind: FsGrenadeId | null) {
    for (const k of ['frag', 'flash'] as const) if (this.nadeHand[k]) this.nadeHand[k]!.visible = false;
    if (!kind) {
      this.nade = null;
      return;
    }
    for (const g of this.weapons.values()) g.visible = false;
    this.knifeObj.visible = false;
    this.nade = { kind, phase: 'idle', t: 0, charge: 0, style: 'far' };
    this.drawK = 0;
    this.knifeAnim = null;
    this.inspK = -1;
  }
  /** Tirou o pino (a outra mão puxa). */
  nadePin() {
    if (this.nade) {
      this.nade.phase = 'pin';
      this.nade.t = 0;
    }
  }
  /** Segurando o botão: o braço vai para trás conforme a força (0 a 1,2). */
  nadeCharge(c: number) {
    if (this.nade) this.nade.charge = c;
  }
  nadeThrow(style: 'far' | 'mid' | 'near' = 'far') {
    if (this.nade) {
      this.nade.style = style;
      this.nade.phase = 'throw';
      this.nade.t = 0;
    }
  }
  /** Uma granada voando (modelo no mundo); devolve o número para mover e remover. */
  addGrenade(kind: FsGrenadeId): number {
    const h = ++this.nadeSeq;
    const tpl = this.nadeTpl[kind];
    if (!tpl) return h;
    const o = tpl.clone(true);
    o.traverse((c) => {
      (c as THREE.Mesh).castShadow = true;
    });
    this.scene.add(o);
    this.nadeWorld.set(h, o);
    return h;
  }
  setGrenade(h: number, x: number, y: number, z: number, spin: number) {
    const o = this.nadeWorld.get(h);
    if (!o) return;
    o.position.set(x, y, z);
    o.rotation.set(spin * 1.7, spin * 0.6, spin);
  }
  removeGrenade(h: number) {
    const o = this.nadeWorld.get(h);
    if (!o) return;
    this.scene.remove(o);
    this.nadeWorld.delete(h);
  }
  /** Explosão: bola de fogo, fumaça, faíscas e um clarão de luz (a de luz é um clarão branco enorme). */
  explosion(kind: FsGrenadeId, x: number, y: number, z: number) {
    const at = new THREE.Vector3(x, y, z);
    if (kind === 'flash') {
      this.puff(at, 0xffffff, 9, 0.3);
      this.puff(at, 0xfff6d0, 5, 0.5);
      for (let i = 0; i < 8; i++) this.puff(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2, (Math.random() - 0.5) * 2)), 0xffffff, 1.2, 0.35);
      this.flashLight(0xffffff, 80, 0.5, at);
      return;
    }
    this.puff(at, 0xff9a2a, 4.2, 0.4);
    this.puff(at.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffe08a, 2.6, 0.25);
    for (let i = 0; i < 7; i++) {
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.3 + Math.random() * 1.8, (Math.random() - 0.5) * 2.4));
      this.puff(p, i % 2 ? 0x55504a : 0x3c3935, 2.2 + Math.random() * 2.2, 1.1 + Math.random() * 0.6);
    }
    for (let i = 0; i < 12; i++) {
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.2, Math.random() * 2, (Math.random() - 0.5) * 3.2));
      this.puff(p, 0xffc060, 0.35, 0.45);
    }
    this.flashLight(0xff9a40, 60, 0.4, at);
  }
  private flashLight(color: number, peak: number, dur: number, at: THREE.Vector3) {
    if (!this.blast) {
      this.blast = new THREE.PointLight(0xffffff, 0, 40, 1.6);
      this.scene.add(this.blast);
    }
    this.blast.color.setHex(color);
    this.blast.position.copy(at).add(new THREE.Vector3(0, 0.8, 0));
    this.blastPeak = peak;
    this.blastDur = dur;
    this.blastT = dur;
  }
  startReload() {
    this.reloadK = 0;
  }
  setReloadProgress(p: number) {
    this.reloadK = p;
  }
  endReload() {
    this.reloadK = -1;
  }

  /** Posição da boca no mundo (para o rastro sair da arma). */
  muzzleWorld(): THREE.Vector3 {
    const m = this.muzzle.get(this.cur) ?? new THREE.Vector3(0.5, 0, 0);
    const g = this.weapons.get(this.cur);
    if (!g) return this.cam.position.clone();
    this.vmCam.updateMatrixWorld(true);
    const v = m.clone().applyMatrix4(g.matrixWorld);
    // a câmera da arma e a principal olham para o mesmo lado: o que está no espaço de uma vale no da outra
    return this.cam.localToWorld(v);
  }

  private updateViewmodel(
    dt: number,
    p: { speed: number; ads: boolean; adsTarget: number; airborne: boolean },
  ) {
    this.t += dt;
    const cfg = this.cfg();
    this.adsK += (p.adsTarget - this.adsK) * Math.min(1, dt * 14);
    if (this.drawK < 1) this.drawK = Math.min(1, this.drawK + dt * 2.2);
    // molas do coice
    const kz = 180,
      kd = 18;
    // mola em passos pequenos e fixos: com um passo só por quadro (até 50 ms) ela oscilava e a arma "flicava" nos quadros lentos
    for (let rem = dt; rem > 1e-6; ) {
      const h = Math.min(rem, 1 / 240);
      this.kickVel += (-kz * this.kickZ - kd * this.kickVel) * h;
      this.kickZ += this.kickVel * h;
      this.kickRotVel += (-kz * this.kickRot - kd * this.kickRotVel) * h;
      this.kickRot += this.kickRotVel * h;
      rem -= h;
    }
    const moving = Math.min(1, p.speed / 5);
    this.bob += dt * (4 + moving * 7);
    const sway = 1 - this.adsK * 0.85;
    const bx = Math.sin(this.bob) * 0.006 * moving * sway;
    const by =
      Math.abs(Math.cos(this.bob)) * 0.008 * moving * sway + Math.sin(this.t * 1.3) * 0.0016 * sway;
    const x = cfg.hip[0] + (cfg.ads[0] - cfg.hip[0]) * this.adsK + bx;
    const y =
      cfg.hip[1] +
      (cfg.ads[1] - cfg.hip[1]) * this.adsK +
      by -
      (1 - this.drawK) * 0.45 -
      (p.airborne ? 0.01 : 0);
    const z = cfg.hip[2] + (cfg.ads[2] - cfg.hip[2]) * this.adsK + this.kickZ * 0.04;
    this.vm.position.set(x, y, z);
    let pitch = this.kickRot * 0.02 - (1 - this.drawK) * 0.7;
    let roll = 0;
    let yawAdd = 0;
    // recarga em fases (ver updateHands): a arma só gira um pouco para mostrar o carregador; o carregador de verdade é animado lá
    const mag = this.node(cfg.mag);
    const slide = this.node(cfg.slide);
    if (this.reloadK >= 0) {
      const r = Math.min(1, this.reloadK);
      const tilt = Math.min(1, r / 0.1) * (r > 0.75 ? Math.max(0, 1 - (r - 0.75) / 0.2) : 1);
      pitch += tilt * 0.22;
      roll += tilt * 0.55;
      yawAdd += tilt * 0.22;
      this.vm.position.x -= tilt * 0.14;
      this.vm.position.y += tilt * 0.1;
      if (r > 0.68 && r < 0.74) pitch += Math.sin(((r - 0.68) / 0.06) * Math.PI) * 0.05;
    } else if (mag) mag.visible = true;
    // inspeção: olha a arma de um lado, do outro e volta
    if (this.inspK >= 0) {
      this.inspK += dt / this.inspDur;
      const u = this.inspK;
      if (u >= 1) this.inspK = -1;
      else {
        const e = (x: number) => x * x * (3 - 2 * x);
        const up = e(Math.min(1, u / 0.15)) * (1 - e(Math.max(0, (u - 0.85) / 0.15)));
        const side = u < 0.15 ? 0 : u < 0.45 ? e((u - 0.15) / 0.3) : u < 0.55 ? 1 : u < 0.85 ? 1 - 2 * e((u - 0.55) / 0.3) : -1 + e((u - 0.85) / 0.15);
        // a arma gira pouco e fica perto das mãos (girar muito esticava os braços e aparecia uma "terceira mão")
        yawAdd += side * 0.5;
        roll += side * 0.14 + up * 0.05;
        pitch += up * 0.1;
      }
    }
    // pistola: o ferrolho volta no tiro; sniper: o ferrolho (alavanca) trabalha depois do tiro
    if (slide) slide.position.x = -Math.max(0, this.kickZ) * 0.05;
    const bolt = this.node(cfg.bolt);
    let phase = 0;
    if (this.boltK > -0.5) {
      this.boltK += dt;
      const bk = this.boltK;
      phase = bk < 0 ? 0 : bk < 0.35 ? bk / 0.35 : bk < 0.7 ? 1 - (bk - 0.35) / 0.35 : 0;
      roll += phase * 0.12;
      if (bk > 0.7) this.boltK = -1;
    }
    // recarga: no fim, o ferrolho/ferrolho de carregar é puxado (fuzil e sniper) ou a trava da pistola é solta
    if (this.reloadK >= 0) {
      const r = this.reloadK;
      if (slide) {
        const sp = r > 0.74 && r < 0.84 ? Math.sin(((r - 0.74) / 0.1) * Math.PI) : 0;
        slide.position.x = -sp * 0.05;
        phase = Math.max(phase, sp);
      } else {
        const sp = r > 0.78 && r < 0.9 ? Math.sin(((r - 0.78) / 0.12) * Math.PI) : 0;
        phase = Math.max(phase, sp);
      }
    }
    this.boltPhase = phase;
    if (bolt) bolt.position.x = -phase * (this.cur === 'sniper' ? 0.1 : this.cur === 'shotgun' ? 0.13 : 0.05);
    // risco do corte: aparece junto com o golpe e some em 0,16 s
    if (this.arcT > 0) {
      this.arcT += dt;
      const u = this.arcT / 0.16;
      this.arc.visible = u < 1 && this.cur === 'knife';
      (this.arc.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - u));
      if (u >= 1) this.arcT = 0;
    } else this.arc.visible = false;
    this.vm.rotation.set(pitch, yawAdd, roll);
    this.updateHands(dt, cfg, mag, bolt);
    this.vmPivot.rotation.set(0, 0, 0);
    // clarão
    if (this.flashT > 0) {
      this.flashT -= dt;
      const m = this.muzzle.get(this.cur) ?? new THREE.Vector3(0.5, 0, 0);
      const s =
        ({ sniper: 0.5, pistol: 0.12, shotgun: 0.6, smg: 0.22, usp: 0.03, m4: 0.3, ak: 0.32, knife: 0 } as Record<FsWeaponId, number>)[this.cur] *
        (0.75 + Math.random() * 0.5);
      this.flash.scale.setScalar(s);
      const g = this.weapons.get(this.cur)!;
      const world = m
        .clone()
        .multiplyScalar(this.cfg().scale)
        .applyEuler(new THREE.Euler(0, Math.PI / 2, 0))
        .add(g.position);
      this.flash.position.copy(world);
      this.flash.visible = this.cur !== 'pistol' || true;
      (this.flash.material as THREE.SpriteMaterial).opacity =
        Math.max(0, this.flashT / 0.045) * 0.95 + 0.05;
      if (this.adsK > 0.9 && this.cur === 'sniper') this.flash.visible = false;
    } else this.flash.visible = false;
  }

  private readonly hv = {
    r: new THREE.Vector3(),
    l: new THREE.Vector3(),
    ra: new THREE.Vector3(),
    la: new THREE.Vector3(),
    m: new THREE.Vector3(),
  };

  /** Clona o carregador para um objeto solto (cai, fica na mão) no espaço da arma na câmera. */
  private cloneMag(mag: THREE.Object3D): THREE.Object3D {
    const o = mag.clone(true);
    o.visible = true;
    o.traverse((c) => {
      (c as THREE.Mesh).frustumCulled = false;
    });
    this.vm.add(o);
    return o;
  }

  private static smooth(x: number) {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  }

  /**
   * Recarga em fases, no desenho das animações de referência (AUG, G3, Desert Eagle): a mão da frente vai ao carregador, ele sai
   * e cai, a mão vai buscar outro (atrás e embaixo), traz, encaixa com um empurrão, puxa o ferrolho (ou solta a trava) e volta ao
   * apoio. O carregador velho cai de verdade (some em meio segundo) e o novo vem na mão.
   */
  private reloadHands(
    h: { r: THREE.Vector3; l: THREE.Vector3; m: THREE.Vector3 },
    mag: THREE.Object3D | null,
    bolt: THREE.Object3D | null,
  ) {
    const r = this.reloadK;
    if (r >= 0 && !mag) {
      // sem carregador separado (escopeta e a USP-S): a mão da frente vai ao ponto de carga, enfia os cartuchos (vai e volta várias
      // vezes na escopeta) e no fim bombeia (escopeta) ou volta ao apoio
      const E2 = FoxShotScene.smooth;
      const F = h.l.clone();
      const port = h.r.clone().add(new THREE.Vector3(0.05, -0.11, -0.02));
      const dn = new THREE.Vector3(0, -0.05, 0.02);
      let C = F.clone();
      const cn = bolt ?? this.node(this.cfg().slide);
      if (cn) {
        cn.getWorldPosition(h.m);
        C = this.vm.worldToLocal(h.m.clone());
      }
      const loops = this.cur === 'shotgun' ? 4 : 1;
      const keys: [number, THREE.Vector3][] = [[0, F], [0.12, port]];
      for (let i = 0; i < loops; i++) {
        const t0 = 0.12 + (0.62 * (i + 0.5)) / loops;
        keys.push([t0, port.clone().add(dn)], [Math.min(0.74, t0 + 0.62 / (loops * 2)), port]);
      }
      keys.push([0.8, C], [0.9, C], [1, F]);
      keys.sort((a2, b2) => a2[0] - b2[0]);
      let k = 0;
      while (k < keys.length - 2 && r > keys[k + 1]![0]) k++;
      const [ta, va] = keys[k]!;
      const [tb, vb] = keys[k + 1]!;
      h.l.lerpVectors(va, vb, E2((r - ta) / Math.max(1e-6, tb - ta)));
      return;
    }
    if (r < 0 || !mag) {
      if (this.heldMag) this.heldMag.visible = false;
      if (this.fallMag && this.fallMag.t > 0.6) this.fallMag.o.visible = false;
      this.magDropped = false;
      return;
    }
    const E = FoxShotScene.smooth;
    // onde o carregador fica na arma (espaço da câmera) e como está virado
    const rel = new THREE.Matrix4().copy(this.vm.matrixWorld).invert().multiply(mag.matrixWorld);
    const p0 = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    rel.decompose(p0, q0, sc);
    const F = h.l.clone();
    const Mw = p0.clone();
    const pouch = p0.clone().add(new THREE.Vector3(-0.1, -0.24, 0.12));
    let C = F.clone();
    const cn = bolt ?? this.node(this.cfg().slide);
    if (cn) {
      cn.getWorldPosition(h.m);
      C = this.vm.worldToLocal(h.m.clone());
    }
    // chaves da mão da frente: [fração da recarga, alvo]
    const keys: [number, THREE.Vector3][] = [
      [0, F],
      [0.12, Mw],
      [0.22, Mw.clone().add(new THREE.Vector3(0, -0.07, 0))],
      [0.36, pouch],
      [0.5, pouch],
      [0.6, Mw.clone().add(new THREE.Vector3(0, -0.14, 0.02))],
      [0.7, Mw],
      [0.76, Mw],
      [0.82, C],
      [0.88, C],
      [1, F],
    ];
    let i = 0;
    while (i < keys.length - 2 && r > keys[i + 1]![0]) i++;
    const [t0, a0] = keys[i]!;
    const [t1, a1] = keys[i + 1]!;
    h.l.lerpVectors(a0, a1, E((r - t0) / Math.max(1e-6, t1 - t0)));

    // o carregador: segue a mão até soltar (cai), some da arma até o novo ser encaixado
    if (r >= 0.2 && !this.magDropped) {
      this.magDropped = true;
      if (this.fallMag) this.vm.remove(this.fallMag.o);
      const o = this.cloneMag(mag);
      o.position.copy(p0);
      o.quaternion.copy(q0);
      o.scale.copy(sc);
      this.fallMag = { o, v: new THREE.Vector3(0.05, -0.25, 0.15), w: new THREE.Vector3(2.2, 0.8, 1.4), t: 0 };
    }
    mag.visible = r < 0.2 || r >= 0.7;
    if (r < 0.2 && r > 0.12) {
      // o carregador sai junto com a mão (puxado para baixo)
      mag.position.y = -E((r - 0.12) / 0.08) * 0.06;
    } else mag.position.y = 0;
    const f = this.fallMag;
    if (f) {
      if (r >= 0.2 && f.t < 0.9) {
        f.t += 1 / 60;
        f.v.y -= 2.8 * (1 / 60);
        f.o.position.addScaledVector(f.v, 1 / 60);
        f.o.rotation.x += f.w.x * (1 / 60);
        f.o.rotation.y += f.w.y * (1 / 60);
        f.o.rotation.z += f.w.z * (1 / 60);
      }
      f.o.visible = r >= 0.2 && f.t < 0.9;
    }
    // carregador novo: sai do bolso na mão e sobe até encaixar
    if (r >= 0.5 && r < 0.7) {
      if (!this.heldMag) this.heldMag = this.cloneMag(mag);
      const hm = this.heldMag;
      hm.scale.copy(sc);
      hm.visible = true;
      hm.position.copy(h.l).add(new THREE.Vector3(0, 0.03, 0));
      hm.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25 * (1 - E((r - 0.6) / 0.1)), 0, 0)));
    } else if (this.heldMag) this.heldMag.visible = false;

    // mão de trás: na sniper puxa o ferrolho no fim da recarga
    if (bolt && (this.cur === 'sniper' || this.cur === 'shotgun') && this.boltPhase > 0) {
      bolt.getWorldPosition(h.m);
      this.vm.worldToLocal(h.m);
      h.r.lerp(h.m, Math.min(1, this.boltPhase * 3));
    }
  }

  /** Põe as patas no lugar: na faca, seguindo a pose da animação; nas armas, no cabo e na mão da frente (a esquerda vai ao carregador na recarga). */
  private updateHands(dt: number, cfg: VmCfg, mag: THREE.Object3D | null, bolt: THREE.Object3D | null) {
    const h = this.hv;
    const fwd = new THREE.Vector3(0, 0, -0.2);
    if (this.nade) {
      const n = this.nade;
      n.t += dt;
      const E = FoxShotScene.smooth;
      const hold = new THREE.Vector3(0.17, -0.17, -0.36);
      const left = new THREE.Vector3(-0.17, -0.2, -0.38);
      const c = Math.min(1, n.charge);
      h.r.copy(hold);
      h.l.copy(left);
      let rot = new THREE.Euler(0.3, 0.2, 0.1);
      let show = true;
      if (n.phase === 'pin') {
        // a mão esquerda sobe até o pino, puxa e se afasta
        const u = Math.min(1, n.t / 0.32);
        const top = new THREE.Vector3(0.13, -0.09, -0.34);
        const away = new THREE.Vector3(-0.14, -0.15, -0.3);
        h.l.lerpVectors(left, top, E(Math.min(1, u * 2)));
        if (u > 0.5) h.l.lerpVectors(top, away, E((u - 0.5) * 2));
        if (n.t >= 0.32) n.phase = 'charge';
      }
      if (n.phase === 'charge' || (n.phase === 'pin' && n.t >= 0.32)) {
        // direito (perto): a mão desce e vai um pouco para trás por baixo; esquerdo (longe): o braço sobe e vai para trás
        if (n.style === 'near' || (c < 0.3 && c > 0)) h.r.add(new THREE.Vector3(0.02, -0.08, 0.06));
        else h.r.add(new THREE.Vector3(0.05 * c, 0.05 * c, 0.15 * c));
        rot = new THREE.Euler(0.3 + 0.5 * c, 0.2, 0.1 + 0.3 * c);
        h.l.lerp(left.clone().add(new THREE.Vector3(-0.03, -0.04, 0.04)), 0.5);
      }
      if (n.phase === 'throw') {
        const near = n.style === 'near';
        const u = Math.min(1, n.t / (near ? 0.34 : 0.38));
        // esquerdo: por cima, braço lá atrás e chicote para a frente; direito: por baixo, um empurrão curto e baixo
        const back = near ? new THREE.Vector3(0.14, -0.3, -0.24) : hold.clone().add(new THREE.Vector3(0.05 * c, 0.05 * c, 0.15 * c));
        const fwdPos = near ? new THREE.Vector3(0.1, -0.2, -0.56) : new THREE.Vector3(0.04, -0.12, -0.66);
        const rest = near ? new THREE.Vector3(0.12, -0.3, -0.42) : new THREE.Vector3(0.1, -0.24, -0.46);
        if (u < 0.45) h.r.lerpVectors(back, fwdPos, 1 - (1 - u / 0.45) ** 3);
        else h.r.lerpVectors(fwdPos, rest, E((u - 0.45) / 0.55));
        rot = near ? new THREE.Euler(0.2, 0.1, 0) : new THREE.Euler(0.2 - 0.8 * Math.min(1, u * 2), 0.1, 0);
        show = u < 0.42; // a granada sai da mão no meio do arremesso
        h.l.lerp(left, 0.6);
      }
      const hand = this.nadeHand[n.kind];
      if (hand) {
        hand.visible = show;
        hand.position.copy(h.r).add(new THREE.Vector3(0, 0.025, 0));
        hand.rotation.copy(rot);
      }
      h.ra.copy(h.r).add(fwd);
      h.la.copy(h.l).add(fwd);
      this.hands.setLeftVisible(true);
      this.hands.set(h.r, h.ra, h.l, h.la);
      return;
    }
    if (this.cur === 'knife') {
      this.hands.setLeftVisible(true);
      this.knifeObj.visible = true;
      let pose: KnifeKey = { t: 0, p: KNIFE_HOLD.p, r: KNIFE_HOLD.r, l: KNIFE_HOLD.l };
      const a = this.knifeAnim;
      if (a) {
        if (!a.freeze) a.t += dt;
        const u = a.t / a.dur;
        if (u >= 1) this.knifeAnim = null;
        else pose = sampleKnife(a.keys, u);
      }
      // um respiro leve quando parado
      const br = Math.sin(this.t * 1.4) * 0.004;
      h.r.set(pose.p[0], pose.p[1] + br, pose.p[2]);
      h.l.set(pose.l[0], pose.l[1] + br, pose.l[2]);
      this.knifeObj.position.copy(h.r);
      this.knifeObj.rotation.set(pose.r[0], pose.r[1], pose.r[2], 'YXZ');
      h.ra.copy(h.r).add(fwd);
      h.la.copy(h.l).add(fwd);
      // a pata direita acompanha o giro da faca
      h.ra.copy(h.r).add(new THREE.Vector3(0, 0, -0.2).applyEuler(this.knifeObj.rotation));
      this.hands.set(h.r, h.ra, h.l, h.la);
      return;
    }
    this.knifeObj.visible = false;
    const g = this.weapons.get(this.cur);
    const grip = this.grips.get(this.cur);
    if (!g || !grip) return;
    this.vm.updateMatrixWorld(true);
    const toVm = (p: THREE.Vector3, out: THREE.Vector3) => out.copy(this.vm.worldToLocal(g.localToWorld(p.clone())));
    toVm(grip.r, h.r);
    toVm(grip.l, h.l);
    // pistola: uma mão só no cabo; a outra fica fora da tela e só entra para recarregar
    const oneHand = this.cur === 'pistol' || this.cur === 'usp';
    if (oneHand) h.l.set(-0.28, -0.5, -0.12);
    this.hands.setLeftVisible(!oneHand || this.reloadK >= 0);
    this.reloadHands(h, mag, bolt);
    h.ra.copy(h.r).add(fwd);
    h.la.copy(h.l).add(fwd);
    this.hands.set(h.r, h.ra, h.l, h.la);
    void cfg;
  }

  // ---- alvos
  hitTarget(id: string) {
    const f = this.foxes.get(id);
    if (!f?.actions.hit) return;
    f.actions.hit.reset().play();
    f.hitT = 0.4;
  }
  /**
   * Morte: a raposa fica mole e desaba. Tiro vindo de frente: cai de costas (para longe de quem atirou); vindo de trás: de
   * bruços. Escorrega um pouco com o impulso da bala e fica no chão (sem colisão) até sumir.
   */
  killTarget(id: string, fromX: number, fromZ: number, power: number) {
    const f = this.foxes.get(id);
    if (!f) return;
    f.dead = true;
    for (const a of Object.values(f.actions)) a.stop();
    f.root.position.y = 0;
    // a queda segue a direção da bala (de quem atirou para o alvo): de costas (a raposa de frente para o tiro) ou de bruços
    // (de costas para o tiro), o que exigir menos giro; o corpo gira rápido para alinhar antes de desabar
    let dx = f.root.position.x - fromX;
    let dz = f.root.position.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const cur = f.root.rotation.y;
    const thBack = Math.atan2(dz, -dx); // frente = contra o tiro: cai de costas
    const thFront = Math.atan2(-dz, dx); // frente = a favor do tiro: cai de bruços
    const useBack = Math.abs(wrap(thBack - cur)) <= Math.abs(wrap(thFront - cur));
    const target = useBack ? thBack : thFront;
    f.turn = { from: cur, to: cur + wrap(target - cur), t: 0 };
    (useBack ? f.actions.death_back : f.actions.death_front)?.reset().setEffectiveWeight(1).play();
    f.vel.set(dx * power, 0, dz * power);
    f.label.visible = false;
  }
  /** Some de vez (sem animação) quando acaba o tempo do corpo no chão. */
  hideTarget(id: string) {
    const f = this.foxes.get(id);
    if (f) f.root.visible = false;
  }
  /** Põe um bot no lugar (posição, direção, altura) e troca a animação com transição suave. */
  setBot(id: string, x: number, y: number, z: number, heading: number, anim: string, speed: number) {
    const f = this.foxes.get(id);
    if (!f || f.dead) return;
    f.root.position.set(x, y, z);
    f.root.rotation.y = -heading;
    const key = anim;
    if (f.anim !== key) {
      const next = f.actions[anim];
      const prev = f.actions[f.anim];
      if (next) {
        if (anim === 'jump') next.reset().setEffectiveWeight(1).fadeIn(0.08).play();
        else next.reset().setEffectiveWeight(1).fadeIn(0.15).play();
      }
      prev?.fadeOut(0.15);
      f.anim = key;
    }
    const cur = f.actions[f.anim];
    if (cur) cur.setEffectiveTimeScale(speed);
  }
  /** Empurrão ao morrer: a raposa escorrega para longe do tiro e perde velocidade. */
  knock(id: string, dx: number, dz: number, power: number) {
    const f = this.foxes.get(id);
    if (!f) return;
    const l = Math.hypot(dx, dz) || 1;
    f.vel.set((dx / l) * power, 0, (dz / l) * power);
  }
  /** Afunda no chão (0 a 1) antes de sumir. */
  sinkTarget(id: string, k: number) {
    const f = this.foxes.get(id);
    if (f) f.root.position.y = -1.1 * k;
  }
  /** Agacha ou levanta a raposa-alvo (a animação `crouch` entra e sai suave). */
  setTargetCrouch(id: string, on: boolean) {
    const f = this.foxes.get(id);
    if (!f?.actions.crouch || !f.actions.idle) return;
    if (on) {
      f.actions.crouch.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      f.actions.idle.fadeOut(0.18);
    } else {
      f.actions.idle.reset().fadeIn(0.18).play();
      f.actions.crouch.fadeOut(0.18);
    }
  }
  reviveTarget(id: string) {
    const f = this.foxes.get(id);
    if (!f) return;
    f.dead = false;
    f.turn = null;
    f.root.visible = true;
    f.vel.set(0, 0, 0);
    f.root.position.copy(f.home);
    f.root.rotation.y = f.yaw0;
    for (const a of Object.values(f.actions)) a.stop();
    f.actions.idle?.reset().setEffectiveWeight(1).play();
    f.anim = 'idle';
    // o nome dos alvos agora está nas placas escuras do mapa de treino: a etiqueta branca em cima da cabeça ficava duplicada
    f.label.visible = false;
  }

  // ---- efeitos
  /** Rastro da bala: pistola fino e curto, fuzil médio, sniper grosso, longo e mais demorado. */
  tracer(from: THREE.Vector3, to: THREE.Vector3, weapon: FsWeaponId = 'ak') {
    const len = from.distanceTo(to);
    if (len < 1) return;
    const st = {
      pistol: { th: 0.007, tail: 2.5, min: 0.07, speed: 380, color: 0xffe7b0 },
      ak: { th: 0.014, tail: 4.5, min: 0.09, speed: 380, color: 0xffc866 },
      sniper: { th: 0.036, tail: 16, min: 0.2, speed: 300, color: 0xffa83a },
      knife: { th: 0.007, tail: 1, min: 0.05, speed: 380, color: 0xffffff },
      smg: { th: 0.011, tail: 3.5, min: 0.08, speed: 380, color: 0xffcf80 },
      shotgun: { th: 0.008, tail: 2.2, min: 0.07, speed: 340, color: 0xffd9a0 },
      m4: { th: 0.013, tail: 4.2, min: 0.09, speed: 380, color: 0xffc866 },
      usp: { th: 0.005, tail: 1.4, min: 0.06, speed: 400, color: 0xdde6ff },
    }[weapon];
    let tr = this.tracers.find((t) => t.t >= t.dur);
    if (!tr) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffd58a,
          transparent: true,
          opacity: 0.95,
          fog: false,
        }),
      );
      this.scene.add(m);
      tr = { m, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 0, th: 0.012, tail: 3 };
      this.tracers.push(tr);
    }
    tr.from.copy(from);
    tr.to.copy(to);
    tr.t = 0;
    tr.dur = Math.max(st.min, len / st.speed);
    tr.th = st.th;
    tr.tail = st.tail;
    (tr.m.material as THREE.MeshBasicMaterial).color.setHex(st.color);
    tr.m.visible = true;
  }

  puff(at: THREE.Vector3, color: number, size = 0.35, life = 0.35) {
    let p = this.puffs.find((q) => q.age >= q.life);
    if (!p) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false }),
      );
      this.scene.add(s);
      p = { s, age: 1, life: 1, grow: 1 };
      this.puffs.push(p);
    }
    p.age = 0;
    p.life = life;
    p.grow = size;
    p.s.position.copy(at);
    (p.s.material as THREE.SpriteMaterial).color.setHex(color);
    p.s.visible = true;
  }

  // ---- laço
  update(dt: number, p: { speed: number; adsTarget: number; airborne: boolean }) {
    // placas: aparecem com a distância (some aos poucos nos últimos 8 m)
    for (const sg of this.signSprites) {
      const d = sg.sprite.position.distanceTo(this.cam.position);
      const o = Math.max(0, Math.min(1, (sg.range - d) / 8));
      sg.sprite.visible = o > 0.02;
      (sg.sprite.material as THREE.SpriteMaterial).opacity = o;
    }
    for (const f of this.foxes.values()) {
      f.mixer.update(dt);
      if (f.turn) {
        f.turn.t = Math.min(1, f.turn.t + dt / 0.18);
        f.root.rotation.y = f.turn.from + (f.turn.to - f.turn.from) * f.turn.t;
        if (f.turn.t >= 1) f.turn = null;
      }
      if (f.dead && f.vel.lengthSq() > 1e-4) {
        f.root.position.addScaledVector(f.vel, dt);
        f.vel.multiplyScalar(Math.exp(-3.2 * dt));
      }
    }
    for (const t of this.tracers) {
      if (t.t >= t.dur) {
        t.m.visible = false;
        continue;
      }
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      const len = t.from.distanceTo(t.to);
      const head = t.from.clone().lerp(t.to, k);
      const tail = t.from.clone().lerp(t.to, Math.max(0, k - t.tail / len));
      t.m.position.copy(head).add(tail).multiplyScalar(0.5);
      t.m.scale.set(t.th, t.th, Math.max(0.05, head.distanceTo(tail)));
      t.m.lookAt(head);
    }
    for (const q of this.puffs) {
      if (q.age >= q.life) {
        q.s.visible = false;
        continue;
      }
      q.age += dt;
      const k = q.age / q.life;
      q.s.scale.setScalar(q.grow * (0.4 + k * 1.2));
      (q.s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.8;
    }
    if (this.blast && this.blastT > 0) {
      this.blastT = Math.max(0, this.blastT - dt);
      this.blast.intensity = (this.blastT / this.blastDur) ** 2 * this.blastPeak;
    }
    for (const [h, o] of this.drops) if (this.dropFloat.get(h) !== false) o.position.y = 0.14 + Math.sin(this.t * 2 + o.position.x) * 0.02;
    this.updateViewmodel(dt, { ...p, ads: p.adsTarget > 0.5 });
    this.updateBombHand(dt);
  }

  render() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
    // a arma em passe próprio (a profundidade zera para ela nunca atravessar parede)
    if (!this.hideViewmodel && (this.adsK < 0.97 || this.cur !== 'sniper')) {
      this.renderer.clearDepth();
      this.renderer.render(this.vmScene, this.vmCam);
    }
  }

  stats() {
    const i = this.renderer.info.render;
    return { tris: i.triangles, calls: i.calls };
  }

  dispose() {
    this.renderer.dispose();
  }
}
