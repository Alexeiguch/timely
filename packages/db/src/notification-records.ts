import { createHash } from "node:crypto";
import { and, eq, inArray, lte, gt, or, isNotNull } from "drizzle-orm";
import {
  recordSchema,
  preferenceRecordSchema,
  dailySummarySchema,
} from "@timely/contracts";
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
  static readonly committed = [
    "dispatching",
    "ticket",
    "delivered",
    "uncertain",
    "handled",
  ];
  static summaryPolicy(device: typeof t.notificationDevices.$inferSelect) {
    return dailySummarySchema.parse({
      enabled: device.summaryEnabled,
      time: device.summaryTime,
    });
  }
  static async handledSummaryDays(
    tx: Tx,
    ownerId: string,
    deviceId: string,
    now: number,
  ) {
    const rows = await tx
      .select({ day: t.notificationJobs.day })
      .from(t.notificationJobs)
      .where(
        and(
          eq(t.notificationJobs.ownerId, ownerId),
          eq(t.notificationJobs.deviceId, deviceId),
          eq(t.notificationJobs.kind, "summary"),
          isNotNull(t.notificationJobs.day),
          gt(t.notificationJobs.expires, now - 8 * 86400000),
          // A known local schedule that has elapsed must never fall back to remote push.
          or(
            inArray(t.notificationJobs.status, NotificationRecords.committed),
            and(
              eq(t.notificationJobs.status, "local"),
              lte(t.notificationJobs.due, now),
            ),
          ),
        ),
      );
    return [...new Set(rows.flatMap((row) => (row.day ? [row.day] : [])))];
  }
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
      occurrenceId: entry.plan.occurrenceId,
      definitionId: entry.item?.definitionId ?? null,
      version: entry.plan.version,
      kind: entry.plan.kind,
      day: entry.day,
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
