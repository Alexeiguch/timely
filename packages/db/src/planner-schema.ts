import {
  pgSchema,
  text,
  uuid,
  jsonb,
  bigint,
  timestamp,
  primaryKey,
  index,
  integer,
  date,
  uniqueIndex,
  boolean,
  foreignKey,
} from "drizzle-orm/pg-core";
import type {
  Operation,
  SyncOperation,
  SyncRecord,
  PreferenceRecord,
  Outcome,
  TaskRecord,
  Occurrence,
} from "@timely/contracts";
import { user } from "./auth-schema";
export const timelySchema = pgSchema("timely");
const owner = () =>
  text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const at = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const syncHeads = timelySchema.table("sync_heads", {
  ownerId: owner().primaryKey(),
  cursor: bigint("cursor", { mode: "number" }).notNull().default(0),
});
export const taskDefinitions = timelySchema.table(
  "task_definitions",
  {
    ownerId: owner(),
    id: uuid("id").notNull(),
    record: jsonb("record").$type<TaskRecord>().notNull(),
    updatedAt: at(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);
export const userPreferences = timelySchema.table("user_preferences", {
  ownerId: owner().primaryKey(),
  record: jsonb("record").$type<PreferenceRecord>().notNull(),
  updatedAt: at(),
});
export const recurrenceRevisions = timelySchema.table(
  "recurrence_revisions",
  {
    ownerId: owner(),
    definitionId: uuid("definition_id").notNull(),
    id: uuid("id").notNull(),
    payload: jsonb("payload").$type<Operation>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.id] }),
    index("revision_definition").on(t.ownerId, t.definitionId),
  ],
);
export const taskOccurrences = timelySchema.table(
  "task_occurrences",
  {
    ownerId: owner(),
    definitionId: uuid("definition_id").notNull(),
    id: uuid("id").notNull(),
    revisionId: uuid("revision_id").notNull(),
    slot: text("slot").notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    state: text("state").notNull(),
    payload: jsonb("payload").$type<Occurrence>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.id] }),
    index("occurrence_date").on(t.ownerId, t.scheduledDate),
    index("occurrence_definition").on(t.ownerId, t.definitionId),
    uniqueIndex("occurrence_slot").on(
      t.ownerId,
      t.definitionId,
      t.revisionId,
      t.slot,
    ),
  ],
);
export const syncDevices = timelySchema.table(
  "sync_devices",
  {
    ownerId: owner(),
    id: uuid("id").notNull(),
    platform: text("platform").notNull(),
    zone: text("zone").notNull(),
    lastSeen: at(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);
export const syncOperations = timelySchema.table(
  "sync_operations",
  {
    ownerId: owner(),
    id: uuid("id").notNull(),
    deviceId: uuid("device_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    command: jsonb("command").$type<SyncOperation>().notNull(),
    result: jsonb("result").$type<Outcome>().notNull(),
    receivedAt: at(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);
export const syncChanges = timelySchema.table(
  "sync_changes",
  {
    ownerId: owner(),
    cursor: bigint("cursor", { mode: "number" }).notNull(),
    record: jsonb("record").$type<SyncRecord>().notNull(),
    createdAt: at(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.cursor] })],
);
export const occurrenceEvents = timelySchema.table(
  "occurrence_events",
  {
    ownerId: owner(),
    operationId: uuid("operation_id").notNull(),
    occurrenceId: uuid("occurrence_id").notNull(),
    type: text("type").notNull(),
    createdAt: at(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.operationId] })],
);
export const jobOutbox = timelySchema.table(
  "job_outbox",
  {
    ownerId: owner(),
    operationId: uuid("operation_id").notNull(),
    definitionId: uuid("definition_id"),
    type: text("type").notNull(),
    attempts: integer("attempts").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: at(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.operationId] }),
    index("outbox_unprocessed").on(t.processedAt, t.createdAt),
  ],
);
export const syncSnapshots = timelySchema.table(
  "sync_snapshots",
  {
    ownerId: owner(),
    id: uuid("id").notNull(),
    watermark: bigint("watermark", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);
export const snapshotItems = timelySchema.table(
  "snapshot_items",
  {
    ownerId: owner(),
    token: uuid("token").notNull(),
    position: integer("position").notNull(),
    record: jsonb("record").$type<SyncRecord>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.token, t.position] })],
);
export const notificationDevices = timelySchema.table(
  "notification_devices",
  {
    ownerId: owner(),
    deviceId: uuid("device_id").notNull(),
    projectId: uuid("project_id").notNull(),
    environment: text("environment").notNull().default(""),
    token: text("token"),
    tokenHash: text("token_hash"),
    permission: text("permission").notNull(),
    language: text("language").notNull().default("es"),
    ready: boolean("ready").notNull().default(false),
    plannedThrough: bigint("planned_through", { mode: "number" })
      .notNull()
      .default(0),
    error: text("error"),
    updatedAt: at(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.deviceId] }),
    uniqueIndex("notification_token").on(t.tokenHash),
    foreignKey({
      columns: [t.ownerId, t.deviceId],
      foreignColumns: [syncDevices.ownerId, syncDevices.id],
    }).onDelete("cascade"),
  ],
);
export const notificationJobs = timelySchema.table(
  "notification_jobs",
  {
    ownerId: owner(),
    deviceId: uuid("device_id").notNull(),
    key: uuid("key").notNull(),
    occurrenceId: uuid("occurrence_id"),
    definitionId: uuid("definition_id"),
    version: uuid("version"),
    kind: text("kind").notNull(),
    day: date("day"),
    due: bigint("due", { mode: "number" }).notNull(),
    expires: bigint("expires", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttempt: bigint("next_attempt", { mode: "number" })
      .notNull()
      .default(0),
    receiptId: text("receipt_id"),
    receiptDue: bigint("receipt_due", { mode: "number" }),
    dispatchTokenHash: text("dispatch_token_hash"),
    startedAt: bigint("started_at", { mode: "number" }),
    error: text("error"),
    createdAt: at(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.deviceId, t.key] }),
    index("notification_due").on(t.status, t.due, t.nextAttempt),
    foreignKey({
      columns: [t.ownerId, t.deviceId],
      foreignColumns: [
        notificationDevices.ownerId,
        notificationDevices.deviceId,
      ],
    }).onDelete("cascade"),
  ],
);
