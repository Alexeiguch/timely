"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Settings,
  ChartNoAxesColumnIncreasing,
  Check,
  ArrowRight,
  SkipForward,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  addDays,
  adjacentPeriod,
  compareOccurrences,
  newTask,
  periodWindow,
  date,
  projectSeries,
  progress,
  setState,
  status,
  today,
} from "@timely/domain";
import {
  occurrenceTarget,
  reduceRecord,
  editableTask,
  editorCommand,
} from "@timely/sync";
import type { Occurrence, Task, TaskRecord } from "@timely/contracts";
import { usePlanner } from "../lib/use-planner";
import { TaskEditor } from "./task-editor";
import { authClient } from "@timely/auth/client";
type Identity = { id: string; email: string; name: string };
type Mode = "Day" | "Week" | "Month";
function label(day: string, options: Intl.DateTimeFormatOptions) {
  return date(day).toLocaleString("en-GB", options);
}
export function Planner({
  identity,
  onSignOut,
  needsSignIn,
  onSignIn,
}: {
  identity: Identity;
  onSignOut: () => void;
  needsSignIn: boolean;
  onSignIn: () => void;
}) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [now, setNow] = useState(Date.now());
  const currentDay = today(zone, now);
  const [selected, setSelected] = useState(currentDay);
  const [mode, setMode] = useState<Mode>("Day");
  const [tab, setTab] = useState("Planner");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{
    task: Task;
    occurrence?: Occurrence;
  } | null>(null);
  const [error, setError] = useState("");
  const planner = usePlanner(identity.id);
  const { grouped, firstWeekday } = planner.preferences;
  const setGrouped = (value: boolean) =>
    void action(() => planner.setPreferences({ grouped: value }));
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const { from, through } = periodWindow(selected, mode, firstWeekday);
  const all = useMemo(
    () =>
      planner.records
        .flatMap((record) => projectSeries(reduceRecord(record), from, through))
        .sort(compareOccurrences),
    [planner.records, from, through],
  );
  const overdue = useMemo(
    () =>
      planner.records
        .flatMap((record) =>
          projectSeries(
            reduceRecord(record),
            addDays(currentDay, -365),
            currentDay,
          ),
        )
        .filter(
          (item) =>
            status(item, zone, now) === "overdue" && item.schedule.date < from,
        ),
    [planner.records, currentDay, from, zone, now],
  );
  const totals = progress(all, zone, now);
  const blank = (): Task => newTask(crypto.randomUUID(), selected);
  async function action(work: () => Promise<unknown>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    }
  }
  async function transition(item: Occurrence, value: Occurrence["state"]) {
    const next = setState(item, value, zone, now);
    await planner.save(item.definitionId, {
      type: "state",
      target: occurrenceTarget(item),
      state: next.state,
      terminal: next.terminal,
    });
  }
  function edit(item: Occurrence) {
    const record = planner.records.find((r) => r.id === item.definitionId)!;
    setEditor({ task: editableTask(record, item), occurrence: item });
  }
  async function saveEditor(
    task: Task,
    scope: "occurrence" | "future" | "series",
  ) {
    if (!editor) return;
    const command = editorCommand(
      editor.task,
      task,
      editor.occurrence,
      scope,
      currentDay,
    );
    if (command) await planner.save(task.id, command);
  }
  function movePeriod(direction: number) {
    setSelected(adjacentPeriod(selected, mode, direction));
  }
  function card(item: Occurrence) {
    const state = status(item, zone, now);
    return (
      <article
        className={`task-card ${state === "overdue" ? "overdue" : ""}`}
        key={item.id}
        data-task-id={item.id}
      >
        <button
          className="complete-button"
          role="checkbox"
          aria-checked={item.state === "completed"}
          aria-label={`Complete ${item.title}`}
          onClick={() =>
            void action(() =>
              transition(
                item,
                item.state === "completed" ? "pending" : "completed",
              ),
            )
          }
        >
          {item.state === "completed" ? (
            <Check size={22} />
          ) : (
            <span className="check-circle" />
          )}
        </button>
        <div className="task-content">
          <div className="task-meta">
            <span>
              {item.schedule.time ?? "Any time"}
              {item.schedule.duration ? ` · ${item.schedule.duration} min` : ""}
            </span>
            {item.priority && (
              <span className={`priority ${item.priority}`}>
                {item.priority} priority
              </span>
            )}
            {state === "overdue" && (
              <span className="overdue-label">Overdue</span>
            )}
            {item.state === "skipped" && <span>Skipped</span>}
          </div>
          <h3>{item.title}</h3>
          {item.notes && <p className="task-notes">{item.notes}</p>}
          <div className="task-actions">
            <button
              aria-label={`Edit ${item.title}`}
              onClick={() => edit(item)}
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              onClick={() =>
                void action(() =>
                  transition(
                    item,
                    item.state === "skipped" ? "pending" : "skipped",
                  ),
                )
              }
            >
              {item.state === "skipped" ? (
                <RotateCcw size={15} />
              ) : (
                <SkipForward size={15} />
              )}{" "}
              {item.state === "skipped" ? "Unskip" : "Skip"}
            </button>
            <button
              onClick={() =>
                void action(() =>
                  planner.save(item.definitionId, {
                    type: "edit",
                    target: occurrenceTarget(item),
                    scope: "occurrence",
                    patch: {
                      schedule: {
                        ...item.schedule,
                        date:
                          item.schedule.date === currentDay
                            ? addDays(currentDay, 1)
                            : currentDay,
                      },
                    },
                    currentDay,
                  }),
                )
              }
            >
              <ArrowRight size={15} />{" "}
              {item.schedule.date === currentDay ? "Tomorrow" : "Today"}
            </button>
            <button
              aria-label={`Delete ${item.title}`}
              onClick={() =>
                void action(() =>
                  planner.save(item.definitionId, {
                    type: "delete",
                    target: occurrenceTarget(item),
                    scope: "occurrence",
                  }),
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </article>
    );
  }
  const list = (items: Occurrence[]) =>
    items.length ? (
      <div className="task-list">{items.map(card)}</div>
    ) : (
      <div className="empty-state">
        <span aria-hidden="true">✳</span>
        <h3>A little breathing room.</h3>
        <p>Add something that matters to you.</p>
        <button onClick={() => setEditor({ task: blank() })}>
          <Plus size={18} /> Add a task
        </button>
      </div>
    );
  const nav = [
    { name: "Planner", icon: CalendarDays },
    { name: "Review", icon: ChartNoAxesColumnIncreasing },
    { name: "Search", icon: Search },
    { name: "Settings", icon: Settings },
  ];
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Timely home">
          timely<span>✳</span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              <Icon size={22} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span aria-hidden="true">☀</span>
          <p>
            Small steps.
            <br />A day that feels like you.
          </p>
        </div>
        <small className="account-email">{identity.email}</small>
      </aside>
      <main className="planner-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">A LITTLE SPACE FOR WHAT MATTERS</p>
            <h1>
              {tab === "Planner"
                ? "Your day, your pace."
                : tab === "Review"
                  ? "Look how far you’ve come."
                  : tab === "Search"
                    ? "Find your little plans."
                    : "Make yourself at home."}
            </h1>
          </div>
          <button
            className="primary add-task"
            aria-label="Add task"
            onClick={() => setEditor({ task: blank() })}
          >
            <Plus size={20} /> <span>Add task</span>
          </button>
        </header>
        <div className="sync-row" role="status">
          <span
            className={`sync-dot ${planner.syncStatus === "Synced" ? "ok" : ""}`}
          />
          {planner.syncStatus}
          {planner.state?.outbox.length
            ? ` · ${planner.state.outbox.length} pending`
            : ""}
          <button onClick={() => void planner.sync(true)}>Sync now</button>
        </div>
        {(needsSignIn || planner.message) && (
          <p className="notice">
            {needsSignIn
              ? "You can keep planning here. Sign in to synchronize this account."
              : planner.message}
            {needsSignIn && <button onClick={onSignIn}>Sign in</button>}
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {tab === "Planner" && (
          <>
            <section className="period-toolbar">
              <div
                className="period-control"
                role="group"
                aria-label="Planner view"
              >
                {(["Day", "Week", "Month"] as const).map((value) => (
                  <button
                    aria-pressed={mode === value}
                    key={value}
                    onClick={() => setMode(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="row date-controls">
                <button
                  aria-label="Previous period"
                  onClick={() => movePeriod(-1)}
                >
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => setSelected(currentDay)}>Today</button>
                <button aria-label="Next period" onClick={() => movePeriod(1)}>
                  <ChevronRight size={20} />
                </button>
                <label className="date-picker">
                  <span className="sr-only">Choose date</span>
                  <input
                    type="date"
                    value={selected}
                    min="1901-01-01"
                    max="2099-12-31"
                    onChange={(e) => {
                      if (e.target.value) setSelected(e.target.value);
                    }}
                  />
                </label>
              </div>
            </section>
            <div className="period-heading">
              <div>
                <p className="muted">
                  {mode === "Day"
                    ? label(selected, { weekday: "long" })
                    : mode === "Week"
                      ? "This week’s little plans"
                      : "The bigger picture"}
                </p>
                <h2>
                  {mode === "Month"
                    ? label(selected, { month: "long", year: "numeric" })
                    : mode === "Week"
                      ? `${label(from, { day: "numeric", month: "short" })} – ${label(through, { day: "numeric", month: "short" })}`
                      : label(selected, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                </h2>
              </div>
              <div className="progress-pill">
                <strong>
                  {totals.completed}
                  <span> / {totals.total}</span>
                </strong>
                <small>little wins</small>
              </div>
            </div>
            {!!overdue.length && (
              <details className="overdue-section">
                <summary>
                  Still on your mind <span>{overdue.length} overdue</span>
                </summary>
                {list(overdue)}
                <small>
                  Showing the past year. Older history is not loaded yet.
                </small>
              </details>
            )}
            {mode === "Month" && (
              <>
                <div className="month-grid" aria-label="Month dates">
                  {Array.from(
                    { length: 7 },
                    (_, i) =>
                      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                        (firstWeekday - 1 + i) % 7
                      ],
                  ).map((day) => (
                    <small key={day} className="weekday-label">
                      {day}
                    </small>
                  ))}
                  {Array.from({ length: date(from).daysInMonth }, (_, i) => {
                    const day = addDays(from, i);
                    return (
                      <button
                        key={day}
                        style={
                          i === 0
                            ? {
                                gridColumnStart:
                                  ((date(from).dayOfWeek - firstWeekday + 7) %
                                    7) +
                                  1,
                              }
                            : undefined
                        }
                        aria-label={`${label(day, { day: "numeric", month: "long" })}, ${all.filter((item) => item.schedule.date === day).length} tasks`}
                        className={day === currentDay ? "is-today" : ""}
                        onClick={() => {
                          setSelected(day);
                          setMode("Day");
                        }}
                      >
                        <b>{i + 1}</b>
                        <span>
                          {all.filter((item) => item.schedule.date === day)
                            .length
                            ? "•"
                            : " "}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="row group-control">
                  <h3>Your plans</h3>
                  <button
                    aria-pressed={grouped}
                    onClick={() => setGrouped(!grouped)}
                  >
                    {grouped ? "Grouped" : "All occurrences"}
                  </button>
                </div>
              </>
            )}
            {mode === "Day" ? (
              <>
                {list(all.filter((item) => item.state === "pending"))}
                {all.some((item) => item.state !== "pending") && (
                  <details className="finished">
                    <summary>
                      Completed & skipped (
                      {all.filter((item) => item.state !== "pending").length})
                    </summary>
                    {list(all.filter((item) => item.state !== "pending"))}
                  </details>
                )}
              </>
            ) : mode === "Week" ? (
              <div className="week-agenda">
                {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(
                  (day) => (
                    <section key={day}>
                      <h3>
                        {label(day, { weekday: "short", day: "numeric" })}
                      </h3>
                      {list(all.filter((item) => item.schedule.date === day))}
                    </section>
                  ),
                )}
              </div>
            ) : grouped ? (
              <div className="task-list">
                {Object.entries(
                  all.reduce<Record<string, Occurrence[]>>((groups, item) => {
                    (groups[item.definitionId] ??= []).push(item);
                    return groups;
                  }, {}),
                ).map(([id, items]) => {
                  if (!items) return null;
                  if (items.length === 1) return card(items[0]!);
                  const count = progress(items, zone, now);
                  return (
                    <article key={id} className="series-card">
                      <div className="row between">
                        <h3>{items[0]!.title}</h3>
                        <strong>
                          {count.completed} / {count.total} completed
                        </strong>
                      </div>
                      <div className="occurrence-strip">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            aria-label={`${item.title}, ${item.schedule.date}, ${status(item, zone, now)}. Open day`}
                            onClick={() => {
                              setSelected(item.schedule.date);
                              setMode("Day");
                            }}
                          >
                            <small>{date(item.schedule.date).day}</small>
                            <span>
                              {item.state === "completed"
                                ? "✓"
                                : item.state === "skipped"
                                  ? "–"
                                  : status(item, zone, now) === "overdue"
                                    ? "!"
                                    : "○"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {!all.length && list([])}
              </div>
            ) : (
              list(all)
            )}
          </>
        )}
        {tab === "Search" && (
          <>
            <label className="search-field">
              Search this month
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="A title or something in your notes"
              />
            </label>
            <p className="muted">
              Searching the selected period, {from} to {through}. Older history
              search is still being connected.
            </p>
            {list(
              all.filter((item) =>
                `${item.title} ${item.notes}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ),
            )}
          </>
        )}
        {tab === "Review" && (
          <section className="review-card">
            <h2>{totals.completed} little wins</h2>
            <p>
              For your selected period: {from} to {through}.
            </p>
            <progress
              max={Math.max(1, totals.total)}
              value={totals.completed}
            />
            <p>
              {totals.completed} completed ·{" "}
              {all.filter((i) => i.state === "skipped").length} skipped ·{" "}
              {all.filter((i) => i.state === "pending").length} still to come
            </p>
            <p className="muted">
              Skipped tasks are excluded from the progress total.
            </p>
            {list(all.filter((item) => item.state === "completed"))}
          </section>
        )}
        {tab === "Settings" && (
          <section className="settings-card">
            <h2>Calendar preferences</h2>
            <p>Saved on this device and synchronized with your account.</p>
            <label>
              First day of the week
              <select
                aria-label="First day of the week"
                value={firstWeekday}
                onChange={(event) =>
                  void action(() =>
                    planner.setPreferences({
                      firstWeekday: Number(event.target.value),
                    }),
                  )
                }
              >
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day, i) => (
                  <option key={day} value={i + 1}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month view
              <select
                aria-label="Month view"
                value={grouped ? "grouped" : "all"}
                onChange={(event) =>
                  setGrouped(event.target.value === "grouped")
                }
              >
                <option value="grouped">Grouped</option>
                <option value="all">All occurrences</option>
              </select>
            </label>
            <h2>Your account</h2>
            <p>{identity.email}</p>
            <dl>
              <dt>Time zone</dt>
              <dd>{zone}</dd>
              <dt>Saved changes waiting to sync</dt>
              <dd>{planner.state?.outbox.length ?? 0}</dd>
              <dt>Last successful sync</dt>
              <dd>
                {planner.state?.lastSync
                  ? new Date(planner.state.lastSync).toLocaleString()
                  : "Not yet"}
              </dd>
            </dl>
            {planner.state?.outbox.some((p) => p.error) && (
              <p role="alert">
                Some changes need attention. They remain saved on this device.
              </p>
            )}
            <button
              onClick={() =>
                void action(async () => {
                  const state = await planner.store.read();
                  if (state.outbox.length) {
                    setError(
                      "You have changes saved only on this device. Sync them before signing out.",
                    );
                    return;
                  }
                  const result = await authClient.signOut();
                  if (result.error) throw new Error(result.error.message);
                  await planner.store.purge();
                  onSignOut();
                })
              }
            >
              Sign out
            </button>
          </section>
        )}
      </main>
      {editor && (
        <TaskEditor
          initial={editor.task}
          occurrence={editor.occurrence}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
