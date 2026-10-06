import { z } from "zod";
import { id } from "./model";
import { syncOperationSchema, syncRecordSchema } from "./commands";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const localStateSchema = z.object({
  version: z.literal(1), ownerId: z.string().min(1), deviceId: id,
  clock: z.object({ physical: integer, logical: integer, offset: z.number().int() }).strict(),
  shadows: z.record(z.string(), syncRecordSchema),
  outbox: z.array(z.object({ operation: syncOperationSchema, attempts: integer, retryAt: integer, error: z.string().optional() }).strict()),
  cursor: integer, bootstrapped: z.boolean(), lastSync: integer.nullable(),
  staging: z.object({ token: id, watermark: integer, after: integer, records: z.record(z.string(), syncRecordSchema) }).strict().nullable(),
  reminders: z.object({
    retry: z.boolean(), permission: z.enum(["granted", "denied", "undetermined"]),
    mappings: z.record(z.string(), z.object({ nativeId: z.string(), occurrenceId: id, kind: z.enum(["before", "overdue"]), version: id, due: integer, day: z.string() }).strict()),
    handled: z.record(z.string(), integer), scheduled: integer, uncovered: integer, horizon: integer, reconciledAt: integer.nullable(),
  }).strict().optional(),
}).strict().refine((state) =>
  Object.entries(state.shadows).every(([key, record]) => key === record.id) && state.outbox.every((pending) => pending.operation.deviceId === state.deviceId),
  "Local entity/device identities must match their namespace");
