import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, inArray, like, ne, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { authUser, friendships } from '../db/schema';

export interface UserRef {
  id: string;
  username: string;
}

export interface FriendshipRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
}

export interface FriendRelation extends FriendshipRow {
  otherUsername: string;
}

/** Escapa `%`, `_` e `\` para a busca por prefixo (o `_` é comum em @usuário). */
export const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class FriendsRepository {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  async findUserByUsername(username: string): Promise<UserRef | null> {
    const rows = await this.db
      .select({ id: authUser.id, username: authUser.username })
      .from(authUser)
      .where(eq(authUser.username, username))
      .limit(1);
    const row = rows[0];
    return row?.username ? { id: row.id, username: row.username } : null;
  }

  async searchUsers(prefix: string, excludeId: string, limit: number): Promise<UserRef[]> {
    const rows = await this.db
      .select({ id: authUser.id, username: authUser.username })
      .from(authUser)
      .where(and(like(authUser.username, `${escapeLike(prefix)}%`), ne(authUser.id, excludeId)))
      .orderBy(authUser.username)
      .limit(limit);
    return rows.flatMap((r) => (r.username ? [{ id: r.id, username: r.username }] : []));
  }

  /** Linha de amizade entre duas pessoas, em qualquer direção. */
  async findBetween(a: string, b: string): Promise<FriendshipRow | null> {
    const rows = await this.db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** Linhas de `me` com qualquer uma das pessoas (uma consulta para a lista da busca). */
  async relationsWith(me: string, others: string[]): Promise<FriendshipRow[]> {
    if (others.length === 0) return [];
    return this.db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, me), inArray(friendships.addresseeId, others)),
          and(eq(friendships.addresseeId, me), inArray(friendships.requesterId, others)),
        ),
      );
  }

  async create(requesterId: string, addresseeId: string) {
    await this.db.insert(friendships).values({ requesterId, addresseeId });
  }

  async accept(id: string) {
    await this.db
      .update(friendships)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(eq(friendships.id, id));
  }

  async remove(id: string) {
    await this.db.delete(friendships).where(eq(friendships.id, id));
  }

  /** Tudo que envolve `me`, já com o @usuário da outra pessoa. */
  async listFor(me: string): Promise<FriendRelation[]> {
    const rows = await this.db
      .select()
      .from(friendships)
      .where(or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)));
    if (rows.length === 0) return [];
    const otherIds = rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
    const users = await this.db
      .select({ id: authUser.id, username: authUser.username })
      .from(authUser)
      .where(inArray(authUser.id, otherIds));
    const name = new Map(users.map((u) => [u.id, u.username ?? '']));
    return rows
      .map((r) => ({
        id: r.id,
        requesterId: r.requesterId,
        addresseeId: r.addresseeId,
        status: r.status,
        otherUsername: name.get(r.requesterId === me ? r.addresseeId : r.requesterId) ?? '',
      }))
      .filter((r) => r.otherUsername)
      .sort((a, b) => a.otherUsername.localeCompare(b.otherUsername));
  }

  async friendIds(me: string): Promise<string[]> {
    const rows = await this.db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
        ),
      );
    return rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
  }

  /** Pedidos que `me` enviou e ainda esperam resposta. */
  async countOutgoingPending(me: string): Promise<number> {
    const rows = await this.db
      .select({ id: friendships.id })
      .from(friendships)
      .where(and(eq(friendships.requesterId, me), eq(friendships.status, 'pending')));
    return rows.length;
  }
}
