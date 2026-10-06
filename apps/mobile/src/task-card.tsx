import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, MoreHorizontal, Repeat2 } from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import type { Occurrence } from "@timely/contracts";
import { status, type Scope } from "@timely/domain";
import { reduceRecord } from "@timely/sync";
import { usePlanner } from "./planner-provider";
import { Button, Sheet, s } from "./ui";
import { StreakIndicator } from "./streak-indicator";
import { DateField } from "./date-field";
export function TaskCard({
  item,
  showDate = false,
}: {
  item: Occurrence;
  showDate?: boolean;
}) {
  const planner = usePlanner();
  const [menu, setMenu] = useState(false);
  const [moveDate, setMoveDate] = useState(item.schedule.date);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const derived = status(item, planner.zone, planner.now);
  const record = planner.records.find((r) => r.id === item.definitionId);
  const recurring =
    !!record &&
    !!reduceRecord(record).revisions.find((r) => r.id === item.revisionId)?.task
      .rule;
  const remove = (scope: Scope) =>
    Alert.alert(
      scope === "series"
        ? "Delete the entire series?"
        : scope === "future"
          ? "Delete this and all future occurrences?"
          : "Delete this occurrence?",
      scope === "series"
        ? "This removes all its planner history. You can undo immediately after deleting."
        : scope === "future"
          ? "Earlier occurrences remain. You can undo immediately after deleting."
          : "Other recurring dates stay unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            planner.act(async () => {
              await planner.remove(item, scope);
              setMenu(false);
            }),
        },
      ],
    );
  return (
    <View
      style={[s.card, styles.card, derived === "overdue" && styles.overdue]}
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.state === "completed" }}
          accessibilityLabel={`${item.state === "completed" ? "Reopen" : "Complete"} ${item.title}`}
          onPress={() =>
            planner.act(() =>
              planner.changeState(
                item,
                item.state === "completed" ? "pending" : "completed",
              ),
            )
          }
          style={styles.complete}
        >
          <View
            style={[
              styles.circle,
              item.state === "completed" && styles.checked,
            ]}
          >
            {item.state === "completed" && (
              <Check size={20} color={colors.text} />
            )}
          </View>
        </Pressable>
        <View style={s.grow}>
          <Text style={s.muted}>
            {showDate ? `${item.schedule.date} · ` : ""}
            {item.schedule.time ?? "Any time"}
            {item.schedule.duration ? ` · ${item.schedule.duration} min` : ""}
          </Text>
          <Text
            style={[
              s.title,
              item.state === "completed" && styles.completedTitle,
            ]}
          >
            {item.title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${item.title}`}
          style={styles.menu}
          onPress={() => {
            setMoveDate(item.schedule.date);
            setMoving(false);
            setDeleting(false);
            setMenu(true);
          }}
        >
          <MoreHorizontal size={24} color={colors.text} />
        </Pressable>
      </View>
      <View style={s.row}>
        {recurring && <Repeat2 size={18} color={colors.muted} />}
        {item.priority && (
          <Text style={[s.label, styles.priority]}>
            {item.priority[0]!.toUpperCase() + item.priority.slice(1)} priority
          </Text>
        )}
        {derived !== "upcoming" && (
          <Text style={[s.label, derived === "overdue" && styles.overdueLabel]}>
            {derived === "overdue"
              ? "Overdue"
              : derived === "completed"
                ? "Completed"
                : derived === "skipped"
                  ? "Skipped"
                  : "In progress"}
          </Text>
        )}
      </View>
      <StreakIndicator item={item} />
      {!!item.notes && (
        <Text style={s.body} numberOfLines={3}>
          {item.notes}
        </Text>
      )}
      {item.schedule.date !== item.originalDate && (
        <Text style={s.muted}>Originally {item.originalDate}</Text>
      )}
      {menu && (
        <Sheet title={item.title} onClose={() => setMenu(false)}>
          <Text style={s.body}>
            {item.schedule.date} · {item.schedule.time ?? "Any time"} ·{" "}
            {derived}
          </Text>
          {!!item.notes && <Text style={s.body}>{item.notes}</Text>}
          {item.terminal && (
            <Text style={s.muted}>
              {item.terminal.state}{" "}
              {new Date(item.terminal.at).toLocaleString()} ·{" "}
              {item.terminal.zone}
            </Text>
          )}
          <Button
            title="Edit task"
            onPress={() => {
              setMenu(false);
              planner.edit(item);
            }}
          />
          {(!item.streak || item.state === "skipped") && (
            <Button
              title={
                item.state === "skipped" ? "Unskip" : "Skip this occurrence"
              }
              onPress={() =>
                planner.act(async () => {
                  await planner.changeState(
                    item,
                    item.state === "skipped" ? "pending" : "skipped",
                  );
                  setMenu(false);
                })
              }
            />
          )}
          <Button
            title="Move to today"
            onPress={() => {
              setMoving(true);
              setMoveDate(planner.currentDay);
            }}
          />
          <Button
            title="Move to another date"
            onPress={() => setMoving(!moving)}
          />
          {moving && (
            <View style={s.card}>
              <DateField
                label="Move to date"
                value={moveDate}
                onChange={setMoveDate}
              />
              <Text style={s.body}>
                Keeps the original date, time, duration and recurrence cadence.
              </Text>
              {status(
                { ...item, schedule: { ...item.schedule, date: moveDate } },
                planner.zone,
                planner.now,
              ) === "overdue" && (
                <Text style={[s.body, s.error]}>
                  This schedule is already overdue. You can adjust its time in
                  Edit task.
                </Text>
              )}
              <Button
                title="Confirm move"
                active
                onPress={() =>
                  planner.act(async () => {
                    await planner.move(item, moveDate);
                    setMenu(false);
                  })
                }
              />
            </View>
          )}
          {item.schedule.time === null && item.state === "pending" && (
            <View style={s.card}>
              <Text style={s.label}>Untimed task order</Text>
              <Button
                title="Move up in this day"
                onPress={() => planner.act(() => planner.reorder(item, -1))}
              />
              <Button
                title="Move down in this day"
                onPress={() => planner.act(() => planner.reorder(item, 1))}
              />
              <Text style={s.muted}>
                Changes order only. The date and recurrence stay the same.
              </Text>
            </View>
          )}
          <Button
            title="Delete…"
            variant="destructive"
            onPress={() =>
              recurring ? setDeleting(!deleting) : remove("occurrence")
            }
          />
          {deleting && (
            <View style={s.card}>
              <Text style={s.section}>Delete which occurrences?</Text>
              <Button
                title="Only this occurrence"
                onPress={() => remove("occurrence")}
              />
              <Button
                title="This and future occurrences"
                onPress={() => remove("future")}
              />
              <Button
                title="Entire series, including history"
                onPress={() => remove("series")}
              />
            </View>
          )}
        </Sheet>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: surfaces.border, gap: 8 },
  priority: {
    backgroundColor: surfaces.neutral,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overdueLabel: {
    backgroundColor: colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedTitle: { color: colors.muted, textDecorationLine: "line-through" },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  complete: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  circle: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: colors.muted,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.lime, borderColor: colors.lime },
  menu: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  overdue: { borderColor: colors.orange, borderLeftWidth: 4 },
});
