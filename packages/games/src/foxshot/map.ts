/** Mapa de teste do Fox Shot!: caixas alinhadas aos eixos (parede, caixote, madeira fina) com a "dureza" de cada uma. */

export interface FsBox {
  min: [number, number, number];
  max: [number, number, number];
  /** 0 = maciça (nada atravessa); 0,5 = madeira fina; 0,75 = tábua. A bala atravessa se `pen × poder da arma` > 0. */
  pen: number;
  /** Só para a cena: tipo de material. */
  mat: 'wall' | 'crate' | 'wood' | 'metal' | 'floorpad' | 'brick' | 'dirt' | 'sandstone' | 'tile' | 'cobble' | 'concrete' | 'plaster' | 'glass';
}

const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pen: number, mat: FsBox['mat']): FsBox => ({
  min: [x0, y0, z0], max: [x1, y1, z1], pen, mat,
});

/** Meio-tamanho do mapa de treino (x, z). */
export const FS_ARENA_HALF: readonly [number, number] = [45, 39];

// ---------------------------------------------------------------- Mapa de Treino
//
// Uma avenida no meio (onde se nasce) e seis salas, três ao norte e três ao sul, cada uma com um assunto, mais uma sala comprida
// ao fundo só para os alvos de distância:
//   norte: ALVOS E COLETES · BOTS ANDANDO · ESTANDE DE TIRO (os atiradores atiram sempre para a frente; dá para passar na frente)
//   sul:   MOVIMENTO · GRANADAS · PAREDES E MATERIAIS
//   fundo: PISTA DE DISTÂNCIA (alvos a 20, 40, 60 e 80 m do risco de tiro; entra-se pelas portas do fundo das salas do sul)
// x vai para leste e z para o sul; as portas das salas ficam em x = -30, 0 e 30 (6 m).

const T = 0.5;
const WH = 4;
const DOOR_X = [-30, 0, 30] as const;

