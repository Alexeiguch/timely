# Implementation progress

## Current state

- Updated: 2026-10-06. The planner is usable in local web/native development; the complete first-release acceptance is still unfinished. See [release readiness](release-readiness.md) and [implementation audit](implementation-audit.md).
- Current continuation: owner-requested recurring-task streaks are implemented on web and native with shared deadline/history projection, opt-in editors, flame/count/recent markers and admission-enforced Skip rejection. The PR review's delayed-edit/accepted-Skip replay bug is fixed; terminal policy stays tied to the authored revision. See [streak contract](planner/STREAKS.md) and [ADR 012](decisions/012-recurring-task-streaks.md). Earlier continuation:  owner-scoped recent-session account deletion and device unregister, distributed PostgreSQL throttling, sync repair/discard, web scoped deletion/Undo/move/reorder/date-drop/navigation, bounded fixed-snapshot historical search, reminder defaults and native local scheduling. IndexedDB v2 and SQLite v3 migrate aggregate storage into indexed canonical records and pending operations while preserving clocks, UUIDs and staging. ADRs [008](decisions/008-account-recovery.md), [009](decisions/009-history-local-reminders.md), [010](decisions/010-local-storage-migrations.md) describe these changes.
- Latest verified checks: 94 unit/SQLite cases, including final targeted replay regressions; both isolated-Neon streak checks pass; all nine workspace type checks, boundary guard, web build, both targeted desktop/phone streak checks and both Hermes exports pass for the fix. Prior milestone: 90 unit tests; real isolated-Neon streak persistence/Skip/owner-isolation check passes, with the existing ten DB checks also passing in this session; all nine workspace type checks; boundary guard; production web build; 20/20 real desktop/320px phone browser tests. Browser migration preserves an actual offline queued creation through reload/reconnect. Final streak Hermes exports pass for both platforms. Prior checkpoint Expo Doctor 21/21, signed ARM64 iOS simulator Release and Android Debug builds passed with the supported native dependency pins; streak interaction has not yet been verified on a native device.
- Local review: built web at `http://localhost:3001`, Docker Postgres and Mailpit. Production/root Neon hello project is unchanged; no publishing, DNS or store submission was performed.
- Branch at continuation start: `main`, clean working tree. Current work is on `codex/finish-planner`; use `git log -1` for the checkpoint after final verification.
- Isolated Neon development branch: `timely-development` / `br-autumn-mouse-b4zwfmwu`. Use ignored `.env.neon-development` for its tests, not the root production environment.
- Exact next engineering action: verify streak creation/completion/reopen/late reset on signed iOS and Android development builds, including restart/offline travel fixtures; then resume the remaining first-release work below. Earlier next engineering action: verify the supported Expo peer set and equivalent SQLite migration with pending work on native, finish indexed date projections/checkpointing and the stage 04 failure/scale matrix, then implement remote notification token/coverage handoff and durable Inngest delivery. Continue native/accessibility/provider evidence alongside this work. Local scheduling is implemented; remote delivery remains absent.

## Stage tracker

| Stage | Status | Evidence / remaining work |
| --- | --- | --- |
| 00 Authentication | blocked_external | Real SMTP OTP, restoration/revocation and selected signed iOS simulator flows pass. Real Google consent/token exchange, Apple credentials/HTTPS callback, Resend and physical provider proof remain. Native Google IDs are locally configured; Android signing identities still need registered proof. |
| 01 Foundation | in_progress | Strict workspace, bundled design/fonts, web/native shells, builds and CI configuration. Full accessibility/error-boundary/environment/reproducibility acceptance remains. |
| 02 Shared domain | in_progress | Recurrence/scopes/terminal history/time/reminders/ordering tested. Broader overlap/property/scale and actual Hermes versus Node fixture evidence remain. |
| 03 Database/API | in_progress | Owner-scoped sync/preferences, dedupe/fixed snapshots, bounded history/materialization, recent-auth deletion, unregister and shared limiter pass real DB checks. Notification token/coverage resources and retention/checkpointing remain. |
| 04 Offline/sync | in_progress | Atomic durable commands, shadow rebase/staged bootstrap, retry/401 retention, repair/discard, indexed entity migrations and browser offline/queued-upgrade proof. Native upgrade, indexed date queries/checkpoints, large-account and full failure matrix remain. |
| 05 Web planner | in_progress | Day/Week/Month/editor, drag/move/reorder, scoped delete/Undo, heading swipes, owned links, persistent navigation and history filters. Eighteen real browser checks pass; complete keyboard/zoom/screen-reader/dense-content acceptance remains. |
| 06 Mobile planner | in_progress | Four tabs, full editor/scopes/actions/Undo/reorder/swipes/links/history. Selected prior iOS simulator flows pass; both native builds now compile. Equivalent Android/runtime/conflict/accessibility and physical-device gates remain. |
| 07 Reminders | in_progress | Shared scheduling, contextual permission, seven-day/48-entry native reconciliation, crash recovery/cancellation and current-state taps implemented. Remote ownership/tokens/worker/receipts and real-device delivery/cancellation remain. |
| 08 Review/Search/Settings | in_progress | Bounded date/state/priority/series/query history, paginated server snapshot, terminal context, both metrics and synchronized defaults/calendar settings. Cross-month monthly groups, safe provider link/unlink and full native evidence remain. |
| 09 QA/release | in_progress | Broader unit/DB/browser checks, release preparation and disposable-service CI configuration. CI execution, complete device/security/scale/operations matrix and release artifacts remain. No release completion is claimed. |

