import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { mergeSaves, validateSave, type SaveState } from '@nocap/games';
import { ApertaRepository, type SaveFields, type SaveRow } from './aperta.repository';

export const SLOTS = [1, 2] as const;
export type Slot = (typeof SLOTS)[number];
/** Quanto tempo um save apagado pode ser recuperado (spec 038, decisão 14.13). */
export const RECOVERY_DAYS = 7;
const DAY_MS = 86_400_000;

export interface SaveSummary {
  slot: number;
  name: string;
  collapses: number;
  atlasPages: number;
  /** ISO da última gravação. */
  lastPlayedAt: string;
  storySeen: boolean;
  revision: number;
}

export interface SaveFull {
  slot: number;
  revision: number;
  updatedAt: string;
  data: SaveState;
}

export interface SlotInfo {
  slot: number;
  save: SaveSummary | null;
  /** ISO até quando dá para restaurar o save apagado deste espaço. */
  recoverableUntil: string | null;
}

export interface PutInput {
  data?: unknown;
  /** Revisão que o aparelho viu por último; 0 = criar save novo neste espaço. */
  baseRevision: number;
  /** Aceita gravar algo menos adiantado que o da conta (a pessoa escolheu "Usar o deste aparelho"). */
  overwrite?: boolean;
}

export interface PutResult {
  revision: number;
  updatedAt: string;
  /** Campos que o servidor cortou por serem impossíveis no tempo jogado (não bane; só avisa). */
  flagged: string[];
  /** O que ficou gravado, quando o servidor mudou alguma coisa (corte ou união de álbum e conquistas). */
  data?: SaveState;
}

const summarize = (row: SaveRow): SaveSummary => {
  const d = row.data as SaveState;
  return {
    slot: row.slot,
    name: row.name,
    collapses: row.collapses,
    atlasPages: d.atlas?.pages?.length ?? 0,
    lastPlayedAt: row.updatedAt.toISOString(),
    storySeen: d.storySeen === true,
    revision: row.revision,
  };
};

const full = (row: SaveRow): SaveFull => ({
  slot: row.slot,
  revision: row.revision,
  updatedAt: row.updatedAt.toISOString(),
  data: row.data as SaveState,
});

const fieldsOf = (save: SaveState): SaveFields => ({
  name: save.name,
  data: save,
  version: save.version,
  playSeconds: Math.floor(save.playSeconds),
  collapses: save.collapses,
  picks: save.run.picks,
  dustLog10: Math.log10(Math.max(1, save.run.dustLife)),
});

@Injectable()
export class ApertaService {
  /** Relógio do servidor: o do aparelho nunca gera progresso. Troca nos testes. */
  clock: () => number = () => Date.now();

  constructor(private readonly repo: ApertaRepository) {}

  private alive(row: SaveRow | null | undefined): SaveRow | null {
    return row && !row.deletedAt ? row : null;
  }

  /** Resumo dos 2 espaços; o apagado ainda dentro do prazo aparece como recuperável. */
  async list(userId: string): Promise<SlotInfo[]> {
    const now = this.clock();
    await this.repo.purgeDeletedBefore(userId, new Date(now - RECOVERY_DAYS * DAY_MS));
    const rows = await this.repo.all(userId);
    return SLOTS.map((slot) => {
      const row = rows.find((r) => r.slot === slot);
      const live = this.alive(row);
      return {
        slot,
        save: live ? summarize(live) : null,
        recoverableUntil: row?.deletedAt ? new Date(row.deletedAt.getTime() + RECOVERY_DAYS * DAY_MS).toISOString() : null,
      };
    });
  }

  async get(userId: string, slot: number): Promise<SaveFull> {
    const row = this.alive(await this.repo.get(userId, slot));
    if (!row) throw new NotFoundException('Save não encontrado');
    return full(row);
  }

