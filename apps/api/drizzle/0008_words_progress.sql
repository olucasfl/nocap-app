CREATE TABLE "words_progress" (
	"user_id" uuid NOT NULL,
	"game" text NOT NULL,
	"level" integer NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_progress_user_id_game_level_pk" PRIMARY KEY("user_id","game","level")
);
--> statement-breakpoint
ALTER TABLE "words_progress" ADD CONSTRAINT "words_progress_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;