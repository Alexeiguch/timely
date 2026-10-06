"use client";
import { useEffect, useMemo, useState } from "react";
import {
  httpTransport,
  saveLocal,
  saveLocalBatch,
  retrySavedChanges,
  discardLocalChanges,
  accountActions,
  loadHistory,
  SyncEngine,
  visibleRecords,
  visiblePreferences,
  savePreferences,
  type LocalState,
  type SyncStatus,
} from "@timely/sync";
import type { Command, PreferencePatch, HistoryRequest } from "@timely/contracts";
import { localStore } from "./local-store";
export function usePlanner(ownerId: string) {
  const store = useMemo(() => localStore(ownerId), [ownerId]);
  const [state, setState] = useState<LocalState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("Syncing");
  const [message, setMessage] = useState("");
  const engine = useMemo(
    () =>
      new SyncEngine(
        store,
        httpTransport((path, init) =>
          fetch(path, {
            ...init,
            headers: { ...init?.headers, "X-Timely-Account": ownerId },
          }),
        ),
        "web",
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        (status, detail) => {
          setSyncStatus(status);
          setMessage(detail ?? "");
        },
      ),
    [store, ownerId],
  );
  const sync = useMemo(
    () =>
      async (force = false, quiet = false) => {
        if (!navigator.onLine) {
          setSyncStatus("Offline");
          return;
        }
        if (!quiet) setSyncStatus("Syncing");
        const run = () => engine.run(force, { quiet });
        if (navigator.locks)
          await navigator.locks.request(`timely-sync:${ownerId}`, run);
        else await run();
      },
    [engine, ownerId],
  );
  const account = useMemo(() => accountActions(fetch, ownerId), [ownerId]);
  useEffect(() => {
    const unsubscribe = store.subscribe(setState);
    const trigger = () => {
      if (!document.hidden) void sync(false, true);
    };
    const offline = () => setSyncStatus("Offline");
    void sync();
    window.addEventListener("online", trigger);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", trigger);
    const timer = setInterval(trigger, 15000);
    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("online", trigger);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", trigger);
    };
  }, [store, sync]);
  return {
    state,
    preferences: visiblePreferences(state),
    async setPreferences(patch: PreferencePatch) {
      await savePreferences(store, patch, () => crypto.randomUUID());
      setSyncStatus(navigator.onLine ? "Saved locally" : "Offline");
      void sync();
    },
    records: state ? visibleRecords(state).records : [],
    syncStatus,
    message,
    sync,
    store,
    history: (input: HistoryRequest) => loadHistory(fetch, ownerId, input),
    async retry() {
      await engine.pause();
      try { await retrySavedChanges(store); } finally { engine.resume(); }
      await sync(true);
    },
    async discard(definitionId: string) {
      await engine.pause();
      try { await discardLocalChanges(store, definitionId); } finally { engine.resume(); }
      await sync(true);
    },
    async prepareSignOut(discard = false) {
      await sync(true);
      await engine.pause();
      try {
        const state = await store.read();
        if (state.outbox.length && !discard) throw new Error("Sync your saved changes or choose Discard changes and sign out.");
        await account.unregister(state.deviceId);
        return state;
      } catch (error) { engine.resume(); throw error; }
    },
    resume: () => engine.resume(),
    async deleteAccount() {
      await engine.pause();
      try {
        await account.delete();
        await store.purge();
      } catch (error) { engine.resume(); throw error; }
    },
    async saveBatch(changes: Array<{ definitionId: string; command: Command }>) {
      await saveLocalBatch(store, changes, () => crypto.randomUUID());
      setSyncStatus("Saved locally");
      void sync();
    },
    async save(definitionId: string, command: Command) {
      const operation = await saveLocal(store, definitionId, command, () => crypto.randomUUID());
      setSyncStatus(navigator.onLine ? "Saved locally" : "Offline");
      void sync();
      return operation;
    },
  };
}
