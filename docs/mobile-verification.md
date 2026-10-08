# Mobile planner verification

Use a disposable development identity and local Docker/Mailpit or the isolated Neon development backend. Never use the root Neon production credentials for planner migrations. Google/Apple credentials and physical-device checks are separate from the local email proof.

## Build and run

- `pnpm --filter @timely/mobile typecheck`
- `pnpm --filter @timely/mobile exec expo install --check`
- `pnpm --filter @timely/mobile exec expo export --platform ios --platform android --output-dir /tmp/timely-stage06-export`
- Set `EXPO_PUBLIC_API_URL` to a reachable backend. An iOS simulator can use `http://localhost:3001`; Android emulator uses `http://10.0.2.2:3001` if the backend listens on the reachable interface. Development also accepts a `.local` hostname. Preview and production builds reject every cleartext address, including loopback. Physical release acceptance needs a reachable trusted HTTPS backend. Local development on the owner's private network can use the Mac's `.local` hostname and the Debug build's local-network exception; see [connected iPhone setup](mobile-debugging.md#connected-physical-iphone-development-build).
- `pnpm --filter @timely/mobile exec expo prebuild --platform ios` and `pnpm --filter @timely/mobile exec expo run:ios` produce a local development build. For restart/offline proof use an embedded release simulator bundle, not a Metro-dependent development reload.
- Sign in using actual email OTP delivery. Do not record authentication screens or place codes/cookies in flow files, logs, screenshots or reports. Run `maestro test tests/mobile/planner.yaml` only after authentication; the flow contains synthetic planner content only.

## Native acceptance checklist

- All four tabs, auth restoration, expired session reauthentication without clearing queued changes.
- Day/week/month navigation and civil date picker; week day-strip and grouped agenda; month grouped and all-occurrence views.
- Quick Add with title only; optional fields; independently clear time/duration; notes/priority.
- All recurrence presets and custom weekly/monthly/yearly selectors; clamp/skip invalid dates, counts/end dates, preview and scope selection.
- Complete/reopen, skip/unskip, move today/date, occurrence/future/series deletion and immediate Undo. Untimed Move up/Move down preserves dates and IDs.
- Disable backend connectivity, create/edit/complete, force-close/relaunch with the embedded bundle, then reconnect and check the same account on web. Test independent-field merges and same-group winners.
- Valid date/occurrence links, moved occurrence links, deleted/wrong-account/signed-out links. URL owner is never server authority.
- Background/foreground zone changes, DST and overnight duration cases; stable terminal history.
- 320–430 px phones, landscape, large system text, keyboard-open editor, safe areas and Android Back.
- Capture seeded Day/Week/Month/editor/overdue/Review/Settings screens after auth; no real personal data.

Physical Google/Apple auth, OS notification delivery and cross-device behavior remain separate gates. Simulator exports/builds do not prove those gates.

## Verified simulator setup — 30 September 2026

The unsigned simulator artifact failed SecureStore with a missing Keychain entitlement. An ad-hoc-signed simulator Release build works; this uses no paid team certificate. With an existing generated iOS project and installed pods, run from `apps/mobile/ios` (substitute the local simulator ID):

