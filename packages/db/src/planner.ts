import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import {
  bootstrapSchema,
  deviceSchema,
  pushSchema,
  recordSchema,
  syncRecordSchema,
  preferenceRecordSchema,
  type Outcome,
  type TaskRecord,
} from "@timely/contracts";
import {
  appendOperation,
  appendSyncOperation,
  isPreferenceOperation,
  preferencesSuperseded,
  canonicalStamp,
  CommandError,
  reduceRecord,
  isSuperseded,
} from "@timely/sync";
import { database } from "./index";
import * as t from "./planner-schema";
type DB = ReturnType<typeof database>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
const owned = (column: typeof t.taskDefinitions.ownerId, ownerId: string) =>
  eq(column, ownerId);
function fingerprint(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}
async function lockHead(tx: Tx, ownerId: string) {
  await tx.insert(t.syncHeads).values({ ownerId }).onConflictDoNothing();
  const [head] = await tx
    .select()
    .from(t.syncHeads)
    .where(eq(t.syncHeads.ownerId, ownerId))
    .for("update");
  return head!.cursor;
}
export function planner(db: DB = database()) {
  return {
    async register(ownerId: string, input: unknown) {
      const device = deviceSchema.parse(input);
      await db
        .insert(t.syncDevices)
        .values({ ownerId, ...device })
        .onConflictDoUpdate({
          target: [t.syncDevices.ownerId, t.syncDevices.id],
          set: {
            zone: device.zone,
            platform: device.platform,
            lastSeen: new Date(),
          },
        });
      return { id: device.id };
    },
    async push(ownerId: string, input: unknown) {
      const batch = pushSchema.parse(input);
      return db.transaction(async (tx) => {
        let cursor = await lockHead(tx, ownerId);
        const [device] = await tx
          .select()
          .from(t.syncDevices)
          .where(
            and(
              eq(t.syncDevices.ownerId, ownerId),
              eq(t.syncDevices.id, batch.deviceId),
            ),
          );
        if (!device)
          throw new CommandError(
            "FORBIDDEN",
            "Register this device before synchronizing.",
          );
        // Pause this installation's remote handoff atomically with its edits.
        // Uploading tasks must never depend on Expo token/config availability.
        await tx
          .update(t.notificationDevices)
          .set({ ready: false })
          .where(
            and(
              eq(t.notificationDevices.ownerId, ownerId),
              eq(t.notificationDevices.deviceId, batch.deviceId),
            ),
          );
        const results: Outcome[] = [];
        for (const authored of batch.operations) {
          const digest = fingerprint(authored);
          const [prior] = await tx
            .select()
            .from(t.syncOperations)
            .where(
              and(
                eq(t.syncOperations.ownerId, ownerId),
                eq(t.syncOperations.id, authored.id),
              ),
            );
          if (prior) {
            if (prior.fingerprint !== digest)
              throw new CommandError(
                "INVALID_COMMAND",
                "An operation ID cannot be reused for different content.",
              );
            results.push(prior.result);
            continue;
          }
          if (isPreferenceOperation(authored)) {
            const [row] = await tx
              .select()
              .from(t.userPreferences)
              .where(eq(t.userPreferences.ownerId, ownerId));
            const canonical = {
              ...authored,
              stamp: canonicalStamp(authored.stamp, Date.now()),
            };
            const record = preferenceRecordSchema.parse(
              appendSyncOperation(row?.record, canonical),
            );
            await tx
              .insert(t.userPreferences)
              .values({ ownerId, record })
              .onConflictDoUpdate({
                target: t.userPreferences.ownerId,
                set: { record, updatedAt: new Date() },
              });
            cursor++;
            const result: Outcome = {
              id: authored.id,
              disposition: preferencesSuperseded(record, canonical)
                ? "superseded"
                : "applied",
              stamp: canonical.stamp,
              record,
              cursor,
            };
            await tx
              .insert(t.syncOperations)
              .values({
                ownerId,
                id: authored.id,
                deviceId: authored.deviceId,
                fingerprint: digest,
                command: canonical,
                result,
              });
            await tx.insert(t.syncChanges).values({ ownerId, cursor, record });
            if (canonical.command.patch.reminders)
              await tx
                .insert(t.jobOutbox)
                .values({
                  ownerId,
                  operationId: authored.id,
                  type: "reconcile-preferences",
                });
            results.push(result);
            continue;
          }
          const [row] = await tx
            .select()
            .from(t.taskDefinitions)
            .where(
              and(
                eq(t.taskDefinitions.ownerId, ownerId),
                eq(t.taskDefinitions.id, authored.definitionId),
              ),
            );
          if (!row && authored.command.type !== "create")
            throw new CommandError(
              "DEPENDENCY_MISSING",
              "This task is unavailable in the current account.",
            );
          const canonical = {
            ...authored,
            stamp: canonicalStamp(authored.stamp, Date.now()),
          };
          const record = appendOperation(
            row ? recordSchema.parse(row.record) : undefined,
            canonical,
          );
          const series = reduceRecord(record);
          await tx
            .insert(t.taskDefinitions)
            .values({ ownerId, id: record.id, record })
            .onConflictDoUpdate({
              target: [t.taskDefinitions.ownerId, t.taskDefinitions.id],
              set: { record, updatedAt: new Date() },
            });
          for (const revision of series.revisions) {
            await tx
              .insert(t.recurrenceRevisions)
              .values({
                ownerId,
                definitionId: record.id,
                id: revision.id,
                payload: record.operations.find(
                  (operation) => operation.id === revision.id,
                )!,
              })
              .onConflictDoNothing();
          }
          // Rebuild only this definition's sparse exceptions; generated slots remain bounded projections.
          await tx
            .delete(t.taskOccurrences)
            .where(
              and(
                eq(t.taskOccurrences.ownerId, ownerId),
                eq(t.taskOccurrences.definitionId, record.id),
              ),
            );
          const exceptions = Object.values(series.exceptions).map(
            ({ value }) => ({
              ownerId,
              definitionId: record.id,
              id: value.id,
              revisionId: value.revisionId,
              slot: value.slot,
              scheduledDate: value.schedule.date,
              state: value.state,
              payload: value,
            }),
          );
          if (exceptions.length)
            await tx.insert(t.taskOccurrences).values(exceptions);
          cursor++;
          const result: Outcome = {
            id: authored.id,
            disposition: isSuperseded(record, canonical)
              ? "superseded"
              : "applied",
            stamp: canonical.stamp,
            record,
            cursor,
          };
          await tx.insert(t.syncOperations).values({
            ownerId,
            id: authored.id,
            deviceId: authored.deviceId,
            fingerprint: digest,
            command: canonical,
            result,
          });
          await tx.insert(t.syncChanges).values({ ownerId, cursor, record });
          await tx.insert(t.jobOutbox).values({
            ownerId,
            operationId: authored.id,
            definitionId: record.id,
            type: "reconcile-definition",
          });
          if (authored.command.type !== "create")
            await tx.insert(t.occurrenceEvents).values({
              ownerId,
              operationId: authored.id,
              occurrenceId: authored.command.target.id,
              type: authored.command.type,
            });
          results.push(result);
        }
        await tx
          .update(t.syncHeads)
          .set({ cursor })
          .where(eq(t.syncHeads.ownerId, ownerId));
        return { results, watermark: cursor, serverTime: Date.now() };
      });
    },
    async pull(ownerId: string, cursor: number, limit = 500) {
      if (
        !Number.isSafeInteger(cursor) ||
        cursor < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 500
      )
        throw new CommandError(
          "INVALID_COMMAND",
          "Invalid feed cursor or page size.",
        );
      const [head] = await db
        .select()
        .from(t.syncHeads)
        .where(eq(t.syncHeads.ownerId, ownerId));
      if (cursor > (head?.cursor ?? 0))
        throw new CommandError(
          "INVALID_COMMAND",
          "The cursor is ahead of this account.",
        );
      const rows = await db
        .select()
        .from(t.syncChanges)
        .where(
          and(
            eq(t.syncChanges.ownerId, ownerId),
            gt(t.syncChanges.cursor, cursor),
          ),
        )
        .orderBy(asc(t.syncChanges.cursor))
        .limit(limit + 1);
      const changes = rows.slice(0, limit).map((row) => ({
        cursor: row.cursor,
        record: syncRecordSchema.parse(row.record),
      }));
      return {
        changes,
        cursor: changes.at(-1)?.cursor ?? cursor,
        more: rows.length > limit,
        serverTime: Date.now(),
      };
    },
    async bootstrap(ownerId: string, input: unknown) {
      const request = bootstrapSchema.parse(input);
      const token = request.token ?? randomUUID();
      if (!request.token) {
        if (request.after)
          throw new CommandError(
            "INVALID_COMMAND",
            "Start a snapshot at position zero.",
          );
        await db.transaction(async (tx) => {
          const watermark = await lockHead(tx, ownerId);
          const expired = await tx
            .select()
            .from(t.syncSnapshots)
            .where(
              and(
                eq(t.syncSnapshots.ownerId, ownerId),
                lt(t.syncSnapshots.expiresAt, new Date()),
              ),
            );
          for (const snapshot of expired)
            await tx
              .delete(t.snapshotItems)
              .where(
                and(
                  eq(t.snapshotItems.ownerId, ownerId),
                  eq(t.snapshotItems.token, snapshot.id),
                ),
              );
          await tx
            .delete(t.syncSnapshots)
            .where(
              and(
                eq(t.syncSnapshots.ownerId, ownerId),
                lt(t.syncSnapshots.expiresAt, new Date()),
              ),
            );
          await tx.insert(t.syncSnapshots).values({
            ownerId,
            id: token,
            watermark,
            expiresAt: new Date(Date.now() + 3600000),
          });
          // Owner lock makes this fixed snapshot agree with the feed watermark. No transaction survives this request.
          await tx.execute(
            sql`insert into timely.snapshot_items (owner_id, token, position, record) select owner_id, ${token}::uuid, row_number() over (order by id)::integer, record from (select owner_id, id::text, record from timely.task_definitions where owner_id = ${ownerId} union all select owner_id, 'preferences' as id, record from timely.user_preferences where owner_id = ${ownerId}) as snapshot`,
          );
        });
      }
      const [snapshot] = await db
        .select()
        .from(t.syncSnapshots)
        .where(
          and(
            eq(t.syncSnapshots.ownerId, ownerId),
            eq(t.syncSnapshots.id, token),
            gt(t.syncSnapshots.expiresAt, new Date()),
          ),
        );
      if (!snapshot) return { expired: true as const };
      const rows = await db
        .select()
        .from(t.snapshotItems)
        .where(
          and(
            eq(t.snapshotItems.ownerId, ownerId),
            eq(t.snapshotItems.token, token),
            gt(t.snapshotItems.position, request.after),
          ),
        )
        .orderBy(asc(t.snapshotItems.position))
        .limit(request.limit + 1);
      return {
        token,
        records: rows
          .slice(0, request.limit)
          .map((r) => syncRecordSchema.parse(r.record)),
        watermark: snapshot.watermark,
        next:
          rows.length > request.limit
            ? rows[request.limit - 1]!.position
            : null,
        serverTime: Date.now(),
      };
    },
    async records(ownerId: string): Promise<TaskRecord[]> {
      return (
        await db
          .select()
          .from(t.taskDefinitions)
          .where(owned(t.taskDefinitions.ownerId, ownerId))
      ).map((row) => recordSchema.parse(row.record));
    },
  };
}
