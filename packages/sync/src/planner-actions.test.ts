import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Command, Operation, TaskRecord } from "@timely/contracts";
import {
  newTask,
  projectSeries,
  recurrencePreset,
  setState,
} from "@timely/domain";
import { appendOperation, occurrenceTarget, reduceRecord } from "./records";
import {
  editableTask,
  editorCommand,
  linkedOccurrence,
} from "./planner-actions";
let clock = 1000;
function op(definitionId: string, command: Command): Operation {
  const id = randomUUID(),
    deviceId = randomUUID();
  return {
    id,
    deviceId,
    definitionId,
    protocolVersion: 1,
    createdAt: "2026-09-29T10:00:00.000Z",
    stamp: { physical: clock++, logical: 0, deviceId, operationId: id },
    command,
  };
}
const list = (record: TaskRecord) =>
  projectSeries(reduceRecord(record), "2026-09-29", "2026-10-10");
function fixture() {
  const task = {
    ...newTask(randomUUID(), "2026-09-29"),
    title: "Ten minutes outside",
    rule: recurrencePreset("daily", "2026-09-29"),
  };
  const record = appendOperation(
    undefined,
    op(task.id, { type: "create", task }),
  );
  return { task, record, item: list(record)[1]! };
}
it("one-field mobile editing preserves concurrent changes from the other client", () => {
  const { task, record, item } = fixture();
  const initial = editableTask(record, item);
  const command = editorCommand(
    initial,
    { ...initial, priority: "high" },
    item,
    "occurrence",
    "2026-09-29",
  )!;
  expect(command.type === "edit" && Object.keys(command.patch)).toEqual([
    "priority",
  ]);
  const completed = setState(
    item,
    "completed",
    "Europe/London",
    Date.parse("2026-09-30T12:00:00Z"),
  );
  const done = op(task.id, {
    type: "state",
    target: occurrenceTarget(item),
    state: "completed",
    terminal: completed.terminal,
  });
  const priority = op(task.id, command);
  const a = appendOperation(appendOperation(record, done), priority);
  const b = appendOperation(appendOperation(record, priority), done);
  expect(reduceRecord(a)).toEqual(reduceRecord(b));
  expect(list(a).find((o) => o.id === item.id)).toMatchObject({
    state: "completed",
    priority: "high",
    terminal: completed.terminal,
  });
});
it("rejects a recurrence change scoped to one occurrence and does not invent changes for a no-op save", () => {
  const { record, item } = fixture();
  const task = editableTask(record, item);
  expect(
    editorCommand(
      task,
      structuredClone(task),
      item,
      "occurrence",
      "2026-09-29",
    ),
  ).toBeNull();
  expect(() =>
    editorCommand(
      task,
      { ...task, rule: null },
      item,
      "occurrence",
      "2026-09-29",
    ),
  ).toThrow("series");
});
it.each(["occurrence", "future", "series"] as const)(
  "undoes only the specified %s deletion and retains later independent edits/deletions",
  (scope) => {
    const { task, record, item } = fixture();
    const target = occurrenceTarget(item);
    const deletion = op(task.id, { type: "delete", target, scope });
    let changed = appendOperation(record, deletion);
    const other = list(record)[0]!;
    const laterDelete = op(task.id, {
      type: "delete",
      target: occurrenceTarget(other),
      scope: "occurrence",
    });
    changed = appendOperation(changed, laterDelete);
    changed = appendOperation(
      changed,
      op(task.id, {
        type: "edit",
        target,
        scope: "occurrence",
        patch: { notes: "Saved on another device" },
        currentDay: "2026-09-29",
      }),
    );
    const undo = op(task.id, {
      type: "restore",
      target,
      scope,
      deletionId: deletion.id,
    });
    const restored = appendOperation(changed, undo);
    expect(list(restored).find((o) => o.id === other.id)).toBeUndefined();
    expect(list(restored).find((o) => o.id === item.id)?.notes).toBe(
      "Saved on another device",
    );
    expect(list(restored)).toHaveLength(list(record).length - 1);
    expect(restored.operations).toHaveLength(5);
    // Repeated delivery does not duplicate either restore or its effect.
    expect(appendOperation(restored, undo)).toEqual(restored);
    const last = op(task.id, { type: "delete", target, scope });
    expect(
      list(appendOperation(restored, last)).some((o) => o.id === item.id),
    ).toBe(false);
  },
);
it("cannot use undo to clear a different range or an unknown deletion", () => {
  const { task, record, item } = fixture();
  const target = occurrenceTarget(item);
  const deletion = op(task.id, { type: "delete", target, scope: "future" });
  const removed = appendOperation(record, deletion);
  expect(() =>
    appendOperation(
      removed,
      op(task.id, {
        type: "restore",
        target,
        scope: "series",
        deletionId: deletion.id,
      }),
    ),
  ).toThrow("matching deletion");
  expect(() =>
    appendOperation(
      removed,
      op(task.id, {
        type: "restore",
        target,
        scope: "future",
        deletionId: randomUUID(),
      }),
    ),
  ).toThrow("matching deletion");
});
it("resolves moved links only for the selected owner and refuses tombstones and malformed dates", () => {
  const { task, record, item } = fixture();
  const target = occurrenceTarget(item);
  const moved = appendOperation(
    record,
    op(task.id, {
      type: "edit",
      target,
      scope: "occurrence",
      patch: { schedule: { ...item.schedule, date: "2026-10-05" } },
      currentDay: "2026-09-29",
    }),
  );
  const link = {
    ownerId: "owner-a",
    occurrenceId: item.id,
    day: item.originalDate,
  };
  expect(linkedOccurrence([moved], link, "owner-a")?.schedule.date).toBe(
    "2026-10-05",
  );
  expect(linkedOccurrence([moved], link, "owner-b")).toBeNull();
  expect(
    linkedOccurrence([moved], { ...link, day: "invalid" }, "owner-a"),
  ).toBeNull();
  expect(
    linkedOccurrence(
      [moved],
      { ...link, occurrenceId: randomUUID() },
      "owner-a",
    ),
  ).toBeNull();
  const removed = appendOperation(
    moved,
    op(task.id, { type: "delete", target, scope: "future" }),
  );
  expect(linkedOccurrence([removed], link, "owner-a")).toBeNull();
});