## Historical foundation checks — 2026-09-29
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
| Google callback registration and Android signing identity proof | Provider proof | Web/native public IDs are configured locally. Register self-hosted callbacks and Android SHA identities, then verify real consent/token exchange on required devices. |
| Apple Service/App IDs, generated client secret, HTTPS callback domain | Apple native/web proof | Configure developer account and callback. |
| Verified Resend sender and API key | Hosted real mail | Configure sender; local Mailpit works. |
| Registered app IDs, EAS/push/Inngest configuration and physical devices | Native auth/reminders | Use signed development builds and run the stated physical iOS/Android matrix. Local compilation and Node SQLite tests do not replace device proof. |

Never put secrets, OTPs or sessions into these documents. Neon authentication/setup is already complete and is separate from these provider gates.

## Architecture and limitations
- Self-hosted Better Auth remains the planner's identity provider. Root `neon.ts` managed-auth setting does not replace it.
- `decisions/003-sync-persistence.md` documents the transaction/snapshot protocol, immutable authored revision commands and current aggregate/journal baseline.
- Journals/full canonical feed payloads and full-account repository reads still need checkpointing/indexed-date projection and scale evidence before release. Entity-table migration is implemented. This limitation is explicit; no history/outbox is silently truncated.
- API body limits and a shared PostgreSQL per-owner throttle exist. Notification resources, provider link/unlink and production operational controls remain outstanding.
- Browser shell cache contains only public HTML and static build assets. No API/auth/private HTTP responses are cached.
- Outbox errors remain durable. Explicit retry, task-dependent discard, confirmed discard/sign-out and recent-auth account deletion now exist.
- Planner overdue projection covers the previous year and labels that coverage. Search/Review support up to 366 days per query plus fixed-snapshot online paging. Full downloaded history can be projected offline; history coverage is stated explicitly.

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

## Follow-up — sign-in logos and navbar tint
- Added inline Google and Apple vector logos to the web sign-in buttons, with decorative accessibility semantics and spacing that fits the 320px phone layout.
- Darkened the desktop left navbar subtly to warm neutral `#f0efe5`, per owner request.
- Production build/TypeScript and four existing desktop/phone auth and offline planner checks pass. Refreshed visual evidence and inspected the phone sign-in and desktop planner screenshots. Preview restarted on port 3001.

## Mobile implementation and full-plan audit — 2026-09-30

