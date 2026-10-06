import Dexie, { type EntityTable, type Table, liveQuery } from "dexie";
import { initialState, readLocalState, type LocalState, type LocalStore, type Pending } from "@timely/sync";
import type { SyncRecord } from "@timely/contracts";
type AccountRow = Omit<LocalState, "shadows" | "outbox"> & Partial<Pick<LocalState, "shadows" | "outbox">>;
type ShadowRow = { ownerId: string; id: string; record: SyncRecord };
type PendingRow = { ownerId: string; id: string; definitionId: string; position: number; retryAt: number; pending: Pending };
class PlannerDB extends Dexie {
  accounts!: EntityTable<AccountRow, "ownerId">;
  shadows!: Table<ShadowRow, [string, string]>;
  pending!: Table<PendingRow, [string, string]>;
  constructor() {
    super("timely-planner-v1");
    this.version(1).stores({ accounts: "ownerId" });
    this.version(2).stores({ accounts: "ownerId", shadows: "[ownerId+id],ownerId", pending: "[ownerId+id],ownerId,[ownerId+position],[ownerId+definitionId],[ownerId+retryAt]" }).upgrade(async (tx) => {
      for (const row of await tx.table<AccountRow>("accounts").toArray()) {
        const state = readLocalState(row, row.ownerId);
        await tx.table("shadows").bulkPut(Object.values(state.shadows).map((record) => ({ ownerId: state.ownerId, id: record.id, record })));
        await tx.table("pending").bulkPut(state.outbox.map((pending, position) => ({ ownerId: state.ownerId, id: pending.operation.id, definitionId: pending.operation.definitionId, retryAt: pending.retryAt, position, pending })));
        const { shadows, outbox, ...metadata } = state;
        await tx.table("accounts").put(metadata);
      }
    });
  }
}
const db = new PlannerDB();
export function localStore(ownerId: string): LocalStore & {
  subscribe: (change: (state: LocalState) => void) => () => void;
  purge: () => Promise<void>;
} {
  const ready = db.transaction("rw", db.accounts, async () => {
    if (!(await db.accounts.get(ownerId))) {
      const { shadows, outbox, ...metadata } = initialState(ownerId, crypto.randomUUID());
      await db.accounts.put(metadata);
    }
  });
  async function read() {
    const metadata = await db.accounts.get(ownerId);
    if (!metadata) throw new Error("This account has been signed out.");
    const shadows = await db.shadows.where("ownerId").equals(ownerId).toArray();
    const outbox = await db.pending.where("ownerId").equals(ownerId).sortBy("position");
    return readLocalState({ ...metadata, shadows: Object.fromEntries(shadows.map((row) => [row.id, row.record])), outbox: outbox.map((row) => row.pending) }, ownerId);
  }
  return {
    async read() {
      await ready;
      return db.transaction("r", db.accounts, db.shadows, db.pending, read);
    },
    async transaction(change) {
      await ready;
      return db.transaction("rw", db.accounts, db.shadows, db.pending, async () => {
        const state = await read();
        const previousShadows = new Map(Object.values(state.shadows).map((record) => [record.id, JSON.stringify(record)])), previousPending = new Map(state.outbox.map((pending, position) => [pending.operation.id, { encoded: JSON.stringify(pending), position }]));
        const result = change(state);
        readLocalState(state, ownerId);
        const { shadows, outbox, ...metadata } = state;
        await db.accounts.put(metadata);
        const removedShadows = [...previousShadows.keys()].filter((id) => !shadows[id]);
        const pendingIds = new Set(outbox.map((pending) => pending.operation.id));
        const removedPending = [...previousPending.keys()].filter((id) => !pendingIds.has(id));
        if (removedShadows.length) await db.shadows.bulkDelete(removedShadows.map((id) => [ownerId, id]));
        if (removedPending.length) await db.pending.bulkDelete(removedPending.map((id) => [ownerId, id]));
        const changedShadows = Object.values(shadows).filter((record) => JSON.stringify(record) !== previousShadows.get(record.id)).map((record) => ({ ownerId, id: record.id, record }));
        const changedPending = outbox.map((pending, position) => ({ ownerId, id: pending.operation.id, definitionId: pending.operation.definitionId, retryAt: pending.retryAt, position, pending })).filter((row) => {
          const old = previousPending.get(row.id); return old?.position !== row.position || old.encoded !== JSON.stringify(row.pending);
        });
        if (changedShadows.length) await db.shadows.bulkPut(changedShadows);
        if (changedPending.length) await db.pending.bulkPut(changedPending);
        return result;
      });
    },
    subscribe(change) {
      const subscription = liveQuery(async () => { await ready; return db.transaction("r", db.accounts, db.shadows, db.pending, read); }).subscribe({ next: change, error: () => { /* Existing rows are retained for recovery. */ } });
      return () => subscription.unsubscribe();
    },
    async purge() {
      await ready;
      await db.transaction("rw", db.accounts, db.shadows, db.pending, async () => {
        await db.accounts.delete(ownerId);
        await db.shadows.where("ownerId").equals(ownerId).delete();
        await db.pending.where("ownerId").equals(ownerId).delete();
      });
    },
  };
}
