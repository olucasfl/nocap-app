import * as THREE from 'three';
import {
  DSM_HEX_SIZE,
  DSM_LAYERS,
  DSM_LAVA_DEPTH,
  DSM_TILE_THICK,
  hexKey,
  layerY,
  type DsmEvent,
  type DsmPlayer,
  type DsmTile,
  type DsmWorld,
} from '@nocap/games';
import { buildHero } from '../atravessa/models';

/** Cores das camadas, de cima para baixo (a de cima é a maior). */
const LAYER_COLORS = [0x9a5cff, 0xff7ab8, 0xffa24d, 0xffd84d, 0x8be36b, 0x55d9ff, 0x6b7bff];
const CRACK_COLOR = new THREE.Color(0xff4d4d);
const WAVE_COLOR = new THREE.Color(0xff9d2e);
const STEP_MIX = 0.35;

/** Câmera: atrás (para o sul) e acima, sempre olhando para o norte; W é sempre "para cima" na tela. */
const CAM_BACK = 11;
const CAM_UP = 9.5;
const CAM_LOOK_UP = 1.2;

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
}

interface Fox {
  group: THREE.Group;
  body: THREE.Object3D;
  id: string;
}

const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

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
  /** Ladrilhos pisados (precisam ser reatualizados a cada quadro por causa da tremida). */
  private hot = new Set<string>();
  private lava: THREE.Mesh;
  private camPos = new THREE.Vector3(0, 10, 12);
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
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.6 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x7fd3ff);
    this.scene.fog = new THREE.Fog(0x9fdcff, 45, 120);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(14, 30, 10);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8fa2c8, 1.25));

    this.buildLayers();
    this.buildScenery();
    this.lava = this.buildLava();
    for (const p of world.players) this.addFox(p);
  }

  private buildLayers() {
    const geo = new THREE.CylinderGeometry(DSM_HEX_SIZE * 0.97, DSM_HEX_SIZE * 0.97, DSM_TILE_THICK, 6, 1);
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

  private setTileMatrix(mesh: THREE.InstancedMesh, i: number, t: DsmTile, dy: number, scale: number, rot = 0) {
    tmpP.set(t.x, layerY(t.layer) - DSM_TILE_THICK / 2 + dy, t.z);
    tmpQ.setFromAxisAngle(UP, rot);
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
      const m = new THREE.Mesh(hill, new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
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
    group.add(hero);
    const body = hero;
    this.scene.add(group);
    this.foxes.set(p.id, { group, body, id: p.id });
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // celular em pé: abre o campo de visão para a arena caber
    this.camera.fov = this.camera.aspect < 1 ? 74 : 58;
    this.camera.updateProjectionMatrix();
  }

  /** Reage aos eventos do motor (tremida, queda de ladrilho, tremor da câmera). */
  handle(events: readonly DsmEvent[], focusId: string) {
    for (const e of events) {
      if (e.type === 'step') {
        const lm = this.layers[e.layer];
        const i = lm?.index.get(hexKey(e.layer, e.q, e.r));
        if (lm && i !== undefined) {
          this.hot.add(`${e.layer}:${i}`);
          this.paintTile(lm, i, lm.tiles[i] as DsmTile);
        }
      } else if (e.type === 'break') {
        const lm = this.layers[e.layer];
        const i = lm?.index.get(hexKey(e.layer, e.q, e.r));
        if (lm && i !== undefined) {
          const t = lm.tiles[i] as DsmTile;
          this.hot.delete(`${e.layer}:${i}`);
          this.falling.push({ layer: e.layer, i, age: 0, x: t.x, y: 0, z: t.z, spin: ((i % 7) - 3) * 0.5 });
        }
      } else if (e.type === 'wave') {
        // a onda avisa: marca os ladrilhos da camada que já estão quebrando
        for (const [i, t] of (this.layers[e.layer]?.tiles ?? []).entries()) {
          if (t.status === 'pisado') this.hot.add(`${e.layer}:${i}`);
        }
        this.shake = Math.max(this.shake, 0.5);
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
      if (t.wave) base.lerp(WAVE_COLOR, 0.65);
      else base.lerp(tmpC2.set(0xffffff), STEP_MIX * (1 - crack));
      base.lerp(CRACK_COLOR, crack * 0.85);
    }
    lm.mesh.setColorAt(i, base);
    if (lm.mesh.instanceColor) lm.mesh.instanceColor.needsUpdate = true;
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
      const crack = this.world.crack(t);
      const jitter = this.reduced ? 0 : crack * 0.07 * Math.sin(this.world.t * 90 + i);
      this.setTileMatrix(lm.mesh, i, t, jitter - crack * 0.05, 1);
      lm.mesh.instanceMatrix.needsUpdate = true;
    }
    // ladrilhos caindo: afundam girando e somem
    for (let k = this.falling.length - 1; k >= 0; k--) {
      const f = this.falling[k] as Falling;
      f.age += dt;
      f.y -= (6 + f.age * 22) * dt;
      const lm = this.layers[f.layer] as LayerMesh;
      const t = lm.tiles[f.i] as DsmTile;
      const s = Math.max(0, 1 - f.age / 1.1);
      this.setTileMatrix(lm.mesh, f.i, t, f.y, s, f.age * f.spin);
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
      const squash = p.grounded ? 1 + Math.sin(this.world.t * 18) * 0.04 * Math.min(1, speed / 3) : 1.08;
      fox.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      fox.body.rotation.x = p.grounded ? Math.min(0.18, speed * 0.03) : 0.25;
    }
    // câmera
    const target = this.world.players.find((p) => p.id === focusId);
    if (target) {
      this.camFocus.lerp(tmpP.set(target.x, target.y, target.z), 1 - Math.exp(-dt * 7));
      const want = tmpP.set(this.camFocus.x, this.camFocus.y + CAM_UP, this.camFocus.z + CAM_BACK);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 6));
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = this.reduced ? 0 : this.shake * 0.35;
      this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z);
      this.camera.lookAt(this.camFocus.x, this.camFocus.y + CAM_LOOK_UP, this.camFocus.z - 1.5);
    }
    this.lava.position.y += Math.sin(this.world.t * 1.6) * 0.002;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    for (const lm of this.layers) {
      lm.mesh.geometry.dispose();
      (lm.mesh.material as THREE.Material).dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !this.layers.some((l) => l.mesh === (m as unknown as THREE.InstancedMesh))) m.geometry.dispose?.();
    });
    this.renderer.dispose();
  }
}
