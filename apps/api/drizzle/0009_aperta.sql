CREATE TABLE "aperta_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" smallint NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"play_seconds" integer DEFAULT 0 NOT NULL,
	"collapses" integer DEFAULT 0 NOT NULL,
	"picks" integer DEFAULT 0 NOT NULL,
	"dust_log10" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "aperta_saves_user_slot_unique" UNIQUE("user_id","slot"),
	CONSTRAINT "aperta_saves_slot_check" CHECK ("aperta_saves"."slot" in (1, 2))
);
--> statement-breakpoint
ALTER TABLE "aperta_saves" ADD CONSTRAINT "aperta_saves_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;