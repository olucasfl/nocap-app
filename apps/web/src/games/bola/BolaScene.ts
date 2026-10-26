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
const WALL_H = 0.7;
const NET_DEPTH = 2.6;

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
    this.scene.background = new THREE.Color(0x8fd8ff);
    this.scene.fog = new THREE.Fog(0xa9e2ff, 60, 150);
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

  private buildField() {
    const f = this.world.field;
    // gramado
    const shape = new THREE.Shape(f.edges.map((e) => new THREE.Vector2(e.ax, -e.az)));
    const grass = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshLambertMaterial({ color: 0x58c46a }),
    );
    grass.rotation.x = -Math.PI / 2;
    this.scene.add(grass);
    // faixas do gramado, só para dar noção de velocidade
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshLambertMaterial({ color: 0x3f9a55 }),
    );
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.05;
    this.scene.add(far);
    const line = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.8, 48), line);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), line);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.02;
    this.scene.add(dot);

    for (const e of f.edges) {
      const ang = Math.atan2(e.tz, e.tx);
      const goal = e.goal >= 0 ? f.goals[e.goal] : undefined;
      const wallColor = 0xf3f1ff;
      const addWall = (len: number, cx: number, cz: number) => {
        if (len <= 0.01) return;
        const w = new THREE.Mesh(
          new THREE.BoxGeometry(len, WALL_H, 0.5),
          new THREE.MeshLambertMaterial({ color: wallColor }),
        );
        w.position.set(cx - e.nx * 0.25, WALL_H / 2, cz - e.nz * 0.25);
        w.rotation.y = -ang;
        this.scene.add(w);
      };
      if (!goal) {
        addWall(e.len, e.mx, e.mz);
        continue;
      }
      const side = (e.len - goal.halfW * 2) / 2;
      const off = goal.halfW + side / 2;
      addWall(side, e.mx - e.tx * off, e.mz - e.tz * off);
      addWall(side, e.mx + e.tx * off, e.mz + e.tz * off);
      const col = BOL_TEAM_COLORS[goal.team] ?? 0xffffff;
      // faixa colorida no chão, na frente do gol
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(goal.halfW * 2, 3.2), mat);
      zone.rotation.x = -Math.PI / 2;
      zone.rotation.z = -ang;
      zone.position.set(e.mx + e.nx * 1.6, 0.025, e.mz + e.nz * 1.6);
      this.scene.add(zone);
      // trave, travessão e rede
      const post = new THREE.MeshLambertMaterial({ color: 0xffffff });
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, BOL_GOAL_H, 10), post);
        p.position.set(e.mx + e.tx * goal.halfW * s, BOL_GOAL_H / 2, e.mz + e.tz * goal.halfW * s);
        this.scene.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(goal.halfW * 2, 0.3, 0.3), post);
      bar.position.set(e.mx, BOL_GOAL_H, e.mz);
      bar.rotation.y = -ang;
      this.scene.add(bar);
      const net = new THREE.Mesh(
        new THREE.BoxGeometry(goal.halfW * 2, BOL_GOAL_H, NET_DEPTH),
        new THREE.MeshLambertMaterial({
          color: col,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      net.position.set(
        e.mx - e.nx * (NET_DEPTH / 2),
        BOL_GOAL_H / 2,
        e.mz - e.nz * (NET_DEPTH / 2),
      );
      net.rotation.y = -ang;
      this.scene.add(net);
    }
  }

  private buildBall(): THREE.Mesh {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d');
    if (g) {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#1b1535';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc(16 + i * 32, 30 + (i % 2) * 60, 12, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(BOL_BALL_R, 24, 16),
      new THREE.MeshLambertMaterial({ map: tex }),
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
