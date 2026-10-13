import { createRng } from '../core/rng';
import { SIZE, SLOTS } from './constants';
import {
  applyMove,
  emptyRows,
  fits,
  fitsAnywhere,
  filledCells,
  placements,
  shapeOf,
  type Placed,
  type Rows,
} from './board';
import { dealSet } from './generator';
import { decodeMove, encodeMove, type Move } from './search';

export interface BlocksResult {
  /** Pontos da partida. */
  score: number;
  /** Quantas jogadas. */
  moves: number;
  /** Linhas e colunas limpas no total. */
  lines: number;
  /** Maior sequência (combo) alcançada. */
  bestStreak: number;
  /** Rodadas de três peças entregues. */
  sets: number;
  /** A partida acabou (nenhuma peça que resta cabe). */
  over: boolean;
}

/**
 * A partida do Block Classic (spec 021). A seed e as jogadas definem tudo: as peças de cada
 * rodada saem da seed e do tabuleiro daquele momento, e a pontuação sai das jogadas. É a mesma
 * classe no aparelho e no servidor.
 */
export class BlocksGame {
  readonly seed: string;
  rows: Rows = emptyRows();
  /** As peças da bandeja (índice no catálogo) ou `null` para a que já foi colocada. */
  slots: (number | null)[] = [];
  score = 0;
  streak = 0;
  /** Jogadas seguidas sem limpar (a terceira quebra a sequência). */
  drought = 0;
  lines = 0;
  bestStreak = 0;
  /** Rodadas de peças entregues até agora. */
  sets = 0;
  over = false;
  readonly moves: number[] = [];
  private readonly rng: () => number;

  constructor(seed: string) {
    this.seed = seed;
    this.rng = createRng(`blocks:${seed}`);
    this.deal();
  }

  private deal() {
    this.slots = dealSet(this.rng, this.rows, this.sets);
    this.sets++;
  }

  /** Dá para colocar a peça da bandeja nesta posição? */
  canPlace(slot: number, row: number, col: number): boolean {
    if (this.over) return false;
    const id = this.slots[slot];
    if (id === null || id === undefined) return false;
    return fits(this.rows, shapeOf(id), row, col);
  }

  /** Coloca a peça. Devolve o que aconteceu (para a animação) ou `null` se a jogada é ilegal. */
  play(slot: number, row: number, col: number): (Placed & { newSet: boolean }) | null {
    if (!Number.isInteger(slot) || !Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (slot < 0 || slot >= SLOTS || row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    if (!this.canPlace(slot, row, col)) return null;
    const shape = shapeOf(this.slots[slot]!);
    const placed = applyMove(this.rows, shape, row, col, this.streak, this.drought);
    this.rows = placed.rows;
    this.score += placed.points;
    this.lines += placed.lines;
    this.streak = placed.streak;
    this.drought = placed.drought;
    this.bestStreak = Math.max(this.bestStreak, placed.streak);
    this.slots[slot] = null;
    this.moves.push(encodeMove({ slot, row, col }));
    let newSet = false;
    if (this.slots.every((s) => s === null)) {
      this.deal();
      newSet = true;
    }
    this.over = !this.slots.some((s) => s !== null && fitsAnywhere(this.rows, shapeOf(s)));
    return { ...placed, newSet };
  }

  /** Todas as jogadas legais agora (para a dica de última hora e para os testes). */
  legalMoves(): Move[] {
    const out: Move[] = [];
    if (this.over) return out;
    this.slots.forEach((id, slot) => {
      if (id === null) return;
      for (const [row, col] of placements(this.rows, shapeOf(id))) out.push({ slot, row, col });
    });
    return out;
  }

  get filled(): number {
    return filledCells(this.rows);
  }

  get result(): BlocksResult {
    return {
      score: this.score,
      moves: this.moves.length,
      lines: this.lines,
      bestStreak: this.bestStreak,
      sets: this.sets,
      over: this.over,
    };
  }
}

/** Limite de jogadas de uma partida enviada (acima disso é lixo ou fraude). */
export const BLOCKS_MAX_MOVES = 6000;

export type BlocksCheck = { ok: true; result: BlocksResult } | { ok: false; error: string };

/**
 * O servidor refaz a partida: gera as peças pela seed e confere jogada por jogada. Recusa jogada
 * ilegal, jogada depois do fim e partida que não terminou (só vale uma partida acabada).
 */
export function evaluateBlocks(seed: string, moves: readonly number[]): BlocksCheck {
  if (moves.length === 0) return { ok: false, error: 'A partida não tem jogadas' };
  if (moves.length > BLOCKS_MAX_MOVES) return { ok: false, error: 'Jogadas demais' };
  const game = new BlocksGame(seed);
  for (let i = 0; i < moves.length; i++) {
    const n = moves[i]!;
    if (!Number.isInteger(n) || n < 0 || n >= SLOTS * 64) {
      return { ok: false, error: `Jogada ${i + 1} inválida` };
    }
    if (game.over) return { ok: false, error: 'Há jogadas depois do fim da partida' };
    const m = decodeMove(n);
    if (!game.play(m.slot, m.row, m.col)) return { ok: false, error: `Jogada ${i + 1} ilegal` };
  }
  if (!game.over) return { ok: false, error: 'A partida enviada não terminou' };
  return { ok: true, result: game.result };
}
