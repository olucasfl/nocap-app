import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, username } from 'better-auth/plugins';
import type { Db } from '../db/client';
import { authAccount, authSession, authUser, authVerification } from '../db/schema';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;

/** Só letras minúsculas, números e `_` (o plugin já guarda em minúsculas). */
const USERNAME_RE = /^[a-z0-9_]+$/;

export function createAuth(db: Db) {
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  return betterAuth({
    baseURL: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3333}`,
    // Obrigatório em produção; em dev o Better Auth usa um segredo padrão e avisa.
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [webOrigin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    // Ids em uuid, como `players.id`.
    advanced: {
      database: { generateId: 'uuid' },
      // Atrás do proxy do Render o IP do cliente vem em X-Forwarded-For. Sem isto, todo mundo
      // dividiria o mesmo limite de tentativas de login.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN, autoSignIn: true },
    // Web e API ficam em origens diferentes: o token vai em `Authorization`, não em cookie.
    plugins: [
      bearer(),
      username({
        minUsernameLength: USERNAME_MIN,
        maxUsernameLength: USERNAME_MAX,
        // O plugin normaliza para minúsculas; validar a forma já normalizada (Lucas_01 = lucas_01).
        usernameValidator: (value) => USERNAME_RE.test(value.toLowerCase()),
      }),
    ],
    rateLimit: { enabled: true, window: 60, max: 60 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
