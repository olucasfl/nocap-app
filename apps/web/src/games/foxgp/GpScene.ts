import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  GP_ARC_DRIFT_YAW,
  GP_ARC_HOP_H,
  GP_ARC_HOP_SEC,
  GP_CAR_LEN,
  GP_CAR_WID,
  GP_HALF_WIDTH,
  GP_MAX_PLAYERS,
  GP_KERB_W,
  GP_PIT_BOX_LEN,
  GP_PIT_HALF,
  gpVmaxOf,
  GP_STAND_LEN,
  GP_STAND_ROW0,
  GP_STAND_ROW_DEPTH,
  GP_STAND_ROW_STEP,
  GP_STAND_ROOF_FROM,
  GP_STAND_ROOF_TO,
  GP_GARAGE_LEN,
  GP_GARAGE_DEPTH,
  createRng,
  gpBoardSlots,
  gpGarageSlots,
  gpGridSpot,
  gpStandSlots,
  gpTowerSlots,
  type GpCar,
  type GpEvent,
  type GpWorld,
} from '@nocap/games';
import { mapEdge } from '../atravessa/models';
import { buildCar, type CarModel } from './car-model';
import { buildKart, kartReady, type KartModel } from './kart-model';

export type GpCamMode = 'far' | 'chase' | 'cockpit';
export type GpQuality = 'low' | 'medium' | 'high';
export interface GpPose {
  x: number;
  z: number;
  h: number;
}

/** Direção da câmera distante (a diagonal do Atravessa!): para trás, para a direita e para cima. */
const FAR_DIR = new THREE.Vector3(4.6, 9.4, 7.2).normalize();
const FAR_FOV = 24;
/**
 * O modelo do carro é o das prévias (garagem, lobby, pódio: ~3,6 m); na pista ele aparece neste tamanho (spec 081,
 * Fase 3), o da caixa de colisão do motor.
 */
const CAR_VIS = GP_CAR_LEN / 3.56;

const GRAVEL = 0xe6cf92;
const WATER = 0x2a7fd4;
const STAND = 0xf2c230;

/** Cores dos 3 níveis do turbo do kart (azul, laranja, rosa) e da faísca antes do 1º terço. */
const BOOST_COLORS = [0xfff1c8, 0x3aa0ff, 0xff8a1f, 0xff4fd8] as const;

interface CarView {
  id: string;
  m: CarModel;
  /** Kart: o ângulo do corpo no drift (suavizado) e a chama do escape do turbo. */
  driftYaw: number;
  flame: THREE.Mesh;
  /** Giro das rodas e abertura da asa (suavizada). */
  wheelA: number;
  flapA: number;
  shadow: boolean;
  tag: THREE.Sprite;
  ghost: boolean;
  wag: number;
  shake: number;
  /** Distância desde a última marca de pneu. */
  markAcc: number;
  lastX: number;
  lastZ: number;
}

interface Puff {
  s: THREE.Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  grow: number;
}

interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  color: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const side = (track: GpWorld['track'], i: number) => ({ x: -track.tz[i]!, z: track.tx[i]! });

/** Mapa de relevo de ruído (o grão do asfalto pega luz). */
function normalNoise(size = 256, seed = 'nn'): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const rng = createRng(seed);
  if (g) {
    const img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      img.data[i * 4] = 128 + (rng() - 0.5) * 60;
      img.data[i * 4 + 1] = 128 + (rng() - 0.5) * 60;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Textura desenhada por código (como a referência): repete, sRGB e anisotropia. */
function tex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  aniso = 8,
  nearest = false,
) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}
/** Granulado: pontinhos de cores parecidas (asfalto, grama). */
function speckle(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  n: number,
  cols: string[],
  rng: () => number,
  size = 2,
) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(rng() * cols.length)]!;
    g.globalAlpha = 0.2 + rng() * 0.5;
    g.fillRect(rng() * w, rng() * h, size * rng() + 0.6, size * rng() + 0.6);
  }
  g.globalAlpha = 1;
}
/** As marcas fictícias do NoCap nas placas da pista. */
const SPONSORS: [string, string, string, string][] = [
  ['FOX ENERGY', '#ff7d26', '#0b0e17', 'BEBIDA OFICIAL'],
  ['NOCAP', '#0b0e17', '#ff7d26', 'JOGOS'],
  ['TOCA TYRES', '#ffd23a', '#0b0e17', 'PNEUS'],
  ['FOX GP', '#2f5bff', '#ffffff', 'MARINA'],
  ['RABO LISO', '#f1ede4', '#2f5bff', 'OFICINA'],
  ['FAÍSCA', '#e5303a', '#ffffff', 'TELECOM'],
];

