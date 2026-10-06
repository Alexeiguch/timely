import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "./index";
import { planner } from "./planner";
import { historyRepository } from "./history";
import { accountRepository, allowPlannerRequest } from "./account";
import { user, session, syncDevices, jobOutbox, syncOperations } from "./schema";
import {
  type Command,
  type Operation,
  type SyncOperation,
  type PreferencePatch,
  preferenceOperationSchema,
  preferenceRecordSchema,
  recordSchema,
  taskSchema,
} from "@timely/contracts";
import {
  occurrenceTarget,
  reduceRecord,
  reducePreferences,
} from "@timely/sync";
import { projectSeries } from "@timely/domain";
const enabled = process.env.RUN_DB_TESTS === "1";
describe.skipIf(!enabled)(
  "real PostgreSQL sync transactions",
  { timeout: 60000 },
  () => {
    const connection = enabled
      ? createDatabase(process.env.DATABASE_URL!)
      : undefined;
    const db = connection?.db;
    const api = enabled ? planner(db!) : undefined;
    const owners = [randomUUID(), randomUUID()];
    const deviceId = randomUUID();
    const op = (
      definitionId: string,
      command: Command,
      physical = Date.now(),
    ): Operation => {
      const id = randomUUID();
      return {
        protocolVersion: 1,
        id,
        deviceId,
        definitionId,
        stamp: { physical, logical: 0, deviceId, operationId: id },
        createdAt: new Date().toISOString(),
        command,
      };
    };
    const create = () => {
      const task = taskSchema.parse({
        id: randomUUID(),
        title: "Synthetic sync test",
        notes: "",
        priority: null,
        schedule: { date: "2026-09-29", time: null, duration: null },
        reminders: { enabled: false, before: true, overdue: true },
        rule: null,
      });
      return op(task.id, { type: "create", task });
    };
    const push = (ownerId: string, operations: SyncOperation[]) =>
      api!.push(ownerId, { protocolVersion: 1, deviceId, operations });
    beforeAll(async () => {
      for (const id of owners) {
        await db!.insert(user).values({
          id,
          name: "Synthetic test",
          email: `${id}@example.test`,
          emailVerified: true,
        });
        await api!.register(id, {
          id: deviceId,
          platform: "web",
          zone: "Europe/London",
          protocolVersion: 1,
        });
      }
    });
    afterAll(async () => {
      for (const id of owners) await db!.delete(user).where(eq(user.id, id));
      await connection!.client.end();
    });
    it("requires an owner-bound fresh session for deletion and cascades only that account", async () => {
      const ownerId = randomUUID(); owners.push(ownerId);
      await db!.insert(user).values({ id: ownerId, name: "Deletion fixture", email: `${ownerId}@example.test`, emailVerified: true });
      const recent = randomUUID(), stale = randomUUID();
      await db!.insert(session).values([
        { id: recent, token: randomUUID(), userId: ownerId, expiresAt: new Date(Date.now() + 86400000) },
        { id: stale, token: randomUUID(), userId: ownerId, createdAt: new Date(Date.now() - 3600000), expiresAt: new Date(Date.now() + 86400000) },
      ]);
      await api!.register(ownerId, { id: deviceId, platform: "ios", zone: "Europe/London", protocolVersion: 1 });
      await push(ownerId, [create()]);
      await api!.bootstrap(ownerId, {});
      const accounts = accountRepository(db!);
      expect(await accounts.delete(ownerId, stale)).toBe(false);
      expect(await accounts.delete(owners[1]!, recent)).toBe(false);
      expect(await accounts.delete(ownerId, recent)).toBe(true);
      expect(await db!.select().from(session).where(eq(session.userId, ownerId))).toHaveLength(0);
      expect(await db!.select().from(syncOperations).where(eq(syncOperations.ownerId, ownerId))).toHaveLength(0);
      expect(await db!.select().from(jobOutbox).where(eq(jobOutbox.ownerId, ownerId))).toHaveLength(0);
      expect(await db!.select().from(user).where(eq(user.id, owners[1]!))).toHaveLength(1);
    });
    it("unregisters only the requested owner's installation and prevents uploads until registration", async () => {
      await accountRepository(db!).unregister(owners[0]!, deviceId);
      expect(await db!.select().from(syncDevices).where(eq(syncDevices.ownerId, owners[1]!))).toHaveLength(1);
      await expect(push(owners[0]!, [create()])).rejects.toThrow("Register");
      await api!.register(owners[0]!, { id: deviceId, platform: "web", zone: "UTC", protocolVersion: 1 });
    });
    it("shares an atomic per-owner limiter across concurrent requests and resets the window", async () => {
      const now = Date.now() + 100000;
      const results = await Promise.all(Array.from({ length: 185 }, () => allowPlannerRequest(owners[1]!, now, db!)));
      expect(results.filter(Boolean)).toHaveLength(180);
      expect(await allowPlannerRequest(owners[1]!, now + 60000, db!)).toBe(true);
      expect(await allowPlannerRequest(owners[0]!, now, db!)).toBe(true);
    });
    it("paginates a fixed historical window with stable identities, filters and owner isolation", async () => {
      const command = create();
      if (command.command.type !== "create") throw new Error("fixture");
      command.command.task.title = "Historical series";
      command.command.task.rule = { frequency: "daily", anchor: "2026-09-29", interval: 1, end: { kind: "never" }, invalidDate: "clamp" };
      await push(owners[0]!, [command]);
      const history = historyRepository(db!);
      const request = { from: "2026-09-29", through: "2026-10-05", zone: "Europe/London", definitionId: command.definitionId, limit: 2 };
      let page = await history.page(owners[0]!, request);
      const ids = page.items.map((item) => item.id);
      const first = page.items[0]!;
      await push(owners[0]!, [op(command.definitionId, { type: "edit", target: occurrenceTarget(first), scope: "series", patch: { title: "Changed later" }, currentDay: "2026-10-05" })]);
      while (page.next) {
        page = await history.page(owners[0]!, { ...request, cursor: page.next });
        expect(page.items.every((item) => item.title === "Historical series")).toBe(true);
        ids.push(...page.items.map((item) => item.id));
      }
      expect(ids).toHaveLength(7); expect(new Set(ids).size).toBe(7);
      const other = await history.page(owners[1]!, request); expect(other.items).toHaveLength(0);
      const resumed = await history.page(owners[0]!, request);
      await expect(history.page(owners[1]!, { ...request, cursor: resumed.next })).rejects.toThrow("expired");
      await expect(history.page(owners[0]!, { ...request, query: "Changed", cursor: resumed.next })).rejects.toThrow("filters");
      await expect(history.page(owners[0]!, { ...request, through: "2028-10-05" })).rejects.toThrow("366");
    });
    it("replays a lost response exactly, bounds skew once, and rejects operation ID reuse", async () => {
      const command = create();
      command.stamp.physical = Date.now() + 999999999;
      const response = await push(owners[0]!, [command]);
      expect(response.results[0]!.stamp.physical).toBeLessThanOrEqual(
        Date.now() + 300000,
      );
      expect((await push(owners[0]!, [command])).results).toEqual(
        response.results,
      );
      await expect(
        push(owners[0]!, [
          { ...command, createdAt: "2026-01-01T00:00:00.000Z" },
        ]),
      ).rejects.toThrow("reused");
      expect(
        await db!
          .select()
          .from(jobOutbox)
          .where(eq(jobOutbox.operationId, command.id)),
      ).toHaveLength(1);
    });
    it("rolls back a dependent batch and its cursor, operations, and jobs", async () => {
      const before = await api!.pull(owners[0]!, 0);
      const command = create();
      const invalid = op(randomUUID(), {
        type: "delete",
        scope: "series",
        target: {
          id: randomUUID(),
          revisionId: randomUUID(),
          originalDate: "2026-09-29",
          slot: "single",
        },
      });
      await expect(push(owners[0]!, [command, invalid])).rejects.toThrow(
        "unavailable",
      );
      expect((await api!.pull(owners[0]!, 0)).cursor).toBe(before.cursor);
      expect(
        await db!
          .select()
          .from(syncOperations)
          .where(eq(syncOperations.id, command.id)),
      ).toHaveLength(0);
      expect(
        await db!
          .select()
          .from(jobOutbox)
          .where(eq(jobOutbox.operationId, command.id)),
      ).toHaveLength(0);
    });
    it("rejects cross-owner targets and snapshot tokens without leaking records", async () => {
      const command = create();
      const response = await push(owners[0]!, [command]);
      const item = projectSeries(
        reduceRecord(recordSchema.parse(response.results[0]!.record)),
        "2026-09-29",
        "2026-09-29",
      )[0]!;
      await expect(
        push(owners[1]!, [
          op(command.definitionId, {
            type: "delete",
            target: occurrenceTarget(item),
            scope: "series",
          }),
        ]),
      ).rejects.toThrow("unavailable");
      expect((await api!.pull(owners[1]!, 0)).changes).toEqual([]);
      const snapshot = await api!.bootstrap(owners[0]!, { limit: 1 });
      if ("expired" in snapshot) throw new Error("Unexpected expiration");
      expect(
        await api!.bootstrap(owners[1]!, { token: snapshot.token }),
      ).toEqual({ expired: true });
    });
    it("persists scoped deletion undo atomically and replays its exact response", async () => {
      const createCommand = create();
      if (createCommand.command.type !== "create")
        throw new Error("Expected create");
      createCommand.command.task.rule = {
        frequency: "daily",
        anchor: "2026-09-29",
        interval: 1,
        end: { kind: "never" },
        invalidDate: "clamp",
      };
      const created = await push(owners[0]!, [createCommand]);
      const item = projectSeries(
        reduceRecord(recordSchema.parse(created.results[0]!.record)),
        "2026-09-30",
        "2026-09-30",
      )[0]!;
      const target = occurrenceTarget(item);
      const remove = op(createCommand.definitionId, {
        type: "delete",
        target,
        scope: "future",
      });
      const removed = await push(owners[0]!, [remove]);
      expect(
        projectSeries(
          reduceRecord(recordSchema.parse(removed.results[0]!.record)),
          "2026-09-30",
          "2026-10-02",
        ),
      ).toHaveLength(0);
      const restore = op(
        createCommand.definitionId,
        { type: "restore", target, scope: "future", deletionId: remove.id },
        remove.stamp.physical + 1,
      );
      const restored = await push(owners[0]!, [restore]);
      expect(
        projectSeries(
          reduceRecord(recordSchema.parse(restored.results[0]!.record)),
          "2026-09-30",
          "2026-10-02",
        ),
      ).toHaveLength(3);
      expect((await push(owners[0]!, [restore])).results).toEqual(
        restored.results,
      );
      expect(
        await db!
          .select()
          .from(jobOutbox)
          .where(eq(jobOutbox.operationId, restore.id)),
      ).toHaveLength(1);
    });
    it("holds a stable paginated snapshot while overlapping commits produce consecutive cursors", async () => {
      const snapshot = await api!.bootstrap(owners[0]!, { limit: 1 });
      if ("expired" in snapshot) throw new Error("Unexpected expiration");
      const a = create(),
        b = create();
      const commits = await Promise.all([
        push(owners[0]!, [a]),
        push(owners[0]!, [b]),
      ]);
      const cursors = commits.map((c) => c.watermark).sort((x, y) => x - y);
      expect(cursors).toEqual([snapshot.watermark + 1, snapshot.watermark + 2]);
      const ids = snapshot.records.map((r) => r.id);
      let next = snapshot.next;
      while (next !== null) {
        const page = await api!.bootstrap(owners[0]!, {
          token: snapshot.token,
          after: next,
          limit: 1,
        });
        if ("expired" in page) throw new Error("Unexpected expiration");
        expect(page.watermark).toBe(snapshot.watermark);
        ids.push(...page.records.map((r) => r.id));
        next = page.next;
      }
      expect(ids).not.toContain(a.definitionId);
      expect(ids).not.toContain(b.definitionId);
      const first = await api!.pull(owners[0]!, snapshot.watermark, 1);
      expect(first.more).toBe(true);
      const second = await api!.pull(owners[0]!, first.cursor, 1);
      expect(second.more).toBe(false);
      expect(second.cursor).toBe(first.cursor + 1);
    });
    it("synchronizes independent preference groups, deduplicates and isolates accounts", async () => {
      const make = (patch: PreferencePatch, physical: number) => {
        const id = randomUUID();
        return preferenceOperationSchema.parse({
          protocolVersion: 1,
          id,
          deviceId,
          definitionId: "preferences",
          stamp: { physical, logical: 0, deviceId, operationId: id },
          createdAt: new Date().toISOString(),
          command: { type: "preferences", patch },
        });
      };
      const now = Date.now();
      const first = make({ firstWeekday: 7 }, now);
      const saved = await push(owners[0]!, [first]);
      expect((await push(owners[0]!, [first])).results).toEqual(saved.results);
      const snapshot = await api!.bootstrap(owners[0]!, { limit: 1 });
      if ("expired" in snapshot) throw new Error("Unexpected expiration");
      const changed = await push(owners[0]!, [
        make({ grouped: false }, now - 1000),
        make({ firstWeekday: 1 }, now - 2000),
      ]);
      expect(changed.results[1]!.disposition).toBe("superseded");
      expect(
        reducePreferences(
          preferenceRecordSchema.parse(changed.results[1]!.record),
        ),
      ).toMatchObject({ firstWeekday: 7, grouped: false });
      let page = snapshot;
      const records = [...page.records];
      while (page.next !== null) {
        const next = await api!.bootstrap(owners[0]!, {
          token: snapshot.token,
          after: page.next,
          limit: 1,
        });
        if ("expired" in next) throw new Error("Unexpected expiration");
        page = next;
        records.push(...page.records);
      }
      expect(
        reducePreferences(
          preferenceRecordSchema.parse(
            records.find((r) => r.id === "preferences"),
          ),
        ),
      ).toMatchObject({ firstWeekday: 7, grouped: true });
      const isolated = await api!.bootstrap(owners[1]!, {});
      if ("expired" in isolated) throw new Error("Unexpected expiration");
      expect(
        isolated.records.find((r) => r.id === "preferences"),
      ).toBeUndefined();
      const change = make({ firstWeekday: 2 }, now + 100);
      const missing = op(randomUUID(), {
        type: "order",
        target: {
          id: randomUUID(),
          revisionId: randomUUID(),
          slot: "0",
          originalDate: "2026-09-29",
        },
        order: "a",
      });
      await expect(push(owners[0]!, [change, missing])).rejects.toThrow(
        "unavailable",
      );
      expect((await api!.pull(owners[0]!, changed.watermark)).changes).toEqual(
        [],
      );
    });
  },
);
