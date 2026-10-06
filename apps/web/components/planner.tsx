"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  streakKey,
} from "@timely/domain";
import {
  occurrenceTarget,
  reduceRecord,
  streakSummaries,
  editableTask,
  editorCommand,
  linkedOccurrence,
  reorderCommands,
} from "@timely/sync";
import { civilDate, type Command, type Occurrence, type Task, type TaskRecord, type HistoryCursor } from "@timely/contracts";
import { usePlanner } from "../lib/use-planner";
import { StreakIndicator } from "./streak-indicator";
import { TaskEditor } from "./task-editor";
import { ActionDialog } from "./action-dialog";
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
  const month = periodWindow(currentDay, "Month");
  const [historyFrom, setHistoryFrom] = useState(month.from);
  const [historyThrough, setHistoryThrough] = useState(month.through);
  const [historyState, setHistoryState] = useState("all");
  const [historyPriority, setHistoryPriority] = useState("all");
  const [historyDefinition, setHistoryDefinition] = useState<string | undefined>();
  const [remoteHistory, setRemoteHistory] = useState<Occurrence[] | null>(null);
  const [historyCursor, setHistoryCursor] = useState<HistoryCursor | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [editor, setEditor] = useState<{
    task: Task;
    occurrence?: Occurrence;
  } | null>(null);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ label: string; definitionId: string; command: Command } | null>(null);
  const [dialog, setDialog] = useState<{ kind: "move" | "delete" | "account" | "discard-signout" | "discard"; item?: Occurrence; definitionId?: string } | null>(null);
  const [scope, setScope] = useState<"occurrence" | "future" | "series">("occurrence");
  const [moveDay, setMoveDay] = useState(currentDay);
  const [navigationReady, setNavigationReady] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const planner = usePlanner(identity.id);
  const { grouped, firstWeekday } = planner.preferences;
  useEffect(() => {
    const restore = () => {
      const url = new URL(window.location.href);
      let stored: { date?: string; mode?: string; tab?: string } = {};
      try { stored = JSON.parse(localStorage.getItem(`timely-navigation:${identity.id}`) ?? "{}"); } catch { /* Ignore invalid navigation only. */ }
      const day = url.searchParams.get("date") ?? stored.date;
      if (civilDate.safeParse(day).success) setSelected(day!);
      const view = url.searchParams.get("mode") ?? stored.mode;
      if (view === "Day" || view === "Week" || view === "Month") setMode(view);
      const destination = url.searchParams.get("tab") ?? stored.tab;
      if (["Planner", "Review", "Search", "Settings"].includes(destination ?? "")) setTab(destination!);
      setNavigationReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [identity.id]);
  useEffect(() => {
    if (!navigationReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", selected); url.searchParams.set("mode", mode); url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    localStorage.setItem(`timely-navigation:${identity.id}`, JSON.stringify({ date: selected, mode, tab }));
  }, [navigationReady, selected, mode, tab, identity.id]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [undo]);
  useEffect(() => {
    if (!planner.state?.bootstrapped) return;
    const url = new URL(window.location.href);
    const occurrenceId = url.searchParams.get("occurrenceId");
    if (!occurrenceId) return;
    const item = linkedOccurrence(planner.records, { occurrenceId, day: url.searchParams.get("date") ?? selected, ownerId: url.searchParams.get("ownerId") ?? "" }, identity.id);
    if (item) { setSelected(item.schedule.date); setMode("Day"); setTab("Planner"); edit(item); }
    else setError("This linked occurrence is unavailable in your account.");
    url.searchParams.delete("occurrenceId"); url.searchParams.delete("ownerId");
    window.history.replaceState(null, "", url);
  }, [planner.state?.bootstrapped]);
  const setGrouped = (value: boolean) =>
    void action(() => planner.setPreferences({ grouped: value }));
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const { from, through } = periodWindow(selected, mode, firstWeekday);
  const reviewing = tab === "Review" || tab === "Search";
  const historyError = !civilDate.safeParse(historyFrom).success || !civilDate.safeParse(historyThrough).success || historyFrom > historyThrough || date(historyFrom).until(date(historyThrough)).days >= 366 ? "Choose a date range of up to 366 days." : "";
  const projectionFrom = reviewing ? historyFrom : from, projectionThrough = reviewing ? historyThrough : through;
  const historyKey = JSON.stringify([historyFrom, historyThrough, historyState, historyPriority, historyDefinition, query, zone]);
  const currentHistoryKey = useRef(historyKey);
  currentHistoryKey.current = historyKey;
  useEffect(() => { setRemoteHistory(null); setHistoryCursor(null); }, [historyFrom, historyThrough, historyState, historyPriority, historyDefinition, query]);
  async function historical() {
    const requestedKey = historyKey;
    setHistoryBusy(true);
    await action(async () => {
      const result = await planner.history({ from: historyFrom, through: historyThrough, zone, state: historyState as "all", priority: historyPriority as "all", query, definitionId: historyDefinition, limit: 100, ...(historyCursor ? { cursor: historyCursor } : {}) });
      if (requestedKey !== currentHistoryKey.current) return;
      setRemoteHistory((items) => [...(items ?? []), ...result.items]); setHistoryCursor(result.next);
    });
    setHistoryBusy(false);
  }
  const all = useMemo(
    () =>
      planner.records
        .flatMap((record) => historyError && reviewing ? [] : projectSeries(reduceRecord(record), projectionFrom, projectionThrough))
        .sort(compareOccurrences),
    [planner.records, projectionFrom, projectionThrough, historyError, reviewing],
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
  const historicalItems = (remoteHistory ?? all).map((item) => all.find((current) => current.id === item.id) ?? item).filter((item) =>
    (historyState === "all" || (historyState === "overdue" ? status(item, zone, now) === "overdue" : item.state === historyState)) &&
    (historyPriority === "all" || (historyPriority === "none" ? item.priority === null : item.priority === historyPriority)) &&
    (!historyDefinition || item.definitionId === historyDefinition) &&
    (!query.trim() || `${item.title} ${item.notes}`.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const totals = progress(all, zone, now);
  const elapsed = progress(all, zone, now, true);
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
    setUndo({ label: value === "completed" ? "Task completed" : value === "skipped" ? "Occurrence skipped" : "Task reopened", definitionId: item.definitionId,
      command: { type: "state", target: occurrenceTarget(item), state: item.state, terminal: item.terminal } });
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
  async function move(item: Occurrence, day: string) {
    civilDate.parse(day);
    await planner.save(item.definitionId, { type: "edit", target: occurrenceTarget(item), scope: "occurrence", patch: { schedule: { ...item.schedule, date: day } }, currentDay });
    setUndo({ label: `Moved to ${day}`, definitionId: item.definitionId, command: { type: "edit", target: occurrenceTarget(item), scope: "occurrence", patch: { schedule: item.schedule }, currentDay } });
  }
  async function signOut(discard = false) {
    await planner.prepareSignOut(discard);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      await planner.store.purge();
      localStorage.removeItem(`timely-navigation:${identity.id}`);
      onSignOut();
    } catch (error) { planner.resume(); throw error; }
  }
  const dropped = (event: React.DragEvent, day: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-timely-occurrence");
    const item = all.find((item) => item.id === id);
    if (item) void action(() => move(item, day));
  };
  function movePeriod(direction: number) {
    setSelected(adjacentPeriod(selected, mode, direction));
  }
  const streaks = useMemo(() => streakSummaries(planner.records, zone, now), [planner.records, zone, now]);
  function card(item: Occurrence) {
    const state = status(item, zone, now);
    return (
      <article
        className={`task-card ${state === "overdue" ? "overdue" : ""}`}
        key={item.id}
        data-task-id={item.id}
        draggable={item.state === "pending"}
        onDragStart={(event) => { event.dataTransfer.setData("application/x-timely-occurrence", item.id); event.dataTransfer.effectAllowed = "move"; }}
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
            {reviewing && <span>{item.schedule.date}</span>}
            {item.originalDate !== item.schedule.date && <span>Moved from {item.originalDate}</span>}
            {item.terminal && <span>{item.terminal.state === "completed" ? "Completed" : "Skipped"} {new Date(item.terminal.at).toLocaleString()}</span>}
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
          <StreakIndicator item={item} streak={streaks.get(streakKey(item))} zone={zone} now={now} />
          <div className="task-actions">
            <button
              aria-label={`Edit ${item.title}`}
              onClick={() => edit(item)}
            >
              <Pencil size={15} /> Edit
            </button>
            {(!item.streak || item.state === "skipped") && <button
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
            </button>}
            <button
              onClick={() =>
                void action(() =>
                  move(item, item.schedule.date === currentDay ? addDays(currentDay, 1) : currentDay),
                )
              }
            >
              <ArrowRight size={15} />{" "}
              {item.schedule.date === currentDay ? "Tomorrow" : "Today"}
            </button>
            <button aria-label={`Move ${item.title} to a date`} onClick={() => { setMoveDay(item.schedule.date); setDialog({ kind: "move", item }); }}>Move…</button>
            {item.state === "pending" && item.schedule.time === null && ([-1, 1] as const).map((direction) => <button key={direction} aria-label={`Move ${item.title} ${direction < 0 ? "up" : "down"}`} onClick={() => void action(() => planner.saveBatch(reorderCommands(all, item, direction)))}>{direction < 0 ? "↑ Up" : "↓ Down"}</button>)}
            <button
              aria-label={`Delete ${item.title}`}
              onClick={() => { setScope("occurrence"); setDialog({ kind: "delete", item }); }}
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
            <div className="period-heading" onTouchStart={(event) => {
              const touch = event.touches[0]; if (touch) swipe.current = { x: touch.clientX, y: touch.clientY };
            }} onTouchEnd={(event) => {
              const touch = event.changedTouches[0]; const start = swipe.current; swipe.current = null;
              if (touch && start && Math.abs(touch.clientX - start.x) > 60 && Math.abs(touch.clientY - start.y) < 35) movePeriod(touch.clientX < start.x ? 1 : -1);
            }}>
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
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropped(event, day)}
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
                    <section key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropped(event, day)}>
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
                  const streakItem = items.find((item) => item.streak && item.state === "pending" && item.schedule.date >= currentDay) ?? items.at(-1)!;
                  return (
                    <article key={id} className="series-card">
                      <div className="row between">
                        <h3>{items[0]!.title}</h3>
                        <strong>
                          {count.completed} / {count.total} completed
                        </strong>
                      </div>
                      <StreakIndicator item={streakItem} streak={streaks.get(streakKey(streakItem))} zone={zone} now={now} />
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
        {reviewing && <section className="history-filters settings-card">
          <div className="form-grid">
            <label>From date<input type="date" value={historyFrom} min="1900-01-01" max="2100-12-31" onChange={(event) => setHistoryFrom(event.target.value)} /></label>
            <label>Through date<input type="date" value={historyThrough} min="1900-01-01" max="2100-12-31" onChange={(event) => setHistoryThrough(event.target.value)} /></label>
            <label>Task status<select aria-label="Task status" value={historyState} onChange={(event) => setHistoryState(event.target.value)}>{["all", "overdue", "pending", "completed", "skipped"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Priority filter<select aria-label="Priority filter" value={historyPriority} onChange={(event) => setHistoryPriority(event.target.value)}>{["all", "none", "low", "medium", "high"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Series filter<select aria-label="Series filter" value={historyDefinition ?? "all"} onChange={(event) => setHistoryDefinition(event.target.value === "all" ? undefined : event.target.value)}><option value="all">All plans</option>{planner.records.filter((record) => reduceRecord(record).revisions.some((revision) => revision.task.rule)).map((record) => <option key={record.id} value={record.id}>{reduceRecord(record).revisions.at(-1)!.task.title}</option>)}</select></label>
          </div>
          {historyError && <p role="alert">{historyError}</p>}
          <p className="muted">{remoteHistory ? "Online snapshot for this range" : "Downloaded plans are available offline. Load online history to check a fixed server snapshot."}</p>
          <button disabled={historyBusy || !!historyError || (remoteHistory !== null && historyCursor === null)} onClick={() => { void historical(); }}>{historyBusy ? "Loading…" : historyCursor ? "Load more history" : "Load online history"}</button>
          {remoteHistory && <button onClick={() => { setRemoteHistory(null); setHistoryCursor(null); }}>Return to downloaded plans</button>}
        </section>}
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
            {list(historicalItems)}
          </>
        )}
        {tab === "Review" && (
          <section className="review-card">
            <h2>{totals.completed} little wins</h2>
            <p>For your selected range: {historyFrom} to {historyThrough}.</p>
            <div className="review-progress">
              <div className="review-meter">
                <div className="review-meter-top">
                  <p>Scheduled</p>
                  {totals.total > 0 ? (
                    <strong>
                      {totals.completed}
                      <span> / {totals.total}</span>
                    </strong>
                  ) : (
                    <p className="review-meter-note">
                      No scheduled tasks in this period.
                    </p>
                  )}
                </div>
                {totals.total > 0 && (
                  <progress
                    max={totals.total}
                    value={totals.completed}
                    aria-label={`${totals.completed} of ${totals.total} scheduled tasks completed, skipped excluded`}
                  />
                )}
              </div>
              <div className="review-meter">
                <div className="review-meter-top">
                  <p>Completion rate</p>
                  {elapsed.ratio === null ? (
                    <p className="review-meter-note">No elapsed tasks yet</p>
                  ) : (
                    <strong>
                      {Math.round(elapsed.ratio * 100)}
                      <span>%</span>
                    </strong>
                  )}
                </div>
                {elapsed.total > 0 && (
                  <progress
                    max={elapsed.total}
                    value={elapsed.completed}
                    aria-label={`${elapsed.completed} of ${elapsed.total} elapsed tasks completed. Upcoming tasks are excluded.`}
                  />
                )}
              </div>
            </div>
            <p>
              {totals.completed} completed ·{" "}
              {all.filter((i) => i.state === "skipped").length} skipped ·{" "}
              {all.filter((i) => i.state === "pending").length} still to come
            </p>
            <p className="muted">
              Skipped tasks are excluded from both totals. Upcoming tasks are
              excluded from the completion rate.
            </p>
            {list(historicalItems)}
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
            <h2>Reminder defaults</h2>
            <p>These choices sync to mobile. This browser shows in-app overdue cues; system reminders are scheduled on mobile.</p>
            <form className="reminder-settings" onSubmit={(event) => {
              event.preventDefault(); const data = new FormData(event.currentTarget);
              void action(() => planner.setPreferences({ reminders: { before: data.has("before"), overdue: data.has("overdue"), beforeMinutes: Number(data.get("beforeMinutes")), overdueMinutes: Number(data.get("overdueMinutes")), morning: String(data.get("morning")) } }));
            }} key={JSON.stringify(planner.preferences)}>
              <div className="reminder-checkbox-row">
                <input name="before" type="checkbox" aria-labelledby="reminder-before-label" defaultChecked={planner.preferences.before} />
                <span id="reminder-before-label">Before a task</span>
              </div>
              <div className="reminder-checkbox-row">
                <input name="overdue" type="checkbox" aria-labelledby="reminder-overdue-label" defaultChecked={planner.preferences.overdue} />
                <span id="reminder-overdue-label">When overdue</span>
              </div>
              <label>Minutes before a timed task<input name="beforeMinutes" type="number" min="0" max="10080" required defaultValue={planner.preferences.beforeMinutes} /></label>
              <label>Minutes after a timed task is due<input name="overdueMinutes" type="number" min="0" max="10080" required defaultValue={planner.preferences.overdueMinutes} /></label>
              <label>Untimed morning reminder<input name="morning" type="time" required defaultValue={planner.preferences.morning} /></label>
              <button type="submit">Save reminder defaults</button>
            </form>
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
            <button onClick={() => void action(() => planner.retry())}>Retry saved changes</button>
            {Array.from(new Set(planner.state?.outbox.filter((pending) => pending.error).map((pending) => pending.operation.definitionId) ?? [])).map((definitionId) => <button key={definitionId} onClick={() => setDialog({ kind: "discard", definitionId })}>Discard this task’s unsynced changes</button>)}
            <button onClick={() => void action(() => signOut())}>Sign out</button>
            {!!planner.state?.outbox.length && <button onClick={() => setDialog({ kind: "discard-signout" })}>Discard changes and sign out</button>}
            <button onClick={() => setDialog({ kind: "account" })}>Delete account</button>
          </section>
        )}
      </main>
      {undo && <div className="undo-notice" aria-live="polite">{undo.label}<button onClick={() => void action(async () => { await planner.save(undo.definitionId, undo.command); setUndo(null); })}>Undo</button></div>}
      {dialog && <ActionDialog title={dialog.kind === "move" ? "Move to a date" : dialog.kind === "delete" ? "Delete this plan?" : dialog.kind === "account" ? "Delete your account permanently?" : "Discard unsynced changes?"}
        confirm={dialog.kind === "move" ? "Move" : dialog.kind === "delete" ? "Delete plan" : dialog.kind === "account" ? "Delete permanently" : "Discard changes"}
        onClose={() => setDialog(null)} onConfirm={async () => {
          if (dialog.kind === "move") await move(dialog.item!, moveDay);
          else if (dialog.kind === "delete") {
            const item = dialog.item!;
            const operation = await planner.save(item.definitionId, { type: "delete", target: occurrenceTarget(item), scope });
            setUndo({ label: "Plan deleted", definitionId: item.definitionId, command: { type: "restore", target: occurrenceTarget(item), scope, deletionId: operation.id } });
          } else if (dialog.kind === "discard-signout") await signOut(true);
          else if (dialog.kind === "discard") await planner.discard(dialog.definitionId!);
          else { await planner.deleteAccount(); await authClient.signOut(); onSignOut(); window.location.assign("/"); }
        }}>
        {dialog.kind === "move" ? <label>New date<input type="date" value={moveDay} min="1900-01-01" max="2100-12-31" required onChange={(event) => setMoveDay(event.target.value)} /></label>
          : dialog.kind === "delete" ? <><p>Completed and skipped history stays saved when deleting future plans.</p><label>Delete scope<select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="occurrence">This occurrence</option><option value="future">This and future occurrences</option><option value="series">Entire series</option></select></label></>
          : <p>{dialog.kind === "account" ? "All tasks, history, preferences and sign-in sessions will be deleted. Sign in again within five minutes before continuing. This device’s unsynced changes will also be discarded." : "Unsynced changes will be permanently removed. Your last synchronized data will remain. Connect to finish signing out."}</p>}
      </ActionDialog>}
      {editor && (
        <TaskEditor
          initial={editor.task}
          currentDay={currentDay}
          occurrence={editor.occurrence}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
