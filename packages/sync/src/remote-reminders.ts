import {
  addDays,
  planReminders,
  projectSeries,
  reminderIdentity,
  today,
} from "@timely/domain";
import type { Occurrence, Preferences, TaskRecord } from "@timely/contracts";
import { reduceRecord } from "./records";
export function remoteReminderCandidates(
  records: TaskRecord[],
  preferences: Preferences,
  deviceId: string,
  zone: string,
  now: number,
) {
  const day = today(zone, now);
  return records
    .flatMap((record) =>
      projectSeries(reduceRecord(record), addDays(day, -8), addDays(day, 8)),
    )
    .flatMap((item) =>
      planReminders(item, preferences, zone, now - 60000).map((plan) => ({
        item,
        plan,
        key: reminderIdentity(deviceId, plan),
        expires: plan.due + (plan.kind === "before" ? 60000 : 3600000),
      })),
    )
    .filter(
      (entry) => entry.plan.due <= now + 7 * 86400000 && entry.expires > now,
    );
}
export function reminderBody(
  item: Pick<Occurrence, "schedule">,
  kind: "before" | "overdue",
) {
  return kind === "overdue"
    ? { message: "Still on your mind" }
    : item.schedule.time
      ? { message: "Coming up at {v0}", parameters: { v0: item.schedule.time } }
      : { message: "Coming up today" };
}
