import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { initialState, type LocalState, type LocalStore } from "@timely/sync";
import { apiURL } from "./auth";
const opened = SQLite.openDatabaseAsync("timely-planner.db").then(
  async (db) => {
    await db.execAsync(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS accounts (owner_id TEXT PRIMARY KEY NOT NULL, schema_version INTEGER NOT NULL, body TEXT NOT NULL); PRAGMA user_version = 1;",
    );
    return db;
  },
);
const listeners = new Map<string, Set<() => void>>();
export function localStore(ownerId: string): LocalStore & {
  subscribe: (listener: () => void) => () => void;
  purge: () => Promise<void>;
} {
  const namespace = `${apiURL}|${ownerId}`;
  const ready = opened.then(async (db) => {
    await db.runAsync(
      "INSERT OR IGNORE INTO accounts (owner_id, schema_version, body) VALUES (?, 1, ?)",
      namespace,
      JSON.stringify(initialState(ownerId, Crypto.randomUUID())),
    );
    return db;
  });
  const notify = () => {
    for (const listener of listeners.get(namespace) ?? []) listener();
  };
  return {
    async read() {
      const db = await ready;
      const row = await db.getFirstAsync<{ body: string }>(
        "SELECT body FROM accounts WHERE owner_id = ?",
        namespace,
      );
      if (!row) throw new Error("This account has been signed out.");
      return JSON.parse(row.body) as LocalState;
    },
    async transaction(change) {
      const db = await ready;
      let result!: ReturnType<typeof change>;
      await db.withExclusiveTransactionAsync(async (tx) => {
        const row = await tx.getFirstAsync<{ body: string }>(
          "SELECT body FROM accounts WHERE owner_id = ?",
          namespace,
        );
        if (!row) throw new Error("This account has been signed out.");
        const state = JSON.parse(row.body) as LocalState;
        result = change(state);
        await tx.runAsync(
          "UPDATE accounts SET body = ? WHERE owner_id = ?",
          JSON.stringify(state),
          namespace,
        );
      });
      notify();
      return result;
    },
    subscribe(listener) {
      const set = listeners.get(namespace) ?? new Set();
      set.add(listener);
      listeners.set(namespace, set);
      return () => {
        set.delete(listener);
      };
    },
    async purge() {
      const db = await ready;
      await db.runAsync("DELETE FROM accounts WHERE owner_id = ?", namespace);
      notify();
    },
  };
}
