import type { Occurrence } from "@timely/contracts";
import { projectSeries, type Series } from "./series";
import { addDays, boundaries, today } from "./time";

export type StreakMark = {
  id: string;
  date: string;
  outcome: "completed" | "missed" | "waiting";
};
export type Streak = {
  count: number;
  ended: boolean;
  missedDate: string | null;
  recent: StreakMark[];
};

export function streakOutcome(
  item: Occurrence,
  zone: string,
  now: number,
): StreakMark["outcome"] {
  if (item.state === "skipped") return "missed";
  if (item.state === "completed" && item.terminal) {
    // Terminal schedule/zone are immutable, even after travel or a series edit.
    const at = Date.parse(item.terminal.at);
    return at > now
      ? "waiting"
      : at < boundaries(item.terminal.schedule, item.terminal.zone).due
        ? "completed"
        : "missed";
  }
  return now >= boundaries(item.schedule, zone).due ? "missed" : "waiting";
}

/** Consecutive scheduled occurrences, ordered by immutable source date (not moved date).
 * Walk backward in bounded windows, stopping once the current run and seven markers are known.
 * Counts are projections of durable history, never mutable counters that devices can disagree on.
 */
export function streakSummary(
  series: Series,
  from: string,
  zone: string,
  now: number,
): Streak {
  const summary: Streak = {
    count: 0,
    ended: false,
    missedDate: null,
    recent: [],
  };
  if (series.deleted) return summary;
  const currentDay = today(zone, now);
  let through = currentDay;
  const exceptions = Object.values(series.exceptions).map(
    (exception) => exception.value,
  );
  // Ordinary future slots wait for their day. A moved slot can already be due today.
  for (const item of exceptions) {
    const schedule = item.terminal?.schedule ?? item.schedule;
    if (
      item.streak?.from === from &&
      schedule.date <= currentDay &&
      item.originalDate > through &&
      (!item.terminal || Date.parse(item.terminal.at) <= now)
    )
      through = item.originalDate;
  }
  let runKnown = false;
  let latestSettled = false;
  while (through >= from) {
    const begin = addDays(through, -365) < from ? from : addDays(through, -365);
    const items = new Map(
      projectSeries(series, begin, through)
        .filter(
          (item) => item.originalDate >= begin && item.originalDate <= through,
        )
        .map((item) => [item.id, item]),
    );
    // Include moved occurrences even when their new scheduled date is outside the window.
    for (const item of exceptions)
      if (
        !item.deleted &&
        item.originalDate >= begin &&
        item.originalDate <= through &&
        (!series.deletedFrom || item.originalDate < series.deletedFrom)
      )
        items.set(item.id, item);
    for (const item of [...items.values()].sort(
      (a, b) =>
        b.originalDate.localeCompare(a.originalDate) ||
        b.id.localeCompare(a.id),
    )) {
      if (item.streak?.from !== from) continue;
      if (
        item.originalDate > currentDay &&
        (item.terminal?.schedule ?? item.schedule).date > currentDay
      )
        continue;
      const mark: StreakMark = {
        id: item.id,
        date: item.originalDate,
        outcome: streakOutcome(item, zone, now),
      };
      if (summary.recent.length < 7) summary.recent.unshift(mark);
      if (mark.outcome !== "waiting") {
        if (!latestSettled) {
          summary.ended = mark.outcome === "missed";
          latestSettled = true;
        }
        if (mark.outcome === "missed") {
          summary.missedDate ??= (
            item.terminal?.schedule ?? item.schedule
          ).date;
          runKnown = true;
        } else if (!runKnown) summary.count++;
      }
    }
    if (runKnown && summary.recent.length === 7) break;
    through = addDays(begin, -1);
  }
  return summary;
}

export function streakLabel(streak: Streak): string {
  return streak.ended
    ? "Streak ended"
    : streak.count
      ? `${streak.count} in a row`
      : "Start your streak";
}

export function streakKey(
  item: Pick<Occurrence, "definitionId" | "streak">,
): string {
  return `${item.definitionId}/${item.streak?.from ?? "off"}`;
}
