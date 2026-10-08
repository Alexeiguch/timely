import { z } from "zod";
import { civilDate, id, zone } from "./model";
export const notificationPermissionSchema = z.enum([
  "granted",
  "denied",
  "undetermined",
]);
export const expoPushTokenSchema = z
  .string()
  .max(256)
  .regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/);
export const notificationRegistrationSchema = z
  .object({
    deviceId: id,
    projectId: id,
    token: expoPushTokenSchema.nullable(),
    platform: z.enum(["ios", "android"]),
    zone,
    language: z.enum(["es", "en"]),
    permission: notificationPermissionSchema,
    keys: z.array(id).max(48),
  })
  .strict()
  .refine(
    (value) => value.permission !== "granted" || value.token !== null,
    "A permitted device needs its push token",
  );
export const localCoverageEntrySchema = z
  .object({
    key: id,
    occurrenceId: id,
    version: id,
    kind: z.enum(["before", "overdue"]),
    due: z.number().int().nonnegative(),
    day: civilDate,
  })
  .strict();
export const notificationCoverageSchema = z
  .object({
    deviceId: id,
    cursor: z.number().int().nonnegative(),
    entries: z.array(localCoverageEntrySchema).max(48),
    handled: z.array(id).max(512),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.key)).size ===
      value.entries.length,
    "Coverage identities must be unique",
  );
export const notificationDeviceRequestSchema = z
  .object({ deviceId: id })
  .strict();
export type NotificationRegistration = z.infer<
  typeof notificationRegistrationSchema
>;
export type LocalCoverageEntry = z.infer<typeof localCoverageEntrySchema>;
export type NotificationCoverage = z.infer<typeof notificationCoverageSchema>;
