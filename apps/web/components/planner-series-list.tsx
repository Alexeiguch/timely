import type { ReactNode } from "react";
import { t } from "@timely/i18n";
import { useLanguage } from "./language-state";
import type { Occurrence } from "@timely/contracts";
import { date, progress, status, streakKey, type Streak } from "@timely/domain";
import { StreakIndicator } from "./streak-indicator";
export function PlannerSeriesList({
  all,
  zone,
  now,
  currentDay,
  streaks,
  renderCard,
  empty,
  onSelectDay,
}: {
  all: Occurrence[];
  zone: string;
  now: number;
  currentDay: string;
  streaks: Map<string, Streak>;
  renderCard: (item: Occurrence) => ReactNode;
  empty: ReactNode;
  onSelectDay: (day: string) => void;
}) {
  useLanguage();
  return (
    <div className="task-list">
      {Object.entries(
        all.reduce<Record<string, Occurrence[]>>((groups, item) => {
          (groups[item.definitionId] ??= []).push(item);
          return groups;
        }, {}),
      ).map(([id, items]) => {
        if (!items) return null;
        if (items.length === 1) return renderCard(items[0]!);
        const count = progress(items, zone, now);
        const streakItem =
          items.find(
            (item) =>
              item.streak &&
              item.state === "pending" &&
              item.schedule.date >= currentDay,
          ) ?? items.at(-1)!;
        return (
          <article key={id} className="series-card">
            <div className="row between">
              <h3>{items[0]!.title}</h3>
              <strong>
                {t("{v0} / {v1} completed", {
                  v0: count.completed,
                  v1: count.total,
                })}
              </strong>
            </div>
            <StreakIndicator
              item={streakItem}
              streak={streaks.get(streakKey(streakItem))}
              zone={zone}
              now={now}
            />
            <div className="occurrence-strip">
              {items.map((item) => (
                <button
                  key={item.id}
                  aria-label={t("{v0}, {v1}, {v2}. Open day", {
                    v0: item.title,
                    v1: item.schedule.date,
                    v2: t(status(item, zone, now)),
                  })}
                  onClick={() => {
                    onSelectDay(item.schedule.date);
                  }}
                >
                  <small>{date(item.schedule.date).day}</small>
                  <span>
                    {item.state === "completed"
                      ? "✓"
                      : item.state === "skipped"
                        ? "–"
                        : status(item, zone, now) === "overdue"
                          ? "!"
                          : "○"}
                  </span>
                </button>
              ))}
            </div>
          </article>
        );
      })}
      {!all.length && empty}
    </div>
  );
}
