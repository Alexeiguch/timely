import {
  taskSchema,
  civilDate,
  type Task,
  type Occurrence,
} from "@timely/contracts";
import { expand, occurrence, preview } from "./recurrence";
import { addDays } from "./time";
export type Revision = {
  id: string;
  task: Task;
  from: string;
  through: string | null;
  supersedes: string | null;
};
export type Exception = {
  value: Occurrence;
  explicit: Array<"title" | "notes" | "priority" | "schedule" | "reminders">;
};
export type Series = {
  id: string;
  revisions: Revision[];
  active: Array<{ revisionId: string; from: string; through: string | null }>;
  exceptions: Record<string, Exception>;
  aliases: Record<string, string>;
  deleted: boolean;
  deletedFrom: string | null;
};
export function createSeries(task: Task, revisionId: string): Series {
  const valid = taskSchema.parse(task);
  return {
    id: valid.id,
    revisions: [
      {
        id: revisionId,
        task: valid,
        from: valid.rule?.anchor ?? valid.schedule.date,
        through: null,
        supersedes: null,
      },
    ],
    active: [
      {
        revisionId,
        from: valid.rule?.anchor ?? valid.schedule.date,
        through: null,
      },
    ],
    exceptions: {},
    aliases: {},
    deleted: false,
    deletedFrom: null,
  };
}
function resolveAlias(series: Series, generatedId: string) {
  return series.aliases[generatedId] ?? generatedId;
}
function projected(
  series: Series,
  revision: Revision,
  from: string,
  through: string,
): Occurrence[] {
  const begin = from > revision.from ? from : revision.from;
  const end =
    revision.through && revision.through < through ? revision.through : through;
  if (begin > end) return [];
  const slots = revision.task.rule
    ? expand(revision.task.rule, begin, end)
    : revision.task.schedule.date >= begin && revision.task.schedule.date <= end
      ? [{ date: revision.task.schedule.date, key: "single" }]
      : [];
  return slots.map((slot) => {
    const item = occurrence(revision.task, revision.id, slot);
    return { ...item, id: resolveAlias(series, item.id) };
  });
}
export function projectSeries(
  series: Series,
  from: string,
  through: string,
): Occurrence[] {
  civilDate.parse(from);
  civilDate.parse(through);
  if (series.deleted) return [];
  const result = new Map<string, Occurrence>();
  for (const segment of series.active) {
    const revision = series.revisions.find((r) => r.id === segment.revisionId);
    if (!revision) throw new Error("Missing immutable revision");
    for (const generated of projected(
      series,
      { ...revision, from: segment.from, through: segment.through },
      from,
      through,
    )) {
      if (series.deletedFrom && generated.originalDate >= series.deletedFrom)
        continue;
      const preserved = Object.values(series.exceptions).find(
        (e) =>
          e.value.originalDate === generated.originalDate &&
          e.value.id !== generated.id &&
          (e.value.state !== "pending" ||
            e.explicit.length > 0 ||
            e.value.deleted),
      );
      if (preserved) continue;
      const exception = series.exceptions[generated.id];
      // An exception moved outside this window must hide its original projection.
      const item = exception?.value ?? generated;
      if (
        !item.deleted &&
        (!series.deletedFrom || item.originalDate < series.deletedFrom) &&
        item.schedule.date >= from &&
        item.schedule.date <= through
      )
        result.set(item.id, item);
    }
  }
  // Moved exceptions and terminal history remain queryable outside their source segment.
  for (const exception of Object.values(series.exceptions)) {
    const item = exception.value;
    if (
      !item.deleted &&
      (!series.deletedFrom || item.originalDate < series.deletedFrom) &&
      item.schedule.date >= from &&
      item.schedule.date <= through
    )
      result.set(item.id, item);
  }
  return [...result.values()].sort(
    (a, b) =>
      a.schedule.date.localeCompare(b.schedule.date) ||
      a.id.localeCompare(b.id),
  );
}
export function saveException(
  series: Series,
  value: Occurrence,
  explicit: Exception["explicit"] = [],
): Series {
  if (value.definitionId !== series.id)
    throw new Error("Occurrence does not belong to this series");
  const old = series.exceptions[value.id];
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [value.id]: {
        value,
        explicit: [...new Set([...(old?.explicit ?? []), ...explicit])],
      },
    },
  };
}
export type Scope = "occurrence" | "future" | "series";
/** Call only after the user chooses scope. Revisions are retained unchanged for history. */
export function editSeries(
  series: Series,
  selected: Occurrence,
  input: Task,
  scope: Scope,
  revisionId: string,
  currentDay: string,
): Series {
  const task = taskSchema.parse(input);
  civilDate.parse(currentDay);
  if (task.id !== series.id || selected.definitionId !== series.id)
    throw new Error("Mismatched series identity");
  if (series.deleted) throw new Error("Cannot edit a deleted series");
  if (scope === "occurrence") {
    const sourceTask = series.revisions.find((r) => r.id === selected.revisionId)?.task;
    if (JSON.stringify(task.streak) !== JSON.stringify(sourceTask?.streak))
      throw new Error("Streak tracking requires a series scope");
    if (
      JSON.stringify(task.rule) !==
      JSON.stringify(
        series.revisions.find((r) => r.id === selected.revisionId)?.task.rule,
      )
    )
      throw new Error("A recurrence rule change requires a series scope");
    return saveException(
      series,
      {
        ...selected,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        schedule: task.schedule,
        reminders: task.reminders,
      },
      ["title", "notes", "priority", "schedule", "reminders"],
    );
  }
  if (series.revisions.some((r) => r.id === revisionId)) return series; // Retried structural command.
  const boundary = scope === "future" ? selected.originalDate : currentDay;
  const active: Series["active"] = [];
  for (const segment of series.active) {
    if (segment.through && segment.through < boundary) {
      active.push(segment);
      continue;
    }
    if (segment.from < boundary)
      active.push({ ...segment, through: addDays(boundary, -1) });
  }
  const source = series.revisions.find(
    (r) => r.id === selected.revisionId,
  )?.task;
  const ruleChanged =
    JSON.stringify(source?.rule) !== JSON.stringify(task.rule);
  const newTask = {
    ...task,
    rule:
      task.rule && ruleChanged
        ? {
            ...task.rule,
            anchor: task.rule.anchor < boundary ? boundary : task.rule.anchor,
          }
        : task.rule,
  };
  const next: Revision = {
    id: revisionId,
    task: newTask,
    from: boundary,
    through: null,
    supersedes: selected.revisionId,
  };
  active.push({ revisionId, from: boundary, through: null });
  let result: Series = {
    ...series,
    revisions: [...series.revisions, next],
    active,
    exceptions: { ...series.exceptions },
    aliases: { ...series.aliases },
  };
  const changed = (key: keyof Task) =>
    JSON.stringify(source?.[key]) !== JSON.stringify(task[key]);
  for (const [id, exception] of Object.entries(result.exceptions)) {
    if (exception.value.state !== "pending" || exception.value.deleted)
      continue;
    if (exception.value.originalDate < boundary) continue;
    // Explicit pending exceptions survive the structural edit; retire their old generated counterparts.
    if (exception.explicit.length) {
      const value = { ...exception.value };
      for (const key of ["title", "notes", "priority", "reminders", "streak"] as const) {
        if (changed(key)) Object.assign(value, { [key]: task[key] });
      }
      result.exceptions[id] = { ...exception, value };
    } else delete result.exceptions[id];
  }
  const first = newTask.rule
    ? preview(
        newTask.rule,
        selected.originalDate > boundary ? selected.originalDate : boundary,
        1,
      )[0]
    : { date: newTask.schedule.date, key: "single" };
  if (
    first &&
    selected.state === "pending" &&
    selected.originalDate >= boundary
  ) {
    const replacement = occurrence(newTask, revisionId, first);
    result.aliases[replacement.id] = selected.id;
    result = saveException(
      result,
      { ...replacement, id: selected.id, originalDate: selected.originalDate },
      [],
    );
  }
  return result;
}
export function excludeOccurrence(
  series: Series,
  selected: Occurrence,
): Series {
  return saveException(series, { ...selected, deleted: true });
}
export function deleteSeries(
  series: Series,
  selected: Occurrence,
  scope: Scope,
): Series {
  if (scope === "occurrence") return excludeOccurrence(series, selected);
  if (scope === "series") return { ...series, deleted: true };
  // End future generation and tombstone future sparse exceptions, including moved records.
  const active = series.active
    .filter((s) => s.from < selected.originalDate)
    .map((s) => ({
      ...s,
      through:
        s.through && s.through < selected.originalDate
          ? s.through
          : addDays(selected.originalDate, -1),
    }));
  const exceptions = Object.fromEntries(
    Object.entries(series.exceptions).map(([id, e]) => [
      id,
      e.value.originalDate >= selected.originalDate
        ? { ...e, value: { ...e.value, deleted: true } }
        : e,
    ]),
  );
  return {
    ...series,
    active,
    exceptions,
    deletedFrom:
      series.deletedFrom && series.deletedFrom < selected.originalDate
        ? series.deletedFrom
        : selected.originalDate,
  };
}
