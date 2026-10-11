import { beforeEach, afterEach, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { createDatabase } from "./index";
import { notificationRepository } from "./notifications";
import { planner } from "./planner";
import { accountRepository } from "./account";
import { user, notificationDevices, notificationJobs } from "./schema";
import {
  taskSchema,
  recordSchema,
  defaults,
  type Operation,
  type Command,
} from "@timely/contracts";
import {
  occurrenceTarget,
  reduceRecord,
  remoteReminderCandidates,
} from "@timely/sync";
import { setState } from "@timely/domain";
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "real PostgreSQL push ownership and lifecycle",
  { timeout: 60000 },
  () => {
    const connection =
      process.env.RUN_DB_TESTS === "1"
        ? createDatabase(process.env.DATABASE_URL!)
        : undefined;
    const db = connection?.db;
    const repo =
      process.env.RUN_DB_TESTS === "1"
        ? notificationRepository(db!)
        : undefined;
    const sync = process.env.RUN_DB_TESTS === "1" ? planner(db!) : undefined;
    const projectId = randomUUID(),
      deviceId = randomUUID();
    const now = Date.parse("2026-10-08T07:00:00Z");
    const environment = "http://localhost:3002";
    const prepare = (owner: string, value: unknown, project: string) =>
      repo!.prepare(owner, value, project, environment);
    let ownerId = "",
      otherOwner = "";
    const input = (keys: string[] = []) => ({
      deviceId,
      projectId,
      platform: "ios",
      zone: "UTC",
      language: "es",
      permission: "granted",
      token: `ExpoPushToken[fixture-${ownerId}]`,
      keys,
    });
    function operation(definitionId: string, command: Command): Operation {
      const id = randomUUID();
      return {
        protocolVersion: 1,
        id,
        deviceId,
        definitionId,
        command,
        createdAt: new Date().toISOString(),
        stamp: { physical: Date.now(), logical: 0, deviceId, operationId: id },
      };
    }
    async function create() {
      const task = taskSchema.parse({
        id: randomUUID(),
        title: "Synthetic push fixture",
        notes: "Private notes never sent",
        priority: null,
        schedule: { date: "2026-10-08", time: "10:00", duration: null },
        reminders: { enabled: true, before: true, overdue: true },
        rule: null,
      });
      const pushed = await sync!.push(ownerId, {
        protocolVersion: 1,
        deviceId,
        operations: [operation(task.id, { type: "create", task })],
      });
      const record = recordSchema.parse(pushed.results[0]!.record);
      return {
        task,
        record,
        cursor: pushed.watermark,
        plans: remoteReminderCandidates(
          [record],
          defaults,
          deviceId,
          "UTC",
          now,
        ),
      };
    }
    beforeEach(async () => {
      ownerId = randomUUID();
      otherOwner = randomUUID();
      for (const id of [ownerId, otherOwner])
        await db!.insert(user).values({
          id,
          name: "Synthetic push test",
          email: `${id}@example.test`,
          emailVerified: true,
        });
      await sync!.register(ownerId, {
        id: deviceId,
        platform: "ios",
        zone: "UTC",
        protocolVersion: 1,
      });
    });
    afterEach(async () => {
      for (const id of [ownerId, otherOwner])
        await db!.delete(user).where(eq(user.id, id));
    });
    afterAll(async () => {
      await connection!.client.end();
    });
    it("pauses only the uploading account's installation, atomically with valid edits", async () => {
      const f = await create();
      await prepare(ownerId, input(), projectId);
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries: [], handled: [] },
        now,
      );
      await sync!.register(otherOwner, {
        id: deviceId,
        platform: "ios",
        zone: "UTC",
        protocolVersion: 1,
      });
      await prepare(
        otherOwner,
        { ...input(), token: `ExpoPushToken[other-${otherOwner}]` },
        projectId,
      );
      await repo!.commit(
        otherOwner,
        { deviceId, cursor: 0, entries: [], handled: [] },
        now,
      );
      await expect(
        sync!.push(ownerId, {
          protocolVersion: 1,
          deviceId,
          operations: [operation(f.task.id, { type: "create", task: f.task })],
        }),
      ).rejects.toThrow();
      expect((await repo!.status(ownerId, deviceId)).ready).toBe(true);
      await expect(
        sync!.push(ownerId, {
          protocolVersion: 1,
          deviceId,
          operations: [],
        }),
      ).rejects.toThrow();
      expect((await repo!.status(ownerId, deviceId)).ready).toBe(true);
      await sync!.push(ownerId, {
        protocolVersion: 1,
        deviceId,
        operations: [
          operation(f.task.id, {
            type: "edit",
            target: occurrenceTarget(f.plans[0]!.item),
            scope: "series",
            patch: { title: "Uploaded without Expo" },
            currentDay: "2026-10-08",
          }),
        ],
      });
      expect((await repo!.status(ownerId, deviceId)).ready).toBe(false);
      expect((await repo!.status(otherOwner, deviceId)).ready).toBe(true);
    });
    it("excludes paused and expired jobs from the global queue and cancels paused expirations", async () => {
      await prepare(ownerId, input(), projectId);
      await sync!.register(otherOwner, {
        id: deviceId,
        platform: "ios",
        zone: "UTC",
        protocolVersion: 1,
      });
      await prepare(
        otherOwner,
        { ...input(), token: `ExpoPushToken[other-${otherOwner}]` },
        projectId,
      );
      await repo!.commit(
        otherOwner,
        { deviceId, cursor: 0, entries: [], handled: [] },
        now,
      );
      const expired = Array.from({ length: 20 }, () => ({
        ownerId,
        deviceId,
        key: randomUUID(),
        kind: "test",
        due: now - 120000,
        expires: now - 60000,
      }));
      const paused = Array.from({ length: 20 }, () => ({
        ownerId,
        deviceId,
        key: randomUUID(),
        kind: "test",
        due: now - 30000,
        expires: now + 60000,
      }));
      const ready = {
        ownerId: otherOwner,
        deviceId,
        key: randomUUID(),
        kind: "test",
        due: now,
        expires: now + 60000,
      };
      await db!.insert(notificationJobs).values([...expired, ...paused, ready]);
      expect((await repo!.due(now)).map((job) => job.key)).toEqual([ready.key]);
      const [stale] = await db!
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.key, expired[0]!.key));
      expect(await repo!.claim(stale!, now)).toBeNull();
      await repo!.recover(now);
      const rows = await db!
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.ownerId, ownerId));
      expect(rows.filter((job) => job.status === "cancelled")).toHaveLength(20);
      expect(rows.filter((job) => job.status === "pending")).toHaveLength(20);
      expect(
        (await repo!.claim((await repo!.due(now))[0]!, now))?.job.key,
      ).toBe(ready.key);
    });
    it("batches a seven-day recurring horizon and makes unchanged refreshes constant-query", async () => {
      const tasks = Array.from({ length: 50 }, (_, index) =>
        taskSchema.parse({
          id: randomUUID(),
          title: `Recurring fixture ${index}`,
          notes: "",
          priority: null,
          schedule: { date: "2026-10-08", time: "10:00", duration: null },
          reminders: { enabled: true, before: true, overdue: true },
          rule: {
            frequency: "daily",
            interval: 1,
            anchor: "2026-10-08",
            end: { kind: "never" },
            invalidDate: "clamp",
          },
        }),
      );
      const result = await sync!.push(ownerId, {
        protocolVersion: 1,
        deviceId,
        operations: tasks.map((task) =>
          operation(task.id, { type: "create", task }),
        ),
      });
      await prepare(ownerId, input(), projectId);
      let queries = 0;
      const measured = notificationRepository(
        drizzle(connection!.client, {
          schema,
          logger: {
            logQuery() {
              queries++;
            },
          },
        }),
      );
      const coverage = {
        deviceId,
        cursor: result.watermark,
        entries: [],
        handled: [],
      };
      expect(await measured.commit(ownerId, coverage, now)).toEqual({
        ready: true,
        retry: false,
      });
      const first = queries;
      queries = 0;
      expect(await measured.commit(ownerId, coverage, now)).toEqual({
        ready: true,
        retry: false,
      });
      const repeat = queries;
      expect(first).toBeLessThan(25);
      expect(repeat).toBeLessThan(15);
      const jobs = await db!
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.ownerId, ownerId));
      expect(jobs).toHaveLength(700);
      queries = 0;
      await measured.reconcile(ownerId, now);
      expect(queries).toBeLessThan(15);
      expect(
        await db!
          .select()
          .from(notificationJobs)
          .where(eq(notificationJobs.ownerId, ownerId)),
      ).toHaveLength(700);
      console.info(
        `Coverage regression: first=${first}, repeat=${repeat}, reconcile=${queries}, jobs=${jobs.length}`,
      );
    });
    it("isolates device registration by authenticated owner, platform, project and token binding", async () => {
      await expect(prepare(otherOwner, input(), projectId)).rejects.toThrow(
        "Register this mobile",
      );
      await expect(prepare(ownerId, input(), randomUUID())).rejects.toThrow(
        "push project",
      );
      await expect(
        prepare(ownerId, { ...input(), platform: "android" }, projectId),
      ).rejects.toThrow("platform");
      await prepare(ownerId, input(), projectId);
      await sync!.register(otherOwner, {
        id: deviceId,
        platform: "ios",
        zone: "UTC",
        protocolVersion: 1,
      });
      await expect(prepare(otherOwner, input(), projectId)).rejects.toThrow(
        "previous installation",
      );
      expect((await repo!.status(otherOwner, deviceId)).ready).toBe(false);
    });
    it("queues only owner-ready synthetic tests and enforces the per-device cooldown", async () => {
      const f = await create();
      await expect(repo!.test(otherOwner, deviceId)).rejects.toThrow(
        "Register this mobile",
      );
      await prepare(ownerId, input(), projectId);
      await expect(repo!.test(ownerId, deviceId)).rejects.toThrow(
        "Enable remote reminders",
      );
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries: [], handled: [] },
        now,
      );
      const testNow = Date.now();
      expect(await repo!.test(ownerId, deviceId, testNow)).toEqual({
        queued: true,
        delaySeconds: 30,
      });
      const [job] = await db!
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.ownerId, ownerId),
            eq(notificationJobs.kind, "test"),
          ),
        );
      expect(job?.due).toBe(testNow + 30000);
      expect(await repo!.claim(job!, testNow + 1000)).toBeNull();
      await expect(
        repo!.test(ownerId, deviceId, testNow + 1000),
      ).rejects.toThrow("Wait a minute");
      expect((await repo!.claim(job!, testNow + 31000))?.item).toBeNull();
    });
    it("protects local ownership, pauses handoff and blocks local takeover after remote claim", async () => {
      const f = await create();
      await prepare(ownerId, input(f.plans.map((p) => p.key)), projectId);
      const first = f.plans[0]!;
      const entry = {
        key: first.key,
        occurrenceId: first.item.id,
        version: first.plan.version,
        kind: first.plan.kind,
        due: first.plan.due,
        day: first.item.schedule.date,
      };
      expect(
        await repo!.commit(
          ownerId,
          { deviceId, cursor: f.cursor, entries: [entry], handled: [] },
          now,
        ),
      ).toEqual({ ready: true, retry: false });
      const rows = await db!
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.ownerId, ownerId));
      expect(rows.find((job) => job.key === first.key)?.status).toBe("local");
      expect(
        await repo!.claim(
          rows.find((job) => job.key === first.key)!,
          first.plan.due + 1000,
        ),
      ).toBeNull();
      const remote = rows.find((job) => job.key !== first.key)!;
      const claimed = await repo!.claim(remote, remote.due + 1000);
      expect(claimed?.item?.title).toBe(f.task.title);
      expect(claimed?.push.environment).toBe(environment);
      expect(await repo!.claim(remote, remote.due + 1000)).toBeNull();
      expect(
        (await prepare(ownerId, input([remote.key]), projectId)).blocked,
      ).toEqual([remote.key]);
      expect((await repo!.status(ownerId, deviceId)).ready).toBe(false);
    });
    it("rejects stale or forged coverage and rechecks completion immediately before dispatch", async () => {
      const f = await create();
      await prepare(ownerId, input(), projectId);
      expect(
        await repo!.commit(
          ownerId,
          { deviceId, cursor: f.cursor - 1, entries: [], handled: [] },
          now,
        ),
      ).toEqual({ ready: false, retry: true });
      const first = f.plans[0]!;
      expect(
        (
          await repo!.commit(
            ownerId,
            {
              deviceId,
              cursor: f.cursor,
              entries: [
                {
                  key: first.key,
                  occurrenceId: randomUUID(),
                  version: first.plan.version,
                  kind: first.plan.kind,
                  due: first.plan.due,
                  day: first.item.schedule.date,
                },
              ],
              handled: [],
            },
            now,
          )
        ).retry,
      ).toBe(true);
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries: [], handled: [] },
        now,
      );
      const completed = setState(first.item, "completed", "UTC", now + 1000);
      await sync!.push(ownerId, {
        protocolVersion: 1,
        deviceId,
        operations: [
          operation(f.task.id, {
            type: "state",
            target: occurrenceTarget(first.item),
            state: "completed",
            terminal: completed.terminal,
          }),
        ],
      });
      const jobs = await db!
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.ownerId, ownerId));
      for (const job of jobs)
        expect(await repo!.claim(job, job.due + 1000)).toBeNull();
    });
    it("keeps elapsed local coverage from becoming remote and purges tokens/jobs on unregister", async () => {
      const f = await create();
      await prepare(ownerId, input(), projectId);
      const entries = f.plans.map(({ key, item, plan }) => ({
        key,
        occurrenceId: item.id,
        version: plan.version,
        kind: plan.kind,
        due: plan.due,
        day: item.schedule.date,
      }));
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries, handled: [] },
        now,
      );
      const after = f.plans[1]!.plan.due + 1000;
      await prepare(ownerId, input(), projectId);
      await repo!.commit(
        ownerId,
        {
          deviceId,
          cursor: f.cursor,
          entries: [],
          handled: entries.map((e) => e.key),
        },
        after,
      );
      await repo!.reconcile(ownerId, after);
      expect(
        (await repo!.due(after)).filter((job) => job.ownerId === ownerId),
      ).toEqual([]);
      await accountRepository(db!).unregister(ownerId, deviceId);
      expect(
        await db!
          .select()
          .from(notificationDevices)
          .where(eq(notificationDevices.ownerId, ownerId)),
      ).toEqual([]);
      expect(
        await db!
          .select()
          .from(notificationJobs)
          .where(eq(notificationJobs.ownerId, ownerId)),
      ).toEqual([]);
    });
    it("marks interrupted sends uncertain and does not invalidate a replacement token from an old receipt", async () => {
      const f = await create();
      await prepare(ownerId, input(), projectId);
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries: [], handled: [] },
        now,
      );
      const [job] = await db!
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.ownerId, ownerId),
            eq(notificationJobs.key, f.plans[0]!.key),
          ),
        );
      await repo!.claim(job!, job!.due + 1000);
      await repo!.finish(
        job!,
        { status: "ticket", receiptId: "synthetic-receipt" },
        job!.due + 1000,
      );
      await prepare(
        ownerId,
        { ...input(), token: `ExpoPushToken[new-${ownerId}]` },
        projectId,
      );
      await repo!.commit(
        ownerId,
        { deviceId, cursor: f.cursor, entries: [], handled: [] },
        now,
      );
      await repo!.finish(
        job!,
        { status: "failed", error: "DeviceNotRegistered" },
        job!.due + 1000,
      );
      expect((await repo!.status(ownerId, deviceId)).ready).toBe(true);
      const [overdue] = await db!
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.ownerId, ownerId),
            eq(notificationJobs.key, f.plans[1]!.key),
          ),
        );
      await repo!.claim(overdue!, overdue!.due + 1000);
      await repo!.recover(overdue!.due + 121000);
      const [recovered] = await db!
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.ownerId, ownerId),
            eq(notificationJobs.key, overdue!.key),
          ),
        );
      expect(recovered?.status).toBe("uncertain");
      expect(await repo!.claim(recovered!, overdue!.due + 122000)).toBeNull();
    });
  },
);
