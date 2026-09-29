CREATE SCHEMA "timely";
--> statement-breakpoint
CREATE TABLE "timely"."job_outbox" (
	"owner_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"type" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_outbox_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "timely"."occurrence_events" (
	"owner_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_events_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "timely"."recurrence_revisions" (
	"owner_id" text NOT NULL,
	"definition_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "recurrence_revisions_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "timely"."snapshot_items" (
	"owner_id" text NOT NULL,
	"token" uuid NOT NULL,
	"position" integer NOT NULL,
	"record" jsonb NOT NULL,
	CONSTRAINT "snapshot_items_owner_id_token_position_pk" PRIMARY KEY("owner_id","token","position")
);
--> statement-breakpoint
CREATE TABLE "timely"."sync_changes" (
	"owner_id" text NOT NULL,
	"cursor" bigint NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_changes_owner_id_cursor_pk" PRIMARY KEY("owner_id","cursor")
);
--> statement-breakpoint
CREATE TABLE "timely"."sync_devices" (
	"owner_id" text NOT NULL,
	"id" uuid NOT NULL,
	"platform" text NOT NULL,
	"zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_devices_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "timely"."sync_heads" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"cursor" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timely"."sync_operations" (
	"owner_id" text NOT NULL,
	"id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"command" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_operations_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "timely"."sync_snapshots" (
	"owner_id" text NOT NULL,
	"id" uuid NOT NULL,
	"watermark" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_snapshots_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "timely"."task_definitions" (
	"owner_id" text NOT NULL,
	"id" uuid NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_definitions_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "timely"."task_occurrences" (
	"owner_id" text NOT NULL,
	"definition_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"scheduled_date" date NOT NULL,
	"state" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "task_occurrences_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "timely"."job_outbox" ADD CONSTRAINT "job_outbox_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."occurrence_events" ADD CONSTRAINT "occurrence_events_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."recurrence_revisions" ADD CONSTRAINT "recurrence_revisions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."snapshot_items" ADD CONSTRAINT "snapshot_items_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."sync_changes" ADD CONSTRAINT "sync_changes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."sync_devices" ADD CONSTRAINT "sync_devices_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."sync_heads" ADD CONSTRAINT "sync_heads_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."sync_operations" ADD CONSTRAINT "sync_operations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."sync_snapshots" ADD CONSTRAINT "sync_snapshots_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."task_definitions" ADD CONSTRAINT "task_definitions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."task_occurrences" ADD CONSTRAINT "task_occurrences_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_unprocessed" ON "timely"."job_outbox" USING btree ("processed_at","created_at");--> statement-breakpoint
CREATE INDEX "revision_definition" ON "timely"."recurrence_revisions" USING btree ("owner_id","definition_id");--> statement-breakpoint
CREATE INDEX "occurrence_date" ON "timely"."task_occurrences" USING btree ("owner_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "occurrence_definition" ON "timely"."task_occurrences" USING btree ("owner_id","definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_slot" ON "timely"."task_occurrences" USING btree ("owner_id","definition_id","revision_id","slot");