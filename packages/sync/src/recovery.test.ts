import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newTask, projectSeries } from "@timely/domain";
import { initialState, saveLocal, type LocalStore } from "./engine";
import { occurrenceTarget, reduceRecord } from "./records";
import { discardLocalChanges, retrySavedChanges } from "./recovery";
import { visibleRecords } from "./engine";
it("discards a task's dependent edits atomically while preserving other tasks, clock and canonical data", async () => {
  let state = initialState("owner", randomUUID());
  const store: LocalStore = {
    read: async () => structuredClone(state),
    transaction: async (change) => { const copy = structuredClone(state); const value = change(copy); state = copy; return value; },
  };
  const task = newTask(randomUUID(), "2026-10-05"), other = newTask(randomUUID(), "2026-10-06");
  task.title = "Offline task"; other.title = "Other task";
  const create = await saveLocal(store, task.id, { type: "create", task }, randomUUID);
  const occurrence = projectSeries(reduceRecord({ id: task.id, operations: [create] }), "2026-10-05", "2026-10-05")[0]!;
  await saveLocal(store, task.id, { type: "edit", target: occurrenceTarget(occurrence), scope: "occurrence", patch: { title: "Dependent edit" }, currentDay: "2026-10-05" }, randomUUID);
  await saveLocal(store, other.id, { type: "create", task: other }, randomUUID);
  const before = await store.read();
  expect(await discardLocalChanges(store, task.id)).toBe(2);
  expect(visibleRecords(await store.read()).records.map((item) => item.id)).toEqual([other.id]);
  expect((await store.read()).clock).toEqual(before.clock);
  expect((await store.read()).shadows).toEqual(before.shadows);
  await store.transaction((state) => { state.outbox[0]!.error = "Invalid"; state.outbox[0]!.retryAt = 999999; });
  const operation = (await store.read()).outbox[0]!.operation;
  await retrySavedChanges(store);
  expect((await store.read()).outbox[0]).toMatchObject({ operation, retryAt: 0 });
  expect((await store.read()).outbox[0]!.error).toBeUndefined();
});
