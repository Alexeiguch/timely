"use client";
import { useEffect, useMemo, useState } from "react";
import {
  httpTransport,
  saveLocal,
  SyncEngine,
  visibleRecords,
  type LocalState,
  type SyncStatus,
} from "@timely/sync";
import type { Command } from "@timely/contracts";
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
      async (force = false) => {
        if (!navigator.onLine) {
          setSyncStatus("Offline");
          return;
        }
        if (navigator.locks)
          await navigator.locks.request(`timely-sync:${ownerId}`, () =>
            engine.run(force),
          );
        else await engine.run(force);
      },
    [engine, ownerId],
  );
  useEffect(() => {
    const unsubscribe = store.subscribe(setState);
    const trigger = () => {
      if (!document.hidden) void sync();
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
    records: state ? visibleRecords(state).records : [],
    syncStatus,
    message,
    sync,
    store,
    async save(definitionId: string, command: Command) {
      await saveLocal(store, definitionId, command, () => crypto.randomUUID());
      setSyncStatus(navigator.onLine ? "Saved locally" : "Offline");
      void sync();
    },
  };
}
