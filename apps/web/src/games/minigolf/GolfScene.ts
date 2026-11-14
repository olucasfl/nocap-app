import * as THREE from 'three';
import { GOLF_BALL_RADIUS, golfApplyMovement, type GolfBall, type GolfBallLook, type GolfLevel } from '@nocap/games';
import { buildBallMesh } from './ball-mesh';
import { BallTrail } from './trail';
import { buildGolfMaterials, type GolfMat } from './textures';

/** UV por triângulo, projetando no plano dominante (chão: x,z; paredes: z,y ou x,y), em repetições de `tile` metros. */
function triUv(pos: number[], tile: number): number[] {
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3]! - pos[i]!, ay = pos[i + 4]! - pos[i + 1]!, az = pos[i + 5]! - pos[i + 2]!;
    const bx = pos[i + 6]! - pos[i]!, by = pos[i + 7]! - pos[i + 1]!, bz = pos[i + 8]! - pos[i + 2]!;
    const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
    for (let k = 0; k < 3; k++) {
      const x = pos[i + 3 * k]!, y = pos[i + 3 * k + 1]!, z = pos[i + 3 * k + 2]!;
      if (ny >= nx && ny >= nz) uv.push(x / tile, z / tile);
      else if (nx >= nz) uv.push(z / tile, y / tile);
      else uv.push(x / tile, y / tile);
    }
  }
  return uv;
}

export interface AimView {
  /** Direção no plano (x, z), já normalizada. */
  dir: [number, number];
  /** Força de 0 a 1. */
  power: number;
}

