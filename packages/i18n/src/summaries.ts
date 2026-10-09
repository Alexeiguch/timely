import type { Rule } from "@timely/contracts";
import { getLanguage, t } from "./core";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
/** Presentation of an already validated rule; recurrence generation stays in domain. */
export function recurrenceText(rule: Rule): string {
  const spanish = getLanguage() === "es";
  const unit = (
    {
      daily: ["day", "days", "día", "días"],
      weekly: ["week", "weeks", "semana", "semanas"],
      monthly: ["month", "months", "mes", "meses"],
      yearly: ["year", "years", "año", "años"],
    } as const
  )[rule.frequency];
  const prefix = spanish
    ? `Cada ${rule.interval === 1 ? "" : rule.interval + " "}${unit[rule.interval === 1 ? 2 : 3]}`
    : `Every ${rule.interval === 1 ? "" : rule.interval + " "}${unit[rule.interval === 1 ? 0 : 1]}`;
  if (rule.frequency === "daily") return prefix;
  if (rule.frequency === "weekly")
    return `${prefix}${spanish ? " los " : " on "}${rule.weekdays.map((n) => t(days[n - 1]!).toLocaleLowerCase()).join(", ")}`;
  const selector = rule.selector;
  const ordinals = spanish
    ? { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", [-1]: "último" }
    : { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };
  const selected =
    selector.kind === "last-day"
      ? spanish
        ? "el último día"
        : "the last day"
      : selector.kind === "days"
        ? `${spanish ? (selector.days.length === 1 ? "el día" : "los días") : "day"} ${selector.days.join(", ")}`
        : `${spanish ? "el" : "the"} ${ordinals[selector.ordinal]} ${selector.weekday === "weekday" ? (spanish ? "día laborable" : "weekday") : t(days[selector.weekday - 1]!).toLocaleLowerCase()}`;
  return `${prefix}${spanish ? ", " : " on "}${selected}${rule.frequency === "yearly" ? (spanish ? ` de ${t(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][rule.month - 1]!).toLocaleLowerCase()}` : ` of month ${rule.month}`) : ""}`;
}
export function streakText(streak: { ended: boolean; count: number }): string {
  return streak.ended
    ? t("Streak ended")
    : streak.count
      ? t("{v0} in a row", { v0: streak.count })
      : t("Start your streak");
}
