import {
  addDays,
  planReminders,
  projectSeries,
  reminderIdentity,
  today,
  DailySummary,
  type ReminderPlan,
} from "@timely/domain";
import {
  dailySummaryDefaults,
  type Occurrence,
  type LocalCoverageEntry,
} from "@timely/contracts";
import { reduceRecord } from "./records";
import {
  visiblePreferences,
  visibleRecords,
  type LocalStore,
  type LocalState,
} from "./engine";
import { remoteReminderCandidates } from "./remote-reminders";

export interface ReminderCoverageAdapter {
  prepare(
    state: LocalState,
    entries: LocalCoverageEntry[],
  ): Promise<{
    available: boolean;
    blocked: string[];
    summaryHandledDays?: string[];
  }>;
  commit(
    state: LocalState,
    entries: LocalCoverageEntry[],
    handled: string[],
  ): Promise<{ ready: boolean; retry: boolean }>;
}

export type NativeReminder = {
  nativeId: string;
  key: string;
  ownerId: string;
  due: number;
  summaryCount?: number;
};
export interface NotificationAdapter {
  permission(): Promise<"granted" | "denied" | "undetermined">;
  scheduled(): Promise<NativeReminder[]>;
  cancel(nativeId: string): Promise<void>;
  schedule(
    key: string,
    item: Occurrence | null,
    plan: ReminderPlan,
    ownerId: string,
  ): Promise<string>;
}
export function emptyReminders() {
  return {
    retry: true,
    permission: "undetermined" as const,
    mappings: {},
    handled: {},
    scheduled: 0,
    uncovered: 0,
    horizon: 0,
    reconciledAt: null,
  };
}

/** Desired plans are recomputed from durable commands. A stable native identifier closes
 * the crash window between an OS call and storing its returned mapping. */
