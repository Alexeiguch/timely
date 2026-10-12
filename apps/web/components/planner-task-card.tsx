import { t, locale } from "@timely/i18n";
import { useLanguage } from "./language-state";
import {
  Check,
  Pencil,
  RotateCcw,
  SkipForward,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { addDays, status, type Streak } from "@timely/domain";
import type { Occurrence } from "@timely/contracts";
import { StreakIndicator } from "./streak-indicator";
type Props = {
  item: Occurrence;
  streak?: Streak;
  zone: string;
  now: number;
  currentDay: string;
  reviewing: boolean;
  action: (work: () => Promise<unknown>) => Promise<void>;
  transition: (item: Occurrence, value: Occurrence["state"]) => Promise<void>;
  move: (item: Occurrence, day: string) => Promise<void>;
  edit: (item: Occurrence) => void;
  reorder: (item: Occurrence, direction: -1 | 1) => Promise<unknown>;
  chooseMove: (item: Occurrence) => void;
  chooseDelete: (item: Occurrence) => void;
};
export function PlannerTaskCard({
  item,
  streak,
  zone,
  now,
  currentDay,
  reviewing,
  action,
  transition,
  move,
  edit,
  reorder,
  chooseMove,
  chooseDelete,
}: Props) {
  useLanguage();
  const state = status(item, zone, now);
  return (
    <article
      className={`task-card ${state === "overdue" ? "overdue" : ""}`}
      data-task-id={item.id}
      draggable={item.state === "pending"}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-timely-occurrence", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <button
        className="complete-button"
        role="checkbox"
        aria-checked={item.state === "completed"}
        aria-label={t("Complete {v0}", { v0: item.title })}
        onClick={() =>
          void action(() =>
            transition(
              item,
              item.state === "completed" ? "pending" : "completed",
            ),
          )
        }
      >
        {item.state === "completed" ? (
          <Check size={22} />
        ) : (
          <span className="check-circle" />
        )}
      </button>
      <div className="task-content">
        <div className="task-meta">
          {reviewing && <span>{item.schedule.date}</span>}
          {item.originalDate !== item.schedule.date && (
            <span>{t("Moved from {v0}", { v0: item.originalDate })}</span>
          )}
          {item.terminal && (
            <span>
              {item.terminal.state === "completed"
                ? t("Completed")
                : t("Skipped")}{" "}
              {new Date(item.terminal.at).toLocaleString(locale())}
            </span>
          )}
          <span>
            {item.schedule.time ?? t("Any time")}
            {item.schedule.duration
              ? t(" \u00B7 {v0} min", { v0: item.schedule.duration })
              : ""}
          </span>
          {item.priority && (
            <span className={`priority ${item.priority}`}>
              {t("{v0} priority", { v0: t(item.priority) })}
            </span>
          )}
          {state === "overdue" && (
            <span className="overdue-label">{t("Overdue")}</span>
          )}
          {item.state === "skipped" && <span>{t("Skipped")}</span>}
        </div>
        <h3>{item.title}</h3>
        {item.notes && <p className="task-notes">{item.notes}</p>}
        <StreakIndicator item={item} streak={streak} zone={zone} now={now} />
        <div className="task-actions">
          <button
            aria-label={t("Edit {v0}", { v0: item.title })}
            onClick={() => edit(item)}
          >
            <Pencil size={15} />
            {t("Edit")}
          </button>
          {(!item.streak || item.state === "skipped") && (
            <button
              onClick={() =>
                void action(() =>
                  transition(
                    item,
                    item.state === "skipped" ? "pending" : "skipped",
                  ),
                )
              }
            >
              {item.state === "skipped" ? (
                <RotateCcw size={15} />
              ) : (
                <SkipForward size={15} />
              )}{" "}
              {item.state === "skipped" ? t("Unskip") : t("Skip")}
            </button>
          )}
          <button
            onClick={() =>
              void action(() =>
                move(
                  item,
                  item.schedule.date === currentDay
                    ? addDays(currentDay, 1)
                    : currentDay,
                ),
              )
            }
          >
            <ArrowRight size={15} />{" "}
            {item.schedule.date === currentDay ? t("Tomorrow") : t("Today")}
          </button>
          <button
            aria-label={t("Move {v0} to a date", { v0: item.title })}
            onClick={() => {
              chooseMove(item);
            }}
          >
            {t("Move\u2026")}
          </button>
          {item.state === "pending" &&
            item.schedule.time === null &&
            ([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                aria-label={t("Move {v0} {v1}", {
                  v0: item.title,
                  v1: direction < 0 ? t("up") : t("down"),
                })}
                onClick={() => void reorder(item, direction)}
              >
                {direction < 0 ? t("\u2191 Up") : t("\u2193 Down")}
              </button>
            ))}
          <button
            aria-label={t("Delete {v0}", { v0: item.title })}
            onClick={() => {
              chooseDelete(item);
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
