import {
  operationSchema,
  type Operation,
  type TaskRecord,
  type Target,
} from "@timely/contracts";
import {
  createSeries,
  deleteSeries,
  editSeries,
  expand,
  occurrence,
  saveException,
  type Series,
} from "@timely/domain";
import { compare } from "./index";

export class CommandError extends Error {
  constructor(
    public code: "INVALID_COMMAND" | "DEPENDENCY_MISSING" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}
export function occurrenceTarget(value: {
  id: string;
  revisionId: string;
  slot: string;
  originalDate: string;
}): Target {
  return {
    id: value.id,
    revisionId: value.revisionId,
    slot: value.slot,
    originalDate: value.originalDate,
  };
}
/** A target is evidence of an actual slot in an immutable revision, never an arbitrary supplied row. */
export function resolveTarget(series: Series, target: Target) {
  const saved = series.exceptions[target.id]?.value;
  if (
    saved &&
    saved.revisionId === target.revisionId &&
    saved.slot === target.slot &&
    saved.originalDate === target.originalDate
  )
    return saved;
  const revision = series.revisions.find((r) => r.id === target.revisionId);
  if (!revision)
    throw new CommandError(
      "DEPENDENCY_MISSING",
      "The source revision has not synchronized yet.",
    );
  const slot = revision.task.rule
    ? expand(revision.task.rule, target.originalDate, target.originalDate).find(
        (s) => s.key === target.slot,
      )
    : revision.task.schedule.date === target.originalDate &&
        target.slot === "single"
      ? { date: target.originalDate, key: "single" }
      : undefined;
  if (!slot)
    throw new CommandError(
      "INVALID_COMMAND",
      "The target is not a valid occurrence.",
    );
  const generated = occurrence(revision.task, revision.id, slot);
  const resolvedId = series.aliases[generated.id] ?? generated.id;
  if (resolvedId !== target.id)
    throw new CommandError(
      "INVALID_COMMAND",
      "The occurrence identity does not match its slot.",
    );
  return (
    series.exceptions[target.id]?.value ?? { ...generated, id: resolvedId }
  );
}
/** Replay a small per-definition journal in canonical clock order, independent of network arrival.
 * Structural dependencies are resolved before their consumers, including offline-created revisions.
 */
export function reduceRecord(record: TaskRecord): Series {
  // Undo targets one deletion, preserving later deletions and every unrelated edit.
  // Both operations remain in the journal; replay omits only the explicitly undone tombstone.
  const restored = new Set<string>();
  for (const operation of record.operations) {
    const command = operation.command;
    if (command.type !== "restore" || !command.deletionId) continue;
    const deletion = record.operations.find((o) => o.id === command.deletionId);
    if (
      !deletion ||
      deletion.command.type !== "delete" ||
      deletion.command.scope !== command.scope ||
      (["id", "revisionId", "slot", "originalDate"] as const).some(
        (key) =>
          deletion.command.type !== "delete" ||
          deletion.command.target[key] !== command.target[key],
      ) ||
      compare(operation.stamp, deletion.stamp) <= 0
    )
      throw new CommandError(
        "INVALID_COMMAND",
        "Undo must reference an earlier matching deletion.",
      );
    restored.add(deletion.id);
  }
  const creates = record.operations.filter((o) => o.command.type === "create");
  if (creates.length !== 1)
    throw new CommandError(
      "DEPENDENCY_MISSING",
      "A task needs exactly one creation operation.",
    );
  const created = creates[0]!;
  if (created.command.type !== "create") throw new Error("Unreachable");
  let series = createSeries(created.command.task, created.id);
  const pending = record.operations
    .filter((o) => o !== created)
    .sort((a, b) => compare(a.stamp, b.stamp));
  while (pending.length) {
    const index = pending.findIndex((o) => {
      const command = o.command;
      return (
        command.type !== "create" &&
        series.revisions.some((r) => r.id === command.target.revisionId)
      );
    });
    if (index < 0)
      throw new CommandError(
        "DEPENDENCY_MISSING",
        "A source revision is missing or cyclic.",
      );
    const [operation] = pending.splice(index, 1);
    const command = operation!.command;
    if (command.type === "create")
      throw new CommandError(
        "INVALID_COMMAND",
        "A task cannot be created twice.",
      );
    const selected = resolveTarget(series, command.target);
    if (
      restored.has(operation!.id) ||
      (command.type === "restore" && command.deletionId)
    )
      continue;
    if (command.type === "delete")
      series = deleteSeries(series, selected, command.scope);
    else if (command.type === "restore") {
      if (command.scope === "series")
        series = { ...series, deleted: false, deletedFrom: null };
      else series = saveException(series, { ...selected, deleted: false });
    } else if (command.type === "state") {
      series = saveException(series, {
        ...selected,
        state: command.state,
        terminal: command.terminal,
      });
    } else if (command.type === "order") {
      series = saveException(series, { ...selected, order: command.order });
    } else if (command.scope === "occurrence") {
      if ("rule" in command.patch)
        throw new CommandError(
          "INVALID_COMMAND",
          "Choose a series scope to change recurrence.",
        );
      const { rule: _, ...fields } = command.patch;
      series = saveException(
        series,
        { ...selected, ...fields },
        Object.keys(fields) as Array<
          "title" | "notes" | "priority" | "schedule" | "reminders"
        >,
      );
    } else {
      // Deletion is an independent group; ordinary edits may be retained but cannot restore it.
      const segment = series.active.find(
        (s) =>
          s.from <= selected.originalDate &&
          (!s.through || s.through >= selected.originalDate),
      );
      const source = series.revisions.find(
        (r) => r.id === (segment?.revisionId ?? selected.revisionId),
      )!;
      const deleted = series.deleted;
      series = editSeries(
        { ...series, deleted: false },
        selected,
        { ...source.task, ...command.patch },
        command.scope,
        operation!.id,
        command.currentDay,
      );
      series = { ...series, deleted };
    }
  }
  return series;
}
export function appendOperation(
  record: TaskRecord | undefined,
  input: Operation,
): TaskRecord {
  const operation = operationSchema.parse(input);
  if (record && record.id !== operation.definitionId)
    throw new CommandError("INVALID_COMMAND", "Mismatched task identity.");
  const existing = record?.operations.find((o) => o.id === operation.id);
  if (existing) return record!;
  const next = {
    id: operation.definitionId,
    operations: [...(record?.operations ?? []), operation],
  };
  reduceRecord(next);
  return next;
}
/** A valid older field edit is acknowledged rather than retried forever. */
export function isSuperseded(
  record: TaskRecord,
  operation: Operation,
): boolean {
  const command = operation.command;
  if (
    command.type === "create" ||
    (command.type === "edit" && command.scope !== "occurrence")
  )
    return false;
  const series = reduceRecord(record);
  const related = record.operations.filter((other) => {
    if (
      compare(other.stamp, operation.stamp) <= 0 ||
      other.command.type === "create"
    )
      return false;
    const candidate = other.command;
    if (command.type === "delete" || command.type === "restore")
      return (
        (candidate.type === "delete" || candidate.type === "restore") &&
        candidate.scope === command.scope &&
        (command.scope === "series" ||
          candidate.target.id === command.target.id)
      );
    if (candidate.target.id !== command.target.id) return false;
    if (command.type === "edit")
      return candidate.type === "edit" && candidate.scope === "occurrence";
    return candidate.type === command.type;
  });
  if (command.type === "edit")
    return Object.keys(command.patch).every((key) =>
      related.some(
        (other) => other.command.type === "edit" && key in other.command.patch,
      ),
    );
  return related.length > 0 || (series.deleted && command.type === "order");
}
