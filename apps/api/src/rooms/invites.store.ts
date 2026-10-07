import { randomUUID } from 'node:crypto';

export const INVITE_TTL_MS = 15 * 60_000;
export const MAX_PENDING_PER_USER = 20;

export interface Invite {
  id: string;
  toUserId: string;
  fromUserId: string;
  fromUsername: string;
  code: string;
  createdAt: number;
}

/**
 * Convites para sala, só em memória: a sala também vive só na memória do servidor, então um
 * convite não sobrevive a ela. Quem recebe consulta por polling (`GET /me/invites`).
 */
export class InvitesStore {
  private byUser = new Map<string, Invite[]>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private fresh(userId: string): Invite[] {
    const cutoff = this.now() - INVITE_TTL_MS;
    const list = (this.byUser.get(userId) ?? []).filter((i) => i.createdAt > cutoff);
    if (list.length === 0) this.byUser.delete(userId);
    else this.byUser.set(userId, list);
    return list;
  }

  /** Mesma pessoa chamando para a mesma sala várias vezes vira um convite só (o mais novo). */
  add(input: Omit<Invite, 'id' | 'createdAt'>): Invite {
    const list = this.fresh(input.toUserId).filter(
      (i) => !(i.fromUserId === input.fromUserId && i.code === input.code),
    );
    const invite: Invite = { ...input, id: randomUUID(), createdAt: this.now() };
    // Passou do limite: descarta os mais antigos (anti-spam contra quem recebe).
    this.byUser.set(input.toUserId, [...list, invite].slice(-MAX_PENDING_PER_USER));
    return invite;
  }

  /** Códigos de sala com convite pendente (para o serviço consultar quais ainda estão abertas). */
  codesFor(userId: string): string[] {
    return [...new Set(this.fresh(userId).map((i) => i.code))];
  }

  /** Convites ainda válidos, mais novos primeiro. `isOpen` diz se a sala ainda aceita gente. */
  listFor(userId: string, isOpen: (code: string) => boolean): Invite[] {
    const open = this.fresh(userId).filter((i) => isOpen(i.code));
    if (open.length === 0) this.byUser.delete(userId);
    else this.byUser.set(userId, open);
    return [...open].sort((a, b) => b.createdAt - a.createdAt);
  }

  remove(userId: string, id: string): boolean {
    const list = this.byUser.get(userId) ?? [];
    const next = list.filter((i) => i.id !== id);
    if (next.length === list.length) return false;
    if (next.length === 0) this.byUser.delete(userId);
    else this.byUser.set(userId, next);
    return true;
  }

  /** Entrou na sala: os convites dela deixam de valer. */
  consumeCode(userId: string, code: string) {
    const next = (this.byUser.get(userId) ?? []).filter((i) => i.code !== code);
    if (next.length === 0) this.byUser.delete(userId);
    else this.byUser.set(userId, next);
  }
}
