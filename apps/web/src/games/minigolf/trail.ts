import * as THREE from 'three';
import type { GolfTrail } from '@nocap/games';

/**
 * Rastro da bola (spec 082): partículas com tamanho, cor e transparência próprios (shader de pontos).
 * Cada tipo tem seu jeito: faíscas que quicam, fogo que cresce e vira fumaça, neve, fita de arco-íris,
 * estrelas que piscam, bolhas, raio elétrico e um cometa na cor da própria bola.
 */
const N = 220;

function tex(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}
const makeTextures = () => ({
  dot: tex((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }),
  star: tex((ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 11 : 27;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }),
  bubble: tex((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 14, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(22, 20, 5, 0, 7);
    ctx.fill();
  }),
  bolt: tex((ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(40, 6); ctx.lineTo(24, 30); ctx.lineTo(38, 34); ctx.lineTo(22, 58);
    ctx.stroke();
  }),
});

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 color;
varying float vA;
varying vec3 vC;
void main() {
  vA = alpha;
  vC = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * 560.0 / max(0.2, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map;
varying float vA;
varying vec3 vC;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC, t.a * vA) * vec4(t.rgb, 1.0);
}`;

const hsv = (h: number, s: number, v: number): [number, number, number] => {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as const)[((i % 6) + 6) % 6] as [number, number, number];
};

export class BallTrail {
  readonly points: THREE.Points;
  private textures = makeTextures();
  private pos = new Float32Array(N * 3);
  private col = new Float32Array(N * 3);
  private alp = new Float32Array(N);
  private siz = new Float32Array(N);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private max = new Float32Array(N);
  private seed = new Float32Array(N);
  private next = 0;
  private acc = 0;
  private time = 0;
  private kind: GolfTrail = 'nenhum';
  private tint: [number, number, number] = [1, 1, 1];
  private mat: THREE.ShaderMaterial;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1));
    g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.textures.dot } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.reset();
  }

  private reset() {
    this.life.fill(0);
    this.pos.fill(-1000);
    this.alp.fill(0);
  }

  setKind(kind: GolfTrail, ballColor = 0xffffff) {
    this.kind = kind;
    this.tint = [((ballColor >> 16) & 255) / 255, ((ballColor >> 8) & 255) / 255, (ballColor & 255) / 255];
    const additive: Partial<Record<GolfTrail, boolean>> = { faiscas: true, fogo: true, arcoiris: true, estrelas: true, raio: true, cometa: true };
    this.mat.blending = additive[kind] ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.mat.uniforms.map!.value =
      kind === 'estrelas' ? this.textures.star : kind === 'bolhas' ? this.textures.bubble : kind === 'raio' ? this.textures.bolt : this.textures.dot;
    this.mat.needsUpdate = true;
    this.reset();
  }

  private spawn(p: [number, number, number], speed: number) {
    const i = this.next;
    this.next = (this.next + 1) % N;
    const r = () => Math.random() - 0.5;
    this.pos[i * 3] = p[0] + r() * 0.08;
    this.pos[i * 3 + 1] = p[1] - 0.04 + r() * 0.05;
    this.pos[i * 3 + 2] = p[2] + r() * 0.08;
    this.seed[i] = Math.random();
    const k = this.kind;
    let v: [number, number, number] = [0, 0, 0];
    if (k === 'faiscas') { v = [r() * 1.8, 0.5 + Math.random() * 1.4, r() * 1.8]; this.max[i] = 0.4 + Math.random() * 0.35; this.siz[i] = 0.05 + Math.random() * 0.05; }
    else if (k === 'fogo') { v = [r() * 0.35, 0.6 + Math.random() * 0.7, r() * 0.35]; this.max[i] = 0.55 + Math.random() * 0.4; this.siz[i] = 0.1; }
    else if (k === 'neve') { v = [r() * 0.3, -0.12 - Math.random() * 0.15, r() * 0.3]; this.max[i] = 1 + Math.random() * 0.6; this.siz[i] = 0.05 + Math.random() * 0.04; }
    else if (k === 'arcoiris') { v = [0, 0.02, 0]; this.max[i] = 0.9; this.siz[i] = 0.13; this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1] - 0.03; this.pos[i * 3 + 2] = p[2]; }
    else if (k === 'estrelas') { v = [r() * 0.9, 0.2 + Math.random() * 0.7, r() * 0.9]; this.max[i] = 0.8 + Math.random() * 0.5; this.siz[i] = 0.08 + Math.random() * 0.08; }
    else if (k === 'bolhas') { v = [r() * 0.35, 0.35 + Math.random() * 0.35, r() * 0.35]; this.max[i] = 1.1 + Math.random() * 0.6; this.siz[i] = 0.07 + Math.random() * 0.1; }
    else if (k === 'raio') { v = [r() * 2.4, r() * 1.2, r() * 2.4]; this.max[i] = 0.12 + Math.random() * 0.12; this.siz[i] = 0.12 + Math.random() * 0.12; }
    else { v = [r() * 0.05, 0.02, r() * 0.05]; this.max[i] = 0.7; this.siz[i] = 0.16; this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1] - 0.02; this.pos[i * 3 + 2] = p[2]; }
    this.vel.set(v, i * 3);
    this.life[i] = this.max[i]!;
    void speed;
  }

  update(dt: number, ball: [number, number, number], speed: number) {
    if (this.kind === 'nenhum') {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    this.time += dt;
    if (speed > 0.6) {
      const rate = this.kind === 'arcoiris' || this.kind === 'cometa' ? 60 + speed * 6 : this.kind === 'raio' ? 40 : 18 + speed * 4;
      this.acc += dt * rate;
      while (this.acc >= 1) {
        this.acc -= 1;
        this.spawn(ball, speed);
      }
    }
    const k = this.kind;
    for (let i = 0; i < N; i++) {
      if (this.life[i]! <= 0) {
        this.pos[i * 3 + 1] = -1000;
        this.alp[i] = 0;
        continue;
      }
      this.life[i] = this.life[i]! - dt;
      const t = Math.max(0, this.life[i]! / this.max[i]!); // 1 novo, 0 morrendo
      if (k === 'faiscas') {
        this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! - 4.5 * dt; // gravidade: as faíscas arqueiam
        if (this.pos[i * 3 + 1]! < ball[1] - 0.08 && this.vel[i * 3 + 1]! < 0) this.vel[i * 3 + 1] = -this.vel[i * 3 + 1]! * 0.45;
      }
      if (k === 'estrelas' || k === 'bolhas') this.vel[i * 3] = this.vel[i * 3]! + Math.sin(this.time * 4 + this.seed[i]! * 20) * 0.6 * dt;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
      let c: [number, number, number] = [1, 1, 1];
      let a = t;
      if (k === 'faiscas') { c = [1, 0.5 + 0.45 * t, 0.12 * t]; }
      else if (k === 'fogo') {
        // nasce amarelo, passa a laranja e vermelho, e termina como fumaça cinza que cresce
        c = t > 0.6 ? [1, 0.75, 0.2] : t > 0.3 ? [1, 0.4, 0.05] : [0.45, 0.3, 0.28];
        this.siz[i] = 0.08 + (1 - t) * 0.16;
        a = t * 0.9;
      } else if (k === 'neve') { c = [0.95, 0.98, 1]; a = Math.min(1, t * 2) * 0.9; }
      else if (k === 'arcoiris') { c = hsv((this.seed[i]! * 0 + (this.time * 1.2 + (1 - t) * 0.9)) % 1, 0.85, 1); a = t * 0.85; this.siz[i] = 0.09 + 0.07 * t; }
      else if (k === 'estrelas') { c = hsv((this.seed[i]! * 1) % 1, 0.45, 1); a = t * (0.6 + 0.4 * Math.sin(this.time * 18 + this.seed[i]! * 30)); }
      else if (k === 'bolhas') { c = [0.75, 0.92, 1]; a = Math.min(1, t * 3) * 0.8; }
      else if (k === 'raio') { c = [0.6 + 0.4 * t, 0.9, 1]; a = t; }
      else { c = [this.tint[0] * 0.7 + 0.3, this.tint[1] * 0.7 + 0.3, this.tint[2] * 0.7 + 0.3]; a = t * 0.8; this.siz[i] = 0.05 + 0.14 * t; }
      this.col.set(c, i * 3);
      this.alp[i] = a;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}
