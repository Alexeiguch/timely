import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { initialState, type LocalState, type LocalStore } from "@timely/sync";
import { apiURL } from "./auth";
import { migrate, read, write, capture } from "./sqlite-persistence";
const opened = SQLite.openDatabaseAsync("timely-planner.db").then(async (db) => {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.withExclusiveTransactionAsync(async (tx) => {
    await migrate(tx);
  });
  return db;
});
export async function queueNotificationCleanup(ownerId: string) {
  const db = await opened;
  await db.runAsync("INSERT OR IGNORE INTO notification_cleanup (namespace, owner_id) VALUES (?, ?)", `${apiURL}|${ownerId}`, ownerId);
}
export async function pendingNotificationCleanup() {
  const db = await opened;
  const rows = await db.getAllAsync<{ namespace: string; owner_id: string }>("SELECT namespace, owner_id FROM notification_cleanup");
  return rows.filter((row) => row.namespace === `${apiURL}|${row.owner_id}`).map((row) => row.owner_id);
}
export async function finishNotificationCleanup(ownerId: string) {
  const db = await opened;
  await db.runAsync("DELETE FROM notification_cleanup WHERE namespace = ?", `${apiURL}|${ownerId}`);
}
const listeners = new Map<string, Set<() => void>>();
export function localStore(ownerId: string): LocalStore & {
  subscribe: (listener: () => void) => () => void;
  purge: () => Promise<void>;
} {
  const namespace = `${apiURL}|${ownerId}`;
  const ready = opened.then(async (db) => {
    const { shadows, outbox, ...metadata } = initialState(ownerId, Crypto.randomUUID());
    await db.runAsync("INSERT OR IGNORE INTO accounts (owner_id, schema_version, body) VALUES (?, 3, ?)", namespace, JSON.stringify(metadata));
    return db;
  });
  const notify = () => { for (const listener of listeners.get(namespace) ?? []) listener(); };
  return {
    async read() {
      const db = await ready;
      let state!: LocalState;
      await db.withExclusiveTransactionAsync(async (tx) => { state = await read(tx, namespace, ownerId); });
      return state;
    },
    async transaction(change) {
      const db = await ready; let result!: ReturnType<typeof change>;
      await db.withExclusiveTransactionAsync(async (tx) => {
        const state = await read(tx, namespace, ownerId); const before = capture(state); result = change(state); await write(tx, namespace, state, before);
      });
      notify(); return result;
    },
    subscribe(listener) {
      const set = listeners.get(namespace) ?? new Set(); set.add(listener); listeners.set(namespace, set);
      return () => { set.delete(listener); };
    },
    async purge() {
      const db = await ready;
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync("DELETE FROM accounts WHERE owner_id = ?", namespace);
        await tx.runAsync("DELETE FROM shadows WHERE namespace = ?", namespace);
        await tx.runAsync("DELETE FROM pending WHERE namespace = ?", namespace);
      });
      notify();
    },
  };
}
