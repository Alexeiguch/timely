import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { civilDate, type Occurrence, type HistoryCursor } from "@timely/contracts";
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
  const [priority, setPriority] = useState("all");
  const [definitionId, setDefinitionId] = useState<string | undefined>();
  const [remote, setRemote] = useState<Occurrence[] | null>(null);
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyKey = JSON.stringify([from, through, query, filter, priority, definitionId, p.zone]);
  const currentHistoryKey = useRef(historyKey);
  currentHistoryKey.current = historyKey;
  useEffect(() => { setRemote(null); setCursor(null); setHistoryError(""); }, [from, through, query, filter, priority, definitionId]);
  async function historical() {
    const requestedKey = historyKey;
    setLoading(true); setHistoryError("");
    try {
      const page = await p.history({ from, through, zone: p.zone, state: filter as "all", priority: priority as "all", query, definitionId, limit: 100, ...(cursor ? { cursor } : {}) });
      if (requestedKey !== currentHistoryKey.current) return;
      setRemote((items) => [...(items ?? []), ...page.items]); setCursor(page.next);
    } catch (error) { if (requestedKey === currentHistoryKey.current) setHistoryError(error instanceof Error ? error.message : "History unavailable. Downloaded plans remain available."); }
    finally { setLoading(false); }
  }
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
  const items = (remote ?? all).map((item) => all.find((current) => current.id === item.id) ?? item).filter(
    (item) =>
      (!query.trim() ||
        `${item.title} ${item.notes}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())) &&
      (priority === "all" || (priority === "none" ? item.priority === null : item.priority === priority)) &&
      (!definitionId || item.definitionId === definitionId) &&
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
                <Choices label="Priority filter" value={priority} options={["all", "none", "low", "medium", "high"].map((value) => ({ value, label: value }))} onChange={setPriority} />
                <Choices label="Series filter" value={definitionId ?? "all"} options={[
                  { value: "all", label: "All plans" }, ...p.records.filter((record) => reduceRecord(record).revisions.some((revision) => revision.task.rule)).map((record) => ({ value: record.id, label: reduceRecord(record).revisions.at(-1)!.task.title })),
                ]} onChange={(value) => setDefinitionId(value === "all" ? undefined : value)} />
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
        ListFooterComponent={<View style={s.field}>
          <Text style={s.muted}>{remote ? "Online historical snapshot for this range" : "Downloaded plans are available offline. Online history checks a fixed server snapshot."}</Text>
          {historyError && <Text accessibilityRole="alert" style={s.error}>{historyError}</Text>}
          <Button title={remote && cursor ? "Load more history" : "Load online history"} disabled={!!error || loading || (remote !== null && cursor === null)} onPress={() => { void historical(); }} />
          {remote !== null && !cursor && <Button title="Return to downloaded plans" onPress={() => setRemote(null)} />}
        </View>}
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
