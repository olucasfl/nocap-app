import * as THREE from 'three';

/**
 * Texturas procedurais do Mini Golf (spec 082): geradas por código no navegador, sem arquivos e sem licença de terceiros.
 * Cada textura sai do canvas com mapa de cor e mapa de relevo (normal) derivado dele; tudo é "tileável" (sem emenda).
 */
const SIZE = 512;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor periódico: x e y dão voltas em px e py células, então a textura emenda sozinha. */
function makeNoise(seed: number) {
  const r = rng(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x: number, y: number) => grid[(y & 255) * 256 + (x & 255)]!;
  return (u: number, v: number, px: number, py: number) => {
    const x = u * px, y = v * py;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const wx = (n: number) => ((n % px) + px) % px, wy = (n: number) => ((n % py) + py) % py;
    const a = at(wx(x0), wy(y0)), b = at(wx(x0 + 1), wy(y0)), c = at(wx(x0), wy(y0 + 1)), d = at(wx(x0 + 1), wy(y0 + 1));
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

function paint(fn: (u: number, v: number) => RGB): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, r));
      img.data[i + 1] = Math.max(0, Math.min(255, g));
      img.data[i + 2] = Math.max(0, Math.min(255, b));
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Mapa de relevo (normal) a partir da luminância do canvas, com bordas que dão a volta. */
function normalFrom(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const ctx = src.getContext('2d')!;
  const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const h = (x: number, y: number) => {
    const i = ((((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)) * 4;
    return (d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11) / 255;
  };
  const out = document.createElement('canvas');
  out.width = out.height = SIZE;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  octx.putImageData(img, 0, 0);
  return out;
}

export interface TexSet {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}
function toSet(color: HTMLCanvasElement, strength: number): TexSet {
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.CanvasTexture(normalFrom(color, strength));
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return { map, normal };
}

const fbm = (n: ReturnType<typeof makeNoise>, u: number, v: number, base: number, oct = 4) => {
  let a = 0, amp = 0.5, tot = 0, p = base;
  for (let o = 0; o < oct; o++) {
    a += n(u, v, p, p) * amp;
    tot += amp;
    amp *= 0.5;
    p *= 2;
  }
  return a / tot;
};

/** Grama cortada: ruído em camadas, lâminas e faixas claras e escuras (a faixa vale 2 m de textura). */
function grass(dark: boolean): TexSet {
  const n = makeNoise(11);
  const lo = hex(dark ? 0x2a7d3f : 0x3a9d4f), hi = hex(dark ? 0x3f9a52 : 0x57bf63);
  const c = paint((u, v) => {
    const t = fbm(n, u, v, 8, 5);
    const stripe = v < 0.5 ? 1.08 : 0.9;
    const col = mix(lo, hi, Math.pow(t, 1.4));
    return [col[0] * stripe, col[1] * stripe, col[2] * stripe];
  });
  const ctx = c.getContext('2d')!;
  const r = rng(5);
  for (let i = 0; i < 9000; i++) {
    const x = r() * SIZE, y = r() * SIZE, len = 4 + r() * 8, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(120,200,110,0.30)' : 'rgba(20,70,30,0.25)';
    ctx.lineWidth = 1 + r();
    for (const dy of [-SIZE, 0, SIZE]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.lineTo(x + Math.cos(ang) * len, y + dy + Math.sin(ang) * len);
      ctx.stroke();
    }
  }
  return toSet(c, 2.4);
}

/** Madeira: tábuas com veios, nós e frestas escuras entre elas. */
function wood(base: number, dark: number, planks: number, seed: number): TexSet {
  const n = makeNoise(seed);
  const a = hex(base), b = hex(dark);
  const r = rng(seed + 1);
  const shift = Array.from({ length: planks }, () => r());
  const c = paint((u, v) => {
    const p = Math.floor(v * planks), pv = v * planks - p;
    const g = n((u + shift[p]!) % 1, v, 3, 64) * 0.6 + n(u, v, 9, 120) * 0.4;
    const ring = Math.sin(g * 26 + n(u, v, 2, 6) * 6) * 0.5 + 0.5;
    let col = mix(a, b, 0.25 + 0.55 * ring * g);
    const seam = Math.min(pv, 1 - pv);
    if (seam < 0.025) col = mix(col, [20, 12, 6], 0.75 * (1 - seam / 0.025));
    const tone = 0.9 + 0.2 * shift[p]!;
    return [col[0] * tone, col[1] * tone, col[2] * tone];
  });
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    const x = r() * SIZE, y = r() * SIZE;
    const grd = ctx.createRadialGradient(x, y, 1, x, y, 16);
    grd.addColorStop(0, 'rgba(40,22,8,0.75)');
    grd.addColorStop(0.6, 'rgba(60,34,12,0.35)');
    grd.addColorStop(1, 'rgba(60,34,12,0)');
    ctx.fillStyle = grd;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.2, 1);
    ctx.translate(-x, -y);
    ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.restore();
  }
  return toSet(c, 2.0);
}

