# Data model and API contract

## Modeling principles

An account owns every application record. A repeating series is a definition; an occurrence is the individual work a user can complete, skip or move. Do not store one global `completed` flag on the repeating definition. Do not store an unbounded list of every future instance.

Store local civil dates as date values/`YYYY-MM-DD` DTO strings and start times as nullable local time values/`HH:mm`. Modification, completion and audit times are UTC instants. A nominal monthly slot may refer to day 31 in a short month, so its slot key is a structured string, separate from its valid effective civil date.

Use client-generated UUIDs for authored records and deterministic occurrence IDs for generated slots. Avoid relying on auto-increment IDs to create tasks offline. Server and clients serialize exactly the same schemas from `packages/contracts`.

## Remote tables

| Table | Essential fields and responsibilities |
| --- | --- |
| Better Auth tables | Users, sessions, accounts, verification, using the installed version's generated schema |
| `user_preferences` | Owner, first weekday, reminder offsets/morning time, grouping, localized display preferences, version metadata |
| `task_definitions` | UUID, owner, kind one-off/recurring, title, notes, priority, default time/duration/reminders, one-off date, active rule revision, tombstone and field-group stamps |
| `recurrence_revisions` | Immutable UUID, definition, rule payload, anchor, effective boundary, superseded revision, mutation stamp and disposition |
| `task_occurrences` | Stable UUID, owner, definition, source revision, slot key, original/effective civil date, overrides, state, completion/skip timestamps, terminal snapshot and tombstone |
| `occurrence_events` | UUID, owner, occurrence, operation, event type and UTC time, for state/history audit without storing secrets |
| `sync_devices` | Installation/browser UUID, owner, last seen, protocol/schema version and last reported zone |
| `sync_operations` | Owner + unique operation UUID, device, validated command, canonical stamp, result and acknowledgement |
| `sync_changes` | Owner + committed cursor sequence, entity key, upsert/tombstone change, canonical payload/version |
| `sync_heads` | One row per owner used to serialize committed change-feed cursor allocation |
| `notification_devices` | Owner/device, platform, permission, push token, local/remote capability, current zone and registration lifecycle |
| `reminder_jobs` | Owner/device/occurrence/kind, schedule version, due instant, state, idempotency key, receipt/retry metadata |
| `local_reminder_coverage` | Device, occurrence/kind/version, successfully scheduled local coverage and reconciliation expiry |
| `job_outbox` | Transactionally created job/invalidation events, processing and retry metadata |

Put auth tables in an explicit app-managed schema/namespace. Generate them from Better Auth's supported tooling and review the migration. Do not write into managed Neon Auth's `neon_auth` schema or invent its session format.

## Task fields and constraints

- `title`: trimmed nonempty text, max 200 characters; `notes`: optional text, max 10,000.
- `priority`: nullable stable code `low`, `medium`, `high` with centralized UI labels.
- `start_local_time`: nullable; `duration_minutes`: nullable integer 1–10,080.
- A one-off definition has a required valid civil date and one stable occurrence.
- A recurring definition has a valid structured rule revision and anchor. It has no single completion state.
- Occurrence state is `pending`, `completed` or `skipped`. Overdue is computed, not a persisted authoritative state.
- Explicit overrides distinguish **inherit**, **set value**, and **clear value**. A null value alone cannot represent both clearing a series default and inheriting it.
- Every reschedule keeps `original_scheduled_date`, source slot and occurrence UUID.
- `terminal_snapshot` captures title/schedule/zone/state dates as required for stable history; later series changes do not alter it.
- Reminder settings have enabled/before/overdue flags and validated offsets/preferences.
- Field stamps, deletion stamps and server cursor/version metadata are separate from display/audit timestamps.

## Recurrence revisions and identities

A recurrence revision is immutable and its schedule generation is bounded. Each generated instance receives a canonical slot key from its revision and logical nominal slot, then a deterministic UUID derived from the definition ID and that slot key. The identity does not include effective date, current zone, title, duration or completion state.

Rule edits create a new revision, preserving old revisions and terminal history. In the same transaction, retire obsolete pending projections in the edit's scope, map the selected occurrence to its replacement slot when applicable, and create replacement pending projections. Maintain an explicit alias/mapping when a revision changes logical slots; retries must not create a second task for the selected occurrence.

Historical completed/skipped records stay attached to their original revision. Preserve explicit moved/edited exceptions unless the chosen edit explicitly replaces that field. Do not infer a new identity from a moved date. A projection generated by an old revision cannot resurrect after that revision is superseded.

