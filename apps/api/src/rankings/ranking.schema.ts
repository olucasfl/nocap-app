import { z } from 'zod';

/** `daily` é o preset clássico só das partidas do Daily; os demais são presets solo. */
export const RANKING_BOARDS = ['classic', 'flash', 'quick', 'strict', 'daily'] as const;
export const RANKING_GAMES = ['color', 'time'] as const;
export type RankingGame = (typeof RANKING_GAMES)[number];

/** Quadros que cada jogo tem (Flash é da Cor; "Sem estourar" é do Tempo). */
export const BOARDS_OF: Record<RankingGame, readonly string[]> = {
  color: ['classic', 'flash', 'quick', 'daily'],
  time: ['classic', 'quick', 'strict', 'daily'],
};

export const rankingQuerySchema = z.object({
  board: z.enum(RANKING_BOARDS).default('classic'),
  period: z.enum(['day', 'week', 'all']).default('week'),
  /** `friends`: só você e seus amigos aceitos (exige login). */
  scope: z.enum(['all', 'friends']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
