import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {
  addDays,
  date,
  projectSeries,
  setState,
  status,
  today,
} from "@timely/domain";
import {
  httpTransport,
  occurrenceTarget,
  reduceRecord,
  saveLocal,
  SyncEngine,
  visibleRecords,
  type LocalState,
  type SyncStatus,
} from "@timely/sync";
import { taskSchema, type Occurrence, type Task } from "@timely/contracts";
import { colors } from "@timely/design";
import { authenticatedFetch, authClient } from "./auth";
import { localStore } from "./local-store";
function Button({
  title,
  onPress,
  active = false,
}: {
  title: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.button, active && styles.activeButton]}
    >
      <Text style={[styles.buttonText, active && { color: "white" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function NativePlanner({
  ownerId,
  email,
  onSignOut,
}: {
  ownerId: string;
  email: string;
  onSignOut: () => void;
}) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [selected, setSelected] = useState(today(zone));
  const [mode, setMode] = useState<"Day" | "Week" | "Month">("Day");
  const [state, setLocal] = useState<LocalState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("Syncing");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Task | null>(null);
  const [now, setNow] = useState(Date.now());
  const store = useMemo(() => localStore(ownerId), [ownerId]);
  const engine = useMemo(
    () =>
      new SyncEngine(
        store,
        httpTransport((path, init) =>
          authenticatedFetch(path, {
            ...init,
            headers: { ...init?.headers, "X-Timely-Account": ownerId },
          }),
        ),
        Platform.OS === "ios" ? "ios" : "android",
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        (value, detail) => {
          setSyncStatus(value);
          setMessage(detail ?? "");
        },
      ),
    [store, ownerId],
  );
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void store
        .read()
        .then((value) => {
          if (active) setLocal(value);
        })
        .catch(() => {});
    };
    refresh();
    const unsubscribe = store.subscribe(refresh);
    void engine.run();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        setNow(Date.now());
        void engine.run();
      }
    }, 15000);
    const foreground = AppState.addEventListener("change", (value) => {
      if (value === "active") void engine.run();
    });
    return () => {
      active = false;
      unsubscribe();
      clearInterval(interval);
      foreground.remove();
    };
  }, [store, engine]);
  const from =
    mode === "Day"
      ? selected
      : mode === "Week"
        ? addDays(selected, 1 - date(selected).dayOfWeek)
        : date(selected).with({ day: 1 }).toString();
  const through =
    mode === "Day"
      ? selected
      : mode === "Week"
        ? addDays(from, 6)
        : date(from).add({ months: 1 }).subtract({ days: 1 }).toString();
  const items = useMemo(
    () =>
      state
        ? visibleRecords(state).records.flatMap((record) =>
            projectSeries(reduceRecord(record), from, through),
          )
        : [],
    [state, from, through],
  );
  const act = async (work: () => Promise<unknown>) => {
    try {
      await work();
      setSyncStatus("Saved locally");
      void engine.run();
    } catch (error) {
      Alert.alert(
        "Unable to save",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const changeState = (item: Occurrence, value: Occurrence["state"]) =>
    act(async () => {
      const changed = setState(item, value, zone, Date.now());
      await saveLocal(
        store,
        item.definitionId,
        {
          type: "state",
          target: occurrenceTarget(item),
          state: value,
          terminal: changed.terminal,
        },
        Crypto.randomUUID,
      );
    });
  const newTask = () =>
    setDraft({
      id: Crypto.randomUUID(),
      title: "",
      notes: "",
      priority: null,
      schedule: { date: selected, time: null, duration: null },
      reminders: { enabled: false, before: true, overdue: true },
      rule: null,
    });
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>timely ✳</Text>
        <Text style={styles.heading} accessibilityRole="header">
          Your day, your pace.
        </Text>
        <View style={styles.row}>
          <Text style={styles.caption} accessibilityLiveRegion="polite">
            {syncStatus}
            {state?.outbox.length ? ` · ${state.outbox.length} pending` : ""}
          </Text>
          <Button title="Sync now" onPress={() => void engine.run(true)} />
        </View>
        {!!message && <Text style={styles.notice}>{message}</Text>}
        <View style={styles.row}>
          {(["Day", "Week", "Month"] as const).map((value) => (
            <Button
              key={value}
              title={value}
              active={mode === value}
              onPress={() => setMode(value)}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Button
            title="Previous"
            onPress={() =>
              setSelected(
                mode === "Month"
                  ? date(selected).subtract({ months: 1 }).toString()
                  : addDays(selected, mode === "Week" ? -7 : -1),
              )
            }
          />
          <Button title="Today" onPress={() => setSelected(today(zone))} />
          <Button
            title="Next"
            onPress={() =>
              setSelected(
                mode === "Month"
                  ? date(selected).add({ months: 1 }).toString()
                  : addDays(selected, mode === "Week" ? 7 : 1),
              )
            }
          />
        </View>
        <Text style={styles.sectionTitle}>
          {mode === "Day"
            ? date(selected).toLocaleString("en-GB", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : `${from} – ${through}`}
        </Text>
        <Button title="+ Add task" active onPress={newTask} />
        {!items.length && (
          <View style={styles.empty}>
            <Text style={styles.doodle}>✳</Text>
            <Text style={styles.sectionTitle}>A little breathing room.</Text>
            <Text style={styles.body}>
              Make room for something that matters to you.
            </Text>
          </View>
        )}
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.card,
              status(item, zone, now) === "overdue" && {
                borderLeftWidth: 5,
                borderLeftColor: colors.orange,
              },
            ]}
          >
            <View style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.state === "completed" }}
                accessibilityLabel={`Complete ${item.title}`}
                onPress={() =>
                  void changeState(
                    item,
                    item.state === "completed" ? "pending" : "completed",
                  )
                }
                style={styles.checkbox}
              >
                <Text style={styles.checkboxText}>
                  {item.state === "completed" ? "✓" : "○"}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.caption}>
                  {item.schedule.date} · {item.schedule.time ?? "Any time"}
                  {item.priority ? ` · ${item.priority} priority` : ""}
                </Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
            </View>
            {!!item.notes && <Text style={styles.body}>{item.notes}</Text>}
            <Text style={styles.caption}>{status(item, zone, now)}</Text>
            <View style={styles.row}>
              <Button
                title={item.state === "skipped" ? "Unskip" : "Skip"}
                onPress={() =>
                  void changeState(
                    item,
                    item.state === "skipped" ? "pending" : "skipped",
                  )
                }
              />
              <Button
                title="Tomorrow"
                onPress={() =>
                  void act(() =>
                    saveLocal(
                      store,
                      item.definitionId,
                      {
                        type: "edit",
                        target: occurrenceTarget(item),
                        scope: "occurrence",
                        patch: {
                          schedule: {
                            ...item.schedule,
                            date: addDays(today(zone), 1),
                          },
                        },
                        currentDay: today(zone),
                      },
                      Crypto.randomUUID,
                    ),
                  )
                }
              />
              <Button
                title="Delete"
                onPress={() =>
                  Alert.alert(
                    "Delete this occurrence?",
                    "Other days in a repeating plan will remain.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          void act(() =>
                            saveLocal(
                              store,
                              item.definitionId,
                              {
                                type: "delete",
                                target: occurrenceTarget(item),
                                scope: "occurrence",
                              },
                              Crypto.randomUUID,
                            ),
                          ),
                      },
                    ],
                  )
                }
              />
            </View>
          </View>
        ))}
        <Text style={styles.caption}>{email}</Text>
        <Button
          title="Sign out"
          onPress={() =>
            void act(async () => {
              if ((await store.read()).outbox.length)
                throw new Error("Sync your saved changes before signing out.");
              const result = await authClient.signOut();
              if (result.error) throw new Error(result.error.message);
              await store.purge();
              onSignOut();
            })
          }
        />
      </ScrollView>
      <Modal
        visible={!!draft}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDraft(null)}
      >
        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
          >
            {draft && (
              <>
                <Text style={styles.heading}>Make a little plan</Text>
                <Text style={styles.label}>Task title</Text>
                <TextInput
                  accessibilityLabel="Task title"
                  style={styles.input}
                  value={draft.title}
                  maxLength={200}
                  onChangeText={(title) => setDraft({ ...draft, title })}
                />
                <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  accessibilityLabel="Date"
                  style={styles.input}
                  value={draft.schedule.date}
                  onChangeText={(value) =>
                    setDraft({
                      ...draft,
                      schedule: { ...draft.schedule, date: value },
                    })
                  }
                />
                <Text style={styles.label}>Start time (HH:mm, optional)</Text>
                <TextInput
                  accessibilityLabel="Start time"
                  style={styles.input}
                  value={draft.schedule.time ?? ""}
                  onChangeText={(value) =>
                    setDraft({
                      ...draft,
                      schedule: { ...draft.schedule, time: value || null },
                    })
                  }
                />
                <Text style={styles.label}>Duration in minutes (optional)</Text>
                <TextInput
                  accessibilityLabel="Duration"
                  keyboardType="number-pad"
                  style={styles.input}
                  value={draft.schedule.duration?.toString() ?? ""}
                  onChangeText={(value) =>
                    setDraft({
                      ...draft,
                      schedule: {
                        ...draft.schedule,
                        duration: value ? Number(value) : null,
                      },
                    })
                  }
                />
                <Text style={styles.label}>Priority</Text>
                <View style={styles.row}>
                  {([null, "low", "medium", "high"] as const).map((value) => (
                    <Button
                      key={value ?? "none"}
                      title={value ?? "None"}
                      active={draft.priority === value}
                      onPress={() => setDraft({ ...draft, priority: value })}
                    />
                  ))}
                </View>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  accessibilityLabel="Notes"
                  multiline
                  style={[styles.input, { minHeight: 100 }]}
                  value={draft.notes}
                  onChangeText={(notes) => setDraft({ ...draft, notes })}
                />
                <Text style={styles.caption}>
                  Custom repeating plans can currently be created in the web
                  planner and synchronized here.
                </Text>
                <Button
                  title="Save task"
                  active
                  onPress={() =>
                    void act(async () => {
                      const task = taskSchema.parse(draft);
                      await saveLocal(
                        store,
                        task.id,
                        { type: "create", task },
                        Crypto.randomUUID,
                      );
                      setDraft(null);
                    })
                  }
                />
                <Button title="Cancel" onPress={() => setDraft(null)} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: 24, gap: 16, paddingBottom: 48 },
  brand: { fontFamily: "Baloo2", color: colors.primary, fontSize: 32 },
  heading: { fontFamily: "Baloo2", color: colors.text, fontSize: 32 },
  sectionTitle: { fontFamily: "Baloo2", color: colors.text, fontSize: 24 },
  body: {
    fontFamily: "NunitoSans",
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: { fontFamily: "NunitoSans", color: colors.muted, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  button: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dae0d6",
    justifyContent: "center",
  },
  activeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: { fontFamily: "NunitoSans", color: colors.text, fontSize: 15 },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderColor: "#e5e7df",
    borderWidth: 1,
  },
  cardTitle: { fontFamily: "Baloo2", color: colors.text, fontSize: 22 },
  checkbox: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.lime,
  },
  checkboxText: { color: colors.primary, fontSize: 28 },
  empty: { alignItems: "center", padding: 24, gap: 12 },
  doodle: { fontSize: 64, color: colors.primary },
  notice: {
    backgroundColor: colors.lime,
    padding: 16,
    borderRadius: 16,
    color: colors.text,
  },
  label: { fontFamily: "NunitoSans", fontSize: 16, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "#a9b3c2",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    minHeight: 48,
    fontFamily: "NunitoSans",
    fontSize: 16,
    color: colors.text,
  },
});
