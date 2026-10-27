import * as THREE from 'three';
import {
  DSM_HEX_SIZE,
  DSM_LAYERS,
  DSM_LAVA_DEPTH,
  DSM_TILE_LIFE,
  DSM_TILE_THICK,
  hexKey,
  layerY,
  type DsmEvent,
  type DsmPlayer,
  type DsmTile,
  type DsmWorld,
} from '@nocap/games';
import { buildHero, mapEdge } from '../atravessa/models';

/** Cores das camadas, de cima para baixo (a de cima é a maior). */
const LAYER_COLORS = [0x9a5cff, 0xff7ab8, 0xffa24d, 0xffd84d, 0x8be36b, 0x55d9ff, 0x6b7bff];
const CRACK_COLOR = new THREE.Color(0xff4d4d);
const WAVE_COLOR = new THREE.Color(0xff9d2e);
const STEP_MIX = 0.35;

/** Câmera: atrás (para o sul) e acima, sempre olhando para o norte; W é sempre "para cima" na tela. */
/** A mesma câmera solta do Fut Fox: orbita a raposa a 8,6 m, com o giro e a altura (o ângulo) escolhidos pela pessoa. */
const CAM_DIST = 8.6;

interface LayerMesh {
  mesh: THREE.InstancedMesh;
  index: Map<string, number>;
  tiles: DsmTile[];
}

interface Falling {
  layer: number;
  i: number;
  age: number;
  x: number;
  y: number;
  z: number;
  spin: number;
  /** Inclinação de cada ladrilho ao cair (varia de um para outro). */
  tx: number;
  tz: number;
}

interface Fox {
  group: THREE.Group;
  body: THREE.Object3D;
  id: string;
  /** Pulo duplo: 0 a 1 enquanto a pirueta roda; -1 parado. */
  flip: number;
}

interface Puff {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

interface Ring {
  mesh: THREE.Mesh;
  age: number;
}

const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpE = new THREE.Euler();

/**
 * A cena 3D do Desmorona!: ladrilhos hexagonais (um InstancedMesh por camada), raposas de boné, lava embaixo e a câmera
 * individual. Só desenha: quem manda é o `DsmWorld` (motor puro). Os eventos do motor viram tremida, queda e partículas.
 */
export class DsmScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
  private layers: LayerMesh[] = [];
  private foxes = new Map<string, Fox>();
  private falling: Falling[] = [];
  private tags: THREE.Sprite[] = [];
  private rings: Ring[] = [];
  /** Ladrilhos pisados (precisam ser reatualizados a cada quadro por causa da tremida). */
  private hot = new Set<string>();
  /** Hora do jogo em que cada ladrilho foi pisado (para o apertão, o brilho e o tremor crescente). */
  private stepAt = new Map<string, number>();
  private puffs: Puff[] = [];
  private puffTex: THREE.Texture | null = null;
  private lava: THREE.Mesh;
  /** Giro da câmera em volta da raposa (rad); 0 = atrás, olhando para -Z. */
  private yaw = 0;
  /** Altura da câmera (rad acima do horizonte). */
  private pitch = 0.5;
  private camFocus = new THREE.Vector3();
  private shake = 0;
  private size = { w: 0, h: 0 };
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    private world: DsmWorld,
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
    this.scene.background = new THREE.Color(0x7fd3ff);
    this.scene.fog = new THREE.Fog(0x9fdcff, 45, 120);

