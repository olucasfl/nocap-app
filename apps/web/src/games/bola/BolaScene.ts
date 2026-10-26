import * as THREE from 'three';
import {
  BOL_BALL_R,
  BOL_FLIP_SEC,
  BOL_GOAL_H,
  BOL_TEAM_COLORS,
  type BolPlayer,
  type BolWorld,
} from '@nocap/games';
import { buildHero } from '../atravessa/models';

/** Câmera de perseguição: atrás da raposa, olhando por cima do ombro para a bola. */
const CAM_BACK = 7.6;
const CAM_UP = 4.7;
const WALL_H = 1.3;
const GLASS_H = 4.2;
const NET_DEPTH = 3.2;
const PHI = (1 + Math.sqrt(5)) / 2;

interface Fox {
  group: THREE.Group;
  body: THREE.Object3D;
  shadow: THREE.Mesh;
}

const tmp = new THREE.Vector3();

/** O campo, a bola e as raposas do Bola Maluca!. Só desenha: quem manda é o `BolWorld`. */
export class BolaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);
  private foxes = new Map<string, Fox>();
  private ball: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private yaw = 0;
  private camFocus = new THREE.Vector3();
  private size = { w: 0, h: 0 };
  private disposed = false;
  private tags: THREE.Sprite[] = [];
  private shake = 0;

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
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(14, 30, 10);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xd6e4c8, 2.1));
    this.buildField();
    this.ball = this.buildBall();
    this.ballShadow = this.blob(BOL_BALL_R * 1.1);
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
    for (const e of f.edges)
      strip(e.mx + e.nx * 0.55, e.mz + e.nz * 0.55, e.len - 0.6, 0.22, -Math.atan2(e.tz, e.tx));
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
        new THREE.PlaneGeometry(g.halfW * 2 + 1.5, 4.2),
        new THREE.MeshBasicMaterial({
          color: BOL_TEAM_COLORS[g.team] ?? 0xffffff,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.rotation.z = ang;
      zone.position.set(e.mx + e.nx * 2.1, 0.025, e.mz + e.nz * 2.1);
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
    for (const e of f.edges) {
      const ang = Math.atan2(e.tz, e.tx);
      const goal = e.goal >= 0 ? f.goals[e.goal] : undefined;
      const teamCol = goal ? (BOL_TEAM_COLORS[goal.team] ?? 0xffffff) : 0xffd23f;
      const piece = (len: number, cx: number, cz: number) => {
        if (len <= 0.05) return;
        const grp = new THREE.Group();
        grp.position.set(cx - e.nx * 0.35, 0, cz - e.nz * 0.35);
        grp.rotation.y = -ang;
        const body = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, 0.7), wallBody);
        body.position.y = WALL_H / 2;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.9), wallCap);
        cap.position.y = WALL_H + 0.09;
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.22, 0.72),
          new THREE.MeshBasicMaterial({ color: hex(teamCol) }),
        );
        stripe.position.y = WALL_H * 0.55;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, GLASS_H), glass);
        pane.position.set(0, WALL_H + 0.18 + GLASS_H / 2, 0.1);
        grp.add(body, cap, stripe, pane);
        this.scene.add(grp);
      };
      if (!goal) {
        piece(e.len, e.mx, e.mz);
        // arquibancada em 3 degraus
        for (let i = 0; i < 3; i++) {
          const h = 2.4 + i * 1.7;
          const tex = crowd.clone();
          tex.needsUpdate = true;
          tex.repeat.set(Math.max(1, e.len / 14), 1);
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(1, e.len - 1), h, 2.6),
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

  /** Gol: traves grossas, travessão, rede em malha (fundo, laterais e teto) e uma faixa do time. */
  private buildGoal(team: number, mx: number, mz: number, nx: number, nz: number, halfW: number) {
    const g = new THREE.Group();
    g.position.set(mx, 0, mz);
    // o eixo +z do grupo aponta para fora do campo
    g.rotation.y = Math.atan2(-nx, -nz);
    const col = BOL_TEAM_COLORS[team] ?? 0xffffff;
    const post = new THREE.MeshLambertMaterial({ color: 0xffffff });
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
    this.scene.add(g);
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
    this.foxes.set(p.id, { group, body, shadow: this.blob(0.55) });
  }

  /** Quem entra no meio da partida (ou muda de nome ao virar bot) ganha o corpo sem refazer o campo. */
  sync() {
    const ids = new Set(this.world.players.map((p) => p.id));
    for (const p of this.world.players) if (!this.foxes.has(p.id)) this.addFox(p);
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
    this.camera.fov = this.camera.aspect < 1 ? 78 : 60;
    this.camera.updateProjectionMatrix();
  }

  setYaw(yaw: number) {
    this.yaw = yaw;
  }

  getYaw() {
    return this.yaw;
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
    this.ball.visible = this.world.phase !== 'goal';
    this.ballShadow.position.set(b.x, 0.03, b.z);
    this.ballShadow.scale.setScalar(Math.max(0.4, 1 - (b.y - BOL_BALL_R) * 0.08));
    for (const p of this.world.players) {
      const fox = this.foxes.get(p.id);
      if (!fox) continue;
      fox.group.position.set(p.x, p.y, p.z);
      fox.group.rotation.y = p.heading + Math.PI;
      fox.shadow.position.set(p.x, 0.03, p.z);
      fox.shadow.scale.setScalar(Math.max(0.4, 1 - p.y * 0.1));
      const speed = Math.hypot(p.vx, p.vz);
      const squash = p.grounded
        ? 1 + Math.sin(this.world.clock * 18 + p.x) * 0.04 * Math.min(1, speed / 3)
        : 1.08;
      fox.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      const pitch = p.grounded ? Math.min(0.18, speed * 0.03) : 0.25;
      if (p.flipT > 0 && !this.reduced) {
        // mortal para a frente (a raposa já olha para onde vai), com saída suave
        const k = 1 - p.flipT / BOL_FLIP_SEC;
        const e = 1 - Math.pow(1 - Math.min(1, k * 1.15), 3);
        fox.body.rotation.x = pitch + e * Math.PI * 2;
      } else {
        fox.body.rotation.x = pitch;
      }
    }
    // câmera
    const target = this.world.players.find((p) => p.id === focusId);
    if (target) {
      this.camFocus.lerp(tmp.set(target.x, target.y, target.z), 1 - Math.exp(-dt * 8));
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = this.reduced ? 0 : this.shake * 0.3;
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      this.camera.position.set(
        this.camFocus.x + sy * CAM_BACK + (Math.random() - 0.5) * sh,
        this.camFocus.y + CAM_UP + (Math.random() - 0.5) * sh,
        this.camFocus.z + cy * CAM_BACK,
      );
      // olha um pouco em direção à bola, para ela nunca sair do quadro
      const lx = this.camFocus.x + (b.x - this.camFocus.x) * 0.25 - sy * 1.5;
      const lz = this.camFocus.z + (b.z - this.camFocus.z) * 0.25 - cy * 1.5;
      // a câmera nunca passa das paredes: sem isso o muro tapa a raposa quando ela está na borda
      const cp = this.camera.position;
      let pushed = 0;
      for (const e of this.world.field.edges) {
        const d = (cp.x - e.ax) * e.nx + (cp.z - e.az) * e.nz;
        if (d < 1.2) {
          cp.x += e.nx * (1.2 - d);
          cp.z += e.nz * (1.2 - d);
          pushed += 1.2 - d;
        }
      }
      // encostada na parede, a câmera sobe para ainda enquadrar a raposa e a bola
      cp.y += Math.min(4, pushed * 0.8);
      this.camera.lookAt(lx, 1 + Math.max(0, b.y - 1) * 0.2, lz);
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
