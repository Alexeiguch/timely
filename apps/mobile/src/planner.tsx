import { t, locale, errorMessage } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowDown,
  ArrowUp,
} from "lucide-react-native";
import { colors, surfaces, radius } from "@timely/design";
import { civilDate, type Occurrence } from "@timely/contracts";
import {
  addDays,
  adjacentPeriod,
  calendarDays,
  formatCivilDate,
  clampDay,
  compareOccurrences,
  date,
  periodWindow,
  progress,
  projectSeries,
  status,
  type PlannerMode,
} from "@timely/domain";
import { linkedOccurrence, reduceRecord } from "@timely/sync";
import { useAccount } from "./account";
import { usePlanner } from "./planner-provider";
import { PlannerStatus } from "./planner-header";
import { Brand } from "./brand";
import { StreakIndicator } from "./streak-indicator";
import { TaskCard } from "./task-card";
import { DateField } from "./date-field";
import { PlannerDoodle } from "./doodle";
import { Button, Choices, Segmented, IconButton, Sheet, s } from "./ui";
type Row =
  | {
      kind: "task";
      item: Occurrence;
    }
  | {
      kind: "group";
      items: Occurrence[];
      id: string;
    };
export function NativePlanner() {
  const language = useLanguage();
  const p = usePlanner();
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const [addButtonHeight, setAddButtonHeight] = useState(56);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [weekDayOnly, setWeekDayOnly] = useState(false);
  const [focused, setFocused] = useState<Occurrence | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams<{
    day?: string;
    occurrenceId?: string;
    ownerId?: string;
  }>();
  const processedLink = useRef("");
  const window = periodWindow(p.selected, p.mode, p.preferences.firstWeekday);
  const series = useMemo(() => p.records.map(reduceRecord), [p.records]);
  const all = useMemo(
    () =>
      series
        .flatMap((record) => projectSeries(record, window.from, window.through))
        .sort(compareOccurrences),
    [series, window.from, window.through],
  );
  const overdue = useMemo(
    () =>
      p.mode === "Day" && p.selected === p.currentDay
        ? series
            .flatMap((record) =>
              projectSeries(
                record,
                clampDay(addDays(p.currentDay, -365)),
                p.currentDay,
              ),
            )
            .filter(
              (item) =>
                item.schedule.date < p.currentDay &&
                status(item, p.zone, p.now) === "overdue",
            )
            .sort(compareOccurrences)
        : [],
    [series, p.mode, p.selected, p.currentDay, p.zone, p.now],
  );
  const totals = progress(all, p.zone, p.now);
  const visible =
    p.mode === "Week" && weekDayOnly
      ? all.filter((item) => item.schedule.date === p.selected)
      : all;
  const pending = visible.filter((item) => item.state === "pending");
  const terminal = visible.filter((item) => item.state !== "pending");
  const rows = (items: Occurrence[]): Row[] =>
    items.map((item) => ({ kind: "task", item }));
  const sections: Array<{
    title: string;
    kind?: "terminal" | "overdue";
    data: Row[];
  }> = [];
  if (overdue.length)
    sections.push({
      title: t("Overdue ({v0})", { v0: overdue.length }),
      kind: "overdue",
      data: overdueOpen ? rows(overdue) : [],
    });
  if (p.mode === "Month" && p.grouped) {
    const groups = new Map<string, Occurrence[]>();
    const singles: Occurrence[] = [];
    for (const item of all) {
      const record = series.find((record) => record.id === item.definitionId);
      const repeating = record?.revisions.find(
        (revision) => revision.id === item.revisionId,
      )?.task.rule;
      if (repeating)
        groups.set(item.definitionId, [
          ...(groups.get(item.definitionId) ?? []),
          item,
        ]);
      else singles.push(item);
    }
    sections.push({
      title: t("Recurring plans"),
      data: [...groups.entries()].map(([id, items]) => ({
        kind: "group",
        id,
        items,
      })),
    });
    if (singles.length)
      sections.push({ title: t("One-off plans"), data: rows(singles) });
  } else {
    const days = [...new Set(pending.map((item) => item.schedule.date))];
    for (const day of days)
      sections.push({
        title:
          p.mode === "Day"
            ? t("Your plans")
            : formatCivilDate(
                day,
                {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                },
                locale(),
              ),
        data: rows(pending.filter((item) => item.schedule.date === day)),
      });
    if (terminal.length)
      sections.push({
        title: t("Completed & skipped ({v0})", { v0: terminal.length }),
        kind: "terminal",
        data: terminalOpen ? rows(terminal) : [],
      });
  }
  const navigate = (direction: number) => {
    p.setSelected(adjacentPeriod(p.selected, p.mode, direction));
    setWeekDayOnly(false);
  };
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 60 && Math.abs(g.dx) > Math.abs(g.dy) * 2)
        navigate(g.dx < 0 ? 1 : -1);
    },
  });
  useEffect(() => {
    if (!params.day && !params.occurrenceId) return;
    const key = JSON.stringify(params);
    if (processedLink.current === key || !p.state) return;
    if (
      typeof params.day !== "string" ||
      !civilDate.safeParse(params.day).success
    ) {
      processedLink.current = key;
      setLinkMessage("This link has an invalid date.");
      return;
    }
    if (params.occurrenceId) {
      if (
        typeof params.occurrenceId !== "string" ||
        typeof params.ownerId !== "string" ||
        params.ownerId !== account.identity?.id
      ) {
        processedLink.current = key;
        setLinkMessage(
          "This task link is not available for the signed-in account.",
        );
        return;
      }
      const item = linkedOccurrence(
        p.records,
        {
          day: params.day,
          occurrenceId: params.occurrenceId,
          ownerId: params.ownerId,
        },
        account.identity.id,
      );
      if (!item && !p.state.bootstrapped) {
        setLinkMessage(
          "Connect to finish downloading this account before opening the task.",
        );
        return;
      }
      if (!item) {
        processedLink.current = key;
        setLinkMessage(
          "This task is deleted, unavailable, or outside the downloaded data.",
        );
        return;
      }
      setFocused(item);
      p.setSelected(item.schedule.date);
    } else p.setSelected(params.day);
    p.setMode("Day");
    processedLink.current = key;
    setLinkMessage("");
  }, [
    params.day,
    params.occurrenceId,
    params.ownerId,
    p.state,
    p.records,
    account.identity?.id,
  ]);
  // Resolve a linked/selected card against current records after each edit; never retain a deleted snapshot.
  const focus =
    focused && account.identity
      ? linkedOccurrence(
          p.records,
          {
            day: focused.schedule.date,
            occurrenceId: focused.id,
            ownerId: account.identity.id,
          },
          account.identity.id,
        )
      : null;
  const group = (items: Occurrence[]) => {
    const total = progress(items, p.zone, p.now);
    const streakItem =
      items.find(
        (item) =>
          item.streak &&
          item.state === "pending" &&
          item.schedule.date >= p.currentDay,
      ) ?? items.at(-1)!;
    return (
      <View style={s.card}>
        <Text style={s.title}>{items[0]!.title}</Text>
        <Text style={s.body}>
          {t("{v0} / {v1} scheduled, excluding skipped", {
            v0: total.completed,
            v1: total.total,
          })}
        </Text>
        <StreakIndicator item={streakItem} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={s.row}
        >
          {items.map((item) => (
            <Button
              key={item.id}
              title={`${date(item.schedule.date).day}\n${item.state === "completed" ? "✓" : item.state === "skipped" ? "−" : status(item, p.zone, p.now) === "overdue" ? "!" : "○"}`}
              label={`${item.schedule.date}: ${item.title}, ${t(status(item, p.zone, p.now))}`}
              onPress={() => setFocused(item)}
            />
          ))}
        </ScrollView>
        <Text style={s.muted}>
          {t(
            "\u2713 Completed \u00B7 \u2212 Skipped \u00B7 ! Overdue \u00B7 \u25CB Planned",
          )}
        </Text>
      </View>
    );
  };
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <SectionList<Row>
        sections={sections}
        keyExtractor={(row) => (row.kind === "task" ? row.item.id : row.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: addButtonHeight + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void p.sync().finally(() => setRefreshing(false));
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={s.row}>
              <View style={s.grow}>
                <Brand />
              </View>
            </View>
            <View>
              <Text style={s.heading} accessibilityRole="header">
                {t("Your day, your pace.")}
              </Text>
              <Text style={s.muted}>
                {t("A little space for what matters.")}
              </Text>
            </View>
            {!!linkMessage && (
              <Text style={[s.body, s.error]} accessibilityRole="alert">
                {errorMessage(linkMessage)}
              </Text>
            )}
            <Segmented
              label={t("Planner view")}
              value={p.mode}
              options={["Day", "Week", "Month"] as PlannerMode[]}
              onChange={(value) => {
                p.setMode(value);
                setWeekDayOnly(false);
              }}
            />
            <View {...swipe.panHandlers} style={styles.period}>
              <View style={styles.dateRow}>
                <IconButton
                  label={t("Previous period")}
                  onPress={() => navigate(-1)}
                >
                  <ChevronLeft size={22} color={colors.text} />
                </IconButton>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Choose date")}
                  onPress={() => setPicker(!picker)}
                  style={({ pressed }) => [
                    styles.dateTitle,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.title}>
                    {p.mode === "Day"
                      ? formatCivilDate(
                          p.selected,
                          {
                            month: "long",
                            day: "numeric",
                          },
                          locale(),
                        )
                      : p.mode === "Week"
                        ? `${formatCivilDate(window.from, { day: "numeric", month: "short" }, locale())} – ${formatCivilDate(window.through, { day: "numeric", month: "short" }, locale())}`
                        : formatCivilDate(
                            p.selected,
                            {
                              month: "long",
                              year: "numeric",
                            },
                            locale(),
                          )}
                  </Text>
                  <View style={s.row}>
                    <CalendarDays size={14} color={colors.muted} />
                    <Text style={s.muted}>
                      {p.mode === "Day"
                        ? formatCivilDate(
                            p.selected,
                            { weekday: "long" },
                            locale(),
                          )
                        : t("Choose date")}
                    </Text>
                  </View>
                </Pressable>
                <IconButton
                  label={t("Next period")}
                  onPress={() => navigate(1)}
                >
                  <ChevronRight size={22} color={colors.text} />
                </IconButton>
              </View>
              <View style={styles.statusRow}>
                <View style={s.grow}>
                  <PlannerStatus compact />
                </View>
                <Button
                  title={t("Today")}
                  variant="ghost"
                  onPress={() => {
                    p.setSelected(p.currentDay);
                    setWeekDayOnly(false);
                  }}
                />
              </View>
            </View>
            {picker && (
              <DateField
                label={t("Focused date")}
                value={p.selected}
                onChange={p.setSelected}
              />
            )}
            {p.mode === "Week" && (
              <>
                <ScrollView horizontal contentContainerStyle={s.row}>
                  {Array.from(
                    {
                      length:
                        date(window.from).until(date(window.through)).days + 1,
                    },
                    (_, i) => addDays(window.from, i),
                  ).map((day) => (
                    <Button
                      key={day}
                      title={formatCivilDate(
                        day,
                        {
                          weekday: "short",
                          day: "numeric",
                        },
                        locale(),
                      )}
                      active={day === p.selected}
                      onPress={() => {
                        p.setSelected(day);
                        setWeekDayOnly(true);
                      }}
                    />
                  ))}
                </ScrollView>
                {weekDayOnly && (
                  <Button
                    title={t("Show the whole week")}
                    onPress={() => setWeekDayOnly(false)}
                  />
                )}
              </>
            )}
            {p.mode === "Month" && (
              <>
                <ScrollView horizontal>
                  <View style={styles.calendar}>
                    <View style={styles.calendarGrid}>
                      {Array.from(
                        { length: 7 },
                        (_, i) =>
                          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                            (p.preferences.firstWeekday - 1 + i) % 7
                          ],
                      ).map((d, i) => (
                        <Text key={i} style={[s.muted, styles.weekday]}>
                          {t(d!).slice(0, 1)}
                        </Text>
                      ))}
                      {calendarDays(p.selected, p.preferences.firstWeekday).map(
                        (day, i) =>
                          day ? (
                            <Pressable
                              key={day}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: day === p.selected,
                              }}
                              accessibilityLabel={t("{v0}, {v1} tasks", {
                                v0: day,
                                v1: all.filter(
                                  (item) => item.schedule.date === day,
                                ).length,
                              })}
                              style={[
                                styles.day,
                                day === p.selected && styles.selectedDay,
                              ]}
                              onPress={() => {
                                p.setSelected(day);
                                p.setMode("Day");
                              }}
                            >
                              <Text
                                style={[
                                  s.body,
                                  day === p.selected && s.activeText,
                                ]}
                              >
                                {date(day).day}
                              </Text>
                              <Text
                                style={[
                                  styles.dot,
                                  day === p.selected && s.activeText,
                                ]}
                              >
                                {all.some((item) => item.schedule.date === day)
                                  ? "•"
                                  : " "}
                              </Text>
                            </Pressable>
                          ) : (
                            <View key={`blank-${i}`} style={styles.day} />
                          ),
                      )}
                    </View>
                  </View>
                </ScrollView>
                <Choices
                  label={t("Month details")}
                  value={p.grouped ? "grouped" : "all"}
                  options={[
                    { value: "grouped", label: t("Grouped") },
                    { value: "all", label: t("All occurrences") },
                  ]}
                  onChange={(value) => p.setGrouped(value === "grouped")}
                />
              </>
            )}
            {!!all.length && (
              <View
                style={styles.progressCard}
                accessibilityLabel={t(
                  "{v0} of {v1} scheduled tasks complete, skipped excluded",
                  { v0: totals.completed, v1: totals.total },
                )}
              >
                <View style={s.grow}>
                  <Text style={s.title}>{t("A little progress")}</Text>
                  <Text style={[s.muted, s.onAccent]}>
                    {t("One plan at a time.")}
                  </Text>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${totals.total ? (totals.completed / totals.total) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.progressNumber}>
                  {totals.completed}
                  <Text style={s.body}> / {totals.total}</Text>
                </Text>
              </View>
            )}
            {!all.length && p.state && (
              <View style={styles.empty}>
                <PlannerDoodle />
                <Text style={s.section}>{t("A little breathing room.")}</Text>
                <Text style={[s.body, styles.emptyCopy]}>
                  {t(
                    "A fresh page for your plans. Start with one small thing.",
                  )}
                </Text>
                <Button
                  title={t("Make a plan")}
                  variant="ghost"
                  onPress={() => p.add()}
                >
                  <Plus size={18} color={colors.primary} />
                </Button>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.kind === "terminal" ? (
            <Button
              title={`${terminalOpen ? t("Hide") : t("Show")} ${section.title.toLocaleLowerCase(locale())}`}
              onPress={() => setTerminalOpen(!terminalOpen)}
            />
          ) : section.kind === "overdue" ? (
            <View style={styles.overdueHeader}>
              <Button
                title={section.title}
                variant="ghost"
                onPress={() => setOverdueOpen(!overdueOpen)}
              >
                {overdueOpen ? (
                  <ArrowUp size={16} color={colors.primary} />
                ) : (
                  <ArrowDown size={16} color={colors.primary} />
                )}
              </Button>
              {overdueOpen && (
                <Text style={s.muted}>{t("From the previous 365 days")}</Text>
              )}
            </View>
          ) : section.data.length ? (
            <Text
              style={[s.section, styles.sectionHeading]}
              accessibilityRole="header"
            >
              {section.title}
            </Text>
          ) : null
        }
        renderItem={({ item: row }) =>
          row.kind === "task" ? (
            <TaskCard
              item={row.item}
              showDate={
                p.mode !== "Day" || row.item.schedule.date !== p.selected
              }
            />
          ) : (
            group(row.items)
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews={false}
      />
      <View
        pointerEvents="box-none"
        onLayout={(event) =>
          setAddButtonHeight(event.nativeEvent.layout.height)
        }
        style={[
          styles.floatingAction,
          { left: insets.left + 20, right: insets.right + 20 },
        ]}
      >
        <Button
          title={t("Add task")}
          variant="primary"
          onPress={() => p.add()}
          style={styles.floatingButton}
        >
          <Plus size={22} color={colors.surface} accessible={false} />
        </Button>
      </View>
      {focused && (
        <Sheet
          title={t("Selected occurrence")}
          onClose={() => setFocused(null)}
        >
          {focus ? (
            <TaskCard item={focus} showDate />
          ) : (
            <Text style={s.body}>
              {t(
                "This occurrence has been deleted or changed. Your other plans are safe.",
              )}
            </Text>
          )}
        </Sheet>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 12 },
  floatingAction: { position: "absolute", bottom: 16, alignItems: "flex-end" },
  floatingButton: {
    minHeight: 56,
    maxWidth: "100%",
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  header: { gap: 20 },
  period: { gap: 4 },
  dateRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  dateTitle: { flex: 1, alignItems: "center", gap: 4, minHeight: 48 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressCard: {
    backgroundColor: colors.lime,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
  },
  progressNumber: { fontFamily: "Baloo2", fontSize: 36, color: colors.text },
  track: {
    height: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginTop: 12,
    overflow: "hidden",
  },
  fill: { height: 4, borderRadius: 12, backgroundColor: colors.primary },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyCopy: { textAlign: "center", color: colors.muted },
  sectionHeading: { paddingTop: 24, paddingBottom: 12 },
  overdueHeader: {
    backgroundColor: surfaces.orange,
    borderRadius: 18,
    padding: 8,
    marginTop: 16,
    gap: 4,
  },
  separator: { height: 12 },
  calendar: { width: 308, paddingVertical: 8 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: 44, textAlign: "center", paddingVertical: 8 },
  day: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  selectedDay: { backgroundColor: colors.primary },
  dot: { color: colors.primary, fontSize: 12, lineHeight: 12 },
});
