import { z } from 'zod';

const answerSchema = z.object({
  h: z.number().int().min(0).max(360),
  s: z.number().int().min(0).max(100),
  b: z.number().int().min(0).max(100),
});

const base = {
  /** Opcional: torna o reenvio da fila offline idempotente. */
  matchId: z.string().uuid().optional(),
  mode: z.string().min(1).max(32),
  kind: z.enum(['solo', 'daily']),
  seed: z.string().min(1).max(64),
  guestId: z.string().uuid(),
};

const colorMatchSchema = z.object({
  ...base,
  game: z.literal('color'),
  answers: z.array(answerSchema).min(1).max(20),
});

const timeMatchSchema = z.object({
  ...base,
  game: z.literal('time'),
  /** Duração medida no aparelho, em ms, uma por rodada. */
  answers: z.array(z.number().int().min(0).max(600_000)).min(1).max(20),
  /** Sessão assinada pelo servidor (`POST /games/time/session`). */
  session: z.string().min(10).max(600),
});

/** O cliente manda só as respostas. Nota e alvo são ignorados/recalculados no servidor. */
export const createMatchSchema = z.discriminatedUnion('game', [colorMatchSchema, timeMatchSchema]);
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ColorMatchInput = z.infer<typeof colorMatchSchema>;
export type TimeMatchInput = z.infer<typeof timeMatchSchema>;

export const historyQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const guestIdSchema = z.string().uuid();

export const claimSchema = z.object({ guestId: guestIdSchema });
export type ClaimInput = z.infer<typeof claimSchema>;

export const timeSessionSchema = z.object({ kind: z.enum(['solo', 'daily']).default('solo') });
export type TimeSessionInput = z.infer<typeof timeSessionSchema>;
