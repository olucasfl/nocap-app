import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from './auth';
import { AUTH } from './auth.constants';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
}

export type AuthedRequest = Request & { user: SessionUser };

/** Exige sessão válida (token bearer) e põe o usuário em `req.user`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth | null) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.auth) throw new ServiceUnavailableException('Banco de dados não configurado');
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException('Entre na sua conta');
    req.user = session.user;
    return true;
  }
}