export class LocalReminderScheduler {
  private running: Promise<void> | null = null;
  private paused = false;
  constructor(
    private store: LocalStore,
    private adapter: NotificationAdapter,
    private zone: () => string,
    private coverage?: ReminderCoverageAdapter,
  ) {}
  run(now = Date.now()) {
    if (this.paused) return Promise.resolve();
    return (this.running ??= (async () => {
      for (let pass = 0; pass < 5; pass++) {
        await this.reconcile(now);
        if (this.paused || !(await this.store.read()).reminders?.retry) break;
      }
    })().finally(() => {
      this.running = null;
    }));
  }
  async pause() {
    this.paused = true;
    await this.running;
  }
  resume() {
    this.paused = false;
  }
  private async reconcile(now: number) {
    await this.store.transaction((state) => {
      state.reminders ??= emptyReminders();
      state.reminders.retry = true;
    });
    const state = await this.store.read();
    const old = state.reminders!;
    const permission = await this.adapter.permission();
    const zone = this.zone(),
      day = today(zone, now),
      horizon = now + 7 * 86400000;
    const preferences = visiblePreferences(state);
    const dailySummary = old.dailySummary ?? dailySummaryDefaults;
    const summaryHandled = { ...old.summaryHandled };
    // An elapsed OS-owned summary consumes this date even after a time/zone change.
    for (const mapping of Object.values(old.mappings))
      if (mapping.kind === "summary" && mapping.due <= now)
        summaryHandled[mapping.day] = mapping.due;
    for (const [day, due] of Object.entries(summaryHandled))
      if (due < now - 8 * 86400000) delete summaryHandled[day];
    const records = visibleRecords(state).records;
    const tasks = records.flatMap((record) =>
      projectSeries(
        reduceRecord(record),
        addDays(day, -8),
        addDays(day, 15),
      ).flatMap((item) =>
        planReminders(item, preferences, zone, now).map((plan) => ({
          item,
          day: item.schedule.date,
          plan,
          key: reminderIdentity(state.deviceId, plan),
        })),
      ),
    );
    const summaries = DailySummary.plans(
      records.map(reduceRecord),
      dailySummary,
      zone,
      now,
    ).map((plan) => ({
      item: null,
      day: plan.day,
      plan,
      key: reminderIdentity(state.deviceId, plan),
    }));
    const candidates = [...tasks, ...summaries]
      .filter(
        ({ plan, key, day }) =>
          plan.due <= horizon &&
          !old.handled[key] &&
          !(plan.kind === "summary" && summaryHandled[day]),
      )
      .sort((a, b) => a.plan.due - b.plan.due || a.key.localeCompare(b.key));
    // Keep the gentle daily nudge covered even when many explicit task alarms fill the OS budget.
    const summarySlots = candidates.filter(
      (entry) => entry.plan.kind === "summary",
    );
    let wanted =
      permission === "granted"
        ? [
            ...summarySlots,
            ...candidates
              .filter((entry) => entry.plan.kind !== "summary")
              .slice(0, 48 - summarySlots.length),
          ].sort(
            (a, b) => a.plan.due - b.plan.due || a.key.localeCompare(b.key),
          )
        : [];
    const remoteOwned = { ...old.remoteOwned };
    for (const [key, due] of Object.entries(remoteOwned))
      if (due < now - 8 * 86400000) delete remoteOwned[key];
    let remoteStatus: NonNullable<LocalState["reminders"]>["remoteStatus"] =
      this.coverage ? "paused" : undefined;
    let available = false;
    if (this.coverage) {
      try {
        const prepared = await this.coverage.prepare(
          state,
          wanted.map(({ key, item, plan }) => ({
            key,
            occurrenceId: plan.occurrenceId,
            kind: plan.kind,
            version: plan.version,
            due: plan.due,
            day: plan.kind === "summary" ? plan.day : item!.schedule.date,
          })),
        );
        available = prepared.available;
        for (const day of prepared.summaryHandledDays ?? [])
          summaryHandled[day] = now;
        remoteStatus = available ? "paused" : "not-configured";
        for (const key of prepared.blocked) {
          const entry = wanted.find((entry) => entry.key === key);
          if (entry) remoteOwned[key] = entry.plan.due;
        }
      } catch {
        remoteStatus = "unavailable";
        // Offline, keep established local ownership. A server-owned canonical plan must not acquire a competing OS schedule.
        if (old.remoteReady) {
          const canonical = { ...state, outbox: [] };
          const serverCandidates = remoteReminderCandidates(
            visibleRecords(canonical).records,
            visiblePreferences(canonical),
            state.deviceId,
            zone,
            now,
            old.remoteSummaryPolicy ?? dailySummaryDefaults,
          );
          const serverKeys = new Set(
            serverCandidates.map((entry) => entry.key),
          );
          const serverSummaryDays = new Set(
            serverCandidates
              .filter((entry) => entry.plan.kind === "summary")
              .map((entry) => entry.day),
          );
          wanted = wanted.filter(
            (entry) =>
              !!old.mappings[entry.key] ||
              (entry.plan.kind === "summary"
                ? !serverSummaryDays.has(entry.day) ||
                  Object.values(old.mappings).some(
                    (mapping) =>
                      mapping.kind === "summary" && mapping.day === entry.day,
                  )
                : !serverKeys.has(entry.key)),
          );
        }
      }
    }
    wanted = wanted.filter(
      (entry) =>
        !remoteOwned[entry.key] &&
        !(entry.plan.kind === "summary" && summaryHandled[entry.day]),
    );
    const desired = new Map(wanted.map((entry) => [entry.key, entry]));
    const actual = (await this.adapter.scheduled()).filter(
      (entry) => entry.ownerId === state.ownerId,
    );
    const existing = new Map<string, NativeReminder>();
    for (const entry of actual) {
      const target = desired.get(entry.key);
      if (
        !desired.has(entry.key) ||
        existing.has(entry.key) ||
        (target?.plan.kind === "summary" &&
          entry.summaryCount !== target.plan.count)
      )
        await this.adapter.cancel(entry.nativeId);
      else existing.set(entry.key, entry);
    }
    const mappings: NonNullable<typeof state.reminders>["mappings"] = {};
    const handled = { ...old.handled };
    for (const [key, mapping] of Object.entries(old.mappings)) {
      if (mapping.due <= now && !existing.has(key)) handled[key] = mapping.due;
    }
    for (const { key, item, plan } of wanted) {
      if (handled[key]) continue;
      // A previously scheduled elapsed plan is locally handled; never replay it on restart.
      const nativeId =
        existing.get(key)?.nativeId ??
        (await this.adapter.schedule(key, item, plan, state.ownerId));
      mappings[key] = {
        nativeId,
        occurrenceId: plan.occurrenceId,
        kind: plan.kind,
        version: plan.version,
        due: plan.due,
        day: plan.kind === "summary" ? plan.day : item!.schedule.date,
      };
    }
    // Retain elapsed dedupe identities beyond the allowed one-hour late window.
    for (const [key, due] of Object.entries(handled))
      if (due < now - 8 * 86400000) delete handled[key];
    await this.store.transaction((current) => {
      const changed =
        current.cursor !== state.cursor ||
        current.clock.physical !== state.clock.physical ||
        current.clock.logical !== state.clock.logical ||
        JSON.stringify(
          current.reminders?.dailySummary ?? dailySummaryDefaults,
        ) !== JSON.stringify(dailySummary) ||
        current.outbox.map((pending) => pending.operation.id).join() !==
          state.outbox.map((pending) => pending.operation.id).join();
      current.reminders = {
        retry: changed,
        permission,
        dailySummary: current.reminders?.dailySummary ?? dailySummary,
        summaryHandled: {
          ...current.reminders?.summaryHandled,
          ...summaryHandled,
        },
        mappings,
        handled,
        scheduled: Object.keys(mappings).length,
        ...(this.coverage
          ? {
              remoteOwned,
              remoteReady: old.remoteReady ?? false,
              remoteStatus,
              remoteSummaryPolicy: old.remoteSummaryPolicy,
            }
          : {}),
        uncovered:
          permission === "granted"
            ? Math.max(0, candidates.length - 48)
            : candidates.length,
        horizon,
        reconciledAt: now,
      };
    });
    if (available && this.coverage) {
      const current = await this.store.read();
      if (
        !current.reminders?.retry &&
        current.bootstrapped &&
        !current.outbox.length
      ) {
        const entries = Object.entries(mappings).map(([key, entry]) => ({
          key,
          occurrenceId: entry.occurrenceId,
          kind: entry.kind,
          version: entry.version,
          due: entry.due,
          day: entry.day,
        }));
        try {
          const result = await this.coverage.commit(
            current,
            entries,
            Object.keys(handled).slice(-512),
          );
          await this.store.transaction((state) => {
            if (state.reminders) {
              state.reminders.remoteReady = result.ready;
              if (result.ready)
                state.reminders.remoteSummaryPolicy =
                  current.reminders?.dailySummary ?? dailySummaryDefaults;
              state.reminders.remoteStatus = result.ready ? "ready" : "paused";
              state.reminders.retry ||= result.retry;
            }
          });
        } catch {
          await this.store.transaction((state) => {
            if (state.reminders) state.reminders.remoteStatus = "unavailable";
          });
        }
      }
    }
  }
  async cancelAll() {
    await this.running;
    const state = await this.store.read();
    // Purging another account's notifications is never an acceptable shortcut.
    for (const entry of await this.adapter.scheduled())
      if (entry.ownerId === state.ownerId)
        await this.adapter.cancel(entry.nativeId);
    await this.store.transaction((current) => {
      current.reminders = emptyReminders();
    });
  }
}
