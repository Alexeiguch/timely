import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
export const PROTOCOL_VERSION = 1 as const;
export const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { try { const date = Temporal.PlainDate.from(value); return date.year >= 1900 && date.year <= 2100; } catch { return false; } }, 'Use a valid date between 1900 and 2100');
export const localTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const zone = z.string().refine(value => { try { Temporal.Now.zonedDateTimeISO(value); return true; } catch { return false; } }, 'Use an IANA time zone');
export const id = z.uuid();
export const weekday = z.number().int().min(1).max(7);
const ordinal = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]);
export const selectorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('days'), days: z.array(z.number().int().min(1).max(31)).min(1).max(31) }).strict(),
  z.object({ kind: z.literal('ordinal'), ordinal, weekday: z.union([weekday, z.literal('weekday')]) }).strict(),
  z.object({ kind: z.literal('last-day') }).strict(),
]);
const endSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('never') }).strict(), z.object({ kind: z.literal('date'), date: civilDate }).strict(), z.object({ kind: z.literal('count'), count: z.number().int().min(1).max(10000) }).strict()]);
const common = { anchor: civilDate, interval: z.number().int().min(1).max(999), end: endSchema, invalidDate: z.enum(['clamp', 'skip']) };
export const ruleSchema = z.discriminatedUnion('frequency', [
  z.object({ ...common, frequency: z.literal('daily') }).strict(),
  z.object({ ...common, frequency: z.literal('weekly'), weekdays: z.array(weekday).min(1).max(7), firstWeekday: weekday }).strict(),
  z.object({ ...common, frequency: z.literal('monthly'), selector: selectorSchema }).strict(),
  z.object({ ...common, frequency: z.literal('yearly'), month: z.number().int().min(1).max(12), selector: selectorSchema }).strict(),
]).refine(rule => rule.end.kind !== 'date' || rule.end.date >= rule.anchor, 'End date must be on or after the start');
export type Rule = z.infer<typeof ruleSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export const scheduleSchema = z.object({ date: civilDate, time: localTime.nullable(), duration: z.number().int().min(1).max(10080).nullable() }).strict();
export const reminderPolicySchema = z.object({ enabled: z.boolean(), before: z.boolean(), overdue: z.boolean() }).strict();
export const contentSchema = z.object({ title: z.string().trim().min(1).max(200), notes: z.string().max(10000), priority: z.enum(['low','medium','high']).nullable() }).strict();
export const taskSchema = contentSchema.extend({ id, schedule: scheduleSchema, reminders: reminderPolicySchema, rule: ruleSchema.nullable() }).strict();
export type Task = z.infer<typeof taskSchema>;
export const preferencesSchema = z.object({ firstWeekday: weekday, morning: localTime, beforeMinutes: z.number().int().min(0).max(10080), overdueMinutes: z.number().int().min(0).max(10080), before: z.boolean(), overdue: z.boolean(), grouped: z.boolean() }).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaults: Preferences = { firstWeekday: 1, morning: '09:00', beforeMinutes: 30, overdueMinutes: 10, before: true, overdue: true, grouped: true };
export type State = 'pending' | 'completed' | 'skipped';
export type Override<T> = { kind: 'inherit' } | { kind: 'set'; value: T };
export type TerminalSnapshot = { title: string; schedule: Task['schedule']; originalDate: string; zone: string; at: string; state: 'completed' | 'skipped' };
export type Occurrence = Omit<Task, 'rule'> & { definitionId: string; revisionId: string; slot: string; originalDate: string; state: State; terminal: TerminalSnapshot | null; deleted: boolean; order: string };
export const stampSchema = z.object({ physical: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), logical: z.number().int().nonnegative().max(2147483647), deviceId: id, operationId: id }).strict();
export type Stamp = z.infer<typeof stampSchema>;
