import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  adjacentPeriod,
  calendarDays,
  compareOccurrences,
  newTask,
  periodWindow,
  recurrencePreset,
} from "./planner";
import { expand, occurrence, preview } from "./recurrence";
it("keeps month navigation and projection inside the supported civil calendar", () => {
  expect(adjacentPeriod("2028-01-31", "Month", 1)).toBe("2028-02-29");
  expect(adjacentPeriod("2100-12-31", "Day", 1)).toBe("2100-12-31");
  expect(adjacentPeriod("1900-01-01", "Week", -1)).toBe("1900-01-01");
  expect(periodWindow("2100-12-31", "Week")).toEqual({
    from: "2100-12-27",
    through: "2100-12-31",
  });
  expect(periodWindow("2026-09-30", "Week", 7)).toEqual({
    from: "2026-09-27",
    through: "2026-10-03",
  });
});
it("aligns a leap-year calendar to Monday and gives every date exactly once", () => {
  const days = calendarDays("2028-02-14");
  expect(days[0]).toBeNull();
  expect(days[1]).toBe("2028-02-01");
  expect(days.filter(Boolean)).toHaveLength(29);
  expect(days.length % 7).toBe(0);
});
it("uses the same recurrence engine for presets, invalid-date preview and emitted slots", () => {
  const rule = recurrencePreset("monthly", "2028-01-31")!;
  expect(preview(rule, rule.anchor, 3).map((s) => s.date)).toEqual([
    "2028-01-31",
    "2028-02-29",
    "2028-03-31",
  ]);
  expect(
    expand({ ...rule, invalidDate: "skip" }, "2028-02-01", "2028-03-31").map(
      (s) => s.date,
    ),
  ).toEqual(["2028-03-31"]);
  const weekdays = recurrencePreset("weekdays", "2026-10-02")!;
  expect(preview(weekdays, weekdays.anchor, 3).map((s) => s.date)).toEqual([
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
  ]);
});
it("sorts by civil date, timed start, then saved manual order without priority reshuffling", () => {
  const task = newTask(randomUUID(), "2026-09-29");
  const base = occurrence(task, randomUUID(), {
    date: task.schedule.date,
    key: "single",
  });
  const first = {
    ...base,
    id: randomUUID(),
    order: "a",
    priority: "low" as const,
  };
  const second = {
    ...base,
    id: randomUUID(),
    order: "b",
    priority: "high" as const,
  };
  const timed = {
    ...base,
    id: randomUUID(),
    schedule: { ...base.schedule, time: "23:59" },
  };
  expect([second, timed, first].sort(compareOccurrences)).toEqual([
    timed,
    first,
    second,
  ]);
});

// Use a Date carrier rather than passing polyfilled Temporal values to native Intl.
it("formats civil dates without shifting the authored day or using Temporal's Intl bridge", async () => {
  const { formatCivilDate } = await import("./time");
  expect(
    formatCivilDate("2028-02-29", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Pacific/Kiritimati",
    }),
  ).toBe("Tuesday, 29 February 2028");
  expect(
    formatCivilDate("1900-01-01", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  ).toBe("1 Jan 1900");
  expect(() => formatCivilDate("2028-02-30", {})).toThrow();
});

it("aligns all first-weekday choices without modifying stored recurrence anchors", () => {
  const rule = recurrencePreset("weekly", "2026-09-30")!;
  const original = structuredClone(rule);
  for (let first = 1; first <= 7; first++) {
    const days = calendarDays("2026-10-14", first);
    expect(days.indexOf("2026-10-01")).toBe((4 - first + 7) % 7);
    expect(days.filter(Boolean)).toHaveLength(31);
    expect(days.length % 7).toBe(0);
    periodWindow("2026-10-14", "Week", first);
  }
  expect(rule).toEqual(original);
  expect(() => calendarDays("2026-10-14", 0)).toThrow();
});
