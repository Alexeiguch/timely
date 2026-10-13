import { formatCivilDate } from "@timely/domain";
import { civilDate } from "@timely/contracts";
import type { ReactNode } from "react";
import { t, locale } from "@timely/i18n";
import { useLanguage } from "./language-state";
import type { Occurrence } from "@timely/contracts";
import type { progress } from "@timely/domain";
export function PlannerReview({
  totals,
  elapsed,
  all,
  historyFrom,
  historyThrough,
  children,
}: {
  totals: ReturnType<typeof progress>;
  elapsed: ReturnType<typeof progress>;
  all: Occurrence[];
  historyFrom: string;
  historyThrough: string;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <section className="review-card">
      <h2>{t("{v0} little wins", { v0: totals.completed })}</h2>
      <p>
        {t("For your selected range: {v0} to {v1}.", {
          v0: civilDate.safeParse(historyFrom).success
            ? formatCivilDate(
                historyFrom,
                { day: "numeric", month: "short", year: "numeric" },
                locale(),
              )
            : "—",
          v1: civilDate.safeParse(historyThrough).success
            ? formatCivilDate(
                historyThrough,
                { day: "numeric", month: "short", year: "numeric" },
                locale(),
              )
            : "—",
        })}
      </p>
      <div className="review-progress">
        <div className="review-meter">
          <div className="review-meter-top">
            <p>{t("Tasks completed")}</p>
            {totals.total > 0 ? (
              <strong>
                {totals.completed}
                <span> / {totals.total}</span>
              </strong>
            ) : (
              <p className="review-meter-note">
                {t("No scheduled tasks in this period.")}
              </p>
            )}
          </div>
          {totals.total > 0 && (
            <progress
              max={totals.total}
              value={totals.completed}
              aria-label={t(
                "{v0} of {v1} scheduled tasks completed, skipped excluded",
                { v0: totals.completed, v1: totals.total },
              )}
            />
          )}
        </div>
        <div className="review-meter">
          <div className="review-meter-top">
            <p>{t("Completion rate")}</p>
            {elapsed.ratio === null ? (
              <p className="review-meter-note">{t("No elapsed tasks yet")}</p>
            ) : (
              <strong>
                {Math.round(elapsed.ratio * 100)}
                <span>%</span>
              </strong>
            )}
          </div>
          {elapsed.total > 0 && (
            <progress
              max={elapsed.total}
              value={elapsed.completed}
              aria-label={t(
                "{v0} of {v1} elapsed tasks completed. Upcoming tasks are excluded.",
                { v0: elapsed.completed, v1: elapsed.total },
              )}
            />
          )}
        </div>
      </div>
      <p>
        {t("{v0} completed \u00B7 {v1} skipped \u00B7 {v2} unfinished", {
          v0: totals.completed,
          v1: all.filter((i) => i.state === "skipped").length,
          v2: all.filter((i) => i.state === "pending").length,
        })}
      </p>
      <p className="muted">
        {t("Progress reflects plans saved on this device.")}
      </p>
      <p className="muted">
        {t(
          "Skipped tasks are excluded from both totals. Upcoming tasks are excluded from the completion rate.",
        )}
      </p>
      {children}
    </section>
  );
}
