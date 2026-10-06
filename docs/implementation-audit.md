# Implementation audit — current continuation 5–6 October 2026

## Current changes and remaining work — 2026-10-05

The detailed September audit below is a historical baseline. This section supersedes its statements that the following resources/flows are missing:

- Stage 03: owner-only bounded history and materialization projections with fixed pagination, recent-auth account deletion/session cascade, installation unregister and shared PostgreSQL planner rate limits now exist. Ten real isolated-Neon tests pass, including account isolation and stable history during concurrent edits. Notification token/capability/coverage resources and journal/feed checkpoint/retention remain missing.
- Stage 04: IndexedDB v2 and SQLite v3 entity/outbox migrations, stored-payload validation, dependent-operation retry/discard and confirmed discard/sign-out are implemented. The real browser migration preserves an offline creation/UUID/clock through reconnect. Native migration runtime, indexed scheduled-date queries, checkpointing and representative large-account failure/scale evidence remain.
- Stage 05: scoped delete/Undo, explicit move/reorder, date drops, heading swipes, owned links and durable account-specific navigation exist. Eighteen real browser checks pass on desktop and 320px phone, including deletion revoking another session and stale real history responses after a filter change. Full keyboard/screen-reader/zoom/dense-content acceptance is still open.
- Stages 07–08: synchronized reminder defaults, contextual native permission and local seven-day/48-entry scheduling with durable crash recovery/cancellation and owned tap routing exist. Review/Search have date/state/priority/series/query filters and online snapshot paging. These are code plus deterministic adapter tests, not proof of physical OS delivery. Remote ownership/tokens/Inngest/dispatch/receipts, cross-month monthly-series groups and safe provider linking/unlinking remain missing.
- Stage 09: CI now configures disposable Postgres/Mailpit, migrations, transaction tests and built-app browser checks. Deployment, operations and release checklists are prepared locally. Hosted CI and production backup/rollback checks have not run; no publication was authorized or performed.

Expo 57 native peers are explicitly pinned to Worklets 0.10.1, Reanimated 4.5.1 and Metro config 0.86.3. Expo Doctor passes 21/21; current Hermes exports and web production build pass. Final signed ARM64 iOS simulator Release and Android Debug builds pass with that supported graph. Simulator automation stalled, so no new native runtime pass is claimed. Previous selected iOS simulator evidence remains valid only for its recorded older milestone.

No stage is promoted to complete. Exact next actions, final native build outcomes and credential gates are in [progress](progress.md), [release readiness](release-readiness.md) and [QA evidence](qa-evidence.md). Current external gates are registered Google callbacks/Android signing proof, Apple credentials/HTTPS callback, hosted Resend, EAS/push/Inngest configuration and physical iOS/Android evidence. Engineering gaps above are independent of those external gates.

## Historical detailed baseline — 2026-09-30


**Update after this audit:** the mobile design/runtime milestone fixed Keychain build signing, a Hermes date-heading crash and off-screen recurrence scope selection. Selected iOS simulator authentication/planner/offline-restart/reconnect flows now pass; native logos/availability and screenshots exist. Browser regressions now pass 12/12 after the shared-helper refactor, and unit tests total 59. See `progress.md` and `qa-evidence.md` for the newer evidence. The detailed list below is the pre-fix audit baseline; Android/physical-device and later-stage gaps remain.

Compared the current working tree (including uncommitted mobile work) with all ten canonical stage files. **No stage is yet signed off against every acceptance criterion.** This does not mean the stages are empty: the web planner, shared domain, authenticated persistence and offline synchronization have substantial working implementations.

“Implemented” below means present in code; it does not imply native runtime verification or production deployment. Step numbers refer to the corresponding file in `docs/planner/stages/`. Historical entries in QA/progress remain records of their original milestones; this audit describes the latest state.

## 00 — Authentication: partially implemented; external verification blocked

