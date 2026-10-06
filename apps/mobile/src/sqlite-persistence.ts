import { readLocalState, type LocalState } from "@timely/sync";

/** The native adapter supplies this small SQL surface inside its exclusive transaction.
 * The same migration and persistence logic can be exercised against real SQLite in Node. */
export interface SQLitePort {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...values: (string | number)[]): Promise<unknown>;
  getFirstAsync<T = unknown>(sql: string, ...values: (string | number)[]): Promise<T | null>;
  getAllAsync<T = unknown>(sql: string, ...values: (string | number)[]): Promise<T[]>;
}
export async function migrate(tx: SQLitePort) {
    const version = await tx.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    if (version && version.user_version > 3) throw new Error("This planner database requires a newer app. Its saved data has been preserved.");
    await tx.execAsync(`CREATE TABLE IF NOT EXISTS accounts (owner_id TEXT PRIMARY KEY NOT NULL, schema_version INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notification_cleanup (namespace TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS shadows (namespace TEXT NOT NULL, entity_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(namespace, entity_id));
      CREATE TABLE IF NOT EXISTS pending (namespace TEXT NOT NULL, operation_id TEXT NOT NULL, definition_id TEXT NOT NULL, position INTEGER NOT NULL, retry_at INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(namespace, operation_id));
      CREATE INDEX IF NOT EXISTS pending_position ON pending(namespace, position);
      CREATE INDEX IF NOT EXISTS pending_definition ON pending(namespace, definition_id);
      CREATE INDEX IF NOT EXISTS pending_retry ON pending(namespace, retry_at);`);
    if (await tx.getFirstAsync("SELECT owner_id FROM accounts WHERE schema_version > 3 LIMIT 1"))
      throw new Error("This saved account requires a newer app. Its data has been preserved.");
    for (const row of await tx.getAllAsync<{ owner_id: string; body: string }>("SELECT owner_id, body FROM accounts WHERE schema_version < 3")) {
      const parsed = JSON.parse(row.body) as LocalState;
      const state = readLocalState(parsed, parsed.ownerId);
      await write(tx, row.owner_id, state);
    }
    await tx.execAsync("PRAGMA user_version = 3;");
}
export type SavedRows = { shadows: Map<string, string>; pending: Map<string, { body: string; position: number }> };
export function capture(state: LocalState): SavedRows {
  return { shadows: new Map(Object.values(state.shadows).map((record) => [record.id, JSON.stringify(record)])), pending: new Map(state.outbox.map((pending, position) => [pending.operation.id, { body: JSON.stringify(pending), position }])) };
}
export async function write(db: SQLitePort, namespace: string, state: LocalState, before?: SavedRows) {
  readLocalState(state, state.ownerId);
  const { shadows, outbox, ...metadata } = state;
  await db.runAsync("UPDATE accounts SET schema_version = 3, body = ? WHERE owner_id = ?", JSON.stringify(metadata), namespace);
  const next = capture(state);
  if (!before) {
    await db.runAsync("DELETE FROM shadows WHERE namespace = ?", namespace);
    await db.runAsync("DELETE FROM pending WHERE namespace = ?", namespace);
  } else {
    for (const id of before.shadows.keys()) if (!next.shadows.has(id)) await db.runAsync("DELETE FROM shadows WHERE namespace = ? AND entity_id = ?", namespace, id);
    for (const id of before.pending.keys()) if (!next.pending.has(id)) await db.runAsync("DELETE FROM pending WHERE namespace = ? AND operation_id = ?", namespace, id);
  }
  for (const [id, body] of next.shadows) if (body !== before?.shadows.get(id)) await db.runAsync("INSERT INTO shadows (namespace, entity_id, body) VALUES (?, ?, ?) ON CONFLICT(namespace, entity_id) DO UPDATE SET body = excluded.body", namespace, id, body);
  for (const [position, pending] of outbox.entries()) {
    const body = next.pending.get(pending.operation.id)!.body, old = before?.pending.get(pending.operation.id);
    if (old?.body !== body || old.position !== position) await db.runAsync("INSERT INTO pending (namespace, operation_id, definition_id, position, retry_at, body) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(namespace, operation_id) DO UPDATE SET position = excluded.position, retry_at = excluded.retry_at, body = excluded.body", namespace, pending.operation.id, pending.operation.definitionId, position, pending.retryAt, body);
  }
}
export async function read(db: SQLitePort, namespace: string, ownerId: string) {
  const row = await db.getFirstAsync<{ body: string }>("SELECT body FROM accounts WHERE owner_id = ?", namespace);
  if (!row) throw new Error("This account has been signed out.");
  const shadows = await db.getAllAsync<{ entity_id: string; body: string }>("SELECT entity_id, body FROM shadows WHERE namespace = ?", namespace);
  const pending = await db.getAllAsync<{ body: string }>("SELECT body FROM pending WHERE namespace = ? ORDER BY position", namespace);
  return readLocalState({ ...JSON.parse(row.body), shadows: Object.fromEntries(shadows.map((record) => [record.entity_id, JSON.parse(record.body)])), outbox: pending.map((entry) => JSON.parse(entry.body)) }, ownerId);
}
