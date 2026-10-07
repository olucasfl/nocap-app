import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { authUser, reservedUsernames } from '../db/schema';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_RE = /^[a-z0-9_]+$/;
/** Intervalo entre trocas e tempo em que o @ largado fica reservado ao antigo dono. */
export const USERNAME_COOLDOWN_DAYS = 15;
const DAY_MS = 86_400_000;

/** Mensagem exata do que está errado no @ (a mesma lógica existe no app, para mostrar antes de enviar). */
export function usernameProblem(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v.length < USERNAME_MIN) return `Muito curto: use pelo menos ${USERNAME_MIN} caracteres`;
  if (v.length > USERNAME_MAX) return `Muito longo: use no máximo ${USERNAME_MAX} caracteres`;
  if (!USERNAME_RE.test(v)) {
    return 'Só pode letras minúsculas sem acento, números e _ (sem espaço, @, ponto ou hífen)';
  }
  return null;
}

@Injectable()
export class AccountService {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  /** Quando a pessoa poderá trocar de @ de novo (`null` = já pode). */
  private nextChangeAt(changedAt: Date | null, now = new Date()): Date | null {
    if (!changedAt) return null;
    const next = new Date(changedAt.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS);
    return next > now ? next : null;
  }

  async status(userId: string) {
    const [u] = await this.db
      .select({ username: authUser.username, changedAt: authUser.usernameChangedAt })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);
    if (!u) throw new NotFoundException('Conta não encontrada');
    return {
      username: u.username,
      nextChangeAt: this.nextChangeAt(u.changedAt)?.toISOString() ?? null,
    };
  }

  async changeUsername(userId: string, raw: string) {
    const wanted = raw.trim().toLowerCase();
    const problem = usernameProblem(wanted);
    if (problem) throw new BadRequestException(problem);

    const [me] = await this.db
      .select({ username: authUser.username, changedAt: authUser.usernameChangedAt })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);
    if (!me) throw new NotFoundException('Conta não encontrada');
    if (me.username === wanted) throw new BadRequestException('Esse já é o seu @ atual');

    const next = this.nextChangeAt(me.changedAt);
    if (next) {
      throw new ForbiddenException(
        `Você trocou de @ há pouco. Poderá trocar de novo em ${next.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      );
    }

    const taken = await this.db
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.username, wanted))
      .limit(1);
    if (taken[0]) throw new ConflictException('Esse @ já está em uso por outra pessoa');

    const held = await this.db
      .select({ userId: reservedUsernames.userId })
      .from(reservedUsernames)
      .where(and(eq(reservedUsernames.username, wanted), gt(reservedUsernames.until, new Date())))
      .limit(1);
    if (held[0] && held[0].userId !== userId) {
      throw new ConflictException(
        `Esse @ foi liberado há pouco e fica reservado por ${USERNAME_COOLDOWN_DAYS} dias`,
      );
    }

    const now = new Date();
    try {
      await this.db.transaction(async (tx) => {
        // O @ antigo fica reservado a esta pessoa pelo intervalo; o novo deixa de estar reservado.
        if (me.username) {
          await tx
            .insert(reservedUsernames)
            .values({
              username: me.username,
              userId,
              until: new Date(now.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS),
            })
            .onConflictDoUpdate({
              target: reservedUsernames.username,
              set: { userId, until: new Date(now.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS) },
            });
        }
        await tx.delete(reservedUsernames).where(eq(reservedUsernames.username, wanted));
        await tx
          .update(authUser)
          .set({
            username: wanted,
            displayUsername: wanted,
            usernameChangedAt: now,
            updatedAt: now,
          })
          .where(eq(authUser.id, userId));
      });
    } catch (e) {
      // Duas trocas ao mesmo tempo para o mesmo @: a restrição única do banco decide.
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Esse @ já está em uso por outra pessoa');
      }
      throw e;
    }
    return {
      username: wanted,
      nextChangeAt: new Date(now.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS).toISOString(),
    };
  }
}
