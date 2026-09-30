import {
  bootstrapResponseSchema,
  operationSchema,
  preferenceOperationSchema,
  type PreferencePatch,
  type SyncOperation,
  type SyncRecord,
  pullResponseSchema,
  pushResponseSchema,
  type Command,
  type Operation,
  type TaskRecord,
} from "@timely/contracts";
import {
  appendSyncOperation,
  isTaskRecord,
  isPreferenceRecord,
  reducePreferences,
} from "./preferences";
import { appendOperation } from "./records";
import { calibrate, observe, retryDelay, tick, type ClockState } from "./index";
export type Pending = {
  operation: SyncOperation;
  attempts: number;
  retryAt: number;
  error?: string;
};
export type LocalState = {
  version: 1;
  ownerId: string;
  deviceId: string;
  clock: ClockState;
  shadows: Record<string, SyncRecord>;
  outbox: Pending[];
  cursor: number;
  bootstrapped: boolean;
  lastSync: number | null;
  staging: {
    token: string;
    watermark: number;
    after: number;
    records: Record<string, SyncRecord>;
  } | null;
};
export function initialState(ownerId: string, deviceId: string): LocalState {
  return {
    version: 1,
    ownerId,
    deviceId,
    clock: { physical: 0, logical: 0, offset: 0 },
    shadows: {},
    outbox: [],
    cursor: 0,
    bootstrapped: false,
    lastSync: null,
    staging: null,
  };
}
export interface LocalStore {
  read(): Promise<LocalState>;
  transaction<T>(change: (state: LocalState) => T): Promise<T>;
}
function visibleState(state: LocalState) {
  const records = { ...state.shadows },
    errors: string[] = [];
  for (const pending of state.outbox) {
    try {
      records[pending.operation.definitionId] = appendSyncOperation(
        records[pending.operation.definitionId],
        pending.operation,
      );
    } catch {
      errors.push(pending.operation.id);
    }
  }
  return { records: Object.values(records), errors };
}
export function visibleRecords(state: LocalState): {
  records: TaskRecord[];
  errors: string[];
} {
  const visible = visibleState(state);
  return {
    records: visible.records.filter(isTaskRecord),
    errors: visible.errors,
  };
}
export function visiblePreferences(state: LocalState | null) {
  return reducePreferences(
    state ? visibleState(state).records.find(isPreferenceRecord) : undefined,
  );
}
export async function savePreferences(
  store: LocalStore,
  patch: PreferencePatch,
  uuid: () => string,
  now = Date.now(),
) {
  return store.transaction((state) => {
    const id = uuid();
    const advanced = tick(state.clock, now, state.deviceId, id);
    const operation = preferenceOperationSchema.parse({
      protocolVersion: 1,
      id,
      deviceId: state.deviceId,
      definitionId: "preferences",
      command: { type: "preferences", patch },
      stamp: advanced.stamp,
      createdAt: new Date(now).toISOString(),
    });
    state.clock = advanced.clock;
    state.outbox.push({ operation, attempts: 0, retryAt: 0 });
    return operation;
  });
}
export async function saveLocal(
  store: LocalStore,
  definitionId: string,
  command: Command,
  uuid: () => string,
  now = Date.now(),
) {
  return (
    await saveLocalBatch(store, [{ definitionId, command }], uuid, now)
  )[0]!;
}
/** Reordering several siblings commits all projections and outbox writes together. */
export async function saveLocalBatch(
  store: LocalStore,
  changes: Array<{ definitionId: string; command: Command }>,
  uuid: () => string,
  now = Date.now(),
) {
  return store.transaction((state) => {
    const operations: Operation[] = [];
    for (const { definitionId, command } of changes) {
      const id = uuid();
      const advanced = tick(state.clock, now, state.deviceId, id);
      const operation = operationSchema.parse({
        protocolVersion: 1,
        id,
        deviceId: state.deviceId,
        definitionId,
        command,
        stamp: advanced.stamp,
        createdAt: new Date(now).toISOString(),
      });
      const record = visibleRecords(state).records.find(
        (r) => r.id === definitionId,
      );
      appendOperation(record, operation); // Invalid local commands never enter the outbox.
      state.clock = advanced.clock;
      state.outbox.push({ operation, attempts: 0, retryAt: 0 });
      operations.push(operation);
    }
    return operations;
  });
}
export class SyncError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export type Transport = (path: string, body?: unknown) => Promise<unknown>;
export function httpTransport(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
): Transport {
  return async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(`/api/v1/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new SyncError(
          response.status,
          result.code ?? "TEMPORARY_UNAVAILABLE",
          result.message ?? "Unable to synchronize.",
          Number(response.headers.get("Retry-After") ?? 0) * 1000,
        );
      return result;
    } finally {
      clearTimeout(timer);
    }
  };
}
export type SyncStatus =
  | "Saved locally"
  | "Syncing"
  | "Synced"
  | "Offline"
  | "Needs attention";
export class SyncEngine {
  private running: Promise<void> | null = null;
  constructor(
    private store: LocalStore,
    private transport: Transport,
    private platform: "web" | "ios" | "android",
    private zone: () => string,
    private status: (value: SyncStatus, message?: string) => void,
  ) {}
  run(force = false) {
    return (this.running ??= this.cycle(force).finally(() => {
      this.running = null;
    }));
  }
  private async cycle(force: boolean) {
    this.status("Syncing");
    let sent: Pending[] = [];
    try {
      let state = await this.store.read();
      await this.transport("devices/register", {
        id: state.deviceId,
        platform: this.platform,
        zone: this.zone(),
        protocolVersion: 1,
      });
      while (!state.bootstrapped) {
        let page;
        try {
          page = bootstrapResponseSchema.parse(
            await this.transport(
              "sync/bootstrap",
              state.staging
                ? { token: state.staging.token, after: state.staging.after }
                : {},
            ),
          );
        } catch (error) {
          if (error instanceof SyncError && error.code === "CURSOR_EXPIRED") {
            await this.store.transaction((s) => {
              s.staging = null;
            });
            state = await this.store.read();
            continue;
          }
          throw error;
        }
        await this.store.transaction((s) => {
          const records = {
            ...(s.staging?.records ?? {}),
            ...Object.fromEntries(page.records.map((r) => [r.id, r])),
          };
          if (page.next !== null)
            s.staging = {
              token: page.token,
              watermark: page.watermark,
              after: page.next,
              records,
            };
          else {
            s.shadows = records;
            s.cursor = page.watermark;
            s.bootstrapped = true;
            s.staging = null;
          }
          for (const record of page.records)
            for (const operation of record.operations)
              s.clock = observe(s.clock, operation.stamp);
        });
        state = await this.store.read();
      }
      // New edits may arrive while requests are running. Read again after every acknowledgement.
      for (let batches = 0; batches < 20; batches++) {
        state = await this.store.read();
        if (!state.outbox.length) break;
        // Preserve dependency order. A blocked head cannot be skipped by a dependent later command.
        if (
          state.outbox[0]!.error ||
          (!force && state.outbox[0]!.retryAt > Date.now())
        )
          break;
        sent = [];
        for (const pending of state.outbox.slice(0, 100)) {
          if (pending.error || (!force && pending.retryAt > Date.now())) break;
          if (
            JSON.stringify({
              protocolVersion: 1,
              deviceId: state.deviceId,
              operations: [...sent.map((p) => p.operation), pending.operation],
            }).length > 900000
          )
            break;
          sent.push(pending);
        }
        if (!sent.length) break;
        const started = Date.now();
        const result = pushResponseSchema.parse(
          await this.transport("sync/push", {
            protocolVersion: 1,
            deviceId: state.deviceId,
            operations: sent.map((p) => p.operation),
          }),
        );
        const acknowledged = new Set(result.results.map((o) => o.id));
        const expected = new Set(sent.map((p) => p.operation.id));
        if (
          acknowledged.size !== expected.size ||
          [...acknowledged].some((id) => !expected.has(id))
        )
          throw new Error("Invalid acknowledgement set");
        await this.store.transaction((s) => {
          for (const outcome of result.results) {
            // A retried acknowledgement may be older than an already-pulled canonical shadow.
            const current = s.shadows[outcome.record.id];
            if (
              !current ||
              outcome.record.operations.length >= current.operations.length
            )
              s.shadows[outcome.record.id] = outcome.record;
            s.clock = observe(s.clock, outcome.stamp);
          }
          s.clock = calibrate(s.clock, started, Date.now(), result.serverTime);
          s.outbox = s.outbox.filter((p) => !acknowledged.has(p.operation.id));
        });
        sent = [];
      }
      let more = true;
      while (more) {
        state = await this.store.read();
        let page;
        try {
          page = pullResponseSchema.parse(
            await this.transport(`sync/pull?cursor=${state.cursor}`),
          );
        } catch (error) {
          if (error instanceof SyncError && error.code === "CURSOR_EXPIRED") {
            await this.store.transaction((s) => {
              s.bootstrapped = false;
              s.staging = null;
            });
            this.status("Saved locally");
            return;
          }
          throw error;
        }
        await this.store.transaction((s) => {
          for (const change of page.changes) {
            const current = s.shadows[change.record.id];
            if (
              !current ||
              change.record.operations.length >= current.operations.length
            )
              s.shadows[change.record.id] = change.record;
            for (const operation of change.record.operations)
              s.clock = observe(s.clock, operation.stamp);
          }
          s.cursor = Math.max(s.cursor, page.cursor);
        });
        more = page.more;
      }
      await this.store.transaction((s) => {
        s.lastSync = Date.now();
      });
      state = await this.store.read();
      this.status(
        state.outbox.some((p) => p.error)
          ? "Needs attention"
          : state.outbox.length
            ? "Saved locally"
            : "Synced",
      );
    } catch (error) {
      const known = error instanceof SyncError ? error : null;
      if (sent.length)
        await this.store.transaction((s) => {
          const ids = new Set(sent.map((p) => p.operation.id));
          for (const pending of s.outbox)
            if (ids.has(pending.operation.id)) {
              pending.attempts++;
              pending.retryAt =
                Date.now() +
                Math.max(known?.retryAfter ?? 0, retryDelay(pending.attempts));
              if (known && known.status === 400) pending.error = known.message;
            }
        });
      this.status(
        known?.status === 401 || known?.status === 400 || known?.status === 403
          ? "Needs attention"
          : "Offline",
        known?.message ?? "Your changes are saved on this device.",
      );
    }
  }
}