function dirt(): TexSet {
  const n = makeNoise(31), r = rng(32);
  const c = paint((u, v) => mix(hex(0x5a4128), hex(0x8f6d46), fbm(n, u, v, 10, 5)));
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 700; i++) {
    const x = r() * SIZE, y = r() * SIZE, s = 1 + r() * 3;
    ctx.fillStyle = r() > 0.5 ? 'rgba(160,140,115,0.55)' : 'rgba(30,20,10,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, 7);
    ctx.fill();
  }
  return toSet(c, 3.0);
}

/** Pedra das plataformas: lajes com juntas e manchas. */
function stone(): TexSet {
  const n = makeNoise(41);
  const c = paint((u, v) => {
    const t = fbm(n, u, v, 6, 5);
    let col = mix(hex(0x6f7378), hex(0xb4b8bb), t);
    const gx = Math.min((u * 4) % 1, 1 - ((u * 4) % 1)), gy = Math.min((v * 4) % 1, 1 - ((v * 4) % 1));
    if (Math.min(gx, gy) < 0.02) col = mix(col, [40, 42, 44], 0.7);
    return col;
  });
  return toSet(c, 2.2);
}

function metal(): TexSet {
  const n = makeNoise(51);
  const c = paint((u, v) => {
    const t = n(u, v, 2, 200) * 0.5 + n(u, v, 6, 260) * 0.5;
    const k = 150 + t * 70;
    return [k, k + 4, k + 8];
  });
  return toSet(c, 0.8);
}

function leaves(autumn: boolean): TexSet {
  const n = makeNoise(autumn ? 62 : 61);
  const a = hex(autumn ? 0xb0541c : 0x1f5f2f), b = hex(autumn ? 0xe0a02c : 0x3f9650);
  const c = paint((u, v) => mix(a, b, Math.pow(fbm(n, u, v, 14, 4), 1.2)));
  return toSet(c, 2.6);
}

function sand(): TexSet {
  const n = makeNoise(101), r = rng(102);
  const c = paint((u, v) => mix(hex(0xd8c288), hex(0xf0e0b0), fbm(n, u, v, 12, 5)));
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,245,210,0.5)' : 'rgba(150,120,70,0.35)';
    ctx.fillRect(r() * SIZE, r() * SIZE, 1.5, 1.5);
  }
  return toSet(c, 2.2);
}

function ice(): TexSet {
  const n = makeNoise(111), r = rng(112);
  const c = paint((u, v) => mix(hex(0x9ad8f2), hex(0xe4f7ff), fbm(n, u, v, 5, 4)));
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 0.6 + r();
    ctx.beginPath();
    let x = r() * SIZE, y = r() * SIZE;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) ctx.lineTo((x += (r() - 0.5) * 60), (y += (r() - 0.5) * 60));
    ctx.stroke();
  }
  return toSet(c, 0.8);
}

function bumperTex(): TexSet {
  const c = paint((u, v) => (Math.floor(v * 8) % 2 === 0 ? hex(0xe8402c) : hex(0xf4f4ef)));
  return toSet(c, 0.4);
}

function paintRed(): TexSet {
  const n = makeNoise(71);
  const c = paint((u, v) => mix(hex(0xb8301f), hex(0xe2503a), fbm(n, u, v, 8, 3)));
  return toSet(c, 0.8);
}

function waterTex(): TexSet {
  const n = makeNoise(81);
  const c = paint((u, v) => {
    const t = fbm(n, u, v, 6, 4);
    const ripple = Math.sin(t * 24) * 0.5 + 0.5;
    return mix(hex(0x1f86c0), hex(0x7fd4f2), ripple * 0.5 + t * 0.4);
  });
  return toSet(c, 2.0);
}

