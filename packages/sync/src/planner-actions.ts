import {
  civilDate,
  id,
  taskSchema,
  type Command,
  type Occurrence,
  type Task,
  type TaskRecord,
} from "@timely/contracts";
import { compareOccurrences, projectSeries, type Scope } from "@timely/domain";
import { occurrenceTarget, reduceRecord } from "./records";
export function editableTask(record: TaskRecord, item: Occurrence): Task {
  if (record.id !== item.definitionId)
    throw new Error("Task does not belong to this record.");
  const source = reduceRecord(record).revisions.find(
    (r) => r.id === item.revisionId,
  );
  if (!source) throw new Error("Source revision is unavailable.");
  return {
    id: record.id,
    title: item.title,
    notes: item.notes,
    priority: item.priority,
    schedule: { ...item.schedule },
    reminders: { ...item.reminders },
    rule: source.task.rule,
  };
}
export function editorCommand(
  initial: Task,
  input: Task,
  item: Occurrence | undefined,
  scope: Scope,
  currentDay: string,
): Command | null {
  const task = taskSchema.parse(input);
  if (task.id !== initial.id || (item && item.definitionId !== task.id))
    throw new Error("Mismatched task identity.");
  if (!item) return { type: "create", task };
  const patch: Partial<Omit<Task, "id">> = {};
  for (const key of [
    "title",
    "notes",
    "priority",
    "schedule",
    "reminders",
    "rule",
  ] as const)
    if (JSON.stringify(task[key]) !== JSON.stringify(initial[key]))
      Object.assign(patch, { [key]: task[key] });
  if (!Object.keys(patch).length) return null;
  const effective = !initial.rule && task.rule ? "series" : scope;
  if (effective === "occurrence" && "rule" in patch)
    throw new Error(
      "Choose this and future occurrences or the series to change recurrence.",
    );
  return {
    type: "edit",
    target: occurrenceTarget(item),
    scope: effective,
    patch,
    currentDay: civilDate.parse(currentDay),
  };
}
/** Resolve links only inside the already selected account namespace. URL owner IDs are never authority. */
export function linkedOccurrence(
  records: TaskRecord[],
  input: { occurrenceId: string; day: string; ownerId: string },
  ownerId: string,
): Occurrence | null {
  if (
    input.ownerId !== ownerId ||
    !id.safeParse(input.occurrenceId).success ||
    !civilDate.safeParse(input.day).success
  )
    return null;
  for (const record of records) {
    const series = reduceRecord(record);
    if (series.deleted) continue;
    const saved = series.exceptions[input.occurrenceId]?.value;
    if (
      saved &&
      !saved.deleted &&
      (!series.deletedFrom || saved.originalDate < series.deletedFrom)
    )
      return saved;
    const found = projectSeries(series, input.day, input.day).find(
      (item) => item.id === input.occurrenceId,
    );
    if (found) return found;
  }
  return null;
}

export function reorderCommands(
  items: Occurrence[],
  selected: Occurrence,
  direction: -1 | 1,
) {
  const siblings = items
    .filter(
      (item) =>
        item.schedule.date === selected.schedule.date &&
        item.schedule.time === null &&
        item.state === "pending",
    )
    .sort(compareOccurrences);
  const index = siblings.findIndex((item) => item.id === selected.id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= siblings.length) return [];
  [siblings[index], siblings[next]] = [siblings[next]!, siblings[index]!];
  return siblings.map((item, position) => ({
    definitionId: item.definitionId,
    command: {
      type: "order" as const,
      target: occurrenceTarget(item),
      order: String(position + 1).padStart(12, "0"),
    },
  }));
}
