import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newTask, projectSeries, setState, instant } from "@timely/domain";
import { localStateSchema, dailySummarySchema } from "@timely/contracts";
import {
  initialState,
  saveLocal,
  visibleRecords,
  type LocalStore,
} from "./engine";
import {
  LocalReminderScheduler,
  emptyReminders,
  type NativeReminder,
  type NotificationAdapter,
  type ReminderCoverageAdapter,
} from "./reminders";
import { occurrenceTarget, reduceRecord } from "./records";
import { DailySummarySettings } from "./notification-settings";
function fixture(coverage?: ReminderCoverageAdapter) {
  let state = initialState("synthetic-owner", randomUUID());
  state.reminders = {
    ...emptyReminders(),
    dailySummary: { enabled: true, time: "18:00" },
  };
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
  let calls = 0;
  let allowed = true;
  const adapter: NotificationAdapter = {
    permission: async () => (allowed ? "granted" : "denied"),
    scheduled: async () => [...actual.values()],
    cancel: async (id) => {
      actual.delete(id);
    },
    schedule: async (key, item, plan, ownerId) => {
      calls++;
      actual.set(key, {
        key,
        nativeId: key,
        ownerId,
        due: plan.due,
        ...(plan.kind === "summary" ? { summaryCount: plan.count } : {}),
      });
      return key;
    },
  };
  const restart = () => {
    state = localStateSchema.parse(JSON.parse(JSON.stringify(state)));
    return new LocalReminderScheduler(
      store,
      adapter,
      () => "Europe/London",
      coverage,
    );
  };
  const scheduler = restart();
  const now = instant("2026-10-12", "09:00", "Europe/London");
  async function add(day = "2026-10-12", taskReminders = false) {
    const task = newTask(randomUUID(), day);
    task.title = "An unfinished plan";
    if (taskReminders) {
      task.reminders.enabled = true;
      task.schedule.time = "10:00";
    }
    await saveLocal(store, task.id, { type: "create", task }, randomUUID, now);
    return task;
  }
  async function finish(
    id: string,
    next: "completed" | "skipped" = "completed",
  ) {
    const item = projectSeries(
      reduceRecord(
        visibleRecords(await store.read()).records.find((x) => x.id === id)!,
      ),
      "2026-10-12",
      "2026-10-12",
    )[0]!;
    await saveLocal(
      store,
      id,
      {
        type: "state",
        target: occurrenceTarget(item),
        state: next,
        terminal: setState(item, next, "Europe/London", now).terminal,
      },
      randomUUID,
      now + calls,
    );
  }
  return {
    store,
    actual,
    scheduler,
    restart,
    now,
    add,
    finish,
    calls: () => calls,
    deny: () => {
      allowed = false;
    },
  };
}
it("updates one summary's count and cancels it after the last offline completion/skip", async () => {
  const f = fixture();
  const first = await f.add();
  const second = await f.add();
  await f.scheduler.run(f.now);
  expect([...f.actual.values()].map((x) => x.summaryCount)).toEqual([2]);
  const key = [...f.actual.keys()][0];
  await f.finish(first.id);
  await f.scheduler.run(f.now);
  expect([...f.actual.keys()]).toEqual([key]);
  expect([...f.actual.values()].map((x) => x.summaryCount)).toEqual([1]);
  await f.finish(second.id, "skipped");
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(0);
});
it("persists policy and elapsed-day dedupe through restart, time changes, and new same-day tasks", async () => {
  const f = fixture();
  await f.add();
  await f.scheduler.run(f.now);
  f.actual.clear();
  const after = instant("2026-10-12", "18:01", "Europe/London");
  await f.scheduler.run(after);
  await f.store.transaction((state) => {
    state.reminders!.dailySummary = { enabled: true, time: "19:00" };
  });
  await f.add();
  await f.restart().run(after);
  expect(f.actual.size).toBe(0);
  const saved = JSON.parse(JSON.stringify(await f.store.read()));
  expect(
    localStateSchema.parse(saved).reminders?.summaryHandled?.["2026-10-12"],
  ).toBeTruthy();
});
it("does not schedule or resurrect missed summaries, and cancels on permission denial/disable", async () => {
  const f = fixture();
  await f.add();
  await f.scheduler.run(instant("2026-10-12", "18:01", "Europe/London"));
  expect(f.actual.size).toBe(0);
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(1);
  f.deny();
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(0);
  expect(
    dailySummarySchema.safeParse({ enabled: true, time: "25:00" }).success,
  ).toBe(false);
});
it("does not acquire a second local summary after a remote send consumed the date", async () => {
  const f = fixture({
    prepare: async () => ({
      available: true,
      blocked: [],
      summaryHandledDays: ["2026-10-12"],
    }),
    commit: async () => ({ ready: true, retry: false }),
  });
  await f.add();
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(0);
});
it("saves independent policy edits durably and cancels after disabling", async () => {
  const f = fixture();
  await f.add();
  await f.scheduler.run(f.now);
  await DailySummarySettings.update(f.store, { time: "19:00" });
  await DailySummarySettings.update(f.store, { enabled: false });
  expect((await f.store.read()).reminders?.dailySummary).toEqual({
    enabled: false,
    time: "19:00",
  });
  await f.restart().run(f.now);
  expect(f.actual.size).toBe(0);
});
it("preserves offline time changes for locally owned summaries without taking over remote-owned ones", async () => {
  const coverage: ReminderCoverageAdapter = {
    prepare: async () => {
      throw new Error("Offline");
    },
    commit: async () => ({ ready: true, retry: false }),
  };
  const f = fixture(coverage);
  await f.add();
  await f.scheduler.run(f.now);
  await f.store.transaction((state) => {
    const records = visibleRecords(state).records;
    state.shadows = Object.fromEntries(
      records.map((record) => [record.id, record]),
    );
    state.outbox = [];
    state.reminders!.remoteReady = true;
    state.reminders!.remoteSummaryPolicy = { enabled: true, time: "18:00" };
  });
  await DailySummarySettings.update(f.store, { time: "19:00" });
  await f.scheduler.run(f.now);
  expect([...f.actual.values()].map((x) => x.due)).toEqual([
    instant("2026-10-12", "19:00", "Europe/London"),
  ]);
  // A fresh installation with only acknowledged remote ownership must wait for a safe handoff.
  f.actual.clear();
  await f.store.transaction((state) => {
    state.reminders!.mappings = {};
  });
  await f.restart().run(f.now);
  expect(f.actual.size).toBe(0);
});
it("keeps the daily summary locally covered when explicit task reminders exceed the OS budget", async () => {
  const f = fixture();
  for (let i = 0; i < 50; i++) await f.add("2026-10-12", true);
  await f.scheduler.run(f.now);
  expect(f.actual.size).toBe(48);
  expect(
    [...f.actual.values()]
      .filter((x) => x.summaryCount !== undefined)
      .map((x) => x.summaryCount),
  ).toEqual([50]);
});
