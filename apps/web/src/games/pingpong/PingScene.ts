import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  PP_EV_FLOOR,
  PP_EV_TABLE,
  PP_L,
  PP_NET_H,
  PP_NET_OVER,
  PP_PAD_R,
  PP_PAD_X,
  PP_PAD_Y_MAX,
  PP_PAD_Y_MIN,
  PP_PAD_Z,
  ppIncomingTier,
  PP_R,
  PP_TOP,
  PP_W,
  ppCopyBall,
  ppNewBall,
  ppNewStepOut,
  ppPaddleTilt,
  ppStepBall,
  type PpEvent,
  type PpMatch,
} from '@nocap/games';
import { buildHero, mapEdge } from '../atravessa/models';
import { PpBallView, type BallHistory } from './ball-view';

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
  private spinRing!: THREE.Mesh;
  /** Guia de posição: pontos discretos no chão por onde a bola vai passar depois do quique. */
  private guideDots: THREE.Mesh[] = [];
  private guideOn = true;
  private guideAt = 0;
  private guideBall = ppNewBall();
  private guideOut = ppNewStepOut();
  private trailLine!: THREE.Line;
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

  /** Partida online: a bola do outro lado espera um instante pela batida dele e os saltos de correção viram deslizes. */
  online = false;
  private view!: PpBallView;
  /** Quem guarda o histórico da partida em rede (para a bola desenhada recomeçar de onde o outro bateu). */
  set sim(v: BallHistory | null) {
    this.view.sim = v;
  }

  /** A sua própria batida: a bola desenhada deixa de chegar atrasada e desliza para a da partida. */
  localHit() {
    this.view.localHit();
  }

  /** Chamar logo depois de a partida refazer o passado. */
  absorb(lateTicks = 0) {
    this.view.absorb(lateTicks);
    this.prev.valid = false;
  }

  constructor(
    canvas: HTMLCanvasElement,
    private match: PpMatch,
    opts: { oppColor: number; oppName: string; reduced: boolean; me?: number },
    private reduced = opts.reduced,
  ) {
    this.me = opts.me === 1 ? 1 : 0;
    this.view = new PpBallView(match, this.me);
    this.flip = this.me === 1;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !touch || (window.devicePixelRatio || 1) < 2,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // celular: tela de alta densidade (iPhone = 3x) desenhada em quase toda a resolução, com um teto de pixels para não
    // pesar; se o aparelho não aguentar, a resolução desce sozinha (veja `adapt`)
    this.maxRatio = Math.min(window.devicePixelRatio || 1, touch ? 3 : 2);
    this.ratio = this.maxRatio;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // salão escuro (fundo em degradê), como no 3D Table Tennis de referência
    this.scene.background = canvasTex(2, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#0b0d12');
      gr.addColorStop(0.55, '#171a22');
      gr.addColorStop(1, '#2a2f3b');
      g.fillStyle = gr;
      g.fillRect(0, 0, 2, 256);
    });
    this.scene.fog = new THREE.Fog(0x2a2f3b, 19, 56);
    mapEdge.uEdge.value = 1e6;

    this.scene.add(new THREE.HemisphereLight(0xd6deff, 0x2a2d35, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(4.2, 14.5, 6.4);
    sun.target.position.set(0, PP_TOP, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 34;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.7);
    fill.position.set(-8, 8, -5);
    this.scene.add(fill);

    this.buildFloor();
    this.buildTable();
    this.net = this.buildNet();
    this.scene.add(this.net);

    // bola
    this.ball = new THREE.Group();
    const bt = canvasTex(256, 128, (g) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#f28c28';
      g.fillRect(0, 56, 256, 16); // faixa no equador
      g.fillRect(60, 0, 14, 128); // e duas de polo a polo: dá para ver o giro
      g.fillRect(188, 0, 14, 128);
    });
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PP_R, 32, 20),
      new THREE.MeshStandardMaterial({ map: bt, roughness: 0.45, metalness: 0 }),
    );
    this.ballMesh.castShadow = true;
    this.ball.add(this.ballMesh);
    this.ball.scale.setScalar(1.25);
    // anel do efeito: gira em torno do eixo do giro; vermelho = topspin, azul = corte, amarelo = efeito de lado
    this.spinRing = new THREE.Mesh(
      new THREE.TorusGeometry(PP_R * 2.3, PP_R * 0.16, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.spinRing.visible = false;
    this.scene.add(this.spinRing);
    for (let i = 0; i < 7; i++) {
      const d = new THREE.Mesh(
        new THREE.RingGeometry(0.11, 0.17, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      d.rotation.x = -Math.PI / 2;
      d.visible = false;
      this.guideDots.push(d);
      this.scene.add(d);
    }
    // rastro: uma linha fina que acompanha a bola
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
    this.trailLine = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.trailLine.frustumCulled = false;
    this.trailLine.visible = false;
    this.scene.add(this.trailLine);
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(PP_R * 1.15, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    for (let i = 0; i < 28; i++) {
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
    this.fox.scale.setScalar(1.25);
    this.fox.rotation.y = Math.PI;
    this.fox.position.set(0, 0, -(PP_PAD_Z + 2.3));
    this.scene.add(this.fox);
    this.tag = this.nameTag(opts.oppName);
    this.tag.position.set(0, 2.2, -(PP_PAD_Z + 2.3));
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

  private buildFloor() {
    // piso do salão e tapete vermelho debaixo da mesa (como no jogo de referência)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(PP_W * 4.3, PP_L * 3.4),
      new THREE.MeshStandardMaterial({ color: 0x6e2222, roughness: 0.9 }),
    );
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.004;
    mat.receiveShadow = true;
    this.scene.add(mat);
  }

  private buildTable() {
    const g = new THREE.Group();
    const slabH = 0.14;
    const slab = new THREE.Mesh(
      new RoundedBoxGeometry(PP_W + 0.08, slabH, PP_L + 0.08, 4, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x10203c, roughness: 0.55, metalness: 0.05 }),
    );
    slab.position.y = PP_TOP - slabH / 2;
    g.add(slab);
    // tampo com as linhas
    const tex = canvasTex(768, 1404, (c) => {
      c.fillStyle = '#1d4e9e';
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
      new THREE.MeshLambertMaterial({ color: 0x10203c }),
    );
    apron.position.y = PP_TOP - slabH - 0.06;
    g.add(apron);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f36,
      roughness: 0.7,
      metalness: 0.2,
    });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, PP_TOP - slabH, 0.14), legMat);
        leg.position.set(sx * (PP_W / 2 - 0.3), (PP_TOP - slabH) / 2, sz * (PP_L / 2 - 0.35));
        g.add(leg);
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.05, 0.26),
          new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7 }),
        );
        foot.position.set(sx * (PP_W / 2 - 0.3), 0.025, sz * (PP_L / 2 - 0.35));
        g.add(foot);
      }
    g.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh) {
        mm.castShadow = true;
        mm.receiveShadow = true;
      }
    });
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
      new THREE.MeshLambertMaterial({ color: 0xc9a46a }),
    );
    rim.rotation.x = Math.PI / 2;
    const outline = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.07, r * 1.07, 0.075, 48),
      new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
    );
    outline.rotation.x = Math.PI / 2;
    g.add(
      outline,
      rim,
      face(mine ? 0xd62b2b : 0x1e1e22, -0.027, true),
      face(mine ? 0xd62b2b : 0x1e1e22, 0.027, false),
    );
    // cabo
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.2, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xc9a46a }),
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
    cam.fov = 50;
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
      cam.lookAt(0, 0.8, -1.2);
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
        // deitado a pessoa quer enxergar mais e mexer a raquete para os lados: a câmera fica mais para trás
        const back = cam.aspect > 1.5 ? 1.28 : 1;
        this.camZ = z * back;
        this.camY = z * back * ratio;
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
    cam.lookAt(tx, 0.8, -1.2);
    const fov = 50 + this.fovKick * 3;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  private maxRatio = 1;
  private ratio = 1;
  private slowFor = 0;
  /** Teto de pixels desenhados por quadro (largura x altura x densidade²): tela grande de celular continua nítida e leve. */
  private static readonly MAX_PIXELS = 4_200_000;

  private applyRatio(w: number, h: number) {
    const cap = Math.sqrt(PingScene.MAX_PIXELS / Math.max(1, w * h));
    const r = Math.max(1, Math.min(this.ratio, cap));
    if (Math.abs(this.renderer.getPixelRatio() - r) > 0.01) this.renderer.setPixelRatio(r);
  }

  /** Se os quadros demoram muito por um bom tempo, baixa um pouco a resolução (nunca abaixo de 1,25). */
  private adapt(dt: number) {
    if (dt > 0.25) return;
    if (dt > 0.034) this.slowFor += dt;
    else this.slowFor = Math.max(0, this.slowFor - dt * 2);
    if (this.slowFor > 1.5 && this.ratio > 1.3) {
      this.ratio = Math.max(1.25, this.ratio * 0.8);
      this.slowFor = 0;
      this.applyRatio(this.size.w, this.size.h);
      this.renderer.setSize(this.size.w, this.size.h, false);
    }
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.applyRatio(w, h);
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

  /** Liga ou desliga o guia de posição (opção do menu). */
  setGuide(on: boolean) {
    this.guideOn = on;
    if (!on) for (const d of this.guideDots) d.visible = false;
  }

  /**
   * O guia: para a bola que vem na sua direção, marca no chão (sem dizer "bata aqui") por onde ela passa depois do
   * quique: o primeiro ponto é o do quique (bater na hora do quique), os seguintes mostram o caminho se você esperar. Vai
   * mudando enquanto a bola anda.
   */
  private updateGuide(dt: number) {
    const m = this.match;
    const b = m.ball;
    const sign = this.me === 0 ? 1 : -1;
    const show =
      this.guideOn &&
      m.phase === 'rally' &&
      m.expect === this.me &&
      b.vz * sign > 0 &&
      !this.reduced;
    if (!show) {
      for (const d of this.guideDots) d.visible = false;
      return;
    }
    this.guideAt -= dt;
    if (this.guideAt <= 0) {
      this.guideAt = 0.05;
      const s = ppCopyBall(b, this.guideBall);
      const out = this.guideOut;
      let bounced = (m.bounces[this.me] ?? 0) >= 1;
      let n = 0;
      let sinceDot = 0;
      const put = (x: number, z: number, k: number) => {
        const d = this.guideDots[n];
        if (!d) return;
        const onTable = Math.abs(x) <= PP_W / 2 && Math.abs(z) <= PP_L / 2;
        d.visible = true;
        d.position.set(this.vx(x), (onTable ? PP_TOP : 0.004) + 0.012, this.vz(z));
        const mt = d.material as THREE.MeshBasicMaterial;
        mt.opacity = clamp(0.5 - k * 0.055, 0.12, 0.5);
        d.scale.setScalar(k === 0 ? 1.1 : 0.85);
        n++;
      };
      if (bounced) put(b.x, b.z, 0);
      for (let i = 0; i < 700 && n < 7; i++) {
        out.ev = 0;
        ppStepBall(s, out);
        if (out.ev & PP_EV_FLOOR) break;
        if (out.ev & PP_EV_TABLE) {
          if (!bounced && out.side === this.me) {
            bounced = true;
            put(out.bx, out.bz, 0);
            sinceDot = 0;
            continue;
          }
          if (bounced) break; // segundo quique na sua mesa: a bola morreu
        }
        if (bounced) {
          sinceDot++;
          if (sinceDot >= 22) {
            sinceDot = 0;
            if (Math.abs(s.z) > PP_PAD_Z + 1.2) break;
            put(s.x, s.z, n);
          }
        }
      }
      for (let i = n; i < this.guideDots.length; i++) this.guideDots[i]!.visible = false;
    }
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
    this.adapt(dt);
    this.time += dt;
    this.updateGuide(dt);
    const m = this.match;
    const cur = m.ball;
    const pv = this.prev;
    // posição desenhada = mistura do tick anterior com o de agora (sem mistura se a bola "pulou")
    let a = pv.valid ? clamp(alpha, 0, 1) : 1;
    if (
      pv.valid &&
      !this.online &&
      Math.hypot(cur.x - pv.ball.x, cur.y - pv.ball.y, cur.z - pv.ball.z) > 1.2
    )
      a = 1;
    let sx = lerp(pv.ball.x, cur.x, a);
    let sy = lerp(pv.ball.y, cur.y, a);
    let sz = lerp(pv.ball.z, cur.z, a);
    if (this.online) {
      const v = this.view.update(dt, { x: sx, y: sy, z: sz }, a);
      sx = v.x;
      sy = v.y;
      sz = v.z;
    } else {
      this.view.shown.x = sx;
      this.view.shown.y = sy;
      this.view.shown.z = sz;
    }
    const bx = this.vx(sx);
    const by = sy;
    const bz = this.vz(sz);
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
    const showTrail = tier > 0 && m.phase !== 'serve' && !this.reduced;
    const heat = tier > 0 ? 1 : clamp((speed - 12) / 8, 0, 1);
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
      sm.opacity = (0.08 + 0.4 * heat) * k;
      // só um borrão de movimento claro; o smash cronometrado leva um rastro roxo, mais claro quanto melhor o acerto
      sm.color.setHex(
        tier >= 3 ? 0xd9b3ff : tier === 2 ? 0xa86bff : tier === 1 ? 0x8a58e0 : 0xdfe9ff,
      );
    }

    // anel do efeito (eixo e cor do giro) e rastro em linha
    {
      const w = Math.hypot(cur.wx, cur.wy, cur.wz);
      if (m.phase === 'rally') {
        // o círculo em volta da bola: o eixo é o do efeito (se a bola quase não gira, fica de frente) e a cor diz a
        // velocidade da bola, indo ou vindo: verde = lenta, amarelo = média, vermelho = rápida
        this.spinRing.visible = true;
        this.spinRing.position.set(bx, by, bz);
        if (w > 14) {
          const ax = this.vx(cur.wx) / w;
          const ay = cur.wy / w;
          const az = this.vz(cur.wz) / w;
          this.spinRing.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(ax, ay, az),
          );
        } else this.spinRing.quaternion.identity();
        const tierNow = ppIncomingTier(Math.hypot(cur.vx, cur.vz));
        const mt = this.spinRing.material as THREE.MeshBasicMaterial;
        mt.color.setHex(tierNow === 0 ? 0x3fe08a : tierNow === 1 ? 0xffd34d : 0xff5a4a);
        mt.opacity = 0.75 + 0.2 * clamp(w / 60, 0, 1);
      } else this.spinRing.visible = false;
      const pts = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
      const n = Math.min(this.trailPos.length, 28);
      const inFlight = m.phase === 'rally' && !this.reduced && n > 2;
      for (let i = 0; i < 28; i++) {
        const q = this.trailPos[Math.min(i, n - 1)];
        if (q) pts.setXYZ(i, q.x, q.y, q.z);
      }
      pts.needsUpdate = true;
      this.trailLine.visible = inFlight && (m.trailTier > 0 || speed > 12);
      const lm = this.trailLine.material as THREE.LineBasicMaterial;
      const tr = m.trailTier;
      lm.color.setHex(
        tr >= 3
          ? 0xe7b8ff
          : tr === 2
            ? 0xb455ff
            : tr === 1
              ? 0x9a5bff
              : speed > 16
                ? 0xffe3b0
                : 0xffffff,
      );
      // rastro simples: some quando a bola está devagar e fica mais firme (sem brilho) quando ela está rápida
      lm.opacity = tr > 0 ? 0.9 : clamp((speed - 12) / 9, 0, 1) * 0.8;
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
