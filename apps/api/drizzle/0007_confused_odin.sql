CREATE TABLE "word_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"game" text NOT NULL,
	"mode" text NOT NULL,
	"kind" text NOT NULL,
	"day" text,
	"seed" text NOT NULL,
	"answers" text[] NOT NULL,
	"guesses" text[] DEFAULT '{}' NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"match_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "word_runs_daily_unique" UNIQUE("user_id","game","day")
);
--> statement-breakpoint
ALTER TABLE "word_runs" ADD CONSTRAINT "word_runs_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "word_runs_user_idx" ON "word_runs" USING btree ("user_id","started_at" DESC NULLS LAST);