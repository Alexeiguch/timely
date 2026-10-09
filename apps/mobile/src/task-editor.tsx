import { t, locale, errorMessage, recurrenceText } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { useMemo, useState } from "react";
import { Alert, Keyboard, Switch, Text, View } from "react-native";
import {
  taskSchema,
  ruleSchema,
  type Task,
  type Rule,
  type Selector,
  type Occurrence,
} from "@timely/contracts";
import { preview, recurrencePreset, type Scope } from "@timely/domain";
import { Button, Choices, Field, Sheet, s } from "./ui";
import { DateField } from "./date-field";
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export function TaskEditor({
  initial,
  currentDay,
  item,
  onSave,
  onClose,
}: {
  initial: Task;
  currentDay: string;
  item?: Occurrence;
  onSave: (task: Task, scope: Scope) => Promise<void>;
  onClose: () => void;
}) {
  useLanguage();
  const [task, setTask] = useState(initial);
  const [details, setDetails] = useState(!!item);
  const [scopeChoice, setScopeChoice] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const patch = (change: Partial<Task>) => {
    setTask((value) => ({ ...value, ...change }));
    setScopeChoice(false);
  };
  const setRule = (change: Partial<Rule>) =>
    patch({ rule: { ...task.rule!, ...change } as Rule });
  const validRule = useMemo(() => ruleSchema.safeParse(task.rule), [task.rule]);
  const dates = useMemo(
    () => (validRule.success ? preview(validRule.data) : []),
    [validRule],
  );
  const seriesChoiceChanged =
    JSON.stringify(initial.rule) !== JSON.stringify(task.rule) ||
    JSON.stringify(initial.streak) !== JSON.stringify(task.streak);
  const close = () => {
    if (saving) return;
    if (JSON.stringify(task) === JSON.stringify(initial)) {
      onClose();
      return;
    }
    Alert.alert(
      t("Discard unsaved changes?"),
      t("Your saved tasks are unchanged."),
      [
        { text: t("Keep editing"), style: "cancel" },
        { text: t("Discard"), style: "destructive", onPress: onClose },
      ],
    );
  };
  const save = async (scope?: Scope) => {
    const parsed = taskSchema.safeParse(task);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(t("Check the task fields."));
      return;
    }
    if (item && (initial.rule || parsed.data.rule) && !scope) {
      Keyboard.dismiss();
      setScopeChoice(true);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(parsed.data, scope ?? "occurrence");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Unable to save."));
    } finally {
      setSaving(false);
    }
  };
  const selector =
    task.rule && "selector" in task.rule ? task.rule.selector : null;
  const setSelector = (value: Selector) => setRule({ selector: value });
  if (scopeChoice)
    return (
      <Sheet
        title={t("Apply changes to\u2026")}
        onClose={() => setScopeChoice(false)}
      >
        <View style={s.notice}>
          <Text style={s.title}>{task.title}</Text>
          <Text style={s.body}>
            {t("Completed history stays unchanged by series edits.")}
          </Text>
          {!seriesChoiceChanged && (
            <Button
              title={t("Only this occurrence")}
              disabled={saving}
              onPress={() => void save("occurrence")}
            />
          )}
          <Button
            title={t("This and future occurrences")}
            disabled={saving}
            onPress={() => void save("future")}
          />
          <Button
            title={t("Series from today onward")}
            disabled={saving}
            onPress={() => void save("series")}
          />
          <Button
            title={t("Keep editing")}
            onPress={() => setScopeChoice(false)}
          />
        </View>
        {error ? (
          <Text style={[s.body, s.error]} accessibilityRole="alert">
            {errorMessage(error)}
          </Text>
        ) : null}
      </Sheet>
    );
  return (
    <Sheet
      title={item ? t("A little adjustment") : t("Make a little plan")}
      onClose={close}
      footer={
        !scopeChoice ? (
          <Button
            title={t("Save task")}
            active
            loading={saving}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      <Field
        label={t("Task title")}
        value={task.title}
        maxLength={200}
        placeholder={t("What would you like to do?")}
        autoFocus={!item}
        onChangeText={(title) => patch({ title })}
      />
      <Text style={s.muted}>
        {t("For {v0}. A title is all you need.", { v0: task.schedule.date })}
      </Text>
      <Button
        title={details ? t("Hide optional details") : t("Add optional details")}
        onPress={() => setDetails(!details)}
      />
      {details && (
        <>
          <DateField
            label={t("Date")}
            value={task.schedule.date}
            onChange={(value) =>
              patch({ schedule: { ...task.schedule, date: value } })
            }
          />
          <DateField
            label={t("Start time")}
            mode="time"
            value={task.schedule.time}
            onChange={(time) => patch({ schedule: { ...task.schedule, time } })}
            onClear={() =>
              patch({ schedule: { ...task.schedule, time: null } })
            }
          />
          <Field
            label={t("Duration in minutes (optional)")}
            value={
              task.schedule.duration === null
                ? ""
                : String(task.schedule.duration)
            }
            keyboardType="number-pad"
            onChangeText={(value) =>
              patch({
                schedule: {
                  ...task.schedule,
                  duration: value === "" ? null : Number(value),
                },
              })
            }
          />
          <Text style={s.muted}>
            {t(
              "1\u201310,080 minutes. Time and duration can be cleared separately.",
            )}
          </Text>
          <Choices
            label={t("Priority")}
            value={task.priority ?? "none"}
            options={["none", "low", "medium", "high"].map((value) => ({
              value,
              label: value === "none" ? t("No priority") : t(value),
            }))}
            onChange={(value) =>
              patch({
                priority: value === "none" ? null : (value as Task["priority"]),
              })
            }
          />
          <Field
            label={t("Notes")}
            value={task.notes}
            maxLength={10000}
            multiline
            onChangeText={(notes) => patch({ notes })}
          />
          <Choices
            label={t("Repeat preset")}
            value={task.rule?.frequency ?? "none"}
            options={[
              { value: "none", label: t("Does not repeat") },
              { value: "daily", label: t("Every day") },
              { value: "weekdays", label: t("Weekdays") },
              { value: "weekly", label: t("Weekly") },
              { value: "monthly", label: t("Monthly") },
              { value: "yearly", label: t("Yearly") },
            ]}
            onChange={(value) =>
              patch({
                ...(value === "none" ? { streak: null } : {}),
                rule: recurrencePreset(
                  value as Parameters<typeof recurrencePreset>[0],
                  task.schedule.date,
                ),
              })
            }
          />
          {task.rule && (
            <View style={s.card}>
              <Text style={s.section}>{t("Customize recurrence")}</Text>
              <DateField
                label={t("Recurrence start")}
                value={task.rule.anchor}
                onChange={(anchor) => setRule({ anchor })}
              />
              <Field
                label={t("Every how many {v0}?", {
                  v0:
                    task.rule.frequency === "daily"
                      ? t("days")
                      : task.rule.frequency === "weekly"
                        ? t("weeks")
                        : task.rule.frequency === "monthly"
                          ? t("months")
                          : t("years"),
                })}
                value={String(task.rule.interval)}
                keyboardType="number-pad"
                onChangeText={(value) => setRule({ interval: Number(value) })}
              />
              {task.rule.frequency === "weekly" && (
                <>
                  <Text style={s.label}>{t("Repeat on")}</Text>
                  <View style={s.row}>
                    {weekdays.map((name, index) => {
                      const rule = task.rule as Extract<
                        Rule,
                        {
                          frequency: "weekly";
                        }
                      >;
                      return (
                        <Button
                          key={name}
                          title={t(name).slice(0, 3)}
                          label={t("Repeat on {v0}", { v0: t(name) })}
                          active={rule.weekdays.includes(index + 1)}
                          onPress={() =>
                            setRule({
                              weekdays: rule.weekdays.includes(index + 1)
                                ? rule.weekdays.filter((d) => d !== index + 1)
                                : [...rule.weekdays, index + 1],
                            })
                          }
                        />
                      );
                    })}
                  </View>
                  <Choices
                    label={t("Recurrence week starts")}
                    value={task.rule.firstWeekday}
                    options={weekdays.map((name, i) => ({
                      value: i + 1,
                      label: t(name).slice(0, 3),
                    }))}
                    onChange={(firstWeekday) => setRule({ firstWeekday })}
                  />
                </>
              )}
              {task.rule.frequency === "yearly" && (
                <Choices
                  label={t("Month")}
                  value={task.rule.month}
                  options={months.map((name, i) => ({
                    value: i + 1,
                    label: t(name).slice(0, 3),
                  }))}
                  onChange={(month) => setRule({ month })}
                />
              )}
              {selector && (
                <>
                  <Choices
                    label={t("Monthly pattern")}
                    value={selector.kind}
                    options={[
                      { value: "days", label: t("Dates") },
                      { value: "ordinal", label: t("Ordinal weekday") },
                      { value: "last-day", label: t("Last day") },
                    ]}
                    onChange={(kind) =>
                      setSelector(
                        kind === "days"
                          ? { kind, days: [1] }
                          : kind === "last-day"
                            ? { kind }
                            : {
                                kind: "ordinal",
                                ordinal: -1,
                                weekday: "weekday",
                              },
                      )
                    }
                  />
                  {selector.kind === "days" && (
                    <>
                      <Text style={s.label}>{t("Days of the month")}</Text>
                      <View style={s.row}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (day) => (
                            <Button
                              key={day}
                              title={String(day)}
                              label={t("Month day {v0}", { v0: day })}
                              active={selector.days.includes(day)}
                              onPress={() =>
                                setSelector({
                                  kind: "days",
                                  days: selector.days.includes(day)
                                    ? selector.days.filter((d) => d !== day)
                                    : [...selector.days, day].sort(
                                        (a, b) => a - b,
                                      ),
                                })
                              }
                            />
                          ),
                        )}
                      </View>
                    </>
                  )}
                  {selector.kind === "ordinal" && (
                    <>
                      <Choices
                        label={t("Which occurrence")}
                        value={selector.ordinal}
                        options={[
                          { value: 1, label: t("First") },
                          { value: 2, label: t("Second") },
                          { value: 3, label: t("Third") },
                          { value: 4, label: t("Fourth") },
                          { value: -1, label: t("Last") },
                        ]}
                        onChange={(ordinal) =>
                          setSelector({
                            ...selector,
                            ordinal: ordinal as typeof selector.ordinal,
                          })
                        }
                      />
                      <Choices
                        label={t("Weekday")}
                        value={String(selector.weekday)}
                        options={[
                          ...weekdays.map((name, i) => ({
                            value: String(i + 1),
                            label: t(name),
                          })),
                          {
                            value: "weekday",
                            label: t("Weekday (Mon\u2013Fri)"),
                          },
                        ]}
                        onChange={(value) =>
                          setSelector({
                            ...selector,
                            weekday:
                              value === "weekday" ? value : Number(value),
                          })
                        }
                      />
                    </>
                  )}
                  <Choices
                    label={t("When a date does not exist")}
                    value={task.rule.invalidDate}
                    options={[
                      { value: "clamp", label: t("Use last day") },
                      { value: "skip", label: t("Skip that month") },
                    ]}
                    onChange={(invalidDate) =>
                      setRule({
                        invalidDate: invalidDate as Rule["invalidDate"],
                      })
                    }
                  />
                  <Text style={s.muted}>
                    {task.rule.invalidDate === "clamp"
                      ? t(
                          "For example, the 31st uses February\u2019s last day. Overlapping dates become one occurrence.",
                        )
                      : t(
                          "For example, the 31st skips February. Skipped dates do not count toward the end count.",
                        )}
                  </Text>
                </>
              )}
              <Choices
                label={t("Ends")}
                value={task.rule.end.kind}
                options={[
                  { value: "never", label: t("Never") },
                  { value: "date", label: t("On date") },
                  { value: "count", label: t("After a count") },
                ]}
                onChange={(kind) =>
                  setRule({
                    end:
                      kind === "never"
                        ? { kind }
                        : kind === "date"
                          ? { kind, date: task.rule!.anchor }
                          : { kind: "count", count: 10 },
                  })
                }
              />
              {task.rule.end.kind === "date" && (
                <DateField
                  label={t("Last recurrence date")}
                  value={task.rule.end.date}
                  onChange={(value) =>
                    setRule({ end: { kind: "date", date: value } })
                  }
                />
              )}
              {task.rule.end.kind === "count" && (
                <Field
                  label={t("Scheduled occurrence count")}
                  value={String(task.rule.end.count)}
                  keyboardType="number-pad"
                  onChangeText={(value) =>
                    setRule({ end: { kind: "count", count: Number(value) } })
                  }
                />
              )}
              <Text style={s.body}>
                {validRule.success
                  ? recurrenceText(validRule.data)
                  : t("Check your recurrence choices.")}
              </Text>
              <Text style={s.muted}>
                {t("Next dates: {v0}", {
                  v0: dates.length
                    ? dates.map((d) => d.date).join(" · ")
                    : t("No dates within 1900\u20132100."),
                })}
              </Text>
            </View>
          )}
          {task.rule && (
            <View style={s.card}>
              <View style={s.row}>
                <Text style={[s.label, s.grow]}>{t("Track a streak")}</Text>
                <Switch
                  accessibilityLabel={t("Track a streak")}
                  value={!!task.streak}
                  onValueChange={(enabled) =>
                    patch({
                      streak: enabled
                        ? { from: item ? currentDay : task.rule!.anchor }
                        : null,
                    })
                  }
                />
              </View>
              <Text style={s.body}>
                {t(
                  "Complete each occurrence before its deadline to keep your streak. Skipping is unavailable.",
                )}
              </Text>
              <Text style={s.muted}>
                {t(
                  "Untimed tasks are due at the end of the day; timed tasks are due at their time plus duration.",
                )}
              </Text>
            </View>
          )}
          <View style={s.row}>
            <Text style={[s.label, s.grow]}>{t("Warn me")}</Text>
            <Switch
              accessibilityLabel={t("Warn me")}
              value={task.reminders.enabled}
              onValueChange={(enabled) =>
                patch({ reminders: { ...task.reminders, enabled } })
              }
            />
          </View>
          {task.reminders.enabled && (
            <View style={s.card}>
              <Text style={s.muted}>
                {t(
                  "Your choices sync to every device. Allow notifications to schedule local reminders; check Settings for coverage.",
                )}
              </Text>
              {(["before", "overdue"] as const).map((key) => (
                <View key={key} style={s.row}>
                  <Text style={[s.body, s.grow]}>
                    {key === "before"
                      ? t("Before the task")
                      : t("When overdue")}
                  </Text>
                  <Switch
                    accessibilityLabel={
                      key === "before"
                        ? t("Before-task reminder")
                        : t("Overdue reminder")
                    }
                    value={task.reminders[key]}
                    onValueChange={(value) =>
                      patch({ reminders: { ...task.reminders, [key]: value } })
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, s.error]}>
          {errorMessage(error)}
        </Text>
      )}
    </Sheet>
  );
}
