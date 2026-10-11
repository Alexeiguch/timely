# PR #2 review — 2026-10-09

PR: https://github.com/Alexeiguch/timely/pull/2

Reviewed head: `0b3c13b9a8b8b8fb6622fc00d7935d0ecdfd7a0f`. Current main: `456df8b3e9e03d3ffd3d608c3aff1d355d261144` (PR #1 was squash-merged). Verdict: request changes for the two notification/sync failures and the coverage query volume; resolve the merge conflicts before merged-source validation.

The review covers security boundaries, notification lifecycle/failure paths, dependency advisories, performance and maintainability. It does not certify a production release or physical-device performance. Existing uncommitted deployment/standalone-iOS changes were preserved and excluded from the committed PR build/browser checks. No product source was changed and no review was posted to GitHub.

## Actionable findings

1. **P1 — Task synchronization depends on push registration.** `apps/mobile/src/planner-provider.tsx:170–171` awaits `pushCoverage.prepare` before every `sync/push`. That includes fetching push configuration and potentially obtaining an Expo token. A configuration outage, token timeout or failed push registration therefore prevents the task request reaching the healthy planner backend, including tasks with reminders disabled. The shared engine keeps the edit but marks the device offline and delays retries; edits can stay local indefinitely while push is unavailable. Separate essential task upload from optional push registration. Preserve reminder safety through server-side invalidation/pausing in the task mutation transaction rather than making the external push service an upload prerequisite. Reproduction: a transport harness using the actual shared engine and this guard produced zero task uploads and one retained outbox edit when registration failed.

2. **P1 — Paused jobs can starve notification delivery for other accounts.** `apps/web/server/push-worker.ts:17–19` attempts only the first 20 due jobs. `packages/db/src/notifications.ts:496–508` includes paused devices and expired pending jobs; `claim` returns at `533–542` for an unready device before checking expiry. These jobs keep their pending status and occupy the same queue prefix on every sweep. Recovery does not retire expired pending jobs; reconciliation excludes test jobs from cancellation. A real disposable-Postgres reproduction with 20 expired test jobs belonging to a paused device and a newer due test belonging to a ready second owner sent zero notifications across two sweeps. Cancel expired pending jobs independently of device readiness, select eligible devices before applying the dispatch limit, and ensure skipped claims cannot indefinitely occupy the dispatch budget. Add a multi-owner queue regression.

3. **P2 — Unchanged coverage refresh performs hundreds of individual SQL writes.** `packages/db/src/notifications.ts:272–288` issues an insert for every candidate on every coverage commit even when all jobs exist. The native scheduler calls coverage commit on foreground refreshes, normally every 15 seconds. A measured fixture with 50 daily recurring tasks and no changes executed **711 queries** on its initial coverage commit (460 ms) and **711 again** on an identical commit (368 ms), using loopback Postgres. These times are local measurements, not hosted-Neon predictions. Four refreshes per minute would issue 2,844 queries per active device before its other requests, while holding the owner lock. Build an indexed lookup of existing jobs, insert only missing candidates in a batch and batch changed statuses. Retain the transactional handoff and cursor checks. The executable performance fixture is preserved with the reproduction scripts below.

## Security validation

- Real API/browser checks reject anonymous account/sync requests (401), wrong-account uploads and cross-origin requests (403). An unsigned worker invocation with dev mode disabled returns 503. Response framing and content-type protection headers are present.
- All 18 real PostgreSQL tests pass, including two-account ownership, operation deduplication, history preservation, account deletion, distributed throttling, notification token isolation and claim lifecycle.
- Client/server import-boundary guard passes. Inspected changed auth, mail, API, push, storage and worker paths: owner comes from the authenticated session, request schemas validate payloads, mail/push failures sanitize provider output, OTPs are hashed, native session storage uses SecureStore, and server credentials stay behind server imports.
- Scanned 291 committed text files for private-key blocks and configured sensitive values: no private-key block or real provider credential finding. Matches were documented synthetic loopback database credentials from the local Docker setup. This is a bounded source scan, not an exhaustive history/image secret audit.
- Current `pnpm audit --json`: **35 dependency findings — 1 critical, 8 high, 22 moderate, 4 low**. The full registry response is `/tmp/timely-pr2-review-audit.json`. Audit exit code 1 is expected for these findings. Major flagged pins including Vitest 4.0.18, Next.js 16.3.7 and Nodemailer 7.0.13 already exist on main; they are maintenance findings, not newly introduced application exploits.
- [Vitest critical advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp) concerns exposed UI/API-server execution or Windows UI/browser serving; the configured workflow uses `vitest run`, so that vulnerable server is not exercised here. Upgrade the compatible test-tool set (the registry also flags a later moderate Vitest issue).
- [Next.js image SSRF advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) requires allow-listed remote image URLs; none are configured. [Next development MCP disclosure](https://github.com/advisories/GHSA-39w2-rjm5-chcv) does concern use of `next dev`; the registry reports a 16.3.8 patch for the flagged Next issues. Production exploitability was not demonstrated.
- Nodemailer is used only in guarded local capture mode, with validated single email/OTP fields and fixed transport settings. The flagged arbitrary raw/envelope/transport-input flows are not exposed by that adapter. Refresh dependencies with compatible pinned versions and a lockfile, then repeat relevant checks rather than treating audit severities as proof of reachability.
- The unsigned Inngest guard intentionally trusts the request hostname and documents that it is spoofable. Keep dev mode restricted to a loopback-bound local server; it is not a network-peer authentication mechanism.

## Performance and tidiness

The measured coverage loop above is the material new performance issue. Native history uses a virtualized FlatList; the carousel changes transforms directly rather than rendering React on each pointer move. Physical-device FPS, Hermes startup/memory, hosted query latency and load at scale were not measured in this review.

Nonblocking cleanup: `apps/web/components/planner.tsx` is 1,456 lines, combining calendar, history/search, settings and account flows; `apps/mobile/src/planner-provider.tsx` is 638 lines. Extract cohesive screen/flow modules to reduce review and change scope. The web/native language-state wrappers are identical and could share their portable state hook/provider. Several storage modules compress transaction logic onto long lines; normal formatting would make atomicity and failure paths easier to inspect. Avoid changing these during conflict resolution without retaining behavior checks.

## Checks and reproduction

| Check | Actual result |
| --- | --- |
| `pnpm test` | 139 passed; 18 opt-in DB tests initially skipped |
| `pnpm typecheck` | All 10 workspaces pass; 6 cached |
| `pnpm lint` | Client/server boundary guard passes |
| `git diff --check origin/main...HEAD` | Pass |
| Archived PR source: `pnpm --filter @timely/web build` | Pass; all 21 routes |
| Disposable DB migration | Pass; two benign Postgres identifier-truncation notices |
| `RUN_DB_TESTS=1 ... vitest run packages/db/src/planner.integration.test.ts packages/db/src/notifications.integration.test.ts` | 18 passed |
| `TEST_BASE_URL=http://localhost:3014 pnpm test:e2e` | 24 desktop/320px-phone cases pass in 1.1 minutes |
| Synthetic notification/transport reproduction | Both failures reproduced; mock sender, no real push |
| Coverage query-count fixture | 711 queries on both first and unchanged repeat commit |
| `pnpm audit --json` | Exit 1; 35 findings, applicability assessed above |
| `git merge-tree origin/main HEAD` | Exit 1; conflicts, matching GitHub's `dirty` merge state |

Vitest emits an existing `expo/tsconfig.base` resolution warning, without failing the suites. Product physical-device OAuth/reminder gates remain as recorded in `docs/release-readiness.md`; no release acceptance was newly claimed.

Isolated source and executable diagnostic fixtures are at `/tmp/timely-pr2-review/source/review-repro.ts` and `/tmp/timely-pr2-review/source/review-performance.ts`. They import the actual repository/worker/shared engine; the native transport fixture mirrors the guarded request rather than mounting a native app. Database/provider fixtures are synthetic. The first reproduction invocation needed CJS interop correction and the second needed package-local ORM resolution for cleanup; a token collision from that interrupted temporary fixture was corrected using unique tokens. The final invocation passed. The performance fixture initially used the wrong rule discriminator, then passed after validating `frequency: daily` against the actual contract. These diagnostic-script errors did not affect product source. The dedicated disposable database and test server were removed after the review; existing local and hosted services/data were not changed.

## Next action

Fix findings 1–3 with meaningful failure/queue/performance regressions, resolve PR #2 against current main while preserving the existing working-tree changes, then validate the resulting merged source. The head's passing build cannot establish that a conflicted merge builds. Refresh flagged dependency pins as a separate compatible maintenance change. Do not merge or publish based on this review alone.

## Fix validation — 2026-10-11

PR #2 is now merged into main. The three actionable findings are addressed on the merged implementation:

- Native task transport no longer calls optional push registration. The authenticated task transaction pauses only its owner's uploading installation; invalid batches roll back that pause with the edits. Regression coverage includes both reminder settings, expired authentication, identical installation IDs on two accounts, and transactional rollback.
- Due selection joins the matching owner/device registration and excludes paused, unpermitted, tokenless and expired jobs. Recovery cancels expired pending jobs even on paused devices. Claims retain transactional readiness/canonical checks. Failed claims do not consume the worker's twenty-dispatch budget.
- Coverage and worker reconciliation insert missing jobs in bounded batches, group changed statuses, and use keyed lookups. They retain terminal and local ownership. Fifty daily tasks produce 700 seven-day jobs with **11 queries initially, 9 on unchanged repeat coverage, and 9 on unchanged reconciliation**, compared with 711 coverage queries in the review.

Exact dependency updates: Next.js 16.3.8, Vitest 4.1.11, Nodemailer 10.0.9 and domain UUID 11.1.1; the lockfile retains the compatible Expo 57/React Native 0.86.3 set. The updated registry audit has six findings (zero critical, two high, three moderate, one low). Remaining paths are Expo/native tooling (node-forge, braces, legacy xcode UUID, router decoding), Drizzle's legacy esbuild loader and tsx's esbuild. The two high advisories list no patched version. These remaining findings are not represented as fixed or as demonstrated production exploits. Further compatible upstream updates remain maintenance work.

Validation: all 164 unit/SQLite/real PostgreSQL cases pass, ten workspace typechecks pass, client/server import boundaries pass, and the production web build generates all 21 routes. Database tests use a newly created local disposable database; production data and schema are unchanged. Deployment and native build evidence are recorded in the latest progress entry.
