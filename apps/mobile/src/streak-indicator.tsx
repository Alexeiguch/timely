import { t, locale, streakText } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { StyleSheet, Text, View } from "react-native";
import { Check, Flame, X } from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import type { Occurrence } from "@timely/contracts";
import {
  boundaries,
  date,
  streakKey,
  formatCivilDate,
  streakOutcome,
} from "@timely/domain";
import { usePlanner } from "./planner-provider";
import { s } from "./ui";
export function StreakIndicator({ item }: { item: Occurrence }) {
  useLanguage();
  const planner = usePlanner();
  const streak = planner.streaks.get(streakKey(item));
  if (!item.streak || !streak) return null;
  const outcome = streakOutcome(item, planner.zone, planner.now);
  const due = new Intl.DateTimeFormat(locale(), {
    timeZone: planner.zone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(boundaries(item.schedule, planner.zone).due);
  const endedOn = streak.missedDate
    ? formatCivilDate(
        streak.missedDate,
        {
          month: "short",
          day: "numeric",
        },
        locale(),
      )
    : null;
  return (
    <View style={[styles.panel, streak.ended && styles.ended]}>
      <View
        style={styles.top}
        accessible
        accessibilityLabel={t("Current streak: {v0}", {
          v0: streakText(streak),
        })}
      >
        <Flame size={22} color={streak.ended ? colors.muted : colors.text} />
        <Text style={s.label}>{streakText(streak)}</Text>
        <Text style={s.muted}>
          {streak.ended ? t("Fresh start ahead") : t("Current streak")}
        </Text>
      </View>
      <View style={styles.marks}>
        {streak.recent.map((mark) => (
          <View
            key={mark.id}
            accessible
            accessibilityLabel={`${mark.date}: ${mark.outcome === "completed" ? t("completed before deadline") : mark.outcome === "missed" ? t("missed deadline") : t("still to do")}`}
            style={[
              styles.mark,
              mark.outcome === "completed" && styles.completed,
              mark.outcome === "missed" && styles.missed,
            ]}
          >
            {mark.outcome === "completed" ? (
              <Check size={14} color={colors.text} />
            ) : mark.outcome === "missed" ? (
              <X size={14} color={surfaces.danger} />
            ) : (
              <Text style={s.muted}>·</Text>
            )}
          </View>
        ))}
        {Array.from({ length: 7 - streak.recent.length }, (_, index) => (
          <View key={index} style={[styles.mark, styles.empty]} />
        ))}
      </View>
      <Text style={s.muted}>
        {outcome === "missed"
          ? t(
              "Deadline missed \u2014 the next on-time completion starts a new streak.",
            )
          : outcome === "completed"
            ? t("Completed before the deadline. Keep it going!")
            : t("{v0}Complete before {v1}.", {
                v0:
                  streak.ended && endedOn
                    ? t("Ended {v0}. ", { v0: endedOn })
                    : "",
                v1: due,
              })}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: surfaces.orange,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  ended: { backgroundColor: surfaces.neutral },
  top: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  marks: { flexDirection: "row", gap: 6 },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: surfaces.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  completed: { backgroundColor: colors.lime, borderColor: colors.text },
  missed: { backgroundColor: colors.orange, borderColor: surfaces.danger },
  empty: { opacity: 0.25 },
});
