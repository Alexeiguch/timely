import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  taskSchema,
  type Command,
  type Operation,
  type TaskRecord,
} from "@timely/contracts";
import { projectSeries, setState } from "@timely/domain";
import { appendOperation, occurrenceTarget, reduceRecord } from "./records";
const deviceId = randomUUID();
export const task = taskSchema.parse({
  id: randomUUID(),
  title: "Walk outside",
  notes: "",
  priority: null,
  schedule: { date: "2026-09-29", time: "09:00", duration: 20 },
  reminders: { enabled: false, before: true, overdue: true },
  rule: null,
});
export function operation(
  definitionId: string,
  command: Command,
  physical = 1000,
): Operation {
  const id = randomUUID();
  return {
    protocolVersion: 1,
    id,
    deviceId,
    definitionId,
    createdAt: "2026-09-29T10:00:00.000Z",
    stamp: { physical, logical: 0, deviceId, operationId: id },
    command,
  };
}
function first(record: TaskRecord) {
  return projectSeries(reduceRecord(record), "2026-09-29", "2026-10-05")[0]!;
}
describe("canonical task journals", () => {
  it("merges independent fields and picks the latest schedule regardless of arrival order", () => {
    const create = operation(task.id, { type: "create", task });
    const record = appendOperation(undefined, create);
    const target = occurrenceTarget(first(record));
    const title = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "occurrence",
        patch: { title: "New title" },
        currentDay: "2026-09-29",
      },
      3000,
    );
    const notes = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "occurrence",
        patch: { notes: "Remember shoes" },
        currentDay: "2026-09-29",
      },
      2000,
    );
    const move1 = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "occurrence",
        patch: { schedule: { date: "2026-09-30", time: null, duration: null } },
        currentDay: "2026-09-29",
      },
      4000,
    );
    const move2 = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "occurrence",
        patch: {
          schedule: { date: "2026-10-01", time: "10:00", duration: 60 },
        },
        currentDay: "2026-09-29",
      },
      5000,
    );
    const a = [title, notes, move1, move2].reduce(appendOperation, record);
    const b = [move2, notes, title, move1].reduce(appendOperation, record);
    expect(reduceRecord(a)).toEqual(reduceRecord(b));
    expect(first(a)).toMatchObject({
      title: "New title",
      notes: "Remember shoes",
      schedule:
        move2.command.type === "edit"
          ? move2.command.patch.schedule
          : undefined,
      originalDate: "2026-09-29",
      id: target.id,
    });
  });
  it("retains immutable authored terminal snapshots and tombstones across late edits", () => {
    const record = appendOperation(
      undefined,
      operation(task.id, { type: "create", task }),
    );
    const item = first(record),
      target = occurrenceTarget(item);
    const terminal = setState(
      item,
      "completed",
      "Europe/London",
      Date.parse("2026-09-29T12:00Z"),
    ).terminal;
    const complete = operation(
      task.id,
      { type: "state", target, state: "completed", terminal },
      3000,
    );
    const late = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "occurrence",
        patch: { title: "Earlier rename" },
        currentDay: "2026-09-29",
      },
      2000,
    );
    const result = appendOperation(appendOperation(record, complete), late);
    expect(first(result).terminal).toEqual(terminal);
    const deleted = appendOperation(
      result,
      operation(task.id, { type: "delete", target, scope: "series" }, 4000),
    );
    const edited = appendOperation(
      deleted,
      operation(
        task.id,
        {
          type: "edit",
          target,
          scope: "series",
          patch: { priority: "high" },
          currentDay: "2026-09-29",
        },
        5000,
      ),
    );
    expect(
      projectSeries(reduceRecord(edited), "2026-09-29", "2026-09-30"),
    ).toEqual([]);
    expect(
      first(
        appendOperation(
          edited,
          operation(
            task.id,
            { type: "restore", target, scope: "series" },
            6000,
          ),
        ),
      ).state,
    ).toBe("completed");
  });
  it("converges competing recurrence edits with offline completion without duplicate work", () => {
    const recurring = {
      ...task,
      rule: {
        frequency: "daily" as const,
        anchor: "2026-09-29",
        interval: 1,
        end: { kind: "never" as const },
        invalidDate: "clamp" as const,
      },
    };
    const record = appendOperation(
      undefined,
      operation(task.id, { type: "create", task: recurring }),
    );
    const original = projectSeries(
      reduceRecord(record),
      "2026-09-29",
      "2026-10-05",
    );
    const target = occurrenceTarget(original[1]!);
    const edit1 = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "future",
        patch: { rule: { ...recurring.rule, interval: 2 } },
        currentDay: "2026-09-29",
      },
      2000,
    );
    const edit2 = operation(
      task.id,
      {
        type: "edit",
        target,
        scope: "future",
        patch: { rule: { ...recurring.rule, interval: 3 } },
        currentDay: "2026-09-29",
      },
      3000,
    );
    const completed = setState(
      original[4]!,
      "completed",
      "UTC",
      Date.parse("2026-10-03T12:00Z"),
    );
    const complete = operation(
      task.id,
      {
        type: "state",
        target: occurrenceTarget(completed),
        state: "completed",
        terminal: completed.terminal,
      },
      4000,
    );
    const a = [edit1, edit2, complete].reduce(appendOperation, record);
    const b = [complete, edit2, edit1].reduce(appendOperation, record);
    expect(reduceRecord(a)).toEqual(reduceRecord(b));
    const items = projectSeries(reduceRecord(a), "2026-10-03", "2026-10-03");
    expect(items).toHaveLength(1);
    expect(items[0]!.terminal).toEqual(completed.terminal);
  });
  it("rejects fabricated occurrence IDs", () => {
    const record = appendOperation(
      undefined,
      operation(task.id, { type: "create", task }),
    );
    const target = { ...occurrenceTarget(first(record)), id: randomUUID() };
    expect(() =>
      appendOperation(
        record,
        operation(task.id, { type: "delete", scope: "occurrence", target }),
      ),
    ).toThrow("identity");
  });
});
it('ordinary series edits cannot resurrect a deleted future range', () => {
  const recurring = { ...task, rule: { frequency: 'daily' as const, anchor: '2026-09-29', interval: 1, end: { kind: 'never' as const }, invalidDate: 'clamp' as const } };
  const record = appendOperation(undefined, operation(task.id, { type: 'create', task: recurring }));
  const selected = projectSeries(reduceRecord(record), '2026-09-30', '2026-09-30')[0]!;
  const target = occurrenceTarget(selected);
  const deleted = appendOperation(record, operation(task.id, { type: 'delete', target, scope: 'future' }, 2000));
  const edited = appendOperation(deleted, operation(task.id, { type: 'edit', target, scope: 'future', patch: { title: 'A later edit' }, currentDay: '2026-09-29' }, 3000));
  expect(projectSeries(reduceRecord(edited), '2026-09-29', '2026-10-05').map(i => i.schedule.date)).toEqual(['2026-09-29']);
});