- Added authenticated Expo Router tabs, native date/time picker, full custom recurrence editor, scoped actions/Undo, atomic untimed reorder, safe links and bounded native Review/Search. Shared calendar/editor/action helpers now also serve web; scoped restore extends the unreleased protocol. See [ADR 004](decisions/004-mobile-planner.md). Included in the mobile implementation milestone; use `git log -1` for the latest checkpoint.
- Latest executed unit run: 58 pass; isolated Neon integration run: 5/5 pass. Workspace types and boundary guard passed during the milestone. Both final Hermes exports pass. Latest web production build (after shared-helper refactor) passes.
- Browser suite last passed 12/12 before the final shared-helper refactor; it must be rerun for that later change. No native Maestro flow pass is claimed.
- iOS simulator Release builds succeeded, including the subsequent ad-hoc-signed build. The first installed unsigned app rendered sign-in but hit a SecureStore Keychain entitlement error. Reinstall/retest the signed build; its success is not yet proof that authentication or planner runtime works. Android native build, device flows and native screenshots remain.
- Simulator build artifact: `/tmp/timely-stage06-ios/Build/Products/Release-iphonesimulator/Timelydevelopment.app`; build log: `/tmp/timely-stage06-ios-build.log`; final Hermes exports: `/tmp/timely-stage06-export-final`. Test checklist: [mobile-verification.md](mobile-verification.md).
- Full implementation/acceptance/deployment distinction and each stage's remaining steps are recorded in [implementation-audit.md](implementation-audit.md). Reminder delivery is not implemented; preferences/history/recovery/account lifecycle and release preparation are incomplete.

## Mobile design and runtime fixes — 2026-09-30

- Applied Expo’s official design-system guidance to the existing Timely palette: simplified planner hierarchy, segmented modes, quiet sync, refined cards/chips/progress, original vector empty state, native social logos/availability, fixed sheet header/Save footer, separate visible recurrence-scope step, and quieter Review/Search filters with visible coverage. Shared derived surfaces/typography live in `@timely/design`.
- The signed simulator resolved the Keychain issue. Real native email sign-in then revealed a Hermes Temporal formatting crash; fixed through the shared civil-date formatter with a regression test and a root error boundary.
- Checks: 59 unit tests pass; all nine workspace type checks and boundary guard pass; 12 browser regression tests pass after the previously unverified shared-helper refactor. Native typecheck passes after the final sheet change. iOS signed simulator Release rebuild passes; Android Hermes export passes before final sheet/date-label refinements.
- Actual iOS simulator UI proof: email OTP, restored account, create, daily recurrence, future title edit, completion/Undo, Day/Week/Month, Review/Search/Settings, offline-backend create + force-close/relaunch + completion, reconnect with zero pending, sign-out/local purge and reauthentication/server bootstrap preserving all plans. No actual-device airplane-mode, Android runtime, OAuth or push claim.
- Seeded native screenshots: `docs/evidence/mobile-{day,week,month,editor,review,search,settings,signin}-ios.png`. See [ADR 005](decisions/005-mobile-design.md) and [native verification](mobile-verification.md). Full later-stage omissions in the implementation audit remain open.
- Current local API preview: port 3001. Latest iOS build log `/tmp/timely-mobile-design-build.log`; artifact path unchanged. The final scope chooser is immediately visible after Save; occurrence-only duration edit persisted at 25 minutes while tomorrow retained 20.

- Measured contrast: white/blue 5.86:1, navy/warm 13.68:1, muted/white 4.80:1, muted/warm 4.54:1. Muted/lime was 4.34:1, so accent-surface captions now use navy/lime at 13.07:1. Full accessibility acceptance remains pending.

## Bottom navigation and synchronized calendar preferences — 2026-09-30

- Replaced the native rectangular tab selection with an inset rounded dock, compact blue icon pill, consistent icon weights, safe-area spacing and labels that retain font scaling. Kept the standard tab navigator's accessibility and navigation behavior.
- Added durable, account-scoped first-weekday and month-grouping settings to both clients. They use atomic local outbox writes, canonical field-group ordering, deduplicated push, feed and fixed snapshots. Calendar layout updates immediately without changing stored recurrence anchors. See [ADR 006](decisions/006-synchronized-preferences.md).
- Migration 0002 applied to local development Postgres and the isolated Neon development branch. Production hello project remains unchanged.
- Automated checks: 62 unit tests; all nine workspace type checks; boundary lint; web production build; signed iOS simulator build. All six real Neon transaction tests pass, including preference deduplication, delayed older writes, independent groups, cross-owner isolation, stable paginated snapshot and mixed-command rollback.
- Real native/web account check: Sunday selected on iOS appeared in web Settings; native week starts Sunday and both month calendars rotate weekday labels; web All occurrences appeared in native month view. An API-disconnected grouping edit survived process restart, synchronized after reconnect with zero pending, and reached the web client; web reload retained both settings. See the QA log for scope and limitations.
- Remaining: reminder settings UI/delivery worker, history coverage, indexed local storage and recovery, account deletion/device management, full web/native acceptance and production release gates. Calendar preferences are complete in code; the broader stages remain in progress.

