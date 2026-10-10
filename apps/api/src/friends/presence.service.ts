import { Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { userPresence } from '../db/schema';

/** Sem batimento há mais que isto, a pessoa conta como offline (o app bate a cada ~45 s). */
export const ONLINE_MS = 100_000;
/** O banco só é escrito de tempos em tempos; o "online" vem da memória. */
export const PERSIST_EVERY_MS = 2 * 60_000;

export interface Presence {
  online: boolean;
  /** Última vez com o app aberto (ISO), ou `null` se nunca bateu. */
  lastSeenAt: string | null;
}

export interface LastPlayed {
  game: string;
  mode: string;
  kind: string;
  playedAt: string;
}

/**
 * Quem está online e a última vez que cada pessoa abriu o app. O "agora" fica em memória (uma
 * instância só, como as salas); o banco guarda a última vez para sobreviver a reinício. Se a
 * tabela ainda não existe (migration pendente), tudo degrada para "sem informação" em vez de
 * derrubar a tela.
 */
@Injectable()
export class PresenceService {
  private seen = new Map<string, number>();
  private written = new Map<string, number>();

  /** Relógio: os testes trocam por um controlado (o Nest só injeta o banco). */
  now: () => number = () => Date.now();

  constructor(@Inject(DB) private readonly db: Db | null) {}

  /** A conta está com o app aberto agora. */
  async touch(userId: string): Promise<void> {
    const t = this.now();
    this.seen.set(userId, t);
    if (!this.db || t - (this.written.get(userId) ?? 0) < PERSIST_EVERY_MS) return;
    this.written.set(userId, t);
    const at = new Date(t);
    try {
      await this.db
        .insert(userPresence)
        .values({ userId, lastSeenAt: at })
        .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: at } });
    } catch (e) {
      // Tabela ausente ou banco fora: o online (memória) continua valendo.
      this.written.delete(userId);
      console.error('falha ao gravar a presença', e);
    }
  }

  /** Online e última visita de várias contas de uma vez. */
  async of(userIds: string[]): Promise<Map<string, Presence>> {
    const out = new Map<string, Presence>();
    if (userIds.length === 0) return out;
    const stored = new Map<string, number>();
    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(userPresence)
          .where(inArray(userPresence.userId, userIds));
        for (const r of rows) stored.set(r.userId, r.lastSeenAt.getTime());
      } catch (e) {
        console.error('falha ao ler a presença', e);
      }
    }
    const t = this.now();
    for (const id of userIds) {
      const mem = this.seen.get(id);
      const last = Math.max(mem ?? 0, stored.get(id) ?? 0);
      out.set(id, {
        online: mem !== undefined && t - mem <= ONLINE_MS,
        lastSeenAt: last > 0 ? new Date(last).toISOString() : null,
      });
    }
    return out;
  }

  /** A partida mais recente de cada conta (qualquer jogo ou tipo), para "jogou X há tanto tempo". */
  async lastPlayed(userIds: string[]): Promise<Map<string, LastPlayed>> {
    const out = new Map<string, LastPlayed>();
    if (!this.db || userIds.length === 0) return out;
    try {
      const ids = sql.join(
        userIds.map((i) => sql`${i}::uuid`),
        sql`, `,
      );
      const rows = await this.db.execute<{
        userId: string;
        game: string;
        mode: string;
        kind: string;
        playedAt: Date | string;
      }>(sql`
        select distinct on (p.user_id)
          p.user_id as "userId", m.game, m.mode, m.kind, mp.played_at as "playedAt"
        from match_players mp
        join players p on p.id = mp.player_id
        join matches m on m.id = mp.match_id
        where p.user_id in (${ids})
        order by p.user_id, mp.played_at desc
      `);
      for (const r of rows) {
        out.set(r.userId, {
          game: r.game,
          mode: r.mode,
          kind: r.kind,
          playedAt: new Date(r.playedAt).toISOString(),
        });
      }
    } catch (e) {
      console.error('falha ao ler a última partida', e);
    }
    return out;
  }
}
