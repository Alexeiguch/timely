CREATE TABLE "timely"."user_preferences" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timely"."job_outbox" ALTER COLUMN "definition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timely"."user_preferences" ADD CONSTRAINT "user_preferences_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;