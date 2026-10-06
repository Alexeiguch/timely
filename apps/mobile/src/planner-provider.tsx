import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Alert, Platform, Text, View } from "react-native";
import * as Network from "expo-network";
import * as Crypto from "expo-crypto";
import {
  newTask,
  today,
  setState as transition,
  type PlannerMode,
  projectSeries,
  type Scope,
} from "@timely/domain";
import {
  editableTask,
  editorCommand,
  httpTransport,
  occurrenceTarget,
  saveLocal,
  saveLocalBatch,
  reorderCommands,
  reduceRecord,
  SyncEngine,
  SyncError,
  visibleRecords,
  visiblePreferences,
  savePreferences,
  retrySavedChanges,
  discardLocalChanges,
  accountActions,
  LocalReminderScheduler,
  linkedOccurrence,
  loadHistory,
  type LocalState,
  type SyncStatus,
} from "@timely/sync";
import type {
  Command,
  Occurrence,
  Task,
  TaskRecord,
  Preferences,
  PreferencePatch,
  HistoryRequest,
  HistoryResponse,
} from "@timely/contracts";
import { authClient, authenticatedFetch } from "./auth";
import { useAccount } from "./account";
import { localStore, queueNotificationCleanup } from "./local-store";
import { TaskEditor } from "./task-editor";
import { Button, s } from "./ui";
import * as Notifications from "expo-notifications";
import { notificationAdapter, requestReminderPermission, flushNotificationCleanup } from "./notifications";
type Undo = {
  label: string;
  definitionId: string;
  command: Command;
  expires: number;
};
type Planner = {
  records: TaskRecord[];
  state: LocalState | null;
  loadError: string;
  syncStatus: SyncStatus;
  message: string;
  needsSignIn: boolean;
  zone: string;
  now: number;
  currentDay: string;
  selected: string;
  setSelected: (day: string) => void;
  mode: PlannerMode;
  setMode: (mode: PlannerMode) => void;
  preferences: Preferences;
  setPreferences: (patch: PreferencePatch) => Promise<void>;
  grouped: boolean;
  setGrouped: (value: boolean) => void;
  sync: () => Promise<void>;
  reload: () => void;
  add: (day?: string) => void;
  edit: (item: Occurrence) => void;
  changeState: (item: Occurrence, state: Occurrence["state"]) => Promise<void>;
  move: (item: Occurrence, day: string) => Promise<void>;
  remove: (item: Occurrence, scope: Scope) => Promise<void>;
  reorder: (item: Occurrence, direction: -1 | 1) => Promise<void>;
  signOut: (discard?: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
  retry: () => Promise<void>;
  history: (input: HistoryRequest) => Promise<HistoryResponse>;
  discard: (definitionId: string) => Promise<void>;
  act: (work: () => Promise<void>) => void;
};
const Context = createContext<Planner | null>(null);
export function PlannerProvider({
  children,
  ownerId,
}: {
  children: ReactNode;
  ownerId: string;
}) {
  const account = useAccount();
  const [state, setLocal] = useState<LocalState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("Syncing");
  const [message, setMessage] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [zone, setZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(() => today(zone));
  const [mode, setMode] = useState<PlannerMode>("Day");
  const preferences = useMemo(() => visiblePreferences(state), [state]);
  const [editor, setEditor] = useState<{
    task: Task;
    item?: Occurrence;
  } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [undoing, setUndoing] = useState(false);
  const alive = useRef(true);
  const store = useMemo(() => localStore(ownerId), [ownerId]);
  const accountApi = useMemo(() => accountActions(authenticatedFetch, ownerId), [ownerId]);
  const reminders = useMemo(() => new LocalReminderScheduler(store, notificationAdapter, () => Intl.DateTimeFormat().resolvedOptions().timeZone), [store]);
  const reconcileReminders = () => reminders.run().catch(() => {
    if (alive.current) setMessage("Some reminders could not be updated. Open Settings to retry.");
  });
  const engine = useMemo(
    () =>
      new SyncEngine(
        store,
        async (path, body) => {
          try {
            const result = await httpTransport((url, init) =>
              authenticatedFetch(url, {
                ...init,
                headers: { ...init?.headers, "X-Timely-Account": ownerId },
              }),
            )(path, body);
            if (alive.current) setNeedsSignIn(false);
            return result;
          } catch (error) {
            if (
              alive.current &&
              error instanceof SyncError &&
              (error.status === 401 || error.status === 403)
            )
              setNeedsSignIn(true);
            throw error;
          }
        },
        Platform.OS === "ios" ? "ios" : "android",
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        (value, detail) => {
          if (alive.current) {
            setSyncStatus(value);
            setMessage(detail ?? "");
          }
        },
      ),
    [store, ownerId],
  );
  const reload = () => {
    void store
      .read()
      .then((value) => {
        if (alive.current) {
          setLocal(value);
          setLoadError("");
        }
      })
      .catch(() => {
        if (alive.current)
          setLoadError(
            "Your local plans could not be opened. Retry without clearing your data.",
          );
      });
  };
  const runSync = () => {
    setSyncStatus("Syncing");
    return engine.run(true).catch(() => {
      if (alive.current)
        setLoadError(
          "Local storage is unavailable. Your saved files have not been cleared.",
        );
    });
  };
  useEffect(() => {
    alive.current = true;
    reload();
    const unsubscribe = store.subscribe(reload);
    const tick = (quiet: boolean) => {
      setNow(Date.now());
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      void reconcileReminders();
      void engine
        .run(false, { quiet })
        .catch(() => setLoadError("Unable to read local storage."));
    };
    tick(false);
    const timer = setInterval(() => {
      if (AppState.currentState === "active") tick(true);
    }, 15000);
    const foreground = AppState.addEventListener("change", (value) => {
      if (value === "active") tick(true);
    });
    const network = Network.addNetworkStateListener((value) => {
      if (value.isConnected && value.isInternetReachable !== false) tick(true);
      else setSyncStatus("Offline");
    });
    return () => {
      alive.current = false;
      unsubscribe();
      clearInterval(timer);
      foreground.remove();
      network.remove();
    };
  }, [store, engine]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, undo.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const visible = useMemo(
    () => (state ? visibleRecords(state) : { records: [], errors: [] }),
    [state],
  );
  const records = visible.records;
  const currentDay = today(zone, now);
  useEffect(() => {
    void reconcileReminders();
  }, [state?.clock.physical, state?.clock.logical, state?.cursor, state?.outbox.length]);
  useEffect(() => {
    const open = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};
      if (typeof data.ownerId !== "string" || typeof data.occurrenceId !== "string" || typeof data.day !== "string") return;
      const item = linkedOccurrence(visibleRecords(await store.read()).records, { ownerId: data.ownerId, occurrenceId: data.occurrenceId, day: data.day }, ownerId);
      if (item) { setSelected(item.schedule.date); setMode("Day"); setEditor({ task: editableTask(visibleRecords(await store.read()).records.find((record) => record.id === item.definitionId)!, item), item }); }
      else if (data.ownerId === ownerId) Alert.alert("Plan updated", "This occurrence is no longer available. Your current plans are unchanged.");
      await Notifications.clearLastNotificationResponseAsync();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void open(response); });
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) void open(response); });
    return () => subscription.remove();
  }, [store, ownerId]);
  const persist = async (
    definitionId: string,
    command: Command,
    inverse?: Command,
    label = "Change saved",
  ) => {
    const operation = await saveLocal(
      store,
      definitionId,
      command,
      Crypto.randomUUID,
    );
    await reconcileReminders();
    setSyncStatus("Saved locally");
    setUndo(
      inverse
        ? { definitionId, command: inverse, label, expires: Date.now() + 8000 }
        : null,
    );
    void engine
      .run()
      .catch(() => setLoadError("Unable to synchronize local storage."));
    return operation;
  };
  const act = (work: () => Promise<void>) => {
    void work().catch((error) =>
      Alert.alert(
        "Unable to save",
        error instanceof Error ? error.message : "Please try again.",
      ),
    );
  };
  const clearLocalAccount = async () => {
    try { await store.purge(); } finally { await account.clear(); }
  };
  const value: Planner = {
    records,
    history: (input) => loadHistory(authenticatedFetch, ownerId, input),
    state,
    loadError,
    syncStatus,
    message: visible.errors.length
      ? "Some saved operations need attention. Your outbox is preserved."
      : message,
    needsSignIn,
    zone,
    now,
    currentDay,
    selected,
    setSelected,
    mode,
    setMode,
    preferences,
    setPreferences: async (patch) => {
      await savePreferences(store, patch, Crypto.randomUUID);
      await reconcileReminders();
      setSyncStatus("Saved locally");
      void runSync();
    },
    grouped: preferences.grouped,
    setGrouped: (grouped) =>
      act(async () => {
        await savePreferences(store, { grouped }, Crypto.randomUUID);
        setSyncStatus("Saved locally");
        void runSync();
      }),
    sync: runSync,
    reload,
    add: (day = selected) =>
      setEditor({ task: newTask(Crypto.randomUUID(), day) }),
    edit: (item) => {
      const record = records.find((r) => r.id === item.definitionId);
      if (record) setEditor({ task: editableTask(record, item), item });
    },
    changeState: async (item, next) => {
      const updated = transition(item, next, zone, Date.now());
      await persist(
        item.definitionId,
        {
          type: "state",
          target: occurrenceTarget(item),
          state: next,
          terminal: updated.terminal,
        },
        {
          type: "state",
          target: occurrenceTarget(item),
          state: item.state,
          terminal: item.terminal,
        },
        next === "pending"
          ? "Task reopened"
          : next === "completed"
            ? "Task completed"
            : "Occurrence skipped",
      );
    },
    move: async (item, day) => {
      await persist(
        item.definitionId,
        {
          type: "edit",
          target: occurrenceTarget(item),
          scope: "occurrence",
          patch: { schedule: { ...item.schedule, date: day } },
          currentDay,
        },
        {
          type: "edit",
          target: occurrenceTarget(item),
          scope: "occurrence",
          patch: { schedule: item.schedule },
          currentDay,
        },
        `Moved to ${day}`,
      );
    },
    remove: async (item, scope) => {
      const operation = await persist(item.definitionId, {
        type: "delete",
        target: occurrenceTarget(item),
        scope,
      });
      setUndo({
        definitionId: item.definitionId,
        command: {
          type: "restore",
          target: occurrenceTarget(item),
          scope,
          deletionId: operation.id,
        },
        label:
          scope === "series"
            ? "Series deleted"
            : scope === "future"
              ? "Future occurrences deleted"
              : "Occurrence deleted",
        expires: Date.now() + 8000,
      });
    },
    reorder: async (item, direction) => {
      const siblings = records.flatMap((record) =>
        projectSeries(
          reduceRecord(record),
          item.schedule.date,
          item.schedule.date,
        ),
      );
      const changes = reorderCommands(siblings, item, direction);
      if (!changes.length) return;
      await saveLocalBatch(store, changes, Crypto.randomUUID);
      setUndo(null);
      setSyncStatus("Saved locally");
      void runSync();
    },
    retry: async () => {
      await engine.pause();
      try { await retrySavedChanges(store); } finally { engine.resume(); }
      await runSync();
    },
    discard: async (definitionId) => {
      await engine.pause();
      try { await discardLocalChanges(store, definitionId); } finally { engine.resume(); }
      await runSync();
    },
    deleteAccount: async () => {
      await engine.pause();
      await reminders.pause();
      try {
        await accountApi.delete();
      } catch (error) { engine.resume(); reminders.resume(); throw error; }
      try {
        await queueNotificationCleanup(ownerId);
        await flushNotificationCleanup().catch(() => { /* Retry after restart; account cleanup still completes. */ });
      } finally {
        // A revoked account must leave memory even if storage or OS cleanup fails.
        try { await authClient.signOut(); } finally { await clearLocalAccount(); }
      }
    },
    signOut: async (discard = false) => {
      await engine.run(true);
      await engine.pause();
      await reminders.pause();
      let signedOut = false;
      try {
        const current = await store.read();
        if (current.outbox.length && !discard)
          throw new Error("You have unsynced changes. Reconnect and sync before signing out.");
        await accountApi.unregister(current.deviceId);
        const result = await authClient.signOut();
        if (result.error) throw new Error(result.error.message);
        signedOut = true;
        try {
          await queueNotificationCleanup(ownerId);
          await flushNotificationCleanup().catch(() => { /* Account-local cleanup stays queued. */ });
        } finally { await clearLocalAccount(); }
      } catch (error) { if (!signedOut) { engine.resume(); reminders.resume(); } throw error; }
    },
    act,
  };
  return (
    <Context.Provider value={value}>
      {children}
      {undo && (
        <View style={s.notice} accessibilityLiveRegion="polite">
          <Text style={s.body}>{undo.label}</Text>
          <Button
            title="Undo"
            disabled={undoing}
            onPress={() => {
              setUndoing(true);
              act(async () => {
                try {
                  await persist(undo.definitionId, undo.command);
                } finally {
                  setUndoing(false);
                }
              });
            }}
          />
        </View>
      )}
      {editor && (
        <TaskEditor
          initial={editor.task}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSave={async (task, scope) => {
            const command = editorCommand(
              editor.task,
              task,
              editor.item,
              scope,
              currentDay,
            );
            if (command) await persist(task.id, command);
            if (task.reminders.enabled) { await requestReminderPermission(); await reconcileReminders(); }
          }}
        />
      )}
    </Context.Provider>
  );
}
export function usePlanner() {
  const value = useContext(Context);
  if (!value) throw new Error("Planner requires an account.");
  return value;
}
