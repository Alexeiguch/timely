"use client";
import { useEffect, useRef, useState } from "react";
import {
  taskSchema,
  type Task,
  type Rule,
  type Occurrence,
} from "@timely/contracts";
import { date, preview, ruleSummary, recurrencePreset } from "@timely/domain";
type Props = {
  initial: Task;
  occurrence?: Occurrence;
  onSave: (
    task: Task,
    scope: "occurrence" | "future" | "series",
  ) => Promise<void>;
  onClose: () => void;
};
export function TaskEditor({ initial, occurrence, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [task, setTask] = useState(initial);
  const [scope, setScope] = useState<"occurrence" | "future" | "series">(
    "occurrence",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const patch = (change: Partial<Task>) =>
    setTask((value) => ({ ...value, ...change }));
  const setRule = (change: Partial<Rule>) =>
    patch({ rule: { ...task.rule!, ...change } as Rule });
  function frequency(value: string) {
    patch({
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
  const ruleEditable = !occurrence || scope !== "occurrence";
  return (
    <dialog
      ref={dialog}
      className="editor"
      onCancel={onClose}
      aria-labelledby="editor-title"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          const parsed = taskSchema.safeParse(task);
          if (!parsed.success) {
            setError(
              parsed.error.issues[0]?.message ?? "Check the task fields.",
            );
            setSaving(false);
            return;
          }
          try {
            await onSave(parsed.data, scope);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <header className="row between">
          <h2 id="editor-title">
            {occurrence ? "A little adjustment" : "Make a little plan"}
          </h2>
          <button type="button" aria-label="Close editor" onClick={onClose}>
            ×
          </button>
        </header>
        <label>
          Task title
          <input
            autoFocus
            value={task.title}
            maxLength={200}
            required
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="What would you like to do?"
          />
        </label>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              required
              value={task.schedule.date}
              onChange={(e) =>
                patch({ schedule: { ...task.schedule, date: e.target.value } })
              }
            />
          </label>
          <label>
            Start time <small>Optional</small>
            <input
              type="time"
              value={task.schedule.time ?? ""}
              onChange={(e) =>
                patch({
                  schedule: { ...task.schedule, time: e.target.value || null },
                })
              }
            />
          </label>
          <label>
            Duration in minutes
            <input
              type="number"
              min="1"
              max="10080"
              value={task.schedule.duration ?? ""}
              onChange={(e) =>
                patch({
                  schedule: {
                    ...task.schedule,
                    duration: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </label>
          <label>
            Priority
            <select
              value={task.priority ?? ""}
              onChange={(e) =>
                patch({
                  priority: (e.target.value || null) as Task["priority"],
                })
              }
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={task.notes}
            maxLength={10000}
            rows={3}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        {occurrence && initial.rule && (
          <label>
            Apply changes to
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="occurrence">Only this occurrence</option>
              <option value="future">This and future occurrences</option>
              <option value="series">Whole series from today</option>
            </select>
          </label>
        )}
        <fieldset disabled={!ruleEditable}>
          <legend>Repeat</legend>
          <label>
            Frequency
            <select
              value={task.rule?.frequency ?? "none"}
              onChange={(e) => frequency(e.target.value)}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          {task.rule && (
            <>
              <div className="form-grid">
                <label>
                  Every
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
                  Starts on
                  <input
                    type="date"
                    value={task.rule.anchor}
                    min="1900-01-01"
                    max="2100-12-31"
                    onChange={(e) => setRule({ anchor: e.target.value })}
                  />
                </label>
              </div>
              {task.rule.frequency === "weekly" && (
                <div className="chips" aria-label="Repeat weekdays">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (label, i) => {
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
                                ? rule.weekdays.filter((day) => day !== i + 1)
                                : [...rule.weekdays, i + 1],
                            })
                          }
                        >
                          {label}
                        </button>
                      );
                    },
                  )}
                </div>
              )}
              {(task.rule.frequency === "monthly" ||
                task.rule.frequency === "yearly") && (
                <>
                  {task.rule.frequency === "yearly" && (
                    <label>
                      Month
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
                    On
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
                                    days: [date(task.schedule.date).day],
                                  },
                        })
                      }
                    >
                      <option value="days">Selected days of the month</option>
                      <option value="ordinal">A weekday pattern</option>
                      <option value="last-day">The last day</option>
                    </select>
                  </label>
                  {task.rule.selector.kind === "days" && (
                    <label>
                      Days, separated by commas
                      <input
                        value={task.rule.selector.days.join(",")}
                        onChange={(e) =>
                          setRule({
                            selector: {
                              kind: "days",
                              days: e.target.value.split(",").map(Number),
                            },
                          })
                        }
                      />
                    </label>
                  )}
                  {task.rule.selector.kind === "ordinal" && (
                    <div className="form-grid">
                      <label>
                        Position
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
                                    1 | 2 | 3 | 4 | -1,
                                },
                              });
                          }}
                        >
                          <option value="1">First</option>
                          <option value="2">Second</option>
                          <option value="3">Third</option>
                          <option value="4">Fourth</option>
                          <option value="-1">Last</option>
                        </select>
                      </label>
                      <label>
                        Weekday
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
                          <option value="weekday">Weekday (Mon–Fri)</option>
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
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <label>
                    Dates missing from shorter months
                    <select
                      value={task.rule.invalidDate}
                      onChange={(e) =>
                        setRule({
                          invalidDate: e.target.value as "clamp" | "skip",
                        })
                      }
                    >
                      <option value="clamp">Use the last available day</option>
                      <option value="skip">Skip that month</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Ends
                <select
                  value={task.rule.end.kind}
                  onChange={(e) =>
                    setRule({
                      end:
                        e.target.value === "never"
                          ? { kind: "never" }
                          : e.target.value === "count"
                            ? { kind: "count", count: 10 }
                            : { kind: "date", date: task.rule!.anchor },
                    })
                  }
                >
                  <option value="never">Never</option>
                  <option value="count">After a number of occurrences</option>
                  <option value="date">On a date</option>
                </select>
              </label>
              {task.rule.end.kind === "count" && (
                <label>
                  Number of occurrences
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={task.rule.end.count}
                    onChange={(e) =>
                      setRule({
                        end: { kind: "count", count: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              )}
              {task.rule.end.kind === "date" && (
                <label>
                  End date
                  <input
                    type="date"
                    value={task.rule.end.date}
                    onChange={(e) =>
                      setRule({ end: { kind: "date", date: e.target.value } })
                    }
                  />
                </label>
              )}
              <p className="rule-preview">
                {ruleSummary(task.rule)}
                <br />
                <small>
                  Next dates:{" "}
                  {nextDates.join(" · ") || "Check your repeat settings."}
                </small>
              </p>
            </>
          )}
        </fieldset>
        <p className="muted">
          Notification delivery is still being connected. Your task and repeat
          settings are saved now.
        </p>
        {error && <p role="alert">{error}</p>}
        <footer className="row">
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save task"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </form>
    </dialog>
  );
}
