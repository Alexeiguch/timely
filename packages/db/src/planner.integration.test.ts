import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "./index";
import { planner } from "./planner";
import { user, jobOutbox, syncOperations } from "./schema";
import { type Command, type Operation, taskSchema } from "@timely/contracts";
import { occurrenceTarget, reduceRecord } from "@timely/sync";
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
    const push = (ownerId: string, operations: Operation[]) =>
      api!.push(ownerId, { protocolVersion: 1, deviceId, operations });
    beforeAll(async () => {
      for (const id of owners) {
        await db!
          .insert(user)
          .values({
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
        reduceRecord(response.results[0]!.record),
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
  },
);
