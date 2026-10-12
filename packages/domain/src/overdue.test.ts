import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createSeries, projectSeries, saveException } from "./series";
import { newTask, overdueOccurrences } from "./planner";
import { instant, setState, move } from "./time";
function fixture(
  day: string,
  time: string | null = null,
  duration: number | null = null,
) {
  const task = {
    ...newTask(randomUUID(), day),
    title: "Walk",
    schedule: { date: day, time, duration },
  };
  return createSeries(task, randomUUID());
}
it("shows catch-up references only on today's Day view", () => {
  const series = fixture("2026-10-11");
  const now = instant("2026-10-12", "09:00", "Europe/London");
  expect(
    overdueOccurrences([series], "2026-10-12", "Day", "Europe/London", now),
  ).toHaveLength(1);
  for (const mode of ["Week", "Month"] as const)
    expect(
      overdueOccurrences([series], "2026-10-12", mode, "Europe/London", now),
    ).toEqual([]);
  for (const day of ["2026-10-11", "2026-10-13"])
    expect(
      overdueOccurrences([series], day, "Day", "Europe/London", now),
    ).toEqual([]);
});
it("uses shared due boundaries for overnight duration and terminal history", () => {
  const zone = "Europe/London";
  const overnight = fixture("2026-10-11", "23:30", 120);
  const completed = fixture("2026-10-10");
  const item = projectSeries(completed, "2026-10-10", "2026-10-10")[0]!;
  const terminal = saveException(completed, {
    ...item,
    ...setState(item, "completed", zone, instant("2026-10-10", "12:00", zone)),
  });
  expect(
    overdueOccurrences(
      [overnight, terminal],
      "2026-10-12",
      "Day",
      zone,
      instant("2026-10-12", "01:29", zone),
    ),
  ).toEqual([]);
  expect(
    overdueOccurrences(
      [overnight, terminal],
      "2026-10-12",
      "Day",
      zone,
      instant("2026-10-12", "01:30", zone),
    ),
  ).toHaveLength(1);
});
it("keeps moved identities and a stable ordering", () => {
  const later = fixture("2026-10-10"),
    earlier = fixture("2026-10-09");
  const original = projectSeries(later, "2026-10-10", "2026-10-10")[0]!;
  const moved = saveException(later, move(original, "2026-10-11"));
  const result = overdueOccurrences(
    [moved, earlier],
    "2026-10-12",
    "Day",
    "UTC",
    instant("2026-10-12", "09:00", "UTC"),
  );
  expect(result.map((item) => item.schedule.date)).toEqual([
    "2026-10-09",
    "2026-10-11",
  ]);
  expect(result[1]!.id).toBe(original.id);
});
it("respects local midnight through DST and a non-hour-offset zone", () => {
  for (const zone of ["Europe/London", "Asia/Kathmandu"]) {
    const series = fixture("2026-03-29");
    expect(
      overdueOccurrences(
        [series],
        "2026-03-30",
        "Day",
        zone,
        instant("2026-03-30", "00:00", zone),
      ),
    ).toHaveLength(1);
  }
});
it("clamps the supported lower bound and excludes current-day cards from catch-up", () => {
  expect(
    overdueOccurrences(
      [fixture("1900-01-01", "00:00")],
      "1900-01-01",
      "Day",
      "UTC",
      instant("1900-01-01", "12:00", "UTC"),
    ),
  ).toEqual([]);
});
