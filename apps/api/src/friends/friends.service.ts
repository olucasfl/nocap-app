import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FriendRelation, FriendshipRow, UserRef } from './friends.repository';
import { FriendsRepository } from './friends.repository';

/** Pedidos de amizade enviados e ainda sem resposta (anti-spam). */
export const MAX_PENDING_OUT = 50;

export type RelationState = 'none' | 'friends' | 'outgoing' | 'incoming';

/** Só @usuário sai daqui: nome real, e-mail e ids de usuário ficam no servidor. */
export interface PublicUser {
  username: string;
}

@Injectable()
export class FriendsService {
  constructor(private readonly repo: FriendsRepository) {}

  private async userOrFail(username: string): Promise<UserRef> {
    const user = await this.repo.findUserByUsername(username.trim().toLowerCase());
    if (!user) throw new NotFoundException('Não achamos ninguém com esse usuário');
    return user;
  }

  /** Estado da relação de `me` com `other`, olhando a linha (em qualquer direção). */
  private stateOf(me: string, row: FriendshipRow | null): RelationState {
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    return row.requesterId === me ? 'outgoing' : 'incoming';
  }

  async search(me: string, q: string): Promise<(PublicUser & { state: RelationState })[]> {
    const users = await this.repo.searchUsers(q.trim().toLowerCase(), me, 10);
    const rows = await this.repo.relationsWith(
      me,
      users.map((u) => u.id),
    );
    return users.map((u) => ({
      username: u.username,
      state: this.stateOf(
        me,
        rows.find((r) => r.requesterId === u.id || r.addresseeId === u.id) ?? null,
      ),
    }));
  }

  async list(me: string) {
    const rows: FriendRelation[] = await this.repo.listFor(me);
    const pick = (f: (r: FriendRelation) => boolean) =>
      rows.filter(f).map((r) => ({ username: r.otherUsername }));
    return {
      friends: pick((r) => r.status === 'accepted'),
      incoming: pick((r) => r.status === 'pending' && r.addresseeId === me),
      outgoing: pick((r) => r.status === 'pending' && r.requesterId === me),
    };
  }

  /** Se a outra pessoa já tinha pedido, o pedido cruzado vira amizade na hora. */
  async request(me: string, username: string): Promise<{ state: RelationState }> {
    const other = await this.userOrFail(username);
    if (other.id === me) throw new BadRequestException('Você não pode adicionar você mesmo');

    const existing = await this.repo.findBetween(me, other.id);
    if (!existing && (await this.repo.countOutgoingPending(me)) >= MAX_PENDING_OUT) {
      throw new BadRequestException('Você tem pedidos demais esperando resposta. Cancele alguns.');
    }
    if (existing) {
      if (existing.status === 'accepted') throw new ConflictException('Vocês já são amigos');
      if (existing.requesterId === me) throw new ConflictException('Pedido já enviado');
      await this.repo.accept(existing.id);
      return { state: 'friends' };
    }
    await this.repo.create(me, other.id);
    return { state: 'outgoing' };
  }

  /** Aceita um pedido que a outra pessoa te mandou. */
  async accept(me: string, username: string) {
    const other = await this.userOrFail(username);
    const row = await this.repo.findBetween(me, other.id);
    if (!row || row.status !== 'pending' || row.addresseeId !== me) {
      throw new NotFoundException('Não há pedido dessa pessoa para você');
    }
    await this.repo.accept(row.id);
    return { state: 'friends' as const };
  }

  /** Recusa um pedido recebido (apaga sem avisar quem pediu). */
  async decline(me: string, username: string) {
    const other = await this.userOrFail(username);
    const row = await this.repo.findBetween(me, other.id);
    if (!row || row.status !== 'pending' || row.addresseeId !== me) {
      throw new NotFoundException('Não há pedido dessa pessoa para você');
    }
    await this.repo.remove(row.id);
    return { state: 'none' as const };
  }

  /** Remove um amigo ou cancela um pedido que você enviou. */
  async remove(me: string, username: string) {
    const other = await this.userOrFail(username);
    const row = await this.repo.findBetween(me, other.id);
    const canRemove = row && (row.status === 'accepted' || row.requesterId === me);
    if (!row || !canRemove) throw new NotFoundException('Vocês não são amigos');
    await this.repo.remove(row.id);
    return { state: 'none' as const };
  }

  /** A pessoa com esse @usuário, só se for amiga de `me` (convite para sala). */
  async friendByUsername(me: string, username: string): Promise<UserRef> {
    const other = await this.userOrFail(username);
    const row = await this.repo.findBetween(me, other.id);
    if (!row || row.status !== 'accepted') {
      throw new ForbiddenException('Só dá para convidar amigos');
    }
    return other;
  }

  /** Ids da pessoa e dos amigos aceitos (para o ranking entre amigos). */
  async circleOf(me: string): Promise<string[]> {
    return [me, ...(await this.repo.friendIds(me))];
  }
}
