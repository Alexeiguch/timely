# QA evidence — 2026-09-29

This is an authentication/foundation/domain milestone, not full planner acceptance.

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
