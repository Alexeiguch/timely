# Mobile planner verification

Use a disposable development identity and local Docker/Mailpit or the isolated Neon development backend. Never use the root Neon production credentials for planner migrations. Google/Apple credentials and physical-device checks are separate from the local email proof.

## Build and run

- `pnpm --filter @timely/mobile typecheck`
- `pnpm --filter @timely/mobile exec expo install --check`
- `pnpm --filter @timely/mobile exec expo export --platform ios --platform android --output-dir /tmp/timely-stage06-export`
- Set `EXPO_PUBLIC_API_URL` to a reachable backend. An iOS simulator can use `http://localhost:3001`; Android emulator uses `http://10.0.2.2:3001` if the backend listens on the reachable interface. Physical devices need a reachable trusted HTTPS backend.
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
