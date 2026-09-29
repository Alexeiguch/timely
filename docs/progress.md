# Implementation progress

## Current state
- Updated: 2026-09-29.
- Branch: `main`. Previous foundation/setup milestones: `df12576`, `b81f4c6`. The current milestone is the durable planner implementation; use `git log -1` for its final commit.
- Owner request: continue implementation after the completed Neon hello deployment.
- Last completed end-to-end capability: authenticated web task creation, offline reload and completion, reconnect, synchronization into a second real signed-in browser, recurrence creation/future edits, move/skip/unskip/delete with stable identity. Desktop and 320px phone tests pass.
- Neon development branch created: `timely-development` / `br-autumn-mouse-b4zwfmwu`. Planner migrations and real transaction tests passed there. Production/root Neon link and hello Function are unchanged.
- Web is now a working local-first planner baseline. Native has a SQLite-backed planner baseline and compiles for iOS/Android; physical-device behavior is still unverified.
- Canonical product contracts remain at `docs/planner/`; original `initial.md` and `planner-agent-pack/` remain unchanged.
- Exact next action: complete the missing stage 03 API/preferences/history/account-deletion surfaces and stage 04 recovery/indexed local migrations, then full web/native editor and navigation parity. Do not mark stages complete merely because the baseline works.

## Stage tracker
| Stage | Status | Evidence / remaining work |
| --- | --- | --- |
| 00 Authentication | blocked_external | Real SMTP OTP, restoration and revocation pass. Google web credentials installed; initiation passes but Google rejects the unregistered local callback. Apple/Resend credentials, Google native IDs, HTTPS callback and physical iOS/Android provider evidence remain missing. |
| 01 Foundation | in_progress | Workspace, strict TS, fonts/tokens, auth and planner shells, responsive web navigation, web/native bundles. Native visual/runtime proof and full accessibility matrix remain. |
| 02 Shared domain | in_progress | Recurrence/time/scopes/history/reminders/ordering and canonical journal reducer tested. Added reversed structural edits plus offline completion, future-range tombstones and fast distant daily expansion. Further overlapping-scope/property/scale/Hermes fixtures remain. |
| 03 Database/API | in_progress | Migration 0001, real owner-scoped register/push/pull/bootstrap, atomic audit/feed/jobs, exact dedupe and consistent snapshots pass on Neon. Preferences, materialization/history pagination, reminder coverage/registration, account deletion, shared production rate limiter and retention/checkpointing remain. |
| 04 Offline/sync | in_progress | Durable IndexedDB and SQLite aggregate adapters, atomic outbox/clock, shared engine, shadow rebase, staged bootstrap, retries/401 retention, Web Locks and public-shell cache. Browser offline/restart/two-client proof passes. Indexed entity migrations, large-history tests, explicit invalid-operation recovery/discard, native device tests and reminder side-effects remain. |
| 05 Web planner | in_progress | Real Day/Week/Month, editor with all rule frequencies/selectors/end modes, future edit scope, grouped month, occurrence actions, progress and sync status. Drag/reorder, undo/scoped delete, swipes/deep links, historical coverage expansion and complete accessibility matrix remain. |
| 06 Mobile planner | in_progress | SQLite-backed creation, Day/Week/Month agenda, complete/skip/move/delete and shared sync. Full native editor/custom recurrence/scopes, four-destination navigation, gestures and physical-device evidence remain. |
| 07 Reminders | pending | Pure planner and transactionally queued invalidations. No native scheduling or remote worker/delivery yet. UI does not claim notifications work. |
| 08 Review/Search/Settings | in_progress | Web selected-period search/review and account/sync diagnostics work. Synchronized preferences, broader history/filtering, deletion/recovery and native equivalents remain. |
| 09 QA/release | pending | Not release-ready. Synthetic browser evidence and native bundle checks are not production provider/device verification. |

## Checks actually run for this milestone
- `pnpm test`: 46 unit tests pass across five suites. Four DB integration tests intentionally skip without `RUN_DB_TESTS=1`.
- `RUN_DB_TESTS=1 node --env-file=.env.neon-development node_modules/vitest/vitest.mjs run packages/db/src/planner.integration.test.ts`: all four real Neon tests pass (about 25 seconds). Covers exact response-loss retry, one-time clock clamp, operation-ID collision, batch rollback including jobs/feed, two accounts and concurrent commits during snapshot pagination.
- Applied `0000_talented_namorita.sql` and `0001_majestic_invaders.sql` on the new Neon development branch; applied incremental 0001 on local Docker Postgres. Reviewed generated schema migration. No planner migration on production.
- `pnpm typecheck`: all nine packages pass. `pnpm lint`: client/server boundary guard passes (not a full style linter).
- `pnpm build`: production webpack build passes with the new protected API routes and public static shell.
- `TEST_BASE_URL=http://localhost:3001 pnpm test:e2e`: eight tests pass, real Chrome desktop and 320px phone. Covers delivered SMTP OTP, reload/sign-out, offline create/restart/complete, two-client sync, recurrence preview/future edit, move/skip/unskip/delete, anonymous/wrong-account/cross-origin/unknown-field rejection.
- Expo iOS and Android Hermes exports pass to `/tmp/timely-planner-native-export`; these are not signed native builds or device tests.
- Visually inspected real desktop and phone Day/Month/editor screenshots. Fixed narrow editor date truncation, month weekday alignment and compact button accessibility. Evidence under `docs/evidence/planner-*.png`.
- First cloud DB test attempt used an insufficient five-second timeout; overlapping teardown then deadlocked. Tests now use a realistic 60-second timeout and pass. The two synthetic owners left by that initial run were removed.
- Initial browser attempts exposed the production-build Mailpit guard, an inaccessible compact Add label, a reload-before-save test race, and overly strict label locators for native select elements. Corrected without replacing auth/persistence with mocks; final suite passes.