/** Relevo dos furinhos da bola: grade hexagonal de depressões circulares. */
export function ballNormal(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const cols = 28, rows = 14;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = ((i + (j % 2) * 0.5) / cols) * SIZE, y = ((j + 0.5) / rows) * SIZE;
      const r = (SIZE / cols) * 0.36;
      for (const dx of [-SIZE, 0, SIZE]) {
        const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        g.addColorStop(0, '#6a6a6a');
        g.addColorStop(0.7, '#b0b0b0');
        g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + dx, y, r, 0, 7);
        ctx.fill();
      }
    }
  const t = new THREE.CanvasTexture(normalFrom(c, 5));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export interface GolfMat {
  mat: THREE.MeshStandardMaterial;
  /** Tamanho em metros que uma repetição da textura cobre. */
  tile: number;
}

/** Cria o material de cada nome de material do Open Golf, com a textura certa. */
export function buildGolfMaterials(): { get: (name: string) => GolfMat; water: THREE.MeshStandardMaterial; tick: (dt: number) => void } {
  const T = {
    grass: grass(false),
    grassDark: grass(true),
    woodTop: wood(0xc08a52, 0x7a4a24, 4, 91),
    woodSide: wood(0x8c5a2e, 0x4e2e14, 4, 92),
    woodLight: wood(0xd6b07a, 0x9a6c3c, 5, 93),
    bark: wood(0x5e3f22, 0x2e1c0e, 3, 94),
    birch: wood(0xe8e0cc, 0xa59c86, 3, 95),
    dirt: dirt(),
    stone: stone(),
    metal: metal(),
    leaves: leaves(false),
    autumn: leaves(true),
    red: paintRed(),
    sand: sand(),
    ice: ice(),
    bumper: bumperTex(),
    water: waterTex(),
  };
  const mk = (s: TexSet, rough: number, metalness = 0, ns = 1) =>
    new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normal, normalScale: new THREE.Vector2(ns, ns), roughness: rough, metalness, side: THREE.DoubleSide });
  const cache = new Map<string, GolfMat>();
  const defs: Record<string, () => GolfMat> = {
    ground: () => ({ mat: mk(T.grass, 0.95), tile: 2 }),
    default: () => ({ mat: mk(T.grass, 0.95), tile: 2 }),
    grass: () => ({ mat: mk(T.grassDark, 0.95), tile: 2 }),
    'wall-top': () => ({ mat: mk(T.woodTop, 0.7), tile: 2 }),
    'wall-side': () => ({ mat: mk(T.woodSide, 0.75), tile: 2 }),
    woodInner: () => ({ mat: mk(T.woodLight, 0.7), tile: 1.5 }),
    woodBarkDark: () => ({ mat: mk(T.bark, 0.9, 0, 1.4), tile: 1 }),
    woodBirch: () => ({ mat: mk(T.birch, 0.85), tile: 1 }),
    dirt: () => ({ mat: mk(T.dirt, 1, 0, 1.2), tile: 2 }),
    metal: () => ({ mat: mk(T.metal, 0.3, 0.7, 0.6), tile: 1 }),
    border: () => ({ mat: mk(T.red, 0.5), tile: 2 }),
    sand: () => ({ mat: mk(T.sand, 1, 0, 1.3), tile: 2 }),
    ice: () => ({ mat: mk(T.ice, 0.06, 0.1, 0.5), tile: 2 }),
    bumper: () => ({ mat: mk(T.bumper, 0.3, 0.1, 0.3), tile: 1 }),
    ground_spinner_platform: () => ({ mat: mk(T.stone, 0.85), tile: 2 }),
    ground_mover_platform: () => ({ mat: mk(T.stone, 0.85), tile: 2 }),
    leafsDark: () => ({ mat: mk(T.leaves, 0.9, 0, 1.2), tile: 1 }),
    leafsFall: () => ({ mat: mk(T.autumn, 0.9, 0, 1.2), tile: 1 }),
  };
  const water = new THREE.MeshStandardMaterial({ map: T.water.map, normalMap: T.water.normal, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  return {
    get(name) {
      let m = cache.get(name);
      if (!m) {
        m = (defs[name] ?? defs.ground!)();
        cache.set(name, m);
      }
      return m;
    },
    water,
    tick(dt) {
      T.water.map.offset.x += dt * 0.03;
      T.water.map.offset.y += dt * 0.012;
      T.water.normal.offset.copy(T.water.map.offset);
    },
  };
}
