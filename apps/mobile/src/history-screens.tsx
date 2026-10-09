import { t, locale, errorMessage } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  civilDate,
  type Occurrence,
  type HistoryCursor,
} from "@timely/contracts";
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
  useLanguage();
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
  const historyKey = JSON.stringify([
    from,
    through,
    query,
    filter,
    priority,
    definitionId,
    p.zone,
  ]);
  const currentHistoryKey = useRef(historyKey);
  currentHistoryKey.current = historyKey;
  useEffect(() => {
    setRemote(null);
    setCursor(null);
    setHistoryError("");
  }, [from, through, query, filter, priority, definitionId]);
  async function historical() {
    const requestedKey = historyKey;
    setLoading(true);
    setHistoryError("");
    try {
      const page = await p.history({
        from,
        through,
        zone: p.zone,
        state: filter as "all",
        priority: priority as "all",
        query,
        definitionId,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      if (requestedKey !== currentHistoryKey.current) return;
      setRemote((items) => [...(items ?? []), ...page.items]);
      setCursor(page.next);
    } catch (error) {
      if (requestedKey === currentHistoryKey.current)
        setHistoryError(
          error instanceof Error
            ? error.message
            : "History unavailable. Downloaded plans remain available.",
        );
    } finally {
      setLoading(false);
    }
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
  const items = (remote ?? all)
    .map((item) => all.find((current) => current.id === item.id) ?? item)
    .filter(
      (item) =>
        (!query.trim() ||
          `${item.title} ${item.notes}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())) &&
        (priority === "all" ||
          (priority === "none"
            ? item.priority === null
            : item.priority === priority)) &&
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
              {search ? t("Find a plan") : t("Your little wins")}
            </Text>
            <Text style={s.muted}>
              {search
                ? t("Find the things that matter to you.")
                : t("A moment to see how far you\u2019ve come.")}
            </Text>
            <PlannerStatus compact />
            {search && (
              <Field
                label={t("Search titles and notes")}
                value={query}
                onChangeText={setQuery}
                placeholder={t("What are you looking for?")}
              />
            )}
            <Button
              title={
                filtersOpen
                  ? t("Hide filters")
                  : t("Date & status filters \u00B7 {v0}", { v0: t(filter) })
              }
              variant="ghost"
              onPress={() => setFiltersOpen(!filtersOpen)}
            />
            <Text style={s.muted}>
              {t("Downloaded plans \u00B7 {v0} \u2013 {v1}", {
                v0: formatCivilDate(
                  from,
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                  locale(),
                ),
                v1: formatCivilDate(
                  through,
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                  locale(),
                ),
              })}
            </Text>
            {filtersOpen && (
              <>
                <DateField
                  label={t("From date")}
                  value={from}
                  onChange={setFrom}
                />
                <DateField
                  label={t("Through date")}
                  value={through}
                  onChange={setThrough}
                />
                <Text style={s.muted}>
                  {t(
                    "Searching downloaded plans in this date range, up to 366 days. Moved tasks use their current date; cards retain the original date.",
                  )}
                </Text>
                <Choices
                  label={t("Task status")}
                  value={filter}
                  options={[
                    { value: "all", label: t("All") },
                    { value: "overdue", label: t("Overdue") },
                    { value: "completed", label: t("Completed") },
                    { value: "skipped", label: t("Skipped") },
                  ]}
                  onChange={setFilter}
                />
                <Choices
                  label={t("Priority filter")}
                  value={priority}
                  options={["all", "none", "low", "medium", "high"].map(
                    (value) => ({ value, label: t(value) }),
                  )}
                  onChange={setPriority}
                />
                <Choices
                  label={t("Series filter")}
                  value={definitionId ?? "all"}
                  options={[
                    { value: "all", label: t("All plans") },
                    ...p.records
                      .filter((record) =>
                        reduceRecord(record).revisions.some(
                          (revision) => revision.task.rule,
                        ),
                      )
                      .map((record) => ({
                        value: record.id,
                        label:
                          reduceRecord(record).revisions.at(-1)!.task.title,
                      })),
                  ]}
                  onChange={(value) =>
                    setDefinitionId(value === "all" ? undefined : value)
                  }
                />
              </>
            )}
            {!!error && (
              <Text style={[s.body, s.error]} accessibilityRole="alert">
                {errorMessage(error)}
              </Text>
            )}
            {!search && (
              <View style={s.notice}>
                <Text style={s.section}>
                  {t("{v0} / {v1} scheduled", {
                    v0: scheduled.completed,
                    v1: scheduled.total,
                  })}
                </Text>
                <Text style={s.body}>
                  {t("Completion rate: {v0}", {
                    v0:
                      elapsed.ratio === null
                        ? t("No elapsed tasks yet")
                        : t("{v0}% ({v1}/{v2} elapsed)", {
                            v0: Math.round(elapsed.ratio * 100),
                            v1: elapsed.completed,
                            v2: elapsed.total,
                          }),
                  })}
                </Text>
                <Text style={[s.muted, s.onAccent]}>
                  {t(
                    "Skipped tasks are excluded from both totals. Upcoming tasks are excluded from completion rate.",
                  )}
                </Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={s.field}>
            <Text style={s.muted}>
              {remote
                ? t("Online historical snapshot for this range")
                : t(
                    "Downloaded plans are available offline. Online history checks a fixed server snapshot.",
                  )}
            </Text>
            {historyError && (
              <Text accessibilityRole="alert" style={s.error}>
                {errorMessage(historyError)}
              </Text>
            )}
            <Button
              title={
                remote && cursor
                  ? t("Load more history")
                  : t("Load online history")
              }
              disabled={
                !!error || loading || (remote !== null && cursor === null)
              }
              onPress={() => {
                void historical();
              }}
            />
            {remote !== null && !cursor && (
              <Button
                title={t("Return to downloaded plans")}
                onPress={() => setRemote(null)}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={s.body}>
            {error
              ? t("Adjust the dates to see your plans.")
              : t("No matching plans in this period.")}
          </Text>
        }
        renderItem={({ item }) => <TaskCard item={item} showDate />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}
export function Review() {
  useLanguage();
  return <History search={false} />;
}
export function Search() {
  useLanguage();
  return <History search />;
}
