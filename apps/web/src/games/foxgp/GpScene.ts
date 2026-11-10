import * as THREE from 'three';
import {
  GP_HALF_WIDTH,
  GP_KERB_W,
  GP_LIMIT,
  GP_PIT_BOX,
  GP_PIT_BOX_LEN,
  GP_PIT_HALF,
  GP_PIT_IN_START,
  GP_PIT_OUT_END,
  GP_PIT_OFFSET,
  GP_VMAX,
  createRng,
  gpGridSpot,
  type GpCar,
  type GpEvent,
  type GpWorld,
} from '@nocap/games';
import { mapEdge } from '../atravessa/models';
import { bluish } from './format';

/** Direção da câmera isométrica (a mesma diagonal do Atravessa!): para trás, para a direita e para cima. */
const CAM_DIR = new THREE.Vector3(4.6, 9.4, 7.2).normalize();
const CAM_DIST = 140;
/** Meia altura do que a câmera vê (m), parado e no máximo. */
const VIEW = 12.5;
const VIEW_FAST = 16;

const ASPHALT = 0x3b3d4a;
const PIT_ASPHALT = 0x4a4c5a;
const GRASS = 0x62c25a;
const GRASS_DARK = 0x52ad4b;
const GRAVEL = 0xe6cf92;

interface CarView {
  id: string;
  group: THREE.Group;
  body: THREE.Group;
  wheelsF: THREE.Object3D[];
  tail: THREE.Group;
  flame: THREE.Mesh;
  tag: THREE.Sprite;
  you: THREE.Sprite | null;
  mats: THREE.Material[];
  ghost: boolean;
  wag: number;
  /** Tremida da batida. */
  shake: number;
}

const sideways = (track: GpWorld['track'], i: number) => ({ x: -track.tz[i]!, z: track.tx[i]! });

/**
 * A cena 3D do Fox GP: pista em voxel (asfalto, zebras, grama, brita, barreira de pneus, box, arquibancada e árvores), os
 * carros com a raposa no cockpit e a cauda balançando, o pórtico com as cinco luzes e a câmera isométrica que segue um
 * carro. Só desenha: quem manda é o `GpWorld`.
 */
