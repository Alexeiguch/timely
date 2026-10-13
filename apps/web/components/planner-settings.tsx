"use client";
import { useState } from "react";
import { t, locale } from "@timely/i18n";
import { RotateCcw, Undo2, LogOut, Trash2 } from "lucide-react";
import { LanguageChoice } from "./language";
import { useLanguage } from "./language-state";
import type { usePlanner } from "../lib/use-planner";
type Props = {
  planner: ReturnType<typeof usePlanner>;
  email: string;
  zone: string;
  action: (work: () => Promise<unknown>) => Promise<void>;
  setGrouped: (value: boolean) => void;
  onDiscard: (definitionId: string) => void;
  onDiscardSignOut: () => void;
  onDeleteAccount: () => void;
  onSignOut: () => Promise<void>;
};
export function PlannerSettings({
  planner,
  email,
  zone,
  action,
  setGrouped,
  onDiscard,
  onDiscardSignOut,
  onDeleteAccount,
  onSignOut,
}: Props) {
  useLanguage();
  const [remindersSaved, setRemindersSaved] = useState(false);
  const { grouped, firstWeekday } = planner.preferences;
  return (
    <section className="settings-card">
      <LanguageChoice />
      <h2>{t("Calendar preferences")}</h2>
      <p>{t("Saved on this device and synchronized with your account.")}</p>
      <label>
        {t("First day of the week")}
        <select
          aria-label={t("First day of the week")}
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
              {t(day)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Month view")}
        <select
          aria-label={t("Month view")}
          value={grouped ? "grouped" : "all"}
          onChange={(event) => setGrouped(event.target.value === "grouped")}
        >
          <option value="grouped">{t("Grouped")}</option>
          <option value="all">{t("All occurrences")}</option>
        </select>
      </label>
      <h2>{t("Reminder defaults")}</h2>
      <p>
        {t(
          "For one gentle daily summary, open Reminders in the mobile app's Settings. Each device has its own time and off switch.",
        )}
      </p>
      <p>
        {t(
          "These choices sync to mobile. This browser shows in-app overdue cues; system reminders are scheduled on mobile.",
        )}
      </p>
      <details className="disclosure">
        <summary>{t("Task reminder defaults")}</summary>
        <div className="disclosure-content">
          <form
            className="reminder-settings"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setRemindersSaved(false);
              void action(async () => {
                await planner.setPreferences({
                  reminders: {
                    before: data.has("before"),
                    overdue: data.has("overdue"),
                    beforeMinutes: Number(data.get("beforeMinutes")),
                    overdueMinutes: Number(data.get("overdueMinutes")),
                    morning: String(data.get("morning")),
                  },
                });
                setRemindersSaved(true);
              });
            }}
            key={JSON.stringify(planner.preferences)}
          >
            <div className="reminder-checkbox-row">
              <input
                id="reminder-before"
                name="before"
                type="checkbox"
                defaultChecked={planner.preferences.before}
              />
              <label htmlFor="reminder-before">{t("Before a task")}</label>
            </div>
            <div className="reminder-checkbox-row">
              <input
                id="reminder-overdue"
                name="overdue"
                type="checkbox"
                defaultChecked={planner.preferences.overdue}
              />
              <label htmlFor="reminder-overdue">{t("When overdue")}</label>
            </div>
            <label>
              {t("Minutes before a timed task")}
              <input
                name="beforeMinutes"
                type="number"
                min="0"
                max="10080"
                required
                defaultValue={planner.preferences.beforeMinutes}
              />
            </label>
            <label>
              {t("Minutes after a timed task is due")}
              <input
                name="overdueMinutes"
                type="number"
                min="0"
                max="10080"
                required
                defaultValue={planner.preferences.overdueMinutes}
              />
            </label>
            <label>
              {t("Untimed morning reminder")}
              <input
                name="morning"
                type="time"
                required
                defaultValue={planner.preferences.morning}
              />
            </label>
            <button type="submit">{t("Save reminder defaults")}</button>
          </form>
          {remindersSaved && (
            <p role="status">{t("Reminder defaults saved on this device.")}</p>
          )}
        </div>
      </details>
      <h2>{t("Your account")}</h2>
      <p>{email}</p>
      <dl>
        <dt>{t("Time zone")}</dt>
        <dd>{zone}</dd>
        <dt>{t("Saved changes waiting to sync")}</dt>
        <dd>{planner.state?.outbox.length ?? 0}</dd>
        <dt>{t("Last successful sync")}</dt>
        <dd>
          {planner.state?.lastSync
            ? new Date(planner.state.lastSync).toLocaleString(locale())
            : t("Not yet")}
        </dd>
      </dl>
      {planner.state?.outbox.some((p) => p.error) && (
        <p role="alert">
          {t("Some changes need attention. They remain saved on this device.")}
        </p>
      )}
      <div className="account-actions">
        {!!planner.state?.outbox.length && (
          <button
            type="button"
            className="account-action"
            onClick={() => void action(() => planner.retry())}
          >
            <span className="account-action-mark" aria-hidden="true">
              <RotateCcw size={18} strokeWidth={2.25} />
            </span>
            <span>{t("Retry saved changes")}</span>
          </button>
        )}
        {Array.from(
          new Set(
            planner.state?.outbox
              .filter((pending) => pending.error)
              .map((pending) => pending.operation.definitionId) ?? [],
          ),
        ).map((definitionId) => (
          <button
            key={definitionId}
            type="button"
            className="account-action warning"
            onClick={() => onDiscard(definitionId)}
          >
            <span className="account-action-mark" aria-hidden="true">
              <Undo2 size={18} strokeWidth={2.25} />
            </span>
            <span>{t("Discard this task\u2019s unsynced changes")}</span>
          </button>
        ))}
        <button
          type="button"
          className="account-action"
          onClick={() => void action(() => onSignOut())}
        >
          <span className="account-action-mark session" aria-hidden="true">
            <LogOut size={18} strokeWidth={2.25} />
          </span>
          <span>{t("Sign out")}</span>
        </button>
        {!!planner.state?.outbox.length && (
          <button
            type="button"
            className="account-action warning"
            onClick={() => onDiscardSignOut()}
          >
            <span className="account-action-mark" aria-hidden="true">
              <LogOut size={18} strokeWidth={2.25} />
            </span>
            <span>{t("Discard changes and sign out")}</span>
          </button>
        )}
      </div>
      <details className="disclosure">
        <summary>{t("Manage account")}</summary>
        <p>
          {t(
            "Deleting your account permanently removes your plans and history from every device.",
          )}
        </p>
        <div className="account-danger">
          <button
            type="button"
            className="account-action danger"
            onClick={() => onDeleteAccount()}
          >
            <span className="account-action-mark" aria-hidden="true">
              <Trash2 size={18} strokeWidth={2.25} />
            </span>
            <span>{t("Delete account")}</span>
          </button>
        </div>
      </details>
    </section>
  );
}
