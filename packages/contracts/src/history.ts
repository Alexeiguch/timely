import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { civilDate, id, taskFieldsSchema, zone } from "./model";
import { terminalSchema } from "./commands";
export const occurrenceSchema = taskFieldsSchema.omit({ rule: true }).extend({
  definitionId: id, revisionId: id, slot: z.string().max(100), originalDate: civilDate,
  state: z.enum(["pending", "completed", "skipped"]), terminal: terminalSchema.nullable(),
  deleted: z.boolean(), order: z.string().max(128),
}).strict();
export const historyCursorSchema = z.object({
  token: id, after: z.number().int().nonnegative(), skip: z.number().int().nonnegative().max(100000),
  signature: z.string().length(64),
}).strict();
export const historyRequestSchema = z.object({
  from: civilDate, through: civilDate, zone,
  state: z.enum(["all", "overdue", "pending", "completed", "skipped"]).default("all"),
  priority: z.enum(["all", "none", "low", "medium", "high"]).default("all"),
  query: z.string().trim().max(200).default(""),
  definitionId: id.optional(),
  limit: z.number().int().min(1).max(200).default(100),
  cursor: historyCursorSchema.optional(),
}).strict().refine((value) => value.from <= value.through &&
  Temporal.PlainDate.from(value.from).until(Temporal.PlainDate.from(value.through)).days < 366,
  "Choose a range of up to 366 days");
export const historyResponseSchema = z.object({
  items: z.array(occurrenceSchema).max(200),
  next: historyCursorSchema.nullable(), watermark: z.number().int().nonnegative(),
  evaluatedAt: z.number().int().nonnegative(),
  coverage: z.object({ from: civilDate, through: civilDate }).strict(),
}).strict();
export type HistoryRequest = z.infer<typeof historyRequestSchema>;
export type HistoryCursor = z.infer<typeof historyCursorSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
