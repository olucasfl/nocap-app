import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  PP_L,
  PP_NET_H,
  PP_NET_OVER,
  PP_PAD_R,
  PP_PAD_X,
  PP_PAD_Y_MAX,
  PP_PAD_Y_MIN,
  PP_PAD_Z,
  PP_R,
  PP_TOP,
  PP_W,
  ppPaddleTilt,
  type PpEvent,
  type PpMatch,
} from '@nocap/games';
import { buildHero, mapEdge } from '../atravessa/models';

const INK = 0x1b1535;
const ORANGE = 0xff7d26;

function canvasTex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Um ponto de luz macio (rastro da bola, faíscas). */
function glowTex(): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
}

interface Spark {
  s: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
}
interface Ring {
  m: THREE.Mesh;
  t: number;
  max: number;
  grow: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * A cena do Ping Fox!: mesa, rede, raquetes, bola, a raposa do outro lado e os efeitos de leitura (sombra e marcador
 * de quique, anel de alcance). Não tem regra nenhuma: só lê a `PpMatch` e desenha, interpolando entre dois ticks do
 * motor (60 Hz) para o movimento sair liso em telas de 120 ou 144 Hz.
 */
export class PingScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
  private size = { w: 0, h: 0 };
  private disposed = false;
  private glow = glowTex();

  // bola
  private ball: THREE.Group;
  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private trail: THREE.Sprite[] = [];
  private trailPos: { x: number; y: number; z: number }[] = [];
  // raquetes
  private pads: { g: THREE.Group; blade: THREE.Group }[] = [];
  private arm: THREE.Mesh;
  private paw: THREE.Mesh;
  // raposa do outro lado
  private fox: THREE.Group;
  private foxX = 0;
  private tag: THREE.Sprite | null = null;
  // rede
  private net: THREE.Group;
  private netShake = 0;
  // marcadores
  // efeitos
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private shake = 0;
  private fovKick = 0;
  private time = 0;
  private padTilt: { pitch: number; yaw: number; roll: number }[] = [];
  /** Quem olha: 0 ou 1 (quem joga do lado de lá vê a mesa girada, como se estivesse perto da câmera). */
  private me = 0;
  private flip = false;

  // estado do tick anterior (para interpolar)
  private prev = {
    ball: { x: 0, y: 1.25, z: 2.5 },
    pads: [
      { x: 0, y: 1.3, reach: 0 },
      { x: 0, y: 1.3, reach: 0 },
    ],
    valid: false,
  };

