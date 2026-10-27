import * as THREE from 'three';
import {
  BOL_BALL_R,
  BOL_FLIP_SEC,
  BOL_GOAL_DEPTH,
  BOL_GOAL_H,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  type BolPlayer,
  type BolWorld,
} from '@nocap/games';
import { buildHero, mapEdge } from '../atravessa/models';

/** Câmera de perseguição: atrás da raposa, olhando por cima do ombro para a bola. */
/** Distância da câmera até a raposa (m). */
const CAM_DIST = 8.6;
/** O muro termina acima da rampa (que sobe até BOL_RAMP_R na parede). */
const WALL_H = 2.8;
const GLASS_H = 4.2;
const NET_DEPTH = BOL_GOAL_DEPTH;
const PHI = (1 + Math.sqrt(5)) / 2;

interface Fox {
  group: THREE.Group;
  body: THREE.Object3D;
  shadow: THREE.Mesh;
  wasGrounded: boolean;
  lastVy: number;
  /** Nome, cor e time com que foi desenhada. */
  sig: string;
  /** Há quanto tempo o mortal começou (s); -1 fora dele. Local, para valer também para quem vem da rede. */
  flipAge: number;
}

const tmp = new THREE.Vector3();

/** O campo, a bola e as raposas do Fut Fox. Só desenha: quem manda é o `BolWorld`. */
export class BolaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);
  private foxes = new Map<string, Fox>();
  /** Os gols por time, para fechar (cinza) os dos times que ficaram fora da prorrogação. */
  private goalGroups = new Map<number, THREE.Group>();
  private closedKey = '';
  private ball: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  /** Marca no chão sob a bola: aparece quando ela voa e mostra onde ela está na horizontal. */
  private landRing!: THREE.Mesh;
  private landDisc!: THREE.Mesh;
  private yaw = 0;
  /** Altura da câmera em radianos; `null` = automática (câmera na bola). */
  private pitch: number | null = null;
  private camDist = CAM_DIST;
  private camFocus = new THREE.Vector3();
  private size = { w: 0, h: 0 };
  private disposed = false;
  private tags: THREE.Sprite[] = [];
  private shake = 0;
  /** Efeitos curtos (anéis do chute, rastro do mortal e da bola): só escala e opacidade. */
  private fx: {
    obj: THREE.Object3D;
    mat: THREE.Material & { opacity: number };
    /** Só nos clarões (sprites reaproveitados): se é aditivo, para devolver ao grupo certo. */
    glowAdd?: boolean;
    age: number;
    life: number;
    s0: number;
    s1: number;
    o0: number;
    ring: boolean;
    /** Anel deitado no chão (não vira para a câmera). */
    flat: boolean;
  }[] = [];
  private kickTrail = 0;
  private kickColor = 0xffffff;
  private fovKick = 0;
  private baseFov = 60;
  private glowTex: THREE.Texture | null = null;
  private ballTrailT = 0;
  private glowPoolAdd: THREE.Sprite[] = [];
  private glowPoolNorm: THREE.Sprite[] = [];
  private bursts: {
    pts: THREE.Points;
    vel: Float32Array;
    age: number;
    life: number;
    delay: number;
  }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private world: BolWorld,
    private reduced = false,
  ) {
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !touch,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.6 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(0xcdeeff, 90, 220);
    // o escurecimento lateral é do Atravessa e vale para todos os materiais das raposas: aqui é tudo sol
    mapEdge.uEdge.value = 1e6;
    // sempre sol: luz branca de todos os lados, sem lado escuro
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(0, 40, 0);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xffffff, 2.6));
    this.buildField();
    this.ball = this.buildBall();
    this.ballShadow = this.blob(BOL_BALL_R * 1.1);
    this.landRing = new THREE.Mesh(
      new THREE.RingGeometry(0.74, 1, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.landDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.74, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    for (const m of [this.landRing, this.landDisc]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      m.visible = false;
      this.scene.add(m);
    }
    for (const p of world.players) this.addFox(p);
  }

  private blob(r: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    this.scene.add(m);
    return m;
  }

  private skyTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 256;
    const g = cv.getContext('2d');
    if (g) {
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#4aa8ff');
      grad.addColorStop(0.55, '#9fdcff');
      grad.addColorStop(0.8, '#cdeeff');
      grad.addColorStop(1, '#e6f7ff');
      g.fillStyle = grad;
      g.fillRect(0, 0, 4, 256);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Gramado com faixas de corte (largas, claras e escuras) e um pouco de ruído para não ficar chapado. */
  private grassTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d');
    if (g) {
      g.fillStyle = '#58c46a';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#4cb35f';
      g.fillRect(128, 0, 128, 128);
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,0,0.06)';
        g.fillRect(Math.random() * 256, Math.random() * 128, 2, 3);
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  /** Arquibancada: uma torcida de pontinhos coloridos. */
  private crowdTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      g.fillStyle = '#3a3f86';
      g.fillRect(0, 0, 256, 64);
      const pal = ['#ff6a5c', '#ffd23f', '#ffffff', '#4fc3f7', '#7be07b', '#ff9d2e', '#b98cff'];
      for (let y = 4; y < 64; y += 9) {
        for (let x = 3; x < 256; x += 8) {
          g.fillStyle = pal[Math.floor(Math.random() * pal.length)] as string;
          g.beginPath();
          g.arc(x + Math.random() * 3, y + Math.random() * 2, 2.6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x - 2, y + 3, 6, 3);
        }
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  /** Rede do gol: malha de linhas brancas em fundo transparente. */
  private netTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  private buildField() {
    const f = this.world.field;
    const hex = (n: number) => new THREE.Color(n);
    // gramado: as coordenadas do desenho viram as do mundo, então a textura se repete a cada 12 m
    const grassTex = this.grassTexture();
    grassTex.repeat.set(1 / 12, 1 / 12);
    const shape = new THREE.Shape(f.edges.map((e) => new THREE.Vector2(e.ax, -e.az)));
    const grass = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshLambertMaterial({ map: grassTex }),
    );
    grass.rotation.x = -Math.PI / 2;
    this.scene.add(grass);
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0x2f7d46 }),
    );
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.06;
    this.scene.add(far);

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const strip = (cx: number, cz: number, w: number, d: number, rot: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(cx, 0.02, cz);
      this.scene.add(m);
    };
    // linhas: borda, círculo central, ponto do meio, linha do meio (2 times) e a área de cada gol
    for (const e of f.edges) {
      const off = f.rampR + 0.3;
      strip(e.mx + e.nx * off, e.mz + e.nz * off, e.len + 0.05, 0.22, -Math.atan2(e.tz, e.tx));
    }
    this.buildRamps();
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.62, 64), lineMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), lineMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.02;
    this.scene.add(dot);
    if (f.teams === 2) {
      // linha do meio, perpendicular ao eixo entre os gols
      const maxZ = f.edges.reduce((m, e) => Math.max(m, Math.abs(e.az)), 0);
      strip(0, 0, 0.22, maxZ * 2 - 1.2, 0);
    }
    for (const g of f.goals) {
      const e = g.edge;
      const w = g.halfW * 2 + 7;
      const dpt = 7;
      const ang = -Math.atan2(e.tz, e.tx);
      const cx = e.mx + e.nx * dpt;
      const cz = e.mz + e.nz * dpt;
      strip(cx, cz, w, 0.2, ang);
      for (const s of [-1, 1])
        strip(
          e.mx + e.nx * (dpt / 2) + e.tx * (w / 2) * s,
          e.mz + e.nz * (dpt / 2) + e.tz * (w / 2) * s,
          0.2,
          dpt,
          ang,
        );
      // piso colorido do gol
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(g.halfW * 2 + 3, 7),
        new THREE.MeshBasicMaterial({
          color: BOL_TEAM_COLORS[g.team] ?? 0xffffff,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.rotation.z = ang;
      zone.position.set(e.mx + e.nx * 3.5, 0.025, e.mz + e.nz * 3.5);
      this.scene.add(zone);
    }

    // muros: base escura com friso claro, vidro por cima e arquibancada atrás
    const crowd = this.crowdTexture();
    const wallBody = new THREE.MeshLambertMaterial({ color: 0x2a2f6b });
    const wallCap = new THREE.MeshLambertMaterial({ color: 0xf3f1ff });
    const glass = new THREE.MeshBasicMaterial({
      color: 0xbfe8ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const crowdTex = new Map<number, THREE.Texture>();
    for (const e of f.edges) {
      const ang = Math.atan2(e.tz, e.tx);
      const goal = e.goal >= 0 ? f.goals[e.goal] : undefined;
      const teamCol = goal ? (BOL_TEAM_COLORS[goal.team] ?? 0xffffff) : 0xffd23f;
      const piece = (len: number, cx: number, cz: number) => {
        if (len <= 0.05) return;
        // trechos curtos (os arcos dos cantos) passam um pouco do fim para não deixar fresta entre um e o outro
        len += e.len < 6 ? 0.3 : 0;
        const grp = new THREE.Group();
        grp.position.set(cx - e.nx * 0.35, 0, cz - e.nz * 0.35);
        grp.rotation.y = -ang;
        // nas paredes ao lado do gol o muro inteiro tem a cor do time dono dele
        const bodyMat = goal
          ? new THREE.MeshLambertMaterial({ color: hex(teamCol).multiplyScalar(0.7) })
          : wallBody;
        const capMat = goal ? new THREE.MeshLambertMaterial({ color: hex(teamCol) }) : wallCap;
        const body = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, 0.7), bodyMat);
        body.position.y = WALL_H / 2;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.9), capMat);
        cap.position.y = WALL_H + 0.09;
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.22, 0.72),
          new THREE.MeshBasicMaterial({ color: hex(teamCol) }),
        );
        stripe.position.y = WALL_H - 0.25;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, GLASS_H), glass);
        pane.position.set(0, WALL_H + 0.18 + GLASS_H / 2, 0.1);
        grp.add(body, cap, stripe, pane);
        this.scene.add(grp);
      };
      if (!goal) {
        piece(e.len, e.mx, e.mz);
        // arquibancada em 3 degraus
        const short = e.len < 6;
        for (let i = 0; i < 3; i++) {
          const h = 2.4 + i * 1.7;
          const key = Math.max(1, Math.round(e.len / 14));
          let tex = crowdTex.get(key);
          if (!tex) {
            tex = crowd.clone();
            tex.needsUpdate = true;
            tex.repeat.set(key, 1);
            crowdTex.set(key, tex);
          }
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(short ? e.len + 0.9 : Math.max(1, e.len - 1), h, 2.6),
            new THREE.MeshLambertMaterial({ map: tex }),
          );
          step.position.set(e.mx - e.nx * (1.9 + i * 2.6), h / 2, e.mz - e.nz * (1.9 + i * 2.6));
          step.rotation.y = -ang;
          this.scene.add(step);
        }
        continue;
      }
      const side = (e.len - goal.halfW * 2) / 2;
      const off = goal.halfW + side / 2;
      piece(side, e.mx - e.tx * off, e.mz - e.tz * off);
      piece(side, e.mx + e.tx * off, e.mz + e.tz * off);
      this.buildGoal(goal.team, e.mx, e.mz, e.nx, e.nz, goal.halfW);
    }
    // holofotes nos cantos para dar escala
    for (const e of f.edges) {
      if (e.len < 6) continue;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 15, 8),
        new THREE.MeshLambertMaterial({ color: 0x5b5f9e }),
      );
      post.position.set(e.ax - e.nx * 4.5, 7.5, e.az - e.nz * 4.5);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.6, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
      );
      lamp.position.set(e.ax - e.nx * 4.5, 15.2, e.az - e.nz * 4.5);
      this.scene.add(post, lamp);
    }
  }

  /** Rampa entre o chão e as paredes: um quarto de cilindro côncavo ao longo de cada trecho de parede (menos na boca dos gols). */
  private buildRamps() {
    const f = this.world.field;
    const R = f.rampR;
    const steps = 8;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const low = new THREE.Color(0x56c274);
    const high = new THREE.Color(0x2f8a4b);
    const piece = (e: (typeof f.edges)[number], t0: number, t1: number, tint: number | null) => {
      if (t1 - t0 < 0.05) return;
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      const tone = tint === null ? null : new THREE.Color(tint);
      for (let j = 0; j <= steps; j++) {
        // d = distância da parede; y = altura da rampa nesse ponto
        const d = R - (R * j) / steps;
        const y = R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d)));
        const c = low.clone().lerp(high, y / R);
        if (tone) c.lerp(tone, 0.35 * (y / R));
        for (const t of [t0, t1]) {
          pos.push(e.mx + e.tx * t + e.nx * d, y, e.mz + e.tz * t + e.nz * d);
          col.push(c.r, c.g, c.b);
        }
        if (j > 0) {
          const a = (j - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(geo, mat));
      // friso luminoso onde a rampa encontra o muro: mostra de longe onde a bola começa a subir
      const tm = (t0 + t1) / 2;
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(t1 - t0, 0.16),
        new THREE.MeshBasicMaterial({ color: tint ?? 0xffd23f, side: THREE.DoubleSide }),
      );
      line.position.set(e.mx + e.tx * tm + e.nx * 0.03, R - 0.05, e.mz + e.tz * tm + e.nz * 0.03);
      line.rotation.y = -Math.atan2(e.tz, e.tx);
      this.scene.add(line);
    };
    for (const e of f.edges) {
      const half = e.len / 2 + 0.04;
      const goal = e.goal >= 0 ? f.goals[e.goal] : undefined;
      if (!goal) {
        piece(e, -half, half, null);
        continue;
      }
      const tint = BOL_TEAM_COLORS[goal.team] ?? null;
      piece(e, -half, -goal.halfW, tint);
      piece(e, goal.halfW, half, tint);
    }
  }

  /** Gol: traves grossas, travessão, rede em malha (fundo, laterais e teto) e uma faixa do time. */
  private buildGoal(team: number, mx: number, mz: number, nx: number, nz: number, halfW: number) {
    const g = new THREE.Group();
    g.position.set(mx, 0, mz);
    // o eixo +z do grupo aponta para fora do campo
    g.rotation.y = Math.atan2(-nx, -nz);
    const col = BOL_TEAM_COLORS[team] ?? 0xffffff;
    // traves e travessão na cor do time: dá para saber de quem é o gol de longe
    const post = new THREE.MeshLambertMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.25,
    });
    const tube = (r: number, len: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    for (const s of [-1, 1]) {
      const front = tube(0.22, BOL_GOAL_H, post);
      front.position.set(halfW * s, BOL_GOAL_H / 2, 0);
      const back = tube(0.1, BOL_GOAL_H * 0.7, post);
      back.position.set(halfW * s, (BOL_GOAL_H * 0.7) / 2, NET_DEPTH);
      const top = tube(0.1, NET_DEPTH, post);
      top.rotation.x = Math.PI / 2;
      top.position.set(halfW * s, BOL_GOAL_H, NET_DEPTH / 2);
      g.add(front, back, top);
    }
    const bar = tube(0.22, halfW * 2, post);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, BOL_GOAL_H, 0);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.6, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    base.position.set(0, 0.09, NET_DEPTH);
    g.add(bar, base);
    const net = this.netTexture();
    const panel = (w: number, h: number, setup: (m: THREE.Mesh) => void) => {
      const tex = net.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 0.45)), Math.max(1, Math.round(h / 0.45)));
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          opacity: 0.85,
          color: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35),
        }),
      );
      setup(m);
      g.add(m);
    };
    panel(halfW * 2, BOL_GOAL_H, (m) => m.position.set(0, BOL_GOAL_H / 2, NET_DEPTH));
    for (const s of [-1, 1]) {
      panel(NET_DEPTH, BOL_GOAL_H, (m) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(halfW * s, BOL_GOAL_H / 2, NET_DEPTH / 2);
      });
    }
    panel(halfW * 2, NET_DEPTH, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(0, BOL_GOAL_H, NET_DEPTH / 2);
    });
    // placa com o nome do time em cima do gol, virada para o campo
    const sign = this.teamSign(team);
    sign.position.set(0, BOL_GOAL_H + 1.5, 0.2);
    sign.rotation.y = Math.PI;
    g.add(sign);
    // tampa cinza que aparece quando o gol é fechado (time fora da prorrogação)
    const lid = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, BOL_GOAL_H),
      new THREE.MeshBasicMaterial({
        color: 0x6f6f78,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    lid.position.set(0, BOL_GOAL_H / 2, 0.05);
    lid.name = 'goal-lid';
    lid.visible = false;
    g.add(lid);
    this.goalGroups.set(team, g);
    this.scene.add(g);
  }

  /** Fecha (cinza) o gol dos times que ficaram de fora da prorrogação e reabre os outros. */
  setClosedGoals(out: readonly boolean[]) {
    const key = out.map((o) => (o ? 1 : 0)).join('');
    if (key === this.closedKey) return;
    this.closedKey = key;
    for (const [team, g] of this.goalGroups) {
      const closed = !!out[team];
      g.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        if (o.name === 'goal-lid') {
          o.visible = closed;
          return;
        }
        const mat = o.material as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        if (!mat.color) return;
        const store = (o.userData.orig ??= {
          color: mat.color.getHex(),
          emissive: mat.emissive?.getHex(),
        }) as { color: number; emissive?: number };
        mat.color.setHex(closed ? 0x6f6f78 : store.color);
        if (mat.emissive && store.emissive !== undefined) {
          mat.emissive.setHex(closed ? 0x000000 : store.emissive);
        }
      });
    }
  }

  /** Placa do time: o nome em letras grandes sobre a cor dele. */
  private teamSign(team: number): THREE.Mesh {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const g = cv.getContext('2d');
    const col = `#${(BOL_TEAM_COLORS[team] ?? 0xffffff).toString(16).padStart(6, '0')}`;
    if (g) {
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(6, 6, 500, 116, 22);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#1b1535';
      g.stroke();
      g.font = '900 64px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 10;
      g.strokeStyle = '#1b1535';
      g.fillStyle = '#ffffff';
      const text = (BOL_TEAM_NAMES[team] ?? '').toUpperCase();
      g.strokeText(text, 256, 68);
      g.fillText(text, 256, 68);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 1.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
  }

  /** Bola de futebol: 12 pentágonos escuros e 20 hexágonos brancos, desenhados pixel a pixel numa textura. */
  private ballTexture(): THREE.Texture {
    const W = 512;
    const H = 256;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const centers: { v: [number, number, number]; dark: boolean }[] = [];
    const push = (x: number, y: number, z: number, dark: boolean) => {
      const l = Math.hypot(x, y, z);
      centers.push({ v: [x / l, y / l, z / l], dark });
    };
    // pentágonos nos vértices do icosaedro, hexágonos nas faces (vértices do dodecaedro)
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        push(0, a, b * PHI, true);
        push(a, b * PHI, 0, true);
        push(b * PHI, 0, a, true);
        for (const c of [-1, 1]) push(a, b, c, false);
        push(0, a / PHI, b * PHI, false);
        push(a / PHI, b * PHI, 0, false);
        push(b * PHI, 0, a / PHI, false);
      }
    }
    if (g) {
      const img = g.createImageData(W, H);
      for (let py = 0; py < H; py++) {
        const lat = Math.PI / 2 - ((py + 0.5) / H) * Math.PI;
        for (let px = 0; px < W; px++) {
          const lon = ((px + 0.5) / W) * Math.PI * 2;
          const dx = Math.cos(lat) * Math.cos(lon);
          const dy = Math.sin(lat);
          const dz = Math.cos(lat) * Math.sin(lon);
          let best = -2;
          let second = -2;
          let dark = false;
          for (const c of centers) {
            const d = dx * c.v[0] + dy * c.v[1] + dz * c.v[2];
            if (d > best) {
              second = best;
              best = d;
              dark = c.dark;
            } else if (d > second) second = d;
          }
          const seam = best - second < 0.03;
          const i = (py * W + px) * 4;
          const col = seam ? 90 : dark ? 28 : 250;
          img.data[i] = col;
          img.data[i + 1] = seam ? 90 : dark ? 21 : 250;
          img.data[i + 2] = seam ? 100 : dark ? 53 : 252;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  private buildBall(): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(BOL_BALL_R, 40, 28),
      new THREE.MeshPhongMaterial({ map: this.ballTexture(), shininess: 55, specular: 0x666666 }),
    );
    this.scene.add(m);
    return m;
  }

  private addFox(p: BolPlayer) {
    const group = new THREE.Group();
    const hero = buildHero({ fur: p.color, own: true });
    const body = new THREE.Group();
    body.position.y = 0.6;
    hero.position.y = -0.6;
    body.add(hero);
    group.add(body);
    group.add(this.nameTag(p.name, BOL_TEAM_COLORS[p.team] ?? 0xffffff));
    this.scene.add(group);
    this.foxes.set(p.id, {
      group,
      body,
      shadow: this.blob(0.55),
      wasGrounded: true,
      lastVy: 0,
      sig: `${p.name}|${p.color}|${p.team}`,
      flipAge: -1,
    });
  }

  /** Quem entra no meio da partida (ou muda de nome ao virar bot) ganha o corpo sem refazer o campo. */
  sync() {
    const ids = new Set(this.world.players.map((p) => p.id));
    for (const p of this.world.players) {
      const old = this.foxes.get(p.id);
      // o mesmo id pode virar outro corpo (troca de time): se a cor ou o nome mudou, refaz a raposa
      if (old && old.sig !== `${p.name}|${p.color}|${p.team}`) {
        this.scene.remove(old.group, old.shadow);
        this.foxes.delete(p.id);
      }
      if (!this.foxes.has(p.id)) this.addFox(p);
    }
    for (const [id, f] of this.foxes) {
      if (ids.has(id)) continue;
      this.scene.remove(f.group, f.shadow);
      this.foxes.delete(id);
    }
  }

  private nameTag(name: string, color: number): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      g.font = '800 30px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const text = name.length > 14 ? `${name.slice(0, 13)}…` : name;
      const w = Math.min(244, g.measureText(text).width + 28);
      g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      g.beginPath();
      g.roundRect(128 - w / 2, 8, w, 48, 16);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#1b1535';
      g.stroke();
      g.fillStyle = '#ffffff';
      g.lineWidth = 5;
      g.strokeStyle = '#1b1535';
      g.strokeText(text, 128, 33);
      g.fillText(text, 128, 33);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }),
    );
    sprite.scale.set(2.8, 0.7, 1);
    sprite.position.y = 2.05;
    sprite.renderOrder = 10;
    this.tags.push(sprite);
    return sprite;
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.baseFov = this.camera.aspect < 1 ? 78 : 60;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /** Para os testes: onde a câmera está e onde a bola aparece na tela (-1 a 1). */
  debugCamera() {
    const b = this.world.ball;
    const v = new THREE.Vector3(b.x, b.y, b.z).project(this.camera);
    const c = this.camera.position;
    return { x: c.x, y: c.y, z: c.z, ndc: [v.x, v.y, v.z] };
  }

  setPitch(p: number | null) {
    this.pitch = p;
  }

  setYaw(yaw: number) {
    this.yaw = yaw;
  }

  getYaw() {
    return this.yaw;
  }

  /** Comemoração: confete na boca do gol e fogos sobre o campo, só partículas (nada de DOM). */
  celebrate(goalTeam: number, color: number) {
    const f = this.world.field;
    const g = f.goals[goalTeam];
    const palette = [color, 0xffffff, 0xffd23f, color, 0xff6a5c, 0x4fc3f7];
    const make = (
      x: number,
      y: number,
      z: number,
      n: number,
      speed: number,
      up: number,
      delay: number,
      life: number,
    ) => {
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        pos.set([x, y, z], i * 3);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * speed;
        vel.set([Math.cos(a) * r, up * (0.5 + Math.random()), Math.sin(a) * r], i * 3);
        c.set(palette[Math.floor(Math.random() * palette.length)] as number);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 7,
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      pts.visible = delay <= 0;
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.bursts.push({ pts, vel, age: 0, life, delay });
    };
    if (g) make(g.edge.mx + g.edge.nx * 1.5, 1.6, g.edge.mz + g.edge.nz * 1.5, 220, 7, 11, 0, 4.2);
    // fogos sobre o meio do campo, escalonados
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 7;
      make(Math.cos(a) * r, 9 + Math.random() * 4, Math.sin(a) * r, 140, 8, 3, 0.5 + i * 0.7, 2.6);
    }
  }

  private glow(): THREE.Texture {
    if (this.glowTex) return this.glowTex;
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    this.glowTex = new THREE.CanvasTexture(cv);
    return this.glowTex;
  }

  private addGlow(
    x: number,
    y: number,
    z: number,
    color: number,
    size: number,
    life: number,
    opacity = 0.85,
    additive = true,
  ) {
    // clarões são muitos e curtos: reaproveita sprite e material em vez de criar (e descartar) um por quadro
    const pool = additive ? this.glowPoolAdd : this.glowPoolNorm;
    let sp = pool.pop();
    if (!sp) {
      sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glow(),
          transparent: true,
          depthWrite: false,
          blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          fog: false,
        }),
      );
    }
    const mat = sp.material;
    mat.color.setHex(color);
    mat.opacity = opacity;
    sp.position.set(x, y, z);
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.fx.push({
      obj: sp,
      mat,
      glowAdd: additive,
      age: 0,
      life,
      s0: size,
      s1: size * 0.3,
      o0: opacity,
      ring: false,
      flat: false,
    });
  }

  /** Anel fino que se abre e some. `flat`: deitado no chão; senão, sempre de frente para a câmera. */
  private addRing(
    x: number,
    y: number,
    z: number,
    color: number,
    to: number,
    life: number,
    opts: { delay?: number; flat?: boolean; opacity?: number } = {},
  ) {
    const { delay = 0, flat = false, opacity = 0.9 } = opts;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity,
    });
    // sem teste de profundidade: o anel aparece inteiro, mesmo a parte que passaria por baixo do gramado
    mat.depthTest = !!flat;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), mat);
    m.renderOrder = flat ? 1 : 12;
    m.position.set(x, y, z);
    if (flat) m.rotation.x = -Math.PI / 2;
    m.visible = delay <= 0;
    this.scene.add(m);
    this.fx.push({
      obj: m,
      mat,
      age: -delay,
      life,
      s0: 0.6,
      s1: to,
      o0: opacity,
      ring: true,
      flat,
    });
  }

  /** Segundo pulo: anel no ponto do impulso e, no mortal, poeira na cor do time atrás da raposa. */
  jumpFx(id: string, flip: boolean) {
    const p = this.world.players.find((q) => q.id === id);
    if (!p) return;
    const team = BOL_TEAM_COLORS[p.team] ?? 0xffffff;
    this.addRing(p.x, Math.max(0.06, p.y), p.z, team, flip ? 2.4 : 1.8, 0.35, {
      flat: true,
      opacity: 0.8,
    });
    if (this.reduced || !flip) return;
    const dx = Math.sin(p.heading);
    const dz = Math.cos(p.heading);
    for (let i = 1; i <= 5; i++) {
      this.addGlow(
        p.x - dx * i * 0.5,
        p.y + 0.5,
        p.z - dz * i * 0.5,
        i % 2 ? 0xffffff : team,
        1.2 - i * 0.12,
        0.28,
        0.8,
        false,
      );
    }
  }

  /**
   * O chute pegou: um clarão, dois anéis finos que se abrem (um branco, um na cor do time), um anel deitado no chão, uma
   * cauda de cometa apontando para onde a bola foi e um rastro na cor do time. Limpo, mas dá para ler de longe de
   * quem foi o chute, para onde ele vai e com que força.
   */
  kickFx(id: string, vel?: { vx: number; vy: number; vz: number }, mine = false) {
    const b = this.world.ball;
    const p = this.world.players.find((q) => q.id === id);
    const team = p ? (BOL_TEAM_COLORS[p.team] ?? 0xffffff) : 0xffffff;
    const v = vel ?? b;
    const sp = Math.hypot(v.vx, v.vy, v.vz) || 1;
    const power = Math.min(1, Math.max(0.4, sp / 28));
    this.addGlow(b.x, b.y, b.z, 0xffffff, 3.4 + power * 1.8, 0.2, 1, false);
    this.addRing(b.x, b.y, b.z, 0xffffff, 3 + power * 2, 0.4);
    this.addRing(b.x, b.y, b.z, team, 3.8 + power * 2.6, 0.48, { delay: 0.05 });
    this.addRing(b.x, 0.06, b.z, team, 4 + power * 2.6, 0.5, { flat: true, opacity: 0.7 });
    if (this.reduced) return;
    // cauda de cometa: pontos que ficam no ar atrás da bola, na direção contrária à do chute
    const dx = v.vx / sp;
    const dy = v.vy / sp;
    const dz = v.vz / sp;
    for (let i = 1; i <= 14; i++) {
      const t = i * 0.45;
      this.addGlow(
        b.x - dx * t,
        Math.max(0.2, b.y - dy * t),
        b.z - dz * t,
        i % 2 ? 0xffffff : team,
        1.7 - i * 0.1,
        0.3 + i * 0.02,
        0.85 - i * 0.04,
        false,
      );
    }
    this.kickTrail = 0.9;
    this.kickColor = team;
    // a câmera só reage ao seu chute: o dos outros, lá longe, não pode mexer na sua tela
    if (mine) {
      this.fovKick = Math.max(this.fovKick, 1);
      this.shake = Math.max(this.shake, 0.22);
    }
  }

  /** O anel cresce um pouco com a altura e só aparece quando a bola sai do chão (rente a ele seria redundante). */
  private updateLandingMark(x: number, y: number, z: number) {
    const floor = this.world.field.floorAt(x, z);
    const height = Math.max(0, y - BOL_BALL_R - floor);
    const fade = this.world.phase === 'play' ? Math.min(1, height / 0.6) : 0;
    const on = fade > 0.02;
    this.landRing.visible = on;
    this.landDisc.visible = on;
    if (!on) return;
    const r = 1 + Math.min(1.6, height * 0.05);
    this.landRing.position.set(x, floor + 0.06, z);
    this.landDisc.position.set(x, floor + 0.055, z);
    this.landRing.scale.set(r, r, 1);
    this.landDisc.scale.set(r, r, 1);
    (this.landRing.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
    (this.landDisc.material as THREE.MeshBasicMaterial).opacity = 0.24 * fade;
  }

  shakeNow(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  render(dt: number, focusId: string) {
    if (this.disposed) return;
    const b = this.world.ball;
    this.ball.position.set(b.x, b.y, b.z);
    // a bola gira conforme anda
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.05) {
      this.ball.rotation.x += (b.vz * dt) / BOL_BALL_R;
      this.ball.rotation.z -= (b.vx * dt) / BOL_BALL_R;
    }
    {
      const floor = this.world.field.floorAt(b.x, b.z);
      const h = Math.max(0, b.y - BOL_BALL_R - floor);
      const sh = this.ballShadow;
      sh.visible = this.world.phase !== 'over';
      sh.position.set(b.x, floor + 0.05, b.z);
      const k = 1 + Math.min(1.2, h * 0.08);
      sh.scale.set(k, k, 1);
      (sh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.32 - h * 0.025);
    }
    this.updateLandingMark(b.x, b.y, b.z);
    for (const p of this.world.players) {
      const fox = this.foxes.get(p.id);
      if (!fox) continue;
      fox.group.position.set(p.x, p.y, p.z);
      fox.group.rotation.y = p.heading + Math.PI;
      // sem sombra no chão: sempre sol
      fox.shadow.visible = false;
      const speed = Math.hypot(p.vx, p.vz);
      // poeira ao pousar de um pulo (e um fiapo ao arrancar correndo)
      if (!this.reduced) {
        if (p.grounded && !fox.wasGrounded && fox.lastVy < -3)
          this.addGlow(
            p.x,
            p.y + 0.25,
            p.z,
            0xeef7d8,
            1.5 + Math.min(1.2, -fox.lastVy * 0.12),
            0.45,
            0.4,
            false,
          );
        fox.wasGrounded = p.grounded;
        fox.lastVy = p.vy;
      }
      const squash = p.grounded
        ? 1 + Math.sin(this.world.clock * 18 + p.x) * 0.04 * Math.min(1, speed / 3)
        : 1.08;
      fox.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      const pitch = p.grounded ? Math.min(0.18, speed * 0.03) : 0.25;
      // o mortal: uma volta completa para a frente (a raposa já olha para onde vai), com saída suave
      if (p.flipT > 0 && fox.flipAge < 0) fox.flipAge = 0;
      if (fox.flipAge >= 0) {
        fox.flipAge += dt;
        if (fox.flipAge >= BOL_FLIP_SEC || this.reduced) fox.flipAge = -1;
      }
      if (fox.flipAge >= 0) {
        const k = fox.flipAge / BOL_FLIP_SEC;
        const e = 1 - Math.pow(1 - Math.min(1, k * 1.15), 3);
        fox.body.rotation.x = pitch - e * Math.PI * 2;
      } else {
        fox.body.rotation.x = pitch;
      }
    }
    // rastro da bola: discreto quando rápida; na cor do time logo depois de um chute
    if (!this.reduced) {
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      this.ballTrailT -= dt;
      this.kickTrail = Math.max(0, this.kickTrail - dt);
      if (this.ballTrailT <= 0) {
        if (this.kickTrail > 0) {
          this.ballTrailT = 0.016;
          this.addGlow(
            b.x,
            b.y,
            b.z,
            this.kickColor,
            1.7 + this.kickTrail * 1.2,
            0.34,
            0.5 + this.kickTrail * 0.4,
          );
        } else if (sp > 11) {
          this.ballTrailT = 0.03;
          this.addGlow(b.x, b.y, b.z, 0xffffff, 1.2, 0.22, 0.3);
        }
      }
    }
    // pulo de zoom do chute: a câmera abre um pouco e volta
    if (this.fovKick > 0.002) {
      this.fovKick *= Math.exp(-dt * 7);
      this.camera.fov = this.baseFov + this.fovKick * 5;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.fovKick = 0;
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]!;
      f.age += dt;
      if (f.age < 0) continue;
      f.obj.visible = true;
      const k = Math.min(1, f.age / f.life);
      if (f.ring) {
        f.obj.scale.setScalar(f.s0 + (f.s1 - f.s0) * (1 - Math.pow(1 - k, 2)));
        if (!f.flat) f.obj.lookAt(this.camera.position);
      } else f.obj.scale.setScalar(f.s0 + (f.s1 - f.s0) * k);
      f.mat.opacity = f.o0 * (1 - k) * (1 - k);
      if (f.age >= f.life) {
        this.scene.remove(f.obj);
        if (f.glowAdd !== undefined && this.glowPoolAdd.length + this.glowPoolNorm.length < 80) {
          (f.glowAdd ? this.glowPoolAdd : this.glowPoolNorm).push(f.obj as THREE.Sprite);
        } else {
          f.mat.dispose();
          if (f.ring) (f.obj as THREE.Mesh).geometry.dispose();
        }
        this.fx.splice(i, 1);
      }
    }
    // confete e fogos
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const bst = this.bursts[i]!;
      if (bst.delay > 0) {
        bst.delay -= dt;
        if (bst.delay <= 0) bst.pts.visible = true;
        continue;
      }
      bst.age += dt;
      const attr = bst.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let k = 0; k < arr.length; k += 3) {
        bst.vel[k + 1]! -= 9 * dt;
        bst.vel[k]! *= 1 - 0.6 * dt;
        bst.vel[k + 2]! *= 1 - 0.6 * dt;
        arr[k]! += bst.vel[k]! * dt;
        arr[k + 1]! = Math.max(0.05, arr[k + 1]! + bst.vel[k + 1]! * dt);
        arr[k + 2]! += bst.vel[k + 2]! * dt;
      }
      attr.needsUpdate = true;
      (bst.pts.material as THREE.PointsMaterial).opacity = Math.max(
        0,
        Math.min(1, (bst.life - bst.age) / 0.8),
      );
      if (bst.age >= bst.life) {
        this.scene.remove(bst.pts);
        bst.pts.geometry.dispose();
        (bst.pts.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }
    // câmera: orbita a raposa (ou a bola, se você só assiste) com ângulo de giro e de altura
    const target = this.world.players.find((p) => p.id === focusId) ?? { x: b.x, y: 0, z: b.z };
    this.camFocus.lerp(tmp.set(target.x, target.y, target.z), 1 - Math.exp(-dt * 10));
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const sh = this.reduced ? 0 : this.shake * 0.3;
    const auto = this.pitch === null;
    const toBall = Math.hypot(b.x - this.camFocus.x, b.z - this.camFocus.z);
    // câmera na bola: sobe quando a bola está longe ou alta, para o campo e a bola caberem no quadro
    const elev = auto
      ? 0.46 + Math.min(0.3, toBall / 70) + Math.min(0.15, Math.max(0, b.y - 1) / 25)
      : (this.pitch as number);
    let lookT = auto ? Math.min(0.7, Math.max(0.2, 0.2 + toBall / 45)) : 0;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const ce = Math.cos(elev);
    const se = Math.sin(elev);
    // quanto dá para afastar sem passar da parede: a distância encurta aos poucos (nunca "pula" como um corte seco)
    let allowed = CAM_DIST * ce;
    for (const e of this.world.field.edges) {
      const d0 = (this.camFocus.x - e.ax) * e.nx + (this.camFocus.z - e.az) * e.nz;
      const h = sy * e.nx + cy * e.nz;
      if (h < -1e-4) allowed = Math.min(allowed, Math.max(0, (d0 - 1.2) / -h));
    }
    const want = CAM_DIST * Math.max(0.38, Math.min(1, allowed / (CAM_DIST * ce)));
    this.camDist += (want - this.camDist) * (1 - Math.exp(-dt * (want < this.camDist ? 14 : 3)));
    const D = this.camDist;
    this.camera.position.set(
      this.camFocus.x + sy * ce * D + (Math.random() - 0.5) * sh,
      this.camFocus.y + se * D + 0.7 + (CAM_DIST - D) * 0.45 + (Math.random() - 0.5) * sh,
      this.camFocus.z + cy * ce * D,
    );
    const aim = () => {
      this.camera.lookAt(
        this.camFocus.x + (b.x - this.camFocus.x) * lookT - sy * 1.2,
        1 + Math.max(0, b.y - 1) * lookT * 0.5,
        this.camFocus.z + (b.z - this.camFocus.z) * lookT - cy * 1.2,
      );
      this.camera.updateMatrixWorld();
    };
    aim();
    if (auto) {
      // a bola nunca sai do quadro: se estiver perto da borda, a câmera olha mais para ela
      for (let i = 0; i < 4 && lookT < 0.95; i++) {
        tmp.set(b.x, b.y, b.z).project(this.camera);
        if (Math.abs(tmp.x) < 0.78 && tmp.y < 0.78 && tmp.y > -0.8 && tmp.z < 1) break;
        lookT += 0.2;
        aim();
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    for (const t of this.tags) {
      t.material.map?.dispose();
      t.material.dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
  }
}
