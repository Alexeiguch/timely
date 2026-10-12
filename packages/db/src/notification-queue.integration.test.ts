import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { createDatabase } from "./index";
import { notificationRepository } from "./notifications";
import {
  user,
  jobOutbox,
  syncDevices,
  notificationDevices,
  notificationReconciliations,
} from "./schema";
const enabled = process.env.RUN_DB_TESTS === "1";
describe.skipIf(!enabled)(
  "durable fair reminder owner queue",
  { timeout: 60000 },
  () => {
    const connection = enabled
      ? createDatabase(process.env.DATABASE_URL!)
      : undefined;
    const db = connection?.db;
    const repo = enabled ? notificationRepository(db!) : undefined;
    const now = Date.parse("2026-10-12T09:00:00Z");
    let owners: string[] = [];
    async function accounts(count: number) {
      owners = Array.from({ length: count }, () => randomUUID());
      await db!
        .insert(user)
        .values(
          owners.map((id) => ({
            id,
            name: "Synthetic queue fixture",
            email: `${id}@example.test`,
            emailVerified: true,
          })),
        );
      return owners;
    }
    async function enqueue(ids: string[]) {
      await db!
        .insert(jobOutbox)
        .values(
          ids.map((ownerId, index) => ({
            ownerId,
            operationId: randomUUID(),
            type: "reconcile-preferences",
            createdAt: new Date(now - 60000 + index),
          })),
        );
    }
    afterEach(async () => {
      if (owners.length) await db!.delete(user).where(inArray(user.id, owners));
      owners = [];
    });
    afterAll(async () => {
      await connection!.client.end();
    });
    it("processes more than fifty owners without a failing owner starving the rest", async () => {
      const ids = await accounts(61);
      await enqueue(ids);
      const first = await repo!.owners(now);
      expect(first).toHaveLength(50);
      expect(first[0]).toBe(ids[0]);
      await repo!.reconciliationFailed(ids[0]!, now);
      const next = await notificationRepository(db!).owners(now);
      expect(next).toHaveLength(11);
      expect(new Set([...first, ...next]).size).toBe(61);
      expect(await repo!.owners(now + 59999)).toEqual([]);
      const retry = await repo!.owners(now + 60000);
      // Of eligible work, first attempts at the previous tick precede later attempts.
      expect(retry).toHaveLength(50);
      await repo!.reconciliationFailed(ids[0]!, now + 60000);
      const [failed] = await db!
        .select()
        .from(notificationReconciliations)
        .where(eq(notificationReconciliations.ownerId, ids[0]!));
      expect(failed).toMatchObject({ attempts: 2, nextAttempt: now + 180000 });
      await repo!.reconcile(ids[0]!, now + 180000);
      const [recovered] = await db!
        .select()
        .from(notificationReconciliations)
        .where(eq(notificationReconciliations.ownerId, ids[0]!));
      expect(recovered).toMatchObject({ attempts: 0, nextAttempt: 0 });
      expect((await repo!.owners(now + 180000)).includes(ids[0]!)).toBe(false);
    });
    it("deduplicates devices and outbox work before applying the owner limit", async () => {
      const ids = await accounts(2);
      const projectId = randomUUID();
      const devices = Array.from({ length: 60 }, () => ({
        ownerId: ids[0]!,
        id: randomUUID(),
        platform: "ios",
        zone: "UTC",
      }));
      devices.push({
        ownerId: ids[1]!,
        id: randomUUID(),
        platform: "ios",
        zone: "UTC",
      });
      await db!.insert(syncDevices).values(devices);
      await db!
        .insert(notificationDevices)
        .values(
          devices.map(({ ownerId, id }) => ({
            ownerId,
            deviceId: id,
            projectId,
            permission: "granted",
            plannedThrough: now - 1000,
          })),
        );
      await enqueue(ids);
      expect(new Set(await repo!.owners(now))).toEqual(new Set(ids));
      expect(await repo!.owners(now)).toEqual([]);
    });
    it("leases owners atomically across concurrent workers and recovers expired leases", async () => {
      const ids = await accounts(4);
      await enqueue(ids);
      const [first, second] = await Promise.all([
        repo!.owners(now),
        repo!.owners(now),
      ]);
      expect([...first, ...second]).toHaveLength(4);
      expect(new Set([...first, ...second]).size).toBe(4);
      expect(await repo!.owners(now + 59999)).toEqual([]);
      expect(await repo!.owners(now + 60000)).toHaveLength(4);
      // A delayed earlier run cannot postpone a newer worker's lease.
      await repo!.reconciliationFailed(ids[0]!, now);
      const [leased] = await db!
        .select()
        .from(notificationReconciliations)
        .where(eq(notificationReconciliations.ownerId, ids[0]!));
      expect(leased).toMatchObject({
        lastAttempt: now + 60000,
        nextAttempt: now + 120000,
        attempts: 0,
      });
    });
  },
);