## Mobile logo — 2026-09-30

- Added the existing blue/lime Timely logo as the opaque 1024px iOS app icon, Android adaptive/themed icons and centered launch-screen artwork. Native header/sign-in branding now uses the same mark. Assets are reproducibly derived from the web SVG with `node scripts/generate-mobile-brand.mjs`.
- Splash screen remains visible until fonts load or fail, with the established warm background. Expo splash configuration follows the installed SDK 55 plugin.
- Verification: native TypeScript passes, iOS and Android prebuilds pass, signed iOS Release build passes, installed icon visually verified on the simulator home screen and header on sign-in. Evidence: `evidence/mobile-app-icon-ios.png`. Android launcher runtime and a captured cold-launch splash frame remain unverified; no claim of those checks. Build log: `/tmp/timely-logo-build.log`.

## VS Code mobile debugging — 2026-09-30

- Replaced the mobile folder's bare React Native/Node launch entries with Expo Tools Hermes attach configuration. Added matching root/folder tasks, extension recommendations and `mobile-debugging.md`. Existing owner edits to `apps/mobile/package.json` were preserved and excluded from this checkpoint.
- Started Metro in VS Code, built and installed the signed iOS Debug app, connected to localhost:8081 and verified an actual breakpoint at `src/brand.tsx:4`, with original source/variables/call stack. Left the session paused for the owner. API remains localhost:3001.
- Native TypeScript passes; configuration JSON parses. No new business tests needed. Expo-generated tsconfig removal was reverted; local React Native Tools cache is ignored.

## Native Google sign-in configuration — 2026-09-30

- Diagnosed disabled Google sign-in: public client IDs existed only in `.env.example`, which Expo does not load; no local mobile environment file existed. The installed Debug app also lacked the reversed iOS Google callback scheme, and the backend on port 3001 was stopped.
- Created ignored, mode-0600 `apps/mobile/.env.local` from the owner's configured example with both public client IDs, localhost:3001 API address and the callback scheme derived from the iOS ID. Preserved owner edits to tracked configuration. Restarted Metro through the VS Code task and started the local backend; provider availability returns `google: true, apple: false`.
- iOS prebuild and signed Debug rebuild pass (`/tmp/timely-google-build.log`). Verified the built Info.plist contains Google's callback, installed on the active iPhone 16e simulator and opened Google's real Timely sign-in page. Evidence: `evidence/mobile-google-sign-in-ios.png`. Native TypeScript passes.
- Left Google authorization open for owner login. Account consent, ID-token exchange, session persistence and physical-device authentication remain unverified; no completed Google session is claimed. EAS cloud secret metadata was not inspected. Local Metro requires local environment values; EAS secret-visibility variables cannot be pulled locally. See `mobile-debugging.md` for executable configuration/rebuild steps.

## Mobile expo-doctor diagnostic fix and Expo SDK 57 upgrade — 2026-09-30

