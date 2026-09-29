# 002 — Shared civil time, recurrence and ordering

Use `@js-temporal/polyfill` 0.5.1 across Node, browsers and Hermes. Civil date validation uses PlainDate; UTC instants are only resolved for due/reminder/audit calculations. Compatible disambiguation advances gap times and chooses the earlier fold instant. Duration adds elapsed minutes; untimed due uses the next local calendar day. Real Hermes fixture execution remains unverified, although both native bundles compile.

Rules are validated discriminated unions. Interval/end/count/selector/invalid-date policy form a complete atomic value. Bounded expansion (at most 366 requested days; supported years 1900–2100) counts distinct slots from the anchor, deduplicates clamping collisions, and does not drift the original nominal date. Preview shares the same internal scan and stops after five matches. The scan is calendar-bounded; large-account performance still needs measurement and optimization before release.

Generated occurrence UUIDs use UUIDv5 from definition UUID + revision/nominal slot. Rescheduling does not change identity. Immutable revisions and separate active segments retain prior schedules; sparse exceptions retain moved work, exclusions and terminal snapshots. Future splits map the selected replacement to its stable identity. Equivalent pending projections are suppressed when late old-revision terminal work arrives. Metadata-only edits retain cadence and remaining count. Structural edits do not generate past work before their boundary. Server atomicity and concurrent structural-command replay remain stage 03 work.

LWW compares `(physical, logical, deviceId, operationId)` lexicographically. Server future timestamp tolerance is five minutes, canonicalized once per unique operation. Independent groups merge; schedule/rule/state must be complete groups. Tombstones require explicit newer restore intent. Persisting clock, outbox, dedupe and canonical shadows remains stage 04 work; pure merge tests do not establish durable sync.

Reminder planning has independent before/overdue toggles and a one-hour overdue catch-up limit. No native scheduler or push dispatcher is implemented yet.
