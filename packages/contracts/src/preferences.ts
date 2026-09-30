import { z } from "zod";
import { id, preferencesSchema, stampSchema } from "./model";

// Calendar layout, month representation and reminder policy are independent groups.
export const preferencePatchSchema = z
  .object({
    firstWeekday: preferencesSchema.shape.firstWeekday.optional(),
    grouped: preferencesSchema.shape.grouped.optional(),
    reminders: preferencesSchema
      .pick({
        morning: true,
        beforeMinutes: true,
        overdueMinutes: true,
        before: true,
        overdue: true,
      })
      .optional(),
  })
  .strict()
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    "Choose a preference to change",
  );
export const preferenceOperationSchema = z
  .object({
    protocolVersion: z.literal(1),
    id,
    deviceId: id,
    definitionId: z.literal("preferences"),
    stamp: stampSchema,
    createdAt: z.iso.datetime(),
    command: z
      .object({ type: z.literal("preferences"), patch: preferencePatchSchema })
      .strict(),
  })
  .strict()
  .refine(
    (o) => o.id === o.stamp.operationId && o.deviceId === o.stamp.deviceId,
    "Operation identity must match its stamp",
  );
export const preferenceRecordSchema = z
  .object({
    id: z.literal("preferences"),
    operations: z.array(preferenceOperationSchema).min(1),
  })
  .strict();
export type PreferencePatch = z.infer<typeof preferencePatchSchema>;
export type PreferenceOperation = z.infer<typeof preferenceOperationSchema>;
export type PreferenceRecord = z.infer<typeof preferenceRecordSchema>;
