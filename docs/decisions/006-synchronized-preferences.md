# 006 — Account calendar preferences in the offline sync protocol

Date: 2026-09-30

Calendar layout and month grouping now use the same durable operation queue as task changes. There is no separate online-only preference endpoint. The authenticated owner controls the namespace; operations cannot supply an owner.

`SyncOperation` / `SyncRecord` extend the unreleased v1 envelope with a `preferences` record. Task journals retain their existing schemas and are filtered before task projection. Existing local aggregates need no destructive rewrite: a missing preference record projects the shared defaults (Monday, grouped). The reserved `preferences` key cannot collide with validated UUID task identifiers.

Three independent stamp groups are supported: first weekday, month grouping and the complete reminder policy. Reminder policy fields win together. Both local overlays and the server replay the canonical hybrid-clock order; delayed old writes cannot overwrite newer settings in the same group. The server preserves exact deduplication responses, transaction rollback and account isolation. Preferences participate in fixed-watermark paginated snapshots and the ordered change feed.

Migration 0002 adds owner-scoped `user_preferences` and allows account-wide reminder reconciliation jobs without a task identifier. A reminder-policy command atomically enqueues `reconcile-preferences`; execution remains part of the outstanding reminder worker. Only calendar preferences have UI in this milestone. No reminder-delivery capability is claimed.

Both clients react to first-weekday changes in week navigation and month alignment. Stored recurrence rules are untouched, so changing the calendar layout does not alter an existing weekly cadence. Month representation changes do not create task edits.

All clients and API must be updated together before using these new records. This is an unreleased development protocol extension, not a claim of compatibility with older installed clients. Production rollout/version negotiation remains a release gate. Full journals/aggregate local storage retain the previously documented scale limitations.
