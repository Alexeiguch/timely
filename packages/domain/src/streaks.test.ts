import { expect, it } from "vitest";
import { taskSchema, type Task } from "@timely/contracts";
import {
  addDays,
  createSeries,
  editSeries,
  excludeOccurrence,
  instant,
  move,
  projectSeries,
  saveException,
  setState,
  streakSummary,
  type Series,
} from "./index";

const revision = "b0000000-0000-4000-8000-000000000000";
const task: Task = taskSchema.parse({
  id: "a0000000-0000-4000-8000-000000000000",
  title: "Read a little",
  notes: "",
  priority: null,
  schedule: { date: "2026-10-01", time: "20:00", duration: 30 },
  reminders: { enabled: false, before: true, overdue: true },
  streak: { from: "2026-10-01" },
  rule: {
    frequency: "daily",
    anchor: "2026-10-01",
    interval: 1,
    invalidDate: "clamp",
    end: { kind: "never" },
  },
});
const initial = createSeries(task, revision);
function complete(
  series: Series,
  day: string,
  at = `${day}T19:00:00Z`,
  zone = "Europe/London",
) {
  return saveException(
    series,
    setState(
      projectSeries(series, day, day)[0]!,
      "completed",
      zone,
      Date.parse(at),
    ),
  );
}
const summary = (
  series: Series,
  at: string,
  zone = "Europe/London",
  from = "2026-10-01",
) => streakSummary(series, from, zone, Date.parse(at));

it("does not let a future early completion conceal a missed deadline today", () => {
  const future = complete(initial, "2026-10-02", "2026-10-01T19:00Z");
  expect(summary(future, "2026-10-01T19:31Z")).toMatchObject({
    count: 0,
    ended: true,
  });
  expect(summary(future, "2026-10-02T10:00Z")).toMatchObject({
    count: 1,
    ended: false,
  });
});

it("ends a run when a future source slot is moved earlier and misses its effective deadline", () => {
  const item = projectSeries(initial, "2026-10-03", "2026-10-03")[0]!;
  const moved = saveException(initial, move(item, "2026-10-01"), ["schedule"]);
  const result = summary(moved, "2026-10-01T19:31Z");
  expect(result.ended).toBe(true);
  expect(result.missedDate).toBe("2026-10-01");
  expect(result.recent.find((mark) => mark.id === item.id)?.outcome).toBe(
    "missed",
  );
});

it("keeps a run while the next occurrence is pending, ends at the exact deadline, and restarts", () => {
  const two = complete(complete(initial, "2026-10-01"), "2026-10-02");
  expect(summary(two, "2026-10-03T19:29:59Z")).toMatchObject({
    count: 2,
    ended: false,
  });
  expect(summary(two, "2026-10-03T19:30:00Z")).toMatchObject({
    count: 0,
    ended: true,
    missedDate: "2026-10-03",
  });
  const next = complete(two, "2026-10-04");
  expect(summary(next, "2026-10-04T19:01Z")).toMatchObject({
    count: 1,
    ended: false,
  });
});

it("late completion and equality cannot rescue a missed deadline", () => {
  for (const at of ["2026-10-01T19:30:00Z", "2026-10-01T20:00:00Z"])
    expect(
      summary(complete(initial, "2026-10-01", at), "2026-10-01T21:00Z"),
    ).toMatchObject({ count: 0, ended: true });
});

it("uses terminal time zone/schedule after travel, schedule edits and Undo", () => {
  const done = complete(initial, "2026-10-01", "2026-10-01T19:29:59Z");
  const item = projectSeries(done, "2026-10-01", "2026-10-01")[0]!;
  const edited = saveException(
    done,
    { ...item, schedule: { ...item.schedule, time: "00:01" } },
    ["schedule"],
  );
  expect(summary(edited, "2026-10-01T21:00Z", "America/New_York").count).toBe(
    1,
  );
  const reopened = saveException(
    edited,
    setState(item, "pending", "UTC", Date.parse("2026-10-01T21:00Z")),
  );
  expect(summary(reopened, "2026-10-01T21:00Z").ended).toBe(true);
});

it("moves deadlines but keeps original cadence order and includes moved exceptions outside their window", () => {
  const first = projectSeries(initial, "2026-10-01", "2026-10-01")[0]!;
  const moved = move(first, "2026-10-04");
  let series = saveException(initial, moved, ["schedule"]);
  expect(summary(series, "2026-10-01T21:00Z")).toMatchObject({
    count: 0,
    ended: false,
  });
  series = complete(series, "2026-10-02");
  series = complete(series, "2026-10-03");
  series = saveException(
    series,
    setState(
      moved,
      "completed",
      "Europe/London",
      Date.parse("2026-10-04T19:00Z"),
    ),
  );
  expect(summary(series, "2026-10-04T19:01Z").count).toBe(3);
});

