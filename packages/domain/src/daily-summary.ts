import { v5 } from "uuid";
import type { DailySummaryPolicy } from "@timely/contracts";
import { projectSeries, type Series } from "./series";
import {
  addDays,
  boundaries,
  instant,
  today,
  type DailySummaryPlan,
} from "./time";

/** A finite, state-aware daily nudge, never a repeating OS alarm or overdue backlog. */
export class DailySummary {
  static readonly grace = 5 * 60000;
  static plans(
    series: Series[],
    policy: DailySummaryPolicy,
    zone: string,
    now: number,
    horizon = now + 7 * 86400000,
  ): DailySummaryPlan[] {
    if (!policy.enabled) return [];
    const from = today(zone, now);
    const through = addDays(from, 8);
    const items = series.flatMap((record) =>
      projectSeries(record, from, through),
    );
    const plans: DailySummaryPlan[] = [];
    for (let offset = 0; offset <= 8; offset++) {
      const day = addDays(from, offset);
      const due = instant(day, policy.time, zone);
      if (due <= now || due > horizon) continue;
      const count = items.filter(
        (item) =>
          !item.deleted &&
          item.state === "pending" &&
          item.schedule.date === day &&
          (boundaries(item.schedule, zone).start ?? due) <= due,
      ).length;
      if (!count) continue;
      // Content changes keep the same delivery identity; timing/zone changes invalidate scheduling.
      const occurrenceId = v5(
        `daily-summary:${day}`,
        "31b8d850-e3b1-4d28-8f5c-827595f39725",
      );
      const version = v5(
        JSON.stringify([day, policy.time, zone]),
        "31b8d850-e3b1-4d28-8f5c-827595f39725",
      );
      plans.push({ kind: "summary", occurrenceId, version, day, count, due });
    }
    return plans;
  }
  static message(count: number) {
    return count === 1
      ? {
          message: "One plan is still open today. A small step is enough.",
          parameters: {},
        }
      : {
          message: "{v0} plans are still open today. Pick one small step.",
          parameters: { v0: count },
        };
  }
}
