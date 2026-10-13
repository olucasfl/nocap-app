/**
 * Block's (spec 021): constantes, modos e o catálogo de peças. Tudo em inteiros e nas quatro
 * operações, para o servidor refazer a partida e chegar exatamente no mesmo resultado do jogo.
 */

export type BlocksMode = 'classic';
export const BLOCKS_MODES: readonly BlocksMode[] = ['classic'];

export function isBlocksMode(m: unknown): m is BlocksMode {
  return m === 'classic';
}
/** O modo guardado no servidor: `blocks-classic`. */
export const blocksMode = (m: BlocksMode): string => `blocks-${m}`;

/** O tabuleiro é uma grade quadrada de 8 por 8. */
export const SIZE = 8;
/** Peças por rodada. */
export const SLOTS = 3;
/** Uma linha cheia vale 255 (8 bits ligados). */
export const FULL_ROW = (1 << SIZE) - 1;

/** Dicas por partida (spec 021). */
export const HINTS_PER_GAME = 3;

// --- Pontos ----------------------------------------------------------------------------------
/** Pontos de limpar `lines` linhas/colunas de uma vez, antes da sequência: 10, 30, 60, 100... */
export const linePoints = (lines: number): number => (10 * lines * (lines + 1)) / 2;
/** A sequência (combo) multiplica a limpeza até este teto. */
export const STREAK_CAP = 6;
/** Jogadas seguidas sem limpar que quebram a sequência. */
export const STREAK_DROUGHT = 3;
/** Bônus do tabuleiro limpo. */
export const BOARD_CLEAR_BONUS = 300;

// --- Geração das peças -----------------------------------------------------------------------
/** Chance de uma rodada nascer "com jogada" (50 a 70% dos trios têm uma jogada secreta). */
export const SWEET_CHANCE = 0.62;
/** Quantos trios candidatos se testam por rodada. */
export const DEAL_ATTEMPTS = 16;
/** Linhas somadas que a jogada secreta precisa limpar (2 com o tabuleiro já cheio). */
export const SWEET_LINES = 3;
export const SWEET_LINES_FULL = 2;
/** Acima desta ocupação (0 a 1) o tabuleiro conta como cheio. */
export const FULL_BOARD = 0.45;
/** Limite de nós da busca de um trio candidato (só para a geração; o resultado é determinístico). */
export const DEAL_NODE_LIMIT = 60_000;

// --- Elogios (só apresentação) ---------------------------------------------------------------
/** O ótimo precisa passar a mediana das primeiras jogadas por pelo menos isto para valer elogio. */
export const PRAISE_MARGIN = 8;
/** Quantas sequências ótimas se guardam (as demais empatam e não mudam o veredito). */
export const MAX_PLANS = 4096;

// --- Peças -----------------------------------------------------------------------------------
/** Famílias de cor: a arte das peças (web) escolhe a tinta por aqui. */
export type BlockColor = 'laranja' | 'azul' | 'amarelo' | 'rosa' | 'verde' | 'roxo' | 'turquesa' | 'vermelho';
export const BLOCK_COLORS: readonly BlockColor[] = [
  'laranja',
  'azul',
  'amarelo',
  'rosa',
  'verde',
  'roxo',
  'turquesa',
  'vermelho',
];

export interface BlockShape {
  /** Índice no catálogo (é o que a partida guarda). */
  id: number;
  name: string;
  w: number;
  h: number;
  /** Uma máscara por linha da peça: o bit `c` é a coluna `c`. */
  rows: readonly number[];
  /** Casas da peça como [linha, coluna]. */
  cells: readonly (readonly [number, number])[];
  size: number;
  /** Peso no sorteio da peça (o da família dividido entre as orientações). */
  weight: number;
  color: BlockColor;
}

type Grid = string[];

const rotate = (g: Grid): Grid => {
  const h = g.length;
  const w = g[0]!.length;
  const out: string[] = [];
  for (let c = 0; c < w; c++) {
    let line = '';
    for (let r = h - 1; r >= 0; r--) line += g[r]![c]!;
    out.push(line);
  }
  return out;
};
const mirror = (g: Grid): Grid => g.map((l) => [...l].reverse().join(''));

/** Todas as orientações distintas de uma forma (rotações e, se pedido, o espelho). */
function orientations(base: Grid, withMirror: boolean): Grid[] {
  const seen = new Set<string>();
  const out: Grid[] = [];
  let g = base;
  for (let i = 0; i < 4; i++) {
    for (const v of withMirror ? [g, mirror(g)] : [g]) {
      const key = v.join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
    g = rotate(g);
  }
  return out;
}

interface Family {
  name: string;
  base: Grid;
  mirrored: boolean;
  weight: number;
  color: BlockColor;
}

const FAMILIES: Family[] = [
  { name: 'ponto', base: ['#'], mirrored: false, weight: 1, color: 'turquesa' },
  { name: 'barra2', base: ['##'], mirrored: false, weight: 6, color: 'azul' },
  { name: 'barra3', base: ['###'], mirrored: false, weight: 8, color: 'azul' },
  { name: 'barra4', base: ['####'], mirrored: false, weight: 8, color: 'azul' },
  { name: 'barra5', base: ['#####'], mirrored: false, weight: 9, color: 'azul' },
  { name: 'quadrado2', base: ['##', '##'], mirrored: false, weight: 6, color: 'amarelo' },
  { name: 'retangulo', base: ['###', '###'], mirrored: false, weight: 10, color: 'amarelo' },
  { name: 'quadrado3', base: ['###', '###', '###'], mirrored: false, weight: 7, color: 'amarelo' },
  { name: 'canto2', base: ['#.', '##'], mirrored: false, weight: 8, color: 'laranja' },
  { name: 'canto3', base: ['#..', '#..', '###'], mirrored: false, weight: 6, color: 'vermelho' },
  { name: 'ele', base: ['#.', '#.', '##'], mirrored: true, weight: 12, color: 'rosa' },
  { name: 'te', base: ['###', '.#.'], mirrored: false, weight: 6, color: 'roxo' },
  { name: 'esse', base: ['.##', '##.'], mirrored: true, weight: 8, color: 'verde' },
];

function build(): BlockShape[] {
  const out: BlockShape[] = [];
  for (const fam of FAMILIES) {
    // O quadrado e as barras giram sozinhos: `orientations` já tira as repetidas.
    const orients = orientations(fam.base, fam.mirrored);
    for (const g of orients) {
      const h = g.length;
      const w = g[0]!.length;
      const cells: [number, number][] = [];
      const rows: number[] = [];
      for (let r = 0; r < h; r++) {
        let mask = 0;
        for (let c = 0; c < w; c++) {
          if (g[r]![c] === '#') {
            mask |= 1 << c;
            cells.push([r, c]);
          }
        }
        rows.push(mask);
      }
      out.push({
        id: out.length,
        name: fam.name,
        w,
        h,
        rows,
        cells,
        size: cells.length,
        weight: fam.weight / orients.length,
        color: fam.color,
      });
    }
  }
  return out;
}

/** O catálogo completo, na ordem em que foi montado. O `id` de cada peça é o índice aqui. */
export const BLOCK_SHAPES: readonly BlockShape[] = build();

/** Casas ocupadas no tabuleiro inteiro. */
export const BOARD_CELLS = SIZE * SIZE;