it("uses civil midnight on DST days for untimed tasks and elapsed minutes for durations", () => {
  const dst = createSeries(
    {
      ...task,
      schedule: { date: "2026-10-25", time: null, duration: null },
      streak: { from: "2026-10-25" },
      rule: { ...task.rule!, frequency: "daily", anchor: "2026-10-25" },
    },
    revision,
  );
  expect(
    summary(dst, "2026-10-25T23:59:59Z", "Europe/London", "2026-10-25").ended,
  ).toBe(false);
  expect(
    summary(dst, "2026-10-26T00:00Z", "Europe/London", "2026-10-25").ended,
  ).toBe(true);
  const spring = createSeries(
    {
      ...task,
      schedule: { date: "2026-03-29", time: "00:30", duration: 120 },
      streak: { from: "2026-03-29" },
      rule: { ...task.rule!, frequency: "daily", anchor: "2026-03-29" },
    },
    revision,
  );
  const done = complete(spring, "2026-03-29", "2026-03-29T02:29:59Z");
  expect(
    summary(done, "2026-03-29T02:30Z", "Europe/London", "2026-03-29").count,
  ).toBe(1);
});

it("counts scheduled occurrences rather than calendar days and respects finite recurrence", () => {
  let series = createSeries(
    {
      ...task,
      rule: {
        ...task.rule!,
        frequency: "daily",
        interval: 2,
        end: { kind: "count", count: 2 },
      },
    },
    revision,
  );
  series = complete(complete(series, "2026-10-01"), "2026-10-03");
  expect(summary(series, "2026-10-20T21:00Z")).toMatchObject({
    count: 2,
    ended: false,
  });
});

it("does not invent a missed February occurrence for a monthly rule that skips invalid dates", () => {
  let series = createSeries(
    {
      ...task,
      schedule: { ...task.schedule, date: "2026-01-31" },
      streak: { from: "2026-01-31" },
      rule: {
        frequency: "monthly",
        anchor: "2026-01-31",
        interval: 1,
        end: { kind: "count", count: 2 },
        invalidDate: "skip",
        selector: { kind: "days", days: [31] },
      },
    },
    revision,
  );
  series = complete(complete(series, "2026-01-31"), "2026-03-31");
  expect(
    summary(series, "2026-04-01T10:00Z", "Europe/London", "2026-01-31"),
  ).toMatchObject({ count: 2, ended: false });
});

it("does not retroactively penalize a series when streak tracking starts", () => {
  const plain = createSeries({ ...task, streak: null }, revision);
  const selected = projectSeries(plain, "2026-10-04", "2026-10-04")[0]!;
  const tracked = editSeries(
    plain,
    selected,
    { ...task, streak: { from: "2026-10-04" } },
    "future",
    "c0000000-0000-4000-8000-000000000000",
    "2026-10-04",
  );
  expect(
    summary(tracked, "2026-10-04T18:00Z", "Europe/London", "2026-10-04"),
  ).toMatchObject({ count: 0, ended: false });
  expect(
    summary(
      complete(tracked, "2026-10-04"),
      "2026-10-04T19:01Z",
      "Europe/London",
      "2026-10-04",
    ).count,
  ).toBe(1);
});

it("does not treat deleted slots as missed and refuses skipping", () => {
  const selected = projectSeries(initial, "2026-10-01", "2026-10-01")[0]!;
  expect(() => setState(selected, "skipped", "UTC", Date.now())).toThrow(
    "cannot be skipped",
  );
  const series = complete(excludeOccurrence(initial, selected), "2026-10-02");
  expect(summary(series, "2026-10-02T19:01Z").count).toBe(1);
  expect(taskSchema.safeParse({ ...task, rule: null }).success).toBe(false);
});

it("crosses multiple bounded projection windows without truncating a long run", () => {
  let series = createSeries(
    {
      ...task,
      schedule: { ...task.schedule, date: "2025-09-01" },
      streak: { from: "2025-09-01" },
      rule: { ...task.rule!, frequency: "daily", anchor: "2025-09-01" },
    },
    revision,
  );
  for (let index = 0; index < 400; index++) {
    const day = addDays("2025-09-01", index);
    const item = projectSeries(series, day, day)[0]!;
    series = saveException(
      series,
      setState(
        item,
        "completed",
        "Europe/London",
        instant(day, "20:29", "Europe/London"),
      ),
    );
  }
  const last = addDays("2025-09-01", 399);
  const result = streakSummary(
    series,
    "2025-09-01",
    "Europe/London",
    instant(last, "20:31", "Europe/London"),
  );
  expect(result.count).toBe(400);
  expect(result.recent).toHaveLength(7);
});
