# Planner operations and recovery

This is preparation for an undeployed planner. No hosted reminder worker is active. [Release readiness](release-readiness.md) lists actual evidence and unverified gates.

## Signals and privacy

Monitor backend error rates/latency, database connection failures, authenticated 401/403/429 rates, snapshot creation/expiry, oldest unprocessed invalidation job age and sync request size. Track counts and release IDs; exclude task notes, notification previews, email OTPs, session cookies, provider tokens and database URLs from diagnostics. The current UI shows local pending operations, last sync and local notification coverage without exposing push tokens.

Planner API throttling is a shared PostgreSQL fixed-minute budget of 180 requests per authenticated owner. A 429 preserves the local outbox and retries later. Authentication throttling is managed separately by Better Auth. Do not disable ownership or rate-limit checks to recover a single user.

## Sync incidents

- Network/database outage: local saves remain committed with their original UUIDs. Restore the backend and use Sync now. Do not regenerate IDs after an acknowledgement was lost.
- Expired session: reauthenticate the same account; pending edits remain. Do not purge its database to remove an authentication error.
- Invalid dependent operation: Settings can retry unchanged operations or explicitly discard all pending edits for the affected task, preserving unrelated tasks and canonical data. A rejected atomic batch is isolated into single operations before permanent rejection.
- Expired history snapshot: return to downloaded plans or restart online history with a new snapshot. Its continuation is bound to the original account/filter and expires after one hour.
- Invalid local stored state/migration: preserve the database and capture a sanitized reproduction. Web keeps `timely-planner-v1`; mobile keeps `timely-planner.db`. Never replace it with empty data to make startup pass.

## Account and notifications

Account deletion requires a real session created within five minutes and explicit confirmation. The server locks the account's sync head, revokes all sessions and cascades owned data. Other accounts remain unchanged. Device unregister affects only the authenticated installation. Sign-out requires sync or confirmed discard when work is pending.

Native cancellation is account/environment scoped. A durable cleanup queue survives account purge and retries on launch. Revoked accounts leave in-memory state even if local cleanup fails. Local reminders reconcile on durable edits, startup, foreground and sync. Settings shows permission, seven-day coverage and the 48-entry budget. A disconnected phone can retain an old OS schedule after a web edit until reconciliation; tapping rechecks current state. Remote delivery remains unimplemented.

## Backup, retention and rollback gates

Before a production migration, create an approved Neon branch/restore point and verify restoration to a separate target, including auth tables, canonical records, terminal history, command dispositions, clocks and feed cursors. No production backup/restore drill has been executed for this planner yet.

Do not prune operation dedupe records, canonical journals, tombstones, feed rows or unprocessed jobs until the checkpoint/retained-cursor policy is implemented and tested. Fixed snapshots are temporary; their cleanup and storage monitoring must be validated before large-scale deployment. Document the oldest supported offline client and prove that rebootstrap preserves queued work before enabling any retention.

For app rollback, preserve forward-compatible local schema readers and backend command support. Test the old artifact against the migrated branch and retained local outbox before rollout. If incompatible, stop the rollout and prepare a corrective forward release; do not restore production blindly over newer user writes.
