# Implementation progress

## Current state
- Updated: 2026-09-29.
- Branch: `main`; tested implementation milestone: `df12576`. Subsequent setup documentation/installed-skill commit is visible with `git log -1`.
- Current milestone: retained stage 00 real local OTP proof; stage 01 foundation and stage 02 shared domain under implementation.
- Owner's newest request: set up/deploy the specified Neon project. Completed: CLI login, project-scoped MCP, production link, exact config deployment and live HTTP 200 verification.
- Last completed end-to-end capability: web email OTP sign-in through actual SMTP delivery and PostgreSQL, reload restoration and sign-out, tested at desktop and phone widths.
- Original `initial.md` and `planner-agent-pack/` preserved unchanged. Canonical copies at `docs/planner/`.
- Exact next action: continue remaining stage 01/02 planner work, then task persistence/API. Use a disposable Neon development branch for planner migrations; current root link intentionally remains production for the completed owner-requested hello deployment. Do not substitute managed Neon Auth into planner code.

## Stage tracker
| Stage | Status | Evidence / remaining work |
| --- | --- | --- |
| 00 Authentication | blocked_external | Real local SMTP OTP/session proof passes. Web/native Google and Apple code exists; provider credentials, HTTPS callback domain, physical iOS/Android flows, linking/relay/cancellation evidence still needed. |
| 01 Foundation | in_progress | Pinned pnpm workspace/lockfile, strict TS, fonts/licenses/tokens, CI, auth shells and web/native bundles pass. Full navigation/primitives, native visual/runtime proof, complete accessibility checks remain. |
| 02 Shared domain | in_progress | Validated rules, all recurrence frequencies/selectors, clamp/skip, time/DST, state, scopes, sparse exceptions/history, reminder planner and HLC/group merge; 36 tests pass. More concurrent structural conflict/property/scale/native runtime fixtures remain. |
| 03 Database/API | pending | Only generated real auth schema/migration and protected `/api/v1/me`; task schema, repositories, owner-scoped sync API and transaction checks remain. |
| 04 Offline/sync | pending | Pure ordering module only; durable IndexedDB/SQLite adapters, outbox and transport not implemented. |
| 05 Web planner | pending | Runnable auth proof, not task planner. |
| 06 Mobile planner | pending | Native auth proof bundles, not task planner. |
| 07 Reminders | pending | Pure planner tested; native scheduler and server worker not implemented. |
| 08 Review/Search/Settings | pending | Not implemented. |
| 09 QA/release | pending | Not release-ready; see QA evidence. |

## Checks actually run
- `pnpm install`: passed. Final explicit @better-auth/utils 0.4.2 pins resolve peer warnings. Native React DOM is pinned to 19.2.0 alongside Expo's React 19.2.0.
- `pnpm typecheck`: 9/9 packages passed.
- `pnpm test`: 36 tests in 3 suites passed.
- `pnpm lint`: import/secret boundary guard passed. This is a boundary check, not a comprehensive style linter.
- `pnpm exec auth generate --config packages/auth/generate.config.ts --output packages/db/src/auth-schema.ts --yes`: passed. Initial empty-schema diagnostic expected; schema was then generated.
- `pnpm db:generate` and local `pnpm db:migrate`: passed against Docker PostgreSQL 17.
- `node scripts/auth-smoke.mjs`: all local auth checks passed; no secrets printed.
- `pnpm test:e2e`: 2 real-browser auth tests passed, Chrome desktop/320px phone. Signed-out screenshots under `docs/evidence/`.
- `pnpm --filter @timely/web exec next build --webpack`: passed. Build script now uses webpack after sandboxed Turbopack stalled; no test/build checks disabled.
- `expo install --check`: passed. iOS and Android `expo export` bundles passed, artifacts under `/tmp/timely-native-export` (not signed native builds).
- Exact root Neon config/handler TypeScript passed; direct handler invocation returned expected HTTP 200 body.

## External dependencies
| Missing item | Gate | Owner next action |
| --- | --- | --- |
| Google/Apple/Resend provider configuration | Planner auth proof beyond local OTP | Neon login/setup is complete; provider credentials are separate. |
| Google web/iOS/Android OAuth IDs and server secret | Provider proof | Provide environment file path/configure callbacks, never paste secrets in progress. |
| Apple Service/App IDs, generated client secret, HTTPS callback domain | Native Apple + web/Android proof | Configure developer account and callback; exact steps in `setup.md`. |
| Verified Resend sender and API key | Real mail delivery | Configure sender; local Mailpit works. |
| Signed development builds/physical devices | Native auth/reminder verification | Run stated iOS/Android matrix when credentials/build identifiers are ready. |

## Decisions
- `decisions/001-foundation.md`: self-hosted Better Auth/Neon driver/version choices.
- `decisions/002-domain.md`: Temporal, recurrence identities/revisions and LWW policy.
- Root Neon config is separate from planner authentication architecture.

## Handoff
- Files: `apps/web` real auth UI/routes; `apps/mobile` native auth adapter/proof UI; `packages/auth` real Better Auth/mail configuration; `packages/db` generated app-managed auth schema and migration; `packages/contracts/domain/sync` pure domain/ordering; `packages/design` exact tokens; `tests`, `scripts`, CI and setup/QA docs.
- Local runtime: web dev server on localhost:3000 and Docker `timely-postgres-1`/`timely-mailpit-1` left running for review. Local env in `apps/web/.env.local`, ignored and permission 0600. It is local development configuration, not the owner's provider credentials.
- No planner production DB migrations occurred. The separate requested hello Function was deployed and verified. No claim of full offline sync/native notification capability.
- Root `neon.ts` and `hello.ts` exactly match latest owner request; CLI is installed under `~/.local/bin`. Skills installed; project-scoped MCP configured. Broad default MCP setup was rejected by automatic approval review, and the safer project-only configuration succeeded.
- Domain revision transitions still need adversarial multi-device fixtures and transaction integration before stage 02/03 completion. Do not treat pure merge tests as end-to-end sync evidence.
- Finish remaining stage 01/02 checks, then implement task migrations, authenticated transactional sync API and both durable local adapters. Preserve the working auth proof.
- Neon deployment URL and exact verified setup are in `neon-setup.md`. `.neon`, root `.env.local` and `.codex/config.toml` are ignored; credentials are permission 0600.

- Post-deploy `neon config plan` still proposes `~ function api` for the declared source; no claim of a no-op plan. Actual live handler output was verified successfully.
