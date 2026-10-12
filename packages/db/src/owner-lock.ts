import { eq } from "drizzle-orm";
import type { database } from "./index";
import { syncHeads } from "./planner-schema";
export type PlannerTransaction = Parameters<
  Parameters<ReturnType<typeof database>["transaction"]>[0]
>[0];
/** Sync and reminders serialize canonical owner changes through the same row. */
export async function lockOwner(tx: PlannerTransaction, ownerId: string) {
  await tx.insert(syncHeads).values({ ownerId }).onConflictDoNothing();
  const [head] = await tx
    .select()
    .from(syncHeads)
    .where(eq(syncHeads.ownerId, ownerId))
    .for("update");
  return head!.cursor;
}
