import { Pressable, Text, View } from "react-native";
import { CloudCheck, RefreshCw, CloudOff } from "lucide-react-native";
import { colors } from "@timely/design";
import { router } from "expo-router";
import { usePlanner } from "./planner-provider";
import { useAccount } from "./account";
import { Button, s } from "./ui";
export function PlannerStatus({ compact = false }: { compact?: boolean }) {
  const p = usePlanner();
  const account = useAccount();
  return (
    <View style={s.field}>
      <View style={s.row}>
        {p.syncStatus === "Synced" ? (
          <CloudCheck size={16} color={colors.muted} />
        ) : p.syncStatus === "Offline" ? (
          <CloudOff size={16} color={colors.muted} />
        ) : (
          <RefreshCw size={16} color={colors.muted} />
        )}
        <Text style={[s.muted, s.grow]} accessibilityLiveRegion="polite">
          {p.syncStatus}
          {p.state?.outbox.length ? ` · ${p.state.outbox.length} pending` : ""}
        </Text>
        {!compact && (
          <Button
            title="Sync now"
            variant="ghost"
            onPress={() => void p.sync()}
          />
        )}
      </View>
      {!!p.loadError && (
        <View style={s.error}>
          <Text style={s.body}>{p.loadError}</Text>
          <Button title="Retry local storage" onPress={p.reload} />
        </View>
      )}
      {!!account.error && <Text style={s.muted}>{account.error}</Text>}
      {p.needsSignIn ? (
        <View style={s.notice}>
          <Text style={s.body}>
            Sign in again as {account.identity?.email} to sync. Your offline
            edits are safe.
          </Text>
          <Button
            title="Sign in again"
            onPress={() => router.push("/sign-in")}
          />
        </View>
      ) : (
        !!p.message && <Text style={s.muted}>{p.message}</Text>
      )}
      {!p.state?.bootstrapped && (
        <Text style={s.muted}>
          Your first download needs a connection. Locally saved tasks remain
          available.
        </Text>
      )}
    </View>
  );
}
