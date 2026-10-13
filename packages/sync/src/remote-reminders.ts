import {
  addDays,
  planReminders,
  projectSeries,
  reminderIdentity,
  today,
  DailySummary,
  type TaskReminderPlan,
  type DailySummaryPlan,
} from "@timely/domain";
import {
  dailySummaryDefaults,
  type DailySummaryPolicy,
  type Occurrence,
  type Preferences,
  type TaskRecord,
} from "@timely/contracts";
import { reduceRecord } from "./records";
type TaskCandidate = {
  item: Occurrence;
  day: string;
  plan: TaskReminderPlan;
  key: string;
  expires: number;
};
type SummaryCandidate = {
  item: null;
  day: string;
  plan: DailySummaryPlan;
  key: string;
  expires: number;
};
export function remoteReminderCandidates(
  records: TaskRecord[],
  preferences: Preferences,
  deviceId: string,
  zone: string,
  now: number,
): TaskCandidate[];
export function remoteReminderCandidates(
  records: TaskRecord[],
  preferences: Preferences,
  deviceId: string,
  zone: string,
  now: number,
  summary: DailySummaryPolicy,
): (TaskCandidate | SummaryCandidate)[];
export function remoteReminderCandidates(
  records: TaskRecord[],
  preferences: Preferences,
  deviceId: string,
  zone: string,
  now: number,
  summary: DailySummaryPolicy = dailySummaryDefaults,
) {
  const day = today(zone, now);
  const series = records.map(reduceRecord);
  const tasks = series
    .flatMap((record) =>
      projectSeries(record, addDays(day, -8), addDays(day, 8)),
    )
    .flatMap((item) =>
      planReminders(item, preferences, zone, now - 60000).map((plan) => ({
        item,
        day: item.schedule.date,
        plan,
        key: reminderIdentity(deviceId, plan),
        expires: plan.due + (plan.kind === "before" ? 60000 : 3600000),
      })),
    )
    .filter(
      (entry) => entry.plan.due <= now + 7 * 86400000 && entry.expires > now,
    );
  const summaries = DailySummary.plans(
    series,
    summary,
    zone,
    now - DailySummary.grace,
    now + 7 * 86400000,
  )
    .map((plan) => ({
      item: null,
      day: plan.day,
      plan,
      key: reminderIdentity(deviceId, plan),
      expires: plan.due + DailySummary.grace,
    }))
    .filter((entry) => entry.expires > now);
  return [...tasks, ...summaries];
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
