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
  /** Legado (aparelho): ignorado. Quem joga é a conta da sessão. */
  guestId: z.string().uuid().optional(),
};

const colorMatchSchema = z.object({
  ...base,
  game: z.literal('color'),
  answers: z.array(answerSchema).min(1).max(30),
});

const timeMatchSchema = z.object({
  ...base,
  game: z.literal('time'),
  /** Duração medida no aparelho, em ms, uma por rodada. */
  answers: z.array(z.number().int().min(0).max(600_000)).min(1).max(30),
  /** Sessão assinada pelo servidor (`POST /games/time/session`). */
  session: z.string().min(10).max(600),
});

const ecoMatchSchema = z.object({
  ...base,
  game: z.literal('eco'),
  /** Os botões tocados, em ordem (0 a 8). O servidor repassa contra a sequência da seed. */
  taps: z.array(z.number().int().min(0).max(8)).max(1000).default([]),
  /** Batida: cada toque como [pista 0 a 4, instante em ms desde o início]. */
  beats: z
    .array(z.tuple([z.number().int().min(0).max(4), z.number().int().min(0).max(1_200_000)]))
    .max(6000)
    .optional(),
  /** Sessão assinada pelo servidor (`POST /games/eco/session`). */
  session: z.string().min(10).max(600),
});

/** O cliente manda só as respostas. Nota e alvo são ignorados/recalculados no servidor. */
export const createMatchSchema = z.discriminatedUnion('game', [
  colorMatchSchema,
  timeMatchSchema,
  ecoMatchSchema,
]);
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ColorMatchInput = z.infer<typeof colorMatchSchema>;
export type TimeMatchInput = z.infer<typeof timeMatchSchema>;
export type EcoMatchInput = z.infer<typeof ecoMatchSchema>;

export const historyQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Só as partidas de um jogo (o histórico do app é separado por jogo). */
  game: z.enum(['color', 'time', 'eco']).optional(),
  /** Filtros do histórico: modo (classic, flash...), tipo (solo, daily, sala) e período. */
  mode: z.string().min(1).max(32).optional(),
  kind: z.enum(['solo', 'daily', 'room']).optional(),
  period: z.enum(['day', 'week', 'all']).default('all'),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const guestIdSchema = z.string().uuid();

export const claimSchema = z.object({ guestId: guestIdSchema });
export type ClaimInput = z.infer<typeof claimSchema>;

export const timeSessionSchema = z.object({ kind: z.enum(['solo', 'daily']).default('solo') });
export type TimeSessionInput = z.infer<typeof timeSessionSchema>;
/** A sessão do Eco tem o mesmo formato da do Tempo. */
export const ecoSessionSchema = timeSessionSchema;
