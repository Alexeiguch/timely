import { z } from "zod";
import {
  civilDate,
  contentSchema,
  id,
  preferencesSchema,
  reminderPolicySchema,
  ruleSchema,
  scheduleSchema,
  stampSchema,
  taskSchema,
  zone,
} from "./model";

export const targetSchema = z
  .object({
    id,
    revisionId: id,
    slot: z.string().min(1).max(100),
    originalDate: civilDate,
  })
  .strict();
export const patchSchema = contentSchema
  .partial()
  .extend({
    schedule: scheduleSchema.optional(),
    reminders: reminderPolicySchema.optional(),
    rule: ruleSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Choose at least one field",
  );
export const terminalSchema = z
  .object({
    title: contentSchema.shape.title,
    schedule: scheduleSchema,
    originalDate: civilDate,
    zone,
    at: z.iso.datetime(),
    state: z.enum(["completed", "skipped"]),
  })
  .strict();
const scope = z.enum(["occurrence", "future", "series"]);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), task: taskSchema }).strict(),
  z
    .object({
      type: z.literal("edit"),
      target: targetSchema,
      scope,
      patch: patchSchema,
      currentDay: civilDate,
    })
    .strict(),
  z
    .object({
      type: z.literal("state"),
      target: targetSchema,
      state: z.enum(["pending", "completed", "skipped"]),
      terminal: terminalSchema.nullable(),
    })
    .strict()
    .refine(
      (c) =>
        c.state === "pending"
          ? c.terminal === null
          : c.terminal?.state === c.state &&
            c.terminal.originalDate === c.target.originalDate,
      "State and terminal snapshot must match",
    ),
  z.object({ type: z.literal("delete"), target: targetSchema, scope }).strict(),
  z
    .object({
      type: z.literal("restore"),
      target: targetSchema,
      scope: z.enum(["occurrence", "series"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("order"),
      target: targetSchema,
      order: z.string().max(128),
    })
    .strict(),
]);
export const operationSchema = z
  .object({
    protocolVersion: z.literal(1),
    id,
    deviceId: id,
    definitionId: id,
    stamp: stampSchema,
    createdAt: z.iso.datetime(),
    command: commandSchema,
  })
  .strict()
  .refine(
    (o) =>
      o.id === o.stamp.operationId &&
      o.deviceId === o.stamp.deviceId &&
      (o.command.type !== "create" || o.definitionId === o.command.task.id),
    "Operation identity must match its stamp and target",
  );
export type Operation = z.infer<typeof operationSchema>;
export type Command = z.infer<typeof commandSchema>;
export type Target = z.infer<typeof targetSchema>;
// The canonical journal is per definition, never the account-wide audit trail.
export const recordSchema = z
  .object({ id, operations: z.array(operationSchema).min(1) })
  .strict();
export type TaskRecord = z.infer<typeof recordSchema>;
export const pushSchema = z
  .object({
    protocolVersion: z.literal(1),
    deviceId: id,
    operations: z.array(operationSchema).min(1).max(100),
  })
  .strict()
  .refine(
    (p) => p.operations.every((o) => o.deviceId === p.deviceId),
    "Batch device must match every operation",
  );
export const changeSchema = z
  .object({
    cursor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    record: recordSchema,
  })
  .strict();
export const outcomeSchema = z
  .object({
    id,
    disposition: z.enum(["applied", "superseded"]),
    stamp: stampSchema,
    record: recordSchema,
    cursor: z.number().int().nonnegative(),
  })
  .strict();
export const pushResponseSchema = z
  .object({
    results: z.array(outcomeSchema),
    watermark: z.number().int().nonnegative(),
    serverTime: z.number(),
  })
  .strict();
export const pullResponseSchema = z
  .object({
    changes: z.array(changeSchema),
    cursor: z.number().int().nonnegative(),
    more: z.boolean(),
    serverTime: z.number(),
  })
  .strict();
export const bootstrapSchema = z
  .object({
    token: id.optional(),
    after: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();
export const bootstrapResponseSchema = z
  .object({
    token: id,
    records: z.array(recordSchema),
    watermark: z.number().int().nonnegative(),
    next: z.number().int().nonnegative().nullable(),
    serverTime: z.number(),
  })
  .strict();
export const deviceSchema = z
  .object({
    id,
    platform: z.enum(["web", "ios", "android"]),
    zone,
    protocolVersion: z.literal(1),
  })
  .strict();
export const windowSchema = z
  .object({ from: civilDate, through: civilDate })
  .strict();
export const preferencesCommandSchema = z
  .object({ preferences: preferencesSchema, stamp: stampSchema })
  .strict();
export type Outcome = z.infer<typeof outcomeSchema>;
