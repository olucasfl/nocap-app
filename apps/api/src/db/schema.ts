import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  unique,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Tabelas do Better Auth (nomes dos campos são os que o adaptador do Drizzle espera).
export const authUser = pgTable('auth_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  /** Última troca de @usuário (intervalo mínimo de 15 dias entre trocas). */
  usernameChangedAt: timestamp('username_changed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** @usuário largado numa troca: fica reservado ao antigo dono por 15 dias, para ninguém se passar por ele. */
export const reservedUsernames = pgTable('reserved_usernames', {
  username: text('username').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  until: timestamp('until', { withTimezone: true }).notNull(),
});

export const authSession = pgTable('auth_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authAccount = pgTable('auth_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authVerification = pgTable('auth_verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Convidado por enquanto (UUID gerado no aparelho); vira conta na Etapa 2. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  nickname: text('nickname'),
  /** Conta dona deste aparelho. Nula enquanto for só convidado. */
  userId: uuid('user_id').references(() => authUser.id, { onDelete: 'set null' }),
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

/** Pedido de amizade. `pending` até a outra pessoa aceitar; recusar e remover apagam a linha. */
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending | accepted
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    unique('friendships_pair_unique').on(t.requesterId, t.addresseeId),
    index('friendships_addressee_idx').on(t.addresseeId, t.status),
  ],
);

/** Um dia (YYYY-MM-DD, fuso de São Paulo) em que a conta abriu o app: base da sequência de dias seguidos. */
export const userVisits = pgTable(
  'user_visits',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
