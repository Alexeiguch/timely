import Dexie, { type EntityTable, liveQuery } from "dexie";
import { initialState, type LocalState, type LocalStore } from "@timely/sync";
class PlannerDB extends Dexie {
  accounts!: EntityTable<LocalState, "ownerId">;
  constructor() {
    super("timely-planner-v1");
    this.version(1).stores({ accounts: "ownerId" });
  }
}
const db = new PlannerDB();
export function localStore(
  ownerId: string,
): LocalStore & {
  subscribe: (change: (state: LocalState) => void) => () => void;
  purge: () => Promise<void>;
} {
  const ready = db.transaction("rw", db.accounts, async () => {
    if (!(await db.accounts.get(ownerId)))
      await db.accounts.put(initialState(ownerId, crypto.randomUUID()));
  });
  return {
    async read() {
      await ready;
      return (await db.accounts.get(ownerId))!;
    },
    async transaction(change) {
      await ready;
      return db.transaction("rw", db.accounts, async () => {
        const state = await db.accounts.get(ownerId);
        if (!state) throw new Error("This account has been signed out.");
        const result = change(state);
        await db.accounts.put(state);
        return result;
      });
    },
    subscribe(change) {
      const subscription = liveQuery(async () => {
        await ready;
        return db.accounts.get(ownerId);
      }).subscribe((value) => {
        if (value) change(value);
      });
      return () => subscription.unsubscribe();
    },
    async purge() {
      await ready;
      await db.accounts.delete(ownerId);
    },
  };
}
