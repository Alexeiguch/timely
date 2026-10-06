# QA evidence — 2026-09-29

This document retains chronological milestone evidence, not full planner acceptance. See [implementation-audit.md](implementation-audit.md) for the current 30 September status; earlier pending statements describe the date of their section.

| Check | Result | Environment / evidence |
| --- | --- | --- |
| Dependency installation | passed | pnpm 10.7.0 / Node 24.19.0, lockfile; final install has no peer warnings |
| Auth schema generation | passed | `auth@1.7.6 generate`; 5 tables in `timely_auth` |
| Auth migration | passed | `0000_talented_namorita`, disposable PostgreSQL 17 in Docker |
| Real email OTP and sessions | passed locally | `node scripts/auth-smoke.mjs`, actual Mailpit SMTP: anonymous rejected, invalid OTP rejected, valid OTP accepted, cookie restored, code reuse rejected, sign-out revoked |
| Browser auth flows | passed locally | `pnpm test:e2e`, Chrome, 1280×800 and 320×740, 2 tests |
| Workspace TypeScript | passed | `pnpm typecheck`, all 9 packages |
| Shared domain/ordering | passed | `pnpm test`, 36 tests in 3 files |
| Server import boundary | passed | `pnpm lint` |
| Production web build | passed | Next.js 16.3.7 webpack build; default sandboxed Turbopack build stalled and was interrupted |
| Expo compatibility | passed | `expo install --check`, SDK 55.0.31 |
| Native bundles | passed | `expo export --platform ios --platform android`, Hermes bundle outputs in `/tmp/timely-native-export`; this is not a signed development build or real-device runtime proof |
| Neon config TypeScript | passed | explicit tsc of root `neon.ts` and `hello.ts` |
| Hello Function local response | passed | HTTP 200 and exact `Hello from Neon Functions` body |
| Neon login/link/deploy | passed | Second OAuth succeeded; project-scoped MCP installed; production linked; `neon deploy` succeeded; live Function returned expected body and HTTP 200. Broad default MCP was rejected by auto-review; scoped alternative succeeded. |
| Live Apple/Google/Resend | blocked_external | Credentials/callback domain/devices not configured or exercised |
| Full planner/offline/notifications | pending | Not implemented; no completion claim |

Visual evidence: [desktop](evidence/auth-desktop.png), [320px phone](evidence/auth-phone.png). Screenshots were captured before any authentication material was entered. Browser traces/videos were disabled. Live inspection also checked the same signed-out web screen in the Codex browser.

Fonts are bundled; license files are in `licenses/`. Native font module imports use individual weights. Exact palette is centralized in `packages/design`; full contrast/accessibility and full planner screen QA remain pending.

## Durable planner milestone — 2026-09-29

The browser suite now contains eight passing tests across desktop (1280×800) and phone (320×740). These use real delivered SMTP codes, Better Auth cookies, local PostgreSQL, IndexedDB, the production public-shell service worker and two independently signed-in browser contexts. An offline task and completion survive reload and synchronize to the second client. Recurrence future edits, move/skip/unskip/delete, stable IDs and API account/origin boundaries are exercised. Synthetic screenshots are in `docs/evidence/planner-{day,month,editor}-{desktop,phone}.png`. No credential/OTP/session material is captured.

Four real Neon integration tests pass on `timely-development`, including lost-response replay and overlapping commits during a paginated fixed-watermark bootstrap. Unit suite: 46 passing. All nine TypeScript packages, the client/server boundary guard and production web build pass. Both native Hermes bundles compile. SQLite physical-device restart, native auth, notification scheduling, the broader accessibility matrix and production release gates remain unverified.

Current screenshots demonstrate an implementation baseline, not complete stage 05/06 acceptance. Full native editor/navigation parity, drag/reorder, synchronized preferences, expanded historical coverage, explicit failed-operation recovery and reminders are still under implementation. See the stage table in `progress.md`.

## Favicon/social-provider regression checks — 2026-09-29

`TEST_BASE_URL=http://localhost:3001 pnpm exec playwright test tests/web/auth-availability.spec.ts tests/web/auth.spec.ts`: 6/6 passed. Favicon ICO and SVG return HTTP 200, metadata advertises both, and the service worker serves them offline including cache-busting queries. Public provider availability contains only two booleans with `no-store`. Missing or unreachable provider configuration disables social buttons without blocking email; retry restores availability. Existing actual SMTP OTP sign-in/reload/sign-out remains passing. This is not Google/Apple OAuth verification; credentials are still missing.

## Google credentials follow-up — 2026-09-29

Google web credentials are now configured in the ignored server environment. Live provider availability reports Google enabled and Apple disabled. A real Google social initiation returns HTTP 200 with state, PKCE and the expected localhost:3001 callback, resolving the previous `PROVIDER_NOT_FOUND` response. Google's authorization endpoint reports `redirect_uri_mismatch`, so full consent/session verification remains blocked on registering the local callbacks. No provider tokens, credentials or authorization URLs were logged. The same six targeted browser checks pass (6.7 seconds), with Google enabled and real SMTP email authentication preserved. Signed-out screenshots were refreshed.

