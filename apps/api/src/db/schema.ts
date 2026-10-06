import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Convidado por enquanto (UUID gerado no aparelho); vira conta na Etapa 2. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  nickname: text('nickname'),
});

/** Não guardamos o alvo: ele é regenerado pela seed. */
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  game: text('game').notNull(),
  mode: text('mode').notNull(),
  kind: text('kind').notNull(), // solo | room | daily
  seed: text('seed').notNull(),
  settings: jsonb('settings'),
  ranked: boolean('ranked').notNull().default(false),
  playedAt: timestamp('played_at', { withTimezone: true }).defaultNow().notNull(),
});

export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    // Cor: h*10000 + s*100 + b por rodada. Tempo: ms por rodada.
    answers: integer('answers').array(),
    totalScore: smallint('total_score').notNull(),
    placement: smallint('placement'),
    playedAt: timestamp('played_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index('match_players_player_played_idx').on(t.playerId, t.playedAt.desc()),
  ],
);

export const userGameStats = pgTable(
  'user_game_stats',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    game: text('game').notNull(),
    mode: text('mode').notNull(),
    matches: integer('matches').notNull().default(0),
    scoreSum: integer('score_sum').notNull().default(0),
    best: smallint('best').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.game, t.mode] })],
);
