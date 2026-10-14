import * as THREE from 'three';
import type { AtravessaBiome, VehicleKind } from '@nocap/games';

/**
 * Os blocos do Atravessa!: tudo montado com caixas (estilo voxel), materiais simples e geometrias
 * compartilhadas. Quem desenha a cena (scene.ts) só monta e posiciona.
 */

/** Uniforms da escuridão, compartilhados por todos os materiais (spec 028, "A escuridão"). */
export const darkness = {
  /** Coordenada Z da frente da escuridão (tudo com Z maior, atrás do herói, escurece). */
  uDarkZ: { value: -1000 },
  /** Largura da borda suave, em casas. */
  uSoft: { value: 4 },
  /** O quanto a cor some atrás da frente (0 a 1): quase tudo, mas não preto chapado. */
  uDarkAmt: { value: 0.94 },
  uDarkCol: { value: new THREE.Color(0x03050c) },
};

/**
 * A escuridão é iluminação, não filtro de tela: cada pixel escurece de acordo com a posição no mundo
 * (atrás da frente), com borda suave. Assim carros, chão e árvores entram na sombra de verdade.
 */
function patchDarkness(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, darkness);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vDz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDz = (modelMatrix * vec4(transformed, 1.0)).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vDz;\nuniform float uDarkZ;\nuniform float uSoft;\nuniform float uDarkAmt;\nuniform vec3 uDarkCol;',
      )
      .replace(
        '#include <dithering_fragment>',
        'float dk = smoothstep(uDarkZ - uSoft, uDarkZ, vDz);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uDarkCol, dk * uDarkAmt);\n#include <dithering_fragment>',
      );
  };
  m.customProgramCacheKey = () => 'atravessa-dark';
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: THREE.ColorRepresentation, emissive = 0): THREE.MeshLambertMaterial {
  const c = new THREE.Color(color);
  const key = `${c.getHexString()}:${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c });
    if (emissive > 0) {
      m.emissive = c.clone();
      m.emissiveIntensity = emissive;
    }
    patchDarkness(m);
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BoxGeometry>();
function geo(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w}|${h}|${d}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

export function disposeModels() {
  for (const m of matCache.values()) m.dispose();
  for (const g of geoCache.values()) g.dispose();
  matCache.clear();
  geoCache.clear();
}

interface BoxOpts {
  cast?: boolean;
  receive?: boolean;
  emissive?: number;
}

/** Uma caixa de tamanho (w,h,d) com o centro em (x,y,z). */
export function box(
  w: number,
  h: number,
  d: number,
  color: THREE.ColorRepresentation,
  x = 0,
  y = 0,
  z = 0,
  o: BoxOpts = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geo(w, h, d), mat(color, o.emissive ?? 0));
  m.position.set(x, y, z);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  return m;
}

/** Número entre 0 e 1 que só depende de a e b (variação do cenário sem sorteio de verdade). */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** O herói: um bichinho de blocos, laranja, com orelhas, focinho claro e olhos. Olha para -Z. */
export function buildHero(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  // a origem do corpo é nos pés, para a escala amassar para o chão
  body.add(box(0.62, 0.5, 0.62, 0xff8a2a, 0, 0.25, 0));
  body.add(box(0.58, 0.46, 0.58, 0xff8a2a, 0, 0.73, 0));
  body.add(box(0.2, 0.2, 0.18, 0xffd9b0, 0, 0.64, -0.34)); // focinho
  body.add(box(0.07, 0.07, 0.04, 0x1a1208, 0, 0.7, -0.44, { cast: false })); // nariz
  body.add(box(0.1, 0.1, 0.04, 0x1a1208, -0.15, 0.82, -0.3, { cast: false })); // olhos
  body.add(box(0.1, 0.1, 0.04, 0x1a1208, 0.15, 0.82, -0.3, { cast: false }));
  body.add(box(0.16, 0.22, 0.14, 0xff8a2a, -0.2, 1.06, 0.02)); // orelhas
  body.add(box(0.16, 0.22, 0.14, 0xff8a2a, 0.2, 1.06, 0.02));
  body.add(box(0.1, 0.12, 0.08, 0xffd9b0, -0.2, 1.04, -0.04, { cast: false }));
  body.add(box(0.1, 0.12, 0.08, 0xffd9b0, 0.2, 1.04, -0.04, { cast: false }));
  body.add(box(0.2, 0.2, 0.34, 0xffffff, 0, 0.3, 0.42)); // rabo com ponta branca
  g.add(body);
  return g;
}

export function buildTree(biome: AtravessaBiome, variant: number): THREE.Group {
  const g = new THREE.Group();
  if (biome === 'horta') {
    const h = 0.7 + variant * 0.7;
    g.add(box(0.24, 0.5, 0.24, 0x7a4a2a, 0, 0.25, 0));
    g.add(box(0.82, h, 0.82, variant > 0.5 ? 0x3f9d3c : 0x4fb347, 0, 0.5 + h / 2, 0));
    g.add(box(0.5, 0.35, 0.5, 0x63c457, 0, 0.5 + h + 0.17, 0));
  } else if (biome === 'deserto') {
    const h = 0.9 + variant * 0.8;
    g.add(box(0.32, h, 0.32, 0x4e9a4b, 0, h / 2, 0));
    g.add(box(0.5, 0.18, 0.18, 0x4e9a4b, -0.28, h * 0.6, 0));
    g.add(box(0.18, 0.4, 0.18, 0x4e9a4b, -0.46, h * 0.6 + 0.18, 0));
    if (variant > 0.45) {
      g.add(box(0.5, 0.18, 0.18, 0x4e9a4b, 0.28, h * 0.4, 0));
      g.add(box(0.18, 0.32, 0.18, 0x4e9a4b, 0.46, h * 0.4 + 0.14, 0));
    }
  } else {
    const h = 1 + variant * 0.9;
    g.add(box(0.6, 0.2, 0.6, 0x232a5c, 0, 0.1, 0));
    g.add(box(0.22, h, 0.22, 0x2c3470, 0, 0.2 + h / 2, 0));
    g.add(box(0.3, 0.3, 0.3, variant > 0.5 ? 0xff2fb3 : 0x19d3ff, 0, 0.2 + h + 0.15, 0, { emissive: 0.9 }));
  }
  return g;
}

const VEHICLE_COLORS: Record<AtravessaBiome, number[]> = {
  horta: [0xe5484d, 0x3e82f7, 0xf2b01e, 0x62b84a],
  deserto: [0xd96b3b, 0xf0c05a, 0xb85042, 0x6aa5a0],
  neon: [0xff2fb3, 0x19d3ff, 0x8a5cff, 0xffd23f],
};

/** Veículo olhando para +X. `len` já vem do núcleo (casas). */
export function buildVehicle(kind: VehicleKind, biome: AtravessaBiome, variant: number): THREE.Group {
  const g = new THREE.Group();
  const colors = VEHICLE_COLORS[biome];
  const color = colors[Math.floor(variant * colors.length) % colors.length]!;
  const wheel = (x: number, z: number, s = 0.26) => g.add(box(s, s, 0.14, 0x15161c, x, s / 2, z));
  if (kind === 'carro') {
    g.add(box(1.4, 0.38, 0.72, color, 0, 0.3, 0));
    g.add(box(0.74, 0.32, 0.62, 0xf4f4ef, -0.08, 0.64, 0));
    g.add(box(0.76, 0.14, 0.64, 0x1b2230, -0.08, 0.66, 0, { cast: false }));
    for (const x of [-0.45, 0.45]) for (const z of [-0.36, 0.36]) wheel(x, z);
  } else if (kind === 'trator') {
    g.add(box(1.1, 0.4, 0.62, 0x62b84a, 0.3, 0.38, 0));
    g.add(box(0.62, 0.5, 0.6, 0xf2b01e, -0.45, 0.78, 0));
    g.add(box(0.5, 0.5, 0.2, 0x15161c, -0.6, 0.38, 0.4));
    g.add(box(0.5, 0.5, 0.2, 0x15161c, -0.6, 0.38, -0.4));
    g.add(box(0.28, 0.28, 0.14, 0x15161c, 0.7, 0.14, 0.34));
    g.add(box(0.28, 0.28, 0.14, 0x15161c, 0.7, 0.14, -0.34));
  } else if (kind === 'caminhao') {
    g.add(box(1.8, 0.85, 0.82, 0xf4f4ef, -0.45, 0.62, 0));
    g.add(box(0.92, 0.62, 0.8, color, 0.9, 0.5, 0));
    g.add(box(0.1, 0.28, 0.66, 0x1b2230, 1.38, 0.62, 0, { cast: false }));
    for (const x of [-1.0, -0.2, 1.0]) for (const z of [-0.4, 0.4]) wheel(x, z, 0.3);
  } else if (kind === 'moto') {
    g.add(box(0.9, 0.22, 0.3, 0x14151f, 0, 0.32, 0));
    g.add(box(0.26, 0.4, 0.3, color, 0.1, 0.55, 0));
    g.add(box(0.3, 0.06, 0.34, color, 0, 0.45, 0, { emissive: 0.9 }));
    g.add(box(0.28, 0.28, 0.1, 0x0a0a10, -0.34, 0.14, 0));
    g.add(box(0.28, 0.28, 0.1, 0x0a0a10, 0.34, 0.14, 0));
  } else {
    // drone: corpo chato flutuando, com quatro hélices
    g.add(box(0.6, 0.18, 0.5, 0x1b2230, 0, 0.7, 0));
    g.add(box(0.3, 0.1, 0.3, color, 0, 0.82, 0, { emissive: 1 }));
    for (const x of [-0.38, 0.38]) for (const z of [-0.3, 0.3]) g.add(box(0.26, 0.04, 0.26, 0x8fa3d1, x, 0.78, z, { cast: false }));
  }
  return g;
}

export function buildLog(len: number, biome: AtravessaBiome): THREE.Group {
  const g = new THREE.Group();
  const c = biome === 'neon' ? 0x19d3ff : biome === 'deserto' ? 0x9c7040 : 0x8a5a34;
  const e = biome === 'neon' ? 0.8 : 0;
  g.add(box(len, 0.22, 0.78, c, 0, 0.11, 0, { emissive: e }));
  if (biome !== 'neon') {
    g.add(box(len + 0.02, 0.05, 0.6, 0x6b4224, 0, 0.23, 0, { cast: false }));
  } else {
    g.add(box(len * 0.6, 0.04, 0.5, 0xd4f6ff, 0, 0.24, 0, { cast: false, emissive: 1 }));
  }
  return g;
}

export function buildPad(biome: AtravessaBiome, sinks: boolean, variant: number): THREE.Group {
  const g = new THREE.Group();
  if (biome === 'horta') {
    g.add(box(0.8, 0.1, 0.8, 0x47b04a, 0, 0.05, 0));
    g.add(box(0.2, 0.12, 0.2, variant > 0.5 ? 0xff9ecf : 0xfff1a8, 0.15, 0.08, -0.1, { cast: false }));
  } else if (biome === 'deserto') {
    g.add(box(0.82, 0.22, 0.82, sinks ? 0xb58b5a : 0x9a8f86, 0, 0.11, 0));
    g.add(box(0.5, 0.06, 0.5, sinks ? 0xc99c68 : 0xb3a89f, 0, 0.24, 0, { cast: false }));
  } else {
    g.add(box(0.84, 0.14, 0.84, sinks ? 0x8a5cff : 0x19d3ff, 0, 0.07, 0, { emissive: 0.8 }));
    g.add(box(0.5, 0.04, 0.5, 0xd4f6ff, 0, 0.16, 0, { cast: false, emissive: 1 }));
  }
  return g;
}

export function buildTrain(len: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(len, 0.86, 0.9, 0x2b4d8f, 0, 0.52, 0));
  g.add(box(len + 0.02, 0.14, 0.94, 0xffd23f, 0, 0.3, 0));
  for (let i = -len / 2 + 1; i < len / 2 - 1; i += 1.4) g.add(box(0.7, 0.3, 0.92, 0xcfe3ff, i, 0.72, 0, { cast: false }));
  g.add(box(0.9, 0.9, 0.92, 0x1e3566, len / 2 - 0.45, 0.55, 0));
  g.add(box(0.1, 0.18, 0.5, 0xfff6c2, len / 2 + 0.02, 0.6, 0, { cast: false, emissive: 1 }));
  g.add(box(0.9, 0.9, 0.92, 0x1e3566, -len / 2 + 0.45, 0.55, 0));
  return g;
}

/** O poste do trilho: duas luzes vermelhas que piscam durante o aviso. */
export function buildSignal(): { group: THREE.Group; lights: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.add(box(0.12, 1.3, 0.12, 0x2a2a2e, 0, 0.65, 0));
  const lights = [
    box(0.22, 0.22, 0.22, 0x3a1010, 0, 1.25, 0, { cast: false }),
    box(0.22, 0.22, 0.22, 0x3a1010, 0, 0.95, 0, { cast: false }),
  ];
  for (const l of lights) g.add(l);
  return { group: g, lights };
}
