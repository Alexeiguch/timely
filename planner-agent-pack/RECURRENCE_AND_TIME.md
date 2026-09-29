# Recurrence, civil time and task status

## Shared engine

Implement all behavior in `packages/domain` with injected clock and zone adapters. Server, web, native and tests must call the same functions. Core functions cover rule validation/canonicalization, range expansion, next-date preview, due-time resolution, status derivation, scoped series edits, reminder planning and progress calculation.

Dates are civil calendar dates. Times are local wall-clock times. A UTC instant is produced only when a reminder/due calculation needs one. The schedule of pending tasks follows the current device's IANA time zone; travelling keeps a 09:00 task at 09:00 local time. Terminal records retain the interpretation saved at completion/skip so historical placement is stable.

## Supported recurrence grammar

| Frequency | Required customization |
| --- | --- |
| Daily | Every N days, anchored to a start date |
| Weekly | Every N weeks, one or more selected weekdays, explicit first weekday |
| Monthly | Every N months, one or more month days; or ordinal weekday; or last weekday/last day |
| Yearly | Every N years, selected month/date or ordinal weekday within a month |

Presets: Does not repeat, Every day, Weekdays, Weekly on this day, Monthly on this date, Yearly on this date, Custom. Weekdays means Monday–Friday, not public holidays. Interval is an integer 1–999. Support an inclusive start date and one end mode: never, inclusive end date, or after N scheduled occurrences (1–10,000). Dates should work within a clearly documented supported year range, initially 1900–2100.

Monthly ordinal choices include first, second, third, fourth and last; weekdays and “weekday” mean calendar weekdays, without a holiday service. If a fifth weekday is offered, it must warn and skip months in which it does not exist. Do not label “last weekday” as “last Friday.” Selecting multiple weekdays or month days produces separate occurrences, deduplicated when choices resolve to the same valid day.

Use structured fields and a discriminated union for selectors. Monthly month-day selection, ordinal-weekday selection and last-day selection are different rule variants; do not combine incompatible variants in one ambiguous form. An internal RRULE serialization may be exported later, but must not silently inherit an RFC library's short-month skip behavior when this product requires clamping.

The count limit counts generated scheduled slots, not completions. Skips, late completion and one-off moves do not extend the rule. A series continues independently of whether previous occurrences were completed.

## Invalid-date policy

Default policy is **use the last valid day in that target month**. January 31 repeated monthly yields February 28/29, March 31 and April 30, based on the original selected day, not a progressively drifting clamped date. February 29 yearly yields February 28 in a non-leap year and February 29 in a leap year.

Warn in the editor: “Some months do not have this date. We’ll use the last day of those months.” Show the next five actual dates. Provide an advanced **Skip unavailable dates** option, but do not require choosing a policy on every save. Warnings describe the applied rule; they are not error dialogs blocking a valid recurrence.

When multiple selected month days clamp to the same actual date, emit one occurrence and make the preview reflect it. Rule counts and progress use the resulting distinct scheduled occurrences. Persist the policy in the rule, rather than reconstructing it from a locale or UI default.

## Friendly recurrence editor

Start with presets, then reveal frequency/interval, weekday/date choices and end mode. Use chips, short labels, numeric steppers/input and a plain-language summary. Examples: “Every 2 weeks on Monday and Thursday” or “On the last weekday of every month.” Localize generated summaries through the centralized copy layer.

Continuously preview the next five dates, warn about invalid dates and explain the selected end rule. Preview and production expansion use the identical engine. Preserve typed choices when switching editor controls where reasonable, and prevent accidental silent loss of selected weekdays.

## Overdue and state rules

For a pending occurrence resolve its effective civil date, effective local time/duration and current zone:

| Schedule | Due boundary | Overdue notification default |
| --- | --- | --- |
| Time + duration | Resolved start instant plus duration in elapsed minutes | Due instant + 10 minutes |
| Time only | Resolved start instant | Due instant + 10 minutes |
| No time | Start of the next local calendar day | Next local day's configured morning time, initially 09:00 |
| Duration only | Same as no time; duration is estimated effort | Same as no time |

