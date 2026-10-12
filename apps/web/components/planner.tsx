"use client";
import { PlannerMonthGrid } from "./planner-month-grid";
import { PlannerSeriesList } from "./planner-series-list";
import { PlannerHistoryFilters } from "./planner-history-filters";
import { PlannerSettings } from "./planner-settings";
import { PlannerReview } from "./planner-review";
import { PlannerTaskCard } from "./planner-task-card";
import { PhraseCarousel } from "./phrase-carousel";
import { t, locale, errorMessage, type Parameters } from "@timely/i18n";
import { useLanguage } from "./language-state";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Settings,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import {
  formatCivilDate,
  addDays,
  adjacentPeriod,
  compareOccurrences,
  newTask,
  periodWindow,
  date,
  projectSeries,
  progress,
  overdueOccurrences,
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
import {
  civilDate,
  type Command,
  type Occurrence,
  type Task,
  type HistoryCursor,
} from "@timely/contracts";
import { usePlannerNavigation } from "../lib/use-planner-navigation";
import { usePlanner } from "../lib/use-planner";
import { TaskEditor } from "./task-editor";
import { ActionDialog } from "./action-dialog";
import { authClient } from "@timely/auth/client";
type Identity = {
  id: string;
  email: string;
  name: string;
};
function label(day: string, options: Intl.DateTimeFormatOptions) {
  return formatCivilDate(day, options, locale());
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
  useLanguage();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [now, setNow] = useState(Date.now());
  const currentDay = today(zone, now);
  const { selected, setSelected, mode, setMode, tab, setTab } =
    usePlannerNavigation(identity.id, currentDay);
  const [query, setQuery] = useState("");
  const month = periodWindow(currentDay, "Month");
  const [historyFrom, setHistoryFrom] = useState(month.from);
  const [historyThrough, setHistoryThrough] = useState(month.through);
  const [historyState, setHistoryState] = useState("all");
  const [historyPriority, setHistoryPriority] = useState("all");
  const [historyDefinition, setHistoryDefinition] = useState<
    string | undefined
  >();
  const [remoteHistory, setRemoteHistory] = useState<Occurrence[] | null>(null);
  const [historyCursor, setHistoryCursor] = useState<HistoryCursor | null>(
    null,
  );
  const [historyBusy, setHistoryBusy] = useState(false);
  const [editor, setEditor] = useState<{
    task: Task;
    occurrence?: Occurrence;
  } | null>(null);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{
    label: string;
    parameters?: Parameters;
    definitionId: string;
    command: Command;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    kind: "move" | "delete" | "account" | "discard-signout" | "discard";
    item?: Occurrence;
    definitionId?: string;
  } | null>(null);
  const [scope, setScope] = useState<"occurrence" | "future" | "series">(
    "occurrence",
  );
  const [moveDay, setMoveDay] = useState(currentDay);
  const swipe = useRef<(() => void) | null>(null);
  const consumedSwipe = useRef(false);
  useEffect(() => () => swipe.current?.(), []);
  const planner = usePlanner(identity.id);
  const { grouped, firstWeekday } = planner.preferences;
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
    const item = linkedOccurrence(
      planner.records,
      {
        occurrenceId,
        day: url.searchParams.get("date") ?? selected,
        ownerId: url.searchParams.get("ownerId") ?? "",
      },
      identity.id,
    );
    if (item) {
      setSelected(item.schedule.date);
      setMode("Day");
      setTab("Planner");
      const record = planner.records.find(
        (record) => record.id === item.definitionId,
      )!;
      setEditor({ task: editableTask(record, item), occurrence: item });
    } else
      setError(t("This linked occurrence is unavailable in your account."));
    url.searchParams.delete("occurrenceId");
    url.searchParams.delete("ownerId");
    window.history.replaceState(null, "", url);
  }, [
    planner.state?.bootstrapped,
    planner.records,
    selected,
    identity.id,
    setMode,
    setSelected,
    setTab,
  ]);
  const setGrouped = (value: boolean) =>
    void action(() => planner.setPreferences({ grouped: value }));
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const { from, through } = periodWindow(selected, mode, firstWeekday);
  const reviewing = tab === "Review" || tab === "Search";
  const historyError =
    !civilDate.safeParse(historyFrom).success ||
    !civilDate.safeParse(historyThrough).success ||
    historyFrom > historyThrough ||
    date(historyFrom).until(date(historyThrough)).days >= 366
      ? "Choose a date range of up to 366 days."
      : "";
  const projectionFrom = reviewing ? historyFrom : from,
    projectionThrough = reviewing ? historyThrough : through;
  const historyKey = JSON.stringify([
    historyFrom,
    historyThrough,
    historyState,
    historyPriority,
    historyDefinition,
    query,
    zone,
  ]);
  const currentHistoryKey = useRef(historyKey);
  currentHistoryKey.current = historyKey;
  useEffect(() => {
    setRemoteHistory(null);
    setHistoryCursor(null);
  }, [
    historyFrom,
    historyThrough,
    historyState,
    historyPriority,
    historyDefinition,
    query,
  ]);
  async function historical() {
    const requestedKey = historyKey;
    setHistoryBusy(true);
    await action(async () => {
      const result = await planner.history({
        from: historyFrom,
        through: historyThrough,
        zone,
        state: historyState as "all",
        priority: historyPriority as "all",
        query,
        definitionId: historyDefinition,
        limit: 100,
        ...(historyCursor ? { cursor: historyCursor } : {}),
      });
      if (requestedKey !== currentHistoryKey.current) return;
      setRemoteHistory((items) => [...(items ?? []), ...result.items]);
      setHistoryCursor(result.next);
    });
    setHistoryBusy(false);
  }
  const all = useMemo(
    () =>
      planner.records
        .flatMap((record) =>
          historyError && reviewing
            ? []
            : projectSeries(
                reduceRecord(record),
                projectionFrom,
                projectionThrough,
              ),
        )
        .sort(compareOccurrences),
    [
      planner.records,
      projectionFrom,
      projectionThrough,
      historyError,
      reviewing,
    ],
  );
  const overdue = useMemo(
    () =>
      overdueOccurrences(
        planner.records.map(reduceRecord),
        selected,
        mode,
        zone,
        now,
      ),
    [planner.records, selected, mode, zone, now],
  );
  const historicalItems = (remoteHistory ?? all)
    .map((item) => all.find((current) => current.id === item.id) ?? item)
    .filter(
      (item) =>
        (historyState === "all" ||
          (historyState === "overdue"
            ? status(item, zone, now) === "overdue"
            : item.state === historyState)) &&
        (historyPriority === "all" ||
          (historyPriority === "none"
            ? item.priority === null
            : item.priority === historyPriority)) &&
        (!historyDefinition || item.definitionId === historyDefinition) &&
        (!query.trim() ||
          `${item.title} ${item.notes}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())),
    );
  const totals = progress(all, zone, now);
  const elapsed = progress(all, zone, now, true);
  const blank = (): Task => newTask(crypto.randomUUID(), selected);
  async function action(work: () => Promise<unknown>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Unable to save."));
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
    setUndo({
      label:
        value === "completed"
          ? "Task completed"
          : value === "skipped"
            ? "Occurrence skipped"
            : "Task reopened",
      definitionId: item.definitionId,
      command: {
        type: "state",
        target: occurrenceTarget(item),
        state: item.state,
        terminal: item.terminal,
      },
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
  async function move(item: Occurrence, day: string) {
    civilDate.parse(day);
    await planner.save(item.definitionId, {
      type: "edit",
      target: occurrenceTarget(item),
      scope: "occurrence",
      patch: { schedule: { ...item.schedule, date: day } },
      currentDay,
    });
    setUndo({
      label: "Moved to {v0}",
      parameters: { v0: day },
      definitionId: item.definitionId,
      command: {
        type: "edit",
        target: occurrenceTarget(item),
        scope: "occurrence",
        patch: { schedule: item.schedule },
        currentDay,
      },
    });
  }
  async function signOut(discard = false) {
    await planner.prepareSignOut(discard);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      await planner.store.purge();
      localStorage.removeItem(`timely-navigation:${identity.id}`);
      onSignOut();
    } catch (error) {
      planner.resume();
      throw error;
    }
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
  function beginSwipe(x: number, y: number, pointerId: number) {
    swipe.current?.();
    consumedSwipe.current = false;
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      swipe.current?.();
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      if (Math.abs(dx) <= 60 || Math.abs(dx) <= Math.abs(dy) * 2) return;
      consumedSwipe.current = true;
      const suppressClick = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
        window.removeEventListener("click", suppressClick, true);
      };
      window.addEventListener("click", suppressClick, true);
      window.setTimeout(
        () => window.removeEventListener("click", suppressClick, true),
        400,
      );
      movePeriod(dx < 0 ? 1 : -1);
    };
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    swipe.current = () => {
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      swipe.current = null;
    };
  }
  const swipeHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, .date-picker")
      )
        return;
      beginSwipe(event.clientX, event.clientY, event.pointerId);
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (consumedSwipe.current) {
        event.preventDefault();
        event.stopPropagation();
        consumedSwipe.current = false;
      }
    },
  };
  const monthCounts = new Map<string, number>();
  for (const item of all)
    monthCounts.set(
      item.schedule.date,
      (monthCounts.get(item.schedule.date) ?? 0) + 1,
    );
  const streaks = useMemo(
    () => streakSummaries(planner.records, zone, now),
    [planner.records, zone, now],
  );
  const card = (item: Occurrence) => (
    <PlannerTaskCard
      key={item.id}
      item={item}
      streak={streaks.get(streakKey(item))}
      zone={zone}
      now={now}
      currentDay={currentDay}
      reviewing={reviewing}
      action={action}
      transition={transition}
      move={move}
      edit={edit}
      reorder={(selectedItem, direction) =>
        action(() =>
          planner.saveBatch(reorderCommands(all, selectedItem, direction)),
        )
      }
      chooseMove={(selectedItem) => {
        setMoveDay(selectedItem.schedule.date);
        setDialog({ kind: "move", item: selectedItem });
      }}
      chooseDelete={(selectedItem) => {
        setScope("occurrence");
        setDialog({ kind: "delete", item: selectedItem });
      }}
    />
  );
  const list = (items: Occurrence[]) =>
    items.length ? (
      <div className="task-list">{items.map(card)}</div>
    ) : (
      <div className="empty-state">
        <span aria-hidden="true">✳</span>
        <h3>{t("A little breathing room.")}</h3>
        <p>{t("Add something that matters to you.")}</p>
        <button onClick={() => setEditor({ task: blank() })}>
          <Plus size={18} />
          {t("Add a task")}
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
        <a className="brand" href="/" aria-label={t("Timely home")}>
          timely<span>✳</span>
        </a>
        <nav aria-label={t("Main navigation")}>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              <Icon size={22} />
              <span>{t(name)}</span>
            </button>
          ))}
        </nav>
        <PhraseCarousel />
        <small className="account-email">{identity.email}</small>
      </aside>
      <main className="planner-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{t("A LITTLE SPACE FOR WHAT MATTERS")}</p>
            <h1>
              {tab === "Planner"
                ? t("Your day, your pace.")
                : tab === "Review"
                  ? t("Look how far you\u2019ve come.")
                  : tab === "Search"
                    ? t("Find your little plans.")
                    : t("Make yourself at home.")}
            </h1>
          </div>
          <button
            className="primary add-task"
            aria-label={t("Add task")}
            onClick={() => setEditor({ task: blank() })}
          >
            <Plus size={20} /> <span>{t("Add task")}</span>
          </button>
        </header>
        <div className="sync-row" role="status">
          <span
            className={`sync-dot ${planner.syncStatus === "Synced" ? "ok" : ""}`}
          />
          {t(planner.syncStatus)}
          {planner.state?.outbox.length
            ? t(" \u00B7 {v0} pending", { v0: planner.state.outbox.length })
            : ""}
          <button onClick={() => void planner.sync(true)}>
            {t("Sync now")}
          </button>
        </div>
        {(needsSignIn || planner.message) && (
          <p className="notice">
            {needsSignIn
              ? t(
                  "You can keep planning here. Sign in to synchronize this account.",
                )
              : errorMessage(planner.message)}
            {needsSignIn && <button onClick={onSignIn}>{t("Sign in")}</button>}
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {errorMessage(error)}
          </p>
        )}
        {tab === "Planner" && (
          <>
            <section className="period-toolbar">
              <div
                className="period-control"
                role="group"
                aria-label={t("Planner view")}
              >
                {(["Day", "Week", "Month"] as const).map((value) => (
                  <button
                    aria-pressed={mode === value}
                    key={value}
                    onClick={() => setMode(value)}
                  >
                    {t(value)}
                  </button>
                ))}
              </div>
              <div className="row date-controls">
                <button
                  aria-label={t("Previous period")}
                  onClick={() => movePeriod(-1)}
                >
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => setSelected(currentDay)}>
                  {t("Today")}
                </button>
                <button
                  aria-label={t("Next period")}
                  onClick={() => movePeriod(1)}
                >
                  <ChevronRight size={20} />
                </button>
                <label className="date-picker">
                  <span className="sr-only">{t("Choose date")}</span>
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
            <div className="period-heading" {...swipeHandlers}>
              <div>
                <p className="muted">
                  {mode === "Day"
                    ? label(selected, { weekday: "long" })
                    : mode === "Week"
                      ? t("This week\u2019s little plans")
                      : t("The bigger picture")}
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
                <small>{t("little wins")}</small>
              </div>
            </div>
            {!!overdue.length && (
              <details className="overdue-section">
                <summary>
                  {t("Still on your mind")}
                  <span>{t("{v0} overdue", { v0: overdue.length })}</span>
                </summary>
                {list(overdue)}
                <small>
                  {t("Showing the past year. Older history is not loaded yet.")}
                </small>
              </details>
            )}
            {mode === "Month" && (
              <>
                <PlannerMonthGrid
                  from={from}
                  currentDay={currentDay}
                  firstWeekday={firstWeekday}
                  monthCounts={monthCounts}
                  swipeHandlers={swipeHandlers}
                  dropped={dropped}
                  onSelectDay={(day) => {
                    setSelected(day);
                    setMode("Day");
                  }}
                />
                <small className="muted">
                  {t("Highlighted dates have tasks. Swipe to change month.")}
                </small>
                <div className="row group-control">
                  <h3>{t("Your plans")}</h3>
                  <button
                    aria-pressed={grouped}
                    onClick={() => setGrouped(!grouped)}
                  >
                    {grouped ? t("Grouped") : t("All occurrences")}
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
                      {t("Completed & skipped ({v0})", {
                        v0: all.filter((item) => item.state !== "pending")
                          .length,
                      })}
                    </summary>
                    {list(all.filter((item) => item.state !== "pending"))}
                  </details>
                )}
              </>
            ) : mode === "Week" ? (
              <div className="week-agenda">
                {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(
                  (day) => (
                    <section
                      key={day}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropped(event, day)}
                    >
                      <h3>
                        {label(day, { weekday: "short", day: "numeric" })}
                      </h3>
                      {list(all.filter((item) => item.schedule.date === day))}
                    </section>
                  ),
                )}
              </div>
            ) : grouped ? (
              <PlannerSeriesList
                all={all}
                zone={zone}
                now={now}
                currentDay={currentDay}
                streaks={streaks}
                renderCard={card}
                empty={list([])}
                onSelectDay={(day) => {
                  setSelected(day);
                  setMode("Day");
                }}
              />
            ) : (
              list(all)
            )}
          </>
        )}
        {reviewing && (
          <PlannerHistoryFilters
            records={planner.records}
            historyFrom={historyFrom}
            historyThrough={historyThrough}
            historyState={historyState}
            historyPriority={historyPriority}
            historyDefinition={historyDefinition}
            historyError={historyError}
            historyBusy={historyBusy}
            onlineSnapshot={remoteHistory !== null}
            hasMore={historyCursor !== null}
            setHistoryFrom={setHistoryFrom}
            setHistoryThrough={setHistoryThrough}
            setHistoryState={setHistoryState}
            setHistoryPriority={setHistoryPriority}
            setHistoryDefinition={setHistoryDefinition}
            load={historical}
            showDownloaded={() => {
              setRemoteHistory(null);
              setHistoryCursor(null);
            }}
          />
        )}
        {tab === "Search" && (
          <>
            <label className="search-field">
              {t("Search this month")}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("A title or something in your notes")}
              />
            </label>
            <p className="muted">
              {t(
                "Searching the selected period, {v0} to {v1}. Older history search is still being connected.",
                { v0: from, v1: through },
              )}
            </p>
            {list(historicalItems)}
          </>
        )}
        {tab === "Review" && (
          <PlannerReview
            totals={totals}
            elapsed={elapsed}
            all={all}
            historyFrom={historyFrom}
            historyThrough={historyThrough}
          >
            {list(historicalItems)}
          </PlannerReview>
        )}
        {tab === "Settings" && (
          <PlannerSettings
            planner={planner}
            email={identity.email}
            zone={zone}
            action={action}
            setGrouped={setGrouped}
            onDiscard={(definitionId) =>
              setDialog({ kind: "discard", definitionId })
            }
            onDiscardSignOut={() => setDialog({ kind: "discard-signout" })}
            onDeleteAccount={() => setDialog({ kind: "account" })}
            onSignOut={signOut}
          />
        )}
      </main>
      {undo && (
        <div className="undo-notice" aria-live="polite">
          {t(undo.label, undo.parameters)}
          <button
            onClick={() =>
              void action(async () => {
                await planner.save(undo.definitionId, undo.command);
                setUndo(null);
              })
            }
          >
            {t("Undo")}
          </button>
        </div>
      )}
      {dialog && (
        <ActionDialog
          title={
            dialog.kind === "move"
              ? t("Move to a date")
              : dialog.kind === "delete"
                ? t("Delete this plan?")
                : dialog.kind === "account"
                  ? t("Delete your account permanently?")
                  : t("Discard unsynced changes?")
          }
          confirm={
            dialog.kind === "move"
              ? t("Move")
              : dialog.kind === "delete"
                ? t("Delete plan")
                : dialog.kind === "account"
                  ? t("Delete permanently")
                  : t("Discard changes")
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            if (dialog.kind === "move") await move(dialog.item!, moveDay);
            else if (dialog.kind === "delete") {
              const item = dialog.item!;
              const operation = await planner.save(item.definitionId, {
                type: "delete",
                target: occurrenceTarget(item),
                scope,
              });
              setUndo({
                label: "Plan deleted",
                definitionId: item.definitionId,
                command: {
                  type: "restore",
                  target: occurrenceTarget(item),
                  scope,
                  deletionId: operation.id,
                },
              });
            } else if (dialog.kind === "discard-signout") await signOut(true);
            else if (dialog.kind === "discard")
              await planner.discard(dialog.definitionId!);
            else {
              await planner.deleteAccount();
              await authClient.signOut();
              onSignOut();
              window.location.assign("/");
            }
          }}
        >
          {dialog.kind === "move" ? (
            <label>
              {t("New date")}
              <input
                type="date"
                value={moveDay}
                min="1900-01-01"
                max="2100-12-31"
                required
                onChange={(event) => setMoveDay(event.target.value)}
              />
            </label>
          ) : dialog.kind === "delete" ? (
            <>
              <p>
                {t(
                  "Completed and skipped history stays saved when deleting future plans.",
                )}
              </p>
              <label>
                {t("Delete scope")}
                <select
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as typeof scope)
                  }
                >
                  <option value="occurrence">{t("This occurrence")}</option>
                  <option value="future">
                    {t("This and future occurrences")}
                  </option>
                  <option value="series">{t("Entire series")}</option>
                </select>
              </label>
            </>
          ) : (
            <p>
              {dialog.kind === "account"
                ? t(
                    "All tasks, history, preferences and sign-in sessions will be deleted. Sign in again within five minutes before continuing. This device\u2019s unsynced changes will also be discarded.",
                  )
                : t(
                    "Unsynced changes will be permanently removed. Your last synchronized data will remain. Connect to finish signing out.",
                  )}
            </p>
          )}
        </ActionDialog>
      )}
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
