import * as THREE from 'three';

/**
 * Modelos 3D dos itens do Arcade com poderes do Fox GP (spec 085). Tudo feito aqui em código (formas simples, materiais
 * com brilho e a paleta do Fox GP), sem arquivo de arte de terceiros. Cada construtor devolve um grupo de ~1 m de altura,
 * apoiado em y = 0, que `GpItemsPreview` mostra numa vitrine e a pista mostrará no chão, na mão e orbitando o kart.
 */
export type GpItemId =
  | 'box'
  | 'peel'
  | 'peel3'
  | 'ball'
  | 'ball3'
  | 'seeker'
  | 'seeker3'
  | 'bomb'
  | 'nitro'
  | 'nitro3'
  | 'star'
  | 'bolt';

export interface GpItemInfo {
  id: GpItemId;
  name: string;
  /** Uma frase para a vitrine e para o HUD. */
  blurb: string;
  /** Cor de destaque (aro do HUD, brilho). */
  tone: number;
}

export const GP_ITEMS: GpItemInfo[] = [
  {
    id: 'box',
    name: 'Caixa misteriosa',
    blurb: 'Passe por ela para ganhar um poder.',
    tone: 0xff7d26,
  },
  { id: 'peel', name: 'Casca', blurb: 'Fica na pista. Quem pisa roda.', tone: 0xffa21f },
  {
    id: 'peel3',
    name: 'Casca tripla',
    blurb: 'Três cascas girando em volta do kart.',
    tone: 0xffa21f,
  },
  { id: 'ball', name: 'Bola', blurb: 'Vai reta e quica nas paredes.', tone: 0x29c26a },
  {
    id: 'ball3',
    name: 'Bola tripla',
    blurb: 'Três bolas para lançar, uma de cada vez.',
    tone: 0x29c26a,
  },
  { id: 'seeker', name: 'Cometa', blurb: 'Persegue o carro da frente.', tone: 0xe8343c },
  { id: 'seeker3', name: 'Cometa triplo', blurb: 'Três perseguidores.', tone: 0xe8343c },
  { id: 'bomb', name: 'Bomba', blurb: 'Explode em área depois de uns segundos.', tone: 0x8a5cff },
  { id: 'nitro', name: 'Turbo', blurb: 'Um impulso curto de velocidade.', tone: 0x2f5bff },
  {
    id: 'nitro3',
    name: 'Turbo triplo',
    blurb: 'Três impulsos para usar quando quiser.',
    tone: 0x2f5bff,
  },
  {
    id: 'star',
    name: 'Superfox',
    blurb: 'Invencível e mais rápido por uns segundos.',
    tone: 0xffd23a,
  },
  { id: 'bolt', name: 'Cometa azul', blurb: 'Vai atrás de quem lidera a corrida.', tone: 0x4fb3ff },
];

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.1, ...o });
const glow = (color: number, k = 1.2) =>
  std(color, { emissive: color, emissiveIntensity: k, roughness: 0.5 });
const ink = () => std(0x141a2b, { roughness: 0.6 });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

function questionTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.font = '900 104px "Saira Condensed", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = '#141a2b';
  g.strokeText('?', 64, 70);
  g.fillStyle = '#fff4d6';
  g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBox(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshPhysicalMaterial({
      color: 0xff9a4d,
      emissive: 0xff7d26,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.62,
      roughness: 0.15,
      clearcoat: 1,
    }),
    0,
    0.6,
    0,
  );
  body.castShadow = false;
  g.add(body);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9)),
    new THREE.LineBasicMaterial({ color: 0xfff1d0 }),
  );
  edges.position.y = 0.6;
  g.add(edges);
  const tex = questionTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  for (const [ry, x, z] of [
    [0, 0, 0.46],
    [Math.PI, 0, -0.46],
    [Math.PI / 2, 0.46, 0],
    [-Math.PI / 2, -0.46, 0],
  ] as const) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), mat);
    p.position.set(x, 0.6, z);
    p.rotation.y = ry;
    g.add(p);
  }
  return g;
}

function buildPeel(): THREE.Group {
  const g = new THREE.Group();
  const orange = std(0xff9d1c, { roughness: 0.55 });
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.07, 28), orange, 0, 0.05, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 28), std(0xffe3a3), 0, 0.1, 0));
  // pétalas da casca, curvadas para cima
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = mesh(
      new THREE.SphereGeometry(0.24, 14, 10),
      orange,
      Math.cos(a) * 0.36,
      0.2,
      Math.sin(a) * 0.36,
    );
    p.scale.set(1.15, 0.38, 0.65);
    p.rotation.y = -a;
    p.rotation.z = 0.5;
    g.add(p);
  }
  g.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), std(0x3f9a45), 0, 0.2, 0));
  return g;
}

function buildBall(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(new THREE.SphereGeometry(0.42, 28, 20), std(0x29c26a, { roughness: 0.25 }), 0, 0.46, 0),
  );
  const band = mesh(new THREE.TorusGeometry(0.43, 0.045, 10, 40), std(0xeaffef), 0, 0.46, 0);
  g.add(band);
  const band2 = band.clone();
  band2.rotation.y = Math.PI / 2;
  g.add(band2);
  g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), glow(0xc7ffd9, 0.6), -0.18, 0.7, 0.3));
  return g;
}