function labelTexture(
  text: string,
  fg: string,
  bg: string,
  w = 256,
  h = 64,
  font = 34,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (g) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `italic 900 ${font}px "Saira Condensed", Inter, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A cena 3D do Fox GP (specs 078 e 079). Só desenha: quem manda é o `GpWorld`; a posição de cada carro na tela vem de
 * `pose` (já interpolada entre os passos da simulação, sem tremer). Três câmeras com transição suave (todas em
 * perspectiva: a distante usa lente longa e mantém o visual isométrico), qualidade baixa, média ou alta (sombras,
 * pós-processamento, partículas), a pista da Marina com zebras, brita, barreiras, arquibancadas, marina, iluminação e
 * placas, o box com a equipe e o pórtico com as cinco luzes.
 */
export class GpScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FAR_FOV, 1, 2, 900);
  private composer: EffectComposer | null = null;
  private afterimage: AfterimagePass | null = null;
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private cars = new Map<string, CarView>();
  private lights: THREE.Mesh[] = [];
  private lightOn = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
  private lightOff = new THREE.MeshStandardMaterial({ color: 0x241c24, roughness: 0.6 });
  private textures: THREE.Texture[] = [];
  private size = { w: 0, h: 0 };
  private t = 0;
  private mode: GpCamMode = 'far';
  /** Transição de câmera: de onde saiu e quanto já andou (0 a 1). */
  private camFrom: { p: THREE.Vector3; q: THREE.Quaternion; fov: number } | null = null;
  private camMix = 1;
  private camPos = new THREE.Vector3(0, 80, 60);
  private camLook = new THREE.Vector3();
  private lead = new THREE.Vector3();
  private chasePos = new THREE.Vector3();
  private chaseWant = new THREE.Vector3();
  private sparkColor = new THREE.Color();
  /** Tremida da tela no turbo e na zebra do kart (opção do menu Comandos; desligada com movimento reduzido). */
  shakeOn = true;
  /** Tremida da câmera de agora (some sozinha) e o campo de visão extra do turbo (suavizado). */
  private camShake = 0;
  private boostFov = 0;
  private chaseInit = false;
  private farDist = 82;
  /** Objetos do cockpit (volante e bordas): só aparecem na câmera de dentro do carro. */
  private cockpit: THREE.Group;
  private cockpitWheel: THREE.Group;
  private cockpitGear: {
    tex: THREE.CanvasTexture;
    ctx: CanvasRenderingContext2D | null;
    last: string;
  };
  private puffs: Puff[] = [];
  private puffTex: THREE.Texture;
  private sparks: Spark[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private marks: THREE.InstancedMesh;
  private markCap: number;
  private markNext = 0;
  private crew: { g: THREE.Group; home: THREE.Vector3; to: THREE.Vector3; gun: THREE.Object3D }[] =
    [];
  private boxSpot: { x: number; z: number; h: number } = { x: 0, z: 0, h: 0 };
  private quality: GpQuality;
  private reduced: boolean;
  private meId: string;
  private envTex: THREE.Texture | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private world: GpWorld,
    meId: string,
    opts: { reduced?: boolean; quality?: GpQuality } = {},
  ) {
    this.meId = meId;
    this.reduced = !!opts.reduced;
    this.quality = opts.quality ?? 'medium';
    const q = this.quality;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q === 'medium',
      alpha: false,
      powerPreference: 'high-performance',
    });
    const maxRatio = q === 'low' ? 1 : q === 'medium' ? (touch ? 1.5 : 1.75) : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // tone mapping neutro (referência): cores da pintura sem puxar para o laranja
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x9fc8ea);
    this.scene.fog = new THREE.Fog(0xbfd0e0, 260, 1500);
    this.buildSky();
    // o escurecimento lateral é do Atravessa e vale para os materiais das raposas: aqui é tudo sol
    mapEdge.uEdge.value = 1e6;
    // sol com sombra suave (a caixa da sombra segue o carro em foco) e céu/chão de ambiente
    this.sun.color.setHex(0xfff0dc);
    this.sun.intensity = 2.7;
    this.sun.position.set(-40, 80, 30);
    this.sun.castShadow = q !== 'low';
    const sm = q === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0xdfeaff, 0x4f6d3c, q === 'low' ? 1.3 : 0.6));

    this.puffTex = this.makePuffTexture();
    this.buildGround();
    this.buildTrack();
    if (world.track.pit) this.buildPit();
    this.buildGantry();
    this.buildBarriers();
    this.buildScenery();
    const tr = world.track;
    if (tr.pit) {
      this.boxSpot = tr.pointAt(tr.pit.box, tr.pitCenter(tr.pit.box) ?? 0);
      this.buildCrew();
    }
    // marcas de pneu e faíscas (malhas instanciadas: uma chamada de desenho cada)
    const markGeo = new THREE.PlaneGeometry(0.28 * CAR_VIS, 0.9 * CAR_VIS);
    markGeo.rotateX(-Math.PI / 2);
    this.markCap = q === 'low' ? 0 : 900;
    this.marks = new THREE.InstancedMesh(
      markGeo,
      new THREE.MeshBasicMaterial({
        color: 0x15151a,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      Math.max(1, this.markCap),
    );
    this.marks.count = 0;
    this.marks.renderOrder = 2;
    this.scene.add(this.marks);
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      160,
    );
    // cor por faísca: batida em laranja; no drift do kart, a cor do nível da barra
    this.sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3);
    this.sparkMesh.count = 0;
    this.scene.add(this.sparkMesh);
    // o cockpit (filho da câmera): volante com o visor da marcha e as bordas
    const ck = this.buildCockpit();
    this.cockpit = ck.g;
    this.cockpitWheel = ck.wheel;
    this.cockpitGear = ck.gear;
    this.camera.add(this.cockpit);
    this.cockpit.visible = false;
    this.scene.add(this.camera);
    for (const c of world.cars) this.addCar(c);
    this.setupPost();
    this.warmUp();
  }

  /**
   * Aquecimento (spec 081, Fase 2.2): sobe para a placa de vídeo, antes da corrida, tudo o que só subiria quando
   * aparecesse pela primeira vez (geometria de cada trecho da pista, texturas, o shader das faíscas e da fumaça). Sem
   * isso, a primeira batida da largada ou a primeira curva com arquibancada davam um quadro de 40 a 150 ms.
   */
  private warmUp() {
    const culled: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    // uma faísca e uma fumaça visíveis por um quadro (o shader delas compila agora)
    this.sparkMesh.count = 1;
    tmpM.makeTranslation(0, -50, 0);
    this.sparkMesh.setMatrixAt(0, tmpM);
    this.puff(0, -50, 0, 0xffffff, 1);
    const p = this.puffs[0];
    if (p) p.s.material.opacity = 0;
    const tex = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : [])
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) tex.add(v);
    });
    for (const t of tex) this.renderer.initTexture(t);
    this.renderer.compile(this.scene, this.camera);
    if (this.composer) this.composer.render(0);
    else this.renderer.render(this.scene, this.camera);
    for (const o of culled) o.frustumCulled = true;
    this.sparkMesh.count = 0;
    if (p) {
      p.age = p.life;
      p.s.visible = false;
    }
  }

  // ---- céu e luz de ambiente (referência: Sky + mapa de ambiente gerado do céu) ----

  private sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(50),
    THREE.MathUtils.degToRad(205),
  );

  private makeSky(): Sky {
    const sky = new Sky();
    sky.scale.setScalar(4000);
    const u = sky.material.uniforms as Record<string, { value: unknown }>;
    u.turbidity!.value = 3.2;
    u.rayleigh!.value = 1.25;
    u.mieCoefficient!.value = 0.004;
    u.mieDirectionalG!.value = 0.8;
    (u.sunPosition!.value as THREE.Vector3).copy(this.sunDir);
    return sky;
  }

  /** Céu de verdade na média e na alta; o reflexo na pintura vem dele (na baixa, só a cor de fundo). */
  private buildSky() {
    if (this.quality === 'low') return;
    this.scene.add(this.makeSky());
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.add(this.makeSky());
    this.envTex = pm.fromScene(env, 0.02, 1, 5000).texture;
    pm.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.5;
  }

  // ---- pós-processamento ----

  private setupPost() {
    if (this.quality !== 'high') return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.88));
    if (!this.reduced) {
      this.afterimage = new AfterimagePass(0);
      composer.addPass(this.afterimage);
    }
    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass(256, 256));
    this.composer = composer;
  }

  // ---- pista ----

  private ribbon(
    from: (i: number) => { a: number; b: number } | null,
    color: (i: number) => number,
    y: number,
    material?: THREE.Material,
    uvScale = 0,
  ): THREE.Mesh | null {
    const tr = this.world.track;
    const pos: number[] = [];
    const col: number[] = [];
    const uv: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < tr.n; i++) {
      const j = (i + 1) % tr.n;
      const ra = from(i);
      const rb = from(j);
      if (!ra || !rb) continue;
      const si = side(tr, i);
      const sj = side(tr, j);
      const p = (k: number, s: { x: number; z: number }, d: number) => [
        tr.x[k]! + s.x * d,
        y,
        tr.z[k]! + s.z * d,
      ];
      const q = [p(i, si, ra.a), p(i, si, ra.b), p(j, sj, rb.a), p(j, sj, rb.b)];
      const vu = [
        [ra.a, i],
        [ra.b, i],
        [rb.a, i + 1],
        [rb.b, i + 1],
      ];
      for (const k of [0, 2, 1, 1, 2, 3]) {
        pos.push(...q[k]!);
        if (uvScale) uv.push(vu[k]![0]! / uvScale, (vu[k]![1]! * tr.ds) / uvScale);
      }
      c.setHex(color(i));
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    if (pos.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (uvScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      material ??
        (this.quality === 'low'
          ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.95,
              side: THREE.DoubleSide,
            })),
    );
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  private std(color: number, rough = 0.8, metal = 0): THREE.Material {
    return this.quality === 'low'
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  private buildGround() {
    const rng = createRng('gp:grass');
    const grass = tex(256, 256, (g, w, h) => {
      g.fillStyle = '#4b8b3a';
      g.fillRect(0, 0, w, h);
      // faixas de corte
      g.fillStyle = 'rgba(255,255,255,.055)';
      g.fillRect(0, 0, w / 2, h);
      speckle(
        g,
        w,
        h,
        this.quality === 'low' ? 4000 : 22000,
        ['#3d7a2f', '#5a9a45', '#355f28', '#6aa850'],
        rng,
      );
    });
    grass.repeat.set(140, 110);
    this.textures.push(grass);
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1100),
      this.quality === 'low'
        ? new THREE.MeshLambertMaterial({ map: grass })
        : new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.06, 0);
    g.receiveShadow = true;
    this.scene.add(g);
  }

  private buildTrack() {
    const tr = this.world.track;
    const H = GP_HALF_WIDTH;
    // brita do lado de fora das curvas
    this.ribbon(
      (i) => {
        const g = tr.gravel[i]!;
        if (g === 0) return null;
        const a = H + GP_KERB_W + 1;
        const wall = Math.min(tr.wallAt(i, g), tr.limit);
        if (wall - 1 <= a) return null;
        return g > 0 ? { a, b: wall - 1 } : { a: -(wall - 1), b: -a };
      },
      () => GRAVEL,
      -0.01,
    );
    // asfalto cinza com granulado e a faixa de borracha no meio (a textura cobre a largura toda uma vez)
    const arng = createRng('gp:asfalto');
    const asphaltTex = tex(512, 512, (g, w, h) => {
      g.fillStyle = '#55575c';
      g.fillRect(0, 0, w, h);
      speckle(
        g,
        w,
        h,
        this.quality === 'low' ? 12000 : 70000,
        ['#3e4044', '#62656b', '#2f3134', '#707379'],
        arng,
        2.2,
      );
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.3, 'rgba(16,16,18,.16)');
      gr.addColorStop(0.7, 'rgba(16,16,18,.16)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    asphaltTex.offset.x = 0.5;
    this.textures.push(asphaltTex);
    let asphalt: THREE.Material;
    if (this.quality === 'low')
      asphalt = new THREE.MeshLambertMaterial({ map: asphaltTex, side: THREE.DoubleSide });
    else {
      const nm = normalNoise(256, 'asfalto-relevo');
      this.textures.push(nm);
      asphalt = new THREE.MeshStandardMaterial({
        map: asphaltTex,
        normalMap: this.quality === 'high' ? nm : null,
        normalScale: new THREE.Vector2(0.25, 0.25),
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      });
    }
    this.ribbon(
      () => ({ a: -H, b: H }),
      () => 0xffffff,
      0.02,
      asphalt,
      H * 2,
    );
    // as faixas pintadas ficam um pouco à frente do asfalto na profundidade (não piscam)
    const painted = (color?: number) =>
      this.quality === 'low'
        ? new THREE.MeshLambertMaterial({
            vertexColors: color === undefined,
            color: color ?? 0xffffff,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          })
        : new THREE.MeshStandardMaterial({
            vertexColors: color === undefined,
            color: color ?? 0xffffff,
            roughness: 0.7,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          });
    // linhas brancas da borda
    this.ribbon(
      () => ({ a: -H + 0.1, b: -H + 0.5 }),
      () => 0xf2f2f2,
      0.03,
      painted(0xf2f2f2),
    );
    this.ribbon(
      () => ({ a: H - 0.5, b: H - 0.1 }),
      () => 0xf2f2f2,
      0.03,
      painted(0xf2f2f2),
    );
    // zebras vermelhas e brancas só nas curvas (a regra de zebra da pista)
    const kerb = (i: number) => (Math.floor((i * tr.ds) / 2) % 2 === 0 ? 0xd4202c : 0xf2f2f2);
    this.ribbon((i) => (tr.kerb[i] ? { a: -H - GP_KERB_W, b: -H } : null), kerb, 0.045, painted());
    this.ribbon((i) => (tr.kerb[i] ? { a: H, b: H + GP_KERB_W } : null), kerb, 0.045, painted());
    // zonas de DRS: faixa verde na largada da zona, "DRS" pintado no chão e placa na margem
    if (this.world.mode === 'real') this.buildDrsZones();
    // a linha de chegada quadriculada e as linhas dos setores
    const cells = 14;
    const size = (H * 2) / cells;
    const black = this.std(0x111111);
    const white = this.std(0xffffff);
    const cell = new THREE.BoxGeometry(size, 0.04, size);
    for (let k = 0; k < cells; k++) {
      for (let r = 0; r < 2; r++) {
        const p = tr.pointAt(r * size, -H + size * (k + 0.5));
        const m = new THREE.Mesh(cell, (k + r) % 2 === 0 ? white : black);
        m.position.set(p.x, 0.05, p.z);
        m.rotation.y = -p.h;
        m.receiveShadow = true;
        this.scene.add(m);
      }
    }
    // fronteira dos setores: só um poste branco fino em cada borda, fora do asfalto e da zebra (nada atravessa a pista)
    const sectorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of tr.sectorS) {
      for (const sd of [-1, 1]) {
        const p = tr.pointAt(s, sd * (H + GP_KERB_W + 0.8));
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), sectorMat);
        m.position.set(p.x, 0.55, p.z);
        m.userData.tag = 'sector-post';
        this.scene.add(m);
      }
    }
    // marcas do grid (12 lugares)
    const mark = this.std(0xffffff);
    for (let i = 0; i < GP_MAX_PLAYERS; i++) {
      const s = gpGridSpot(tr, i);
      const m = new THREE.Mesh(new THREE.BoxGeometry(GP_CAR_WID * 1.1, 0.03, 0.3), mark);
      const p = tr.pointAt(s.s + GP_CAR_LEN / 2 + 0.4, s.d);
      m.position.set(p.x, 0.05, p.z);
      m.rotation.y = -p.h;
      this.scene.add(m);
    }
  }

  private buildPit() {
    const tr = this.world.track;
    this.ribbon(
      (i) => {
        const c = tr.pitCenter(tr.rel(i * tr.ds));
        if (c === null) return null;
        return { a: c - GP_PIT_HALF, b: c + GP_PIT_HALF };
      },
      () => 0x4a4c5a,
      0.025,
    );
    // a vaga do box (amarela) e as garagens atrás da faixa
    const pitDef = tr.pit!;
    const pc = tr.pitCenter(pitDef.box) ?? 0;
    const p = tr.pointAt(pitDef.box, pc);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(GP_PIT_HALF * 2 - 0.6, 0.04, GP_PIT_BOX_LEN),
      this.std(0xffd23a, 0.7),
    );
    box.position.set(p.x, 0.045, p.z);
    box.rotation.y = -p.h;
    this.scene.add(box);
    const wall = this.std(0xf3efe6);
    const roof = this.std(0x2f5bff, 0.5, 0.2);
    for (const f of gpGarageSlots(tr)) {
      const q = tr.pointAt(f.s, (f.from + f.to) / 2);
      const g = new THREE.Mesh(new THREE.BoxGeometry(GP_GARAGE_LEN - 0.2, 3.2, GP_GARAGE_DEPTH - 0.4), wall);
      g.position.set(q.x, 1.6, q.z);
      g.rotation.y = -q.h;
      g.castShadow = true;
      g.receiveShadow = true;
      const r = new THREE.Mesh(new THREE.BoxGeometry(GP_GARAGE_LEN, 0.4, GP_GARAGE_DEPTH), roof);
      r.position.set(q.x, 3.35, q.z);
      r.rotation.y = -q.h;
      r.castShadow = true;
      g.userData.tag = 'garage';
      this.scene.add(g, r);
    }
  }

  private buildGantry() {
    const tr = this.world.track;
    const p = tr.pointAt(3, 0);
    const g = new THREE.Group();
    const steel = this.std(0x1b1535, 0.5, 0.4);
    for (const d of [-GP_HALF_WIDTH - 1.2, GP_HALF_WIDTH + 1.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 0.6), steel);
      leg.position.set(d, 3.1, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(GP_HALF_WIDTH * 2 + 3, 1.2, 0.8), steel);
    beam.position.set(0, 6.2, 0);
    beam.castShadow = true;
    g.add(beam);
    const banner = labelTexture('FOX GP', '#0b0e17', '#ff7d26', 512, 64, 46);
    this.textures.push(banner);
    const bm = new THREE.Mesh(
      new THREE.PlaneGeometry(GP_HALF_WIDTH * 2, 0.9),
      new THREE.MeshBasicMaterial({ map: banner }),
    );
    bm.position.set(0, 7.2, 0.41);
    g.add(bm);
    // o painel preto com 5 colunas de 2 luzes (acendem juntas, coluna a coluna, com as da HUD)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 2.2, 0.4), this.std(0x080808, 0.6));
    panel.position.set(0, 4.7, 0.25);
    g.add(panel);
    const disc = new THREE.CircleGeometry(0.34, 20);
    for (let k = 0; k < 5; k++) {
      for (let r = 0; r < 2; r++) {
        const l = new THREE.Mesh(disc, this.lightOff);
        l.position.set(-3.2 + k * 1.6, 5.15 - r * 0.85, 0.46);
        l.userData.col = k;
        g.add(l);
        this.lights.push(l);
      }
    }
    // girado como um carro: o x do grupo atravessa a pista e as luzes olham para o grid (que vem de trás, +Z)
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.h;
    this.scene.add(g);
  }

  /** Acende `n` luzes; `out` apaga todas (largada). */
  setLights(n: number, out = false) {
    for (const l of this.lights)
      l.material = !out && (l.userData.col as number) < n ? this.lightOn : this.lightOff;
  }

  /** Zonas de DRS: faixa de detecção verde, "DRS" no chão e placas na margem (começo e fim). */
  private buildDrsZones() {
    const tr = this.world.track;
    const H = GP_HALF_WIDTH;
    const green = new THREE.MeshBasicMaterial({
      color: 0x1fd05a,
      transparent: true,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    });
    const word = labelTexture('DRS', '#ffffff', 'rgba(0,0,0,0)', 256, 96, 80);
    this.textures.push(word);
    const wordMat = new THREE.MeshBasicMaterial({
      map: word,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    });
    const signOn = labelTexture('DRS', '#0b0e17', '#1fd05a', 256, 128, 84);
    const signOff = labelTexture('FIM DRS', '#ffffff', '#0b0e17', 256, 128, 56);
    this.textures.push(signOn, signOff);
    for (const zn of tr.drsZones) {
      const a = tr.pointAt(zn.from, 0);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 0.6), green);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = -a.h;
      line.position.set(a.x, 0.05, a.z);
      this.scene.add(line);
      const w = tr.pointAt(zn.from + 8, 0);
      const txt = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), wordMat);
      txt.rotation.x = -Math.PI / 2;
      txt.rotation.z = -w.h + Math.PI;
      txt.position.set(w.x, 0.05, w.z);
      this.scene.add(txt);
      for (const [s, t] of [
        [zn.from, signOn],
        [zn.to, signOff],
      ] as const) {
        const i = tr.index(s);
        const sd = tr.wallAt(i, 1) < tr.wallAt(i, -1) ? 1 : -1;
        const off = Math.min(tr.wallAt(i, sd), tr.limit) - 0.4;
        const q = tr.pointAt(s, sd * Math.max(H + GP_KERB_W + 1, off));
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 2.4, 0.12),
          this.std(0x8a8f96, 0.4, 0.7),
        );
        post.position.set(q.x, 1.2, q.z);
        const b = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.8),
          new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
        );
        b.position.set(q.x, 2.4, q.z);
        b.rotation.y = -q.h;
        this.scene.add(post, b);
      }
    }
  }

  /**
   * Uma faixa vertical ao longo da barreira (placas, alambrado), a `extra` m além dela, só onde há barreira. A posição
   * da barreira é a do `GpTrack` (a física usa a mesma).
   */
  private wallStrip(
    sd: 1 | -1,
    extra: number,
    y0: number,
    y1: number,
    mat: THREE.Material,
    vLen: number,
  ) {
    const tr = this.world.track;
    const pos: number[] = [];
    const uv: number[] = [];
    const at = (i: number) => {
      const w = tr.wallAt(i, sd);
      if (w === Infinity) return null;
      const sv = side(tr, i);
      const d = sd * (w + extra);
      return { x: tr.x[i]! + sv.x * d, z: tr.z[i]! + sv.z * d };
    };
    const every = Math.max(1, Math.round(1 / tr.ds));
    for (let i = 0; i < tr.n; i += every) {
      const j = (i + every) % tr.n;
      const a = at(i);
      const b = at(j);
      if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > 4 * every * tr.ds) continue;
      const va = (i * tr.ds) / vLen;
      const vb = va + (every * tr.ds) / vLen;
      const q = [
        [a.x, y1, a.z, va, 1],
        [a.x, y0, a.z, va, 0],
        [b.x, y1, b.z, vb, 1],
        [b.x, y0, b.z, vb, 0],
      ];
      for (const k of [0, 1, 2, 2, 1, 3]) {
        pos.push(q[k]![0]!, q[k]![1]!, q[k]![2]!);
        uv.push(q[k]![3]!, q[k]![4]!);
      }
    }
    if (pos.length === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    this.scene.add(m);
  }

  private buildBarriers() {
    const tr = this.world.track;
    const tyres: { x: number; z: number; k: number }[] = [];
    const walls: { x: number; z: number; h: number }[] = [];
    const every = Math.max(1, Math.round(2.2 / tr.ds));
    for (let i = 0; i < tr.n; i += every) {
      for (const sd of [-1, 1]) {
        const w = tr.wallAt(i, sd);
        if (w === Infinity) continue;
        const s = side(tr, i);
        const d = (w + 0.6) * sd;
        const x = tr.x[i]! + s.x * d;
        const z = tr.z[i]! + s.z * d;
        // onde dois trechos passam perto, um muro de concreto; senão, pneus
        if (w < tr.limit - 0.5) walls.push({ x, z, h: tr.heading(i) });
        else tyres.push({ x, z, k: (i / every) % 3 });
      }
    }
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10);
    const colors = [0x16161c, 0xf4f4f4, 0xe8322e];
    const layers = this.quality === 'low' ? 1 : 2;
    for (let layer = 0; layer < layers; layer++) {
      const m = new THREE.InstancedMesh(geo, this.std(0xffffff, 0.85), Math.max(1, tyres.length));
      const c = new THREE.Color();
      tyres.forEach((p, i) => {
        tmpM.makeTranslation(p.x, 0.25 + layer * 0.5, p.z);
        m.setMatrixAt(i, tmpM);
        m.setColorAt(i, c.setHex(colors[(Math.round(p.k) + layer) % 3]!));
      });
      m.count = tyres.length;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    // placas com as marcas fictícias e o alambrado por trás (na baixa, só as placas)
    const board = tex(2048, 128, (g, w, h) =>
      SPONSORS.forEach(([n, bg, fg, sub], k) => {
        const x = (k * w) / SPONSORS.length;
        const bw = w / SPONSORS.length;
        g.fillStyle = bg;
        g.fillRect(x, 0, bw, h);
        g.fillStyle = fg;
        g.textAlign = 'center';
        g.font = 'italic 900 54px "Saira Condensed", Inter, system-ui, sans-serif';
        g.fillText(n, x + bw / 2, 70);
        g.font = '700 18px Inter, system-ui, sans-serif';
        g.fillText(sub, x + bw / 2, 104);
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.fillRect(x + bw - 3, 0, 3, h);
      }),
    );
    this.textures.push(board);
    const boardMat =
      this.quality === 'low'
        ? new THREE.MeshLambertMaterial({ map: board, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ map: board, roughness: 0.55, side: THREE.DoubleSide });
    for (const sd of [1, -1] as const) this.wallStrip(sd, 1.3, 0, 1.15, boardMat, 48);
    if (this.quality !== 'low') {
      const fence = tex(64, 64, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(205,210,215,1)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(w, h);
        g.moveTo(w, 0);
        g.lineTo(0, h);
        g.stroke();
      });
      this.textures.push(fence);
      const fenceMat = new THREE.MeshStandardMaterial({
        map: fence,
        alphaTest: 0.4,
        metalness: 0.5,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      for (const sd of [1, -1] as const) this.wallStrip(sd, 1.45, 1.15, 4.2, fenceMat, 1.3);
      // postes do alambrado (instanciados)
      const postG = new THREE.BoxGeometry(0.14, 4.4, 0.14).translate(0, 2.2, 0);
      const spots: { x: number; z: number }[] = [];
      for (let i = 0; i < tr.n; i += Math.round(8 / tr.ds))
        for (const sd of [1, -1]) {
          const w = tr.wallAt(i, sd);
          if (w === Infinity) continue;
          const sv = side(tr, i);
          spots.push({ x: tr.x[i]! + sv.x * sd * (w + 1.5), z: tr.z[i]! + sv.z * sd * (w + 1.5) });
        }
      const im = new THREE.InstancedMesh(
        postG,
        this.std(0x8a8f96, 0.4, 0.7),
        Math.max(1, spots.length),
      );
      spots.forEach((p, k) => im.setMatrixAt(k, tmpM.makeTranslation(p.x, 0, p.z)));
      im.count = spots.length;
      this.scene.add(im);
    }
    if (walls.length) {
      const wm = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.5, 1.1, 2.4),
        this.std(0xd7d9e0, 0.9),
        walls.length,
      );
      walls.forEach((p, i) => {
        tmpQ.setFromAxisAngle(UP, -p.h);
        tmpM.compose(tmpP.set(p.x, 0.55, p.z), tmpQ, tmpS.set(1, 1, 1));
        wm.setMatrixAt(i, tmpM);
      });
      wm.castShadow = true;
      wm.receiveShadow = true;
      this.scene.add(wm);
    }
  }

  private buildScenery() {
    const tr = this.world.track;
    const def = tr.def;
    const rng = createRng('gp:scenery');
    const low = this.quality === 'low';
    // a marina: água do lado de fora da curva da esquerda e alguns barcos
    if (def.scale) {
      const a = tr.mapPoint(-200, 250);
      const b = tr.mapPoint(215, 1000);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.abs(b.x - a.x), Math.abs(b.z - a.z)),
        low
          ? new THREE.MeshLambertMaterial({ color: WATER })
          : new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.15, metalness: 0.35 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set((a.x + b.x) / 2, -0.04, (a.z + b.z) / 2);
      water.receiveShadow = true;
      this.scene.add(water);
      const hull = this.std(0xf4f4f4, 0.6);
      const deck = this.std(0x8a5a33, 0.8);
      for (let k = 0; k < 9; k++) {
        const p = tr.mapPoint(30 + (k % 3) * 55, 380 + Math.floor(k / 3) * 170 + (k % 2) * 40);
        const boat = new THREE.Group();
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 7), hull);
        h1.position.y = 0.4;
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.8), deck);
        h2.position.set(0, 1.1, 0.6);
        boat.add(h1, h2);
        boat.position.set(p.x, 0, p.z);
        boat.rotation.y = 0.3 + k * 0.4;
        boat.traverse((o) => ((o as THREE.Mesh).castShadow = true));
        this.scene.add(boat);
      }
    }
    // área verde de público (general admission)
    if (def.park) {
      const shape = new THREE.Shape(
        def.park.map(([px, pz]) => {
          const p = tr.mapPoint(px, pz);
          return new THREE.Vector2(p.x, -p.z);
        }),
      );
      const park = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.std(0x8bc34a, 1));
      park.rotation.x = -Math.PI / 2;
      park.position.y = -0.02;
      park.receiveShadow = true;
      this.scene.add(park);
    }
    // arquibancadas amarelas com torcida e o nome de cada uma
    const stand = this.std(STAND, 0.7);
    const seat = this.std(0xd9d4ea, 0.8);
    const crng = createRng('gp:torcida');
    const crowdTex = tex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#2a2e38';
        g.fillRect(0, 0, w, h);
        const cols = [
          '#e53935',
          '#fdd835',
          '#1e88e5',
          '#fafafa',
          '#43a047',
          '#fb8c00',
          '#8e24aa',
          '#f06292',
          '#00acc1',
          '#ff7d26',
        ];
        for (let y = 0; y < h; y += 8)
          for (let x = 0; x < w; x += 5)
            if (crng() < 0.9) {
              const jy = crng() * 2;
              g.fillStyle = cols[Math.floor(crng() * cols.length)]!;
              g.fillRect(x + 1, y + 3 + jy, 3, 4);
              g.fillStyle = '#e2b996';
              g.fillRect(x + 1.5, y + 1 + jy, 2, 2);
            }
      },
      4,
      true,
    );
    this.textures.push(crowdTex);
    const crowdMat =
      this.quality === 'low'
        ? new THREE.MeshLambertMaterial({ map: crowdTex })
        : new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 });
    // os trechos que cabem atrás da barreira sem encostar em nenhum outro trecho da pista (`gpStandSlots`)
    for (const sl of gpStandSlots(tr)) {
      for (let row = 0; row < sl.rows; row++) {
        const off = sl.side * (sl.wall + GP_STAND_ROW0 + row * GP_STAND_ROW_STEP);
        const q = tr.pointAt(sl.s, off);
        const hgt = 1 + row * 1.1;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(GP_STAND_LEN - 0.6, hgt, GP_STAND_ROW_DEPTH),
          row === sl.rows - 1 ? stand : seat,
        );
        b.position.set(q.x, hgt / 2, q.z);
        b.rotation.y = -q.h;
        b.castShadow = true;
        b.receiveShadow = true;
        b.userData.tag = 'stand';
        this.scene.add(b);
        // a torcida sentada em cada degrau
        const fan = new THREE.Mesh(new THREE.PlaneGeometry(GP_STAND_LEN - 1, 0.9), crowdMat);
        fan.position.set(q.x, hgt + 0.45, q.z);
        fan.rotation.y = -q.h + (sl.side > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI / 2;
        this.scene.add(fan);
      }
      if (sl.roof) {
        const q = tr.pointAt(sl.s, sl.side * (sl.wall + (GP_STAND_ROOF_FROM + GP_STAND_ROOF_TO) / 2));
        const r = new THREE.Mesh(
          new THREE.BoxGeometry(GP_STAND_LEN, 0.3, GP_STAND_ROOF_TO - GP_STAND_ROOF_FROM),
          stand,
        );
        r.position.set(q.x, 5.4, q.z);
        r.rotation.y = -q.h;
        r.castShadow = true;
        r.userData.tag = 'stand-roof';
        this.scene.add(r);
      }
      if (sl.name) {
        const tex = labelTexture(sl.name, '#0b0e17', '#ffd23a', 512, 96, 54);
        this.textures.push(tex);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(9, 1.7),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
        );
        const sq = tr.pointAt(sl.s, sl.side * (sl.wall + GP_STAND_ROW0));
        sign.position.set(sq.x, sl.roof ? 6.6 : 1.4 + sl.rows * 1.1, sq.z);
        sign.rotation.y = -sq.h + Math.PI;
        this.scene.add(sign);
      }
    }
    // torres de iluminação nas retas (a lâmpada brilha com o bloom)
    const pole = this.std(0x9aa3b5, 0.5, 0.6);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
    for (const t of gpTowerSlots(tr)) {
      const q = tr.pointAt(t.s, t.d);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 12, 0.4), pole);
      p.position.set(q.x, 6, q.z);
      p.castShadow = true;
      const l = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.6), lamp);
      l.position.set(q.x, 12, q.z);
      l.rotation.y = -q.h;
      this.scene.add(p, l);
    }
    // placas de freada (100 e 50 m) antes das curvas fortes, do lado de fora
    const boards = [100, 50].map((n) => {
      const t = labelTexture(String(n), '#0b0e17', '#f4f6fb', 128, 128, 72);
      this.textures.push(t);
      return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    });
    for (const bd of gpBoardSlots(tr)) {
      const q = tr.pointAt(bd.s, bd.d);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), boards[bd.label === 100 ? 0 : 1]!);
      b.position.set(q.x, 1.4, q.z);
      b.rotation.y = -q.h;
      this.scene.add(b);
    }
    this.buildTrees(rng);
    this.buildMountains(rng);
  }

  /** Árvores instanciadas (uma chamada de desenho), sem nascer perto da pista, do box nem da água da marina. */
  private buildTrees(rng: () => number) {
    const tr = this.world.track;
    const low = this.quality === 'low';
    const want = low ? 260 : this.quality === 'medium' ? 800 : 1500;
    const water = tr.def.scale ? [tr.mapPoint(-200, 250), tr.mapPoint(215, 1000)] : null;
    const inWater = (x: number, z: number) =>
      !!water &&
      x > Math.min(water[0]!.x, water[1]!.x) - 6 &&
      x < Math.max(water[0]!.x, water[1]!.x) + 6 &&
      z > Math.min(water[0]!.z, water[1]!.z) - 6 &&
      z < Math.max(water[0]!.z, water[1]!.z) + 6;
    const cone = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const trunkG = new THREE.CylinderGeometry(0.14, 0.2, 1, 5).translate(0, 0.5, 0);
    const leaf = new THREE.InstancedMesh(cone, this.std(0xffffff, 1), want);
    const trunk = new THREE.InstancedMesh(trunkG, this.std(0x4a3526, 1), want);
    const col = new THREE.Color();
    let n = 0;
    for (let k = 0; k < want * 12 && n < want; k++) {
      const x = -650 + rng() * 1300;
      const z = -520 + rng() * 1040;
      if (inWater(x, z)) continue;
      const p = tr.projectGlobal(x, z);
      if (p.dist < tr.limit + 14) continue;
      const h = 6 + rng() * 8;
      const w = 1.8 + rng() * 1.6;
      leaf.setMatrixAt(n, tmpM.compose(tmpP.set(x, 1.6, z), tmpQ.identity(), tmpS.set(w, h, w)));
      trunk.setMatrixAt(n, tmpM.compose(tmpP.set(x, 0, z), tmpQ.identity(), tmpS.set(1, 2, 1)));
      leaf.setColorAt(n, col.setHSL(0.27 + rng() * 0.06, 0.42 + rng() * 0.2, 0.15 + rng() * 0.08));
      n++;
    }
    leaf.count = n;
    trunk.count = n;
    leaf.castShadow = !low;
    leaf.receiveShadow = !low;
    this.scene.add(leaf, trunk);
  }

  /** Montanhas ao longe, feitas por código (icosaedro deformado com cor pela altura). */
  private buildMountains(rng: () => number) {
    if (this.quality === 'low') return;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const c1 = new THREE.Color(0x4c7a44);
    const c2 = new THREE.Color(0x8d968c);
    const tc = new THREE.Color();
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + rng() * 0.4;
      const dist = 900 + rng() * 450;
      const r = 200 + rng() * 220;
      let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, 4);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      const p = g.attributes.position!;
      const col: number[] = [];
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i);
        let y = p.getY(i);
        let z = p.getZ(i);
        const nn =
          1 +
          0.2 * Math.sin(x * 0.02 + k) * Math.cos(z * 0.022 - k) +
          0.08 * Math.sin(x * 0.06 + y * 0.05);
        x *= nn;
        y *= nn;
        z *= nn;
        p.setXYZ(i, x, y, z);
        const hh = Math.max(0, Math.min(1, (y / r) * 1.2));
        tc.copy(c1).lerp(c2, hh * hh);
        col.push(tc.r, tc.g, tc.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.scale.y = 0.35 + rng() * 0.4;
      m.position.set(Math.cos(ang) * dist, -r * 0.12, Math.sin(ang) * dist);
      this.scene.add(m);
    }
  }

  /** A equipe do box: quatro mecânicos de macacão com a pistola de roda, parados ao lado da vaga. */
  private buildCrew() {
    const suit = this.std(0x2f5bff, 0.7);
    const helmet = this.std(0xff7d26, 0.4, 0.3);
    const gunMat = this.std(0x1b1535, 0.5, 0.5);
    const b = this.boxSpot;
    const fx = Math.sin(b.h);
    const fz = -Math.cos(b.h);
    const rx = Math.cos(b.h);
    const rz = Math.sin(b.h);
    const sideSign = this.world.track.pit?.side ?? 1;
    for (const [lx, lz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.35), suit);
      body.position.y = 0.6;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), helmet);
      head.position.y = 1.2;
      const gun = new THREE.Group();
      gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.42), gunMat));
      gun.position.set(0, 0.6, -0.3);
      g.add(body, head, gun);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      // em casa: encostados na garagem; na troca: ao lado de cada roda
      const wx = b.x + rx * lx * (GP_CAR_WID / 2 + 0.5) - fx * lz * GP_CAR_LEN * 0.3;
      const wz = b.z + rz * lx * (GP_CAR_WID / 2 + 0.5) - fz * lz * GP_CAR_LEN * 0.3;
      const hx = b.x + rx * sideSign * 4.2 + fx * lz * 1.5;
      const hz = b.z + rz * sideSign * 4.2 + fz * lz * 1.5;
      const home = new THREE.Vector3(hx, 0, hz);
      g.position.copy(home);
      g.lookAt(b.x, 0, b.z);
      this.scene.add(g);
      this.crew.push({ g, home, to: new THREE.Vector3(wx, 0, wz), gun });
    }
  }

  /** O volante (com o visor da marcha) e as bordas do cockpit, presos à câmera de dentro do carro. */
  private buildCockpit() {
    const g = new THREE.Group();
    const carbon = new THREE.MeshStandardMaterial({
      color: 0x1b1535,
      roughness: 0.4,
      metalness: 0.3,
    });
    const grip = new THREE.MeshStandardMaterial({ color: 0x0b0e17, roughness: 0.9 });
    const accent = new THREE.MeshBasicMaterial({ color: 0xff7d26, toneMapped: false });
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.02), carbon));
    for (const sx of [-1, 1]) {
      const gp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.035), grip);
      gp.position.set(sx * 0.125, -0.01, 0);
      wheel.add(gp);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.02), accent);
    top.position.set(0, 0.05, 0);
    wheel.add(top);
    // visor da marcha no meio do volante
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 64;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.045),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    screen.position.set(0, 0, 0.012);
    wheel.add(screen);
    wheel.position.set(0, -0.27, -0.55);
    wheel.rotation.x = -0.35;
    wheel.scale.setScalar(0.8);
    g.add(wheel);
    // as bordas do cockpit nos cantos de baixo (a visão da pista fica livre)
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.5), carbon);
      edge.position.set(sx * 0.36, -0.3, -0.45);
      edge.rotation.z = sx * 0.25;
      g.add(edge);
    }
    return { g, wheel, gear: { tex, ctx, last: '' } };
  }

  private makePuffTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(cv);
    this.textures.push(t);
    return t;
  }

  // ---- carros ----

  private textSprite(text: string, bg: string, w = 1.3, h = 0.35): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      g.font = '700 24px "Saira Condensed", Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const shown = text.length > 14 ? `${text.slice(0, 13)}…` : text;
      const tw = Math.min(240, g.measureText(shown).width + 24);
      g.fillStyle = bg;
      if (typeof g.roundRect === 'function') {
        g.beginPath();
        g.roundRect(128 - tw / 2, 14, tw, 36, 8);
        g.fill();
      } else {
        g.fillRect(128 - tw / 2, 14, tw, 36);
      }
      g.fillStyle = '#ffffff';
      g.fillText(shown.toUpperCase(), 128, 32);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true }),
    );
    s.scale.set(w, h, 1);
    s.renderOrder = 10;
    return s;
  }

  private addCar(c: GpCar) {
    const kart = this.world.mode === 'arcade' && kartReady();
    const m: CarModel | KartModel = kart
      ? buildKart({ fur: c.color, paint: c.paint, pbr: this.quality !== 'low' })
      : buildCar({ fur: c.color, paint: c.paint, pbr: this.quality !== 'low' });
    const own = c.id === this.meId;
    const tag = this.textSprite(c.name, 'rgba(11,14,23,0.88)');
    tag.position.y = 2.6;
    m.group.scale.setScalar(CAR_VIS);
    // a chama do turbo (kart): atrás do carro, brilhante, sem luz real
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 1.1, 10),
      new THREE.MeshBasicMaterial({ color: BOOST_COLORS[1], transparent: true, opacity: 0.85, toneMapped: false }),
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.45, 1.95);
    flame.visible = false;
    m.group.add(flame);
    tag.visible = !own;
    m.group.add(tag);
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = this.quality !== 'low';
    });
    // sombra de contato (sempre: com ou sem mapa de sombra)
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 3.8),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.06;
    m.group.add(blob);
    this.scene.add(m.group);
    this.cars.set(c.id, {
      id: c.id,
      m,
      tag,
      driftYaw: 0,
      flame,
      ghost: false,
      wag: 0,
      shake: 0,
      markAcc: 0,
      lastX: 0,
      lastZ: 0,
      wheelA: 0,
      flapA: 0,
      shadow: true,
    });
  }

  /** Classificação: os outros carros ficam transparentes (fantasmas). */
  private setGhost(v: CarView, ghost: boolean) {
    if (v.ghost === ghost) return;
    v.ghost = ghost;
    for (const mt of v.m.mats) {
      mt.transparent = ghost;
      mt.opacity = ghost ? 0.38 : 1;
      mt.depthWrite = !ghost;
      mt.needsUpdate = true;
    }
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    // a câmera distante enquadra o mesmo pedaço de pista em pé e deitado
    this.farDist = this.camera.aspect < 1 ? 82 / Math.max(0.5, this.camera.aspect) : 82;
  }

  /** Troca de câmera com transição suave (a preferência fica com quem chama). */
  setCamMode(mode: GpCamMode) {
    if (mode === this.mode) return;
    this.camFrom = {
      p: this.camera.position.clone(),
      q: this.camera.quaternion.clone(),
      fov: this.camera.fov,
    };
    this.camMix = this.reduced ? 1 : 0;
    this.mode = mode;
    this.chaseInit = false;
  }

  get camMode(): GpCamMode {
    return this.mode;
  }

  /** Reage aos eventos do motor: tremida, faíscas e fumaça. */
  handle(events: readonly GpEvent[]) {
    for (const e of events) {
      if (e.type === 'bump') {
        const a = this.cars.get(e.a);
        const b = this.cars.get(e.b);
        if (a) a.shake = Math.min(1, a.shake + e.force * 0.15);
        if (b) b.shake = Math.min(1, b.shake + e.force * 0.15);
        if (e.force > 2 && typeof e.x === 'number')
          this.spark(e.x, e.z, Math.min(16, Math.round(e.force * 2)));
      } else if (e.type === 'wall') {
        const v = this.cars.get(e.id);
        if (v) v.shake = 1;
        if (typeof e.x === 'number') {
          this.spark(e.x, e.z, Math.min(24, Math.round(e.speed)));
          this.puff(e.x, 0.5, e.z, 0x9a9a9a, 1.4);
        }
      }
    }
  }

  private spark(x: number, z: number, n: number, color = 0xffb347, power = 1) {
    if (this.quality === 'low' || this.reduced) return;
    for (let i = 0; i < n && this.sparks.length < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.sparks.push({
        x,
        y: 0.4,
        z,
        vx: Math.cos(a) * sp * power,
        vy: (2 + Math.random() * 4) * power,
        vz: Math.sin(a) * sp * power,
        age: 0,
        color,
      });
    }
  }

  private puff(x: number, y: number, z: number, color: number, size: number) {
    if (this.quality === 'low') return;
    let p = this.puffs.find((q) => q.age >= q.life);
    if (!p) {
      if (this.puffs.length >= 80) return;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.puffTex,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      this.scene.add(s);
      p = { s, age: 1, life: 1, vx: 0, vy: 0, vz: 0, grow: 1 };
      this.puffs.push(p);
    }
    p.age = 0;
    p.life = 0.9 + Math.random() * 0.5;
    p.vx = (Math.random() - 0.5) * 0.8;
    p.vy = 0.6 + Math.random() * 0.4;
    p.vz = (Math.random() - 0.5) * 0.8;
    p.grow = size;
    p.s.position.set(x, y, z);
    p.s.material.color.setHex(color);
    p.s.visible = true;
  }

  private skidMark(x: number, z: number, h: number) {
    if (this.markCap === 0) return;
    tmpQ.setFromAxisAngle(UP, -h);
    tmpM.compose(tmpP.set(x, 0.035, z), tmpQ, tmpS.set(1, 1, 1));
    this.marks.setMatrixAt(this.markNext, tmpM);
    this.markNext = (this.markNext + 1) % this.markCap;
    this.marks.count = Math.min(this.markCap, this.marks.count + 1);
    this.marks.instanceMatrix.needsUpdate = true;
  }

  render(dt: number, focusId: string, pose: (c: GpCar) => GpPose) {
    this.t += dt;
    const w = this.world;
    const cockpit = this.mode === 'cockpit';
    let focusPose: GpPose | null = null;
    let focusCar: GpCar | null = null;
    for (const c of w.cars) {
      const v = this.cars.get(c.id);
      if (!v) continue;
      v.m.group.visible = !c.gone;
      if (c.gone) continue;
      const p = pose(c);
      if (c.id === focusId) {
        focusPose = p;
        focusCar = c;
      }
      v.m.group.position.set(p.x, 0, p.z);
      v.m.group.rotation.y = -p.h;
      for (const wh of v.m.wheelsF) wh.rotation.y = -c.steer * 0.45;
      // as rodas giram com a velocidade; a asa de trás abre com o DRS (suave)
      v.wheelA += (c.speed * dt) / (v.m.wheelR * CAR_VIS);
      for (const wh of v.m.wheels) wh.rotation.x = v.wheelA;
      if ('kart' in v.m)
        (v.m as KartModel).update(dt, {
          steer: c.steer,
          throttle: c.braking ? 0 : Math.abs(c.speed) > 0.5 ? 1 : 0,
          brake: c.brakeLevel,
          speed: c.speed,
          boost: c.boostT > 0 ? c.boostLevel : 0,
        });
      v.flapA += ((c.drsOpen ? -0.75 : 0) - v.flapA) * Math.min(1, dt * 10);
      v.m.flap.rotation.x = v.flapA;
      // a cauda: balanço calmo andando; forte no vácuo
      const fast = Math.min(1, Math.abs(c.speed) / gpVmaxOf(this.world.mode));
      v.wag += dt * (5 + fast * 4 + c.slip * 12);
      const amp = this.reduced ? 0.08 : 0.16 + fast * 0.12 + c.slip * 0.55;
      v.m.tail.rotation.y = Math.sin(v.wag) * amp;
      v.shake = Math.max(0, v.shake - dt * 3);
      // kart (spec 081, 5.4 e 5.5): o corpo vira para fora no drift, pula ao entrar, estica no turbo e a chama acende
      if (w.mode === 'arcade') {
        const want = c.driftDir * GP_ARC_DRIFT_YAW;
        v.driftYaw += (want - v.driftYaw) * Math.min(1, dt * 9);
        v.m.body.rotation.y = v.driftYaw;
        const hop = c.hop > 0 ? Math.sin(Math.PI * (1 - c.hop / GP_ARC_HOP_SEC)) * GP_ARC_HOP_H : 0;
        v.m.group.position.y = hop * CAR_VIS;
        const boost = c.boostT > 0 && c.boostLevel > 0;
        v.m.body.scale.z = boost && !this.reduced ? 1.04 : 1;
        v.flame.visible = boost;
        if (boost) {
          const mat = v.flame.material as THREE.MeshBasicMaterial;
          mat.color.setHex(BOOST_COLORS[c.boostLevel]!);
          const f = this.reduced ? 1 : 0.8 + Math.random() * 0.45;
          v.flame.scale.set(1, 1, f * (0.7 + c.boostLevel * 0.3));
        }
        // faíscas nas rodas de trás no drift, da cor do nível da barra
        if (c.driftDir !== 0 && Math.random() < 0.6) {
          const rx = Math.cos(p.h);
          const rz = Math.sin(p.h);
          const bx = p.x - Math.sin(p.h) * GP_CAR_LEN * 0.3;
          const bz = p.z + Math.cos(p.h) * GP_CAR_LEN * 0.3;
          const lv = Math.min(3, Math.floor(c.bar));
          const side = Math.random() < 0.5 ? 1 : -1;
          this.spark(bx + rx * side * GP_CAR_WID * 0.4, bz + rz * side * GP_CAR_WID * 0.4, 2, BOOST_COLORS[lv], 0.35);
        }
      }
      v.m.body.position.x = this.reduced ? 0 : Math.sin(this.t * 60) * v.shake * 0.08;
      v.m.body.rotation.z = -c.steer * Math.min(1, fast * 1.2) * 0.05;
      this.setGhost(v, w.phase === 'quali' && c.id !== focusId);
      // no cockpit o próprio carro some (a câmera está dentro dele); o volante e as bordas ficam
      const inside = cockpit && c.id === focusId && this.camMix >= 1;
      v.m.body.visible = !inside;
      // fumaça e marcas de pneu quando escorrega
      const moved = Math.hypot(p.x - v.lastX, p.z - v.lastZ);
      v.lastX = p.x;
      v.lastZ = p.z;
      if (c.skid > 2.2 && Math.abs(c.speed) > 6 && !v.ghost && moved < 3) {
        v.markAcc += moved;
        if (v.markAcc > 0.5) {
          v.markAcc = 0;
          const rx = Math.cos(p.h);
          const rz = Math.sin(p.h);
          // as rodas de trás do carro em escala de pista
          const bx = p.x - Math.sin(p.h) * GP_CAR_LEN * 0.28;
          const bz = p.z + Math.cos(p.h) * GP_CAR_LEN * 0.28;
          const half = GP_CAR_WID * 0.38;
          this.skidMark(bx + rx * half, bz + rz * half, p.h);
          this.skidMark(bx - rx * half, bz - rz * half, p.h);
          if (Math.random() < 0.5) this.puff(bx, 0.4, bz, 0xdedede, 1 + c.skid * 0.1);
        }
      }
    }
    // equipe do box: vai para as rodas quando um carro está parado na vaga
    const pitting = w.cars.some((c) => c.pitHold > 0 && !c.gone);
    const kk = 1 - Math.exp(-dt * 8);
    for (const m of this.crew) {
      m.g.position.lerp(pitting ? m.to : m.home, kk);
      m.gun.rotation.z = pitting && !this.reduced ? this.t * 30 : 0;
    }
    // partículas
    for (const p of this.puffs) {
      if (p.age >= p.life) {
        p.s.visible = false;
        continue;
      }
      p.age += dt;
      const f = p.age / p.life;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const sc = (0.8 + f * 2.2) * p.grow;
      p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = 0.55 * (1 - f);
    }
    let sn = 0;
    // tira as faíscas apagadas sem criar uma lista nova por quadro (lixo por quadro dá pausas do coletor)
    let keep = 0;
    for (const s of this.sparks) if (s.age < 0.45) this.sparks[keep++] = s;
    this.sparks.length = keep;
    for (const s of this.sparks) {
      s.age += dt;
      s.vy -= 18 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.05, s.y + s.vy * dt);
      s.z += s.vz * dt;
      tmpM.makeTranslation(s.x, s.y, s.z);
      this.sparkColor.setHex(s.color);
      this.sparkMesh.setColorAt(sn, this.sparkColor);
      this.sparkMesh.setMatrixAt(sn++, tmpM);
    }
    this.sparkMesh.count = sn;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    // kart: o turbo abre o campo de visão (+6°, +10°, +14°) e treme a câmera; a zebra vibra (opção e movimento reduzido)
    if (w.mode === 'arcade' && focusCar) {
      const lv = focusCar.boostT > 0 ? focusCar.boostLevel : 0;
      const fovWant = [0, 6, 10, 14][lv] ?? 0;
      this.boostFov += (fovWant - this.boostFov) * Math.min(1, dt * (lv ? 6 : 3));
      const shakeWant = lv ? lv * 0.35 : focusCar.surface === 'kerb' && Math.abs(focusCar.speed) > 8 ? 0.25 : 0;
      this.camShake = this.shakeOn && !this.reduced ? Math.max(shakeWant, this.camShake - dt * 2) : 0;
    } else {
      this.boostFov = 0;
      this.camShake = 0;
    }
    this.updateCamera(dt, focusPose, focusCar);
    // sombra só dos carros perto do foco (12 carros projetando sombra pesa no celular)
    if (focusPose && this.quality !== 'low') {
      for (const c of w.cars) {
        const v = this.cars.get(c.id);
        if (!v) continue;
        // carro de 6,5 m: a sombra pesa mais, então só os mais perto (spec 081, Fase 3)
        const near = Math.hypot(c.x - focusPose.x, c.z - focusPose.z) < 45;
        if (near === v.shadow) continue;
        v.shadow = near;
        v.m.group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.castShadow = near;
        });
      }
    }
    // a caixa da sombra acompanha o foco
    if (focusPose) {
      this.sun.position.set(focusPose.x - 40, 80, focusPose.z + 30);
      this.sun.target.position.set(focusPose.x, 0, focusPose.z);
    }
    // motion blur sutil só em alta velocidade
    if (this.afterimage) {
      const sp = focusCar ? Math.abs(focusCar.speed) : 0;
      const damp = sp > 24 ? Math.min(0.55, (sp - 24) / 20) : 0;
      (this.afterimage.uniforms as unknown as { damp: { value: number } }).damp.value = damp;
    }

    // Atualiza as etiquetas com o nome dos outros pilotos (pequenas, discretas, nunca tapam a câmera)
    const insideCockpit = this.mode === 'cockpit' && this.camMix >= 1;
    const camPos = this.camera.position;
    const camDirX = this.camLook.x - camPos.x;
    const camDirZ = this.camLook.z - camPos.z;
    const camDirLen = Math.hypot(camDirX, camDirZ) || 1;
    const cdx = camDirX / camDirLen;
    const cdz = camDirZ / camDirLen;

    for (const c of w.cars) {
      const v = this.cars.get(c.id);
      if (!v || c.gone) continue;

      // O próprio carro nunca mostra etiqueta; se assistindo no cockpit também não
      if (c.id === this.meId || (c.id === focusId && insideCockpit)) {
        v.tag.visible = false;
        continue;
      }

      // Posição no mundo do carro
      const dx = v.m.group.position.x - camPos.x;
      const dz = v.m.group.position.z - camPos.z;
      const distToCam = Math.hypot(dx, dz);

      // Projeção na direção que a câmera olha (> 0 significa à frente da câmera)
      const forwardDist = dx * cdx + dz * cdz;

      // quem assiste sempre vê o nome do piloto que segue (spec 081, 13.8), nas câmeras de fora
      if (c.id === focusId) {
        v.tag.visible = true;
        v.tag.scale.set(1.3, 0.35, 1);
        continue;
      }
      // Se estiver atrás da câmera ou muito perto (<= 4.5m, ex: carro colado atrás em 3ª pessoa):
      // NUNCA mostra para não tapar a visão!
      if (forwardDist <= 0.5 || distToCam < 4.5) {
        v.tag.visible = false;
      } else {
        v.tag.visible = true;
        // Escala discreta e controlada:
        // Em 3ª pessoa ou cockpit, limita o tamanho aparente na tela para NUNCA ficar gigante
        if (this.mode !== 'far') {
          const scale = Math.max(0.35, Math.min(1.0, distToCam / 14));
          v.tag.scale.set(1.3 * scale, 0.35 * scale, 1);
        } else {
          v.tag.scale.set(1.3, 0.35, 1);
        }
      }
    }

    const t0 = import.meta.env.DEV ? performance.now() : 0;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) this.drawMs = performance.now() - t0;
  }

  /** Só no desenvolvimento: quanto custou o último desenho na GPU (ms) e o que a cena tem (painel de desempenho). */
  drawMs = 0;
  info() {
    const r = this.renderer.info;
    return {
      calls: r.render.calls,
      triangles: r.render.triangles,
      programs: r.programs?.length ?? 0,
      textures: r.memory.textures,
      geometries: r.memory.geometries,
    };
  }

  private updateCamera(dt: number, p: GpPose | null, car: GpCar | null) {
    const cam = this.camera;
    const speed = car ? Math.abs(car.speed) : 0;
    let fov = FAR_FOV;
    if (p && car) {
      const fx = Math.sin(p.h);
      const fz = -Math.cos(p.h);
      if (this.mode === 'far') {
        const k = 1 - Math.exp(-dt * 3);
        this.lead.x += (car.vx * 0.38 - this.lead.x) * k;
        this.lead.z += (car.vz * 0.38 - this.lead.z) * k;
        const tx = p.x + this.lead.x;
        const tz = p.z + this.lead.z;
        const dist = this.farDist * (1 + Math.min(1, speed / gpVmaxOf(this.world.mode)) * 0.25);
        this.camLook.set(tx, 0, tz);
        this.camPos.copy(this.camLook).addScaledVector(FAR_DIR, dist);
      } else if (this.mode === 'chase') {
        // atrás do carro, com atraso suave (a câmera "segura" na curva) e FOV que abre com a velocidade
        const want = this.chaseWant.set(p.x - fx * 7.2 * CAR_VIS, 2.7 * CAR_VIS, p.z - fz * 7.2 * CAR_VIS);
        if (!this.chaseInit) {
          this.chasePos.copy(want);
          this.chaseInit = true;
        }
        this.chasePos.lerp(want, 1 - Math.exp(-dt * 7));
        this.camPos.copy(this.chasePos);
        this.camLook.set(p.x + fx * 4 * CAR_VIS, 0.9 * CAR_VIS, p.z + fz * 4 * CAR_VIS);
        fov = 60 + Math.min(1, speed / gpVmaxOf(this.world.mode)) * 14;
      } else {
        // cockpit: o olho do piloto (atrás do halo), olhando para a frente e um pouco para baixo
        this.camPos.set(p.x + fx * 0.05 * CAR_VIS, 1.05 * CAR_VIS, p.z + fz * 0.05 * CAR_VIS);
        this.camLook.set(p.x + fx * 20, 0.55, p.z + fz * 20);
        fov = 74 + Math.min(1, speed / gpVmaxOf(this.world.mode)) * 6;
      }
    }
    cam.position.copy(this.camPos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.camLook);
    // tremida da câmera numa batida (de perto)
    if (this.mode !== 'far' && car && !this.reduced) {
      const v = this.cars.get(car.id);
      if (v && v.shake > 0) {
        cam.position.x += Math.sin(this.t * 70) * v.shake * 0.05;
        cam.position.y += Math.cos(this.t * 55) * v.shake * 0.04;
      }
    }
    // transição de uma câmera para outra (ease-in-out, 600 ms)
    if (this.camFrom && this.camMix < 1) {
      this.camMix = Math.min(1, this.camMix + dt / 0.6);
      const x = this.camMix;
      const e = x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
      const q = cam.quaternion.clone();
      cam.position.lerpVectors(this.camFrom.p, cam.position, e);
      cam.quaternion.slerpQuaternions(this.camFrom.q, q, e);
      fov = this.camFrom.fov + (fov - this.camFrom.fov) * e;
    }
    if (this.camShake > 0 && this.mode !== 'far') {
      cam.position.x += Math.sin(this.t * 83) * this.camShake * 0.12;
      cam.position.y += Math.cos(this.t * 71) * this.camShake * 0.09;
    }
    cam.near = this.mode === 'cockpit' ? 0.04 : this.mode === 'chase' ? 0.2 : 2;
    cam.fov = fov + (this.mode === 'far' ? 0 : this.boostFov);
    cam.updateProjectionMatrix();
    // volante e visor da marcha
    const inside = this.mode === 'cockpit' && this.camMix >= 1;
    this.cockpit.visible = inside;
    if (inside && car) {
      this.cockpitWheel.rotation.z = -car.steer * 1.1;
      const text = car.gear === 0 ? 'R' : String(car.gear);
      const ck = this.cockpitGear;
      if (ck.ctx && ck.last !== text) {
        ck.last = text;
        ck.ctx.fillStyle = '#0b0e17';
        ck.ctx.fillRect(0, 0, 128, 64);
        ck.ctx.fillStyle = '#ff7d26';
        ck.ctx.font = 'italic 900 48px "Saira Condensed", Inter, system-ui, sans-serif';
        ck.ctx.textAlign = 'center';
        ck.ctx.textBaseline = 'middle';
        ck.ctx.fillText(text, 64, 34);
        ck.tex.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const t of this.textures) t.dispose();
    for (const v of this.cars.values()) v.m.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.composer?.dispose();
    this.envTex?.dispose();
    this.renderer.dispose();
  }
}