    // o escurecimento lateral é do Atravessa e vale para todos os materiais das raposas: aqui é tudo sol
    mapEdge.uEdge.value = 1e6;
    // sempre sol: luz branca de todos os lados, sem lado escuro
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(0, 40, 0);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xffffff, 2.4));

    this.buildLayers();
    this.buildScenery();
    this.lava = this.buildLava();
    for (const p of world.players) this.addFox(p);
  }

  private buildLayers() {
    const geo = new THREE.CylinderGeometry(
      DSM_HEX_SIZE * 0.97,
      DSM_HEX_SIZE * 0.97,
      DSM_TILE_THICK,
      6,
      1,
    );
    for (let l = 0; l < DSM_LAYERS; l++) {
      const tiles = [...this.world.tiles.values()].filter((t) => t.layer === l);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const index = new Map<string, number>();
      const base = new THREE.Color(LAYER_COLORS[l]);
      tiles.forEach((t, i) => {
        index.set(hexKey(l, t.q, t.r), i);
        // um tom levemente diferente por ladrilho: o chão fica vivo, não chapado
        const v = 0.93 + ((Math.imul(t.q * 31 + t.r * 17, 2654435761) >>> 0) % 100) / 700;
        mesh.setColorAt(i, tmpC.copy(base).multiplyScalar(v));
        this.setTileMatrix(mesh, i, t, 0, 1);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.layers.push({ mesh, index, tiles });
    }
  }

  private setTileMatrix(
    mesh: THREE.InstancedMesh,
    i: number,
    t: DsmTile,
    dy: number,
    scale: number,
    rot = 0,
    rx = 0,
    rz = 0,
  ) {
    tmpP.set(t.x, layerY(t.layer) - DSM_TILE_THICK / 2 + dy, t.z);
    if (rx === 0 && rz === 0) tmpQ.setFromAxisAngle(UP, rot);
    else tmpQ.setFromEuler(tmpE.set(rx, rot, rz));
    tmpS.set(scale, scale, scale);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
  }

  /** Colinas e nuvens de longe, para o céu não ser vazio (só enfeite, longe da arena). */
  private buildScenery() {
    const hill = new THREE.ConeGeometry(14, 16, 7);
    const colors = [0xff9ec4, 0xbfa5ff, 0xffc88a, 0x9fe0b0];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 78 + (i % 3) * 8;
      const m = new THREE.Mesh(
        hill,
        new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }),
      );
      m.position.set(Math.cos(a) * r, layerY(DSM_LAYERS - 1) - 8 + (i % 2) * 3, Math.sin(a) * r);
      m.scale.set(1 + (i % 4) * 0.25, 1 + (i % 3) * 0.3, 1);
      this.scene.add(m);
    }
    const cloud = new THREE.SphereGeometry(4, 8, 6);
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(cloud, white);
      const a = i * 1.7;
      c.position.set(Math.cos(a) * 52, 10 + (i % 4) * 5, Math.sin(a) * 52);
      c.scale.set(1.8, 0.7, 1.1);
      this.scene.add(c);
    }
  }

  private buildLava(): THREE.Mesh {
    const g = new THREE.PlaneGeometry(260, 260);
    const m = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const lava = new THREE.Mesh(g, m);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = layerY(DSM_LAYERS - 1) - DSM_LAVA_DEPTH + 1.2;
    this.scene.add(lava);
    return lava;
  }

  private addFox(p: DsmPlayer) {
    const group = new THREE.Group();
    const hero = buildHero({ fur: p.color, own: true });
    // a pirueta do pulo duplo gira em volta do meio do corpo, não dos pés
    const body = new THREE.Group();
    body.position.y = 0.6;
    hero.position.y = -0.6;
    body.add(hero);
    group.add(body);
    group.add(this.nameTag(p.name));
    this.scene.add(group);
    this.foxes.set(p.id, { group, body, id: p.id, flip: -1 });
  }

  /** O anel de ar que abre sob a raposa no pulo duplo (só escala e opacidade). */
  private spawnRing(x: number, y: number, z: number) {
    let ring = this.rings.find((r) => r.age >= 0.45);
    if (!ring) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 9;
      this.scene.add(mesh);
      ring = { mesh, age: 1 };
      this.rings.push(ring);
    }
    ring.age = 0;
    ring.mesh.position.set(x, y + 0.08, z);
    ring.mesh.visible = true;
  }

  /** O nome em cima da cabeça: um cartaz que sempre olha para a câmera e aparece mesmo atrás de um ladrilho. */
  private nameTag(name: string): THREE.Sprite {
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
      g.fillStyle = 'rgba(27,21,53,0.82)';
      g.beginPath();
      g.roundRect(128 - w / 2, 8, w, 48, 16);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(text, 128, 33);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      transparent: true,
      fog: false,
    });
    const sprite = new THREE.Sprite(mat);
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
    // celular em pé: abre o campo de visão para a arena caber
    this.camera.fov = this.camera.aspect < 1 ? 78 : 60;
    this.camera.updateProjectionMatrix();
  }

  /** Reage aos eventos do motor (tremida, queda de ladrilho, tremor da câmera). */
  handle(events: readonly DsmEvent[], focusId: string) {
    for (const e of events) {
      if (e.type === 'airjump') {
        const fox = this.foxes.get(e.id);
        const p = this.world.players.find((q) => q.id === e.id);
        if (fox && p) {
          fox.flip = this.reduced ? -1 : 0;
          this.spawnRing(p.x, p.y, p.z);
        }
      } else if (e.type === 'step') {
        const lm = this.layers[e.layer];
        const i = lm?.index.get(hexKey(e.layer, e.q, e.r));
        if (lm && i !== undefined) {
          this.hot.add(`${e.layer}:${i}`);
          this.stepAt.set(`${e.layer}:${i}`, this.world.t);
          this.paintTile(lm, i, lm.tiles[i] as DsmTile);
        }
      } else if (e.type === 'break') {
        const lm = this.layers[e.layer];
        const i = lm?.index.get(hexKey(e.layer, e.q, e.r));
        if (lm && i !== undefined) {
          const t = lm.tiles[i] as DsmTile;
          this.hot.delete(`${e.layer}:${i}`);
          this.stepAt.delete(`${e.layer}:${i}`);
          const h = Math.imul(i * 2654435761, 40503) >>> 0;
          this.falling.push({
            layer: e.layer,
            i,
            age: 0,
            x: t.x,
            y: 0,
            z: t.z,
            spin: ((h % 7) - 3) * 0.12 || 0.2,
            tx: ((h >>> 3) % 9) / 8 - 0.5,
            tz: ((h >>> 7) % 9) / 8 - 0.5,
          });
          this.dust(t);
        }
      } else if (e.type === 'wave') {
        // a onda avisa: marca os ladrilhos da camada que já estão quebrando
        for (const [i, t] of (this.layers[e.layer]?.tiles ?? []).entries()) {
          if (t.status === 'pisado') this.hot.add(`${e.layer}:${i}`);
        }
        this.shake = Math.max(this.shake, 0.15);
      } else if (e.type === 'wavefall') {
        // o aviso acabou: os ladrilhos marcados começam a cair
        this.shake = Math.max(this.shake, 0.45);
      } else if (e.type === 'land' && e.id === focusId) {
        this.shake = Math.max(this.shake, 0.18);
      } else if (e.type === 'dead' && e.id === focusId) {
        this.shake = 0.6;
      }
    }
  }

  private paintTile(lm: LayerMesh, i: number, t: DsmTile) {
    const base = tmpC.set(LAYER_COLORS[t.layer] as number);
    if (t.status === 'pisado') {
      const crack = this.world.crack(t);
      if (t.wave) {
        // aviso da onda: laranja que vai ficando vermelho e pisca cada vez mais rápido até cair (parado com movimento reduzido)
        const total = Math.max(0.2, t.breakAt - t.markAt);
        const prog = Math.min(1, Math.max(0, 1 - (t.breakAt - this.world.t) / total));
        const pulse = this.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(this.world.t * (5 + 12 * prog));
        base.lerp(
          tmpC2.copy(WAVE_COLOR).lerp(CRACK_COLOR, prog * 0.75),
          0.55 + 0.3 * pulse + 0.1 * prog,
        );
      } else {
        // um clarão curto ao pisar, que assenta num tom mais claro do que o ladrilho firme
        const s = Math.max(0, this.world.t - (this.stepAt.get(`${t.layer}:${i}`) ?? this.world.t));
        const flash = this.reduced ? 0 : 0.45 * Math.exp(-s * 10);
        base.lerp(tmpC2.set(0xffffff), Math.min(1, STEP_MIX * (1 - crack) + flash));
      }
      base.lerp(CRACK_COLOR, crack * 0.85);
    }
    lm.mesh.setColorAt(i, base);
    if (lm.mesh.instanceColor) lm.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * O ladrilho pisado conta uma pequena história: afunda um tiquinho ao ser pisado (e volta), brilha de leve, treme cada
   * vez mais até rachar e, no fim, balança e fica vermelho. Só mexe em posição, inclinação e cor, e em pouca quantidade.
   */
  private animateTile(lm: LayerMesh, i: number, t: DsmTile, key: string) {
    const now = this.world.t;
    const s = Math.max(0, now - (this.stepAt.get(key) ?? now));
    const total = t.wave ? Math.max(0.2, t.breakAt - t.markAt) : (DSM_TILE_LIFE[t.layer] ?? 1);
    const prog = Math.min(1, Math.max(0, 1 - (t.breakAt - now) / total));
    const crack = this.world.crack(t);
    let dy = -0.04 * prog - crack * 0.05;
    let rx = 0;
    let rz = 0;
    if (!this.reduced) {
      // apertão: afunda e devolve com uma mola curta
      dy += -0.1 * Math.exp(-s * 9) * Math.cos(s * 15);
      // tremor suave que cresce com o tempo; começa depois do apertão para ele aparecer primeiro
      const ramp = Math.min(1, Math.max(0, (s - 0.1) / 0.15));
      const a = ramp * (0.006 + 0.03 * prog * prog) + crack * 0.04;
      dy += a * Math.sin(now * 46 + i * 1.7);
      rx = a * 1.1 * Math.sin(now * 33 + i * 0.9);
      rz = a * 1.1 * Math.cos(now * 29 + i * 2.3);
    }
    this.setTileMatrix(lm.mesh, i, t, dy, 1, 0, rx, rz);
    lm.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Poeira discreta quando o ladrilho se solta: poucas nuvens claras que sobem e somem. */
  private dust(t: DsmTile) {
    if (this.reduced) return;
    if (!this.puffTex) {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const g = cv.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      this.puffTex = new THREE.CanvasTexture(cv);
    }
    for (let n = 0; n < 4; n++) {
      let puff = this.puffs.find((q) => q.age >= q.life);
      if (!puff) {
        if (this.puffs.length >= 40) return;
        const mat = new THREE.SpriteMaterial({
          map: this.puffTex,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          fog: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = 8;
        this.scene.add(sprite);
        puff = { sprite, age: 1, life: 1, vx: 0, vy: 0, vz: 0 };
        this.puffs.push(puff);
      }
      const ang = Math.random() * Math.PI * 2;
      const r = DSM_HEX_SIZE * (0.4 + Math.random() * 0.6);
      puff.age = 0;
      puff.life = 0.55 + Math.random() * 0.25;
      puff.vx = Math.cos(ang) * 0.9;
      puff.vz = Math.sin(ang) * 0.9;
      puff.vy = 0.9 + Math.random() * 0.5;
      puff.sprite.position.set(
        t.x + Math.cos(ang) * r,
        layerY(t.layer) + 0.15,
        t.z + Math.sin(ang) * r,
      );
      puff.sprite.visible = true;
      (puff.sprite.material as THREE.SpriteMaterial).color
        .set(LAYER_COLORS[t.layer] as number)
        .lerp(tmpC2.set(0xffffff), 0.55);
    }
  }

  /** O que a câmera segue: uma raposa (a sua, ou a que você assiste). */
  render(dt: number, focusId: string) {
    if (this.disposed) return;
    // ladrilhos pisados: cor e tremida
    for (const key of [...this.hot]) {
      const [ls, is] = key.split(':');
      const lm = this.layers[Number(ls)];
      const i = Number(is);
      const t = lm?.tiles[i];
      if (!lm || !t || t.status !== 'pisado') {
        this.hot.delete(key);
        continue;
      }
      this.paintTile(lm, i, t);
      this.animateTile(lm, i, t, key);
    }
    // ladrilhos caindo: afundam girando e somem
    for (let k = this.falling.length - 1; k >= 0; k--) {
      const f = this.falling[k] as Falling;
      f.age += dt;
      // solta com um tranco para cima, e aí acelera caindo, inclinando para um lado e encolhendo no fim
      f.y -= (3 + f.age * 26) * dt;
      const lm = this.layers[f.layer] as LayerMesh;
      const t = lm.tiles[f.i] as DsmTile;
      const pop = this.reduced ? 0 : 0.07 * Math.sin(Math.min(1, f.age / 0.12) * Math.PI);
      const s = f.age < 0.5 ? 1 : Math.max(0, 1 - (f.age - 0.5) / 0.6);
      const tilt = this.reduced ? 0 : Math.min(1.1, f.age * 1.6);
      this.setTileMatrix(lm.mesh, f.i, t, f.y + pop, s, f.age * f.spin, f.tx * tilt, f.tz * tilt);
      lm.mesh.instanceMatrix.needsUpdate = true;
      if (f.age > 1.1) {
        this.setTileMatrix(lm.mesh, f.i, t, -50, 0);
        this.falling.splice(k, 1);
      }
    }
    // raposas
    for (const p of this.world.players) {
      const fox = this.foxes.get(p.id);
      if (!fox) continue;
      fox.group.visible = p.alive || p.y > layerY(DSM_LAYERS - 1) - DSM_LAVA_DEPTH - 2;
      fox.group.position.set(p.x, p.y, p.z);
      fox.group.rotation.y = p.heading + Math.PI;
      const speed = Math.hypot(p.vx, p.vz);
      const squash = p.grounded
        ? 1 + Math.sin(this.world.t * 18) * 0.04 * Math.min(1, speed / 3)
        : 1.08;
      fox.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      const pitch = p.grounded ? Math.min(0.18, speed * 0.03) : 0.25;
      if (fox.flip >= 0) {
        fox.flip += dt / 0.55;
        if (fox.flip >= 1) fox.flip = -1;
      }
      if (fox.flip >= 0) {
        // pirueta para a frente com saída suave, esticando no impulso e encolhendo na volta
        const e = 1 - Math.pow(1 - fox.flip, 3);
        fox.body.rotation.x = pitch + e * Math.PI * 2;
        const stretch = 1 + 0.22 * Math.sin(Math.PI * Math.min(1, fox.flip * 1.6));
        fox.body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
      } else {
        fox.body.rotation.x = pitch;
      }
    }
    // poeira
    for (const q of this.puffs) {
      if (q.age >= q.life) {
        q.sprite.visible = false;
        continue;
      }
      q.age += dt;
      const k = Math.min(1, q.age / q.life);
      q.sprite.position.x += q.vx * dt * (1 - k);
      q.sprite.position.y += q.vy * dt * (1 - k);
      q.sprite.position.z += q.vz * dt * (1 - k);
      q.sprite.scale.setScalar(0.5 + k * 1.1);
      (q.sprite.material as THREE.SpriteMaterial).opacity =
        0.5 * (1 - k) * Math.min(1, q.age / 0.05);
    }
    // anéis do pulo duplo
    for (const r of this.rings) {
      if (r.age >= 0.45) {
        r.mesh.visible = false;
        continue;
      }
      r.age += dt;
      const k = Math.min(1, r.age / 0.45);
      r.mesh.scale.setScalar(1 + k * 3.2);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k) * (1 - k);
    }
    // câmera
    const target = this.world.players.find((p) => p.id === focusId);
    if (target) {
      this.camFocus.lerp(tmpP.set(target.x, target.y, target.z), 1 - Math.exp(-dt * 10));

      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = this.reduced ? 0 : this.shake * 0.35;
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      const ce = Math.cos(this.pitch);
      const se = Math.sin(this.pitch);
      this.camera.position.set(
        this.camFocus.x + sy * ce * CAM_DIST + (Math.random() - 0.5) * sh,
        this.camFocus.y + se * CAM_DIST + 0.7 + (Math.random() - 0.5) * sh,
        this.camFocus.z + cy * ce * CAM_DIST,
      );
      this.camera.lookAt(
        this.camFocus.x - sy * 1.2,
        // sempre um pouco acima da raposa, em qualquer camada (as de baixo têm altura negativa)
        this.camFocus.y + 1,
        this.camFocus.z - cy * 1.2,
      );
      this.fadeUpperLayers(dt, target.y);
    }
    this.lava.position.y += Math.sin(this.world.t * 1.6) * 0.002;
    this.renderer.render(this.scene, this.camera);
  }

  setYaw(yaw: number) {
    this.yaw = yaw;
  }

  setPitch(pitch: number) {
    this.pitch = pitch;
  }

  /** Sacode a câmera (empurrão sofrido). */
  shakeNow(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  /** As camadas acima de quem a câmera segue ficam quase transparentes: nada tapa a raposa depois de uma queda. */
  private fadeUpperLayers(dt: number, focusY: number) {
    const k = 1 - Math.exp(-dt * 9);
    for (let l = 0; l < this.layers.length; l++) {
      const lm = this.layers[l] as LayerMesh;
      const mat = lm.mesh.material as THREE.MeshLambertMaterial;
      const want = layerY(l) > focusY + 1.2 ? 0.07 : 1;
      const cur = mat.opacity + (want - mat.opacity) * k;
      mat.opacity = Math.abs(cur - want) < 0.01 ? want : cur;
      const solid = mat.opacity >= 0.99;
      if (mat.transparent === solid) {
        mat.transparent = !solid;
        mat.depthWrite = solid;
        mat.needsUpdate = true;
      }
      lm.mesh.visible = mat.opacity > 0.02;
    }
  }

  dispose() {
    this.disposed = true;
    for (const q of this.puffs) (q.sprite.material as THREE.Material).dispose();
    this.puffTex?.dispose();
    for (const r of this.rings) {
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
    }
    for (const t of this.tags) {
      t.material.map?.dispose();
      t.material.dispose();
    }
    for (const lm of this.layers) {
      lm.mesh.geometry.dispose();
      (lm.mesh.material as THREE.Material).dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !this.layers.some((l) => l.mesh === (m as unknown as THREE.InstancedMesh)))
        m.geometry.dispose?.();
    });
    this.renderer.dispose();
  }
}