- **Steps 1–3:** Pinned dependency matrix, self-hosted Better Auth/Drizzle, auth migrations, sign-in/session/sign-out code and protected account endpoint exist. Real web email OTP, restoration, revocation and protected access have passed locally. Native restoration and sign-out still need runtime proof.
- **Step 4:** Expo integration and secure storage exist. Production origins, registered app identifiers, Apple credentials, native Google configuration and hosted email configuration remain outstanding.
- **Steps 5–6:** Native Google, native iOS Apple and browser OAuth paths exist, but successful provider consent/token exchange/session restoration have not been demonstrated across the required platforms. Web Google initiation works; the last actual Google result was `redirect_uri_mismatch`. Cancellation, denied consent, Apple repeat authorization/missing profile/private relay and explicit account linking still need complete evidence.
- **Step 7:** OTP request/verification, expiry, cooldown and error handling exist; local SMTP proof passes. Hosted Resend delivery and native email/restart proof remain.
- **Immediate native issue:** The first unsigned simulator app hit a SecureStore Keychain entitlement error. The subsequent ad-hoc-signed iOS simulator build succeeded, but its authentication behavior has not been retested. This is an engineering verification task, separate from missing physical-device/provider access.
- **External requirements:** Register the two local Google callbacks documented in `setup.md`; configure iOS/Android OAuth clients and signing identities; provide Apple App/Service IDs and server secret with an HTTPS callback; configure verified Resend sender/key; exercise signed builds on real devices.

## 01 — Foundation: mostly implemented; acceptance incomplete

- **Steps 1–2:** Repository preservation, pnpm workspace, pinned toolchain/lockfile and development/build/test/migration scripts exist. Reproducible native clean-install/build verification on both platforms remains.
- **Step 3:** Strict TypeScript, server import boundary checks and server environment validation exist. The current `lint` script is only a boundary guard: comprehensive formatting/style checks and explicit validated native public-environment configuration remain gaps.
- **Steps 4–6:** Four destinations exist on both clients; tokens, bundled licensed fonts, core controls and loading/error states exist. Finish the component/error-boundary audit, measured contrast, keyboard/screen-reader behavior, native large text and 200% web zoom. Capture native seeded visual evidence and verify genuine font weights in runtime.
- **Step 7:** Environment-specific EAS profiles/schemes exist; real production identifiers, signing and final build configurations remain. Current `com.example.timely` identifiers are placeholders.
- **Step 8 / documentation / CI:** Synthetic test fixtures, setup instructions, ADRs and basic checks workflow exist. A representative large seed and measured performance are still missing; native/DB/browser acceptance is not part of the current basic CI job.

## 02 — Shared domain: substantial implementation; further proof required

- **Steps 1–8:** Validated task/command contracts, civil time, recurrence, stable occurrence identities/revisions, scoped edits, immutable terminal history, overdue/progress calculation, pure reminder plans and deterministic change ordering exist. Shared editor/calendar/preset/order/deep-link helpers and scoped delete Undo were added during mobile work.
- **Missing acceptance evidence:** Broader overlapping-scope/property-style invariants, realistic scale fixtures, and identical serialized time/recurrence fixtures actually executed under Hermes and Node. Successful Hermes bundling does not establish identical runtime behavior.
- **Compatibility work:** The new targeted delete-restore field extends the unreleased sync protocol. Coordinate backend/client rollout and establish compatibility/rollback rules before release; older clients cannot simply be assumed compatible.

## 03 — Database/API: core sync works; several required resources absent

