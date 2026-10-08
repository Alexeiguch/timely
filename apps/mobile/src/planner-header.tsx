import { t, locale, errorMessage } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { Pressable, Text, View } from "react-native";
import { CloudCheck, RefreshCw, CloudOff } from "lucide-react-native";
import { colors } from "@timely/design";
import { router } from "expo-router";
import { usePlanner } from "./planner-provider";
import { useAccount } from "./account";
import { Button, s } from "./ui";
export function PlannerStatus({ compact = false }: { compact?: boolean }) {
  useLanguage();
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
          {t(p.syncStatus)}
          {p.state?.outbox.length
            ? t(" \u00B7 {v0} pending", { v0: p.state.outbox.length })
            : ""}
        </Text>
        {!compact && (
          <Button
            title={t("Sync now")}
            variant="ghost"
            onPress={() => void p.sync()}
          />
        )}
      </View>
      {!!p.loadError && (
        <View style={s.error}>
          <Text style={s.body}>{errorMessage(p.loadError)}</Text>
          <Button title={t("Retry local storage")} onPress={p.reload} />
        </View>
      )}
      {!!account.error && (
        <Text style={s.muted}>{errorMessage(account.error)}</Text>
      )}
      {p.needsSignIn ? (
        <View style={s.notice}>
          <Text style={s.body}>
            {t("Sign in again as {v0} to sync. Your offline edits are safe.", {
              v0: account.identity?.email,
            })}
          </Text>
          <Button
            title={t("Sign in again")}
            onPress={() => router.push("/sign-in")}
          />
        </View>
      ) : (
        !!p.message && <Text style={s.muted}>{errorMessage(p.message)}</Text>
      )}
      {!p.state?.bootstrapped && (
        <Text style={s.muted}>
          {t(
            "Your first download needs a connection. Locally saved tasks remain available.",
          )}
        </Text>
      )}
    </View>
  );
}
