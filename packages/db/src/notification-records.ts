import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { recordSchema, preferenceRecordSchema } from "@timely/contracts";
import {
  CommandError,
  reducePreferences,
  remoteReminderCandidates,
} from "@timely/sync";
import type { PlannerTransaction as Tx } from "./owner-lock";
import * as t from "./planner-schema";
/** Canonical notification reads and bounded writes inside owner transactions. */
export class NotificationRecords {
  static readonly reversible = ["pending", "local"];
  static tokenHash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  static async snapshot(tx: Tx, ownerId: string) {
    const records = (
      await tx
        .select({ record: t.taskDefinitions.record })
        .from(t.taskDefinitions)
        .where(eq(t.taskDefinitions.ownerId, ownerId))
    ).map((row) => recordSchema.parse(row.record));
    const [preferences] = await tx
      .select()
      .from(t.userPreferences)
      .where(eq(t.userPreferences.ownerId, ownerId));
    return {
      records,
      preferences: reducePreferences(
        preferences
          ? preferenceRecordSchema.parse(preferences.record)
          : undefined,
      ),
    };
  }
  static async ownedDevice(tx: Tx, ownerId: string, deviceId: string) {
    const [device] = await tx
      .select()
      .from(t.syncDevices)
      .where(
        and(eq(t.syncDevices.ownerId, ownerId), eq(t.syncDevices.id, deviceId)),
      );
    if (!device || device.platform === "web")
      throw new CommandError(
        "FORBIDDEN",
        "Register this mobile device before enabling push.",
      );
    return device;
  }
  static jobValues(
    ownerId: string,
    deviceId: string,
    entry: ReturnType<typeof remoteReminderCandidates>[number],
  ) {
    return {
      ownerId,
      deviceId,
      key: entry.key,
      occurrenceId: entry.item.id,
      definitionId: entry.item.definitionId,
      version: entry.plan.version,
      kind: entry.plan.kind,
      day: entry.item.schedule.date,
      due: entry.plan.due,
      expires: entry.expires,
    };
  }
  static async insertJobs(
    tx: Tx,
    jobs: (typeof t.notificationJobs.$inferInsert)[],
  ) {
    for (let start = 0; start < jobs.length; start += 500)
      await tx
        .insert(t.notificationJobs)
        .values(jobs.slice(start, start + 500))
        .onConflictDoNothing();
  }
  static async updateJobStatuses(
    tx: Tx,
    ownerId: string,
    deviceId: string,
    statuses: Map<string, string[]>,
  ) {
    for (const [status, keys] of statuses)
      for (let start = 0; start < keys.length; start += 500)
        await tx
          .update(t.notificationJobs)
          .set({ status })
          .where(
            and(
              eq(t.notificationJobs.ownerId, ownerId),
              eq(t.notificationJobs.deviceId, deviceId),
              inArray(t.notificationJobs.key, keys.slice(start, start + 500)),
              inArray(
                t.notificationJobs.status,
                NotificationRecords.reversible,
              ),
            ),
          );
  }
}
