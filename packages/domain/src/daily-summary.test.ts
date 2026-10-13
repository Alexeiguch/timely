import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newTask, createSeries, DailySummary, instant } from "./index";
const policy = { enabled: true, time: "18:00" };
const zone = "Europe/London";
const now = instant("2026-10-12", "09:00", zone);
function record(day = "2026-10-12", time: string | null = null) {
  const task = newTask(randomUUID(), day);
  task.title = "A private title";
  task.notes = "Never include this in a summary";
  task.schedule.time = time;
  return createSeries(task, randomUUID());
}
it("groups eligible plans into one summary without requiring per-task reminders", () => {
  const plans = DailySummary.plans(
    [
      record(),
      record(undefined, "17:00"),
      record(undefined, "19:00"),
      record("2026-10-11"),
    ],
    policy,
    zone,
    now,
  );
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({
    count: 2,
    day: "2026-10-12",
    due: instant("2026-10-12", "18:00", zone),
  });
  expect(JSON.stringify(plans)).not.toMatch(/private title|Never include/);
});
it("stays quiet for deleted tasks and disabled summaries", () => {
  const source = record();
  source.deleted = true;
  expect(DailySummary.plans([source], policy, zone, now)).toEqual([]);
  expect(
    DailySummary.plans([record()], { ...policy, enabled: false }, zone, now),
  ).toEqual([]);
});
it("never schedules a missed summary retroactively and handles civil-day DST changes", () => {
  expect(
    DailySummary.plans(
      [record()],
      policy,
      zone,
      instant("2026-10-12", "18:00", zone),
    ),
  ).toEqual([]);
  expect(
    DailySummary.plans(
      [record()],
      policy,
      zone,
      instant("2026-10-12", "23:00", zone),
    ),
  ).toEqual([]);
  for (const [day, utc] of [
    ["2026-10-24", "2026-10-24T17:00:00.000Z"],
    ["2026-10-25", "2026-10-25T18:00:00.000Z"],
  ]) {
    const plan = DailySummary.plans(
      [record(day)],
      policy,
      zone,
      instant(day!, "09:00", zone),
    )[0]!;
    expect(new Date(plan.due).toISOString()).toBe(utc);
  }
});
it("keeps content changes under one delivery identity, but changes the schedule version for a new time", () => {
  const a = record();
  const first = DailySummary.plans([a], policy, zone, now)[0]!;
  const second = DailySummary.plans([a, record()], policy, zone, now)[0]!;
  expect(second.count).toBe(2);
  expect(second.version).toBe(first.version);
  const moved = DailySummary.plans(
    [a],
    { enabled: true, time: "19:00" },
    zone,
    now,
  )[0]!;
  expect(moved.occurrenceId).toBe(first.occurrenceId);
  expect(moved.version).not.toBe(first.version);
});
