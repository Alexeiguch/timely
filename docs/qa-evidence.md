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
