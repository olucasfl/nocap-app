import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

/** Contador de janela deslizante, em memória (uma instância só, como as salas). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Registra uma tentativa. `ok: false` quando passou do limite da janela. */
  hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: recent[0]! + windowMs - t };
    }
    recent.push(t);
    this.hits.set(key, recent);
    // Limpeza preguiçosa: não deixa o mapa crescer sem fim.
    if (this.hits.size > 10_000) this.prune(windowMs);
    return { ok: true, retryAfterMs: 0 };
  }

  private prune(windowMs: number) {
    const cutoff = this.now() - windowMs;
    for (const [k, v] of this.hits) {
      if (v.every((x) => x <= cutoff)) this.hits.delete(k);
    }
  }
}

/** Limitador único do processo (as rotas e a sala compartilham). */
export const limiter = new RateLimiter();

export interface RateRule {
  limit: number;
  windowMs: number;
  /** Quem conta: a conta logada (o padrão) ou o IP. */
  by?: 'user' | 'ip';
}

const RATE_KEY = 'nocap:rate';

/** Limite por rota: `@RateLimit({ limit: 30, windowMs: 60_000 })`, junto de `@UseGuards(AuthGuard, RateLimitGuard)`. */
export const RateLimit = (rule: RateRule) => SetMetadata(RATE_KEY, rule);

const TOO_MANY = 'Muitas requisições. Espere um instante e tente de novo.';

function tooMany(retryAfterMs: number): never {
  throw new HttpException(
    { message: TOO_MANY, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

type Req = Request & { user?: { id: string } };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rule = this.reflector.get<RateRule | undefined>(RATE_KEY, ctx.getHandler());
    if (!rule) return true;
    const req = ctx.switchToHttp().getRequest<Req>();
    const who = rule.by === 'ip' ? req.ip : (req.user?.id ?? req.ip);
    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const res = limiter.hit(`${who}|${route}`, rule.limit, rule.windowMs);
    if (!res.ok) tooMany(res.retryAfterMs);
    return true;
  }
}

/** Teto geral por IP em qualquer rota (protege o servidor pequeno do plano grátis). */
export const GLOBAL_LIMIT: RateRule = { limit: 300, windowMs: 60_000, by: 'ip' };

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = limiter.hit(`global|${req.ip}`, GLOBAL_LIMIT.limit, GLOBAL_LIMIT.windowMs);
    if (!res.ok) tooMany(res.retryAfterMs);
    return true;
  }
}
