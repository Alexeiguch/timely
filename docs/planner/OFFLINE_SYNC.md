# Offline synchronization contract

## Required behavior

Both clients read and write a durable local database. After an initial online sign-in/bootstrap, users can create, edit, complete, reopen, skip, move, reorder and delete tasks offline, including recurrence and preferences. Edits survive process termination, browser reload and failed requests. On reconnect, changes automatically synchronize with the authenticated backend and Neon.

Use deterministic latest-change-wins for the same logical field group, rather than asking the user to resolve ordinary conflicts. Merge changes to different groups. All operations remain account-bound.

## Atomic field groups

| Group | Fields that win together |
| --- | --- |
| Content | Title (own group), notes (own group), priority (own group) |
| Schedule | Civil date, local start time and duration |
| Recurrence | Frequency, anchor, selectors, interval, end mode, policy and revision boundary |
| Reminder policy | Enabled flags, offsets and preference overrides |
| State | Pending/completed/skipped plus matching event/snapshot data |
| Ordering | Position key and relevant date/list scope |
| Deletion | Tombstone/explicit restore intent |

Treat each row listed as an atomic semantic group; content's separately listed properties have independent stamps. Combining schedule or recurrence parts from different devices could produce a schedule nobody chose, so compare their group stamps as a whole. Revalidate all invariants after merging.

## Change ordering

Each authored operation has a stable UUID, device UUID and hybrid logical stamp: adjusted UTC milliseconds, logical counter, device ID and operation ID. Compare lexicographically. On local edits, advance the device clock beyond its previously emitted/observed stamps; observe canonical remote stamps before creating new operations. Use an injectable ordering module, not ad hoc `Date.now()` comparisons in components.

Capture server-time samples during authenticated sync to estimate clock offset; persist the estimate and clock state. Keep both the authored timestamp and received-at timestamp for useful diagnostics. Server arrival order is not the owner's desired conflict rule: a delayed old offline edit must not automatically replace a newer known edit.

The server validates/canonicalizes stamps once per unique operation. Reject invalid formats; bound implausible future physical timestamps to a documented tolerance (initially five minutes from server receive time) and return the canonical stamp. Use stable ties and observation rules so the client accepts the canonical result and converges. Do not allow a wildly advanced device clock to win indefinitely.

Perfect real-world ordering across completely disconnected devices with skewed clocks is unknowable. This policy uses calibrated timestamps and deterministic ties; document that tradeoff and test clock skew, rollback and restart. Do not claim mathematically exact real-time ordering or label this system a full CRDT.

## Local mutation transaction

1. Resolve the authenticated/cached account namespace and validate the command.
2. Generate operation ID and stamp; apply the local projection and write the outbox entry in the same database transaction.
3. Notify local queries after commit. Show Saved locally immediately.
4. Reconcile local reminder changes from a durable side-effect queue; native scheduling cannot be part of a SQL transaction, so retry/compensate separately.
5. Trigger sync opportunistically if online. Network availability is a hint; handle actual request failures.

Outbox records include attempts, next retry time, dependency references and disposition. Never delete an operation merely because a request was sent or timed out. A dependency can be an offline-created definition needed by a later state change; send in dependency order or the same valid batch.

## Server mutation transaction

Authenticate the session and derive owner from it. Verify device/targets belong to that owner. Validate batch size/version and each command. Deduplicate by owner+operation UUID; a replay returns the same canonical outcome. Reusing an operation ID with different content is rejected.

Lock the owner sync head, compare group stamps, apply winning changes and invariant-preserving revision transitions, then append change feed, occurrence events and reminder invalidation/job-outbox records. Persist canonical operation disposition before commit. Respond only after commit. A batch may return per-operation results; dependency-linked commands require a transaction boundary that prevents half-created structures.

Valid older changes become acknowledged `superseded` results, not endless retry errors. Return canonical state so the client reconciles. Invalid commands are retained locally with useful errors and an edit/retry/remove action; unexpected data loss is never the conflict strategy.

## Sync cycle