- **Step 1:** Auth, definitions, revisions, occurrence/event, installation, feed, operation, snapshot and job-outbox tables exist. Synchronized preference storage and notification token/coverage/job delivery resources are unfinished.
- **Steps 2–3:** Transaction-capable driver, development Neon migrations and owner-scoped repositories are implemented and tested. Extend authorization tests to each new resource as it is added.
- **Step 4:** Existing routes cover account proof, provider availability, installation registration, bootstrap, push and pull. Missing canonical routes: `POST /api/v1/occurrences/materialize`, `GET /api/v1/history`, `POST /api/v1/devices/reminder-coverage`, `DELETE /api/v1/devices/current`, and `POST /api/v1/account/delete`. Preferences need shared sync commands rather than a parallel CRUD path.
- **Steps 5–6:** Transactional deduplication, merge/feed/job invalidation and consistent paginated snapshots work. Production retention/checkpointing and expired-cursor behavior tied to retained history remain unfinished.
- **Step 7:** Bounded server materialization, overdue catch-up and paginated historical search/loading are absent.
- **Step 8:** Basic platform/zone installation registration exists; push token/capability updates, coverage reporting and unregister are missing.
- **Step 9:** Recently authenticated account deletion, session revocation and complete owned-data/notification cleanup are missing.
- **Security/operations:** Planner throttling is process-local; a shared production limiter and operational/recovery evidence remain. Better Auth's database-backed auth rate limit already exists.

## 04 — Offline/sync: working baseline; storage/recovery gaps

- **Steps 1, 3–7:** Shared transport/store interfaces, canonical shadows, atomic local commands/outbox/clock, push/pull/rebase, staged bootstrap, retry and auth-expiry retention exist. Tests cover important response-loss and concurrent-edit cases, but not the entire prescribed matrix.
- **Step 2:** IndexedDB and SQLite currently store an account-wide aggregate. Indexed entity/range/history storage, real versioned upgrade migrations with queued work, and equivalent actual-adapter contract tests remain. SQLite is namespaced by API/account; browser storage is account-scoped within its origin, so same-origin backend/environment switching needs review.
- **Step 8:** Browser coordination/live subscriptions and native foreground/network synchronization exist; multi-tab/account-switch and mobile concurrency evidence needs expansion.
- **Step 9:** Safe public-shell/font/static caching works and browser offline reload passes. Continue verifying cleanup and private-data isolation across service-worker/build upgrades.
- **Step 10:** Account purge and protection against sign-out with pending work exist. Explicit invalid-operation repair/discard, confirmed unsynced discard, clearer historical coverage and notification cleanup are missing.
- **Missing acceptance evidence:** Native offline force-close/relaunch and subsequent web/mobile convergence, actual-store migration with pending operations, cursor expiration, account switch, broader failure permutations and measured initial download for a realistic account.

## 05 — Web planner: usable baseline; interaction parity incomplete

- **Step 1:** Responsive four-destination shell exists; restoring the last selected mode/date and durable URL navigation state are missing.
- **Step 2:** Day/Week/Month, period heading, Today/buttons/date input work. Touch period swipes and synchronized first-weekday behavior remain.
- **Steps 3, 5–6:** Task cards, overdue/terminal sections, week agenda/columns, month calendar/grouped strips and full custom recurrence editor exist. Complete the visual/keyboard audit and inspect history/original-date presentation. Quick Add currently opens the full editor; progressive disclosure remains to refine.
- **Step 4:** Drag between dates and manual reorder are missing. Today/Tomorrow and editor date changes work; a complete explicit Move menu/keyboard interaction is still needed.
- **Step 7:** Complete/reopen/skip/unskip and recurring edit scopes work. Delete is currently occurrence-only, with no future/series scope chooser; durable Undo feedback is missing on web.
- **Step 8:** Sync/auth-expiry integration exists. History pagination, broader overdue coverage and exceptional-operation recovery remain; overdue is explicitly limited to the preceding year.
- **Step 9:** Safe focused occurrence/date URL links and restored URL state are missing on web.
- **Missing evidence:** Full keyboard/menu/dialog focus restoration and contrast checks; 390/768/1440 widths, 200% zoom, long/dense content and reduced motion; full mode/scope/action coverage and Week/overdue/terminal screenshots. Latest shared-helper refactor builds successfully but the browser suite has not been rerun since that refactor.

## 06 — Mobile planner: major code milestone; runtime acceptance unfinished

