import {
  defaults,
  preferenceOperationSchema,
  preferenceRecordSchema,
  recordSchema,
  type Preferences,
  type PreferenceOperation,
  type PreferenceRecord,
  type SyncOperation,
  type SyncRecord,
  type TaskRecord,
} from "@timely/contracts";
import { compare } from "./index";
import { appendOperation } from "./records";

export function isPreferenceRecord(
  record: SyncRecord,
): record is PreferenceRecord {
  return record.id === "preferences";
}
export function isTaskRecord(record: SyncRecord): record is TaskRecord {
  return !isPreferenceRecord(record);
}
export function isPreferenceOperation(
  operation: SyncOperation,
): operation is PreferenceOperation {
  return operation.command.type === "preferences";
}
export function appendSyncOperation(
  record: SyncRecord | undefined,
  operation: SyncOperation,
): SyncRecord {
  if (!isPreferenceOperation(operation))
    return appendOperation(
      record ? recordSchema.parse(record) : undefined,
      operation,
    );
  const parsed = preferenceOperationSchema.parse(operation);
  const current = record ? preferenceRecordSchema.parse(record) : undefined;
  if (current?.operations.some((o) => o.id === parsed.id)) return current;
  return {
    id: "preferences",
    operations: [...(current?.operations ?? []), parsed],
  };
}
export function reducePreferences(record?: PreferenceRecord): Preferences {
  const value = { ...defaults };
  for (const {
    command: { patch },
  } of [...(record?.operations ?? [])].sort((a, b) =>
    compare(a.stamp, b.stamp),
  )) {
    if (patch.firstWeekday !== undefined)
      value.firstWeekday = patch.firstWeekday;
    if (patch.grouped !== undefined) value.grouped = patch.grouped;
    if (patch.reminders) Object.assign(value, patch.reminders);
  }
  return value;
}
export function preferencesSuperseded(
  record: PreferenceRecord,
  operation: PreferenceOperation,
): boolean {
  return Object.keys(operation.command.patch).every((key) =>
    record.operations.some(
      (other) =>
        compare(other.stamp, operation.stamp) > 0 && key in other.command.patch,
    ),
  );
}
