import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { civilDate, type Occurrence } from "@timely/contracts";
import {
  compareOccurrences,
  formatCivilDate,
  date,
  periodWindow,
  progress,
  projectSeries,
  status,
} from "@timely/domain";
import { reduceRecord } from "@timely/sync";
import { usePlanner } from "./planner-provider";
import { PlannerStatus } from "./planner-header";
import { TaskCard } from "./task-card";
import { Button, Choices, Field, s } from "./ui";
import { DateField } from "./date-field";
function History({ search }: { search: boolean }) {
  const p = usePlanner();
  const initial = periodWindow(p.currentDay, "Month");
  const [from, setFrom] = useState(initial.from);
  const [through, setThrough] = useState(initial.through);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const error =
    !civilDate.safeParse(from).success ||
    !civilDate.safeParse(through).success ||
    from > through
      ? "Choose a valid date range."
      : date(from).until(date(through)).days >= 366
        ? "Choose up to 366 days at a time."
        : "";
  const all = useMemo(
    () =>
      error
        ? []
        : p.records
            .flatMap((record) =>
              projectSeries(reduceRecord(record), from, through),
            )
            .sort(compareOccurrences),
    [p.records, from, through, error],
  );
  const items = all.filter(
    (item) =>
      (!query.trim() ||
        `${item.title} ${item.notes}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())) &&
      (filter === "all" ||
        (filter === "overdue"
          ? status(item, p.zone, p.now) === "overdue"
          : item.state === filter)),
  );
  const scheduled = progress(all, p.zone, p.now);
  const elapsed = progress(all, p.zone, p.now, true);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <FlatList<Occurrence>
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={
          <View style={s.field}>
            <Text style={s.heading} accessibilityRole="header">
              {search ? "Find a plan" : "Your little wins"}
            </Text>
            <Text style={s.muted}>
              {search
                ? "Find the things that matter to you."
                : "A moment to see how far you’ve come."}
            </Text>
            <PlannerStatus compact />
            {search && (
              <Field
                label="Search titles and notes"
                value={query}
                onChangeText={setQuery}
                placeholder="What are you looking for?"
              />
            )}
            <Button
              title={
                filtersOpen
                  ? "Hide filters"
                  : `Date & status filters · ${filter}`
              }
              variant="ghost"
              onPress={() => setFiltersOpen(!filtersOpen)}
            />
            <Text style={s.muted}>
              Downloaded plans ·{" "}
              {formatCivilDate(from, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              –{" "}
              {formatCivilDate(through, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
            {filtersOpen && (
              <>
                <DateField label="From date" value={from} onChange={setFrom} />
                <DateField
                  label="Through date"
                  value={through}
                  onChange={setThrough}
                />
                <Text style={s.muted}>
                  Searching downloaded plans in this date range, up to 366 days.
                  Moved tasks use their current date; cards retain the original
                  date.
                </Text>
                <Choices
                  label="Task status"
                  value={filter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "overdue", label: "Overdue" },
                    { value: "completed", label: "Completed" },
                    { value: "skipped", label: "Skipped" },
                  ]}
                  onChange={setFilter}
                />
              </>
            )}
            {!!error && (
              <Text style={[s.body, s.error]} accessibilityRole="alert">
                {error}
              </Text>
            )}
            {!search && (
              <View style={s.notice}>
                <Text style={s.section}>
                  {scheduled.completed} / {scheduled.total} scheduled
                </Text>
                <Text style={s.body}>
                  Completion rate:{" "}
                  {elapsed.ratio === null
                    ? "No elapsed tasks yet"
                    : `${Math.round(elapsed.ratio * 100)}% (${elapsed.completed}/${elapsed.total} elapsed)`}
                </Text>
                <Text style={[s.muted, s.onAccent]}>
                  Skipped tasks are excluded from both totals. Upcoming tasks
                  are excluded from completion rate.
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={s.body}>
            {error
              ? "Adjust the dates to see your plans."
              : "No matching plans in this period."}
          </Text>
        }
        renderItem={({ item }) => <TaskCard item={item} showDate />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}
export function Review() {
  return <History search={false} />;
}
export function Search() {
  return <History search />;
}
