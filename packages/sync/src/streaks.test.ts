import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Command, Operation, TaskRecord } from "@timely/contracts";
import {
  newTask,
  projectSeries,
  recurrencePreset,
  setState,
  streakKey,
} from "@timely/domain";
import { appendOperation, occurrenceTarget, reduceRecord } from "./records";
import { editableTask, editorCommand } from "./planner-actions";
import { streakSummaries } from "./streaks";
import {
  initialState,
  saveLocal,
  visibleRecords,
  type LocalStore,
} from "./engine";

const task = {
  ...newTask(randomUUID(), "2026-10-01"),
  title: "Read",
  rule: recurrencePreset("daily", "2026-10-01"),
  streak: { from: "2026-10-01" },
};
function operation(
  command: Command,
  physical: number,
  deviceId = randomUUID(),
): Operation {
  const id = randomUUID();
  return {
    id,
    definitionId: task.id,
    deviceId,
    protocolVersion: 1,
    createdAt: "2026-10-01T10:00:00Z",
    stamp: { physical, logical: 0, deviceId, operationId: id },
    command,
  };
}
const created = operation({ type: "create", task }, 1000);
const initial = appendOperation(undefined, created);
const items = (record: TaskRecord) =>
  projectSeries(reduceRecord(record), "2026-10-01", "2026-10-04");
function completed(record: TaskRecord, index: number, physical: number) {
  const item = items(record)[index]!;
  const terminal = setState(
    item,
    "completed",
    "UTC",
    Date.parse(`${item.schedule.date}T20:00Z`),
  ).terminal;
  return operation(
    {
      type: "state",
      target: occurrenceTarget(item),
      state: "completed",
      terminal,
    },
    physical,
  );
}

it("converges across two devices, out-of-order completions and exact UUID retry without double counting", () => {
  const a = completed(initial, 0, 2000),
    b = completed(initial, 1, 3000);
  const one = appendOperation(appendOperation(initial, a), b);
  const two = appendOperation(
    appendOperation(appendOperation(initial, b), a),
    a,
  );
  const at = Date.parse("2026-10-03T10:00Z");
  expect(streakSummaries([one], "UTC", at)).toEqual(
    streakSummaries([two], "UTC", at),
  );
  expect(
    streakSummaries([one], "UTC", at).get(streakKey(items(one)[0]!))?.count,
  ).toBe(2);
});

it("persists offline completions atomically and rejects Skip without changing the outbox", async () => {
  let state = initialState("owner-one", randomUUID());
  const store: LocalStore = {
    async read() {
      return structuredClone(state);
    },
    async transaction(change) {
      const copy = structuredClone(state);
      const result = change(copy);
      state = copy;
      return result;
    },
  };
  await saveLocal(store, task.id, { type: "create", task }, randomUUID);
  const item = items(visibleRecords(await store.read()).records[0]!)[0]!;
  const terminal = setState(
    item,
    "completed",
    "UTC",
    Date.parse("2026-10-01T20:00Z"),
  ).terminal;
  await saveLocal(
    store,
    task.id,
    {
      type: "state",
      target: occurrenceTarget(item),
      state: "completed",
      terminal,
    },
    randomUUID,
  );
  const saved = await store.read();
  expect(
    streakSummaries(
      visibleRecords(saved).records,
      "UTC",
      Date.parse("2026-10-01T21:00Z"),
    ).get(streakKey(item))?.count,
  ).toBe(1);
  await expect(
    saveLocal(
      store,
      task.id,
      {
        type: "state",
        target: occurrenceTarget(item),
        state: "skipped",
        terminal: { ...terminal!, state: "skipped" },
      },
      randomUUID,
    ),
  ).rejects.toThrow("cannot be skipped");
  expect(await store.read()).toEqual(saved);
});

it("preserves tracking through metadata changes and requires a series scope to toggle it", () => {
  const item = items(initial)[0]!;
  const input = editableTask(initial, item);
  expect(input.streak).toEqual(task.streak);
  const command = editorCommand(
    input,
    { ...input, title: "Read outside" },
    item,
    "occurrence",
    "2026-10-01",
  )!;
  expect(
    items(appendOperation(initial, operation(command, 2000)))[0]!.streak,
  ).toEqual(task.streak);
  expect(() =>
    editorCommand(
      input,
      { ...input, streak: null },
      item,
      "occurrence",
      "2026-10-01",
    ),
  ).toThrow("series");
  expect(() =>
    appendOperation(
      initial,
      operation(
        {
          type: "edit",
          target: occurrenceTarget(item),
          scope: "occurrence",
          currentDay: "2026-10-01",
          patch: { streak: null },
        },
        2000,
      ),
    ),
  ).toThrow("series");
});

it("rejects Skip from a stale pre-tracking revision after the active series enables tracking", () => {
  const plain = appendOperation(
    undefined,
    operation({ type: "create", task: { ...task, streak: null } }, 1000),
  );
  const old = items(plain)[1]!;
  const tracked = appendOperation(
    plain,
    operation(
      {
        type: "edit",
        target: occurrenceTarget(old),
        scope: "future",
        currentDay: "2026-10-02",
        patch: { streak: { from: "2026-10-02" } },
      },
      2000,
    ),
  );
  const terminal = setState(
    old,
    "skipped",
    "UTC",
    Date.parse("2026-10-02T12:00Z"),
  ).terminal;
  expect(() =>
    appendOperation(
      tracked,
      operation(
        {
          type: "state",
          target: occurrenceTarget(old),
          state: "skipped",
          terminal,
        },
        3000,
      ),
    ),
  ).toThrow("cannot be skipped");
});

it("keeps legacy journal shapes unchanged for dedupe fingerprints", () => {
  const { streak: _, ...legacy } = task;
  const authored = operation({ type: "create", task: legacy }, 1000);
  expect(appendOperation(undefined, authored).operations[0]).toEqual(authored);
  expect(
    "streak" in
      editableTask(
        appendOperation(undefined, authored),
        items(appendOperation(undefined, authored))[0]!,
      ),
  ).toBe(false);
});
