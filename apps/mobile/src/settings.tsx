import { LanguageChoice } from "./language";
import { t, locale } from "@timely/i18n";
import { useLanguage } from "./language-state";
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
  useLanguage();
  const account = useAccount();
  const p = usePlanner();
  const [before, setBefore] = useState(String(p.preferences.beforeMinutes));
  const [overdue, setOverdue] = useState(String(p.preferences.overdueMinutes));
  useEffect(() => {
    setBefore(String(p.preferences.beforeMinutes));
    setOverdue(String(p.preferences.overdueMinutes));
  }, [p.preferences.beforeMinutes, p.preferences.overdueMinutes]);
  const reminderPatch = (patch: Partial<typeof p.preferences>) =>
    p.act(() =>
      p.setPreferences({
        reminders: {
          before: p.preferences.before,
          overdue: p.preferences.overdue,
          beforeMinutes: p.preferences.beforeMinutes,
          overdueMinutes: p.preferences.overdueMinutes,
          morning: p.preferences.morning,
          ...patch,
        },
      }),
    );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.heading} accessibilityRole="header">
          {t("Settings")}
        </Text>
        <PlannerStatus />
        <View style={s.card}>
          <LanguageChoice />
        </View>
        <View style={s.card}>
          <Text style={s.section}>{t("Your account")}</Text>
          <Text style={s.body}>{account.identity?.email}</Text>
          <Text style={s.muted}>{t("Your plans stay with your account.")}</Text>
          <Button
            title={t("Sign out")}
            onPress={() =>
              Alert.alert(
                t("Sign out of Timely?"),
                t(
                  "After your changes sync, this account\u2019s plans will be removed from this device.",
                ),
                [
                  { text: t("Cancel"), style: "cancel" },
                  { text: t("Sign out"), onPress: () => p.act(p.signOut) },
                ],
              )
            }
          />
          {!!p.state?.outbox.length && (
            <Button
              title={t("Discard changes and sign out")}
              variant="destructive"
              onPress={() =>
                Alert.alert(
                  t("Discard unsynced changes?"),
                  t(
                    "Changes saved only on this device will be permanently lost after sign-out. Connect to finish signing out.",
                  ),
                  [
                    { text: t("Cancel"), style: "cancel" },
                    {
                      text: t("Discard and sign out"),
                      style: "destructive",
                      onPress: () => p.act(() => p.signOut(true)),
                    },
                  ],
                )
              }
            />
          )}
          <Button
            title={t("Delete account")}
            variant="destructive"
            onPress={() =>
              Alert.alert(
                t("Delete your account permanently?"),
                t(
                  "All tasks, history and preferences will be deleted on every device. Unsynced changes here will be discarded. Sign in within the last five minutes before continuing.",
                ),
                [
                  { text: t("Cancel"), style: "cancel" },
                  {
                    text: t("Delete account"),
                    style: "destructive",
                    onPress: () => p.act(p.deleteAccount),
                  },
                ],
              )
            }
          />
        </View>
        <View style={s.card}>
          <Text style={s.section}>{t("Sync & offline")}</Text>
          <Text style={s.body}>
            {t("{v0} pending changes", { v0: p.state?.outbox.length ?? 0 })}
          </Text>
          <Text style={s.muted}>
            {t("Last synced: {v0}", {
              v0: p.state?.lastSync
                ? new Date(p.state.lastSync).toLocaleString(locale())
                : t("Not yet"),
            })}
          </Text>
          <Text style={s.muted}>
            {t("Initial download: {v0}", {
              v0: p.state?.bootstrapped ? t("Complete") : t("Needs connection"),
            })}
          </Text>
          {p.state?.outbox.some((item) => item.error) && (
            <Text style={s.body}>
              {t(
                "Some edits could not be applied. They remain saved on this device; automatic deletion is disabled.",
              )}
            </Text>
          )}
          <Button
            title={t("Retry saved changes")}
            onPress={() => p.act(p.retry)}
          />
          {Array.from(
            new Set(
              p.state?.outbox
                .filter((item) => item.error)
                .map((item) => item.operation.definitionId) ?? [],
            ),
          ).map((definitionId) => (
            <View key={definitionId}>
              <Text style={s.body}>{t("Saved changes need attention.")}</Text>
              <Button
                title={t("Discard this task\u2019s unsynced changes")}
                variant="destructive"
                onPress={() =>
                  Alert.alert(
                    t("Discard these changes?"),
                    t(
                      "All unsynced edits for this task will be removed together. Its last synchronized version will remain.",
                    ),
                    [
                      { text: t("Cancel"), style: "cancel" },
                      {
                        text: t("Discard changes"),
                        style: "destructive",
                        onPress: () => p.act(() => p.discard(definitionId)),
                      },
                    ],
                  )
                }
              />
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.section}>{t("Calendar & time")}</Text>
          <Text style={s.body}>{p.zone.replaceAll("_", " ")}</Text>
          <Text style={s.muted}>
            {t(
              "Time zone follows this device and refreshes when you return to the app. A 09:00 plan stays at 09:00 local time. Calendar choices sync across your devices.",
            )}
          </Text>
          <Choices
            label={t("First day of the week")}
            value={String(p.preferences.firstWeekday)}
            options={[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((label, index) => ({
              value: String(index + 1),
              label: t(label),
            }))}
            onChange={(value) =>
              p.act(() => p.setPreferences({ firstWeekday: Number(value) }))
            }
          />
          <Choices
            label={t("Month view")}
            value={p.grouped ? "grouped" : "all"}
            options={[
              { value: "grouped", label: t("Grouped") },
              { value: "all", label: t("All occurrences") },
            ]}
            onChange={(value) => p.setGrouped(value === "grouped")}
          />
        </View>
        <View style={s.card}>
          <Text style={s.section}>{t("Reminders")}</Text>
          <Text style={s.body}>
            {t(
              "Up to 48 reminders are scheduled locally for the next seven days. Remote reminders cover eligible plans beyond that local coverage when available.",
            )}
          </Text>
          <Text style={s.muted}>
            {t("Remote reminders: {v0}", {
              v0: t(p.state?.reminders?.remoteStatus ?? "not-configured"),
            })}
          </Text>
          <Button
            title={t("Test remote notification")}
            disabled={p.state?.reminders?.remoteStatus !== "ready"}
            onPress={() => p.act(p.testPush)}
          />
          <Text style={s.muted}>
            {t(
              "Permission: {v0} \u00B7 {v1} scheduled \u00B7 {v2} outside local coverage",
              {
                v0: t(p.state?.reminders?.permission ?? "Not checked"),
                v1: p.state?.reminders?.scheduled ?? 0,
                v2: p.state?.reminders?.uncovered ?? 0,
              },
            )}
          </Text>
          {p.state?.reminders?.retry && (
            <Text style={s.body}>
              {t("Scheduling needs another attempt. Your plans remain saved.")}
            </Text>
          )}
          <View style={s.row}>
            <Text style={s.body}>{t("Before task")}</Text>
            <Switch
              accessibilityLabel={t("Default before reminders")}
              value={p.preferences.before}
              onValueChange={(before) => reminderPatch({ before })}
            />
          </View>
          <View style={s.row}>
            <Text style={s.body}>{t("When overdue")}</Text>
            <Switch
              accessibilityLabel={t("Default overdue reminders")}
              value={p.preferences.overdue}
              onValueChange={(overdue) => reminderPatch({ overdue })}
            />
          </View>
          <Field
            label={t("Minutes before a timed task")}
            value={before}
            onChangeText={setBefore}
            keyboardType="number-pad"
          />
          <Field
            label={t("Minutes after a timed task is due")}
            value={overdue}
            onChangeText={setOverdue}
            keyboardType="number-pad"
          />
          <Button
            title={t("Save reminder timing")}
            onPress={() => {
              const beforeMinutes = Number(before),
                overdueMinutes = Number(overdue);
              if (
                ![before, overdue].every((value) => /^\d+$/.test(value)) ||
                ![beforeMinutes, overdueMinutes].every(
                  (value) => value <= 10080,
                )
              ) {
                Alert.alert(
                  t("Check timing"),
                  t("Use whole minutes between 0 and 10,080."),
                );
                return;
              }
              reminderPatch({ beforeMinutes, overdueMinutes });
            }}
          />
          <DateField
            label={t("Untimed morning reminder")}
            mode="time"
            value={p.preferences.morning}
            onChange={(morning) => reminderPatch({ morning })}
          />
          <Button
            title={t("Enable device reminders")}
            onPress={() =>
              p.act(async () => {
                await requestReminderPermission();
                await p.retry();
              })
            }
          />
          <Button
            title={t("Open device settings")}
            onPress={() => {
              void Linking.openSettings().catch(() =>
                Alert.alert(
                  t("Open Settings"),
                  t("Open the Settings app on your device."),
                ),
              );
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
