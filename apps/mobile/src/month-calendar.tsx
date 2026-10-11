import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, surfaces } from "@timely/design";
import { calendarDays, date, formatCivilDate } from "@timely/domain";
import { locale, t } from "@timely/i18n";
import type { Occurrence } from "@timely/contracts";
import { useLanguage } from "./language-state";
import { s } from "./ui";

export function MonthCalendar({
  selected,
  today,
  firstWeekday,
  items,
  onSelect,
  onNavigate,
}: {
  selected: string;
  today: string;
  firstWeekday: number;
  items: Occurrence[];
  onSelect: (day: string) => void;
  onNavigate: (direction: number) => void;
}) {
  useLanguage();
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(item.schedule.date, (counts.get(item.schedule.date) ?? 0) + 1);
  const days = calendarDays(selected, firstWeekday);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      gesture.numberActiveTouches === 1 &&
      Math.abs(gesture.dx) > 24 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
    onPanResponderRelease: (_, gesture) => {
      if (
        Math.abs(gesture.dx) > 60 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2
      )
        onNavigate(gesture.dx < 0 ? 1 : -1);
    },
  });
  return (
    <View style={styles.card}>
      <View style={styles.grid} {...swipe.panHandlers}>
        <View style={styles.row}>
          {Array.from(
            { length: 7 },
            (_, index) =>
              ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                (firstWeekday - 1 + index) % 7
              ]!,
          ).map((day) => (
            <Text key={day} style={[s.muted, styles.weekday]}>
              {t(day).slice(0, 1)}
            </Text>
          ))}
        </View>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.row}>
            {week.map((day, index) => {
              if (!day)
                return <View key={`blank-${index}`} style={styles.cell} />;
              const count = counts.get(day) ?? 0;
              const isSelected = day === selected;
              return (
                <View key={day} style={styles.cell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t("{v0}, {v1} tasks", {
                      v0: formatCivilDate(
                        day,
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                        locale(),
                      ),
                      v1: count,
                    })}
                    style={({ pressed }) => [
                      styles.day,
                      count > 0 && styles.planned,
                      day === today && styles.today,
                      isSelected && styles.selected,
                      pressed && s.pressed,
                    ]}
                    onPress={() => onSelect(day)}
                  >
                    <Text
                      style={[
                        s.body,
                        count > 0 && styles.number,
                        isSelected && s.activeText,
                      ]}
                    >
                      {date(day).day}
                    </Text>
                    <View
                      style={[
                        styles.marker,
                        count > 0 && styles.badge,
                        isSelected && count > 0 && styles.selectedBadge,
                      ]}
                    >
                      {count > 0 && <Text style={styles.count}>{count}</Text>}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={s.muted}>
        {t("Highlighted dates have tasks. Swipe to change month.")}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { paddingVertical: 8, gap: 12 },
  grid: { gap: 0 },
  row: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 8 },
  cell: { flex: 1, minWidth: 0, padding: 2, minHeight: 64 },
  day: {
    flex: 1,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planned: { backgroundColor: surfaces.blue },
  today: { borderColor: colors.primary },
  selected: { backgroundColor: colors.primary },
  number: { fontFamily: "NunitoSansBold" },
  marker: {
    minWidth: 20,
    minHeight: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badge: { backgroundColor: colors.lime },
  selectedBadge: { backgroundColor: colors.lime },
  count: { fontFamily: "NunitoSansBold", fontSize: 12, color: colors.text },
});
