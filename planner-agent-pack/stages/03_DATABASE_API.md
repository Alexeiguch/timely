# Stage 03 — Neon persistence and authenticated API

## Goal and dependencies

Persist the shared domain with owner isolation, historical integrity and retry-safe mutations. Stages 01–02 must be available; stage 00 may be externally blocked but server auth code must be real. Read [data model](../DATA_MODEL.md), [architecture](../ARCHITECTURE.md) and [sync](../OFFLINE_SYNC.md).

## Implement

1. Build Drizzle schemas and reviewed migrations for app records, Better Auth tables, recurrence revisions, occurrence records/events, user preferences, device records, sync feed/operations and job outbox.
2. Configure the transaction-capable Postgres driver and environment validation. Test against an isolated Neon development branch or equivalent test Postgres; verify Neon-specific connectivity before release.
3. Implement owner-scoped repositories and the shared domain commands. Queries must derive owner from validated session, never a supplied body/query owner ID.
4. Add `/api/v1` handlers from the canonical API table with Zod request/response validation, consistent errors, bounded payloads and pagination.
5. Implement mutation transactions: deduplication, group-stamp merging, revision transitions, invariants, audit/feed creation and reminder invalidation/outbox writes.
6. Implement commit-safe per-owner feed ordering and a consistent paginated bootstrap snapshot. Do not use wall-clock timestamps or an unordered global sequence as a cursor.
7. Add bounded materialization/catch-up for recurring views, historical searches and overdue work. A repeated materialization request must not duplicate an occurrence.
8. Implement device registration/token/zone update endpoints and the server side of reminder coverage; live delivery follows in stage 07.
9. Add online account-deletion behavior with recent authentication, session revocation and removal of owner data/notification registrations. Client cleanup follows later stages.

Use canonical command writes for both platforms. Do not create a separate web-only CRUD flow that bypasses sync stamps, revisions or jobs. Keep server-only imports out of shared client entry points.

## Security and failure paths

Test with two accounts. Reject cross-owner targets in reads, edits, history, device registration, bulk operations and count endpoints. Enforce allowed origins and current Better Auth protections; native requests still require valid sessions. Apply practical per-user/IP rate limits, especially auth/mail and expensive projection/search operations. Avoid raw database errors or task content in logs.

Ensure a response lost after commit can be replayed with the same operation UUID and outcome. Reuse of an operation UUID with different content is a validation error. A partially valid dependent command batch must not leave malformed structures. Handle temporary database unavailability with retryable error codes.

## Verification and acceptance

- Fresh and incremental migrations run against an isolated database and preserve existing terminal records.
- One-off/recurring creation, all state actions, moves, all edit scopes, exclusions and deletion persist correctly.
- API results match shared DTOs and read back the same effective data.
- Two-account tests prove isolation; anonymous/expired sessions cannot write.
- Duplicate/reordered operations converge; transactional failures do not leave half-written records or feed gaps.
- Snapshot/pull tests include two overlapping commits and pagination during concurrent edits.
- Job invalidation is committed with task changes, before the API acknowledges success.
- Server requests and logs expose no secrets/OTP/private notes.

Write schema/migration/API documentation and include sanitized request examples only where useful. Update progress with migration IDs and test evidence. The next stage connects both local adapters to this protocol.
