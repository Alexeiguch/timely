import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccount } from "./account";
import { usePlanner } from "./planner-provider";
import { PlannerStatus } from "./planner-header";
import { Button, Choices, s } from "./ui";
export function Settings() {
  const account = useAccount();
  const p = usePlanner();
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
        </View>
        <View style={s.card}>
          <Text style={s.section}>Calendar & time</Text>
          <Text style={s.body}>{p.zone.replaceAll("_", " ")}</Text>
          <Text style={s.muted}>
            Time zone follows this device and refreshes when you return to the
            app. A 09:00 plan stays at 09:00 local time. Weeks start on Monday.
          </Text>
          <Choices
            label="Month view for this session"
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
            Reminders aren’t available yet. You can save your choices on each
            task for later.
          </Text>
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
        <Text style={s.muted}>
          Account preferences and account deletion are not available yet.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
