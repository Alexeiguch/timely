# 003 — Transactional sync and durable client baseline

The authenticated API uses the existing Drizzle/Postgres.js driver. Every push locks the owner's `sync_heads` row before reading or writing that owner's planner data. A batch commits its canonical operation results, definition records, sparse occurrence projections, immutable authored revision commands, audit events, reminder reconciliation outbox and monotonically ordered feed together. A failed dependent batch rolls back completely. An owner/operation UUID retry returns the original stored result; a different payload with that UUID is rejected. A canonical fingerprint sorts object keys, and future clock skew is bounded once at receipt.

The session is the only server ownership authority. The optional `X-Timely-Account` header additionally prevents an old account's client outbox from being uploaded after the browser's cookie changes to another account. It grants no authority. Requests reject disallowed origins, cross-site fetches, unknown fields and bodies over 1 MiB. Push/pull limits remain 100/500. The initial rate limiter is process-local and must become a shared deployment-level limiter before multi-instance production release.

Bootstrap copies the owner's definitions into persisted snapshot rows while holding the same owner lock. The watermark and pages agree, including when concurrent commits arrive between pages. Snapshot tokens are owner-bound and expire in one hour. No transaction remains open between HTTP requests. Clients stage pages, atomically install the completed snapshot, preserve pending operations, and then pull after its watermark. Feed/dedupe pruning is not enabled, so valid historical cursors do not currently expire.

## Deterministic projection

A version-1 definition record contains its canonical authored operation journal. Both clients and the server replay the same shared reducer in hybrid-clock order, with source-revision dependencies respected. Patches contain only changed atomic groups. Immutable authored terminal snapshots survive insertion of a delayed earlier edit. Source-slot validation prevents invented occurrence identities. Recurrence transitions retain historical revisions/aliases, late completion and future deletion boundaries. A normal edit cannot clear a deletion group.

The `recurrence_revisions.payload` column stores the immutable authored command that introduced that revision. The domain's effective revision projection is derived from the journal, so late earlier content edits can change effective inherited metadata without overwriting the authored revision command. Sparse materialized occurrence rows are rebuilt for the affected definition in the same transaction. Ordinary planner display still uses bounded domain projection from the authoritative journal.

This is an initial correctness baseline, not the final scale model: journals and full canonical feed payloads grow with edits. IndexedDB and SQLite currently store one versioned account aggregate containing canonical shadows, outbox, clock, cursor and staged snapshot, rather than separate indexed entity tables. Before release, checkpoint/compact per-definition journals with retained revision dependencies, migrate local aggregates into indexed tables without dropping pending operations, and measure large histories. No existing local schema or history is silently truncated.

## Durable clients

Both adapters implement the same atomic local-store interface. The local transaction validates projection and saves the authored command, clock and outbox together. Views derive from remote shadows plus pending commands. Only acknowledged operations leave the outbox. Pulls cannot replace a newer canonical shadow with an older retry result. The engine keeps pending work on 401/network loss, retries with backoff, stages interrupted bootstrap, and prevents overlapping cycles in-process. Web additionally coordinates tabs with Web Locks. Native SQLite uses exclusive transactions and WAL; namespaces include backend URL and account ID.

The web service worker caches only the public static client shell and `/_next/static/` assets. It never caches auth/API/private HTTP responses. Offline account metadata chooses a local namespace only; it is not accepted as server authentication. Sign-out blocks while pending work exists and removes the account's local database when it succeeds. Explicit discard/recovery and account deletion are still required.

The web planner now exercises these use cases through the durable store. Native has a first SQLite-backed planner for creation and occurrence actions; full editor/navigation parity and physical-device verification remain outstanding. Reminder invalidations are queued durably, but no worker consumes them yet and no notification delivery is claimed.

## Development isolation

Planner migrations were applied to Neon branch `timely-development` (`br-autumn-mouse-b4zwfmwu`) in project `fragrant-bonus-17540843`, and to local Docker PostgreSQL. Root Neon linking and the owner's deployed hello API remain on production. The new `.env.neon-development` is ignored and permission 0600; existing environment files were preserved.

References: [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Neon branching](https://neon.com/docs/get-started-with-neon/workflow-primer), [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction()), [Expo SDK 55 SQLite](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/). Installed Next.js route/PWA and Turborepo task docs were also consulted.
