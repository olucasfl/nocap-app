import { Injectable } from '@nestjs/common';
import { matchMaker } from 'colyseus';
import { limiter } from '../common/rate-limit';
import { FriendsService } from '../friends/friends.service';
import { InvitesStore } from './invites.store';

/** Convites para sala: para qualquer pessoa com conta, e só enquanto a sala está no lobby e tem vaga. */
@Injectable()
export class InvitesService {
  readonly store = new InvitesStore();

  constructor(private readonly friends: FriendsService) {}

  /** Chamado pela sala. Quem não existe (ou é você mesmo) recebe o erro de volta. */
  async send(
    from: { id: string; username: string },
    toUsername: string,
    code: string,
    /** A sala sabe quem já está nela (ninguém convida quem já entrou). */
    alreadyIn: (userId: string) => boolean = () => false,
  ) {
    if (!limiter.hit(`invite|${from.id}`, 20, 60_000).ok) {
      throw new Error('Convites demais em pouco tempo. Espere um instante.');
    }
    const to = await this.friends.userByUsername(toUsername);
    if (to.id === from.id) throw new Error('Você já está na sala');
    if (alreadyIn(to.id)) throw new Error(`@${to.username} já está na sala`);
    this.store.add({
      toUserId: to.id,
      fromUserId: from.id,
      fromUsername: from.username,
      code,
    });
    return { username: to.username };
  }

  /** A sala existe, está no lobby e não lotou. */
  private async isOpen(code: string): Promise<boolean> {
    try {
      const room = await matchMaker.getRoomById(code);
      if (!room || room.locked) return false;
      const metadata = room.metadata as { phase?: string } | undefined;
      return metadata?.phase === 'lobby' && room.clients < room.maxClients;
    } catch {
      return false;
    }
  }

  async listFor(userId: string) {
    const codes = this.store.codesFor(userId);
    const open = new Set<string>();
    for (const code of codes) if (await this.isOpen(code)) open.add(code);
    return this.store
      .listFor(userId, (code) => open.has(code))
      .map((i) => ({
        id: i.id,
        code: i.code,
        from: { username: i.fromUsername },
        createdAt: new Date(i.createdAt).toISOString(),
      }));
  }

  decline(userId: string, id: string) {
    return { removed: this.store.remove(userId, id) };
  }

  /** Entrou na sala: os convites dela deixam de valer. */
  consume(userId: string, code: string) {
    this.store.consumeCode(userId, code);
  }
}
