CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"answers" integer[],
	"total_score" smallint NOT NULL,
	"placement" smallint,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_players_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" text NOT NULL,
	"mode" text NOT NULL,
	"kind" text NOT NULL,
	"seed" text NOT NULL,
	"settings" jsonb,
	"ranked" boolean DEFAULT false NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nickname" text
);
--> statement-breakpoint
CREATE TABLE "user_game_stats" (
	"player_id" uuid NOT NULL,
	"game" text NOT NULL,
	"mode" text NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"score_sum" integer DEFAULT 0 NOT NULL,
	"best" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "user_game_stats_player_id_game_mode_pk" PRIMARY KEY("player_id","game","mode")
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_player_played_idx" ON "match_players" USING btree ("player_id","played_at" DESC NULLS LAST);