import { createHmac, timingSafeEqual } from 'node:crypto';

/** Passou disto desde o início, a sessão não vale (cobre a fila offline, não mais que isso). */
export const SESSION_MAX_AGE_MS = 7 * 24 * 3600_000;

/**
 * Segredo que assina as sessões do Tempo. Usa o mesmo `BETTER_AUTH_SECRET` do login; em
 * produção ele é obrigatório. Sem ele (só em dev) vale um padrão público.
 */
function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET é obrigatória em produção');
  }
  return 'nocap-dev-secret-only-for-local-use';
}

const sign = (payload: string, key: string) =>
  createHmac('sha256', key).update(payload).digest('base64url');

export interface TimeSession {
  seed: string;
  /** Quando a sessão começou, no relógio do servidor (ms). */
  issuedAt: number;
}

/**
 * Sessão assinada pelo servidor: prova que a partida começou naquele instante. O Tempo mede no
 * aparelho, então o servidor usa isto para recusar respostas que somam mais do que o tempo que
 * realmente passou (brief #6).
 */
export function issueTimeSession(seed: string, now: number = Date.now(), key = secret()): string {
  const payload = Buffer.from(JSON.stringify({ seed, issuedAt: now })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** `null` se a assinatura não bate, o formato é inválido ou a sessão expirou. */
export function verifyTimeSession(
  token: string,
  now: number = Date.now(),
  key = secret(),
): TimeSession | null {
  const [payload, sig, ...rest] = token.split('.');
  if (!payload || !sig || rest.length > 0) return null;
  const expected = sign(payload, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<TimeSession>;
    if (typeof parsed.seed !== 'string' || typeof parsed.issuedAt !== 'number') return null;
    if (parsed.issuedAt > now || now - parsed.issuedAt > SESSION_MAX_AGE_MS) return null;
    return { seed: parsed.seed, issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}