- **Steps 1–5:** Four Expo Router destinations, loading/restoration handling, Day/Week/Month, calendar/day strips, virtualized lists, native date/time inputs, full editor, recurrence presets/custom selectors, preview and edit scopes are now implemented in code.
- **Step 6:** Complete/reopen, skip/unskip, move, scoped delete and short Undo exist. Explicit untimed reorder controls exist. Long-press drag is not implemented; stage 06 describes it as optional. The planned Gesture Handler/Reanimated integration has been deferred in favor of a narrow heading-only PanResponder swipe, documented in ADR 004.
- **Steps 7–9:** SQLite-backed saves, sync status, reauthentication path, foreground/network/zone refresh and ownership-checked occurrence/date links exist. Notification event routing still depends on stage 07.
- **Missing acceptance:** Actual authenticated iOS and Android planner runs; create/edit/complete/skip/move/recurrence flows; offline force-close/restart; web/mobile conflict convergence; link safety in running apps; zone/DST views; keyboard, nested sheets, Android Back, large text, landscape and 320–430 px layouts; seeded screenshots on both platforms.
- **Build evidence:** iOS and Android Hermes exports pass. An iOS simulator Release build and subsequent ad-hoc-signed build pass. First installed unsigned build displayed sign-in but failed on Keychain access; retest the signed build before claiming native OTP or planner runtime success. Android native build/runtime and the checked-in Maestro flow have not been run.
- **Presentation follow-up:** Requested social logos are present on web; native sign-in still uses text buttons and lacks the web provider-availability presentation.

## 07 — Reminders: delivery implementation largely missing

- **Step 1:** Task reminder fields and pure timing/fingerprint planning exist. Synchronized account defaults and full reconciliation are missing.
- **Step 2:** Contextual notification permission requests, denial states and complete settings recovery are missing.
- **Step 3:** Native local scheduler, stable native-ID mappings, rolling seven-day plan, 48-entry budget and actual schedule reconciliation are missing.
- **Step 4:** Durable local cancellation/rescheduling side-effect queue and crash recovery are missing.
- **Step 5:** Push tokens/capabilities, successful local coverage reporting and local/remote ownership handoff are missing.
- **Step 6:** Task mutations enqueue invalidations, but no Inngest worker, durable due-job processing or verified reconciliation cadence is implemented.
- **Step 7:** Push dispatch, receipts, invalid-token cleanup and bounded retry/uncertain-result policy are missing.
- **Step 8:** Notification tap listeners/current-state routing are missing. Optional notification action buttons must not bypass shared durable commands.
- **Steps 9–10:** Foreground reminder cues, delivery/coverage settings and service/job monitoring are missing; an ordinary overdue planner section already exists.
- **All delivery gates remain:** Real iOS/Android timing, cancellation, terminated/offline behavior, permissions, dense schedules, zone changes and duplicate-prevention evidence. Installing `expo-notifications` is not reminder delivery.

## 08 — Review/Search/Settings: baseline only

- **Review 1:** Native date/status filters exist; web is selected-period only. Recurring-series filters and broader equivalent filtering remain.
- **Review 2:** Shared terminal snapshots exist and native cards show original/terminal context. Complete equivalent web presentation and prove it through recurrence edits/moves.
- **Review 3:** Cross-month monthly-series history/grouping and a readable list equivalent are missing.
- **Review 4:** Shared scheduled and elapsed metrics exist; native displays both. Web Review lacks the elapsed completion rate and full corresponding empty states.
- **Review 5:** Cards invoke existing shared task actions. Finish web action parity and native runtime checks.
- **Review 6:** Owner-only paginated online historical loading is missing. Native queries downloaded ranges up to 366 days; web queries its selected planner period.
- **Search:** Title/notes search exists. Priority/series filters, web date/state filter parity, definition-versus-occurrence result treatment, indexed performance and online paginated older-history search remain.
- **Settings:** Synchronized reminder toggles/offsets/morning time, first weekday, persisted grouping and reactive cross-client updates are missing. Device permission/delivery coverage is missing. Zone and sync diagnostics exist; native grouping is session-only.
- **Account lifecycle:** Provider method display, safe explicit link/unlink with recent authentication and last-method protection, account deletion and full sign-out notification cleanup are missing. Pending changes currently block sign-out; offer Sync now/confirmed discard and recovery as specified.
- **Acceptance:** Complete two-account/linking/deletion tests and preference synchronization/reminder reconciliation tests; capture accessible Review/Search/Settings evidence on both platforms.

