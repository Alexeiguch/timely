import { t } from "./core";

/** Display estimated effort without treating it as a wall-clock time. */
export function durationText(minutes: number | null): string {
  if (minutes === null) return t("No duration");
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  return [
    days ? t("{v0} d", { v0: days }) : "",
    hours ? t("{v0} h", { v0: hours }) : "",
    remainder ? t("{v0} min", { v0: remainder }) : "",
  ]
    .filter(Boolean)
    .join(" ");
}