export class GolfScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 220);
  /** Ângulo da câmera ao redor da bola (rad). A tacada "para frente" é para onde a câmera olha. */
  yaw = 0;
  /** Câmera de perto no copo (a bola está caindo no buraco). */
  focusHole = false;
  private ballMesh: THREE.Mesh;
  private dots: THREE.Mesh[] = [];
  private head: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
  private movers: { mesh: THREE.Object3D; i: number }[] = [];
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private spin = new THREE.Quaternion();
  private gm = buildGolfMaterials();
  private trail = new BallTrail();

  constructor(
    canvas: HTMLCanvasElement,
    private level: GolfLevel,
    look: GolfBallLook,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0x9fd8ea);
    this.scene.fog = new THREE.Fog(0xb9e3ee, 40, 170);

    this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x4a7a4a, 1.1));
    this.sun.position.set(14, 24, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);

    this.buildLevel();

    this.ballMesh = buildBallMesh(look);
    this.trail.setKind(look.trail);
    this.scene.add(this.trail.points);
    this.scene.add(this.ballMesh);

    const dotGeo = new THREE.SphereGeometry(0.045, 10, 8);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 5;
      this.dots.push(m);
      this.scene.add(m);
    }
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }));
    this.head.visible = false;
    this.head.renderOrder = 5;
    this.scene.add(this.head);

    // a câmera começa olhando para o buraco
    const s = level.data.ballStart, h = level.data.holes[0]!.p;
    this.yaw = Math.atan2(h[0] - s[0], h[2] - s[2]);
    this.snapCamera(new THREE.Vector3(s[0], s[1] + GOLF_BALL_RADIUS, s[2]));
  }

  private buildLevel() {
    const d = this.level.data;
    const group = new THREE.Group();
    const byMat = new Map<number, number[]>();
    const water: number[] = [];
    for (let i = 0; i < d.solid.m.length; i++) {
      const tri = d.solid.t.slice(i * 9, i * 9 + 9);
      if (d.solid.f[i]! & 2) water.push(...tri);
      else {
        const k = d.solid.m[i]!;
        if (!byMat.has(k)) byMat.set(k, []);
        byMat.get(k)!.push(...tri);
      }
    }
    const mk = (pos: number[], gm: GolfMat | THREE.Material, tile = 2, shadow = true) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      g.setAttribute('uv', new THREE.Float32BufferAttribute(triUv(pos, 'mat' in gm ? gm.tile : tile), 2));
      const m = new THREE.Mesh(g, 'mat' in gm ? gm.mat : gm);
      m.castShadow = shadow;
      m.receiveShadow = true;
      return m;
    };
    byMat.forEach((pos, k) => group.add(mk(pos, this.gm.get(d.materials[k]!.name))));
    if (water.length) group.add(mk(water, this.gm.water, 2, false));
    // peças móveis: a geometria local gira e anda por `golfApplyMovement` a cada quadro
    d.moving.forEach((mv, i) => {
      const by = new Map<number, number[]>();
      for (let j = 0; j < mv.m.length; j++) {
        const k = mv.m[j]!;
        if (!by.has(k)) by.set(k, []);
        by.get(k)!.push(...mv.t.slice(j * 9, j * 9 + 9));
      }
      const holder = new THREE.Group();
      by.forEach((pos, k) => holder.add(mk(pos, this.gm.get(d.materials[k]!.name))));
      this.movers.push({ mesh: holder, i });
      group.add(holder);
    });
    // copo: paredes do modelo e o fundo físico, e a bandeira
    const cup = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, side: THREE.DoubleSide });
    d.holes.forEach((h, i) => {
      group.add(mk(d.holeTris[i]!, cup, 2, false));
      group.add(mk(this.level.holeFloors[i]!, cup, 2, false));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 8), new THREE.MeshStandardMaterial({ color: 0xf4f4ef, metalness: 0.5, roughness: 0.3 }));
      pole.position.set(h.p[0], h.p[1] + 0.52, h.p[2]);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.8, side: THREE.DoubleSide }));
      flag.position.set(h.p[0] + 0.2, h.p[1] + 0.92, h.p[2]);
      pole.castShadow = flag.castShadow = true;
      group.add(pole, flag);
    });
    this.scene.add(group);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Mostra a linha de mira (pontos que somem na ponta) ou a esconde. */
  setAim(ball: GolfBall, aim: AimView | null) {
    if (!aim) {
      this.dots.forEach((m) => (m.visible = false));
      this.head.visible = false;
      return;
    }
    const p = aim.power;
    const color = p < 0.4 ? 0x39e66a : p < 0.65 ? 0xd7e63a : p < 0.9 ? 0xf0a020 : 0xf0402a;
    const length = 0.7 + 3.3 * p;
    const n = this.dots.length;
    this.dots.forEach((m, i) => {
      const f = (i + 1) / n;
      m.visible = true;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.95 - 0.5 * f;
      m.position.set(ball.pos[0] + aim.dir[0] * length * f, ball.pos[1] - 0.06, ball.pos[2] + aim.dir[1] * length * f);
    });
    this.head.visible = true;
    (this.head.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.head.position.set(ball.pos[0] + aim.dir[0] * (length + 0.15), ball.pos[1] - 0.06, ball.pos[2] + aim.dir[1] * (length + 0.15));
    this.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(aim.dir[0], 0, aim.dir[1]));
  }

  private snapCamera(target: THREE.Vector3) {
    const off = new THREE.Vector3(-Math.sin(this.yaw) * 3.4, 1.9, -Math.cos(this.yaw) * 3.4);
    this.camPos.copy(target).add(off);
    this.camLook.copy(target).add(new THREE.Vector3(Math.sin(this.yaw) * 1.2, 0.1, Math.cos(this.yaw) * 1.2));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Um quadro: posição da bola, peças móveis, câmera suave e luz de sombra seguindo a bola. */
  render(ball: GolfBall, time: number, dt: number, drawPos?: [number, number, number]) {
    const p = drawPos ?? ball.pos;
    this.gm.tick(dt);
    this.ballMesh.position.set(p[0], p[1], p[2]);
    const sp = Math.hypot(ball.vel[0], ball.vel[2]);
    this.trail.update(dt, [p[0], p[1], p[2]], sp);
    if (sp > 0.05) {
      const axis = new THREE.Vector3(ball.vel[2], 0, -ball.vel[0]).normalize();
      this.spin.setFromAxisAngle(axis, (sp * dt) / GOLF_BALL_RADIUS);
      this.ballMesh.quaternion.premultiply(this.spin);
    }
    this.movers.forEach(({ mesh, i }) => {
      const mv = this.level.data.moving[i]!;
      const t = golfApplyMovement({ p: mv.base.p, s: mv.base.s, r: mv.base.r }, mv.movement, time);
      mesh.position.set(...t.p);
      mesh.quaternion.set(t.r[0], t.r[1], t.r[2], t.r[3]);
      mesh.scale.set(...t.s);
    });
    const target = new THREE.Vector3(p[0], p[1], p[2]);
    const hole = this.level.data.holes[0]!.p;
    const want = this.focusHole
      ? new THREE.Vector3(hole[0] - Math.sin(this.yaw) * 1.1, hole[1] + 0.85, hole[2] - Math.cos(this.yaw) * 1.1)
      : new THREE.Vector3(-Math.sin(this.yaw) * 3.4, 1.9, -Math.cos(this.yaw) * 3.4).add(target);
    const k = 1 - Math.pow(this.focusHole ? 0.02 : 0.0001, dt);
    this.camPos.lerp(want, k);
    this.camLook.lerp(
      this.focusHole ? target : target.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 1.2, 0.1, Math.cos(this.yaw) * 1.2)),
      k,
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.sun.position.set(target.x + 14, target.y + 24, target.z + 8);
    this.sun.target.position.copy(target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