type Gap = readonly [number, number];
/** Divide um trecho [a, b] tirando os vãos (portas). */
function pieces(a: number, b: number, gaps: readonly Gap[]): [number, number][] {
  const out: [number, number][] = [];
  let cur = a;
  for (const [g0, g1] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (g0 > cur) out.push([cur, g0]);
    cur = Math.max(cur, g1);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}
/** Parede ao longo de x, em z, com vãos. */
const hwall = (z: number, x0: number, x1: number, gaps: readonly Gap[] = [], mat: FsBox['mat'] = 'wall', h = WH, pen = 0, t = T): FsBox[] =>
  pieces(x0, x1, gaps).map(([a, c]) => b(a, 0, z - t / 2, c, h, z + t / 2, pen, mat));
/** Parede ao longo de z, em x, com vãos. */
const vwall = (x: number, z0: number, z1: number, gaps: readonly Gap[] = [], mat: FsBox['mat'] = 'wall', h = WH, pen = 0, t = T): FsBox[] =>
  pieces(z0, z1, gaps).map(([a, c]) => b(x - t / 2, 0, a, x + t / 2, h, c, pen, mat));
const doors: Gap[] = DOOR_X.map((x) => [x - 3, x + 3] as const);
/** Portas do fundo das salas do sul para a pista de distância. */
const DIST_DOORS: Gap[] = [[-22, -18], [5, 9], [28, 32]];

const boxes: FsBox[] = [
  // paredes externas
  ...hwall(-27, -45.25, 45.25, [], 'plaster'),
  ...hwall(39, -45.25, 45.25, [], 'plaster'),
  ...vwall(-45, -27, 39, [], 'plaster'),
  ...vwall(45, -27, 39, [], 'plaster'),
  // a parede do fundo das salas do sul, com as três portas para a pista de distância
  ...hwall(27, -45, 45, DIST_DOORS, 'plaster'),
  // paredes da avenida, com as portas das seis salas, e divisórias das salas
  ...hwall(-9, -45, 45, doors, 'sandstone'),
  ...hwall(9, -45, 45, doors, 'sandstone'),
  ...vwall(-15, -27, -9, [], 'sandstone'),
  ...vwall(15, -27, -9, [], 'concrete'),
  ...vwall(-15, 9, 27, [], 'sandstone'),
  ...vwall(15, 9, 27, [], 'sandstone'),

  // ---- NORTE 1 · ALVOS E COLETES: cobertura baixa para treinar mira de perto
  b(-38, 0, -12.5, -36, 1.2, -11.5, 0.5, 'crate'),
  b(-26, 0, -12.5, -24, 1.2, -11.5, 0.5, 'crate'),

  // ---- NORTE 3 · ESTANDE DE TIRO: sem vidro; cabines separadas por divisórias, cada atirador atira reto para o paredão do fundo
  // e dá para entrar na frente dele (e levar o tiro) se quiser
  ...[21, 25, 29, 33, 37, 41].flatMap((x) => vwall(x, -21, -14.2, [], 'concrete', 2.4, 0, 0.3)),
  // o paredão do fundo (onde as balas batem) e uma faixa de "alvos de papel" em cima dele
  b(16, 0, -26.75, 44.5, 3.6, -26.4, 0, 'concrete'),

  // ---- SUL 1 · MOVIMENTO
  // blocos de pulo (de 0,35 a 1,6 m)
  ...[0.35, 0.7, 1.0, 1.25, 1.6].map((h, i) => b(-43 + i * 3.6, 0, 23.5, -40.4 + i * 3.6, h, 26.2, 0.5, 'metal')),
  // escada de 3 degraus de 0,3 m (sobe andando) e a plataforma de cima
  b(-24, 0, 11, -22, 0.3, 15, 0.5, 'metal'),
  b(-22, 0, 11, -20, 0.6, 15, 0.5, 'metal'),
  b(-20, 0, 11, -15.25, 0.9, 15, 0.5, 'metal'),
  // túnel baixo (1,1 m): só passa agachado
  ...[17.4, 19.6].map((z) => b(-44, 0, z - 0.15, -33, 1.2, z + 0.15, 0, 'brick')),
  b(-44, 1.05, 17.25, -33, 1.3, 19.75, 0, 'brick'),

  // ---- SUL 2 · GRANADAS: o muro de 3 m para jogar por cima, caixotes de cobertura atrás
  ...hwall(17.5, -9, 9, [], 'brick', 3, 0, 0.6),
  b(-12, 0, 21, -10, 1.2, 23, 0.5, 'crate'),
  b(10, 0, 21, 12, 1.2, 23, 0.5, 'crate'),
  b(-2, 0, 25, 2, 2.4, 26.5, 0.5, 'crate'),

  // ---- SUL 3 · PAREDES E MATERIAIS: cada barreira de um material, com um alvo atrás
  b(17, 0, 13.8, 21, 2.6, 14.0, 0.5, 'wood'), //     madeira fina
  b(22, 0, 13.4, 26, 2.6, 14.4, 0.5, 'crate'), //    caixote
  b(27, 0, 13.6, 31, 2.6, 14.0, 0.3, 'metal'), //    metal
  b(32, 0, 13.5, 36, 2.6, 14.0, 0, 'wall'), //       parede maciça
  b(37, 0, 13.5, 41, 2.6, 13.9, 0.75, 'wood'), //    tábua
  // cobertura para treinar espiar de canto
  b(18, 0, 22, 20, 1.2, 24, 0.5, 'crate'),
  b(24, 0, 21, 26, 2.4, 23, 0.5, 'crate'),
  b(34, 0, 22, 36, 1.2, 24, 0.5, 'crate'),
  b(40, 0, 21, 42, 2.4, 23, 0.5, 'crate'),

  // ---- FUNDO · PISTA DE DISTÂNCIA: o risco de tiro no começo (oeste) e os alvos a 20, 40, 60 e 80 m dele
  b(-44, 0, 28.5, -41.5, 0.02, 37.5, 0, 'floorpad'),
  ...[-23, -3, 17, 37].map((x) => b(x - 0.4, 0, 28.2, x + 0.4, 0.02, 37.8, 0, 'floorpad')), // faixa no chão em cada marca
];

export const FS_ARENA: readonly FsBox[] = boxes;

/** Onde se nasce (início da avenida, olhando para o leste). */
export const FS_SPAWN = { x: -41, y: 0, z: 0, yaw: -90 };

/** Placas: o nome de cada sala na porta (lado da avenida), o que fazer em cada canto e as marcas de distância da pista. */
export const FS_MOVE_SIGNS: readonly { text: string; x: number; y: number; z: number; big?: boolean }[] = [
  // nomes das salas, sobre as portas, vistos da avenida
  { text: 'ALVOS E COLETES', x: -30, y: 3.2, z: -8.6, big: true },
  { text: 'BOTS ANDANDO', x: 0, y: 3.2, z: -8.6, big: true },
  { text: 'ESTANDE DE TIRO', x: 30, y: 3.2, z: -8.6, big: true },
  { text: 'MOVIMENTO', x: -30, y: 3.2, z: 8.6, big: true },
  { text: 'GRANADAS', x: 0, y: 3.2, z: 8.6, big: true },
  { text: 'PAREDES E MATERIAIS', x: 30, y: 3.2, z: 8.6, big: true },
  // avenida
  { text: 'AVENIDA: escolha uma sala pelas portas', x: -38, y: 3.0, z: -8.4, big: true },
  { text: 'B abre a loja (dinheiro infinito)', x: -41, y: 2.4, z: 7.6, big: true },
  // pista de distância: o risco de tiro e a marca de cada alvo
  { text: 'PISTA DE DISTÂNCIA', x: -20, y: 3.3, z: 26.6, big: true },
  { text: 'PISTA DE DISTÂNCIA', x: 7, y: 3.3, z: 26.6, big: true },
  { text: 'PISTA DE DISTÂNCIA', x: 30, y: 3.3, z: 26.6, big: true },
  { text: 'RISCO DE TIRO: atire para o leste', x: -40, y: 2.6, z: 33, big: true },
  { text: '20 m', x: -23, y: 2.6, z: 33, big: true },
  { text: '40 m', x: -3, y: 2.6, z: 33, big: true },
  { text: '60 m', x: 17, y: 2.6, z: 33, big: true },
  { text: '80 m', x: 37, y: 2.6, z: 33, big: true },
  // alvos e coletes
  { text: 'sem colete', x: -36, y: 2.1, z: -14 },
  { text: 'colete', x: -30, y: 2.1, z: -14 },
  { text: 'colete + capacete', x: -24, y: 2.1, z: -14 },
  { text: 'longe: sem colete', x: -36, y: 2.1, z: -22 },
  { text: 'longe: colete + capacete', x: -28, y: 2.1, z: -23.5 },
  // bots andando (nome na ponta de cada raia)
  { text: 'andando (facada nas costas: botão direito)', x: -9, y: 2.2, z: -12.4 },
  { text: 'devagar (shift)', x: -9, y: 2.2, z: -15.2 },
  { text: 'agachado', x: -9, y: 2.2, z: -18.3 },
  { text: 'pulando', x: -9, y: 2.2, z: -21.4 },
  { text: 'girando', x: -9, y: 2.2, z: -24.5 },
  // estande de tiro
  { text: 'ESTANDE: eles atiram sempre para a frente. Pode passar na frente', x: 30, y: 3.2, z: -9.6, big: true },
  { text: 'pistola', x: 19, y: 2.5, z: -12.8 },
  { text: 'USP-S', x: 23, y: 2.5, z: -12.8 },
  { text: 'MP9', x: 27, y: 2.5, z: -12.8 },
  { text: 'M4A1', x: 31, y: 2.5, z: -12.8 },
  { text: 'AK-47', x: 35, y: 2.5, z: -12.8 },
  { text: 'SPAS-12', x: 39, y: 2.5, z: -12.8 },
  { text: 'L96A1', x: 43, y: 2.5, z: -12.8 },
  // movimento
  { text: 'degrau 0,35', x: -41.7, y: 2.2, z: 23.2 },
  { text: 'pulo 0,7', x: -38.1, y: 2.2, z: 23.2 },
  { text: 'pulo + ctrl 1,0', x: -34.5, y: 2.4, z: 23.2 },
  { text: 'pulo + ctrl 1,25', x: -30.9, y: 2.6, z: 23.2 },
  { text: 'impossível 1,6', x: -27.3, y: 2.8, z: 23.2 },
  { text: 'escada: sobe andando', x: -21, y: 2.2, z: 10.6 },
  { text: 'túnel baixo: agache (ctrl)', x: -38.5, y: 1.9, z: 16.8 },
  { text: 'bunny hop: segure espaço, gire o mouse e aperte A ou D', x: -26, y: 2.6, z: 20.5, big: true },
  // granadas
  { text: 'jogue a granada por cima do muro (esquerdo = longe, direito = perto)', x: 0, y: 3.6, z: 10.4, big: true },
  { text: 'alvos atrás do muro', x: 0, y: 2.4, z: 18.6 },
  // materiais
  { text: 'madeira fina: atravessa', x: 19, y: 3.0, z: 13.4 },
  { text: 'caixote: atravessa um pouco', x: 24, y: 3.0, z: 13.0 },
  { text: 'metal: atravessa pouco', x: 29, y: 3.0, z: 13.2 },
  { text: 'parede: não atravessa', x: 34, y: 3.0, z: 13.1 },
  { text: 'tábua grossa', x: 39, y: 3.0, z: 13.1 },
];

/** As áreas do mapa de treino (nome e retângulo em metros): para o mapa grande (M) e para os testes. */
export interface FsTrainArea {
  id: 'avenue' | 'distance' | 'targets' | 'walkers' | 'range' | 'move' | 'nades' | 'walls';
  name: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
export const FS_TRAIN_AREAS: readonly FsTrainArea[] = [
  { id: 'avenue', name: 'Avenida', x0: -45, z0: -9, x1: 45, z1: 9 },
  { id: 'distance', name: 'Pista de distância', x0: -45, z0: 27, x1: 45, z1: 39 },
  { id: 'targets', name: 'Alvos e coletes', x0: -45, z0: -27, x1: -15, z1: -9 },
  { id: 'walkers', name: 'Bots andando', x0: -15, z0: -27, x1: 15, z1: -9 },
  { id: 'range', name: 'Estande de tiro', x0: 15, z0: -27, x1: 45, z1: -9 },
  { id: 'move', name: 'Movimento', x0: -45, z0: 9, x1: -15, z1: 27 },
  { id: 'nades', name: 'Granadas', x0: -15, z0: 9, x1: 15, z1: 27 },
  { id: 'walls', name: 'Paredes e materiais', x0: 15, z0: 9, x1: 45, z1: 27 },
];
/** O estande inteiro: os atiradores só atiram com a pessoa aqui dentro (assim o barulho não incomoda o resto do mapa). */
export const FS_TRAIN_GALLERY = { x0: 15, z0: -27, x1: 45, z1: -9 } as const;
/** Os nomes que o mapa grande mostra. */
export const FS_TRAIN_LABELS: readonly { x: number; z: number; text: string }[] = FS_TRAIN_AREAS.filter((a) => a.id !== 'avenue')
  .map((a) => ({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, text: a.name }))
  .concat([{ x: 0, z: 0, text: 'Avenida' }]);

export interface FsTargetSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  armor: number;
  helmet: boolean;
  /** Para onde olha no plano (x, z); o padrão é para o sul. */
  facing?: [number, number];
}

const N: [number, number] = [0, -1];
const S: [number, number] = [0, 1];
const W: [number, number] = [-1, 0];
const t = (id: string, label: string, x: number, z: number, armor: number, helmet: boolean, facing: [number, number] = S): FsTargetSpec => ({ id, label, x, z, armor, helmet, facing });

/** Alvos parados do mapa de treino: coletes e capacetes de perto e de longe, atrás de materiais e atrás do muro das granadas. */
export const FS_TARGETS: readonly FsTargetSpec[] = [
  // alvos e coletes (viram para a porta, ao sul)
  t('t1', 'sem colete', -36, -14, 0, false),
  t('t2', 'colete', -30, -14, 100, false),
  t('t3', 'colete + capacete', -24, -14, 100, true),
  t('t4', 'sem colete (longe)', -36, -22, 0, false),
  t('t5', 'colete + capacete (longe)', -28, -23.5, 100, true),
  // pista de distância (olham para o risco de tiro, a oeste)
  t('t6', '20 m', -23, 31.5, 0, false, W),
  t('t7', '40 m', -3, 34.5, 100, false, W),
  t('t8', '60 m', 17, 31.5, 100, true, W),
  t('t9', '80 m', 37, 34.5, 0, false, W),
  // granadas (atrás do muro, olham para o muro, ao norte)
  t('t10', 'granada A', -6, 21.5, 0, false, N),
  t('t11', 'granada B', 0, 22.5, 100, false, N),
  t('t12', 'granada C', 6, 21.5, 100, true, N),
  // paredes e materiais (um alvo atrás de cada barreira, olhando para ela)
  t('t13', 'madeira fina', 19, 17.5, 0, false, N),
  t('t14', 'caixote', 24, 17.5, 0, false, N),
  t('t15', 'metal', 29, 17.5, 0, false, N),
  t('t16', 'parede', 34, 17.5, 0, false, N),
  t('t17', 'tábua', 39, 17.5, 0, false, N),
];

// ---------------------------------------------------------------- busca rápida de caixas (mapas grandes)

interface BoxIndex {
  size: number;
  cells: Map<number, FsBox[]>;
}
const indexCache = new WeakMap<readonly FsBox[], BoxIndex>();
const BUCKET = 6;
const bkey = (cx: number, cz: number) => cx * 4096 + cz;

function indexOf(boxes: readonly FsBox[]): BoxIndex {
  let ix = indexCache.get(boxes);
  if (ix) return ix;
  // mapas com dezenas de milhares de caixas (a pele fina da Duna) pedem baldes menores, senão cada consulta devolve centenas
  const size = boxes.length > 30000 ? 1.5 : BUCKET;
  ix = { size, cells: new Map() };
  for (const b of boxes) {
    const x0 = Math.floor(b.min[0] / size), x1 = Math.floor(b.max[0] / size);
    const z0 = Math.floor(b.min[2] / size), z1 = Math.floor(b.max[2] / size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = bkey(cx, cz);
        const l = ix.cells.get(k);
        if (l) l.push(b);
        else ix.cells.set(k, [b]);
      }
    }
  }
  indexCache.set(boxes, ix);
  return ix;
}

