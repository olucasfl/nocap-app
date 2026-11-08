/** Tipos compartilhados dos mapas do Counter Fox: marcas (bombas e bases) e pontos de nascimento. */

export interface FsDustMark {
  id: 'A' | 'B' | 'T' | 'CT';
  /** Letra ou sigla curta (mapa pequeno). */
  short: string;
  /** Nome completo (mapa grande). */
  name: string;
  kind: 'site' | 'base';
  /** Ponto livre no meio da área. */
  x: number;
  z: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface FsSpawn {
  x: number;
  /** Altura do chão no ponto (m). */
  y: number;
  z: number;
  /** Para onde olha ao nascer (graus, como a câmera: 0 = norte). */
  yaw: number;
  /** TR e CT: pontos das bases (modo Bomba); `open`: espalhados pelo mapa (mata-mata). */
  zone: 'TR' | 'CT' | 'open';
}