Unique constraints include owner+operation UUID, definition+revision+slot key for generated projections, device+occurrence+reminder kind+schedule version for reminder ownership, and owner+cursor sequence. Any alias relation must be unique and acyclic.

## Local stores

SQLite and IndexedDB persist task definitions, rule revisions, occurrence records/overrides, preferences, canonical remote shadows, local outbox, sync cursor, device clock metadata and account namespace. Mobile also stores local reminder mappings and coverage. Web stores cached app-shell metadata as appropriate.

Separate canonical remote shadows from the displayed local projection so a pull cannot overwrite a newer unacknowledged local edit. Rebuild the view by applying still-pending valid commands to the latest canonical rows. Keep database schema versions and migration tests for both adapters.

Queries need indexes on owner, effective scheduled date, definition/revision, terminal state/time, tombstone, owner+change sequence and outbox retry readiness. Search titles/notes locally; use a bounded server historical search when required. Do not expose other owners through counts or search suggestions.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `/api/auth/*` | Better Auth handlers; keep protocol owned by that library |
| `GET /api/v1/me` | Validated account summary and protocol capabilities |
| `POST /api/v1/sync/bootstrap` | Start or continue a consistent account snapshot |
| `POST /api/v1/sync/push` | Apply bounded validated operation batches idempotently |
| `GET /api/v1/sync/pull?cursor=…` | Pull ordered committed changes and continuation |
| `POST /api/v1/occurrences/materialize` | Idempotent bounded window projection when needed |
| `GET /api/v1/history` | Owner-only paginated terminal/overdue history outside local coverage |
| `POST /api/v1/devices/register` | Register account-bound installation, capability and zone |
| `POST /api/v1/devices/reminder-coverage` | Report actual local scheduling coverage/version |
| `DELETE /api/v1/devices/current` | Remove push/scheduling registration on sign out |
| `POST /api/v1/account/delete` | Recently authenticated, online account deletion |
| `GET /api/health` | Minimal health response, with no internal credentials/data |

Ordinary task/preferences writes use the sync command API on both clients; do not create a conflicting direct CRUD path for web. Commands include create/edit definition, edit occurrence, set occurrence state, reschedule occurrence, replace/split recurrence revision, reorder, delete and explicit undo/restore where supported.

## Envelopes, errors and limits

Each operation includes protocol version, UUID, device ID, entity target, command type, atomic field-group patch, change stamp, base revision if structural, and creation time. Responses include operation disposition, canonical result/stamps, server time and changes watermark. See [OFFLINE_SYNC.md](OFFLINE_SYNC.md) for conflict behavior.

Use predictable machine codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_COMMAND`, `UNSUPPORTED_VERSION`, `CURSOR_EXPIRED`, `DEPENDENCY_MISSING`, `RATE_LIMITED`, `TEMPORARY_UNAVAILABLE`, `ACCOUNT_DELETED`. Return structured field errors and a request ID, not raw SQL/stack traces.

Initial bounds: up to 100 operations per push, 500 feed records per pull, a 366-day requested projection window, and a maximum 1 MiB request body. Tune only with measured tests. Use pagination for larger data; never silently truncate records and pretend the snapshot is complete.

## Transactions and isolation

Authenticated mutation transactions verify owner and target, deduplicate the operation, compare group stamps, apply invariants, allocate committed feed order, write audit/change rows and invalidate reminder jobs before acknowledgement. Lock the owner's sync-head row before allocating sequence values, so cursor order cannot race commit order. A plain global `BIGSERIAL` allocation by itself is not a safe committed change cursor.

Snapshot bootstrap has a fixed watermark and consistent contents. Use a repeatable snapshot or persisted paginated snapshot representation so pages do not omit/interleave changes. Once installed locally, pull changes after that watermark. Do not hold a database transaction open between HTTP requests.

For personal accounts, serialize short mutations by owner to simplify correctness; measure before introducing finer locks. Background reminder workers use their own job-claim locks and stale-version checks. App API authorization is mandatory even if defense-in-depth RLS is later used. With pooled DB connections, any user context used for RLS must be transaction-local and never leak between requests.

## Deletion and retention

Task deletion writes tombstones and cancels reminders. Ordinary edits cannot resurrect deleted records; only an explicit newer restore command can do that. Retain sync tombstones/operation deduplication at least 90 days initially. Older clients receive an expired-cursor response and perform a non-destructive rebootstrap preserving their outbox. Retain terminal task history until the owner deletes it/account; limit audit payloads to useful non-secret metadata.

Account deletion revokes sessions, deletes user data and registrations, and requests native/local cleanup. A disconnected device cannot receive deletion immediately, so purge its cached account when it next validates or is explicitly signed out. Never upload its old outbox into a different user's account.
