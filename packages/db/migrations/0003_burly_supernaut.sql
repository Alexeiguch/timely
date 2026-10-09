CREATE TABLE "timely"."notification_devices" (
	"owner_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text,
	"token_hash" text,
	"permission" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"planned_through" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_devices_owner_id_device_id_pk" PRIMARY KEY("owner_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "timely"."notification_jobs" (
	"owner_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"occurrence_id" uuid,
	"definition_id" uuid,
	"version" uuid,
	"kind" text NOT NULL,
	"day" date,
	"due" bigint NOT NULL,
	"expires" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt" bigint DEFAULT 0 NOT NULL,
	"receipt_id" text,
	"receipt_due" bigint,
	"dispatch_token_hash" text,
	"started_at" bigint,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_jobs_owner_id_device_id_key_pk" PRIMARY KEY("owner_id","device_id","key")
);
--> statement-breakpoint
ALTER TABLE "timely"."notification_devices" ADD CONSTRAINT "notification_devices_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."notification_devices" ADD CONSTRAINT "notification_devices_owner_id_device_id_sync_devices_owner_id_id_fk" FOREIGN KEY ("owner_id","device_id") REFERENCES "timely"."sync_devices"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."notification_jobs" ADD CONSTRAINT "notification_jobs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "timely_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timely"."notification_jobs" ADD CONSTRAINT "notification_jobs_owner_id_device_id_notification_devices_owner_id_device_id_fk" FOREIGN KEY ("owner_id","device_id") REFERENCES "timely"."notification_devices"("owner_id","device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_token" ON "timely"."notification_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "notification_due" ON "timely"."notification_jobs" USING btree ("status","due","next_attempt");