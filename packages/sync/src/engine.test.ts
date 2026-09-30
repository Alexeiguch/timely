import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  initialState,
  saveLocal,
  SyncEngine,
  SyncError,
  visibleRecords,
  type LocalState,
  type LocalStore,
  type Transport,
} from "./engine";
import { appendOperation, occurrenceTarget, reduceRecord } from "./records";
import { projectSeries } from "@timely/domain";
import { taskSchema, type Operation, type TaskRecord } from "@timely/contracts";
function memory(): LocalStore {
  let state = initialState("account-a", randomUUID());
  return {
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
}
const task = () =>
  taskSchema.parse({
    id: randomUUID(),
    title: "Offline plan",
    notes: "",
    priority: null,
    schedule: { date: "2026-09-29", time: null, duration: null },
    reminders: { enabled: false, before: true, overdue: true },
    rule: null,
  });
it("persists an edit atomically and keeps it after authentication expires", async () => {
  const store = memory(),
    item = task();
  await saveLocal(store, item.id, { type: "create", task: item }, randomUUID);
  const before = await store.read();
  const engine = new SyncEngine(
    store,
    async () => {
      throw new SyncError(401, "UNAUTHENTICATED", "Sign in");
    },
    "web",
    () => "UTC",
    () => {},
  );
  await engine.run();
  expect((await store.read()).outbox).toEqual(before.outbox);
  expect(visibleRecords(await store.read()).records).toHaveLength(1);
  await expect(
    saveLocal(store, item.id, { type: "create", task: item }, randomUUID),
  ).rejects.toThrow();
  expect((await store.read()).outbox).toHaveLength(1);
});
it("retries a lost committed response and removes only acknowledged operations", async () => {
  const store = memory(),
    item = task();
  await saveLocal(store, item.id, { type: "create", task: item }, randomUUID);
  let remote: TaskRecord | undefined,
    dropped = false,
    pushes = 0;
  const transport: Transport = async (path, body) => {
    if (path === "devices/register") return {};
    if (path === "sync/bootstrap")
      return {
        token: randomUUID(),
        records: [],
        watermark: 0,
        next: null,
        serverTime: Date.now(),
      };
    if (path.startsWith("sync/pull"))
      return {
        changes: remote ? [{ cursor: 1, record: remote }] : [],
        cursor: remote ? 1 : 0,
        more: false,
        serverTime: Date.now(),
      };
    const batch = body as { operations: Operation[] };
    pushes++;
    for (const op of batch.operations) remote = appendOperation(remote, op);
    if (!dropped) {
      dropped = true;
      throw new TypeError("Response lost");
    }
    return {
      results: batch.operations.map((op) => ({
        id: op.id,
        stamp: op.stamp,
        disposition: "applied",
        record: remote,
        cursor: 1,
      })),
      watermark: 1,
      serverTime: Date.now(),
    };
  };
  const engine = new SyncEngine(
    store,
    transport,
    "web",
    () => "UTC",
    () => {},
  );
  await engine.run();
  expect((await store.read()).outbox).toHaveLength(1);
  await engine.run(true);
  expect((await store.read()).outbox).toHaveLength(0);
  expect(remote!.operations).toHaveLength(1);
  expect(pushes).toBe(2);
});
it("stages interrupted bootstrap pages without replacing local work", async () => {
  const store = memory(),
    item = task();
  await saveLocal(store, item.id, { type: "create", task: item }, randomUUID);
  const remoteTask = task(),
    temporary = memory();
  await saveLocal(
    temporary,
    remoteTask.id,
    { type: "create", task: remoteTask },
    randomUUID,
  );
  const remote = visibleRecords(await temporary.read()).records[0]!;
  const token = randomUUID();
  let calls = 0;
  const transport: Transport = async (path) => {
    if (path === "devices/register") return {};
    if (path === "sync/bootstrap" && calls++ === 0)
      return {
        token,
        records: [remote],
        watermark: 8,
        next: 1,
        serverTime: Date.now(),
      };
    throw new TypeError("Connection interrupted");
  };
  await new SyncEngine(
    store,
    transport,
    "web",
    () => "UTC",
    () => {},
  ).run();
  const state = await store.read();
  expect(state.bootstrapped).toBe(false);
  expect(state.shadows).toEqual({});
  expect(state.staging?.records[remote.id]).toEqual(remote);
  expect(visibleRecords(state).records[0]!.id).toBe(item.id);
});
it("rebases a local edit authored during pull onto the newer canonical shadow", async () => {
  const store = memory(),
    item = task();
  await saveLocal(store, item.id, { type: "create", task: item }, randomUUID);
  const record = visibleRecords(await store.read()).records[0]!;
  await store.transaction((s) => {
    s.shadows[item.id] = record;
    s.outbox = [];
    s.bootstrapped = true;
  });
  const occurrence = projectSeries(
    reduceRecord(record),
    "2026-09-29",
    "2026-09-29",
  )[0]!;
  const transport: Transport = async (path) => {
    if (path === "devices/register") return {};
    await saveLocal(
      store,
      item.id,
      {
        type: "edit",
        scope: "occurrence",
        target: occurrenceTarget(occurrence),
        patch: { title: "Still here" },
        currentDay: "2026-09-29",
      },
      randomUUID,
    );
    return {
      changes: [{ cursor: 1, record }],
      cursor: 1,
      more: false,
      serverTime: Date.now(),
    };
  };
  await new SyncEngine(
    store,
    transport,
    "web",
    () => "UTC",
    () => {},
  ).run();
  expect((await store.read()).outbox).toHaveLength(1);
  const visible = visibleRecords(await store.read()).records[0]!;
  expect(
    projectSeries(reduceRecord(visible), "2026-09-29", "2026-09-29")[0]!.title,
  ).toBe("Still here");
});

it("commits a reorder batch atomically and rolls back every command if one is invalid", async () => {
  const { saveLocalBatch } = await import("./engine");
  const { reorderCommands } = await import("./planner-actions");
  const { compareOccurrences } = await import("@timely/domain");
  const store = memory();
  const first = task(),
    second = task();
  await saveLocalBatch(
    store,
    [
      { definitionId: first.id, command: { type: "create", task: first } },
      { definitionId: second.id, command: { type: "create", task: second } },
    ],
    randomUUID,
  );
  const items = visibleRecords(await store.read())
    .records.flatMap((r) =>
      projectSeries(reduceRecord(r), "2026-09-29", "2026-09-29"),
    )
    .sort(compareOccurrences);
  const changes = reorderCommands(items, items[1]!, -1);
  const before = await store.read();
  await expect(
    saveLocalBatch(
      store,
      [
        ...changes,
        { definitionId: first.id, command: { type: "create", task: first } },
      ],
      randomUUID,
    ),
  ).rejects.toThrow();
  expect(await store.read()).toEqual(before);
  await saveLocalBatch(store, changes, randomUUID);
  const reordered = visibleRecords(await store.read())
    .records.flatMap((r) =>
      projectSeries(reduceRecord(r), "2026-09-29", "2026-09-29"),
    )
    .sort(compareOccurrences);
  expect(reordered.map((i) => i.id)).toEqual(items.map((i) => i.id).reverse());
  expect(reordered.map((i) => i.schedule)).toEqual(
    items.map((i) => i.schedule),
  );
});