/**
 * As caixas que podem tocar o retângulo (x0, z0)-(x1, z1). Em listas pequenas devolve a própria lista; nas grandes (mapas gerados
 * de modelo, milhares de caixas) usa um índice por quadrados de 6 m, guardado pela identidade da lista.
 */
/**
 * As caixas perto de um raio (uma linha de visão ou um tiro): anda pelo raio em passos curtos e junta só os baldes que ele toca (com
 * uma folga de meio metro). Em mapas abertos e compridos isso é bem menos que o retângulo que cobre o raio inteiro.
 */
export function fsBoxesAlongRay(boxes: readonly FsBox[], ox: number, oz: number, dx: number, dz: number, len: number): readonly FsBox[] {
  if (boxes.length < 160) return boxes;
  const ix = indexOf(boxes);
  const n = Math.max(1, Math.ceil(len / (ix.size * 0.4)));
  const l2 = Math.hypot(dx, dz) || 1;
  const nx = dx / l2, nz = dz / l2;
  const keys = new Set<number>();
  const seen = new Set<FsBox>();
  const out: FsBox[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (len * i) / n;
    const x = ox + dx * t, z = oz + dz * t;
    for (const [ex, ez] of [[0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]] as const) {
      const cx = Math.floor((x + ex) / ix.size), cz = Math.floor((z + ez) / ix.size);
      const k = bkey(cx, cz);
      if (keys.has(k)) continue;
      keys.add(k);
      const l = ix.cells.get(k);
      if (!l) continue;
      for (const b of l) if (!seen.has(b)) { seen.add(b); out.push(b); }
    }
  }
  void nx; void nz;
  return out;
}

export function fsBoxesInRect(boxes: readonly FsBox[], x0: number, z0: number, x1: number, z1: number): readonly FsBox[] {
  if (boxes.length < 160) return boxes;
  const ix = indexOf(boxes);
  const cx0 = Math.floor(Math.min(x0, x1) / ix.size), cx1 = Math.floor(Math.max(x0, x1) / ix.size);
  const cz0 = Math.floor(Math.min(z0, z1) / ix.size), cz1 = Math.floor(Math.max(z0, z1) / ix.size);
  if (cx0 === cx1 && cz0 === cz1) return ix.cells.get(bkey(cx0, cz0)) ?? [];
  const seen = new Set<FsBox>();
  const out: FsBox[] = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const l = ix.cells.get(bkey(cx, cz));
      if (!l) continue;
      for (const b of l) {
        if (!seen.has(b)) {
          seen.add(b);
          out.push(b);
        }
      }
    }
  }
  return out;
}