- Per owner instruction, upgraded the mobile app to Expo SDK 57 (`expo@~57.0.26`, `react-native@0.86.3`, `react@19.2.3`).
- Aligned all native modules to their SDK 57 compatible versions (`@expo/dom-webview@~57.0.1`, `@expo/metro-runtime@~57.0.16`, `expo-apple-authentication@~57.0.2`, `expo-constants@~57.0.20`, `expo-crypto@~57.0.3`, `expo-dev-client@~57.0.19`, `expo-font@~57.0.4`, `expo-linking@~57.0.11`, `expo-network@~57.0.2`, `expo-notifications@~57.0.21`, `expo-router@~57.0.24`, `expo-secure-store@~57.0.4`, `expo-splash-screen@~57.0.9`, `expo-sqlite@~57.0.3`, `expo-status-bar@~57.0.1`, `expo-web-browser@~57.0.3`, `@react-native-community/datetimepicker@9.1.0`, `react-native-safe-area-context@~5.7.0`, `react-native-screens@~4.26.0`, `react-native-svg@15.15.4`).
- Aligned monorepo `pnpm.overrides` for Expo 57 in [package.json](file:///Users/alexei/Documents/dev/Timely/package.json).
- Added `expo-doctor` to [apps/mobile/package.json](file:///Users/alexei/Documents/dev/Timely/apps/mobile/package.json) devDependencies, added a `doctor` script (`expo-doctor`) to mobile, and added `doctor:mobile` (`pnpm --filter @timely/mobile run doctor`) to root scripts.
- Verification: `npx expo-doctor` and `pnpm doctor:mobile` pass 21/21 checks with no issues detected. Mobile typecheck passes; unit tests pass (62/62); import boundaries pass.

## Xcode 26.2 / Swift 6.2 local iOS compatibility — 2026-10-01

- Fixed the SDK 57 local iOS build failure in upstream `expo-modules-jsi@57.1.1` with an exact-version pnpm patch. It removes invalid retained-return annotations from `RuntimeScheduler` constructors and uses Expo's existing unsafe-sendable wrapper for synchronous pointer/run-loop captures rejected by Swift 6.2.
- Fixed the subsequent strict-concurrency errors in upstream `expo-modules-core@57.0.20` by using its existing weak unsafe-sendable wrapper for the two scheduled `EventEmitter` captures. No Timely behavior, authentication boundary or global Swift concurrency setting was weakened. See [ADR 007](decisions/007-expo-xcode-compatibility.md).
- Verification: `pnpm exec expo run:ios --no-bundler` builds with zero errors, signs and installs the Debug app on the iPhone 16e simulator. The post-install attempt to foreground Simulator is denied by the host's AppleScript/System Events permission. Mobile TypeScript passes. Expo Doctor completes 20/21 checks and now reports duplicate peer variants in the monorepo dependency graph; the compiled native target contains the expected patched versions, but dependency deduplication remains follow-up work.

## Expo Router Metro cache recovery — 2026-10-01

- Reproduced the simulator failure by requesting its exact `apps/mobile/node_modules/expo-router/entry.bundle` URL: the running Metro server returned HTTP 404 despite `expo-router/entry.js` existing and resolving from `apps/mobile`. The package `main` field and Expo's automatic monorepo configuration were already correct.
- Restarted Metro from `apps/mobile` with `--clear`, rebuilding the stale file map left after pnpm relinked `node_modules`. The same iOS bundle URL now returns HTTP 200 with a 12,361,650-byte JavaScript bundle.
- Both checked-in **Mobile: Start Metro** tasks now include `--clear`, and the recovery command is documented in `mobile-debugging.md`. No hoisting change, custom Metro resolver or package-entry workaround was added.

## VS Code Hermes debugger compatibility — 2026-10-01

- Diagnosed gray, unbound VS Code breakpoints from the live Metro log: VS Code 1.140 with Expo Tools 1.6.3 connected to React Native 0.86's inspector without an `Origin` header, and the inspector rejected every connection with HTTP 401. The Hermes iOS target itself remained healthy and discoverable through `/json/list`.
- Added an exact-version `@react-native/dev-middleware@0.86.3` pnpm patch. It permits a missing origin only when the request comes from a loopback address and includes both Expo's `type=vscode` marker and a `vscode/` user agent; normal origin validation remains unchanged for every other connection.
- Fixed Expo Tools 1.6.3 passing a `vscode.Uri` as js-debug's `localRoot`, which caused `setBreakpoints` to fail with `The \"path\" argument must be of type string`. The installed extension now passes `project.root.fsPath`; `scripts/patch-expo-vscode-debugger.mjs` and matching VS Code tasks make the exact-version repair repeatable after an extension reinstall.
- Standardized Metro and debugger attachment on IPv4 loopback and disabled the experimental turbo source-map path, which could bind a breakpoint but open the generated bundle. The normal Metro source map resolves original TypeScript correctly.
- Verification: Metro served the iOS bundle with HTTP 200; a loopback Expo/VS Code WebSocket was accepted while an unidentified missing-origin request remained HTTP 401. After a simulator reload, the breakpoint was solid and VS Code paused at the original `apps/mobile/src/brand.tsx:3`, showing local variables and the TypeScript call stack. Mobile TypeScript and configuration checks pass. The session was left paused for the owner; F5 continues.


## Continuation checkpoint — 2026-10-06

- Implemented account/device lifecycle, owner-scoped limiter, durable retry/discard, web action/navigation parity, bounded snapshot history, synchronized reminder defaults, local native scheduling/tap/cancellation recovery and indexed local entity/outbox migrations. Local scheduling is actual Expo SDK code with deterministic recovery tests; remote delivery remains unimplemented.
- Final checks: 73 unit/SQLite tests; 10 real isolated-Neon transaction/security tests; 18 real desktop/phone browser checks; all nine workspace types (mobile refreshed after SQL extraction); boundary guard; final production web build; Expo Doctor 21/21; both final Hermes exports. SQL migration/reopen/rollback tests use actual Node SQLite and preserve both accounts. Equivalent Expo runtime remains unverified.
- Final signed ARM64 simulator Release: `EXPO_PUBLIC_API_URL=http://localhost:3001 xcodebuild -workspace Timelydevelopment.xcworkspace -scheme Timelydevelopment -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/timely-supported-ios ARCHS=arm64 CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build`, from `apps/mobile/ios`. Result: BUILD SUCCEEDED. Log `/tmp/timely-supported-ios.log`; artifact `/tmp/timely-supported-ios/Build/Products/Release-iphonesimulator/Timelydevelopment.app` includes the final JS bundle.
- Final Android: `./gradlew assembleDebug --max-workers=2`, from `apps/mobile/android`. Result: BUILD SUCCESSFUL in 18m 25s, 760 tasks. Log `/tmp/timely-supported-android.log`; artifact `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (development/Metro-dependent). Current wrapper succeeds; its deprecation warnings do not constitute Gradle 10 compatibility.
- Pod install succeeded; system Ruby could not use precompiled-module config, so those modules compiled from source. Existing exact-version Swift patches remain applied. The final dependency graph has no unmet native peer warnings; frozen installation succeeds.
- Configured server-secret value scan: none found in 119 public web/native artifacts. No credentials/OTPs/session material appear in evidence. This targeted check does not replace a complete release security review.
- Latest preview process: final built app on port 3001. Docker/Mailpit remain running. No production planner migration, deployment, DNS change, push provider dispatch or store submission occurred.
- Branch: `codex/finish-planner`; current code/evidence/lockfile checkpoint is identifiable with `git log -1`. Remaining gates and exact next action are at the top of this file and in `release-readiness.md`. No full stage acceptance or finished-release claim is made.


## Streak milestone — 2026-10-06

- Owner confirmed existing task deadline and no Skip for streak tasks. Implemented [STREAKS.md](planner/STREAKS.md) / [ADR 012](decisions/012-recurring-task-streaks.md) on `codex/finish-planner`, based on `3ed0537`. Use `git log -1` for the saved streak checkpoint.
- Contracts add optional nullable tracking-start policy without rewriting legacy command shapes. Shared domain derives counts and seven marks with bounded windows, strict deadline comparison, immutable terminal schedule/zone, source identity, moved deadlines, finite/monthly recurrence and no retroactive penalty on enabling. Future early completions cannot conceal today's miss. Reducer refuses Skip even through stale pre-tracking targets; local rejection preserves the full outbox atomically.
- Web/native editors expose Track a streak for repeating tasks with future/series scope. Individual and month group cards share flame/count/ended indicators and accessible marks. Existing deadline and ordinary progress behavior are preserved. No new dependency, SQL migration, credentials or remote deployment is needed.
- `pnpm test`: 90 pass, 11 DB tests intentionally skip without external flag. Includes 12 new domain and five new sync checks. All nine type checks, boundary guard, production web build and `git diff --check` pass.
- Real isolated-Neon full run: ten existing checks passed; new streak check initially compared a changing response-level `serverTime`. Fixed the assertion to compare stored results/watermark. Targeted rerun passes (11.7 seconds), proving saved on-time history, exact result retry, rejected Skip rollback, foreign-owner rejection and history DTO round-trip. Synthetic owners are cleaned up.
- `TEST_BASE_URL=http://localhost:3001 pnpm test:e2e`: 20/20 real Chrome checks passed, desktop and 320px phone. New streak test covers opt-in, no Skip, offline completion/reload, second authenticated client and ended deadlines. Final targeted streak rerun is recorded in the command output. Screenshots: `docs/evidence/streak-{active,ended}-{desktop,phone}.png`, synthetic accounts only. Visually checked active desktop and ended phone layouts.
- `pnpm --filter @timely/mobile exec expo export --platform ios --platform android --output-dir /tmp/timely-streaks-native-export --max-workers 2`: final Hermes exports pass. No new signed native build/device UI proof is claimed. Existing provider/push/physical-device gates remain open; see [release readiness](release-readiness.md).
- Preview remains available at `http://localhost:3001`. No production publishing, DNS or store actions. No current failing implementation checks; native streak runtime acceptance remains the next task, followed by the existing scale/notification/provider work.


## Reminder checkbox refinement — 2026-10-06

- Owner requested a quieter design and checkbox-only clicking in web Settings. Reminder toggles now use compact 24px controls with inline text; the text and row are separate from the input and do not toggle it. `aria-labelledby` preserves visible accessible names; Space and focus styling remain available. Form field names and saved preferences are preserved.
- Changed `apps/web/components/planner.tsx` and `apps/web/app/globals.css`. Production web build/type check and `git diff --check` pass. Real Chrome checks at 741×887 and 320×740 confirm 24px dimensions, inert text/row clicks, checkbox/Space toggling, saved preferences through real sync/reload and no horizontal overflow. Visually inspected temporary desktop/phone form captures.
- Local preview refreshed at `http://localhost:3001`; no deployment or native changes. Resume the native streak acceptance and first-release work recorded above. This checkpoint adds no new repository test suite for the small reversible presentation change.


## Clickable reminder text — 2026-10-06

- Latest owner correction supersedes checkbox-only clicking: both the text and checkbox now toggle each reminder default. Explicit native HTML labels preserve accessible names and the compact 24px design; empty row space stays inert.
- Production web build/type check and diff check pass. Real Chrome at 741×887 and 320×740 confirms text/checkbox/Space toggling, inert empty row space, 24px dimensions and saved preferences after real sync/reload. Local preview refreshed; no native or remote deployment changes. Resume the outstanding native streak/release checks above.

## PR #1 streak replay fix — 2026-10-06

- Owner requested fixing the bug found in [PR #1](https://github.com/Alexeiguch/timely/pull/1) before merging. Branch `codex/finish-planner`, based on `9dfebc4`; use `git log -1` for the fix commit. No merge is authorized by this checkpoint.
- Reproduction: create a plain repeating task at HLC 1000, accept another device's Skip at 3000, then upload an offline enable-streak edit authored at 2000. The old reducer rejected the already accepted Skip during replay, preventing the edit from syncing. A second red regression showed a newly submitted Skip at 1500 bypassing tracking enabled at 2000.
- `packages/sync/src/records.ts` now checks new Skip admission against the current effective series independently of the incoming clock, after exact-UUID retry handling. Replay retains accepted commands and pins terminal tracking policy to their immutable authored revision. Legacy absence remains absent; no journal payload/schema/migration change. Added four unit cases covering the two failures, two-device offline rebase, replay ordering, retry and legacy completed/skipped history; added a real two-device PostgreSQL regression in `packages/db/src/planner.integration.test.ts`. Updated STREAKS/ADR 012.
- Verification: initial two new regressions failed as expected; both passed after the fix. `pnpm test` passed 92 unit/SQLite tests with 12 DB checks intentionally skipped; the subsequent final streak suite passed all nine cases, including two additional legacy-policy cases (94 unit cases total). All nine workspace type checks and boundary guard pass. Production web build passes. `git diff --check` passes.
- `RUN_DB_TESTS=1 node --env-file=.env.neon-development node_modules/vitest/vitest.mjs run packages/db/src/planner.integration.test.ts -t 'streak'`: both real isolated-Neon streak checks pass (30.1 seconds), including accepted Skip, delayed edit, exact stored-result retry, historical policy DTO and atomic rejection of a new backdated Skip. Existing unrelated DB gates were not rerun locally for this focused fix; PR CI runs the full suite. Synthetic owners/devices are cleaned up.
- Refreshed built preview on port 3001. `TEST_BASE_URL=http://localhost:3001 pnpm test:e2e --grep 'streak opt-in'`: both desktop/320px phone cases pass (12.2 seconds). iOS and Android Hermes exports pass to `/tmp/timely-streak-replay-native-export`. These exports do not establish native device interaction acceptance.
- Exact next action after pushing this fix: verify the new PR-head CI result, then resume native streak/release verification listed above. Production database, deployment and main remain unchanged.
