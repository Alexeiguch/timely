import { Temporal } from "@js-temporal/polyfill";
import type { Occurrence, Preferences, Task } from "@timely/contracts";
export const date = (value: string) => Temporal.PlainDate.from(value);
export const addDays = (value: string, count: number) =>
  date(value).add({ days: count }).toString();
export const today = (zone: string, now = Date.now()) =>
  Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
export function instant(day: string, time: string, zone: string) {
  return date(day)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime(zone, { disambiguation: "compatible" }).epochMilliseconds;
}
export function boundaries(schedule: Task["schedule"], zone: string) {
  const start =
    schedule.time === null ? null : instant(schedule.date, schedule.time, zone);
  const due =
    start === null
      ? instant(addDays(schedule.date, 1), "00:00", zone)
      : start + (schedule.duration ?? 0) * 60000;
  return { start, due };
}
export function status(occurrence: Occurrence, zone: string, now: number) {
  if (occurrence.state !== "pending") return occurrence.state;
  const { start, due } = boundaries(occurrence.schedule, zone);
  if (now >= due) return "overdue";
  if (start !== null && now >= start) return "in progress";
  return "upcoming";
}
export function setState(
  occurrence: Occurrence,
  state: Occurrence["state"],
  zone: string,
  now: number,
): Occurrence {
  return {
    ...occurrence,
    state,
    terminal:
      state === "pending"
        ? null
        : {
            title: occurrence.title,
            schedule: { ...occurrence.schedule },
            originalDate: occurrence.originalDate,
            zone,
            at: Temporal.Instant.fromEpochMilliseconds(now).toString(),
            state,
          },
  };
}
export function move(occurrence: Occurrence, day: string): Occurrence {
  return { ...occurrence, schedule: { ...occurrence.schedule, date: day } };
}
export function progress(
  occurrences: Occurrence[],
  zone: string,
  now: number,
  elapsedOnly = false,
) {
  const eligible = occurrences.filter(
    (o) =>
      !o.deleted &&
      o.state !== "skipped" &&
      (!elapsedOnly ||
        boundaries(o.terminal?.schedule ?? o.schedule, o.terminal?.zone ?? zone)
          .due <= now),
  );
  const completed = eligible.filter((o) => o.state === "completed").length;
  return {
    completed,
    total: eligible.length,
    ratio: eligible.length ? completed / eligible.length : null,
  };
}
export type ReminderPlan = {
  occurrenceId: string;
  kind: "before" | "overdue";
  due: number;
  version: string;
};
export function planReminders(
  occurrence: Occurrence,
  preferences: Preferences,
  zone: string,
  now: number,
): ReminderPlan[] {
  if (
    occurrence.deleted ||
    occurrence.state !== "pending" ||
    !occurrence.reminders.enabled
  )
    return [];
  const { start, due } = boundaries(occurrence.schedule, zone);
  const version = JSON.stringify([
    occurrence.id,
    occurrence.schedule,
    occurrence.reminders,
    preferences,
    zone,
  ]);
  const before =
    start === null
      ? instant(occurrence.schedule.date, preferences.morning, zone)
      : start - preferences.beforeMinutes * 60000;
  const overdue =
    start === null
      ? instant(addDays(occurrence.schedule.date, 1), preferences.morning, zone)
      : due + preferences.overdueMinutes * 60000;
  const plans: ReminderPlan[] = [];
  if (occurrence.reminders.before && preferences.before && before > now)
    plans.push({
      occurrenceId: occurrence.id,
      kind: "before",
      due: before,
      version,
    });
  if (
    occurrence.reminders.overdue &&
    preferences.overdue &&
    overdue >= now - 3600000
  )
    plans.push({
      occurrenceId: occurrence.id,
      kind: "overdue",
      due: overdue,
      version,
    });
  return plans;
}

/** Format civil fields only. Temporal's Intl bridge is unreliable on Hermes.
 * UTC is a formatting carrier, never the task's scheduling time zone. */
export function formatCivilDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
) {
  const civil = date(value);
  const carrier = new Date(0);
  carrier.setUTCFullYear(civil.year, civil.month - 1, civil.day);
  carrier.setUTCHours(12, 0, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
    calendar: "gregory",
  }).format(carrier);
}
