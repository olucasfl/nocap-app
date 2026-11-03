import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FsHands, KNIFE_HOLD, KNIFE_INSPECT, KNIFE_SLASH, KNIFE_STAB, makeKnife, sampleKnife, type KnifeKey } from './FsHands';
import { FS_ARENA, FS_TARGETS, type FsBox, type FsWeaponId } from '@nocap/games';

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
    hip: [0.2, -0.2, -0.34],
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
  // a faca e as mãos são desenhadas em FsHands, já no espaço da câmera
  knife: { scale: 1, hip: [0, 0, 0], ads: [0, 0, 0], mag: [], bolt: [], slide: [], rotY: 0 },
};

/** Os modelos de referência têm outra origem (Glock no centro do ferrolho, L96 no centro da arma): posições à parte. */
const VM_REF: Partial<Record<FsWeaponId, VmCfg>> = {
  pistol: {
    scale: 1.0,
    hip: [0.14, -0.1, -0.34],
    ads: [0.0, -0.058, -0.28],
    mag: ['Magazine'],
    bolt: [],
    slide: ['Slide'],
  },
  sniper: {
    scale: 0.62,
    hip: [0.2, -0.13, -0.48],
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
  const mk = (map: THREE.Texture, rough: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ map, roughness: rough, metalness });
  return {
    wall: mk(wall, 0.92),
    crate: mk(crate, 0.85),
    wood: mk(wood, 0.8),
    metal: mk(metal, 0.5, 0.5),
    floorpad: mk(ground, 0.95),
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
}

/**
 * A cena do Fox Shot! (fase 0): arena, raposas-alvo com esqueleto e animação, arma na mão (cena e câmera à parte para a arma
 * não entrar nas paredes), clarão, rastro da bala e poeira de impacto. Qualidade em três níveis (sombra, resolução, alcance).
 */
export class FoxShotScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(75, 1, 0.05, 160);
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
  private drawK = 1;
  private reloadK = -1;
  private boltK = -1;
  private hands = new FsHands();
  private knifeObj = makeKnife();
  private knifeAnim: { keys: KnifeKey[]; t: number; dur: number; inspect: boolean; freeze?: boolean } | null = null;
  /** Onde as mãos seguram cada arma (no espaço do modelo da arma). */
  private grips = new Map<FsWeaponId, { r: THREE.Vector3; l: THREE.Vector3 }>();
  private view = { fov: 75 };
  usingRef = { ak: false, pistol: false, sniper: false, knife: false } as Record<FsWeaponId, boolean>;

  constructor(canvas: HTMLCanvasElement) {
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
    const mats = materials();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mats.ground);
    ground.rotation.x = -Math.PI / 2;
    (ground.material as THREE.MeshStandardMaterial).map!.repeat.set(14, 14);
    ground.receiveShadow = true;
    this.scene.add(ground);
    for (const b of FS_ARENA) {
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
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    for (const m of Object.values(mats)) if (m.map) m.map.repeat.set(1, 1);
    (mats.ground.map as THREE.Texture).repeat.set(14, 14);
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
    ]);
    const ids: FsWeaponId[] = ['ak', 'pistol', 'sniper'];
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
        pistol: [0.3, 0.5, 0.4, 0.32],
        sniper: [0.3, 0.3, 0.55, 0.4],
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
    // raposas-alvo
    for (const spec of FS_TARGETS) {
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
      root.position.set(spec.x, 0, spec.z);
      // olham para a posição de nascimento do jogador (0, 14)
      root.rotation.y = Math.atan2(-(14 - spec.z), 0 - spec.x);
      const mixer = new THREE.AnimationMixer(model);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of fox.g.animations) actions[clip.name] = mixer.clipAction(clip);
      actions.idle?.play();
      if (actions.idle) actions.idle.time = Math.random() * 2;
      for (const n of ['hit'])
        if (actions[n]) {
          actions[n]!.setLoop(THREE.LoopOnce, 1);
          actions[n]!.clampWhenFinished = false;
        }
      if (actions.death) {
        actions.death.setLoop(THREE.LoopOnce, 1);
        actions.death.clampWhenFinished = true;
      }
      const label = labelSprite(spec.label, spec.armor > 0 ? '#2f5bff' : '#c4571a');
      label.position.set(0, 1.85, 0);
      root.add(label);
      this.scene.add(root);
      this.foxes.set(spec.id, { root, mixer, actions, label, hitT: 0 });
    }
    this.selectWeapon('ak', true);
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

  setView(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov: number) {
    this.cam.position.set(x, y, z);
    this.cam.rotation.set((pitchDeg * Math.PI) / 180, (yawDeg * Math.PI) / 180, 0, 'YXZ');
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
    if (this.cur === 'sniper') this.boltK = -0.3;
  }
  /** Corte (botão de atirar) ou estocada (botão de mirar) com a faca. */
  knifeSwing(kind: 'slash' | 'stab') {
    this.knifeAnim = kind === 'slash' ? { keys: KNIFE_SLASH, t: 0, dur: 0.35, inspect: false } : { keys: KNIFE_STAB, t: 0, dur: 0.55, inspect: false };
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
  knifeInspect(on: boolean) {
    if (on) this.knifeAnim = { keys: KNIFE_INSPECT, t: 0, dur: 4.8, inspect: true };
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
  private dropFloat = new Map<number, boolean>();
  removeDrop(h: number) {
    const o = this.drops.get(h);
    if (!o) return;
    this.scene.remove(o);
    this.drops.delete(h);
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
    this.kickVel += (-kz * this.kickZ - kd * this.kickVel) * dt;
    this.kickZ += this.kickVel * dt;
    this.kickRotVel += (-kz * this.kickRot - kd * this.kickRotVel) * dt;
    this.kickRot += this.kickRotVel * dt;
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
    // recarga: a arma abaixa e inclina enquanto o carregador sai e volta
    const mag = this.node(cfg.mag);
    const slide = this.node(cfg.slide);
    if (this.reloadK >= 0) {
      const r = Math.min(1, this.reloadK);
      const dip = Math.sin(Math.min(1, r * 1.15) * Math.PI);
      pitch -= dip * 0.55;
      roll += dip * 0.28;
      this.vm.position.y -= dip * 0.07;
      if (mag) {
        const out = r < 0.25 ? r / 0.25 : r < 0.5 ? 1 : r < 0.7 ? 1 - (r - 0.5) / 0.2 : 0;
        mag.position.y = -out * 0.28;
      }
    } else if (mag) mag.position.y = 0;
    // pistola: o ferrolho volta no tiro; sniper: o ferrolho (alavanca) trabalha depois do tiro
    if (slide) slide.position.x = -Math.max(0, this.kickZ) * 0.05;
    const bolt = this.node(cfg.bolt);
    if (this.boltK > -0.5) {
      this.boltK += dt;
      const b = this.boltK;
      const phase = b < 0 ? 0 : b < 0.35 ? b / 0.35 : b < 0.7 ? 1 - (b - 0.35) / 0.35 : 0;
      if (bolt) bolt.position.x = -phase * 0.1;
      roll += phase * 0.12;
      if (b > 0.7) this.boltK = -1;
    } else if (bolt) bolt.position.x = 0;
    this.vm.rotation.set(pitch, 0, roll);
    this.updateHands(dt, cfg, mag, bolt);
    this.vmPivot.rotation.set(0, 0, 0);
    // clarão
    if (this.flashT > 0) {
      this.flashT -= dt;
      const m = this.muzzle.get(this.cur) ?? new THREE.Vector3(0.5, 0, 0);
      const s =
        (this.cur === 'sniper' ? 0.5 : this.cur === 'pistol' ? 0.12 : 0.32) *
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

  /** Põe as patas no lugar: na faca, seguindo a pose da animação; nas armas, no cabo e na mão da frente (a esquerda vai ao carregador na recarga). */
  private updateHands(dt: number, cfg: VmCfg, mag: THREE.Object3D | null, bolt: THREE.Object3D | null) {
    const h = this.hv;
    const fwd = new THREE.Vector3(0, 0, -0.2);
    if (this.cur === 'knife') {
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
    // recarga: a mão da frente vai ao carregador e o acompanha para fora e para dentro
    if (this.reloadK >= 0 && mag) {
      const r = Math.min(1, this.reloadK);
      const blend = r < 0.12 ? r / 0.12 : r < 0.78 ? 1 : Math.max(0, 1 - (r - 0.78) / 0.2);
      mag.getWorldPosition(h.m);
      this.vm.worldToLocal(h.m);
      h.m.y -= 0.045;
      h.l.lerp(h.m, blend);
    }
    // ferrolho da sniper: a mão de trás larga o cabo e puxa a alavanca
    if (bolt && this.boltK > -0.5 && this.cur === 'sniper') {
      const b = this.boltK;
      const ph = b < 0 ? 0 : b < 0.35 ? b / 0.35 : b < 0.7 ? 1 - (b - 0.35) / 0.35 : 0;
      bolt.getWorldPosition(h.m);
      this.vm.worldToLocal(h.m);
      h.r.lerp(h.m, Math.min(1, ph * 3));
    }
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
  killTarget(id: string) {
    const f = this.foxes.get(id);
    if (!f) return;
    f.actions.hit?.stop();
    f.actions.idle?.stop();
    f.actions.death?.reset().play();
    f.label.visible = false;
  }
  reviveTarget(id: string) {
    const f = this.foxes.get(id);
    if (!f) return;
    f.actions.death?.stop();
    f.actions.idle?.reset().play();
    f.label.visible = true;
  }

  // ---- efeitos
  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const len = from.distanceTo(to);
    if (len < 1) return;
    let tr = this.tracers.find((t) => t.t >= t.dur);
    if (!tr) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffd58a,
          transparent: true,
          opacity: 0.9,
          fog: false,
        }),
      );
      this.scene.add(m);
      tr = { m, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 0 };
      this.tracers.push(tr);
    }
    tr.from.copy(from);
    tr.to.copy(to);
    tr.t = 0;
    tr.dur = Math.max(0.05, len / 380);
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
    for (const f of this.foxes.values()) f.mixer.update(dt);
    for (const t of this.tracers) {
      if (t.t >= t.dur) {
        t.m.visible = false;
        continue;
      }
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      const len = t.from.distanceTo(t.to);
      const head = t.from.clone().lerp(t.to, k);
      const tail = t.from.clone().lerp(t.to, Math.max(0, k - 3 / len));
      t.m.position.copy(head).add(tail).multiplyScalar(0.5);
      t.m.scale.set(1, 1, Math.max(0.05, head.distanceTo(tail)));
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
    for (const [h, o] of this.drops) if (this.dropFloat.get(h) !== false) o.position.y = 0.14 + Math.sin(this.t * 2 + o.position.x) * 0.02;
    this.updateViewmodel(dt, { ...p, ads: p.adsTarget > 0.5 });
  }

  render() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
    // a arma em passe próprio (a profundidade zera para ela nunca atravessar parede)
    if (this.adsK < 0.97 || this.cur !== 'sniper') {
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
