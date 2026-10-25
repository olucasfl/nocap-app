import { CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest, type SessionUser } from '../auth/auth.guard';

/**
 * Quem pode abrir o Aperta!: qualquer conta logada (liberado para todos em 25/10/2026). Para voltar ao modo teste,
 * defina `APERTA_ALLOWED_EMAILS` (e-mails separados por vírgula): então só essas contas entram. A decisão é sempre do
 * servidor: o web só pergunta (`GET /me/aperta/access`), nada de e-mail vai no código do navegador.
 */
export function allowedEmails(env: string | undefined = process.env.APERTA_ALLOWED_EMAILS): string[] {
  return (env ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function canPlayAperta(user: Pick<SessionUser, 'email'> | undefined | null, env?: string): boolean {
  if (!user) return false;
  const list = allowedEmails(env);
  if (list.length === 0) return true;
  return !!user.email && list.includes(user.email.trim().toLowerCase());
}

/** Depois do `AuthGuard`: conta fora da lista recebe 403 em qualquer rota de save. */
@Injectable()
export class ApertaAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!canPlayAperta(req.user)) throw new ForbiddenException('O Aperta! ainda não está liberado para esta conta');
    return true;
  }
}

/** O web pergunta aqui se mostra o Aperta! (exige conta; a resposta é só sim ou não). */
@Controller('me/aperta/access')
@UseGuards(AuthGuard)
export class ApertaAccessController {
  @Get()
  access(@Req() req: AuthedRequest): { allowed: boolean } {
    return { allowed: canPlayAperta(req.user) };
  }
}