```sh
EXPO_PUBLIC_API_URL=http://localhost:3001 xcodebuild \
  -workspace Timelydevelopment.xcworkspace -scheme Timelydevelopment \
  -configuration Release -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=03928667-1017-4EEA-B0EA-9060102423A5' \
  -derivedDataPath /tmp/timely-stage06-ios \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

Authenticated simulator flows now exercised: task creation, daily recurrence, future title edit, completion/Undo, Day/Week/Month, Review/Search/Settings, local sign-out and real email reauthentication. With the local backend stopped, a new task survived process termination/relaunch; completion added another durable operation. Restarting the backend and selecting Sync now returned to Synced/zero pending. After sign-out purged the local account, reauthentication downloaded all three plans and the completion, confirming server persistence. This was backend disconnection, not physical-device airplane mode.

The checked-in Maestro flow remains unexecuted; the above evidence comes from actual native UI interaction. Remaining gates include Android runtime, physical devices, complete gesture/large-text/keyboard/landscape checks and provider/push verification.

### 2026-09-30 — Rounded dock and durable calendar settings

Final signed simulator build log: `/tmp/timely-tabbar-final-build.log`. All four tab destinations work, using the standard navigator with a rounded inset bar and compact active icon pill. Evidence: `evidence/mobile-tabbar-ios.png`.

Sunday-first weeks and month grouping now synchronize with the web client. Verified real account bootstrap, changes in both directions, an API-disconnected grouping edit, process restart with the queued edit intact, and automatic reconnect to zero pending. Existing weekly recurrence rules are untouched. This does not close the remaining Android, large-text, gesture or physical-device gates.


## 2026-10-05 — final supported dependency compilation and SQLite logic

Expo 57 / RN 0.86.3 now pins Worklets 0.10.1, Reanimated 4.5.1 and Metro config 0.86.3. Frozen install and Expo Doctor 21/21 pass. Both final Hermes exports pass at `/tmp/timely-supported-final-export`.

Signed ARM64 iOS simulator Release build succeeds; artifact `/tmp/timely-supported-ios/Build/Products/Release-iphonesimulator/Timelydevelopment.app`, log `/tmp/timely-supported-ios.log`. Android Debug build succeeds in 18m 25s; artifact `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, log `/tmp/timely-supported-android.log`. It uses Metro in development; configure the emulator-reachable API as described above. These are local development artifacts, not signed store releases.

Three actual Node SQLite tests exercise the same persistence/migration SQL used by the native adapter: pending-work migration and file reopen, two-owner isolation, atomic crash rollback, and refusal to overwrite malformed/newer schemas. Native API transaction/OS behavior still requires device runtime evidence.

Simulator UI automation stalled; no new native sign-in, migration, account cleanup or notification presentation pass is claimed. Local scheduling/cancellation and reminder-default UI are implemented and deterministic recovery checks pass, but real-device permission/terminated/offline/zone delivery and remote push/provider gates remain open. Remote push is not enabled. The earlier manual simulator evidence remains scoped to its original milestone.

## 2026-10-08 — Physical iPhone local notification smoke

The installed signed development app on the owner's iPhone 15 loads the Spanish translations from Metro. The owner granted notification permission through the existing app/iOS permission flow; actual native flags confirm permission granted. iOS accepted a single clearly labeled synthetic Spanish local notification scheduled 30 seconds ahead, verified by that identifier in the native scheduled list. The owner then confirmed “it worked.” This establishes observed local notification delivery on this physical installation.

The owner requested a repeat before confirming delivery. The subsequent inspector commands timed out, so that repeat was not independently confirmed scheduled. Background/locked state was requested but not independently observed. No account/task data was inspected or changed. This isolated OS delivery check does not close task-triggered scheduling/cancellation, offline/terminated/zone behavior, Android, remote push/token/coverage or complete reminder acceptance gates.


## Expo remote push implementation — 2026-10-08

Owner selected Expo Push Service. Device/project registration, local coverage handoff and ownership protection, Expo sending/receipts, database invalidation processing and native Settings test action are implemented. Shared and real PostgreSQL tests cover isolation, stale cursor/claim rejection, local elapsed ownership, response-loss/crash recovery and token replacement. This establishes code behavior, not OS delivery. The earlier owner-observed local iPhone notification remains valid and separate.

The linked development Expo project is `@guchinale/timely`. Apple key creation via EAS returned `UnexpectedAppleResponse` maintenance; the owner subsequently created a key in Apple's web account. The existing owner-provided key is now uploaded to Expo and assigned to `com.example.timely.dev`. Actual iPhone registration is `ready` with granted permission. A real synthetic test was queued from the authenticated native use case, sent by the local durable worker and received an Expo receipt confirming APNs handoff. Owner requested a repeat. It was confirmed queued through the actual native use case before background/lock, accepted by Expo and owner-observed (“Sí, llegó”). This establishes a physical remote notification smoke pass, alongside the earlier local delivery pass. It does not establish which of the background/locked states applied, full terminated/offline/DST behavior or the complete task reminder lifecycle. Android FCM v1 and signed-device delivery, hosted Inngest authentication/cadence, notification actions, task cancellation, offline/terminated travel/DST and large-budget handoff remain unverified. Follow [setup](setup.md#expo-remote-notifications) for a real authenticated Settings test; observe delivery after a confirmed queue acknowledgement. Do not call tickets/receipts user-visible delivery proof.
