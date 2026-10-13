import {
  dailySummarySchema,
  dailySummaryDefaults,
  type DailySummaryPolicy,
} from "@timely/contracts";
import type { LocalStore } from "./engine";
import { emptyReminders } from "./reminders";

export class DailySummarySettings {
  static async update(store: LocalStore, patch: Partial<DailySummaryPolicy>) {
    const parsed = dailySummarySchema.partial().parse(patch);
    await store.transaction((state) => {
      state.reminders ??= emptyReminders();
      state.reminders.dailySummary = {
        ...dailySummaryDefaults,
        ...state.reminders.dailySummary,
        ...parsed,
      };
      state.reminders.retry = true;
    });
  }
}
