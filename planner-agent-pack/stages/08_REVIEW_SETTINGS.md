# Stage 08 — Review, Search, Settings and account lifecycle

## Goal and dependencies

Complete the supporting destinations and account/preferences flows around the planner. Stages 02–07 supply task history, sync and reminder behavior. Read [product](../PRODUCT_SPEC.md), [design](../DESIGN_SYSTEM.md), [sync](../OFFLINE_SYNC.md) and [notifications](../NOTIFICATIONS.md).

## Review

1. Add clear filters for missed/overdue, completed and skipped occurrences, with useful date ranges and recurring-series filters.
2. Show stable terminal history snapshots, effective planned dates, original date context for moved work and completion timestamps when relevant.
3. Build recurring-group progress within the month and across months for monthly tasks. Provide a readable list equivalent to occurrence strips.
4. Implement the two distinct metrics: all scheduled non-skipped month progress, and elapsed due non-skipped completion rate. Upcoming tasks must not lower the elapsed rate. Zero denominators have useful empty labels.
5. Make review cards actionable through the same complete/reopen/move/skip/detail commands. Avoid shaming copy, fake streaks or gamification not requested by the owner.
6. Support local history first and owner-only paginated historical loading outside downloaded windows. Clearly communicate unavailable historical data offline.

## Search

Search local titles and optional notes with a fast bounded query and useful date/state/priority filters. Distinguish a recurring definition from its occurrences in results; show enough date context to open the correct work item. Handle empty queries, no results, deleted records and long titles.

For unloaded server history, offer an online historical search path with ownership checks and pagination. Do not imply that an offline result set includes unseen records. Reuse domain state and stable identities; search must not materialize infinite recurrence results.

## Settings

- Reminder before/overdue toggles, timed offsets and untimed morning time.
- First day of week, initially Monday; grouped/individual month preference.
- Current automatic IANA time zone with a clear local-time explanation. Fixed-zone task scheduling is deferred unless the owner requests it.
- System notification permission and useful recovery action; device delivery/coverage state.
- Sync state, pending edit count, last successful sync and Retry.
- Motion preference follows system reduced motion; an app override is optional only if implemented consistently.
- Signed-in account/provider methods, explicit link/unlink where safe, sign out and account deletion.

Synchronize user preferences with field-group stamps, while device permissions, push tokens and current device zone remain device-specific. Keep settings changes reactive on both clients; reminder default changes trigger plan reconciliation. Changing the first weekday must alter calendar grouping/navigation but not weekly recurrence anchors already stored in a rule.

## Account safety and lifecycle

Reauthentication is required for account deletion and sensitive linking changes. Never let unlinking remove the last usable sign-in method. Treat Apple private relay correctly; do not silently merge accounts by email. If linking is blocked by external provider setup, explain it and preserve the current working account.

Sign out handles unsynced edits explicitly: offer Sync now or confirmed discard, keep the chosen account namespace isolated, clear session material, unregister/cancel device notifications and prevent previous account data appearing on the next sign-in. Account deletion is a confirmed online operation and purges owned remote/local data according to the contract.

## Verification and acceptance

- Review metrics match fixtures involving future work, skips, late completions, moves and recurrence revisions.
- Monthly tasks show genuine cross-month history; no invented monthly occurrences.
- Search returns the right occurrence and never another user's records.
- Preferences synchronize and update views/reminders without a restart.
- First-weekday changes do not silently rewrite stored recurrence rules.
- Offline review/search uses downloaded data and indicates gaps honestly.
- Linking, unlinking, sign out with outbox, account switch and deletion preserve account isolation.
- Both platforms' screens match the supplied typography/card system and are accessible.

Update progress and capture representative Review/Search/Settings screenshots. The release stage now verifies the whole application and its operational readiness.
