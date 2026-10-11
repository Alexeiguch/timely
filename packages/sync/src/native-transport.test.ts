import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  initialState,
  saveLocal,
  SyncEngine,
  appendOperation,
  reduceRecord,
  occurrenceTarget,
  visibleRecords,
  type LocalStore,
} from "./index";
import { projectSeries } from "@timely/domain";
import { taskSchema, type Operation, type TaskRecord } from "@timely/contracts";
import { nativeSyncTransport } from "../../../apps/mobile/src/sync-transport";

it.each([false, true])(
  "uploads native edits without requiring push registration (reminders=%s)",
  async (enabled) => {
    const ownerId = randomUUID();
    let state = initialState(ownerId, randomUUID());
    state.bootstrapped = true;
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
    const task = taskSchema.parse({
      id: randomUUID(),
      title: "Saved even when Expo is unavailable",
      notes: "",
      priority: null,
      schedule: { date: "2026-10-11", time: "10:00", duration: null },
      reminders: { enabled, before: true, overdue: true },
      rule: null,
    });
    await saveLocal(store, task.id, { type: "create", task }, randomUUID);
    const paths: string[] = [];
    let remote: TaskRecord | undefined;
    const fetcher: typeof fetch = async (url, init) => {
      const path = String(url);
      paths.push(path);
      expect(new Headers(init?.headers).get("X-Timely-Account")).toBe(ownerId);
      if (path.includes("notifications"))
        return Response.json({ error: "Push unavailable" }, { status: 503 });
      if (path.endsWith("devices/register")) return Response.json({});
      if (path.includes("sync/pull"))
        return Response.json({
          changes: [],
          cursor: 1,
          more: false,
          serverTime: Date.now(),
        });
      const batch = JSON.parse(String(init?.body)) as {
        operations: Operation[];
      };
      return Response.json({
        results: batch.operations.map((operation) => {
          remote = appendOperation(remote, operation);
          return {
            id: operation.id,
            stamp: operation.stamp,
            disposition: "applied",
            record: remote,
            cursor: 1,
          };
        }),
        watermark: 1,
        serverTime: Date.now(),
      });
    };
    await new SyncEngine(
      store,
      nativeSyncTransport(ownerId, fetcher),
      "ios",
      () => "UTC",
      () => {},
    ).run();
    expect(paths.some((path) => path.includes("notifications"))).toBe(false);
    expect(paths.some((path) => path.endsWith("sync/push"))).toBe(true);
    expect((await store.read()).outbox).toHaveLength(0);
    expect(remote?.id).toBe(task.id);

    await saveLocal(
      store,
      task.id,
      {
        type: "edit",
        target: occurrenceTarget(
          projectSeries(reduceRecord(remote!), "2026-10-11", "2026-10-11")[0]!,
        ),
        scope: "series",
        patch: { title: "Offline edit" },
        currentDay: "2026-10-11",
      },
      randomUUID,
    );
    const pending = (await store.read()).outbox;
    await new SyncEngine(
      store,
      nativeSyncTransport(ownerId, async () =>
        Response.json(
          { code: "UNAUTHENTICATED", message: "Sign in" },
          { status: 401 },
        ),
      ),
      "ios",
      () => "UTC",
      () => {},
    ).run();
    expect((await store.read()).outbox).toEqual(pending);
    expect(visibleRecords(await store.read()).records).toHaveLength(1);
  },
);