## Mobile code milestone / audit — 2026-09-30

- Last executed unit suite: 58 passing tests. Real Neon development integration suite: 5/5 passing, including targeted future-delete Undo and idempotent replay.
- Last browser suite: 12/12 passing before the final shared calendar/editor helper refactor. The subsequent production web build passed, including TypeScript; browser regression verification of that last refactor remains pending.
- iOS/Android Hermes export passed to `/tmp/timely-stage06-export-final`. Local iOS simulator Release build and subsequent ad-hoc-signed build succeeded. No physical-device or Android native runtime pass is claimed.
- The first unsigned simulator app rendered the sign-in screen, then failed SecureStore access with a Keychain entitlement error. Retesting the signed build is still pending; native OTP, authenticated planner flows, SQLite restart and web/mobile convergence remain unverified.
- `tests/mobile/planner.yaml` is a prepared, unexecuted Maestro flow. It is not automated native evidence yet.
- Four tabs, full native recurrence editor, scoped actions/Undo, explicit reorder, links and bounded native Review/Search/Settings are now present in code. Native visual/accessibility/runtime evidence and production provider/reminder gates are still outstanding. Full remaining work is in [implementation-audit.md](implementation-audit.md).

## Native design/runtime milestone — 2026-09-30

- `pnpm test`: **59 pass**, five DB tests intentionally skipped without integration configuration. New regression protects civil date formatting from Temporal/Intl bridging and date shifts. Prior real Neon 5/5 evidence remains; no DB change in this design pass.
- `pnpm typecheck`: all nine packages pass; `pnpm lint`: import boundaries pass. Final sheet/date refinements also pass native typecheck. `git diff --check` passes.
- `TEST_BASE_URL=http://localhost:3001 pnpm test:e2e`: **12/12 pass** in 21.1 seconds. This closes the pending browser regression check after the shared helper refactor.
- Signed iOS simulator Release rebuild passes, Xcode 26.2 / iPhone 17 Pro / iOS 26.2 / Expo 55.0.31 / RN 0.83.10. Android Hermes export passes; final sheet/date-label refinements were subsequently checked in the iOS build and native TypeScript, not re-exported on Android.
- Local SMTP native sign-in/verification succeeds. The previous Keychain failure was specific to the unsigned artifact. Authenticating exposed a real Hermes date-heading crash; the final build now renders Day/Week/Month without it.
- Native interaction proof: title-only creation; duration/priority/daily recurrence and five-date preview; a future-scoped title edit; completion and Undo; all four tabs; real title search; sign-out and email reauthentication. A final separate scope step is visibly reachable immediately after Save.
- Backend stopped: created a plan locally, terminated/relaunched the embedded app, verified the plan and pending operation, completed it, then restarted the backend. Sync now produced Synced and zero pending. After sign-out/local purge, reauthentication/bootstrap restored all three plans and the completion. This verifies server persistence as well as local restart; it is not web/mobile concurrent-edit or physical airplane-mode proof.
- Native screenshots under `docs/evidence/mobile-*-ios.png` show only synthetic planner content or signed-out UI. No authentication material is stored in those files.
- Still pending: Android installed runtime, physical provider/push flows, full native gesture/large-text/landscape/keyboard matrix and automated Maestro execution. No stage acceptance was promoted to complete.

- Final scope-flow proof: changed duration from 20 to 25 minutes with Only this occurrence; today rendered 25 and next day rendered 20. The scope step was captured in `mobile-scope-ios.png`. Measured normal-text contrast and corrected muted-on-lime captions to navy (13.07:1); white/blue 5.86:1, muted/white 4.80:1 and muted/warm 4.54:1.

## 2026-09-30 — Bottom dock and calendar preference synchronization

- `pnpm test`: 62 passing unit tests; six DB tests intentionally skip in the normal run. New tests cover independent preference groups, atomic reminder policy, invalid writes, offline JSON reload, bootstrap rebase/lost-ack retry and all seven calendar alignments.
- `RUN_DB_TESTS=1` with ignored `.env.neon-development`: 6/6 real Neon tests passed. Added exact preference retry, delayed stale operation, independent-group merge, account isolation, fixed paginated preference snapshot and mixed preference/task rollback checks. Migration 0002 also applied to local Postgres. No production migration.
- All nine workspace type checks and client/server boundary lint passed. Web production build and ad-hoc-signed iOS simulator Release build passed.
- Actual UIs, existing synthetic account: iOS Sunday-first setting reached a freshly authenticated web client; native week showed Sun 27 through Sat 3; web/native month headings started Sunday. Web All occurrences reached native. With the API stopped, native changed back to Grouped, showed one pending operation, survived install/force-close/relaunch with that operation and selection intact, then automatically synced after API restart. Web received Grouped; native showed zero pending. Web reload retained both calendar preferences.
- All four native tab destinations navigated with the selected icon pill. Final dock inspected on iPhone 17 Pro/iOS 26.2, with warm safe-area background and content remaining in the scrollable scene above it. Screenshot: `evidence/mobile-tabbar-ios.png`; web settings: `evidence/web-calendar-preferences.png`.
- This milestone used manual CUA interaction; no new full Playwright/Maestro suite run is claimed. Native CUA scroll did not move the Settings viewport, so it is not gesture-scroll evidence. Android runtime, large-text/landscape and physical-device accessibility/notification gates remain unverified.


