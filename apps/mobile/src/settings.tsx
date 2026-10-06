import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccount } from "./account";
import { usePlanner } from "./planner-provider";
import { PlannerStatus } from "./planner-header";
import { Button, Choices, Field, s } from "./ui";
import { DateField } from "./date-field";
import { requestReminderPermission } from "./notifications";
export function Settings() {
  const account = useAccount();
  const p = usePlanner();
  const [before, setBefore] = useState(String(p.preferences.beforeMinutes));
  const [overdue, setOverdue] = useState(String(p.preferences.overdueMinutes));
  useEffect(() => { setBefore(String(p.preferences.beforeMinutes)); setOverdue(String(p.preferences.overdueMinutes)); }, [p.preferences.beforeMinutes, p.preferences.overdueMinutes]);
  const reminderPatch = (patch: Partial<typeof p.preferences>) => p.act(() => p.setPreferences({ reminders: {
    before: p.preferences.before, overdue: p.preferences.overdue, beforeMinutes: p.preferences.beforeMinutes,
    overdueMinutes: p.preferences.overdueMinutes, morning: p.preferences.morning, ...patch,
  } }));
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.heading} accessibilityRole="header">
          Settings
        </Text>
        <PlannerStatus />
        <View style={s.card}>
          <Text style={s.section}>Your account</Text>
          <Text style={s.body}>{account.identity?.email}</Text>
          <Text style={s.muted}>Your plans stay with your account.</Text>
          <Button
            title="Sign out"
            onPress={() =>
              Alert.alert(
                "Sign out of Timely?",
                "After your changes sync, this account’s plans will be removed from this device.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign out", onPress: () => p.act(p.signOut) },
                ],
              )
            }
          />
          {!!p.state?.outbox.length && <Button title="Discard changes and sign out" variant="destructive"
            onPress={() => Alert.alert("Discard unsynced changes?", "Changes saved only on this device will be permanently lost after sign-out. Connect to finish signing out.", [
              { text: "Cancel", style: "cancel" },
              { text: "Discard and sign out", style: "destructive", onPress: () => p.act(() => p.signOut(true)) },
            ])} />}
          <Button title="Delete account" variant="destructive" onPress={() => Alert.alert(
            "Delete your account permanently?", "All tasks, history and preferences will be deleted on every device. Unsynced changes here will be discarded. Sign in within the last five minutes before continuing.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete account", style: "destructive", onPress: () => p.act(p.deleteAccount) },
            ])} />
        </View>
        <View style={s.card}>
          <Text style={s.section}>Sync & offline</Text>
          <Text style={s.body}>
            {p.state?.outbox.length ?? 0} pending changes
          </Text>
          <Text style={s.muted}>
            Last synced:{" "}
            {p.state?.lastSync
              ? new Date(p.state.lastSync).toLocaleString()
              : "Not yet"}
          </Text>
          <Text style={s.muted}>
            Initial download:{" "}
            {p.state?.bootstrapped ? "Complete" : "Needs connection"}
          </Text>
          {p.state?.outbox.some((item) => item.error) && (
            <Text style={s.body}>
              Some edits could not be applied. They remain saved on this device;
              automatic deletion is disabled.
            </Text>
          )}
          <Button title="Retry saved changes" onPress={() => p.act(p.retry)} />
          {Array.from(new Set(p.state?.outbox.filter((item) => item.error).map((item) => item.operation.definitionId) ?? [])).map((definitionId) => (
            <View key={definitionId}>
              <Text style={s.body}>Saved changes need attention.</Text>
              <Button title="Discard this task’s unsynced changes" variant="destructive" onPress={() => Alert.alert(
                "Discard these changes?", "All unsynced edits for this task will be removed together. Its last synchronized version will remain.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Discard changes", style: "destructive", onPress: () => p.act(() => p.discard(definitionId)) },
                ])} />
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.section}>Calendar & time</Text>
          <Text style={s.body}>{p.zone.replaceAll("_", " ")}</Text>
          <Text style={s.muted}>
            Time zone follows this device and refreshes when you return to the
            app. A 09:00 plan stays at 09:00 local time. Calendar choices sync
            across your devices.
          </Text>
          <Choices
            label="First day of the week"
            value={String(p.preferences.firstWeekday)}
            options={[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((label, index) => ({ value: String(index + 1), label }))}
            onChange={(value) =>
              p.act(() => p.setPreferences({ firstWeekday: Number(value) }))
            }
          />
          <Choices
            label="Month view"
            value={p.grouped ? "grouped" : "all"}
            options={[
              { value: "grouped", label: "Grouped" },
              { value: "all", label: "All occurrences" },
            ]}
            onChange={(value) => p.setGrouped(value === "grouped")}
          />
        </View>
        <View style={s.card}>
          <Text style={s.section}>Reminders</Text>
          <Text style={s.body}>
            Task reminders are scheduled on this device for the next seven days, up to 48 at a time. Later reminders need the app to open again. Remote delivery is not enabled yet.
          </Text>
          <Text style={s.muted}>Permission: {p.state?.reminders?.permission ?? "Not checked"} · {p.state?.reminders?.scheduled ?? 0} scheduled · {p.state?.reminders?.uncovered ?? 0} outside local coverage</Text>
          {p.state?.reminders?.retry && <Text style={s.body}>Scheduling needs another attempt. Your plans remain saved.</Text>}
          <View style={s.row}><Text style={s.body}>Before task</Text><Switch accessibilityLabel="Default before reminders" value={p.preferences.before} onValueChange={(before) => reminderPatch({ before })} /></View>
          <View style={s.row}><Text style={s.body}>When overdue</Text><Switch accessibilityLabel="Default overdue reminders" value={p.preferences.overdue} onValueChange={(overdue) => reminderPatch({ overdue })} /></View>
          <Field label="Minutes before a timed task" value={before} onChangeText={setBefore} keyboardType="number-pad" />
          <Field label="Minutes after a timed task is due" value={overdue} onChangeText={setOverdue} keyboardType="number-pad" />
          <Button title="Save reminder timing" onPress={() => {
            const beforeMinutes = Number(before), overdueMinutes = Number(overdue);
            if (![before, overdue].every((value) => /^\d+$/.test(value)) || ![beforeMinutes, overdueMinutes].every((value) => value <= 10080)) {
              Alert.alert("Check timing", "Use whole minutes between 0 and 10,080."); return;
            }
            reminderPatch({ beforeMinutes, overdueMinutes });
          }} />
          <DateField label="Untimed morning reminder" mode="time" value={p.preferences.morning} onChange={(morning) => reminderPatch({ morning })} />
          <Button title="Enable device reminders" onPress={() => p.act(async () => { await requestReminderPermission(); await p.retry(); })} />
          <Button
            title="Open device settings"
            onPress={() => {
              void Linking.openSettings().catch(() =>
                Alert.alert(
                  "Open Settings",
                  "Open the Settings app on your device.",
                ),
              );
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
