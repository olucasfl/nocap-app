CREATE TABLE "reserved_usernames" (
	"username" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "username_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reserved_usernames" ADD CONSTRAINT "reserved_usernames_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;