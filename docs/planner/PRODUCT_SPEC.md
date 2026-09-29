# Product specification

## Product goal

A friendly personal planner helps a person capture important tasks, understand a day at a glance, finish or move unfinished work, and see progress over weeks and months. Web, iOS and Android expose the same task behavior and share the same account. Mobile is not merely a companion viewer.

## First-release scope

- Personal accounts only, authenticated by Apple, Google or passwordless email OTP.
- Dated one-off and repeating tasks. Start time and duration are optional independently.
- Optional priorities: unset, low, medium, high. Stable internal values have configurable display labels so later wording can become normal, important and urgent without corrupting old data.
- Complete, reopen, skip, unskip, edit, delete, move to today and move to another date.
- Friendly customizable recurrence and explicit recurring-edit scopes.
- Day, Week and Month planner modes and grouped recurring progress.
- Quick Add, Overdue, Review, Search and Settings.
- Full offline reading and editing after successful initial sign-in and data bootstrap.
- Mobile reminders before scheduled work and after it becomes overdue.
- Accessible, responsive, polished interfaces matching [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

Not in this release: shared lists, assignments, SMS, billing, attachments, calendar integrations, widgets, rich statistics or AI features. Keep architectural boundaries that permit later additions without implementing them now.

## Navigation

Use four main destinations on mobile and compact web: **Planner**, **Review**, **Search**, **Settings**. Use a bottom navigation on phones; adapt to a sidebar or compact header on desktop. Quick Add is a prominent action, not an empty fifth tab.

Inside Planner, place a visible **Day · Week · Month** segmented control above the task content. Show the selected date/range, Previous/Next buttons, a Today action, and a date picker. Horizontal swipes navigate adjacent periods on touch surfaces; buttons and keyboard alternatives provide the same capability. When switching modes, retain a focused anchor date, initially today. Define week ranges from the configured first day of the week.

## Planner modes

### Day

Use white rounded cards in a vertical list. Each card includes title, accessible completion control, optional time/duration, understated priority, recurrence hint and contextual actions. Separate unscheduled-time tasks from timed tasks when helpful. Sort timed cards by start, untimed cards by persistent manual order, with stable identity as the final tie-break. Changing priority does not unexpectedly reshuffle the list.

Show a compact Overdue section above today's tasks when viewing today. Overdue tasks retain their original date and appear as references to those occurrences, not new copies. Within an originally scheduled past day, highlight unfinished overdue cards. Completing an overdue task clears its overdue state.

Completed and skipped items remain available in a collapsed section and Review. Animate completion gently, and provide a short Undo action. Do not rely on color or motion alone to convey status.

### Week

Desktop may use seven day columns with contained rounded cards. Mobile uses a horizontally selectable day strip and readable grouped agenda, rather than squeezing seven columns into a phone. Show week progress without hiding task details. Reschedule between days by drag where usable; always provide an explicit move action.

### Month

Use a compact calendar for choosing dates and an agenda/grouped area for details. By default, a repeating task appears as one group card with a horizontally scrollable row of occurrences for the current month, status markers and a progress value. One-off tasks remain discoverable on their dates. Offer **Grouped / All occurrences**; switching representation never changes stored records.

A monthly task usually has one occurrence in a month. Show its current occurrence here and its multi-month history in Review. Do not fabricate multiple occurrences merely to make grouping look fuller.

## Creation and editing

Quick Add requires only a title. It creates a task for the focused date, or today when invoked outside Planner. Show optional details through progressive disclosure: date, time, duration, recurrence, priority, notes and Warn me. Do not require a time to add a task.

Defaults: recurrence off; priority unset; time and duration unset; Warn me off until chosen. Title is trimmed, 1–200 characters; notes are optional, up to 10,000 characters. Duration is a positive whole number of minutes, initially bounded to 10,080 (seven days), to handle overnight work without unbounded input. A task's elapsed duration can cross midnight.

Selecting Warn me exposes independent before-task and overdue toggles. Use the approved timing defaults; show exact scheduled times in a preview when possible. Permission denial preserves the task and explains how to enable reminders in Settings.

Editing recurring content and pressing Save opens **Apply changes to…** with the applicable scopes. The chooser appears before applying changes, not after an irreversible save. Completion and Skip target the selected occurrence without this chooser. Details of scope behavior live in [RECURRENCE_AND_TIME.md](RECURRENCE_AND_TIME.md).

## Task state

Persist pending, completed or skipped for each occurrence. Derive upcoming, in progress and overdue from pending state and resolved local schedule. A task remains pending even after its due time. No timer silently completes it.

Skip means deliberately omit this occurrence, clears reminders and removes it from the completion-rate denominator. Reopening a completed/skipped occurrence restores pending state; overdue is recomputed. Undo uses a new compensating edit, never deletes history or an acknowledged operation.

Move to today preserves the occurrence identity, source-series relationship and historical original date. Preserve its start time/duration unless the user edits them. If that creates an already-overdue schedule, show that fact before or immediately alongside the move; offer time adjustment. Moving one occurrence does not shift the recurrence cadence. Manual ordering and date moves are distinct operations.

## Review and progress

Review offers missed/pending overdue, completed, and skipped history, with date filters and recurrence groups. Label denominators clearly:

- **Month progress:** completed / all scheduled, non-skipped occurrences in that month, including upcoming ones.
- **Completion rate:** completed / elapsed due, non-skipped occurrences in the selected period. Future occurrences are excluded. Show an empty-state label for a zero denominator, not NaN or a misleading 0%.
- A late completion counts as completed; original planned date and completion timestamp remain available. Avoid moralizing language or punitive streaks.

Use the effective rescheduled date for current planner/progress placement and preserve original planned date for historical context. Record terminal snapshots so later time-zone changes do not rewrite the period in which historical work was completed or skipped.

## Settings and account

Expose reminder toggles and morning time, first weekday (Monday initially), automatic current-device time zone, grouped-view preference, reduced motion following system preference, account sign-in methods, sign out, account deletion and sync status. Device notification permission and delivery capability are device-specific; user preferences are synchronized.

English is the initial UI language. Keep copy in one localization-ready resource layer; do not add translation infrastructure that delays core behavior. Platform date/time formats follow user locale where available. Use device-detected IANA zones and display them readably.

## Offline experience

Show a small status: Offline, Saving locally, Syncing, Synced, or Needs attention. Saved means persisted locally; synced means acknowledged by the server. No network spinner should block access to locally stored tasks. First sign-in and first download need connectivity; unvisited/unloaded remote data cannot be promised offline.

On reconnect, automatically converge with the account's server data. Resolve same-field changes using latest-change-wins as specified; do not open manual conflict dialogs for ordinary concurrent edits. Account changes must not expose the previous user's local data.

## Representative acceptance scenarios

1. Add an untimed task for today in two actions, restart offline and find it.
2. A 10:00 task lasting 45 minutes becomes overdue at 10:45, with reminders at 09:30 and 10:55 when enabled.
3. A time-only 10:00 task becomes overdue at 10:00.
4. An untimed task becomes overdue at the start of the next local day; its overdue notification is at the next day's configured morning time.
5. A monthly task for the 31st in February warns that it uses February's last day and previews actual dates.
6. Skip one weekly occurrence without moving the next scheduled occurrence.
7. Edit only one recurring occurrence; the next occurrence retains the series defaults.
8. Complete offline on mobile, change priority on web, reconnect and retain both changes.
9. View recurring month progress, switch to All occurrences and see the same records.
10. Switch accounts on a shared browser/device without seeing the other account's tasks.
