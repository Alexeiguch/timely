import { afterEach, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialState, saveLocal, appendOperation, type LocalState, type LocalStore } from "../packages/sync/src/index";
import { taskSchema } from "../packages/contracts/src/index";
import { capture, migrate, read, write, type SQLitePort } from "../apps/mobile/src/sqlite-persistence";

const files: string[] = [];
afterEach(() => { for (const file of files.splice(0)) rmSync(file, { recursive: true, force: true }); });
function open(file: string) {
  const db = new DatabaseSync(file);
  const port: SQLitePort = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...values) { return db.prepare(sql).run(...values); },
    async getFirstAsync<T>(sql: string, ...values: (string | number)[]) { return (db.prepare(sql).get(...values) as T | undefined) ?? null; },
    async getAllAsync<T>(sql: string, ...values: (string | number)[]) { return db.prepare(sql).all(...values) as T[]; },
  };
  async function transaction<T>(work: () => Promise<T>) {
    db.exec("BEGIN IMMEDIATE");
    try { const result = await work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  return { db, port, transaction };
}
async function legacy(ownerId: string) {
  let state = initialState(ownerId, randomUUID());
  const store: LocalStore = {
    async read() { return structuredClone(state); },
    async transaction(change) { const next = structuredClone(state); const result = change(next); state = next; return result; },
  };
  const task = taskSchema.parse({ id: randomUUID(), title: "Kept through migration", notes: "", priority: null, rule: null,
    schedule: { date: "2026-10-05", time: "09:00", duration: 45 }, reminders: { enabled: false, before: true, overdue: true } });
  const acknowledged = await saveLocal(store, task.id, { type: "create", task }, randomUUID);
  await store.transaction((current) => { current.shadows[task.id] = appendOperation(undefined, acknowledged); current.outbox = []; current.bootstrapped = true; current.cursor = 37; current.lastSync = 1791190800000; });
  const next = { ...task, id: randomUUID(), title: "An offline queued creation" };
  await saveLocal(store, next.id, { type: "create", task: next }, randomUUID);
  await store.transaction((current) => { current.outbox[0]!.attempts = 2; current.outbox[0]!.retryAt = 1791194400000; });
  return store.read();
}
async function seed(port: SQLitePort, entries: [string, LocalState][]) {
  await port.execAsync("CREATE TABLE accounts (owner_id TEXT PRIMARY KEY NOT NULL, schema_version INTEGER NOT NULL, body TEXT NOT NULL)");
  for (const [namespace, state] of entries) await port.runAsync("INSERT INTO accounts VALUES (?, 1, ?)", namespace, JSON.stringify(state));
}
it("migrates actual SQLite with pending work and preserves both accounts across process reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "timely-sqlite-")); files.push(directory);
  const file = join(directory, "planner.db"), a = await legacy("owner-a"), b = await legacy("owner-b");
  const first = open(file);
  try {
    await seed(first.port, [["dev|owner-a", a], ["dev|owner-b", b]]);
    await first.transaction(() => migrate(first.port));
    expect(await read(first.port, "dev|owner-a", "owner-a")).toEqual(a);
    expect(await read(first.port, "dev|owner-b", "owner-b")).toEqual(b);
    expect(await first.port.getFirstAsync("PRAGMA user_version")).toEqual({ user_version: 3 });
  } finally { first.db.close(); }
  const second = open(file);
  try {
    expect(await read(second.port, "dev|owner-a", "owner-a")).toEqual(a);
    await expect(read(second.port, "dev|owner-a", "owner-b")).rejects.toThrow();
  } finally { second.db.close(); }
});
it("rolls back local shadow, clock and outbox writes together after a simulated interruption", async () => {
  const fixture = open(":memory:"), a = await legacy("owner-a"), b = await legacy("owner-b");
  try {
    await seed(fixture.port, [["dev|owner-a", a], ["dev|owner-b", b]]);
    await fixture.transaction(() => migrate(fixture.port));
    await expect(fixture.transaction(async () => {
      const state = await read(fixture.port, "dev|owner-a", "owner-a"), before = capture(state);
      state.clock.logical++; state.cursor++; state.outbox = [];
      state.shadows = {};
      await write(fixture.port, "dev|owner-a", state, before);
      throw new Error("interrupted before commit");
    })).rejects.toThrow("interrupted before commit");
    expect(await read(fixture.port, "dev|owner-a", "owner-a")).toEqual(a);
    expect(await read(fixture.port, "dev|owner-b", "owner-b")).toEqual(b);
  } finally { fixture.db.close(); }
});
it("retains malformed or newer-schema SQLite without silently initializing or downgrading it", async () => {
  for (const scenario of ["malformed", "newer-database", "newer-account"]) {
    const fixture = open(":memory:"), state = await legacy("owner-a");
    try {
      await seed(fixture.port, [["dev|owner-a", state]]);
      if (scenario === "malformed") await fixture.port.runAsync("UPDATE accounts SET body = ?", JSON.stringify({ ...state, version: 99 }));
      if (scenario === "newer-database") await fixture.port.execAsync("PRAGMA user_version = 4");
      if (scenario === "newer-account") await fixture.port.execAsync("UPDATE accounts SET schema_version = 4");
      const original = await fixture.port.getFirstAsync("SELECT * FROM accounts");
      await expect(fixture.transaction(() => migrate(fixture.port))).rejects.toThrow();
      expect(await fixture.port.getFirstAsync("SELECT * FROM accounts")).toEqual(original);
      expect(await fixture.port.getFirstAsync("PRAGMA user_version")).toEqual({ user_version: scenario === "newer-database" ? 4 : 0 });
    } finally { fixture.db.close(); }
  }
});