function buildSeeker(color = 0xe8343c, flame = 0xffb02e): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(
    new THREE.SphereGeometry(0.34, 24, 18),
    std(color, { roughness: 0.25 }),
    0,
    0.45,
    0,
  );
  body.scale.set(1, 1, 1.35);
  g.add(body);
  g.add(
    mesh(
      new THREE.ConeGeometry(0.2, 0.36, 18),
      std(0xffffff, { roughness: 0.3 }),
      0,
      0.45,
      0.58,
    ).rotateX(Math.PI / 2),
  );
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const fin = mesh(
      new THREE.BoxGeometry(0.05, 0.3, 0.28),
      std(0x141a2b),
      Math.cos(a) * 0.3,
      0.45 + Math.sin(a) * 0.3,
      -0.3,
    );
    fin.rotation.z = a - Math.PI / 2;
    g.add(fin);
  }
  const fl = mesh(new THREE.ConeGeometry(0.18, 0.6, 14), glow(flame, 1.6), 0, 0.45, -0.72).rotateX(
    -Math.PI / 2,
  );
  g.add(fl);
  g.add(
    mesh(new THREE.ConeGeometry(0.1, 0.4, 12), glow(0xfff3a8, 1.8), 0, 0.45, -0.66).rotateX(
      -Math.PI / 2,
    ),
  );
  return g;
}

function buildBomb(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(
      new THREE.SphereGeometry(0.44, 28, 20),
      std(0x1b1535, { roughness: 0.22, metalness: 0.3 }),
      0,
      0.46,
      0,
    ),
  );
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.14, 16), std(0x8a5cff), 0, 0.93, 0));
  const fuse = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.98, 0),
    new THREE.Vector3(0.06, 1.12, 0),
    new THREE.Vector3(0.2, 1.18, 0),
    new THREE.Vector3(0.3, 1.1, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(fuse, 14, 0.025, 6), std(0xd9c7a1)));
  const spark = mesh(new THREE.OctahedronGeometry(0.1), glow(0xffd23a, 2), 0.3, 1.12, 0);
  spark.name = 'spark';
  g.add(spark);
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0xe8343c, 0.9), -0.17, 0.5, 0.39));
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0xe8343c, 0.9), 0.17, 0.5, 0.39));
  return g;
}

function buildNitro(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.8, 24),
      std(0x2f5bff, { roughness: 0.25, metalness: 0.35 }),
      0,
      0.5,
      0,
    ),
  );
  g.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.14, 24), std(0xffd23a), 0, 0.5, 0));
  g.add(
    mesh(
      new THREE.SphereGeometry(0.28, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      std(0x2f5bff, { metalness: 0.35 }),
      0,
      0.9,
      0,
    ),
  );
  g.add(
    mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12),
      std(0xdfe4ef, { metalness: 0.7 }),
      0,
      1.2,
      0,
    ),
  );
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), ink(), 0, 0.1, 0));
  const fl = mesh(new THREE.ConeGeometry(0.1, 0.3, 12), glow(0xff7d26, 1.6), 0, 0.5, 0.3).rotateX(
    Math.PI / 2,
  );
  g.add(fl);
  return g;
}

function buildStar(): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const R = 0.5;
  const r = 0.24;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -0.07);
  const star = mesh(
    geo,
    std(0xffd23a, { emissive: 0xffa800, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.25 }),
    0,
    0.62,
    0,
  );
  star.rotation.x = -0.25;
  g.add(star);
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), ink(), -0.12, 0.7, 0.14));
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), ink(), 0.12, 0.7, 0.14));
  const halo = mesh(new THREE.TorusGeometry(0.66, 0.025, 8, 48), glow(0xfff0a0, 1.4), 0, 0.62, 0);
  halo.castShadow = false;
  g.add(halo);
  return g;
}

function buildBolt(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(
    new THREE.IcosahedronGeometry(0.32, 1),
    std(0x2f7bff, { emissive: 0x1a4bd0, emissiveIntensity: 0.6, roughness: 0.2 }),
    0,
    0.55,
    0,
  );
  g.add(body);
  const spike = std(0x9fd6ff, { emissive: 0x4fb3ff, emissiveIntensity: 0.7 });
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0.7, 0.7, 0],
    [-0.7, 0.7, 0],
  ];
  for (const d of dirs) {
    const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    const c = mesh(new THREE.ConeGeometry(0.1, 0.34, 10), spike, 0, 0.55, 0);
    c.position.addScaledVector(v, 0.42);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    g.add(c);
  }
  g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), glow(0xffffff, 1), 0, 0.55, 0.28));
  return g;
}

const BUILDERS: Record<string, () => THREE.Group> = {
  box: buildBox,
  peel: buildPeel,
  ball: buildBall,
  seeker: () => buildSeeker(),
  bomb: buildBomb,
  nitro: buildNitro,
  star: buildStar,
  bolt: buildBolt,
};

/** Três cópias girando em volta do kart (o item "triplo"). */
function triple(base: () => THREE.Group): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Group();
  ring.name = 'ring';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const it = base();
    it.scale.setScalar(0.6);
    it.position.set(Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62);
    ring.add(it);
  }
  g.add(ring);
  return g;
}

export function buildItem(id: GpItemId): THREE.Group {
  if (id.endsWith('3')) return triple(BUILDERS[id.slice(0, -1)]!);
  return BUILDERS[id]!();
}

/** Animação de vitrine/pista: giro, flutuação e o que cada item tem de móvel. */
export function animateItem(g: THREE.Group, id: GpItemId, t: number) {
  // a estrela é achatada: balança de frente em vez de girar de lado
  g.rotation.y = id === 'star' ? Math.sin(t * 1.3) * 0.9 : t * (id === 'box' ? 0.9 : 0.7);
  g.position.y = Math.sin(t * 2) * 0.05;
  const ring = g.getObjectByName('ring');
  if (ring) ring.rotation.y = t * 1.6;
  const spark = g.getObjectByName('spark');
  if (spark) spark.scale.setScalar(0.8 + Math.abs(Math.sin(t * 14)) * 0.6);
}
