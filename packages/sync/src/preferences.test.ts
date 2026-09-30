import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  preferenceRecordSchema,
  defaults,
  type PreferencePatch,
  type PreferenceOperation,
  type SyncRecord,
} from "@timely/contracts";
import { appendSyncOperation, reducePreferences } from "./preferences";
import {
  initialState,
  savePreferences,
  visiblePreferences,
  visibleRecords,
  SyncEngine,
  type LocalStore,
} from "./engine";
const deviceId = randomUUID();
function operation(
  patch: PreferencePatch,
  physical: number,
): PreferenceOperation {
  const id = randomUUID();
  return {
    protocolVersion: 1,
    id,
    deviceId,
    definitionId: "preferences",
    stamp: { physical, logical: 0, deviceId, operationId: id },
    createdAt: new Date(physical).toISOString(),
    command: { type: "preferences", patch },
  };
}
it("merges distinct groups regardless of arrival and keeps reminder policy atomic", () => {
  const older = operation(
    {
      firstWeekday: 7,
      grouped: false,
      reminders: {
        morning: "07:00",
        beforeMinutes: 15,
        overdueMinutes: 5,
        before: true,
        overdue: false,
      },
    },
    10,
  );
  const newer = operation(
    {
      firstWeekday: 2,
      reminders: {
        morning: "08:00",
        beforeMinutes: 60,
        overdueMinutes: 30,
        before: false,
        overdue: true,
      },
    },
    20,
  );
  const merge = (ops: PreferenceOperation[]) =>
    reducePreferences(
      preferenceRecordSchema.parse(
        ops.reduce<SyncRecord | undefined>(
          (record, op) => appendSyncOperation(record, op),
          undefined,
        ),
      ),
    );
  expect(merge([newer, older])).toEqual(merge([older, newer]));
  expect(merge([newer, older])).toEqual({
    ...defaults,
    firstWeekday: 2,
    grouped: false,
    morning: "08:00",
    beforeMinutes: 60,
    overdueMinutes: 30,
    before: false,
    overdue: true,
  });
});
it("keeps offline preferences through restart, rebases over bootstrap and retries a lost acknowledgement", async () => {
  let persisted = JSON.stringify(initialState("account", deviceId));
  const store: LocalStore = {
    read: async () => JSON.parse(persisted),
    transaction: async (change) => {
      const state = JSON.parse(persisted);
      const result = change(state);
      persisted = JSON.stringify(state);
      return result;
    },
  };
  await savePreferences(store, { firstWeekday: 7 }, randomUUID, 100);
  await expect(
    savePreferences(store, { firstWeekday: 8 }, randomUUID),
  ).rejects.toThrow();
  expect((await store.read()).outbox).toHaveLength(1);
  expect(visiblePreferences(await store.read()).firstWeekday).toBe(7);
  expect(visibleRecords(await store.read()).records).toEqual([]);
  let remote = preferenceRecordSchema.parse(
    appendSyncOperation(undefined, operation({ grouped: false }, 10)),
  );
  let dropped = false;
  const engine = new SyncEngine(
    store,
    async (path, body) => {
      if (path === "devices/register") return {};
      if (path === "sync/bootstrap")
        return {
          token: randomUUID(),
          records: [remote],
          watermark: 1,
          next: null,
          serverTime: 100,
        };
      if (path.startsWith("sync/pull"))
        return {
          changes: [{ cursor: 2, record: remote }],
          cursor: 2,
          more: false,
          serverTime: 100,
        };
      const ops = (body as { operations: PreferenceOperation[] }).operations;
      for (const op of ops)
        remote = preferenceRecordSchema.parse(appendSyncOperation(remote, op));
      if (!dropped) {
        dropped = true;
        throw new Error("Connection lost after commit");
      }
      return {
        results: ops.map((op) => ({
          id: op.id,
          stamp: op.stamp,
          disposition: "applied",
          record: remote,
          cursor: 2,
        })),
        watermark: 2,
        serverTime: 100,
      };
    },
    "web",
    () => "UTC",
    () => {},
  );
  await engine.run();
  expect(visiblePreferences(await store.read())).toMatchObject({
    firstWeekday: 7,
    grouped: false,
  });
  expect((await store.read()).outbox).toHaveLength(1);
  await engine.run(true);
  expect((await store.read()).outbox).toHaveLength(0);
  expect(remote.operations).toHaveLength(2);
  expect(visiblePreferences(await store.read())).toMatchObject({
    firstWeekday: 7,
    grouped: false,
  });
});
