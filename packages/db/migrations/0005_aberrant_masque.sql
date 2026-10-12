CREATE TABLE "timely"."notification_reconciliations" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"last_attempt" bigint DEFAULT 0 NOT NULL,
	"next_attempt" bigint DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timely"."notification_reconciliations" ADD CONSTRAINT "notification_reconciliations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;