import {
  civilDate,
  weekday,
  type Occurrence,
  type Rule,
  type Task,
} from "@timely/contracts";
import { addDays, date } from "./time";
export type PlannerMode = "Day" | "Week" | "Month";
export const calendarBounds = { from: "1900-01-01", through: "2100-12-31" };
export function clampDay(day: string) {
  return day < calendarBounds.from
    ? calendarBounds.from
    : day > calendarBounds.through
      ? calendarBounds.through
      : day;
}
export function periodWindow(day: string, mode: PlannerMode, firstWeekday = 1) {
  civilDate.parse(day);
  weekday.parse(firstWeekday);
  const value = date(day);
  const start =
    mode === "Day"
      ? day
      : mode === "Week"
        ? addDays(day, -((value.dayOfWeek - firstWeekday + 7) % 7))
        : value.with({ day: 1 }).toString();
  const end =
    mode === "Day"
      ? day
      : mode === "Week"
        ? addDays(start, 6)
        : value.with({ day: value.daysInMonth }).toString();
  return { from: clampDay(start), through: clampDay(end) };
}
export function adjacentPeriod(
  day: string,
  mode: PlannerMode,
  direction: number,
) {
  return clampDay(
    mode === "Month"
      ? date(day).add({ months: direction }).toString()
      : addDays(day, direction * (mode === "Week" ? 7 : 1)),
  );
}
export function calendarDays(
  day: string,
  firstWeekday = 1,
): Array<string | null> {
  weekday.parse(firstWeekday);
  const first = date(day).with({ day: 1 });
  const days: Array<string | null> = Array(
    (first.dayOfWeek - firstWeekday + 7) % 7,
  ).fill(null);
  for (let d = 1; d <= first.daysInMonth; d++)
    days.push(first.with({ day: d }).toString());
  while (days.length % 7) days.push(null);
  return days;
}
export function compareOccurrences(a: Occurrence, b: Occurrence) {
  return (
    a.schedule.date.localeCompare(b.schedule.date) ||
    (a.schedule.time ?? "99:99").localeCompare(b.schedule.time ?? "99:99") ||
    a.order.localeCompare(b.order) ||
    a.id.localeCompare(b.id)
  );
}
export function newTask(id: string, day: string): Task {
  return {
    id,
    title: "",
    notes: "",
    priority: null,
    schedule: { date: civilDate.parse(day), time: null, duration: null },
    reminders: { enabled: false, before: true, overdue: true },
    rule: null,
  };
}
export function recurrencePreset(
  preset: "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly",
  day: string,
): Rule | null {
  if (preset === "none") return null;
  const value = date(civilDate.parse(day));
  const common = {
    anchor: day,
    interval: 1,
    end: { kind: "never" as const },
    invalidDate: "clamp" as const,
  };
  if (preset === "daily") return { ...common, frequency: "daily" };
  if (preset === "weekdays" || preset === "weekly")
    return {
      ...common,
      frequency: "weekly",
      weekdays: preset === "weekdays" ? [1, 2, 3, 4, 5] : [value.dayOfWeek],
      firstWeekday: 1,
    };
  const selector = { kind: "days" as const, days: [value.day] };
  return preset === "monthly"
    ? { ...common, frequency: "monthly", selector }
    : { ...common, frequency: "yearly", month: value.month, selector };
}