  constructor(
    canvas: HTMLCanvasElement,
    private match: PpMatch,
    opts: { oppColor: number; oppName: string; reduced: boolean; me?: number },
    private reduced = opts.reduced,
  ) {
    this.me = opts.me === 1 ? 1 : 0;
    this.flip = this.me === 1;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !touch,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.7 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x0a0e26);
    this.scene.fog = new THREE.Fog(0x0a0e26, 26, 70);
    mapEdge.uEdge.value = 1e6;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3170, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 9, 5);
    this.scene.add(sun);

    this.buildFloor();
    this.buildScenery();
    this.buildTable();
    this.net = this.buildNet();
    this.scene.add(this.net);

    // bola
    this.ball = new THREE.Group();
    const bt = canvasTex(256, 128, (g) => {
      g.fillStyle = '#f6f4ee';
      g.fillRect(0, 0, 256, 128);
      // marca pequena e discreta: dá para ver o giro sem enfeitar a bola
      g.fillStyle = '#c9c6bd';
      g.fillRect(0, 60, 256, 8);
      g.fillStyle = '#9a9890';
      g.font = '700 22px sans-serif';
      g.textAlign = 'center';
      g.fillText('***', 64, 50);
    });
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PP_R, 32, 20),
      new THREE.MeshStandardMaterial({ map: bt, roughness: 0.45, metalness: 0 }),
    );
    this.ball.add(this.ballMesh);
    this.ball.scale.setScalar(1.25);
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(PP_R * 1.15, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: 0xdfe9ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      s.visible = false;
      this.trail.push(s);
      this.scene.add(s);
    }

    // raquetes e braço da raposa do outro lado
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const blade = this.buildPaddle(i === 0);
      if (i === 0) {
        // a sua raquete fica meio transparente: a bola passa "atrás" dela e continua à vista
        blade.traverse((o) => {
          const mm = o as THREE.Mesh;
          const mats = Array.isArray(mm.material) ? mm.material : mm.material ? [mm.material] : [];
          for (const mt of mats) {
            mt.transparent = true;
            mt.opacity = Math.min(mt.opacity, 0.88);
            mt.depthWrite = false;
          }
        });
      }
      g.add(blade);
      this.pads.push({ g, blade });
      this.scene.add(g);
    }
    const orange = new THREE.MeshLambertMaterial({ color: ORANGE });
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1), orange);
    this.paw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), orange);
    this.scene.add(this.arm, this.paw);

    this.fox = buildHero({ fur: opts.oppColor, own: true });
    this.fox.scale.setScalar(1.7);
    this.fox.rotation.y = Math.PI;
    this.fox.position.set(0, 0, -(PP_PAD_Z + 1.2));
    this.scene.add(this.fox);
    this.tag = this.nameTag(opts.oppName);
    this.tag.position.set(0, 2.5, -(PP_PAD_Z + 1.2));
    this.scene.add(this.tag);

    // marcadores de leitura
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.085, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.rings.push({ m, t: 1, max: 0.35, grow: 3 });
      this.scene.add(m);
    }
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      s.visible = false;
      this.sparks.push({ s, vx: 0, vy: 0, vz: 0, life: 0, max: 0.4, size: 0.1 });
      this.scene.add(s);
    }
    this.placeCamera(1);
  }

  // ---------- construção ----------

  /**
   * O cenário, de ginásio de campeonato: piso escuro com a marca grande, tapete de quadra azul, placas de LED em volta,
   * torcida em silhueta na arquibancada e refletores. Tudo em tons escuros para a mesa e a bola se destacarem.
   */
  private buildScenery() {
    const S = this.scene;
    // tapete de quadra azul-escuro debaixo da mesa, com linhas brancas
    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(PP_W + 6, PP_L + 7.5),
      new THREE.MeshLambertMaterial({
        map: canvasTex(256, 256, (g) => {
          g.fillStyle = '#16307a';
          g.fillRect(0, 0, 256, 256);
          g.strokeStyle = 'rgba(255,255,255,0.85)';
          g.lineWidth = 5;
          g.strokeRect(8, 8, 240, 240);
          // arranhados leves do piso
          g.strokeStyle = 'rgba(255,255,255,0.05)';
          g.lineWidth = 1;
          for (let i = 0; i < 24; i++) {
            g.beginPath();
            g.moveTo(Math.random() * 256, Math.random() * 256);
            g.lineTo(Math.random() * 256, Math.random() * 256);
            g.stroke();
          }
        }),
      }),
    );
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.003;
    S.add(mat);

    // marca grande no piso (como nos ginásios de campeonato)
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.6),
      new THREE.MeshBasicMaterial({
        map: canvasTex(512, 128, (g) => {
          g.clearRect(0, 0, 512, 128);
          g.font = '900 96px "Arial Black", Impact, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = 'rgba(255,255,255,0.10)';
          g.fillText('NO CAP!', 256, 68);
        }),
        transparent: true,
        depthWrite: false,
      }),
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 0.004, PP_L / 2 + 3.4);
    S.add(logo);

    // placas de LED em volta da quadra (fundo e laterais)
    const board = (w: number, x: number, z: number, ry: number, hue: number) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.95, 0.12),
        new THREE.MeshBasicMaterial({
          map: canvasTex(512, 64, (g) => {
            const gr = g.createLinearGradient(0, 0, 512, 0);
            gr.addColorStop(0, hue ? '#c4232d' : '#1d4fd8');
            gr.addColorStop(0.5, hue ? '#2a1b66' : '#102a7a');
            gr.addColorStop(1, hue ? '#1d4fd8' : '#c4232d');
            g.fillStyle = gr;
            g.fillRect(0, 0, 512, 64);
            g.fillStyle = 'rgba(255,255,255,0.9)';
            g.font = '900 38px "Arial Black", Impact, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText('NO CAP!', 128, 34);
            g.fillText('NO CAP!', 384, 34);
          }),
        }),
      );
      b.position.set(x, 0.48, z);
      b.rotation.y = ry;
      S.add(b);
    };
    const wallZ = -12;
    for (const x of [-9, 0, 9]) board(9, x, wallZ, 0, x === 0 ? 1 : 0);
    for (const sx of [-1, 1]) {
      board(9, sx * 13.5, wallZ + 4.2, (sx * -Math.PI) / 2, 0);
      board(9, sx * 13.5, wallZ + 13.2, (sx * -Math.PI) / 2, 1);
      board(9, sx * 13.5, wallZ + 22.2, (sx * -Math.PI) / 2, 0);
    }

    // parede escura do fundo
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 18),
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 96, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, 96);
          gr.addColorStop(0, '#05081c');
          gr.addColorStop(1, '#16204f');
          g.fillStyle = gr;
          g.fillRect(0, 0, 256, 96);
        }),
        fog: false,
      }),
    );
    wall.position.set(0, 9, wallZ - 3.5);
    S.add(wall);

    // arquibancada com a torcida em silhueta (tons escuros, só uns toques de cor)
    const tones = [0x1a2145, 0x232b57, 0x2b2f5e, 0x1d2a4f, 0x30264f, 0x7a2a3a, 0x2a4f8f];
    const step = new THREE.MeshLambertMaterial({ color: 0x151a3a });
    const crowd = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.2, 0.34, 2, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      3 * 46,
    );
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    let n = 0;
    for (let row = 0; row < 3; row++) {
      const z = wallZ - 0.4 - row * 1.25;
      const y = 0.95 + row * 0.95;
      const st = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5 + row * 0.95, 1.2), step);
      st.position.set(0, (0.5 + row * 0.95) / 2 + 0.3, z);
      S.add(st);
      for (let i = 0; i < 46; i++) {
        const seed = Math.sin((row * 46 + i) * 12.9898) * 43758.5453;
        const r = seed - Math.floor(seed);
        m4.makeTranslation(-21 + i * 0.93 + (row % 2) * 0.4, y + 0.55 + r * 0.1, z);
        crowd.setMatrixAt(n, m4);
        crowd.setColorAt(
          n,
          c.setHex(tones[Math.floor(r * tones.length) % tones.length] ?? 0x1a2145),
        );
        n++;
      }
    }
    S.add(crowd);

    // refletores no teto, com um brilho leve
    const lamp = new THREE.MeshBasicMaterial({ color: 0xf4f7ff, fog: false });
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.5), lamp);
      bar.position.set(i * 5.2, 9.4, -3);
      S.add(bar);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow,
          color: 0xdfe9ff,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      glow.scale.set(6, 2.4, 1);
      glow.position.set(i * 5.2, 9.2, -3);
      S.add(glow);
    }
  }

  private buildFloor() {
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#0f1334';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#12173b';
      g.fillRect(0, 0, 128, 128);
      g.fillRect(128, 128, 128, 128);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 48),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // sombra mole da mesa no chão
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(PP_W + 2.2, PP_L + 2.4),
      new THREE.MeshBasicMaterial({
        map: canvasTex(128, 128, (g) => {
          const r = g.createRadialGradient(64, 64, 8, 64, 64, 64);
          r.addColorStop(0, 'rgba(0,0,0,0.55)');
          r.addColorStop(0.6, 'rgba(0,0,0,0.3)');
          r.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = r;
          g.fillRect(0, 0, 128, 128);
        }),
        transparent: true,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.004;
    this.scene.add(blob);
  }

  private buildTable() {
    const g = new THREE.Group();
    const slabH = 0.14;
    const slab = new THREE.Mesh(
      new RoundedBoxGeometry(PP_W + 0.08, slabH, PP_L + 0.08, 4, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x14308f, roughness: 0.5, metalness: 0.05 }),
    );
    slab.position.y = PP_TOP - slabH / 2;
    g.add(slab);
    // tampo com as linhas
    const tex = canvasTex(768, 1404, (c) => {
      c.fillStyle = '#2f6fcf';
      c.fillRect(0, 0, 768, 1404);
      const gr = c.createLinearGradient(0, 0, 0, 1404);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 768, 1404);
      // faixas de brilho bem suaves, para o tampo não parecer um bloco chapado
      c.strokeStyle = '#ffffff';
      c.lineWidth = 12;
      c.strokeRect(18, 18, 768 - 36, 1404 - 36);
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(384, 18);
      c.lineTo(384, 1386);
      c.stroke();
    });
    tex.anisotropy = 8;
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(PP_W, PP_L),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.02 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = PP_TOP + 0.001;
    g.add(top);
    // a borda de baixo e as pernas
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(PP_W - 0.5, 0.12, PP_L - 0.5),
      new THREE.MeshLambertMaterial({ color: 0xb3202b }),
    );
    apron.position.y = PP_TOP - slabH - 0.06;
    g.add(apron);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x1b2a66 });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, PP_TOP - slabH, 0.14), legMat);
        leg.position.set(sx * (PP_W / 2 - 0.3), (PP_TOP - slabH) / 2, sz * (PP_L / 2 - 0.35));
        g.add(leg);
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.05, 0.26),
          new THREE.MeshLambertMaterial({ color: 0xb3202b }),
        );
        foot.position.set(sx * (PP_W / 2 - 0.3), 0.025, sz * (PP_L / 2 - 0.35));
        g.add(foot);
      }
    this.scene.add(g);
  }

  private buildNet(): THREE.Group {
    const g = new THREE.Group();
    const w = PP_W + PP_NET_OVER * 2;
    const tex = canvasTex(512, 96, (c) => {
      c.fillStyle = 'rgba(15,10,40,0.28)';
      c.fillRect(0, 0, 512, 96);
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 2;
      for (let x = 0; x <= 512; x += 10) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, 96);
        c.stroke();
      }
      for (let y = 0; y <= 96; y += 10) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(512, y);
        c.stroke();
      }
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, PP_NET_H),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.set(0, PP_TOP + PP_NET_H / 2, 0);
    g.add(mesh);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.035, 0.014),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    tape.position.set(0, PP_TOP + PP_NET_H, 0);
    g.add(tape);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, PP_NET_H + 0.08, 14),
        new THREE.MeshLambertMaterial({ color: INK }),
      );
      post.position.set(sx * (w / 2), PP_TOP + (PP_NET_H + 0.08) / 2 - 0.02, 0);
      g.add(post);
      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshLambertMaterial({ color: ORANGE }),
      );
      clamp.position.set(sx * (w / 2), PP_TOP + 0.04, 0);
      g.add(clamp);
    }
    return g;
  }

  /** Raquete: lâmina de borracha vermelha de um lado e preta do outro, aro de madeira, cabo e a pata de raposa. */
  private buildPaddle(mine: boolean): THREE.Group {
    const g = new THREE.Group();
    const r = 0.34;
    const face = (color: number, z: number, flip: boolean) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.96, 48),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 }),
      );
      m.position.z = z;
      if (flip) m.rotation.y = Math.PI;
      return m;
    };
    // a face de bater olha para -z (a rede) quando a raquete é a de perto; o grupo gira para a do outro lado
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.05, 48),
      new THREE.MeshLambertMaterial({ color: 0xe0b878 }),
    );
    rim.rotation.x = Math.PI / 2;
    const outline = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.07, r * 1.07, 0.075, 48),
      new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
    );
    outline.rotation.x = Math.PI / 2;
    g.add(outline, rim, face(0xe3262f, -0.027, true), face(0x1b1535, 0.027, false));
    // cabo
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.2, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xc58a4a }),
    );
    handle.position.set(0, -r - 0.07, 0);
    const handleLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.05, 0.08),
      new THREE.MeshLambertMaterial({ color: INK }),
    );
    handleLine.position.set(0, -r - 0.13, 0);
    g.add(handle, handleLine);
    if (mine) {
      // a pata de quem joga segura o cabo (a raposa fica "atrás da câmera")
      const paw = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 12),
        new THREE.MeshLambertMaterial({ color: ORANGE }),
      );
      paw.scale.set(1, 0.9, 1.05);
      paw.position.set(0, -r - 0.13, 0.03);
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16),
        new THREE.MeshLambertMaterial({ color: 0xfff3e2 }),
      );
      cuff.position.set(0, -r - 0.22, 0.03);
      g.add(paw, cuff);
    }
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  }

  private nameTag(name: string): THREE.Sprite {
    const tex = canvasTex(256, 64, (g) => {
      g.font = '900 34px Archivo, Arial Black, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = '#1b1535';
      g.strokeText(name.slice(0, 14), 128, 34);
      g.fillStyle = '#ffffff';
      g.fillText(name.slice(0, 14), 128, 34);
    });
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    s.scale.set(1.9, 0.48, 1);
    return s;
  }

  // ---------- câmera e entrada ----------

  private camZ = 7;
  private camY = 3.4;
  private camDirty = true;
  /**
   * Afasta a câmera (na mesma inclinação) só até a mesa inteira e a raquete caberem na tela, em qualquer formato de
   * aparelho (celular em pé, deitado, computador).
   */
  private fitCamera() {
    this.camDirty = false;
    const cam = this.camera;
    cam.fov = 42;
    cam.updateProjectionMatrix();
    const pts: [number, number, number][] = [];
    const hx = PP_W / 2 + 0.35;
    for (const sx of [-1, 1]) {
      pts.push([sx * hx, PP_TOP, PP_L / 2 + 0.35], [sx * hx, PP_TOP, -PP_L / 2 - 0.1]);
      pts.push([sx * 0.5, 1.9, PP_PAD_Z], [sx * 0.5, 0.9, PP_PAD_Z]);
    }
    const ratio = 0.46; // a mesma inclinação em pé e deitado: a visão é parecida, só cabe mais para os lados
    const v = new THREE.Vector3();
    for (let z = 6; z < 40; z += 0.1) {
      cam.position.set(0, z * ratio, z);
      cam.lookAt(0, 0.9, -0.6);
      cam.updateMatrixWorld();
      let ok = true;
      for (const p of pts) {
        v.set(p[0], p[1], p[2]).project(cam);
        if (Math.abs(v.x) > 0.86 || v.y < -0.9 || v.y > 0.74) {
          ok = false;
          break;
        }
      }
      if (ok) {
        this.camZ = z;
        this.camY = z * ratio;
        return;
      }
    }
    this.camZ = 12;
    this.camY = 6;
  }

  private placeCamera(dt: number) {
    const m = this.match;
    const bx = this.vx(m.ball.x);
    const k = 1 - Math.exp(-4 * dt);
    if (this.camDirty) this.fitCamera();
    const tx = bx * 0.18;
    const cam = this.camera;
    const baseZ = this.camZ;
    const baseY = this.camY;
    cam.position.x = lerp(cam.position.x, tx * 0.7, k);
    cam.position.y = baseY;
    cam.position.z = baseZ;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0 && !this.reduced) {
      sx = (Math.random() - 0.5) * this.shake * 0.12;
      sy = (Math.random() - 0.5) * this.shake * 0.12;
    }
    cam.position.x += sx;
    cam.position.y += sy;
    cam.lookAt(tx, 0.9, -0.6);
    const fov = 42 + this.fovKick * 3;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.camDirty = true;
  }

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PP_PAD_Z);
  private hitPoint = new THREE.Vector3();
  /** Onde o ponteiro cai no plano da raquete (já limitado ao alcance). `lift` sobe a raquete (o dedo não cobre). */
  pointerToPlane(nx: number, ny: number, lift = 0): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hitPoint)) return { x: 0, y: 1.3 };
    return {
      x: clamp(this.hitPoint.x, -PP_PAD_X, PP_PAD_X),
      y: clamp(this.hitPoint.y + lift, PP_PAD_Y_MIN, PP_PAD_Y_MAX),
    };
  }

  private tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.4);
  /** Onde o ponteiro cai num plano horizontal na altura da raquete (sobre a mesa): x e profundidade z da vista. */
  pointerToTable(nx: number, ny: number, planeY = 1.4): { x: number; z: number } {
    this.tablePlane.constant = -planeY;
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.camera);
    if (!this.ray.ray.intersectPlane(this.tablePlane, this.hitPoint)) return { x: 0, z: PP_PAD_Z };
    return { x: this.hitPoint.x, z: this.hitPoint.z };
  }

  /** O x da vista (o da tela) no x do motor. */
  simX(viewX: number): number {
    return this.flip ? -viewX : viewX;
  }

  /** Onde um ponto do mundo cai na tela (0 a 1 de cada lado); serve aos testes e às dicas. */
  project(x: number, y: number, z: number): { nx: number; ny: number } {
    this.camera.updateMatrixWorld();
    const v = this.tmp.set(x, y, z).project(this.camera);
    return { nx: (v.x + 1) / 2, ny: (1 - v.y) / 2 };
  }

  // ---------- quadro a quadro ----------

  /** Guarda o estado de agora como "o anterior" (chamar logo antes de cada tick do motor). */
  snap() {
    const m = this.match;
    this.prev.ball.x = m.ball.x;
    this.prev.ball.y = m.ball.y;
    this.prev.ball.z = m.ball.z;
    this.prev.pads[0] = { x: m.pad(0).x, y: m.pad(0).y, reach: m.pad(0).reach };
    this.prev.pads[1] = { x: m.pad(1).x, y: m.pad(1).y, reach: m.pad(1).reach };
    this.prev.valid = true;
  }

  /** Cancela a interpolação do próximo quadro (a bola "pulou" de lugar: saque, ponto). */
  jump() {
    this.prev.valid = false;
  }

  /** Reage aos eventos do motor (faíscas, anéis, rede, tremida). */
  handle(events: readonly PpEvent[], me: number = this.me) {
    const m = this.match;
    const bx = this.vx(m.ball.x);
    const bz = this.vz(m.ball.z);
    for (const e of events) {
      if (e.type === 'hit') {
        // para onde a bola vai, na tela: de quem é a minha vista, sai para o fundo (-z); de quem está do outro lado, para perto
        const dirZ = e.p === this.me ? -1 : 1;
        const power = clamp((e.kmh - 20) / 80, 0, 1);
        // poucas faíscas pequenas e brancas; o smash cronometrado leva faíscas roxas
        this.burst(
          bx,
          m.ball.y,
          bz,
          dirZ,
          e.tier > 0 ? 8 + e.tier * 3 : 3 + Math.round(power * 3),
          e.tier > 0 ? 0xb98bff : 0xffffff,
        );
        if (e.tier > 0) {
          this.shake = Math.max(this.shake, 0.35 + e.tier * 0.15);
          this.fovKick = 0.3 + e.tier * 0.1;
        } else if (e.smash) {
          this.shake = Math.max(this.shake, 0.5);
          this.fovKick = 0.4;
        } else if (e.p === me) this.shake = Math.max(this.shake, 0.08 + power * 0.14);
        this.jump();
      } else if (e.type === 'bounce') {
        // sem anel: só a sombra e o som contam o quique
      } else if (e.type === 'net') {
        this.netShake = 1;
        this.shake = Math.max(this.shake, 0.4);
      } else if (e.type === 'toss' || e.type === 'point' || e.type === 'fault') {
        this.jump();
        if (e.type === 'point') this.shake = Math.max(this.shake, 0.5);
      }
    }
  }

  private burst(x: number, y: number, z: number, dirZ: number, n: number, color: number) {
    if (this.reduced) return;
    let made = 0;
    for (const p of this.sparks) {
      if (p.life > 0) continue;
      p.life = p.max = 0.18 + Math.random() * 0.14;
      p.s.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      p.vx = Math.cos(a) * sp * 0.7;
      p.vy = Math.sin(a) * sp * 0.7 + 0.6;
      p.vz = dirZ * (0.6 + Math.random() * 1.6);
      p.size = 0.035 + Math.random() * 0.05;
      (p.s.material as THREE.SpriteMaterial).color.setHex(color);
      p.s.visible = true;
      if (++made >= n) break;
    }
  }

  private ringAt(x: number, y: number, z: number, color: number, max: number, grow: number) {
    if (this.reduced) return;
    const r = this.rings.find((q) => q.t >= q.max) ?? this.rings[0];
    if (!r) return;
    r.t = 0;
    r.max = max;
    r.grow = grow;
    r.m.position.set(x, y, z);
    (r.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.m.visible = true;
  }

  /** Do mundo do motor para o da tela: quem joga de lá vê x e z invertidos. */
  private vx(x: number) {
    return this.flip ? -x : x;
  }
  private vz(z: number) {
    return this.flip ? -z : z;
  }

  private tmp = new THREE.Vector3();
  private axis = new THREE.Vector3();

  render(dt: number, alpha: number) {
    if (this.disposed) return;
    this.time += dt;
    const m = this.match;
    const cur = m.ball;
    const pv = this.prev;
    // posição desenhada = mistura do tick anterior com o de agora (sem mistura se a bola "pulou")
    let a = pv.valid ? clamp(alpha, 0, 1) : 1;
    if (pv.valid && Math.hypot(cur.x - pv.ball.x, cur.y - pv.ball.y, cur.z - pv.ball.z) > 1.2)
      a = 1;
    const bx = this.vx(lerp(pv.ball.x, cur.x, a));
    const by = lerp(pv.ball.y, cur.y, a);
    const bz = this.vz(lerp(pv.ball.z, cur.z, a));
    this.ball.position.set(bx, by, bz);
    // giro: o eixo e a rapidez vêm do efeito (rad/s), um pouco abrandados para a faixa continuar legível
    const w = Math.hypot(cur.wx, cur.wy, cur.wz);
    if (w > 0.5 && m.phase !== 'serve') {
      // girar o mundo meia volta em y inverte x e z, e o eixo do efeito vai junto
      this.axis.set(this.vx(cur.wx) / w, cur.wy / w, this.vz(cur.wz) / w);
      this.ballMesh.rotateOnWorldAxis(this.axis, w * 0.45 * dt);
    }

    // sombra da bola: no tampo se está sobre ele, senão no chão
    const overTable = Math.abs(bx) < PP_W / 2 && Math.abs(bz) < PP_L / 2 && by > PP_TOP;
    const floorY = overTable ? PP_TOP + 0.004 : 0.006;
    const h = Math.max(0, by - floorY);
    this.ballShadow.position.set(bx, floorY, bz);
    const sk = 1 + h * 0.35;
    this.ballShadow.scale.set(sk, sk, sk);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = clamp(
      0.5 - h * 0.12,
      0.12,
      0.5,
    );
    this.ballShadow.visible = by > PP_R * 0.8;

    // rastro
    const speed = Math.hypot(cur.vx, cur.vy, cur.vz);
    this.trailPos.unshift({ x: bx, y: by, z: bz });
    if (this.trailPos.length > this.trail.length) this.trailPos.pop();
    const tier = m.trailTier;
    const showTrail = (speed > 9 || tier > 0) && m.phase !== 'serve' && !this.reduced;
    const heat = tier > 0 ? 1 : clamp((speed - 9) / 7, 0, 1);
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i];
      const p = this.trailPos[i + 1];
      if (!s) continue;
      if (!showTrail || !p) {
        s.visible = false;
        continue;
      }
      const k = 1 - i / this.trail.length;
      s.visible = true;
      s.position.set(p.x, p.y, p.z);
      s.scale.setScalar(PP_R * (2 + 1.6 * heat + tier * 0.7) * k + 0.02);
      const sm = s.material as THREE.SpriteMaterial;
      sm.opacity = (0.1 + 0.32 * heat) * k;
      // só um borrão de movimento claro; o smash cronometrado leva um rastro roxo, mais claro quanto melhor o acerto
      sm.color.setHex(
        tier >= 3 ? 0xd9b3ff : tier === 2 ? 0xa86bff : tier === 1 ? 0x8a58e0 : 0xdfe9ff,
      );
    }

    // raquetes: a de quem olha é a primeira (perto da câmera), a do outro lado é a segunda. A raquete avança com a mão
    // (alcance) e a face se inclina como na batida: subir abre a face, descer fecha, o lado vira a face para o lado.
    for (let v = 0; v < 2; v++) {
      const i = v === 0 ? this.me : 1 - this.me;
      const pad = m.pad(i);
      const pp = pv.pads[i] ?? { x: pad.x, y: pad.y, reach: pad.reach };
      const px = this.vx(lerp(pp.x, pad.x, a));
      const rawZ = PP_PAD_Z - lerp(pp.reach, pad.reach, a);
      // sobre a mesa a raquete sobe um pouco (o cabo não entra no tampo)
      const overTable =
        clamp((PP_L / 2 + 0.25 - rawZ) / 0.35, 0, 1) *
        clamp((PP_W / 2 + 0.45 - Math.abs(px)) / 0.35, 0, 1);
      const py = lerp(pp.y, pad.y, a) + 0.22 * overTable;
      const reach = lerp(pp.reach, pad.reach, a);
      const slot = this.pads[v];
      if (!slot) continue;
      const side = v === 0 ? 1 : -1;
      slot.g.position.set(px, py, side * PP_PAD_Z - side * reach);
      slot.g.rotation.set(0, v === 0 ? 0 : Math.PI, 0);
      const tilt = ppPaddleTilt(pad.vx, pad.vy, pad.vz);
      const yawView = this.flip ? -tilt.yaw : tilt.yaw;
      const k = 1 - Math.exp(-28 * dt);
      const cur = this.padTilt[v] ?? { pitch: 0, yaw: 0, roll: 0 };
      // a raquete vira para o lado em que a mão vai (a cabeça acompanha o movimento)
      // a raquete se inclina conforme o lado da mesa em que está: no meio fica reta, à direita inclina para a direita, à
      // esquerda para a esquerda (o cabo sai de cima da mesa), mais um pouco do movimento da mão
      const rollGoal =
        clamp((this.vx(pad.x) / PP_PAD_X) * 0.85 + this.vx(pad.vx) * 0.012, -0.95, 0.95) *
        (v === 0 ? -1 : 1);
      cur.roll = lerp(cur.roll, rollGoal, k);
      cur.pitch = lerp(cur.pitch, tilt.pitch, k);
      cur.yaw = lerp(cur.yaw, yawView, k);
      this.padTilt[v] = cur;
      // com a batida o disco dá um pequeno "tapa" na bola: a raquete se inclina um instante para a frente
      const pulse = pad.swing > 0 ? Math.sin(pad.swing * Math.PI) * 0.18 : 0;
      slot.blade.rotation.set(cur.pitch - pulse, v === 0 ? -cur.yaw : cur.yaw, cur.roll);
    }

    // raposa do outro lado: acompanha a raquete, com um balanço
    const opp = m.pad(1 - this.me);
    this.foxX = lerp(this.foxX, this.vx(opp.x) * 0.7, 1 - Math.exp(-9 * dt));
    this.fox.position.x = this.foxX;
    this.fox.position.y = Math.abs(Math.sin(this.time * 3)) * 0.04;
    this.fox.rotation.z = clamp(this.vx(opp.vx) * 0.012, -0.12, 0.12);
    if (this.tag) this.tag.position.x = this.foxX;
    const padO = this.pads[1];
    if (padO) {
      // o braço vai do ombro da raposa à pata no cabo da raquete
      const handle = this.tmp.set(
        padO.g.position.x,
        padO.g.position.y - PP_PAD_R - 0.28,
        padO.g.position.z - 0.02,
      );
      const shoulder = { x: this.foxX - 0.25, y: 1.25, z: this.fox.position.z + 0.5 };
      this.arm.position.set(
        (shoulder.x + handle.x) / 2,
        (shoulder.y + handle.y) / 2,
        (shoulder.z + handle.z) / 2,
      );
      this.arm.scale.z = Math.hypot(
        handle.x - shoulder.x,
        handle.y - shoulder.y,
        handle.z - shoulder.z,
      );
      this.arm.lookAt(handle);
      this.paw.position.copy(handle);
    }

    // rede balança quando a bola bate
    this.netShake = Math.max(0, this.netShake - dt * 2.2);
    this.net.rotation.x = Math.sin(this.time * 38) * 0.05 * this.netShake;

    this.updateFx(dt);
    this.placeCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 3.2);
    this.fovKick = Math.max(0, this.fovKick - dt * 3);
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      p.vy -= 9 * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const k = p.life / p.max;
      p.s.scale.setScalar(p.size * (0.4 + k));
      (p.s.material as THREE.SpriteMaterial).opacity = k;
    }
    for (const r of this.rings) {
      if (r.t >= r.max) {
        r.m.visible = false;
        continue;
      }
      r.t += dt;
      const k = clamp(r.t / r.max, 0, 1);
      r.m.scale.setScalar(1 + k * r.grow);
      (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
    }
  }

  dispose() {
    this.disposed = true;
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) {
        const any = mt as THREE.MeshBasicMaterial;
        if (any.map && !seen.has(any.map)) {
          seen.add(any.map);
          any.map.dispose();
        }
        mt.dispose();
      }
    });
    this.glow.dispose();
    this.renderer.dispose();
  }
}
