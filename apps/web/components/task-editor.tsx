"use client";
import { t, locale, errorMessage, recurrenceText } from "@timely/i18n";
import { useLanguage } from "./language-state";

import { useEffect, useRef, useState } from "react";
import {
  taskSchema,
  civilDate,
  type Task,
  type Rule,
  type Occurrence,
} from "@timely/contracts";
import {
  date,
  preview,
  formatCivilDate,
  recurrencePreset,
  selectedRecurrencePreset,
} from "@timely/domain";
import { DurationField } from "./duration-field";
import { StreakSetting } from "./streak-setting";
type Props = {
  initial: Task;
  currentDay: string;
  occurrence?: Occurrence;
  onSave: (
    task: Task,
    scope: "occurrence" | "future" | "series",
  ) => Promise<void>;
  onClose: () => void;
};
export function TaskEditor({
  initial,
  currentDay,
  occurrence,
  onSave,
  onClose,
}: Props) {
  useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [task, setTask] = useState(initial);
  const [scope, setScope] = useState<"occurrence" | "future" | "series">(
    "occurrence",
  );
  const [details, setDetails] = useState(!!occurrence);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (discarding) {
      keepEditing.current?.focus();
      keepEditing.current?.scrollIntoView({ block: "nearest" });
    }
  }, [discarding]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const patch = (change: Partial<Task>) =>
    setTask((value) => ({ ...value, ...change }));
  const setRule = (change: Partial<Rule>) =>
    patch({ rule: { ...task.rule!, ...change } as Rule });
  function frequency(value: string) {
    if (!civilDate.safeParse(task.schedule.date).success) {
      setError(t("Choose a date before setting repeat."));
      return;
    }
    patch({
      ...(value === "none" ? { streak: null } : {}),
      rule: recurrencePreset(
        value as Parameters<typeof recurrencePreset>[0],
        task.schedule.date,
      ),
    });
  }
  let nextDates: string[] = [];
  try {
    if (task.rule) nextDates = preview(task.rule).map((slot) => slot.date);
  } catch {
    /* Inline validation handles incomplete form values on save. */
  }
  const close = () => {
    if (saving) return;
    if (JSON.stringify(task) === JSON.stringify(initial)) onClose();
    else setDiscarding(true);
  };
  const ruleEditable = !occurrence || !initial.rule || scope !== "occurrence";
  return (
    <dialog
      ref={dialog}
      className="editor"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="editor-title"
    >
      <form
        onInvalidCapture={(event) => {
          const control = event.target as HTMLElement;
          const disclosure = control.closest("details");
          if (disclosure) disclosure.open = true;
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving || discarding) return;
          setSaving(true);
          setError("");
          const parsed = taskSchema.safeParse(task);
          if (!parsed.success) {
            setDetails(true);
            dialog.current?.querySelectorAll("details").forEach((element) => {
              element.open = true;
            });
            setError(
              t(
                task.title.trim()
                  ? "Check the task fields."
                  : "Give your task a title.",
              ),
            );
            setSaving(false);
            return;
          }
          try {
            await onSave(parsed.data, scope);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : t("Unable to save."));
          } finally {
            setSaving(false);
          }
        }}
      >
        <header className="row between">
          <h2 id="editor-title">
            {occurrence ? t("Edit task") : t("Add task")}
          </h2>
          <button
            type="button"
            aria-label={t("Close editor")}
            disabled={saving}
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="editor-body">
          {discarding && (
            <section className="notice" aria-labelledby="discard-title">
              <h3 id="discard-title">{t("Discard unsaved changes?")}</h3>
              <p>{t("Your saved tasks are unchanged.")}</p>
              <div className="row">
                <button
                  ref={keepEditing}
                  type="button"
                  onClick={() => setDiscarding(false)}
                >
                  {t("Keep editing")}
                </button>
                <button type="button" onClick={onClose}>
                  {t("Discard")}
                </button>
              </div>
            </section>
          )}
          <label>
            {t("Task title")}
            <input
              autoFocus
              value={task.title}
              maxLength={200}
              required
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t("What would you like to do?")}
            />
          </label>
          <p className="muted">
            {civilDate.safeParse(task.schedule.date).success
              ? t("For {v0}. A title is all you need.", {
                  v0: formatCivilDate(
                    task.schedule.date,
                    { day: "numeric", month: "long", year: "numeric" },
                    locale(),
                  ),
                })
              : t("Choose a date for your task.")}
          </p>
          <button
            type="button"
            aria-expanded={details}
            aria-controls="task-details"
            onClick={() => setDetails(!details)}
          >
            {details ? t("Hide optional details") : t("Add optional details")}
          </button>
          {details && (
            <div id="task-details" className="editor-details">
              <div className="form-grid">
                <label>
                  {t("Date")}
                  <input
                    type="date"
                    min="1900-01-01"
                    max="2100-12-31"
                    required
                    value={task.schedule.date}
                    onChange={(e) =>
                      patch({
                        schedule: { ...task.schedule, date: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  {t("Start time")}
                  <small>{t("Optional")}</small>
                  <input
                    type="time"
                    value={task.schedule.time ?? ""}
                    onChange={(e) =>
                      patch({
                        schedule: {
                          ...task.schedule,
                          time: e.target.value || null,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {t("Priority")}
                  <select
                    value={task.priority ?? ""}
                    onChange={(e) =>
                      patch({
                        priority: (e.target.value || null) as Task["priority"],
                      })
                    }
                  >
                    <option value="">{t("No priority")}</option>
                    <option value="low">{t("Low")}</option>
                    <option value="medium">{t("Medium")}</option>
                    <option value="high">{t("High")}</option>
                  </select>
                </label>
              </div>
              <DurationField
                value={task.schedule.duration}
                onChange={(duration) =>
                  patch({ schedule: { ...task.schedule, duration } })
                }
              />
              <label>
                {t("Notes")}
                <textarea
                  value={task.notes}
                  maxLength={10000}
                  rows={3}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              {occurrence && initial.rule && (
                <label>
                  {t("Apply changes to")}
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as typeof scope)}
                  >
                    <option value="occurrence">
                      {t("Only this occurrence")}
                    </option>
                    <option value="future">
                      {t("This and future occurrences")}
                    </option>
                    <option value="series">
                      {t("Whole series from today")}
                    </option>
                  </select>
                </label>
              )}
              <fieldset disabled={!ruleEditable}>
                <legend>{t("Repeat")}</legend>
                <label>
                  {t("Frequency")}
                  <select
                    value={selectedRecurrencePreset(task.rule)}
                    onChange={(e) => frequency(e.target.value)}
                  >
                    <option value="none">{t("Does not repeat")}</option>
                    <option value="daily">{t("Daily")}</option>
                    <option value="weekdays">{t("Weekdays")}</option>
                    <option value="weekly">{t("Weekly")}</option>
                    <option value="monthly">{t("Monthly")}</option>
                    <option value="yearly">{t("Yearly")}</option>
                  </select>
                </label>
                {task.rule && (
                  <StreakSetting
                    enabled={!!task.streak}
                    onChange={(enabled) =>
                      patch({
                        streak: enabled
                          ? {
                              from: occurrence ? currentDay : task.rule!.anchor,
                            }
                          : null,
                      })
                    }
                  />
                )}
                {task.rule && (
                  <>
                    <details className="disclosure">
                      <summary>{t("Customize repeat")}</summary>
                      <div className="disclosure-content">
                        <div className="form-grid">
                          <label>
                            {t("Every")}
                            <input
                              type="number"
                              min="1"
                              max="999"
                              value={task.rule.interval}
                              onChange={(e) =>
                                setRule({ interval: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label>
                            {t("Starts on")}
                            <input
                              type="date"
                              value={task.rule.anchor}
                              min="1900-01-01"
                              max="2100-12-31"
                              onChange={(e) =>
                                setRule({ anchor: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        {task.rule.frequency === "weekly" && (
                          <div
                            className="chips"
                            aria-label={t("Repeat weekdays")}
                          >
                            {[
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                              "Sun",
                            ].map((label, i) => {
                              const rule = task.rule;
                              if (rule?.frequency !== "weekly") return null;
                              const selected = rule.weekdays.includes(i + 1);
                              return (
                                <button
                                  type="button"
                                  key={label}
                                  aria-pressed={selected}
                                  onClick={() =>
                                    setRule({
                                      weekdays: selected
                                        ? rule.weekdays.filter(
                                            (day) => day !== i + 1,
                                          )
                                        : [...rule.weekdays, i + 1],
                                    })
                                  }
                                >
                                  {t(label)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {(task.rule.frequency === "monthly" ||
                          task.rule.frequency === "yearly") && (
                          <>
                            {task.rule.frequency === "yearly" && (
                              <label>
                                {t("Month")}
                                <input
                                  type="number"
                                  min="1"
                                  max="12"
                                  value={task.rule.month}
                                  onChange={(e) =>
                                    setRule({ month: Number(e.target.value) })
                                  }
                                />
                              </label>
                            )}
                            <label>
                              {t("On")}
                              <select
                                value={task.rule.selector.kind}
                                onChange={(e) =>
                                  setRule({
                                    selector:
                                      e.target.value === "last-day"
                                        ? { kind: "last-day" }
                                        : e.target.value === "ordinal"
                                          ? {
                                              kind: "ordinal",
                                              ordinal: -1,
                                              weekday: "weekday",
                                            }
                                          : {
                                              kind: "days",
                                              days: [
                                                date(
                                                  civilDate.safeParse(
                                                    task.schedule.date,
                                                  ).success
                                                    ? task.schedule.date
                                                    : initial.schedule.date,
                                                ).day,
                                              ],
                                            },
                                  })
                                }
                              >
                                <option value="days">
                                  {t("Selected days of the month")}
                                </option>
                                <option value="ordinal">
                                  {t("A weekday pattern")}
                                </option>
                                <option value="last-day">
                                  {t("The last day")}
                                </option>
                              </select>
                            </label>
                            {task.rule.selector.kind === "days" && (
                              <label>
                                {t("Days, separated by commas")}
                                <input
                                  value={task.rule.selector.days.join(",")}
                                  onChange={(e) =>
                                    setRule({
                                      selector: {
                                        kind: "days",
                                        days: e.target.value
                                          .split(",")
                                          .map(Number),
                                      },
                                    })
                                  }
                                />
                              </label>
                            )}
                            {task.rule.selector.kind === "ordinal" && (
                              <div className="form-grid">
                                <label>
                                  {t("Position")}
                                  <select
                                    value={task.rule.selector.ordinal}
                                    onChange={(e) => {
                                      const rule = task.rule;
                                      if (
                                        rule &&
                                        "selector" in rule &&
                                        rule.selector.kind === "ordinal"
                                      )
                                        setRule({
                                          selector: {
                                            ...rule.selector,
                                            ordinal: Number(e.target.value) as
                                              | 1
                                              | 2
                                              | 3
                                              | 4
                                              | -1,
                                          },
                                        });
                                    }}
                                  >
                                    <option value="1">{t("First")}</option>
                                    <option value="2">{t("Second")}</option>
                                    <option value="3">{t("Third")}</option>
                                    <option value="4">{t("Fourth")}</option>
                                    <option value="-1">{t("Last")}</option>
                                  </select>
                                </label>
                                <label>
                                  {t("Weekday")}
                                  <select
                                    value={task.rule.selector.weekday}
                                    onChange={(e) => {
                                      const rule = task.rule;
                                      if (
                                        rule &&
                                        "selector" in rule &&
                                        rule.selector.kind === "ordinal"
                                      )
                                        setRule({
                                          selector: {
                                            ...rule.selector,
                                            weekday:
                                              e.target.value === "weekday"
                                                ? "weekday"
                                                : Number(e.target.value),
                                          },
                                        });
                                    }}
                                  >
                                    <option value="weekday">
                                      {t("Weekday (Mon\u2013Fri)")}
                                    </option>
                                    {[
                                      "Monday",
                                      "Tuesday",
                                      "Wednesday",
                                      "Thursday",
                                      "Friday",
                                      "Saturday",
                                      "Sunday",
                                    ].map((label, i) => (
                                      <option key={label} value={i + 1}>
                                        {t(label)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            )}
                            <label>
                              {t("Dates missing from shorter months")}
                              <select
                                value={task.rule.invalidDate}
                                onChange={(e) =>
                                  setRule({
                                    invalidDate: e.target.value as
                                      | "clamp"
                                      | "skip",
                                  })
                                }
                              >
                                <option value="clamp">
                                  {t("Use the last available day")}
                                </option>
                                <option value="skip">
                                  {t("Skip that month")}
                                </option>
                              </select>
                            </label>
                          </>
                        )}
                        <label>
                          {t("Ends")}
                          <select
                            value={task.rule.end.kind}
                            onChange={(e) =>
                              setRule({
                                end:
                                  e.target.value === "never"
                                    ? { kind: "never" }
                                    : e.target.value === "count"
                                      ? { kind: "count", count: 10 }
                                      : {
                                          kind: "date",
                                          date: task.rule!.anchor,
                                        },
                              })
                            }
                          >
                            <option value="never">{t("Never")}</option>
                            <option value="count">
                              {t("After a number of occurrences")}
                            </option>
                            <option value="date">{t("On a date")}</option>
                          </select>
                        </label>
                        {task.rule.end.kind === "count" && (
                          <label>
                            {t("Number of occurrences")}
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              value={task.rule.end.count}
                              onChange={(e) =>
                                setRule({
                                  end: {
                                    kind: "count",
                                    count: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        )}
                        {task.rule.end.kind === "date" && (
                          <label>
                            {t("End date")}
                            <input
                              type="date"
                              value={task.rule.end.date}
                              onChange={(e) =>
                                setRule({
                                  end: { kind: "date", date: e.target.value },
                                })
                              }
                            />
                          </label>
                        )}
                      </div>
                    </details>
                    <p className="rule-preview">
                      {recurrenceText(task.rule)}
                      <br />
                      <small>
                        {t("Next dates: {v0}", {
                          v0:
                            nextDates
                              .map((day) =>
                                formatCivilDate(
                                  day,
                                  { day: "numeric", month: "short" },
                                  locale(),
                                ),
                              )
                              .join(" · ") || t("Check your repeat settings."),
                        })}
                      </small>
                    </p>
                  </>
                )}
              </fieldset>
              {!!task.rule && !!occurrence && !ruleEditable && (
                <p className="muted">
                  {t(
                    "Choose a future or series scope to change streak tracking.",
                  )}
                </p>
              )}
              <fieldset>
                <legend>{t("Task reminders")}</legend>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={task.reminders.enabled}
                    onChange={(event) =>
                      patch({
                        reminders: {
                          ...task.reminders,
                          enabled: event.target.checked,
                        },
                      })
                    }
                  />
                  {t("Remind me about this task")}
                </label>
                {task.reminders.enabled && (
                  <>
                    {(["before", "overdue"] as const).map((key) => (
                      <label className="checkbox-label" key={key}>
                        <input
                          type="checkbox"
                          checked={task.reminders[key]}
                          onChange={(event) =>
                            patch({
                              reminders: {
                                ...task.reminders,
                                [key]: event.target.checked,
                              },
                            })
                          }
                        />
                        {key === "before"
                          ? t("Before the task")
                          : t("When overdue")}
                      </label>
                    ))}
                    <p className="muted">
                      {t(
                        "Reminders arrive on your mobile devices with notifications enabled. Timing is set in Settings.",
                      )}
                    </p>
                  </>
                )}
              </fieldset>
            </div>
          )}

          {error && <p role="alert">{errorMessage(error)}</p>}
        </div>
        <footer className="row editor-footer">
          <button className="primary" disabled={saving || discarding}>
            {saving ? t("Saving\u2026") : t("Save task")}
          </button>
          <button type="button" disabled={saving} onClick={close}>
            {t("Cancel")}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
