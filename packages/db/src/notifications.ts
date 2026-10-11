import { createHash, randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  notificationRegistrationSchema,
  notificationCoverageSchema,
  recordSchema,
  preferenceRecordSchema,
  type NotificationCoverage,
  type NotificationRegistration,
} from "@timely/contracts";
import {
  CommandError,
  reducePreferences,
  remoteReminderCandidates,
} from "@timely/sync";
import { database } from "./index";
import * as t from "./planner-schema";
type DB = ReturnType<typeof database>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type NotificationJob = typeof t.notificationJobs.$inferSelect;
const committed = [
  "dispatching",
  "ticket",
  "delivered",
  "uncertain",
  "handled",
];
const reversible = ["pending", "local"];
export function pushTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
async function lockOwner(tx: Tx, ownerId: string) {
  await tx.insert(t.syncHeads).values({ ownerId }).onConflictDoNothing();
  const [head] = await tx
    .select()
    .from(t.syncHeads)
    .where(eq(t.syncHeads.ownerId, ownerId))
    .for("update");
  return head!.cursor;
}
async function snapshot(tx: Tx, ownerId: string) {
  const records = (
    await tx
      .select({ record: t.taskDefinitions.record })
      .from(t.taskDefinitions)
      .where(eq(t.taskDefinitions.ownerId, ownerId))
  ).map((row) => recordSchema.parse(row.record));
  const [preferences] = await tx
    .select()
    .from(t.userPreferences)
    .where(eq(t.userPreferences.ownerId, ownerId));
  return {
    records,
    preferences: reducePreferences(
      preferences
        ? preferenceRecordSchema.parse(preferences.record)
        : undefined,
    ),
  };
}
async function ownedDevice(tx: Tx, ownerId: string, deviceId: string) {
  const [device] = await tx
    .select()
    .from(t.syncDevices)
    .where(
      and(eq(t.syncDevices.ownerId, ownerId), eq(t.syncDevices.id, deviceId)),
    );
  if (!device || device.platform === "web")
    throw new CommandError(
      "FORBIDDEN",
      "Register this mobile device before enabling push.",
    );
  return device;
}
function jobValues(
  ownerId: string,
  deviceId: string,
  entry: ReturnType<typeof remoteReminderCandidates>[number],
) {
  return {
    ownerId,
    deviceId,
    key: entry.key,
    occurrenceId: entry.item.id,
    definitionId: entry.item.definitionId,
    version: entry.plan.version,
    kind: entry.plan.kind,
    day: entry.item.schedule.date,
    due: entry.plan.due,
    expires: entry.expires,
  };
}
async function insertJobs(
  tx: Tx,
  jobs: (typeof t.notificationJobs.$inferInsert)[],
) {
  for (let start = 0; start < jobs.length; start += 500)
    await tx
      .insert(t.notificationJobs)
      .values(jobs.slice(start, start + 500))
      .onConflictDoNothing();
}
async function updateJobStatuses(
  tx: Tx,
  ownerId: string,
  deviceId: string,
  statuses: Map<string, string[]>,
) {
  for (const [status, keys] of statuses)
    for (let start = 0; start < keys.length; start += 500)
      await tx
        .update(t.notificationJobs)
        .set({ status })
        .where(
          and(
            eq(t.notificationJobs.ownerId, ownerId),
            eq(t.notificationJobs.deviceId, deviceId),
            inArray(t.notificationJobs.key, keys.slice(start, start + 500)),
            inArray(t.notificationJobs.status, reversible),
          ),
        );
}
export function notificationRepository(db: DB = database()) {
  return {
    /** Pause remote dispatch before touching the OS. A crash leaves local ownership protected until reconciliation. */
    async prepare(
      ownerId: string,
      input: unknown,
      projectId: string,
      environment: string,
    ) {
      const value: NotificationRegistration =
        notificationRegistrationSchema.parse(input);
      if (value.projectId !== projectId)
        throw new CommandError(
          "FORBIDDEN",
          "This push project is unavailable.",
        );
      return db.transaction(async (tx) => {
        await lockOwner(tx, ownerId);
        const device = await ownedDevice(tx, ownerId, value.deviceId);
        if (device.platform !== value.platform)
          throw new CommandError(
            "FORBIDDEN",
            "This device platform does not match.",
          );
        const tokenHash = value.token ? pushTokenHash(value.token) : null;
        if (tokenHash) {
          const [binding] = await tx
            .select({
              ownerId: t.notificationDevices.ownerId,
              deviceId: t.notificationDevices.deviceId,
            })
            .from(t.notificationDevices)
            .where(eq(t.notificationDevices.tokenHash, tokenHash));
          if (
            binding &&
            (binding.ownerId !== ownerId || binding.deviceId !== value.deviceId)
          )
            throw new CommandError(
              "FORBIDDEN",
              "Sign out of the previous installation before enabling push.",
            );
        }
        await tx
          .update(t.syncDevices)
          .set({ zone: value.zone, lastSeen: new Date() })
          .where(
            and(
              eq(t.syncDevices.ownerId, ownerId),
              eq(t.syncDevices.id, value.deviceId),
            ),
          );
        await tx
          .insert(t.notificationDevices)
          .values({
            ownerId,
            deviceId: value.deviceId,
            projectId,
            environment,
            token: value.token,
            tokenHash,
            permission: value.permission,
            language: value.language,
            ready: false,
          })
          .onConflictDoUpdate({
            target: [
              t.notificationDevices.ownerId,
              t.notificationDevices.deviceId,
            ],
            set: {
              environment,
              token: value.token,
              tokenHash,
              permission: value.permission,
              language: value.language,
              ready: false,
              error: null,
              updatedAt: new Date(),
            },
          });
        if (value.permission !== "granted")
          await tx
            .update(t.notificationJobs)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(t.notificationJobs.ownerId, ownerId),
                eq(t.notificationJobs.deviceId, value.deviceId),
                inArray(t.notificationJobs.status, reversible),
              ),
            );
        const blocked = value.keys.length
          ? await tx
              .select({ key: t.notificationJobs.key })
              .from(t.notificationJobs)
              .where(
                and(
                  eq(t.notificationJobs.ownerId, ownerId),
                  eq(t.notificationJobs.deviceId, value.deviceId),
                  inArray(t.notificationJobs.key, value.keys),
                  inArray(t.notificationJobs.status, committed),
                ),
              )
          : [];
        return { blocked: blocked.map((row) => row.key) };
      });
    },
    async commit(ownerId: string, input: unknown, now = Date.now()) {
      const value: NotificationCoverage =
        notificationCoverageSchema.parse(input);
      return db.transaction(async (tx) => {
        const cursor = await lockOwner(tx, ownerId);
        const device = await ownedDevice(tx, ownerId, value.deviceId);
        const [push] = await tx
          .select()
          .from(t.notificationDevices)
          .where(
            and(
              eq(t.notificationDevices.ownerId, ownerId),
              eq(t.notificationDevices.deviceId, value.deviceId),
            ),
          )
          .for("update");
        if (!push)
          throw new CommandError(
            "FORBIDDEN",
            "Enable push on this device first.",
          );
        const pause = () =>
          tx
            .update(t.notificationDevices)
            .set({ ready: false })
            .where(
              and(
                eq(t.notificationDevices.ownerId, ownerId),
                eq(t.notificationDevices.deviceId, value.deviceId),
              ),
            );
        await pause();
        if (cursor !== value.cursor) return { ready: false, retry: true };
        const state = await snapshot(tx, ownerId);
        const candidates = remoteReminderCandidates(
          state.records,
          state.preferences,
          value.deviceId,
          device.zone,
          now,
        );
        const desired = new Map(candidates.map((entry) => [entry.key, entry]));
        for (const entry of value.entries) {
          const canonical = desired.get(entry.key);
          if (
            !canonical ||
            canonical.item.id !== entry.occurrenceId ||
            canonical.plan.version !== entry.version ||
            canonical.plan.kind !== entry.kind ||
            canonical.plan.due !== entry.due ||
            canonical.item.schedule.date !== entry.day
          )
            return { ready: false, retry: true };
        }
        const existing = await tx
          .select()
          .from(t.notificationJobs)
          .where(
            and(
              eq(t.notificationJobs.ownerId, ownerId),
              eq(t.notificationJobs.deviceId, value.deviceId),
              or(
                inArray(t.notificationJobs.status, reversible),
                desired.size
                  ? inArray(t.notificationJobs.key, [...desired.keys()])
                  : undefined,
              ),
            ),
          );
        const priorByKey = new Map(existing.map((job) => [job.key, job]));
        const claimed = new Set(value.entries.map((entry) => entry.key));
        const handled = new Set(value.handled);
        for (const entry of value.entries) {
          const prior = priorByKey.get(entry.key);
          if (prior && committed.includes(prior.status))
            return { ready: false, retry: true };
        }
        await insertJobs(
          tx,
          candidates
            .filter(
              (entry) =>
                !priorByKey.has(entry.key) &&
                !(
                  entry.plan.kind === "before" &&
                  entry.plan.due <= now &&
                  !claimed.has(entry.key)
                ),
            )
            .map((entry) => ({
              ...jobValues(ownerId, value.deviceId, entry),
              status:
                handled.has(entry.key) && entry.plan.due <= now
                  ? "handled"
                  : claimed.has(entry.key)
                    ? "local"
                    : "pending",
            })),
        );
        const statuses = new Map<string, string[]>();
        for (const job of existing) {
          if (!reversible.includes(job.status) || job.kind === "test") continue;
          const status = !desired.has(job.key)
            ? "cancelled"
            : handled.has(job.key) && job.due <= now
              ? "handled"
              : claimed.has(job.key)
                ? "local"
                : job.status === "local"
                  ? job.due <= now
                    ? "handled"
                    : "pending"
                  : job.status;
          if (status !== job.status) {
            const keys = statuses.get(status) ?? [];
            keys.push(job.key);
            statuses.set(status, keys);
          }
        }
        await updateJobStatuses(tx, ownerId, value.deviceId, statuses);
        const ready = push.permission === "granted" && !!push.token;
        await tx
          .update(t.notificationDevices)
          .set({
            ready,
            plannedThrough: now + 7 * 86400000,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(t.notificationDevices.ownerId, ownerId),
              eq(t.notificationDevices.deviceId, value.deviceId),
            ),
          );
        return { ready, retry: false };
      });
    },
    async status(ownerId: string, deviceId: string) {
      const [row] = await db
        .select({
          ready: t.notificationDevices.ready,
          error: t.notificationDevices.error,
        })
        .from(t.notificationDevices)
        .where(
          and(
            eq(t.notificationDevices.ownerId, ownerId),
            eq(t.notificationDevices.deviceId, deviceId),
          ),
        );
      return row ?? { ready: false, error: null };
    },
    async test(ownerId: string, deviceId: string, now = Date.now()) {
      return db.transaction(async (tx) => {
        await lockOwner(tx, ownerId);
        await ownedDevice(tx, ownerId, deviceId);
        const [push] = await tx
          .select()
          .from(t.notificationDevices)
          .where(
            and(
              eq(t.notificationDevices.ownerId, ownerId),
              eq(t.notificationDevices.deviceId, deviceId),
            ),
          );
        if (!push?.ready || !push.token || push.permission !== "granted")
          throw new CommandError(
            "FORBIDDEN",
            "Enable remote reminders on this device first.",
          );
        const [recent] = await tx
          .select()
          .from(t.notificationJobs)
          .where(
            and(
              eq(t.notificationJobs.ownerId, ownerId),
              eq(t.notificationJobs.deviceId, deviceId),
              eq(t.notificationJobs.kind, "test"),
              gt(t.notificationJobs.createdAt, new Date(now - 60000)),
            ),
          );
        if (recent)
          throw new CommandError(
            "INVALID_COMMAND",
            "Wait a minute before sending another test.",
          );
        await tx.insert(t.notificationJobs).values({
          ownerId,
          deviceId,
          key: randomUUID(),
          kind: "test",
          due: now + 30000,
          expires: now + 120000,
        });
        return { queued: true, delaySeconds: 30 };
      });
    },
    async owners(now = Date.now()) {
      const rows = await db
        .select({ ownerId: t.jobOutbox.ownerId })
        .from(t.jobOutbox)
        .where(isNull(t.jobOutbox.processedAt))
        .groupBy(t.jobOutbox.ownerId)
        .limit(50);
      const rolling = await db
        .select({ ownerId: t.notificationDevices.ownerId })
        .from(t.notificationDevices)
        .where(
          and(
            eq(t.notificationDevices.permission, "granted"),
            lte(t.notificationDevices.plannedThrough, now + 6 * 86400000),
          ),
        )
        .limit(50);
      return [...new Set([...rows, ...rolling].map((row) => row.ownerId))];
    },
    async reconcile(ownerId: string, now = Date.now()) {
      await db.transaction(async (tx) => {
        await lockOwner(tx, ownerId);
        const state = await snapshot(tx, ownerId);
        const devices = await tx
          .select()
          .from(t.notificationDevices)
          .where(eq(t.notificationDevices.ownerId, ownerId));
        for (const push of devices) {
          const device = await ownedDevice(tx, ownerId, push.deviceId);
          const candidates =
            push.permission === "granted" && push.token
              ? remoteReminderCandidates(
                  state.records,
                  state.preferences,
                  device.id,
                  device.zone,
                  now,
                )
              : [];
          const desired = new Set(candidates.map((entry) => entry.key));
          const existing = await tx
            .select()
            .from(t.notificationJobs)
            .where(
              and(
                eq(t.notificationJobs.ownerId, ownerId),
                eq(t.notificationJobs.deviceId, device.id),
                or(
                  inArray(t.notificationJobs.status, reversible),
                  desired.size
                    ? inArray(t.notificationJobs.key, [...desired])
                    : undefined,
                ),
              ),
            );
          const priorKeys = new Set(existing.map((job) => job.key));
          await insertJobs(
            tx,
            candidates
              .filter(
                (entry) =>
                  !priorKeys.has(entry.key) &&
                  !(entry.plan.kind === "before" && entry.plan.due <= now),
              )
              .map((entry) => jobValues(ownerId, device.id, entry)),
          );
          const cancelled = existing
            .filter(
              (job) =>
                reversible.includes(job.status) &&
                job.kind !== "test" &&
                !desired.has(job.key),
            )
            .map((job) => job.key);
          await updateJobStatuses(
            tx,
            ownerId,
            device.id,
            new Map([["cancelled", cancelled]]),
          );
          await tx
            .update(t.notificationDevices)
            .set({ plannedThrough: now + 7 * 86400000 })
            .where(
              and(
                eq(t.notificationDevices.ownerId, ownerId),
                eq(t.notificationDevices.deviceId, device.id),
              ),
            );
        }
        await tx
          .update(t.jobOutbox)
          .set({ processedAt: new Date(now) })
          .where(
            and(
              eq(t.jobOutbox.ownerId, ownerId),
              isNull(t.jobOutbox.processedAt),
              inArray(t.jobOutbox.type, [
                "reconcile-definition",
                "reconcile-preferences",
              ]),
            ),
          );
      });
    },
    async due(now = Date.now()) {
      const rows = await db
        .select({ job: t.notificationJobs })
        .from(t.notificationJobs)
        .innerJoin(
          t.notificationDevices,
          and(
            eq(t.notificationDevices.ownerId, t.notificationJobs.ownerId),
            eq(t.notificationDevices.deviceId, t.notificationJobs.deviceId),
          ),
        )
        .where(
          and(
            eq(t.notificationJobs.status, "pending"),
            lte(t.notificationJobs.due, now),
            lte(t.notificationJobs.nextAttempt, now),
            gt(t.notificationJobs.expires, now),
            eq(t.notificationDevices.ready, true),
            eq(t.notificationDevices.permission, "granted"),
            isNotNull(t.notificationDevices.token),
          ),
        )
        .orderBy(asc(t.notificationJobs.due), asc(t.notificationJobs.key))
        .limit(100);
      return rows.map((row) => row.job);
    },
    async claim(job: NotificationJob, now = Date.now()) {
      return db.transaction(async (tx) => {
        await lockOwner(tx, job.ownerId);
        const [current] = await tx
          .select()
          .from(t.notificationJobs)
          .where(
            and(
              eq(t.notificationJobs.ownerId, job.ownerId),
              eq(t.notificationJobs.deviceId, job.deviceId),
              eq(t.notificationJobs.key, job.key),
            ),
          )
          .for("update");
        const [push] = await tx
          .select()
          .from(t.notificationDevices)
          .where(
            and(
              eq(t.notificationDevices.ownerId, job.ownerId),
              eq(t.notificationDevices.deviceId, job.deviceId),
            ),
          );
        if (current?.status === "pending" && current.expires <= now) {
          await tx
            .update(t.notificationJobs)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(t.notificationJobs.ownerId, job.ownerId),
                eq(t.notificationJobs.deviceId, job.deviceId),
                eq(t.notificationJobs.key, job.key),
              ),
            );
          return null;
        }
        if (
          !current ||
          current.status !== "pending" ||
          current.due > now ||
          current.nextAttempt > now ||
          !push?.ready ||
          !push.token ||
          push.permission !== "granted"
        )
          return null;
        const device = await ownedDevice(tx, job.ownerId, job.deviceId);
        const state = await snapshot(tx, job.ownerId);
        const canonical =
          current.kind === "test"
            ? null
            : remoteReminderCandidates(
                state.records,
                state.preferences,
                device.id,
                device.zone,
                now,
              ).find((entry) => entry.key === current.key);
        const valid = current.kind === "test" || !!canonical;
        if (!valid || current.expires <= now) {
          await tx
            .update(t.notificationJobs)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(t.notificationJobs.ownerId, job.ownerId),
                eq(t.notificationJobs.deviceId, job.deviceId),
                eq(t.notificationJobs.key, job.key),
              ),
            );
          return null;
        }
        await tx
          .update(t.notificationJobs)
          .set({
            status: "dispatching",
            startedAt: now,
            attempts: current.attempts + 1,
            dispatchTokenHash: push.tokenHash,
          })
          .where(
            and(
              eq(t.notificationJobs.ownerId, job.ownerId),
              eq(t.notificationJobs.deviceId, job.deviceId),
              eq(t.notificationJobs.key, job.key),
            ),
          );
        return { job: current, push, item: canonical?.item ?? null };
      });
    },
    async finish(
      job: NotificationJob,
      result: {
        status: string;
        receiptId?: string;
        error?: string;
        nextAttempt?: number;
      },
      now = Date.now(),
    ) {
      await db.transaction(async (tx) => {
        await lockOwner(tx, job.ownerId);
        await tx
          .update(t.notificationJobs)
          .set({
            status: result.status,
            error: result.error ?? null,
            receiptId: result.receiptId ?? null,
            receiptDue: result.receiptId ? now + 15 * 60000 : null,
            nextAttempt: result.nextAttempt ?? 0,
          })
          .where(
            and(
              eq(t.notificationJobs.ownerId, job.ownerId),
              eq(t.notificationJobs.deviceId, job.deviceId),
              eq(t.notificationJobs.key, job.key),
              inArray(t.notificationJobs.status, ["dispatching", "ticket"]),
            ),
          );
        if (
          result.error === "DeviceNotRegistered" ||
          result.error === "InvalidCredentials"
        ) {
          const [saved] = await tx
            .select()
            .from(t.notificationJobs)
            .where(
              and(
                eq(t.notificationJobs.ownerId, job.ownerId),
                eq(t.notificationJobs.deviceId, job.deviceId),
                eq(t.notificationJobs.key, job.key),
              ),
            );
          await tx
            .update(t.notificationDevices)
            .set({
              ready: false,
              error: result.error,
              ...(result.error === "DeviceNotRegistered"
                ? { token: null, tokenHash: null }
                : {}),
            })
            .where(
              and(
                eq(t.notificationDevices.ownerId, job.ownerId),
                eq(t.notificationDevices.deviceId, job.deviceId),
                eq(
                  t.notificationDevices.tokenHash,
                  saved?.dispatchTokenHash ?? "",
                ),
              ),
            );
        }
      });
    },
    async receipts(now = Date.now()) {
      return db
        .select()
        .from(t.notificationJobs)
        .where(
          and(
            eq(t.notificationJobs.status, "ticket"),
            lte(t.notificationJobs.receiptDue, now),
          ),
        )
        .limit(100);
    },
    async postponeReceipt(job: NotificationJob, now = Date.now()) {
      await db
        .update(t.notificationJobs)
        .set({ receiptDue: now + 60000 })
        .where(
          and(
            eq(t.notificationJobs.ownerId, job.ownerId),
            eq(t.notificationJobs.deviceId, job.deviceId),
            eq(t.notificationJobs.key, job.key),
            eq(t.notificationJobs.status, "ticket"),
          ),
        );
    },
    async recover(now = Date.now()) {
      await db
        .update(t.notificationJobs)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(t.notificationJobs.status, "pending"),
            lte(t.notificationJobs.expires, now),
          ),
        );
      // A crash after provider acceptance is ambiguous. Never retry that visible send automatically.
      await db
        .update(t.notificationJobs)
        .set({ status: "uncertain", error: "DispatchInterrupted" })
        .where(
          and(
            eq(t.notificationJobs.status, "dispatching"),
            lte(t.notificationJobs.startedAt, now - 120000),
          ),
        );
      await db
        .update(t.notificationJobs)
        .set({ status: "uncertain", error: "ReceiptUnavailable" })
        .where(
          and(
            eq(t.notificationJobs.status, "ticket"),
            lte(t.notificationJobs.startedAt, now - 23 * 3600000),
          ),
        );
    },
  };
}
