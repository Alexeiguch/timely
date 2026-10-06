# Recurring task streaks

Owner-approved addition on 6 October 2026: use the existing task deadline, and do not allow streak tasks to be skipped.

## Behavior

- **Track a streak** is optional and initially off. It is available only for repeating tasks. Removing recurrence also turns tracking off.
- A successful occurrence is completed strictly before its deadline. Equality is late. With a time and duration, the deadline is start plus elapsed duration; with time alone it is that time; an untimed task is due at the following civil midnight. There is no separate streak deadline.
- A pending occurrence becomes a missed streak occurrence at its deadline. Late completion still finishes the task and counts toward ordinary completion progress, but cannot repair the missed streak.
- The indicator shows an active flame/count, seven recent scheduled occurrence markers, or **Streak ended** with the last missed date. The next successful occurrence starts a new run. Keep the wording friendly.
- Skip is unavailable in both clients and rejected when admitting a new command in shared sync/server code, including backdated requests targeting a stale pre-tracking revision after tracking was enabled. Accepted operations and exact retries remain replayable when delayed earlier edits arrive. Previously saved, pre-tracking skipped history retains the policy of its immutable authored revision.
- Count consecutive scheduled occurrences, not calendar days. Weekly/monthly/yearly intervals and finite ends do not invent missing daily obligations. Dates omitted by the recurrence rule are not occurrences.
- Pending occurrences whose deadlines have not passed leave the run unchanged. Ordinary future slots enter the count when their day arrives; completing tomorrow early cannot hide a missed deadline today. A future source slot moved earlier is evaluated against its effective deadline immediately.
- Use immutable source-date order. Moving changes the effective deadline and planner placement, preserving identity and cadence. Deleted occurrences are removed from the recurrence obligation; deleting future occurrences ends generation. Existing deletion/Undo semantics remain available.
- A terminal completion uses its saved schedule, completion instant and time zone. Travel or later series edits cannot rewrite whether that completion was on time. Reopen/Undo uses existing compensating state commands and recomputes the result.

## Tracking scope and persistence

Creation starts tracking at the recurrence anchor. Enabling an existing series starts from the current local day, subject to the chosen future/series edit boundary; earlier occurrences are not retroactively penalized. Tracking changes require future or series scope. Terminal historical occurrences retain their prior policy.

The optional task field `streak: { from: YYYY-MM-DD } | null` is authored in the ordinary creation/edit journal. Absence and null mean off. Do not add defaults to legacy parsed commands: their exact payload shapes and dedupe fingerprints must survive retries. Existing JSON record storage, atomic local outbox transactions, owner checks and sync ordering carry this policy; no database migration or mutable counter is required.

`packages/domain/src/streaks.ts` derives the current count and recent marks from the projected series. Expansion uses at most 366 days per window and stops once the current run and recent markers are known. Long successful runs continue across windows. `packages/sync/src/streaks.ts` prepares one read model per definition/tracking start for web and native consumers.

Backend and clients must be released together: older strict schemas cannot consume streak-enabled records. Streak verification does not satisfy outstanding sign-in, push delivery or physical-device release gates.
