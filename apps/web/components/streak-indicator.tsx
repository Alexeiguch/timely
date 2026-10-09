import { t, locale, streakText } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { Check, Flame, X } from "lucide-react";
import type { Occurrence } from "@timely/contracts";
import {
  boundaries,
  date,
  formatCivilDate,
  streakOutcome,
  type Streak,
} from "@timely/domain";
export function StreakIndicator({
  item,
  streak,
  zone,
  now,
}: {
  item: Occurrence;
  streak?: Streak;
  zone: string;
  now: number;
}) {
  useLanguage();
  if (!item.streak || !streak) return null;
  const outcome = streakOutcome(item, zone, now);
  const due = new Intl.DateTimeFormat(locale(), {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(boundaries(item.schedule, zone).due);
  const endedOn = streak.missedDate
    ? formatCivilDate(
        streak.missedDate,
        {
          month: "short",
          day: "numeric",
        },
        locale(),
      )
    : null;
  return (
    <div
      className={`streak-indicator ${streak.ended ? "ended" : ""}`}
      aria-label={t("Current streak: {v0}", { v0: streakText(streak) })}
    >
      <div className="streak-top">
        <span className="streak-flame" aria-hidden="true">
          <Flame size={20} />
        </span>
        <strong>{streakText(streak)}</strong>
        <span className="streak-caption">
          {streak.ended ? t("A fresh start ahead") : t("Current streak")}
        </span>
      </div>
      <div
        className="streak-marks"
        aria-label={t("Recent scheduled occurrences")}
      >
        {streak.recent.map((mark) => (
          <span
            key={mark.id}
            className={`streak-mark ${t(mark.outcome)}`}
            role="img"
            aria-label={`${mark.date}: ${mark.outcome === "completed" ? t("completed before deadline") : mark.outcome === "missed" ? t("missed deadline") : t("still to do")}`}
            title={`${mark.date}: ${t(mark.outcome)}`}
          >
            {mark.outcome === "completed" ? (
              <Check size={13} aria-hidden="true" />
            ) : mark.outcome === "missed" ? (
              <X size={13} aria-hidden="true" />
            ) : (
              <span aria-hidden="true">·</span>
            )}
          </span>
        ))}
        {Array.from({ length: 7 - streak.recent.length }, (_, index) => (
          <span
            key={`empty-${index}`}
            className="streak-mark empty"
            aria-hidden="true"
          />
        ))}
      </div>
      <small>
        {outcome === "missed"
          ? t(
              "Deadline missed \u2014 the next on-time completion starts a new streak.",
            )
          : outcome === "completed"
            ? t("Completed before the deadline. Keep it going!")
            : t("{v0}Complete before {v1}.", {
                v0:
                  streak.ended && endedOn
                    ? t("Ended {v0}. ", { v0: endedOn })
                    : "",
                v1: due,
              })}
      </small>
    </div>
  );
}
