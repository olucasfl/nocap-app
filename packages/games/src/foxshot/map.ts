/** Mapa de teste do Fox Shot!: caixas alinhadas aos eixos (parede, caixote, madeira fina) com a "dureza" de cada uma. */

export interface FsBox {
  min: [number, number, number];
  max: [number, number, number];
  /** 0 = maciça (nada atravessa); 0,5 = madeira fina; 0,75 = tábua. A bala atravessa se `pen × poder da arma` > 0. */
  pen: number;
  /** Só para a cena: tipo de material. */
  mat: 'wall' | 'crate' | 'wood' | 'metal' | 'floorpad' | 'brick' | 'dirt' | 'sandstone' | 'tile' | 'cobble' | 'concrete' | 'plaster';
}

const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pen: number, mat: FsBox['mat']): FsBox => ({
  min: [x0, y0, z0], max: [x1, y1, z1], pen, mat,
});

export const FS_ARENA_HALF = 20;

/** Arena de 40 × 40 m: paredes, caixotes, um muro com trecho de madeira fina para testar o tiro varado e degraus. */
export const FS_ARENA: readonly FsBox[] = [
  // paredes externas (3,5 m)
  b(-20.5, 0, -20.5, 20.5, 3.5, -20, 0, 'wall'),
  b(-20.5, 0, 20, 20.5, 3.5, 20.5, 0, 'wall'),
  b(-20.5, 0, -20, -20, 3.5, 20, 0, 'wall'),
  b(20, 0, -20, 20.5, 3.5, 20, 0, 'wall'),
  // muro do meio, com um trecho de madeira fina (tiro varado)
  b(-6, 0, -0.2, -1.5, 2.6, 0.2, 0, 'wall'),
  b(-1.5, 0, -0.1, 1.5, 2.6, 0.1, 0.5, 'wood'),
  b(1.5, 0, -0.2, 6, 2.6, 0.2, 0, 'wall'),
  // caixotes (cobertura)
  b(-12, 0, -8, -10, 1.2, -6, 0.5, 'crate'),
  b(-12, 1.2, -8, -10.6, 2.0, -6.6, 0.5, 'crate'),
  b(9, 0, -10, 11.5, 1.2, -7.5, 0.5, 'crate'),
  b(-14, 0, 8, -11, 1.2, 10, 0.5, 'crate'),
  b(10, 0, 9, 12, 2.4, 11, 0.5, 'crate'),
  b(3, 0, 12, 4, 1.0, 13, 0.5, 'crate'),
  b(-4, 0, -14, -2, 1.6, -13.2, 0.5, 'crate'),
  // degraus (para testar subir e pular)
  b(14, 0, -2, 16, 0.3, 2, 0.5, 'metal'),
  b(16, 0, -2, 18, 0.6, 2, 0.5, 'metal'),
  b(18, 0, -2, 19.9, 0.9, 2, 0.5, 'metal'),
  // teste do pulo (lado leste): corra de oeste para leste e pule. Pulo simples sobe até ~0,9 m; pulo + Ctrl (agachar no ar) até ~1,25 m
  b(15.5, 0, 4, 19.9, 0.35, 6, 0.5, 'metal'),
  b(15.5, 0, 7, 19.9, 0.7, 9, 0.5, 'metal'),
  b(15.5, 0, 10, 19.9, 1.0, 12, 0.5, 'metal'),
  b(15.5, 0, 13, 19.9, 1.25, 15, 0.5, 'metal'),
  b(15.5, 0, 16, 19.9, 1.6, 18, 0.5, 'metal'),
  // pilar
  b(-1, 0, 6, 0.4, 3.5, 7.4, 0, 'wall'),
];

/** Placas da área de teste de movimento (só para a cena). */
export const FS_MOVE_SIGNS: readonly { text: string; x: number; y: number; z: number }[] = [
  { text: 'degrau 0,35', x: 15.2, y: 1.2, z: 5 },
  { text: 'pulo 0,7', x: 15.2, y: 1.5, z: 8 },
  { text: 'pulo + ctrl 1,0', x: 15.2, y: 1.8, z: 11 },
  { text: 'pulo + ctrl 1,25', x: 15.2, y: 2.1, z: 14 },
  { text: 'impossível 1,6', x: 15.2, y: 2.4, z: 17 },
  { text: 'bunny hop: segure espaço, gire o mouse e aperte A ou D', x: 0, y: 2.6, z: 10 },
];

export const FS_SPAWN = { x: 0, y: 0, z: 14, yaw: Math.PI };

export interface FsTargetSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  armor: number;
  helmet: boolean;
}

/** Alvos parados para testar headshot, colete e distância (spec 056, fase 0). */
export const FS_TARGETS: readonly FsTargetSpec[] = [
  { id: 't1', label: 'sem colete', x: -8, z: 2, armor: 0, helmet: false },
  { id: 't2', label: 'colete', x: -2.5, z: 2.5, armor: 100, helmet: false },
  { id: 't3', label: 'colete + capacete', x: 3.5, z: 2.5, armor: 100, helmet: true },
  { id: 't4', label: 'sem colete', x: -14, z: -4, armor: 0, helmet: false },
  { id: 't5', label: 'colete + capacete', x: 8, z: -6, armor: 100, helmet: true },
  { id: 't6', label: 'sem colete (longe)', x: 0, z: -17, armor: 0, helmet: false },
  { id: 't7', label: 'colete + capacete (longe)', x: 14, z: -16, armor: 100, helmet: true },
];
