import { StyleSheet, Text, View } from "react-native";
import { Check, Flame, X } from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import type { Occurrence } from "@timely/contracts";
import {
  boundaries,
  date,
  streakKey,
  streakLabel,
  streakOutcome,
} from "@timely/domain";
import { usePlanner } from "./planner-provider";
import { s } from "./ui";

export function StreakIndicator({ item }: { item: Occurrence }) {
  const planner = usePlanner();
  const streak = planner.streaks.get(streakKey(item));
  if (!item.streak || !streak) return null;
  const outcome = streakOutcome(item, planner.zone, planner.now);
  const due = new Intl.DateTimeFormat("en-GB", {
    timeZone: planner.zone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(boundaries(item.schedule, planner.zone).due);
  const endedOn = streak.missedDate
    ? date(streak.missedDate).toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <View style={[styles.panel, streak.ended && styles.ended]}>
      <View
        style={styles.top}
        accessible
        accessibilityLabel={`Current streak: ${streakLabel(streak)}`}
      >
        <Flame size={22} color={streak.ended ? colors.muted : colors.text} />
        <Text style={s.label}>{streakLabel(streak)}</Text>
        <Text style={s.muted}>
          {streak.ended ? "Fresh start ahead" : "Current streak"}
        </Text>
      </View>
      <View style={styles.marks}>
        {streak.recent.map((mark) => (
          <View
            key={mark.id}
            accessible
            accessibilityLabel={`${mark.date}: ${mark.outcome === "completed" ? "completed before deadline" : mark.outcome === "missed" ? "missed deadline" : "still to do"}`}
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
          ? "Deadline missed — the next on-time completion starts a new streak."
          : outcome === "completed"
            ? "Completed before the deadline. Keep it going!"
            : `${streak.ended && endedOn ? `Ended ${endedOn}. ` : ""}Complete before ${due}.`}
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
