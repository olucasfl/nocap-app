import { BadRequestException, Injectable } from '@nestjs/common';
import { isProgressGame, mergeProgress, PROGRESS_LIMITS, sanitizeProgress, type ProgressGame } from '@nocap/games';
import { WordsProgressRepository, type ProgressRow } from './words-progress.repository';

/** Quantas fases cabem num envio (o aparelho manda em lotes). */
export const MAX_BATCH = 500;

export interface ProgressEntry {
  game: string;
  level: number;
  data?: unknown;
}

export type ProgressMap = Record<string, Record<string, unknown>>;

/** `mergeProgress` com o tipo aberto (o jogo só é conhecido em tempo de execução). */
const join = (game: ProgressGame, a: unknown, b: unknown): unknown => mergeProgress(game, a as never, b as never);

@Injectable()
export class WordsProgressService {
  constructor(private readonly repo: WordsProgressRepository) {}

  /** Todo o progresso da conta: `{ bee: { "12": {...} }, "classic-c": {...} }`. */
  async load(userId: string): Promise<ProgressMap> {
    const out: ProgressMap = {};
    for (const r of await this.repo.all(userId)) (out[r.game] ??= {})[String(r.level)] = r.data;
    return out;
  }

  /** Confere o formato (recusa o que não presta) e junta com o que já está gravado, sem nunca diminuir. */
  async save(userId: string, entries: ProgressEntry[]): Promise<{ saved: number }> {
    if (entries.length > MAX_BATCH) throw new BadRequestException('Envio grande demais');
    const clean = new Map<string, ProgressRow>();
    for (const e of entries) {
      if (!isProgressGame(e.game) || !Number.isInteger(e.level) || e.level < 1 || e.level > PROGRESS_LIMITS.maxLevel) {
        throw new BadRequestException('Fase inválida');
      }
      const data = sanitizeProgress(e.game, e.data);
      if (!data) throw new BadRequestException('Progresso inválido');
      const key = `${e.game}:${e.level}`;
      const before = clean.get(key);
      // duas versões da mesma fase no mesmo envio: já junta aqui
      clean.set(key, { game: e.game, level: e.level, data: before ? join(e.game, before.data, data) : data });
    }
    const rows = [...clean.values()];
    await this.repo.apply(userId, rows, (existing, row) => {
      const game = row.game as ProgressGame;
      const old = existing === undefined ? null : sanitizeProgress(game, existing);
      return old ? join(game, old, row.data) : row.data;
    });
    return { saved: rows.length };
  }
}
