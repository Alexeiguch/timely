# Stage 02 — shared task, recurrence and time behavior

## Goal and dependencies

Implement the canonical business model once, with no dependency on React, SQL or notification SDKs. Stage 01 supplies package/test boundaries. Read [product](../PRODUCT_SPEC.md), [data model](../DATA_MODEL.md), [recurrence/time](../RECURRENCE_AND_TIME.md), [sync](../OFFLINE_SYNC.md) and [notifications](../NOTIFICATIONS.md).

## Implement

1. Define validated DTOs, identifiers, task fields, atomic field groups, occurrence overrides and protocol version in `packages/contracts`.
2. Implement pure use cases for creation, edit, state transitions, skip/unskip, reschedule, exclusion/delete and scoped recurring edits. Task date is required; time, duration, priority and notes are optional.
3. Select and document a civil-time adapter with IANA zone support that works in Node, web and Hermes. Prove date/time/DST behavior with fixtures before expanding UI. Keep clocks and zones injectable.
4. Implement recurrence canonicalization, interval anchors, selectors, finite range expansion, count/end-date behavior, invalid-date clamp/skip policy, next-five preview and human-readable summary.
5. Design deterministic occurrence slot IDs and immutable recurrence revisions. Implement revision transitions/mapping and old-projection invalidation so exceptions, terminal history and one-occurrence moves survive edits.
6. Implement effective inherited/cleared/overridden fields, due-boundary/status computation, overdue catch-up and progress metrics.
7. Implement pure reminder planning for timed/untimed tasks, offsets, expiry and schedule fingerprints; SDK scheduling remains an adapter concern.
8. Implement the deterministic change stamp/group comparison module and invariant validation used by local and server merges.

Document exact scope semantics in a short decision record, including the selected occurrence mapping and preservation of overdue past slots on whole-series edits. New future rule revisions must not fabricate historic missed work. An old revision cannot regenerate deleted/superseded pending slots.

## Meaningful test suite

Use deterministic fixtures, injected time and zones, and the required cases in the canonical contracts. Add property-style checks where useful: range outputs are ordered/deduplicated, finite, within bounds and deterministic; completion/skip never alters future cadence; changing current zone changes instants but not authored civil fields.

Test precise due equality, all four time/duration combinations, overnight duration, London DST gap/fold, non-hour offsets, monthly 31st without drift, leap-day yearly, last weekday, multiple weekday/week interval, end counts and selected-date clamping collisions.

Test a recurrence edit concurrent with offline completion and verify retained terminal records plus no duplicate future work. Test all scopes, explicit cleared values, deletion/exclusion, reopen, and reminder invalidation. Compare serialized fixtures across Node and the chosen native runtime to reveal Intl/library differences.

## Acceptance and handoff

- One shared implementation supplies previews, planner projection, server validation and reminder planning.
- No plain UTC-date parsing is used to represent civil task dates.
- Invalid recurrence data is rejected with useful structured field errors.
- A long never-ending recurrence does not cause unbounded expansion or UI blocking.
- Progress denominators distinguish upcoming from elapsed work and exclude skips correctly.
- The fixtures and rule schema are versioned and documented for later migrations.

Record tests and actual outcomes. The next stage persists these commands and serves the same contracts through authenticated handlers.