## 09 — QA/operations/release: not release-ready

- **Integrated matrix:** Existing web/domain/DB tests cover part of the matrix. Full native, provider, reminder, history, settings and accessibility acceptance is missing.
- **Failure/scale:** Finish actual-device offline convergence, schema upgrade with outbox, cursor/tombstone retention, database outages, worker failures, clock/zone cases, invalid push tokens and dense reminder tests. No measured 1,000-task representative-device benchmark exists.
- **Security review:** Complete callback/audience/nonce verification with real providers, account lifecycle cleanup, shared production rate limits, secret-bundle/log review, dependency review, indexes and private-cache/account-switch checks.
- **Release deliverable 1:** `setup.md` exists; retain it and update reproducibility as remaining functionality lands.
- **Deliverables 2–4:** `deployment.md`, `operations.md` and `release-checklist.md` do not yet exist. Vercel/Neon/Inngest/EAS configuration, monitoring, backup/restore and executable recovery/rollback guidance remain.
- **Deliverable 5:** `qa-evidence.md` exists but is not a complete integrated acceptance report.
- **Artifacts:** Final signed iOS/Android release artifacts, production environment templates, store metadata/privacy descriptions and compatible DB/protocol rollback plans remain. Store submission, publishing and DNS changes require separate authorization once prepared.

## Latest evidence and deployment distinction

- Last unit run: **58 passing tests**; five DB integration tests skip without the explicit integration environment.
- Real Neon development integration run: **5/5 passed**, including scoped future-delete Undo and exact replay.
- Last browser run: **12/12 passed** before the latest shared web-helper refactor. Do not call that a regression pass for the later changes.
- Latest production web build: passed, including its TypeScript phase. Workspace types/boundaries passed earlier in the mobile milestone; refresh affected checks after subsequent fixes.
- Both Hermes exports and the iOS simulator builds passed; native acceptance remains unverified as detailed above.
- **Deployed:** The separately requested Neon hello Function/auth/uploads setup. **Not deployed:** The complete Timely planner, production self-hosted auth backend or reminder service. The local built web preview on port 3001 is not a production deployment.

## Recommended completion order

1. Retest the signed simulator build and record the current mobile milestone; rerun browser regression checks for the latest web refactor.
2. Close foundational/domain acceptance gaps and stage 03 missing preferences/history/account/device resources, then stage 04 indexed storage/migration/recovery gaps.
3. Finish web interaction parity and native acceptance, using the same shared commands.
4. Implement and verify stage 07 reminders, then complete stage 08 supporting/account screens.
5. Resolve external provider/device gates alongside independent work, and complete stage 09 operational/release evidence last.

Calendar integrations, widgets, collaboration, payments, SMS and AI task generation are outside the agreed first release; they are not missing implementation steps.

## Update — 2026-09-30, calendar preference milestone

The previous missing **first weekday / month grouping** items are now implemented across server, shared sync, web and native. Owner-scoped preference records participate in the ordinary offline command queue, ordered feed and fixed bootstrap snapshots. Six real Neon transaction checks passed. Native-to-web and web-to-native setting changes were verified through the actual signed-in UIs. See ADR 006 and the latest progress/QA entries for precise scope.

The prior signed-iOS runtime and web regression retest blockers were resolved in the mobile design milestone (documented in `mobile-verification.md`). Reminder settings UI and delivery, account lifecycle, historical coverage, indexed storage/recovery and the remaining physical-device/release acceptance gates are still open. The current step after calendar preferences is the remaining stage 03 history/account/device contract, alongside stage 04 durable-store migration/recovery design. Do not interpret this update as completion of stages 03–09.
