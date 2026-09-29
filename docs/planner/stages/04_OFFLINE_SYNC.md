# Stage 04 — durable offline stores and convergence

## Goal and dependencies

Deliver a usable local-first data layer on web and mobile before wiring the full screens. Stages 02–03 provide domain/contracts/server behavior. Read [offline sync](../OFFLINE_SYNC.md) and [data model](../DATA_MODEL.md).

## Implement

1. Define platform-independent repository and sync-transport interfaces; use cases call these rather than Dexie/SQLite directly.
2. Implement IndexedDB/Dexie and expo-sqlite adapters with account/environment namespaces, schema migrations, transactions, indexed range/history queries, live change subscriptions and durable outboxes.
3. Store canonical server shadows, pending commands, current displayed projections and clock/device metadata. A pull merges/rebases; it does not blindly replace a locally edited row.
4. Make every local mutation and its outbox entry atomic. Commands return after local commit, independently of network success. Add crash/restart recovery.
5. Implement the shared push/pull engine, bootstrap snapshot staging, cursor handling, dependency ordering, acknowledgement dispositions, bounded backoff and auth-expiry pause.
6. Implement deterministic group stamps and clock calibration/observation exactly as the contract defines. Return canonical server ordering to clients; handle future timestamp normalization without endless resubmission.
7. Reconcile tombstones and recurrence revisions without duplicate projections or lost terminal work. Keep pending edits on cursor expiration/rebootstrap.
8. Add browser tab coordination and local broadcast updates. Trigger foreground/reconnect/focus sync on both platforms, with a visible small sync-state model.
9. Build PWA/offline app-shell caching for the web: cache necessary static assets, fonts and a safe planner shell. Never cache auth endpoints, owner API responses or server-rendered private HTML indiscriminately. Load private task data from the account-specific local DB.
10. Add cache cleanup on account switch/logout, with a clear treatment of unsynced operations. Ensure the first online bootstrap and downloaded-history coverage are visible and honest.

Do not introduce a second remote database or sync SaaS without documenting why the approved custom protocol cannot meet requirements. Local SQLite/IndexedDB persistence alone is not synchronization.

## Test harness

Use a transport simulator with controlled connection loss, latency, response loss, duplicate requests, out-of-order operations and clock offsets. Run the same adapter contract suite against web and native stores where feasible. Test the real server with two simulated installations, not only mocked endpoints.

Required scenarios: create while offline, kill/restart, reconnect; same-group concurrent edits; different-group merge; complete versus skip; two moves; delete versus old edit; split recurrence versus old completion; interrupted bootstrap; expired cursor with outbox; schema upgrade with pending work; two tabs; session expiry; and account switch.

An older offline edit delivered after a newer edit must not win merely because it arrived later. A request that committed but timed out must not create a duplicate on retry. The client must display the server's winning state after acknowledgement, while keeping unrelated local edits.

## Acceptance and handoff

- Local writes survive reload/restart and are visible without a network round trip.
- Both adapters pass equivalent command/query/sync fixtures.
- Clients converge to the same canonical civil data after retry/reordering tests.
- Web loads a previously used planner offline with its cached fonts and local tasks.
- Outbox/clock/cursor updates are durable and transactionally consistent.
- Account data does not bleed across namespaces, service-worker responses or tab events.
- Ordinary conflict resolution is automatic; exceptional validation/auth errors retain useful recovery paths.

Write protocol and local-migration notes, support/recovery guidance and measured initial sync timings with a realistic seeded account. Update progress. The next two stages build production UI on this data layer.