## External dependencies
| Missing item | Gate | Owner action when available |
| --- | --- | --- |
| Google callback registration and iOS/Android OAuth IDs | Provider proof | Web credentials installed locally. Add localhost callbacks for ports 3000/3001, then verify real consent/session; supply native client IDs for device proof. |
| Apple Service/App IDs, generated client secret, HTTPS callback domain | Apple native/web proof | Configure developer account and callback. |
| Verified Resend sender and API key | Hosted real mail | Configure sender; local Mailpit works. |
| Signed development builds/physical devices | Native auth/SQLite/reminders | Run stated iOS/Android matrix after environment/app identifiers are ready. |

Never put secrets, OTPs or sessions into these documents. Neon authentication/setup is already complete and is separate from these provider gates.

## Architecture and limitations
- Self-hosted Better Auth remains the planner's identity provider. Root `neon.ts` managed-auth setting does not replace it.
- `decisions/003-sync-persistence.md` documents the transaction/snapshot protocol, immutable authored revision commands and current aggregate/journal baseline.
- Journals/full canonical feed payloads and account-wide local aggregates need checkpointing/indexed-table migration and scale evidence before release. This limitation is explicit; no history/outbox is silently truncated.
- API body limits and a process-local per-owner throttle exist. Distributed rate limiting, further account/security endpoints and production operational controls remain outstanding.
- Browser shell cache contains only public HTML and static build assets. No API/auth/private HTTP responses are cached.
- Outbox errors remain durable and sign-out blocks with unsynced work. Explicit repair/discard/account deletion flows remain to implement.
- Web overdue projection currently covers the previous year and labels that coverage. Search/Review operate on the selected period. Do not claim all older history is available offline.

## Handoff
- New code: `packages/contracts/src/commands.ts`, `packages/sync/src/{records,engine}.ts`, `packages/db/src/planner*.ts`, migration 0001, protected web sync/register handlers, web local store/planner/editor/service worker, native local store/planner and test suites.
- Local built app for review: `http://localhost:3001`, started with `APP_ENV=local BETTER_AUTH_URL=http://localhost:3001`. Docker Postgres/Mailpit are running. Normal `pnpm dev` remains available on port 3000.
- `apps/web/.env.local` is the existing local Docker/Mailpit environment. `.env.neon-development` is a new ignored 0600 file used for isolated Neon migrations/integration tests. Root `.env.local` and `.neon` still target the owner's deployed production hello project; do not use them for planner development migrations.
- See `setup.md`, `qa-evidence.md`, and `decisions/003-sync-persistence.md` for executable checks and remaining gates.

## Follow-up — favicon and social sign-in availability
- Added branded `app/favicon.ico` (16/32/48 px) and `app/icon.svg` using Next.js metadata conventions. Both return HTTP 200 and are cached as public icons for offline use.
- Reproduced the social POST error as Better Auth `404 PROVIDER_NOT_FOUND`, not a missing Next.js route. The running local environment has neither Google nor Apple credential pairs configured.
- Added a public, uncached availability endpoint returning only `google`/`apple` booleans from the running auth instance. Web sign-in keeps unavailable providers disabled, explains email fallback, and provides retry when availability cannot be fetched. No dummy providers or fake sign-in were added.
- Verification: production build, web TypeScript, boundary lint and six targeted desktop/phone browser checks pass (icons online/offline, availability flags, network-failure retry, real email OTP/restoration/sign-out). Refreshed signed-out visual evidence.
- Social OAuth remains `blocked_external`: owner was asked for the local environment-file path containing credentials, without exposing secrets. Provider login itself is not claimed verified.

## Follow-up — Google web credentials
- Imported the owner-provided Google web client into ignored `apps/web/.env.local`; preserved other settings and restarted the built app on port 3001. Both the downloaded JSON and environment file have mode 0600. Added `client_secret_*.json` to `.gitignore`.
- Live availability is now `google: true, apple: false`. Social sign-in initiation returns HTTP 200 with a Google authorization URL, state and PKCE, using `http://localhost:3001/api/auth/callback/google`.
- Google currently rejects that URL with `redirect_uri_mismatch`. The downloaded client lists only a Neon callback. Add the self-hosted callbacks for localhost ports 3000 and 3001 in Google Cloud Console, retaining the Neon URI. The accessible console browser requires owner sign-in; the owner was asked to register the callbacks or sign in there.
- Six targeted desktop/phone browser checks pass with Google enabled, including actual email OTP/restoration/sign-out. Screenshots refreshed. Complete Google consent/session and native authentication remain unverified; no Google login success is claimed.
