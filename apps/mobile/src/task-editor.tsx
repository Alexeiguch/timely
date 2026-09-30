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
import {
  preview,
  recurrencePreset,
  ruleSummary,
  type Scope,
} from "@timely/domain";
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
  item,
  onSave,
  onClose,
}: {
  initial: Task;
  item?: Occurrence;
  onSave: (task: Task, scope: Scope) => Promise<void>;
  onClose: () => void;
}) {
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
  const ruleChanged =
    JSON.stringify(initial.rule) !== JSON.stringify(task.rule);
  const close = () => {
    if (saving) return;
    if (JSON.stringify(task) === JSON.stringify(initial)) {
      onClose();
      return;
    }
    Alert.alert("Discard unsaved changes?", "Your saved tasks are unchanged.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };
  const save = async (scope?: Scope) => {
    const parsed = taskSchema.safeParse(task);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        `${issue?.path.join(".") ?? "Task"}: ${issue?.message ?? "Check the fields."}`,
      );
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
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };
  const selector =
    task.rule && "selector" in task.rule ? task.rule.selector : null;
  const setSelector = (value: Selector) => setRule({ selector: value });
  if (scopeChoice)
    return (
      <Sheet title="Apply changes to…" onClose={() => setScopeChoice(false)}>
        <View style={s.notice}>
          <Text style={s.title}>{task.title}</Text>
          <Text style={s.body}>
            Completed history stays unchanged by series edits.
          </Text>
          {!ruleChanged && (
            <Button
              title="Only this occurrence"
              disabled={saving}
              onPress={() => void save("occurrence")}
            />
          )}
          <Button
            title="This and future occurrences"
            disabled={saving}
            onPress={() => void save("future")}
          />
          <Button
            title="Series from today onward"
            disabled={saving}
            onPress={() => void save("series")}
          />
          <Button title="Keep editing" onPress={() => setScopeChoice(false)} />
        </View>
        {error ? (
          <Text style={[s.body, s.error]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Sheet>
    );
  return (
    <Sheet
      title={item ? "A little adjustment" : "Make a little plan"}
      onClose={close}
      footer={
        !scopeChoice ? (
          <Button
            title="Save task"
            active
            loading={saving}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      <Field
        label="Task title"
        value={task.title}
        maxLength={200}
        placeholder="What would you like to do?"
        autoFocus={!item}
        onChangeText={(title) => patch({ title })}
      />
      <Text style={s.muted}>
        For {task.schedule.date}. A title is all you need.
      </Text>
      <Button
        title={details ? "Hide optional details" : "Add optional details"}
        onPress={() => setDetails(!details)}
      />
      {details && (
        <>
          <DateField
            label="Date"
            value={task.schedule.date}
            onChange={(value) =>
              patch({ schedule: { ...task.schedule, date: value } })
            }
          />
          <DateField
            label="Start time"
            mode="time"
            value={task.schedule.time}
            onChange={(time) => patch({ schedule: { ...task.schedule, time } })}
            onClear={() =>
              patch({ schedule: { ...task.schedule, time: null } })
            }
          />
          <Field
            label="Duration in minutes (optional)"
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
            1–10,080 minutes. Time and duration can be cleared separately.
          </Text>
          <Choices
            label="Priority"
            value={task.priority ?? "none"}
            options={["none", "low", "medium", "high"].map((value) => ({
              value,
              label:
                value === "none"
                  ? "No priority"
                  : `${value[0]!.toUpperCase()}${value.slice(1)}`,
            }))}
            onChange={(value) =>
              patch({
                priority: value === "none" ? null : (value as Task["priority"]),
              })
            }
          />
          <Field
            label="Notes"
            value={task.notes}
            maxLength={10000}
            multiline
            onChangeText={(notes) => patch({ notes })}
          />
          <Choices
            label="Repeat preset"
            value={task.rule?.frequency ?? "none"}
            options={[
              { value: "none", label: "Does not repeat" },
              { value: "daily", label: "Every day" },
              { value: "weekdays", label: "Weekdays" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
            onChange={(value) =>
              patch({
                rule: recurrencePreset(
                  value as Parameters<typeof recurrencePreset>[0],
                  task.schedule.date,
                ),
              })
            }
          />
          {task.rule && (
            <View style={s.card}>
              <Text style={s.section}>Customize recurrence</Text>
              <DateField
                label="Recurrence start"
                value={task.rule.anchor}
                onChange={(anchor) => setRule({ anchor })}
              />
              <Field
                label={`Every how many ${task.rule.frequency === "daily" ? "days" : task.rule.frequency === "weekly" ? "weeks" : task.rule.frequency === "monthly" ? "months" : "years"}?`}
                value={String(task.rule.interval)}
                keyboardType="number-pad"
                onChangeText={(value) => setRule({ interval: Number(value) })}
              />
              {task.rule.frequency === "weekly" && (
                <>
                  <Text style={s.label}>Repeat on</Text>
                  <View style={s.row}>
                    {weekdays.map((name, index) => {
                      const rule = task.rule as Extract<
                        Rule,
                        { frequency: "weekly" }
                      >;
                      return (
                        <Button
                          key={name}
                          title={name.slice(0, 3)}
                          label={`Repeat on ${name}`}
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
                    label="Recurrence week starts"
                    value={task.rule.firstWeekday}
                    options={weekdays.map((name, i) => ({
                      value: i + 1,
                      label: name.slice(0, 3),
                    }))}
                    onChange={(firstWeekday) => setRule({ firstWeekday })}
                  />
                </>
              )}
              {task.rule.frequency === "yearly" && (
                <Choices
                  label="Month"
                  value={task.rule.month}
                  options={months.map((name, i) => ({
                    value: i + 1,
                    label: name.slice(0, 3),
                  }))}
                  onChange={(month) => setRule({ month })}
                />
              )}
              {selector && (
                <>
                  <Choices
                    label="Monthly pattern"
                    value={selector.kind}
                    options={[
                      { value: "days", label: "Dates" },
                      { value: "ordinal", label: "Ordinal weekday" },
                      { value: "last-day", label: "Last day" },
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
                      <Text style={s.label}>Days of the month</Text>
                      <View style={s.row}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (day) => (
                            <Button
                              key={day}
                              title={String(day)}
                              label={`Month day ${day}`}
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
                        label="Which occurrence"
                        value={selector.ordinal}
                        options={[
                          { value: 1, label: "First" },
                          { value: 2, label: "Second" },
                          { value: 3, label: "Third" },
                          { value: 4, label: "Fourth" },
                          { value: -1, label: "Last" },
                        ]}
                        onChange={(ordinal) =>
                          setSelector({
                            ...selector,
                            ordinal: ordinal as typeof selector.ordinal,
                          })
                        }
                      />
                      <Choices
                        label="Weekday"
                        value={String(selector.weekday)}
                        options={[
                          ...weekdays.map((name, i) => ({
                            value: String(i + 1),
                            label: name,
                          })),
                          { value: "weekday", label: "Weekday (Mon–Fri)" },
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
                    label="When a date does not exist"
                    value={task.rule.invalidDate}
                    options={[
                      { value: "clamp", label: "Use last day" },
                      { value: "skip", label: "Skip that month" },
                    ]}
                    onChange={(invalidDate) =>
                      setRule({
                        invalidDate: invalidDate as Rule["invalidDate"],
                      })
                    }
                  />
                  <Text style={s.muted}>
                    {task.rule.invalidDate === "clamp"
                      ? "For example, the 31st uses February’s last day. Overlapping dates become one occurrence."
                      : "For example, the 31st skips February. Skipped dates do not count toward the end count."}
                  </Text>
                </>
              )}
              <Choices
                label="Ends"
                value={task.rule.end.kind}
                options={[
                  { value: "never", label: "Never" },
                  { value: "date", label: "On date" },
                  { value: "count", label: "After a count" },
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
                  label="Last recurrence date"
                  value={task.rule.end.date}
                  onChange={(value) =>
                    setRule({ end: { kind: "date", date: value } })
                  }
                />
              )}
              {task.rule.end.kind === "count" && (
                <Field
                  label="Scheduled occurrence count"
                  value={String(task.rule.end.count)}
                  keyboardType="number-pad"
                  onChangeText={(value) =>
                    setRule({ end: { kind: "count", count: Number(value) } })
                  }
                />
              )}
              <Text style={s.body}>
                {validRule.success
                  ? ruleSummary(validRule.data)
                  : "Check your recurrence choices."}
              </Text>
              <Text style={s.muted}>
                Next dates:{" "}
                {dates.length
                  ? dates.map((d) => d.date).join(" · ")
                  : "No dates within 1900–2100."}
              </Text>
            </View>
          )}
          <View style={s.row}>
            <Text style={[s.label, s.grow]}>Warn me</Text>
            <Switch
              accessibilityLabel="Warn me"
              value={task.reminders.enabled}
              onValueChange={(enabled) =>
                patch({ reminders: { ...task.reminders, enabled } })
              }
            />
          </View>
          {task.reminders.enabled && (
            <View style={s.card}>
              <Text style={s.muted}>
                Your preferences will sync. Notification delivery is not yet
                available in this build.
              </Text>
              {(["before", "overdue"] as const).map((key) => (
                <View key={key} style={s.row}>
                  <Text style={[s.body, s.grow]}>
                    {key === "before" ? "Before the task" : "When overdue"}
                  </Text>
                  <Switch
                    accessibilityLabel={
                      key === "before"
                        ? "Before-task reminder"
                        : "Overdue reminder"
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
          {error}
        </Text>
      )}
    </Sheet>
  );
}