export class GpScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
  private cars = new Map<string, CarView>();
  private lights: THREE.Mesh[] = [];
  private lightOn = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  private lightOff = new THREE.MeshLambertMaterial({ color: 0x241c24 });
  private camPos = new THREE.Vector3();
  private camLead = new THREE.Vector3();
  private view = VIEW;
  private aspect = 1;
  private size = { w: 0, h: 0 };
  private t = 0;
  private textures: THREE.Texture[] = [];
  private meId: string;

  constructor(
    canvas: HTMLCanvasElement,
    private world: GpWorld,
    meId: string,
    private reduced = false,
  ) {
    this.meId = meId;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !touch,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.6 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x8fd8ff);
    // o escurecimento lateral é do Atravessa e vale para os materiais das raposas: aqui é tudo sol
    mapEdge.uEdge.value = 1e6;
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-30, 60, 20);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x88aa77, 1.9));
    this.buildGround();
    this.buildTrack();
    this.buildPit();
    this.buildGantry();
    this.buildBarriers();
    this.buildScenery();
    for (const c of world.cars) this.addCar(c);
  }

  // ---- pista ----

  private ribbon(
    from: (i: number) => { a: number; b: number } | null,
    color: (i: number) => number,
    y: number,
  ): THREE.Mesh | null {
    const tr = this.world.track;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < tr.n; i++) {
      const j = (i + 1) % tr.n;
      const ra = from(i);
      const rb = from(j);
      if (!ra || !rb) continue;
      const si = sideways(tr, i);
      const sj = sideways(tr, j);
      const p = (k: number, s: { x: number; z: number }, d: number) => [
        tr.x[k]! + s.x * d,
        y,
        tr.z[k]! + s.z * d,
      ];
      const q = [p(i, si, ra.a), p(i, si, ra.b), p(j, sj, rb.a), p(j, sj, rb.b)];
      for (const k of [0, 2, 1, 1, 2, 3]) pos.push(...q[k]!);
      c.setHex(color(i));
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    if (pos.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    );
    this.scene.add(m);
    return m;
  }

  private buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 700),
      new THREE.MeshLambertMaterial({ color: GRASS }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(-20, -0.05, 75);
    this.scene.add(g);
    // faixas de grama mais escura dentro dos limites (o "corte" de grama de autódromo)
    this.ribbon(
      () => ({ a: -GP_LIMIT, b: GP_LIMIT }),
      (i) => (Math.floor(i / 12) % 2 === 0 ? GRASS : GRASS_DARK),
      -0.02,
    );
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
        return g > 0 ? { a, b: GP_LIMIT - 1 } : { a: -(GP_LIMIT - 1), b: -a };
      },
      () => GRAVEL,
      0.0,
    );
    // asfalto
    this.ribbon(() => ({ a: -H, b: H }), () => ASPHALT, 0.02);
    // linhas brancas da borda
    this.ribbon(() => ({ a: -H, b: -H + 0.35 }), () => 0xf4f4f4, 0.03);
    this.ribbon(() => ({ a: H - 0.35, b: H }), () => 0xf4f4f4, 0.03);
    // zebras vermelhas e brancas, dos dois lados nas curvas
    const kerb = (i: number) => (Math.floor((i * tr.ds) / 2) % 2 === 0 ? 0xe8322e : 0xf6f6f6);
    this.ribbon((i) => (tr.kerb[i] ? { a: -H - GP_KERB_W, b: -H } : null), kerb, 0.04);
    this.ribbon((i) => (tr.kerb[i] ? { a: H, b: H + GP_KERB_W } : null), kerb, 0.04);
    // a linha de chegada quadriculada
    const cells = 14;
    const size = (H * 2) / cells;
    for (let k = 0; k < cells; k++) {
      for (let r = 0; r < 2; r++) {
        const p = tr.pointAt(r * size, -H + size * (k + 0.5));
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(size, 0.04, size),
          new THREE.MeshLambertMaterial({ color: (k + r) % 2 === 0 ? 0xffffff : 0x111111 }),
        );
        m.position.set(p.x, 0.05, p.z);
        m.rotation.y = -p.h;
        this.scene.add(m);
      }
    }
    // marcas do grid
    const mark = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 8; i++) {
      const s = gpGridSpot(tr, i);
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.3), mark);
      const p = tr.pointAt(s.s - 2, s.d);
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
      () => PIT_ASPHALT,
      0.025,
    );
    // a vaga do box (amarela) e a garagem atrás dela
    const p = tr.pointAt(GP_PIT_BOX, GP_PIT_OFFSET);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(GP_PIT_HALF * 2 - 0.6, 0.04, GP_PIT_BOX_LEN),
      new THREE.MeshLambertMaterial({ color: 0xffd23f }),
    );
    box.position.set(p.x, 0.045, p.z);
    box.rotation.y = -p.h;
    this.scene.add(box);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf3efe6 });
    const roof = new THREE.MeshLambertMaterial({ color: 0x2f5bff });
    for (let s = GP_PIT_IN_START + 40; s < GP_PIT_OUT_END - 25; s += 9) {
      const q = tr.pointAt(s, GP_PIT_OFFSET + GP_PIT_HALF + 2.4);
      const g = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.2, 3.4), mat);
      g.position.set(q.x, 1.6, q.z);
      g.rotation.y = -q.h;
      const r = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 3.8), roof);
      r.position.set(q.x, 3.35, q.z);
      r.rotation.y = -q.h;
      this.scene.add(g, r);
    }
  }

  private buildGantry() {
    const tr = this.world.track;
    const p = tr.pointAt(3, 0);
    const g = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0x1b1535 });
    for (const d of [-GP_HALF_WIDTH - 1.2, GP_HALF_WIDTH + 1.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 0.6), steel);
      leg.position.set(d, 3.1, 0);
      g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(GP_HALF_WIDTH * 2 + 3, 1.2, 0.8), steel);
    beam.position.set(0, 6.2, 0);
    g.add(beam);
    for (let k = 0; k < 5; k++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.3), this.lightOff);
      l.position.set(-3.2 + k * 1.6, 6.2, 0.45);
      g.add(l);
      this.lights.push(l);
    }
    // girado como um carro: o x do grupo atravessa a pista e as luzes olham para o grid (que vem de trás, +Z)
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.h;
    this.scene.add(g);
  }

  /** Acende `n` luzes; `out` apaga todas (largada). */
  setLights(n: number, out = false) {
    this.lights.forEach((l, i) => (l.material = !out && i < n ? this.lightOn : this.lightOff));
  }

  private buildBarriers() {
    const tr = this.world.track;
    const spots: { x: number; z: number; k: number }[] = [];
    const every = Math.max(1, Math.round(2.2 / tr.ds));
    for (let i = 0; i < tr.n; i += every) {
      for (const side of [-1, 1]) {
        if (side < 0 ? tr.wallL[i] === 0 : tr.wallR[i] === 0) continue;
        const s = sideways(tr, i);
        const d = (GP_LIMIT + 0.6) * side;
        spots.push({ x: tr.x[i]! + s.x * d, z: tr.z[i]! + s.z * d, k: (i / every) % 3 });
      }
    }
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10);
    const colors = [0x16161c, 0xf4f4f4, 0xe8322e];
    for (let layer = 0; layer < 2; layer++) {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), spots.length);
      const mtx = new THREE.Matrix4();
      const c = new THREE.Color();
      spots.forEach((p, i) => {
        mtx.makeTranslation(p.x, 0.25 + layer * 0.5, p.z);
        m.setMatrixAt(i, mtx);
        m.setColorAt(i, c.setHex(colors[(Math.round(p.k) + layer) % 3]!));
      });
      this.scene.add(m);
    }
  }

  private buildScenery() {
    const tr = this.world.track;
    const rng = createRng('gp:scenery');
    // árvores de voxel longe da pista
    const trunk = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
    const leafs = [0x2f9e44, 0x3fb950, 0x2b8a3e].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    for (let k = 0; k < 220; k++) {
      const x = -260 + rng() * 480;
      const z = -80 + rng() * 320;
      const p = tr.projectGlobal(x, z);
      if (p.dist < GP_LIMIT + 6) continue;
      const h = 1.6 + rng() * 2.4;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), trunk);
      t.position.set(x, h / 2, z);
      const s = 2 + rng() * 1.6;
      const l = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), leafs[k % 3]!);
      l.position.set(x, h + s / 2 - 0.2, z);
      this.scene.add(t, l);
    }
    // arquibancada do lado de fora da reta, com a torcida em blocos coloridos
    const stand = new THREE.MeshLambertMaterial({ color: 0xd9d4ea });
    const crowd = [0xff7d26, 0x2f5bff, 0xffd23f, 0xff6f91, 0x7be07b, 0xb98cff].map(
      (c) => new THREE.MeshLambertMaterial({ color: c }),
    );
    for (let s = -110; s <= 90; s += 12) {
      for (let row = 0; row < 3; row++) {
        const q = tr.pointAt(s, -(GP_LIMIT + 4 + row * 2.2));
        const b = new THREE.Mesh(new THREE.BoxGeometry(11, 1 + row * 1.1, 2.2), stand);
        b.position.set(q.x, (1 + row * 1.1) / 2, q.z);
        b.rotation.y = -q.h;
        this.scene.add(b);
        for (let f = 0; f < 6; f++) {
          const fq = tr.pointAt(s - 4.5 + f * 1.8, -(GP_LIMIT + 4 + row * 2.2));
          const fan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), crowd[(f + row) % 6]!);
          fan.position.set(fq.x, 1 + row * 1.1 + 0.4, fq.z);
          this.scene.add(fan);
        }
      }
    }
  }

  // ---- carros ----

  private textSprite(text: string, bg: string, w = 2.8, h = 0.7): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      g.font = '800 30px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const shown = text.length > 14 ? `${text.slice(0, 13)}…` : text;
      const tw = Math.min(244, g.measureText(shown).width + 28);
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(128 - tw / 2, 8, tw, 48, 16);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(shown, 128, 33);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
    );
    s.scale.set(w, h, 1);
    s.renderOrder = 10;
    return s;
  }

  private addCar(c: GpCar) {
    const mats: THREE.Material[] = [];
    const mat = (color: number, emissive = false) => {
      const m = emissive
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshLambertMaterial({ color });
      mats.push(m);
      return m;
    };
    const paint = mat(c.color);
    const dark = mat(0x1b1535);
    const white = mat(0xfff3e2);
    const tyre = mat(0x15151a);
    const sock = mat(0x35211a);
    const blue = bluish(c.color);
    const cap = mat(blue ? 0xff7d26 : 0x2f5bff);
    const capDark = mat(blue ? 0xc95a12 : 0x2347c9);
    const add = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    // o carro olha para −Z (como a raposa do Atravessa!)
    add(body, 1.0, 0.26, 2.9, paint, 0, 0.36, 0.1); // assoalho e chassi
    add(body, 0.46, 0.22, 1.1, paint, 0, 0.4, -1.3); // bico
    add(body, 0.14, 0.24, 1.12, white, 0, 0.41, -1.3); // faixa do bico
    add(body, 1.8, 0.08, 0.36, dark, 0, 0.2, -1.78); // asa da frente
    for (const x of [-0.88, 0.88]) add(body, 0.06, 0.24, 0.42, dark, x, 0.26, -1.78);
    for (const x of [-0.62, 0.62]) add(body, 0.42, 0.32, 1.2, paint, x, 0.42, 0.25); // laterais
    add(body, 0.74, 0.16, 0.86, dark, 0, 0.56, -0.25); // cockpit
    add(body, 0.56, 0.42, 1.0, paint, 0, 0.62, 0.75); // tampa do motor
    add(body, 0.1, 0.5, 0.12, dark, 0, 0.98, 1.4);
    add(body, 1.5, 0.1, 0.36, dark, 0, 1.24, 1.5); // asa de trás
    for (const x of [-0.75, 0.75]) add(body, 0.06, 0.42, 0.42, paint, x, 1.1, 1.5);
    // rodas (as da frente viram com o volante)
    const wheelsF: THREE.Object3D[] = [];
    for (const x of [-0.9, 0.9]) {
      const w = add(group, 0.36, 0.52, 0.6, tyre, x, 0.27, -1.0);
      wheelsF.push(w);
      add(group, 0.42, 0.6, 0.72, tyre, x, 0.3, 1.0);
    }
    // a raposa: cabeça, focinho, bochechas, olhos, boné e as orelhas saindo pelo boné
    const fox = new THREE.Group();
    fox.position.set(0, 0.6, -0.25);
    const fur = mat(c.color);
    add(fox, 0.46, 0.36, 0.42, fur, 0, 0.26, 0);
    add(fox, 0.22, 0.13, 0.3, fur, 0, 0.18, -0.32);
    add(fox, 0.2, 0.06, 0.26, white, 0, 0.1, -0.32);
    add(fox, 0.09, 0.08, 0.06, sock, 0, 0.22, -0.48);
    for (const x of [-0.24, 0.24]) add(fox, 0.06, 0.13, 0.2, white, x, 0.2, -0.08);
    for (const x of [-0.15, 0.15]) add(fox, 0.08, 0.09, 0.04, mat(0x15100c), x, 0.32, -0.21);
    add(fox, 0.5, 0.1, 0.46, cap, 0, 0.48, 0);
    add(fox, 0.4, 0.08, 0.36, cap, 0, 0.56, 0);
    add(fox, 0.52, 0.03, 0.48, white, 0, 0.48, 0);
    add(fox, 0.38, 0.04, 0.24, capDark, 0, 0.46, -0.3);
    for (const x of [-0.15, 0.15]) {
      add(fox, 0.16, 0.12, 0.1, fur, x, 0.64, 0.06);
      add(fox, 0.1, 0.09, 0.08, sock, x, 0.74, 0.06);
    }
    body.add(fox);
    // a cauda sai por trás do cockpit, por cima do motor, e balança (mais forte no vácuo)
    const tail = new THREE.Group();
    tail.position.set(0, 0.9, 0.35);
    add(tail, 0.24, 0.24, 0.36, fur, 0, 0.05, 0.18);
    add(tail, 0.3, 0.3, 0.32, fur, 0, 0.16, 0.48);
    add(tail, 0.32, 0.32, 0.3, fur, 0, 0.3, 0.76);
    add(tail, 0.28, 0.26, 0.26, white, 0, 0.42, 1.0);
    tail.rotation.x = 0.25;
    body.add(tail);
    // o fogo do turbo
    const flame = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.9 }),
    );
    flame.position.set(0, 0.5, 1.95);
    flame.visible = false;
    body.add(flame);
    // sombra
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 3.8),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.06;
    group.add(shadow);
    const own = c.id === this.meId;
    const tag = this.textSprite(c.name, 'rgba(27,21,53,0.82)');
    tag.position.y = 2.6;
    group.add(tag);
    let you: THREE.Sprite | null = null;
    if (own) {
      tag.visible = false;
      you = this.textSprite('VOCÊ', '#ff5a4d', 1.9, 0.62);
      you.position.y = 2.7;
      group.add(you);
    }
    this.scene.add(group);
    this.cars.set(c.id, { id: c.id, group, body, wheelsF, tail, flame, tag, you, mats, ghost: false, wag: 0, shake: 0 });
  }

  /** Classificação: os outros carros ficam transparentes (fantasmas). */
  private setGhost(v: CarView, ghost: boolean) {
    if (v.ghost === ghost) return;
    v.ghost = ghost;
    for (const m of v.mats) {
      m.transparent = ghost;
      m.opacity = ghost ? 0.38 : 1;
      m.depthWrite = !ghost;
      m.needsUpdate = true;
    }
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.aspect = w / Math.max(1, h);
  }

  /** Reage aos eventos do motor. */
  handle(events: readonly GpEvent[]) {
    for (const e of events) {
      if (e.type === 'bump') {
        const a = this.cars.get(e.a);
        const b = this.cars.get(e.b);
        if (a) a.shake = Math.min(1, a.shake + e.force * 0.15);
        if (b) b.shake = Math.min(1, b.shake + e.force * 0.15);
      } else if (e.type === 'wall') {
        const v = this.cars.get(e.id);
        if (v) v.shake = 1;
      }
    }
  }

  render(dt: number, focusId: string) {
    this.t += dt;
    const w = this.world;
    for (const c of w.cars) {
      const v = this.cars.get(c.id);
      if (!v) continue;
      v.group.visible = !c.gone;
      if (c.gone) continue;
      v.group.position.set(c.x, 0, c.z);
      v.group.rotation.y = -c.h;
      for (const wh of v.wheelsF) wh.rotation.y = -c.steer * 0.45;
      // a cauda: balanço calmo andando; forte no vácuo
      const fast = Math.min(1, Math.abs(c.speed) / GP_VMAX);
      v.wag += dt * (5 + fast * 4 + c.slip * 12);
      const amp = this.reduced ? 0.08 : 0.16 + fast * 0.12 + c.slip * 0.55;
      v.tail.rotation.y = Math.sin(v.wag) * amp;
      v.flame.visible = c.turbo > 0;
      if (c.turbo > 0) v.flame.scale.set(1, 1, 0.7 + Math.abs(Math.sin(this.t * 40)) * 0.6);
      v.shake = Math.max(0, v.shake - dt * 3);
      v.body.position.x = this.reduced ? 0 : Math.sin(this.t * 60) * v.shake * 0.08;
      v.body.rotation.z = -c.steer * Math.min(1, fast * 1.2) * 0.05;
      this.setGhost(v, w.phase === 'quali' && c.id !== focusId);
    }
    // câmera: segue o carro em foco, um pouco à frente dele, e abre um pouco com a velocidade
    const f = w.car(focusId) ?? w.cars.find((c) => !c.gone);
    if (f) {
      const k = 1 - Math.exp(-dt * 4);
      this.camLead.x += (f.vx * 0.42 - this.camLead.x) * k;
      this.camLead.z += (f.vz * 0.42 - this.camLead.z) * k;
      const tx = f.x + this.camLead.x;
      const tz = f.z + this.camLead.z;
      if (this.camPos.lengthSq() === 0) this.camPos.set(tx, 0, tz);
      const kp = 1 - Math.exp(-dt * 7);
      this.camPos.x += (tx - this.camPos.x) * kp;
      this.camPos.z += (tz - this.camPos.z) * kp;
      const want = VIEW + (VIEW_FAST - VIEW) * Math.min(1, Math.abs(f.speed) / GP_VMAX);
      this.view += (want - this.view) * (1 - Math.exp(-dt * 1.5));
    }
    // celular em pé: a largura mínima manda
    const halfH = this.aspect < 1 ? Math.max(this.view, (this.view * 0.8) / this.aspect) : this.view;
    const halfW = halfH * this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(
      this.camPos.x + CAM_DIR.x * CAM_DIST,
      CAM_DIR.y * CAM_DIST,
      this.camPos.z + CAM_DIR.z * CAM_DIST,
    );
    this.camera.lookAt(this.camPos.x, 0, this.camPos.z);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const t of this.textures) t.dispose();
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