## 2026-10-05 — lifecycle, history, recovery and local reminders

- `pnpm test`: 73 passing tests; the ten DB integration tests intentionally skip without the integration environment. New fixtures cover rejected atomic-batch isolation, exact queued-ID retry, task-dependent discard, interrupted native scheduling recovery, offline skip/completion cancellation, permission revocation, account isolation, the 48-entry budget and elapsed-reminder dedupe. Calendar layout preferences preserve reminder fingerprints; scheduling policy changes invalidate them.
- `RUN_DB_TESTS=1 node --env-file=.env.neon-development node_modules/vitest/vitest.mjs run packages/db/src/planner.integration.test.ts`: 10/10 pass on the isolated development branch; latest run 95.82 seconds. Tests use synthetic owners and clean them up. Includes recent-session deletion/cascade, wrong-owner protection, installation unregister, 185 concurrent limiter requests permitting exactly 180, fixed historical pagination/filter binding and existing transaction/response-loss cases. No production migration/data change.
- All nine workspace TypeScript checks, boundary guard and production web build pass. A final strict test-array annotation was needed after dependency resolution; it is corrected. The lint command remains a boundary guard, not a general style audit.
- Final real Chrome suite after storage hardening: 18/18 pass on desktop and 320px phone in 1.4 minutes. Real local Better Auth/SMTP/Postgres are used throughout. New evidence covers explicit scoped Undo/date moves, stored navigation, bounded online history, a delayed real history response ignored after filter changes, deletion revoking a second actual session, and an IndexedDB v1→v2 migration retaining a real offline creation/identity/clock through reload/reconnect. No fake authentication or persistence is used.
- Browser fixes found during verification: month grid overflow, ambiguous status-filter label, and test fixture authentication rate limiting. The second-session fixture uses a separate synthetic client IP; the real limiter remains enabled. Updated synthetic Day/Month/editor screenshots remain under `evidence/planner-*.png`; desktop Day and 320px Month were visually inspected.
- `pnpm install --frozen-lockfile` passes. Native dependency resolution now uses Expo 57's bundled compatible set through explicit mobile dependencies, overrides and the exact-version pnpm hook; no unmet native peer warning remains. `pnpm doctor:mobile`: 21/21 pass with network checks enabled.
- Final iOS/Android Hermes exports pass at `/tmp/timely-supported-final-export`. Signed generic iOS simulator Release build and Android Debug build passed before native peer correction (`/tmp/timely-finish-ios.log`, `/tmp/timely-finish-android.log`). Final graph builds also passed: signed ARM64 iOS simulator Release and Android Debug (18m 25s); exact commands/artifacts/logs are in progress. These are compilation evidence, not device notification or provider acceptance.
- Simulator automation stalled despite a short requested timeout. No new native screen interaction, SQLite migration runtime, account-cleanup runtime or OS notification delivery is claimed. Prepared Maestro flows remain unexecuted. Real physical iOS/Android push/provider gates remain `blocked_external`.
- CI now defines disposable PostgreSQL/Mailpit services and executes real DB and browser checks, but no remote CI run is claimed. Local release/operations/deployment preparation is in the new documents; publication, production migrations, DNS and store submission have not occurred.

The final storage review adds encoded shadow comparison to retain in-place transactional changes and refuses a newer SQLite schema without overwriting it. Checks after that review are recorded in the final progress entry. Remote delivery, provider link/unlink, date-index/checkpoint scale work and the complete acceptance matrix are still unfinished.

- SQLite continuation: the same migration/persistence functions used by expo-sqlite are tested against actual Node SQLite, including a file close/reopen with two owners and pending work, transaction interruption rolling back metadata/shadows/outbox, wrong-owner read rejection, malformed state and future database/account schema protection. Three tests pass. This proves SQL logic and rollback in that driver; equivalent native SDK/runtime proof remains open.
- Final web build, all nine workspace types, 73-test unit suite and iOS/Android Hermes exports pass after storage hardening/extraction. A configured-secret value scan found no server credentials in 119 public web/native artifacts; it is a targeted check, not complete security sign-off.
