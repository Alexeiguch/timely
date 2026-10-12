import type { DragEvent, HTMLAttributes } from "react";
import { t, locale } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { addDays, date, formatCivilDate } from "@timely/domain";
export function PlannerMonthGrid({
  from,
  currentDay,
  firstWeekday,
  monthCounts,
  swipeHandlers,
  dropped,
  onSelectDay,
}: {
  from: string;
  currentDay: string;
  firstWeekday: number;
  monthCounts: Map<string, number>;
  swipeHandlers: HTMLAttributes<HTMLDivElement>;
  dropped: (event: DragEvent, day: string) => void;
  onSelectDay: (day: string) => void;
}) {
  useLanguage();
  return (
    <div
      className="month-grid"
      aria-label={t("Month dates")}
      {...swipeHandlers}
    >
      {Array.from(
        { length: 7 },
        (_, i) =>
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
            (firstWeekday - 1 + i) % 7
          ],
      ).map((day) => (
        <small key={day} className="weekday-label">
          {t(day)}
        </small>
      ))}
      {Array.from({ length: date(from).daysInMonth }, (_, i) => {
        const day = addDays(from, i);
        const count = monthCounts.get(day) ?? 0;
        return (
          <button
            key={day}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropped(event, day)}
            style={
              i === 0
                ? {
                    gridColumnStart:
                      ((date(from).dayOfWeek - firstWeekday + 7) % 7) + 1,
                  }
                : undefined
            }
            aria-label={t("{v0}, {v1} tasks", {
              v0: formatCivilDate(
                day,
                { day: "numeric", month: "long" },
                locale(),
              ),
              v1: count,
            })}
            className={`${day === currentDay ? "is-today" : ""}${count ? " has-tasks" : ""}`}
            onClick={() => {
              onSelectDay(day);
            }}
          >
            <b>{i + 1}</b>
            <span className={count ? "task-count" : ""} aria-hidden="true">
              {count || " "}
            </span>
          </button>
        );
      })}
    </div>
  );
}
