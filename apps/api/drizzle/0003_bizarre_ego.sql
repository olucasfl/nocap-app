CREATE TABLE "user_visits" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "user_visits_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "user_visits" ADD CONSTRAINT "user_visits_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;