1. Acquire one in-process sync mutex; in browsers coordinate tabs using a supported locking/leader mechanism.
2. Restore or refresh valid authentication as required, without blocking offline browsing.
3. Push bounded dependency-ordered batches. Install acknowledgements/canonical rows atomically; remove only acknowledged operations.
4. Pull ordered committed changes until caught up. Apply rows/tombstones and advance the cursor together in one local transaction.
5. Rebuild affected views from remote shadows plus unacknowledged operations, then reconcile notification plans.
6. Repeat if new operations arrived during the cycle; release the mutex cleanly.

Retries use exponential backoff with jitter and a cap, honoring server rate limits. Trigger on reconnect, foreground/focus, explicit Retry and a modest foreground periodic interval (initially about 15 seconds, with pause/backoff when idle). Browser tabs broadcast local changes. Background execution is opportunistic on mobile; do not depend on perpetual background JS or guarantee instant sync while the OS suspends the app.

## Bootstrap and expired cursors

The initial snapshot contains all authored definitions, revisions and exceptions, preferences, tombstones relevant to the retention window, and materialized active/history records in paginated form. The client reports which historical windows are fully downloaded. Generated future slots come from local definitions.

A fixed snapshot watermark and pagination token make bootstrap consistent. Stage snapshot pages in temporary local tables; activate them atomically once complete, overlay the outbox, then pull changes after the watermark. If a cursor expires after long inactivity, repeat bootstrap without discarding unacknowledged local work. Handle invalid/tombstoned targets with canonical outcomes rather than overwriting all local records.

Never claim unloaded historical records are available offline. Support local-generated overdue catch-up and server page loading with visible progress for large gaps. Avoid copying the entire ever-growing audit log to mobile.

## Deletion, recurrence and history

Ordinary edits cannot undo a tombstone. An explicit restore is a new intentional operation with a newer deletion-group stamp. Children of deleted definitions cannot recreate the definition. Exclusions for a recurring occurrence prevent subsequent expansion from bringing it back.

Concurrent structural recurrence edits choose one winning complete rule/boundary group. Retire pending projections from losing revisions and preserve terminal records, identity mappings and user intent. A legitimate offline completion of an old-revision occurrence must survive as a historical terminal record or map to the appropriate surviving occurrence; it must not be silently dropped or duplicate active work. Never resubmit losing structural edits forever.

Completion on one device and priority change on another merge. Completion versus Skip/Reopen compares state stamps. Two reschedules compare the full schedule group. Deletion versus an ordinary edit stays deleted, with the losing edit available in diagnostic operation metadata if needed. Latest-change-wins applies to authored state, not to overwriting immutable audit events.

## Account/session lifecycle

Use a separate local namespace per account and environment. On sign out cancel local notifications, unregister the current device when online, purge session material and hide/remove that account's task cache. Warn about unuploaded changes and offer Sync now or an explicitly confirmed discard before sign out; never silently discard them. A shared-device account switch must not expose prior data.

A previously authenticated account may continue local work offline when session revalidation is unavailable. On reconnect, pause uploads on 401, retain the outbox, and ask for sign-in to the same account. Account deletion/revocation is enforced when the server can be contacted. Use the cached session only for local identity selection, never as proof accepted by the server.

Account deletion is online and requires recent authentication. Clearing an account purges its local outbox and notifications after explicit destructive confirmation. Do not bind queued operations to a new account just because an email address looks similar.

## UI states and acceptance tests

Expose Offline, Saved locally, Syncing, Synced and Needs attention. Pending edit count and last successful sync time belong in Settings. Ordinary superseded edits do not produce a conflict modal. Validation failures, expired sign-in and unavailable historical data have specific useful messages.

Required tests: offline create/edit/restart; response lost after server commit; duplicate batches; reversed batch arrivals; concurrent field merges; same-group winner; clock skew; tombstones; cursor gaps/expiration; interrupted bootstrap; pending edits during pull; two tabs; two accounts; offline recurring edits against online completion; network flapping; session expiry without local loss; and SQLite/IndexedDB schema upgrades with outbox preservation.
