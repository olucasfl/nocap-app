import { Injectable } from '@nestjs/common';
import { matchMaker } from 'colyseus';
import { FriendsService } from '../friends/friends.service';
import { InvitesStore } from './invites.store';

/** Convites para sala: só entre amigos, e só enquanto a sala está no lobby e tem vaga. */
@Injectable()
export class InvitesService {
  readonly store = new InvitesStore();

  constructor(private readonly friends: FriendsService) {}

  /** Chamado pela sala. Quem não é amigo (ou não existe) recebe o erro de volta. */
  async send(from: { id: string; username: string }, toUsername: string, code: string) {
    const to = await this.friends.friendByUsername(from.id, toUsername);
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
