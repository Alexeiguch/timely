import { Check, Flame, X } from "lucide-react";
import type { Occurrence } from "@timely/contracts";
import {
  boundaries,
  date,
  streakLabel,
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
  if (!item.streak || !streak) return null;
  const outcome = streakOutcome(item, zone, now);
  const due = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(boundaries(item.schedule, zone).due);
  const endedOn = streak.missedDate
    ? date(streak.missedDate).toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <div
      className={`streak-indicator ${streak.ended ? "ended" : ""}`}
      aria-label={`Current streak: ${streakLabel(streak)}`}
    >
      <div className="streak-top">
        <span className="streak-flame" aria-hidden="true">
          <Flame size={20} />
        </span>
        <strong>{streakLabel(streak)}</strong>
        <span className="streak-caption">
          {streak.ended ? "A fresh start ahead" : "Current streak"}
        </span>
      </div>
      <div className="streak-marks" aria-label="Recent scheduled occurrences">
        {streak.recent.map((mark) => (
          <span
            key={mark.id}
            className={`streak-mark ${mark.outcome}`}
            role="img"
            aria-label={`${mark.date}: ${mark.outcome === "completed" ? "completed before deadline" : mark.outcome === "missed" ? "missed deadline" : "still to do"}`}
            title={`${mark.date}: ${mark.outcome}`}
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
          ? "Deadline missed — the next on-time completion starts a new streak."
          : outcome === "completed"
            ? "Completed before the deadline. Keep it going!"
            : `${streak.ended && endedOn ? `Ended ${endedOn}. ` : ""}Complete before ${due}.`}
      </small>
    </div>
  );
}
