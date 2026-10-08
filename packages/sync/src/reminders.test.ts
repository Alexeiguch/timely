import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newTask, projectSeries } from "@timely/domain";
import {
  initialState,
  saveLocal,
  visibleRecords,
  type LocalStore,
} from "./engine";
import {
  LocalReminderScheduler,
  type NativeReminder,
  type NotificationAdapter,
  type ReminderCoverageAdapter,
} from "./reminders";
import { occurrenceTarget, reduceRecord } from "./records";
function fixture(coverage?: ReminderCoverageAdapter) {
  let state = initialState("owner-a", randomUUID());
  const store: LocalStore = {
    read: async () => structuredClone(state),
    transaction: async (change) => {
      const copy = structuredClone(state);
      const result = change(copy);
      state = copy;
      return result;
    },
  };
  const actual = new Map<string, NativeReminder>();
  let allowed = true,
    crash = false,
    calls = 0;
  const adapter: NotificationAdapter = {
    permission: async () => (allowed ? "granted" : "denied"),
    scheduled: async () => [...actual.values()],
    cancel: async (id) => {
      actual.delete(id);
    },
    schedule: async (key, item, plan, ownerId) => {
      calls++;
      actual.set(key, { nativeId: key, key, ownerId, due: plan.due });
      if (crash) {
        crash = false;
        throw new Error("Interrupted after OS scheduling");
      }
      return key;
    },
  };
  const scheduler = new LocalReminderScheduler(
    store,
    adapter,
    () => "Europe/London",
    coverage,
  );
  const now = Date.parse("2026-10-05T07:00:00Z");
  async function add(title = "A plan") {
    const task = newTask(randomUUID(), "2026-10-05");
    task.title = title;
    task.schedule.time = "10:00";
    task.reminders.enabled = true;
    await saveLocal(store, task.id, { type: "create", task }, randomUUID, now);
    return task;
  }
  return {
    store,
    actual,
    scheduler,
    now,
    add,
    setAllowed: (value: boolean) => {
      allowed = value;
    },
    crash: () => {
      crash = true;
    },
    calls: () => calls,
  };
}
it("recovers an interrupted native call without duplicating it and cancels offline completion", async () => {
  const f = fixture();
  await f.add();
  f.crash();
  await expect(f.scheduler.run(f.now)).rejects.toThrow("Interrupted");
  expect((await f.store.read()).reminders!.retry).toBe(true);
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(2);
  expect(f.calls()).toBe(2);
  const record = visibleRecords(await f.store.read()).records[0]!;
  const item = projectSeries(
    reduceRecord(record),
    "2026-10-05",
    "2026-10-05",
  )[0]!;
  await saveLocal(
    f.store,
    record.id,
    {
      type: "state",
      target: occurrenceTarget(item),
      state: "skipped",
      terminal: {
        title: item.title,
        schedule: item.schedule,
        originalDate: item.originalDate,
        zone: "Europe/London",
        state: "skipped",
        at: "2026-10-05T07:01:00Z",
      },
    },
    randomUUID,
    f.now + 60000,
  );
  await f.scheduler.run(f.now + 60000);
  expect(f.actual.size).toBe(0);
});
it("reports local coverage only after OS scheduling and keeps dispatch paused for unsynced work", async () => {
  const calls: string[] = [];
  let f: ReturnType<typeof fixture>;
  const coverage: ReminderCoverageAdapter = {
    prepare: async () => {
      calls.push("prepare");
      return { available: true, blocked: [] };
    },
    commit: async (_state, entries) => {
      calls.push("commit");
      expect(entries).toHaveLength(f.actual.size);
      expect(f.calls()).toBeGreaterThan(0);
      return { ready: true, retry: false };
    },
  };
  f = fixture(coverage);
  await f.add();
  await f.scheduler.run(f.now);
  expect(calls).toEqual(["prepare"]);
  expect((await f.store.read()).reminders?.remoteStatus).toBe("paused");
  await f.store.transaction((state) => {
    state.shadows = Object.fromEntries(
      visibleRecords(state).records.map((record) => [record.id, record]),
    );
    state.outbox = [];
    state.bootstrapped = true;
    state.cursor = 1;
  });
  await f.scheduler.run(f.now);
  expect(calls).toEqual(["prepare", "prepare", "commit"]);
  expect((await f.store.read()).reminders?.remoteReady).toBe(true);
});
it("preserves a remote-committed identity offline without adding a competing local alert", async () => {
  let blocked = "",
    offline = false;
  const coverage: ReminderCoverageAdapter = {
    prepare: async (_state, entries) => {
      if (offline) throw new Error("offline");
      blocked = entries[0]!.key;
      return { available: true, blocked: [blocked] };
    },
    commit: async () => ({ ready: true, retry: false }),
  };
  const f = fixture(coverage);
  await f.add();
  await f.scheduler.run(f.now);
  expect(f.actual.has(blocked)).toBe(false);
  offline = true;
  await f.scheduler.run(f.now);
  expect(f.actual.has(blocked)).toBe(false);
  expect(
    (await f.store.read()).reminders?.remoteOwned?.[blocked],
  ).toBeDefined();
});
it("keeps server-owned canonical plans remote while still scheduling newly authored offline tasks", async () => {
  let offline = false;
  const coverage: ReminderCoverageAdapter = {
    prepare: async () => {
      if (offline) throw new Error("offline");
      return { available: true, blocked: [] };
    },
    commit: async () => ({ ready: true, retry: false }),
  };
  const f = fixture(coverage);
  await f.add("First");
  const acknowledge = () =>
    f.store.transaction((state) => {
      state.shadows = Object.fromEntries(
        visibleRecords(state).records.map((record) => [record.id, record]),
      );
      state.outbox = [];
      state.bootstrapped = true;
      state.cursor++;
    });
  await acknowledge();
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(2);
  await f.add("From another device");
  await acknowledge();
  offline = true;
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(2);
  await f.add("Created offline");
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(4);
});
it("enforces 48 entries, reports uncovered plans, handles permission revocation and isolates accounts", async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) await f.add(`Plan ${i}`);
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(48);
  expect((await f.store.read()).reminders!.uncovered).toBe(12);
  f.actual.set("other", {
    nativeId: "other",
    key: "other",
    ownerId: "owner-b",
    due: f.now + 1000,
  });
  f.setAllowed(false);
  await f.scheduler.run(f.now);
  expect([...f.actual.keys()]).toEqual(["other"]);
  expect((await f.store.read()).reminders!.permission).toBe("denied");
  await f.scheduler.cancelAll();
  expect([...f.actual.keys()]).toEqual(["other"]);
});
it("does not replay elapsed locally scheduled alerts or flood a long-offline account", async () => {
  const f = fixture();
  await f.add();
  await f.scheduler.run(f.now);
  f.actual.clear();
  const due = Date.parse("2026-10-05T09:10:00Z");
  await f.scheduler.run(due + 1000);
  expect(f.actual.size).toBe(0);
  await f.scheduler.run(due + 60000);
  expect(f.actual.size).toBe(0);
  await f.scheduler.run(due + 10 * 86400000);
  expect(f.actual.size).toBe(0);
});
