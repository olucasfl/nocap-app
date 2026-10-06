import { z } from 'zod';

const answerSchema = z.object({
  h: z.number().int().min(0).max(360),
  s: z.number().int().min(0).max(100),
  b: z.number().int().min(0).max(100),
});

/** O cliente manda só as respostas. Nota e alvo são ignorados/recalculados no servidor. */
export const createMatchSchema = z.object({
  /** Opcional: torna o reenvio da fila offline idempotente. */
  matchId: z.string().uuid().optional(),
  game: z.literal('color'),
  mode: z.string().min(1).max(32),
  kind: z.enum(['solo', 'daily']),
  seed: z.string().min(1).max(64),
  guestId: z.string().uuid(),
  answers: z.array(answerSchema).min(1).max(20),
});
export type CreateMatchInput = z.infer<typeof createMatchSchema>;

export const historyQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const guestIdSchema = z.string().uuid();

export const claimSchema = z.object({ guestId: guestIdSchema });
export type ClaimInput = z.infer<typeof claimSchema>;
