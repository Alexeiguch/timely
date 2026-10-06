import { createHash } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import { historyRequestSchema, historyResponseSchema, recordSchema, type Occurrence } from "@timely/contracts";
import { projectSeries, status } from "@timely/domain";
import { reduceRecord } from "@timely/sync";
import { database } from "./index";
import { planner } from "./planner";
import { snapshotItems, syncSnapshots } from "./planner-schema";
export class HistoryExpired extends Error {}

/** A fixed account snapshot bounds every page and preserves terminal snapshots across edits. */
export function historyRepository(db = database()) {
  return {
    async page(ownerId: string, input: unknown) {
      const request = historyRequestSchema.parse(input);
      const { cursor, limit, ...filter } = request;
      const signature = createHash("sha256").update(JSON.stringify(filter)).digest("hex");
      if (cursor && cursor.signature !== signature) throw new HistoryExpired("Restart history after changing filters.");
      let token = cursor?.token;
      if (!token) {
        const first = await planner(db).bootstrap(ownerId, { limit: 1 });
        if ("expired" in first) throw new HistoryExpired("Restart this historical search.");
        token = first.token;
      }
      const [snapshot] = await db.select().from(syncSnapshots).where(and(
        eq(syncSnapshots.ownerId, ownerId), eq(syncSnapshots.id, token), gt(syncSnapshots.expiresAt, new Date()),
      ));
      if (!snapshot) throw new HistoryExpired("This history snapshot expired. Restart the search.");
      const evaluatedAt = snapshot.expiresAt.getTime() - 3600000;
      const rows = await db.select().from(snapshotItems).where(and(
        eq(snapshotItems.ownerId, ownerId), eq(snapshotItems.token, token), gt(snapshotItems.position, cursor?.after ?? 0),
      )).orderBy(asc(snapshotItems.position)).limit(26);
      const items: Occurrence[] = [];
      let next: typeof cursor | null = null;
      for (const [index, row] of rows.slice(0, 25).entries()) {
        const record = recordSchema.safeParse(row.record);
        const occurrences = record.success && (!request.definitionId || request.definitionId === record.data.id)
          ? projectSeries(reduceRecord(record.data), request.from, request.through) : [];
        const skip = index === 0 ? cursor?.skip ?? 0 : 0;
        for (let offset = skip; offset < occurrences.length; offset++) {
          const item = occurrences[offset]!;
          if ((request.state === "all" || (request.state === "overdue" ? status(item, request.zone, evaluatedAt) === "overdue" : item.state === request.state)) &&
            (request.priority === "all" || (request.priority === "none" ? item.priority === null : item.priority === request.priority)) &&
            (!request.query || `${item.terminal?.title ?? item.title} ${item.notes}`.toLowerCase().includes(request.query.toLowerCase()))) items.push(item);
          if (items.length === limit) {
            next = offset + 1 < occurrences.length
              ? { token, after: row.position - 1, skip: offset + 1, signature }
              : index + 1 < rows.length ? { token, after: row.position, skip: 0, signature } : null;
            return historyResponseSchema.parse({ items, next, watermark: snapshot.watermark, evaluatedAt, coverage: { from: request.from, through: request.through } });
          }
        }
      }
      if (rows.length > 25) next = { token, after: rows[24]!.position, skip: 0, signature };
      return historyResponseSchema.parse({ items, next, watermark: snapshot.watermark, evaluatedAt, coverage: { from: request.from, through: request.through } });
    },
  };
}
