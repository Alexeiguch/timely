import { and, eq, gt, sql } from "drizzle-orm";
import { database } from "./index";
import { rateLimit, session, user } from "./auth-schema";
import { syncDevices, syncHeads } from "./planner-schema";

/** A shared fixed-window limiter. The upsert increments atomically across servers. */
export async function allowPlannerRequest(ownerId: string, now = Date.now(), db = database()) {
  const key = `planner:${ownerId}`;
  const boundary = now - 60000;
  const [row] = await db.insert(rateLimit).values({ id: key, key, count: 1, lastRequest: now })
    .onConflictDoUpdate({ target: rateLimit.key, set: {
      count: sql`case when ${rateLimit.lastRequest} <= ${boundary} then 1 else ${rateLimit.count} + 1 end`,
      lastRequest: sql`case when ${rateLimit.lastRequest} <= ${boundary} then ${now} else ${rateLimit.lastRequest} end`,
    } }).returning({ count: rateLimit.count });
  return row!.count <= 180;
}

export function accountRepository(db = database()) {
  return {
    async unregister(ownerId: string, deviceId: string) {
      await db.transaction(async (tx) => {
        // Serialize with push so a removed installation cannot commit a later upload.
        await tx.select().from(syncHeads).where(eq(syncHeads.ownerId, ownerId)).for("update");
        await tx.delete(syncDevices).where(and(eq(syncDevices.ownerId, ownerId), eq(syncDevices.id, deviceId)));
      });
      return { removed: true as const };
    },
    async delete(ownerId: string, sessionId: string, now = Date.now()) {
      return db.transaction(async (tx) => {
        await tx.select().from(syncHeads).where(eq(syncHeads.ownerId, ownerId)).for("update");
        const [owner] = await tx.select().from(user).where(eq(user.id, ownerId)).for("update");
        if (!owner) return false;
        const [fresh] = await tx.select().from(session).where(and(
          eq(session.id, sessionId), eq(session.userId, ownerId),
          gt(session.expiresAt, new Date(now)), gt(session.createdAt, new Date(now - 5 * 60000)),
        )).for("update");
        if (!fresh) return false;
        // All planner, auth sessions and provider accounts use ON DELETE CASCADE.
        await tx.delete(user).where(eq(user.id, ownerId));
        await tx.delete(rateLimit).where(eq(rateLimit.key, `planner:${ownerId}`));
        return true;
      });
    },
  };
}
