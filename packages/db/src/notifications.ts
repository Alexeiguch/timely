import { NotificationRecords } from "./notification-records";
import { lockOwner } from "./owner-lock";
import { randomUUID } from "node:crypto";
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
  sql,
} from "drizzle-orm";
import {
  notificationRegistrationSchema,
  notificationCoverageSchema,
  type NotificationCoverage,
  type NotificationRegistration,
} from "@timely/contracts";
import { CommandError, remoteReminderCandidates } from "@timely/sync";
import { database } from "./index";
import * as t from "./planner-schema";
type DB = ReturnType<typeof database>;
export type NotificationJob = typeof t.notificationJobs.$inferSelect;
const committed = [
  "dispatching",
  "ticket",
  "delivered",
  "uncertain",
  "handled",
];
const reversible = NotificationRecords.reversible;
export const pushTokenHash = NotificationRecords.tokenHash;
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
        const device = await NotificationRecords.ownedDevice(
          tx,
          ownerId,
          value.deviceId,
        );
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
        const device = await NotificationRecords.ownedDevice(
          tx,
          ownerId,
          value.deviceId,
        );
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
        const state = await NotificationRecords.snapshot(tx, ownerId);
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
        await NotificationRecords.insertJobs(
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
              ...NotificationRecords.jobValues(ownerId, value.deviceId, entry),
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
        await NotificationRecords.updateJobStatuses(
          tx,
          ownerId,
          value.deviceId,
          statuses,
        );
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
        await NotificationRecords.ownedDevice(tx, ownerId, deviceId);
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
      // One owner per slot across both sources, least recently attempted first.
      // The conditional upsert leases the batch across overlapping workers.
      return db.transaction(async (tx) => {
        const candidates = await tx.execute<{ owner_id: string }>(sql`
          select candidates.owner_id
          from (
            select owner_id, min(due) as due from (
              select owner_id, extract(epoch from created_at) * 1000 as due
              from ${t.jobOutbox}
              where processed_at is null and type in ('reconcile-definition', 'reconcile-preferences')
              union all
              select owner_id, planned_through as due from ${t.notificationDevices}
              where permission = 'granted' and planned_through <= ${now + 6 * 86400000}
            ) sources group by owner_id
          ) candidates
          left join ${t.notificationReconciliations} work on work.owner_id = candidates.owner_id
          where coalesce(work.next_attempt, 0) <= ${now}
          order by coalesce(work.last_attempt, 0), candidates.due, candidates.owner_id
          limit 50
        `);
        if (!candidates.length) return [];
        const claimed = await tx
          .insert(t.notificationReconciliations)
          .values(
            candidates.map(({ owner_id }) => ({
              ownerId: owner_id,
              lastAttempt: now,
              nextAttempt: now + 60000,
            })),
          )
          .onConflictDoUpdate({
            target: t.notificationReconciliations.ownerId,
            set: { lastAttempt: now, nextAttempt: now + 60000 },
            setWhere: lte(t.notificationReconciliations.nextAttempt, now),
          })
          .returning({ ownerId: t.notificationReconciliations.ownerId });
        const selected = new Set(claimed.map((row) => row.ownerId));
        return candidates
          .filter((row) => selected.has(row.owner_id))
          .map((row) => row.owner_id);
      });
    },
    async reconciliationFailed(ownerId: string, now = Date.now()) {
      // Keep failed work discoverable, with bounded exponential backoff.
      await db
        .insert(t.notificationReconciliations)
        .values({
          ownerId,
          lastAttempt: now,
          nextAttempt: now + 60000,
          attempts: 1,
        })
        .onConflictDoUpdate({
          target: t.notificationReconciliations.ownerId,
          set: {
            attempts: sql`${t.notificationReconciliations.attempts} + 1`,
            nextAttempt: sql`${now} + least(3600000, 60000 * power(2, least(${t.notificationReconciliations.attempts}, 6)))`,
          },
          setWhere: eq(t.notificationReconciliations.lastAttempt, now),
        });
    },
    async reconcile(ownerId: string, now = Date.now()) {
      await db.transaction(async (tx) => {
        await lockOwner(tx, ownerId);
        const state = await NotificationRecords.snapshot(tx, ownerId);
        const devices = await tx
          .select()
          .from(t.notificationDevices)
          .where(eq(t.notificationDevices.ownerId, ownerId));
        for (const push of devices) {
          const device = await NotificationRecords.ownedDevice(
            tx,
            ownerId,
            push.deviceId,
          );
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
          await NotificationRecords.insertJobs(
            tx,
            candidates
              .filter(
                (entry) =>
                  !priorKeys.has(entry.key) &&
                  !(entry.plan.kind === "before" && entry.plan.due <= now),
              )
              .map((entry) =>
                NotificationRecords.jobValues(ownerId, device.id, entry),
              ),
          );
          const cancelled = existing
            .filter(
              (job) =>
                reversible.includes(job.status) &&
                job.kind !== "test" &&
                !desired.has(job.key),
            )
            .map((job) => job.key);
          await NotificationRecords.updateJobStatuses(
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
          .update(t.notificationReconciliations)
          .set({ attempts: 0, nextAttempt: 0 })
          .where(
            and(
              eq(t.notificationReconciliations.ownerId, ownerId),
              lte(t.notificationReconciliations.lastAttempt, now),
            ),
          );
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
        const device = await NotificationRecords.ownedDevice(
          tx,
          job.ownerId,
          job.deviceId,
        );
        const state = await NotificationRecords.snapshot(tx, job.ownerId);
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
