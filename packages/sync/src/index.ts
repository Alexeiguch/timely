import { stampSchema, type Stamp } from "@timely/contracts";
export function compare(a: Stamp, b: Stamp): number {
  return (
    a.physical - b.physical ||
    a.logical - b.logical ||
    lexical(a.deviceId, b.deviceId) ||
    lexical(a.operationId, b.operationId)
  );
}
function lexical(a: string, b: string) {
  return a === b ? 0 : a < b ? -1 : 1;
}
export type ClockState = { physical: number; logical: number; offset: number };
export function observe(clock: ClockState, remote: Stamp): ClockState {
  if (remote.physical > clock.physical)
    return { ...clock, physical: remote.physical, logical: remote.logical };
  if (remote.physical === clock.physical)
    return { ...clock, logical: Math.max(clock.logical, remote.logical) };
  return clock;
}
export function tick(
  clock: ClockState,
  now: number,
  deviceId: string,
  operationId: string,
): { clock: ClockState; stamp: Stamp } {
  let physical = Math.max(Math.round(now + clock.offset), clock.physical);
  let logical = physical === clock.physical ? clock.logical + 1 : 0;
  if (logical > 2147483647) {
    physical++;
    logical = 0;
  }
  const stamp = stampSchema.parse({ physical, logical, deviceId, operationId });
  return { clock: { ...clock, physical, logical }, stamp };
}
/** Run once for a new operation; the durable dedupe row stores this canonical value. */
export function canonicalStamp(stamp: Stamp, receivedAt: number): Stamp {
  const parsed = stampSchema.parse(stamp);
  return {
    ...parsed,
    physical: Math.min(parsed.physical, receivedAt + 300000),
  };
}
export function calibrate(
  clock: ClockState,
  sentAt: number,
  receivedAt: number,
  serverTime: number,
): ClockState {
  if (receivedAt < sentAt || receivedAt - sentAt > 10000) return clock;
  return {
    ...clock,
    offset: Math.round(serverTime - (sentAt + receivedAt) / 2),
  };
}
export type Stamped<T> = { value: T; stamp: Stamp };
export function winner<T>(
  local: Stamped<T> | undefined,
  incoming: Stamped<T>,
): Stamped<T> {
  return !local || compare(incoming.stamp, local.stamp) > 0 ? incoming : local;
}
export type GroupedRecord = {
  groups: Record<string, Stamped<unknown>>;
  deletion?: Stamped<boolean>;
};
export function mergeGroups(
  current: GroupedRecord,
  incoming: GroupedRecord,
  intent: "edit" | "delete" | "restore" = "edit",
): GroupedRecord {
  const groups = { ...current.groups };
  for (const [key, value] of Object.entries(incoming.groups))
    groups[key] = winner(groups[key], value);
  let deletion = current.deletion;
  if (
    incoming.deletion &&
    intent !== "edit" &&
    incoming.deletion.value === (intent === "delete")
  )
    deletion = winner(deletion, incoming.deletion);
  return { ...current, groups, ...(deletion ? { deletion } : {}) };
}
export function retryDelay(
  attempt: number,
  random: () => number = Math.random,
) {
  return Math.round(
    Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)) * (0.75 + random() * 0.5),
  );
}
export * from "./records";
export * from "./engine";
export * from "./planner-actions";

export * from "./preferences";
export * from "./recovery";
export * from "./account";
export * from "./history";
export * from "./reminders";
export * from "./local-state";

export * from "./streaks";