  /**
   * Grava o save. Sempre recalcula: confere formato e coerência (recusa o impossível, corta o rápido demais)
   * e só aceita se `baseRevision` é a revisão atual. Quem chegou atrasado recebe 409 com o save da conta e a
   * junção proposta, e nada é sobrescrito sem a pessoa escolher.
   */
  async put(userId: string, slot: number, input: PutInput): Promise<PutResult> {
    const now = this.clock();
    const existing = this.alive(await this.repo.get(userId, slot));
    const isNew = input.baseRevision === 0;
    const checked = validateSave(input.data, {
      nowMs: now,
      createdAtMs: isNew ? now : existing?.createdAt.getTime(),
    });
    if (!checked.ok) throw new BadRequestException({ code: 'invalid-save', message: 'Save inválido', errors: checked.errors });

    if (isNew) {
      const row = await this.repo.create(userId, slot, fieldsOf(checked.save), new Date(now));
      if (!row) throw await this.conflict(userId, slot, checked.save, 'slot-taken');
      return this.result(row, checked.save, checked.flagged);
    }

    if (!existing) throw new NotFoundException({ code: 'deleted', message: 'Este save foi apagado' });
    const current = this.stored(existing);
    if (existing.revision !== input.baseRevision) throw await this.conflict(userId, slot, checked.save, 'stale');

    let save = checked.save;
    // Nunca diminui por engano: voltar atrás em colapsos só com a escolha explícita da pessoa.
    if (!input.overwrite && save.collapses < current.collapses) throw await this.conflict(userId, slot, save, 'regress');
    // Álbum e conquistas só crescem: um aparelho que ainda não viu um item não o apaga.
    const album = [...new Set([...save.album, ...current.album])];
    const achievements = [...new Set([...save.achievements, ...current.achievements])];
    const unioned = album.length !== save.album.length || achievements.length !== save.achievements.length;
    if (unioned && !input.overwrite) save = { ...save, album, achievements };

    const row = await this.repo.update(userId, slot, input.baseRevision, fieldsOf(save), new Date(now));
    // Outro aparelho gravou entre a leitura e a escrita: a trava no banco recusou.
    if (!row) throw await this.conflict(userId, slot, save, 'stale');
    return this.result(row, save, checked.flagged, unioned && !input.overwrite);
  }

  async remove(userId: string, slot: number): Promise<void> {
    if (!(await this.repo.softDelete(userId, slot, new Date(this.clock())))) throw new NotFoundException('Save não encontrado');
  }

  /** Desfaz o apagar, se ainda no prazo e o espaço continua sem save vivo. */
  async restore(userId: string, slot: number): Promise<SaveSummary> {
    const row = await this.repo.get(userId, slot);
    if (!row?.deletedAt) throw new NotFoundException('Não há save apagado neste espaço');
    if (this.clock() - row.deletedAt.getTime() > RECOVERY_DAYS * DAY_MS) {
      await this.repo.purgeDeletedBefore(userId, new Date(this.clock() - RECOVERY_DAYS * DAY_MS));
      throw new NotFoundException('O prazo para recuperar este save acabou');
    }
    const back = await this.repo.restore(userId, slot);
    if (!back) throw new NotFoundException('Não há save apagado neste espaço');
    return summarize(back);
  }

  private result(row: SaveRow, save: SaveState, flagged: string[], changed = false): PutResult {
    const out: PutResult = { revision: row.revision, updatedAt: row.updatedAt.toISOString(), flagged };
    if (flagged.length > 0 || changed) out.data = save;
    return out;
  }

  /** O save guardado, de novo pelo validador (o que está no banco nunca é confiado às cegas). */
  private stored(row: SaveRow): SaveState {
    const checked = validateSave(row.data);
    return checked.ok ? checked.save : (row.data as SaveState);
  }

  /** 409 com o save da conta e a junção proposta, para o aparelho escolher. */
  private async conflict(userId: string, slot: number, incoming: SaveState, reason: 'stale' | 'regress' | 'slot-taken') {
    const row = this.alive(await this.repo.get(userId, slot));
    if (!row) return new NotFoundException({ code: 'deleted', message: 'Este save foi apagado' });
    const merged = mergeSaves(this.stored(row), incoming);
    return new ConflictException({
      code: 'conflict',
      reason,
      message: 'Este save mudou em outro aparelho',
      current: full(row),
      merged: { data: merged.save, conflict: merged.conflict },
    });
  }
}
