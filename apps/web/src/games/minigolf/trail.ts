import * as THREE from 'three';
import type { GolfTrail } from '@nocap/games';

/** Rastro da bola (faíscas, fogo ou neve): um punhado de pontos que nascem atrás da bola e somem. */
const N = 72;
/** Bolinha macia (círculo com borda suave) para as partículas não saírem quadradas. */
function dot(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class BallTrail {
  readonly points: THREE.Points;
  private pos = new Float32Array(N * 3);
  private col = new Float32Array(N * 3);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private max = new Float32Array(N);
  private next = 0;
  private acc = 0;
  private kind: GolfTrail = 'nenhum';

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ map: dot(), size: 0.11, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.life.fill(0);
    this.pos.fill(-1000);
  }

  setKind(kind: GolfTrail) {
    this.kind = kind;
    (this.points.material as THREE.PointsMaterial).blending = kind === 'neve' ? THREE.NormalBlending : THREE.AdditiveBlending;
    (this.points.material as THREE.PointsMaterial).size = kind === 'neve' ? 0.07 : 0.11;
    (this.points.material as THREE.PointsMaterial).needsUpdate = true;
    this.life.fill(0);
    this.pos.fill(-1000);
  }

  private spawn(p: [number, number, number], speed: number) {
    const i = this.next;
    this.next = (this.next + 1) % N;
    const r = () => Math.random() - 0.5;
    this.pos[i * 3] = p[0] + r() * 0.1;
    this.pos[i * 3 + 1] = p[1] - 0.05 + r() * 0.05;
    this.pos[i * 3 + 2] = p[2] + r() * 0.1;
    if (this.kind === 'faiscas') {
      this.vel.set([r() * 1.4, 0.4 + Math.random() * 1.1, r() * 1.4], i * 3);
      this.max[i] = 0.35 + Math.random() * 0.3;
    } else if (this.kind === 'fogo') {
      this.vel.set([r() * 0.3, 0.5 + Math.random() * 0.5, r() * 0.3], i * 3);
      this.max[i] = 0.5 + Math.random() * 0.3;
    } else {
      this.vel.set([r() * 0.25, -0.15 - Math.random() * 0.15, r() * 0.25], i * 3);
      this.max[i] = 0.9 + Math.random() * 0.5;
    }
    this.life[i] = this.max[i]!;
    void speed;
  }

  update(dt: number, ball: [number, number, number], speed: number) {
    if (this.kind === 'nenhum') {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    if (speed > 0.6) {
      this.acc += dt * (14 + speed * 4);
      while (this.acc >= 1) {
        this.acc -= 1;
        this.spawn(ball, speed);
      }
    }
    for (let i = 0; i < N; i++) {
      if (this.life[i]! <= 0) {
        this.pos[i * 3 + 1] = -1000;
        continue;
      }
      this.life[i] = this.life[i]! - dt;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
      const t = Math.max(0, this.life[i]! / this.max[i]!);
      if (this.kind === 'faiscas') this.col.set([1, 0.55 + 0.4 * t, 0.15 * t], i * 3);
      else if (this.kind === 'fogo') this.col.set([1 * t + 0.3, 0.45 * t, 0.05], i * 3);
      else this.col.set([0.95, 0.98, 1], i * 3);
      if (this.kind !== 'neve') for (let k = 0; k < 3; k++) this.col[i * 3 + k] = this.col[i * 3 + k]! * t;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