At `now >= dueBoundary` a still-pending task is overdue. Pending before the start is upcoming; with time+duration between start and due it may be shown in progress. Completed and skipped tasks are never overdue. An untimed task has no scheduled-start reminder offset; use its configured same-day morning reminder instead.

Use next-calendar-day start, not “24 hours after today's midnight,” for untimed tasks around daylight-saving changes. Duration is elapsed minutes once the start instant has been resolved, so an overnight duration can end on the next day and a DST transition is unambiguous.

Keep due/status derivation live while a screen is open: wake at the next relevant boundary or use a modest foreground timer. Recompute on app focus, clock/zone changes and sync. Background work must not be required to make the task appear overdue when reopened.

## DST and time-zone decisions

- Spring-forward nonexistent local times: resolve to the next corresponding valid local time using a documented compatible policy (e.g. 01:30 in a one-hour gap becomes 02:30), show the adjusted time in previews for affected dates.
- Autumn repeated local times: choose the earlier matching instant unless the owner later adds a selector. Schedule one occurrence/reminder, not two.
- Detect zone changes on launch and foreground. Recompute pending instants/local notifications immediately; keep authored civil dates/times unchanged.
- Two devices in different zones resolve pending tasks in their own local zones. Server remote reminders use the recipient device's last reported zone, not a globally competing account zone.
- Offline/terminated devices may retain the last native schedule until the OS or app reconciles. Do not claim immediate guaranteed adjustment from an app that has not executed.

## Editing scopes and historical integrity

The recurring editor shows the scope chooser after the user edits and before applying:

1. **This occurrence:** write an exception/override on the selected stable occurrence. The recurrence rule remains unchanged. A move preserves source identity and the original date.
2. **This and future occurrences:** start a new effective rule/default segment at the selected logical occurrence. Keep earlier records and terminal snapshots. Regenerate affected pending future projections idempotently.
3. **Entire series — keep history:** apply metadata/default changes to the series and applicable pending occurrences. Regenerate the future schedule from the current local day; historical completed/skipped records keep their snapshots. Historical overdue pending items keep their original scheduled slots unless the user explicitly moves them. Explain this boundary in the chooser; do not invent retroactive tasks in past periods.

A recurrence change is structural and atomic with its anchor, selectors, interval, end mode and policy. Do not merge halves of two competing rules. If two devices change the rule, the latest winning structural command defines the active revision tree and invalidates obsolete derived projections. Terminal history and explicit occurrence identity mappings remain preserved.

Deleting a series offers the same relevant scopes with concrete copy. Delete one occurrence via an exclusion/tombstone so range expansion does not recreate it. Deleting this-and-future ends the active segment at the selected boundary. Entire series deletion removes its planner projections but stores sync tombstones; explain history removal before the destructive user action.

## Projection windows

Expand only a bounded requested range, maximum 366 days per call. Keep the full structured series definitions and sparse exceptions locally so future ranges can be generated offline. Persist generated occurrences when they are edited, become terminal, need stable historical capture or are required for reminder planning; do not store thousands of duplicate UI projections every time a view renders.

Missed recurring work must remain discoverable without requiring the user to visit every past date. Maintain a catch-up/materialization cursor per active series; generate due past slots incrementally from the last processed boundary and persist overdue projections in bounded pages. An account absent for a long time may need several pages. Never silently omit overdue tasks or generate an infinite loop for a never-ending rule.

## Required domain test cases

- Optional-time/duration combinations and exact due equality.
- Weekly intervals anchored across a year boundary and each first-weekday preference.
- Monthly 28/29/30/31 across leap/non-leap years without drift.
- Ordinal weekday, last weekday, selected dates colliding after clamping and skip policy.
- End date inclusivity and occurrence count independent of completion/skip.
- Europe/London spring/autumn changes, America/Montevideo and one non-hour-offset zone.
- Overnight durations, travel between zones and stable terminal snapshots.
- One-occurrence move, future split, whole-series edit and historical overdue preservation.
- Deletion/exclusion not recreated by expansion; no duplicate identity after revision mapping.
- Server/web/native fixture outputs byte-for-byte equivalent after canonical serialization.
