import type { TaskRecord } from "@timely/contracts";
import { streakSummary, type Streak } from "@timely/domain";
import { reduceRecord } from "./records";

export function streakSummaries(
  records: TaskRecord[],
  zone: string,
  now: number,
): Map<string, Streak> {
  const result = new Map<string, Streak>();
  for (const record of records) {
    const series = reduceRecord(record);
    const starts = new Set(
      [
        ...series.revisions.map((revision) => revision.task.streak?.from),
        ...Object.values(series.exceptions).map(
          (exception) => exception.value.streak?.from,
        ),
      ].filter((from): from is string => !!from),
    );
    for (const from of starts)
      result.set(
        `${record.id}/${from}`,
        streakSummary(series, from, zone, now),
      );
  }
  return result;
}
