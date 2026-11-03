# Apple App Store and Google Play submission review

Reviewed: **15 October 2026**. Initial source: `main` at `8d268e4`, including the existing working tree. During the review, concurrent work committed those existing changes as `955eee7`; the intervening diff contains no native/auth behavior change affecting these findings. **Public release readiness: blocked on both stores.** This is a source/configuration/artifact review with read-only production probes, not a store approval or a new device acceptance run.

Method: [GitHub's apple-appstore-reviewer skill](https://github.com/github/awesome-copilot/blob/main/skills/apple-appstore-reviewer/SKILL.md), supplemented by current official Google Play requirements and the local React Native skill. The reviewer skill was read directly from its upstream `SKILL.md`; no skill was installed. App code, signing credentials, store records and existing user changes were preserved.

## 1. Executive summary

- Timely is an Expo 57 / React Native 0.86.3 personal planner. Its main flows are account sign-in, offline task planning with synchronization, and optional reminders/review. An account and first download require connectivity; notifications are optional. There are no purchases or public sharing features.
- **Privacy is the first blocker:** neither native sign-in nor Settings exposes a privacy policy. The production origin's tested `/privacy` and `/support` pages return 404.
- **Apple login is the second blocker:** production reports `google=true`, `apple=false`; the native screen hides Apple accordingly. This leaves the configured Google login without the required equivalent privacy-preserving option under Apple's [Login Services rule, 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services).
- **Review access is the third risk:** email codes expire after five minutes, passwords are disabled, and a durable reviewer access procedure has not been evidenced. Console credentials/instructions were not inspected.
- The quickest concrete improvements are public privacy/support pages linked in the app, a public account deletion destination for Google Play, and a completed data inventory for both stores. Apple configuration and provider revocation also need work.
- Build prerequisites have useful evidence: the saved iOS build uses Xcode/iOS SDK 26.2 with minimum iOS 16.4; installed Android defaults and the existing debug manifest target API 36. These meet the currently applicable minimum toolchain/target requirements, subject to verifying the final release artifacts. See [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/) and [Google target API requirements](https://developer.android.com/google/play/requirements/target-sdk).
- Earlier TestFlight uploads remain valid evidence of upload preparation. Build 5's processing/tester access, public review fields, Android release signing, Android physical acceptance and the complete notification matrix remain unverified. No submission or publication was performed in this review.

## 2. Prioritized risk register

P0 means a confirmed submission blocker or very likely rejection; P1 means a high risk or required gate without sufficient evidence; P2 means a narrower quality or configuration concern. S/M/L describe estimated implementation effort, excluding external waiting time.

| Priority | Area / platform | Finding | Why review may fail | Evidence | Recommendation | Effort | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 · R01 | Privacy / both | No accessible in-app privacy policy; no in-app support destination | Missing privacy disclosure and support access | `apps/mobile/src/{sign-in,settings}.tsx`; live `/privacy` and `/support` = 404 | Publish accurate policy/support pages, link them on sign-in and Settings, enter verified URLs in both consoles | M | High |
| P0 · R02 | Account / iOS | Google enabled, Apple disabled | Login Services requirement | Live `/api/v1/auth/providers`; `SignIn` provider filter; `createAuth` | Configure the approved Apple provider and verify first/repeat/relay sign-in on a signed physical device | M | High |
| P1 · R03 | Account / Android | No evidenced public deletion destination | Google requires an external deletion route as well as in-app deletion | Live `/delete-account` = 404; web deletion currently sits inside authenticated planner Settings | Add a clearly named, public Timely page leading to an authenticated deletion/request flow; supply that URL to Play Console | S–M | High for missing page; console URL unverified |
| P1 · R04 | Account / iOS | Deletion bypasses Apple token revocation | Provider authorization remains after local account removal | `accountRepository().delete`; native `signInApple` sends only ID token/nonce | Exchange authorization code on the server, retain revocable credentials securely, implement retryable Apple revocation tied to deletion | M | High |
| P1 · R05 | UX / both | Reusable reviewer access unverified | Reviewer may be unable to reach any planner feature | Five-minute OTP in `createAuth`; password login disabled; no evidenced review procedure | Prove an independent, repeatable access path and save English instructions privately in each console | M | High for OTP behavior; console setup unverified |
| P1 · R06 | Privacy / both | Final data declarations unverified; no app-level collection declaration in tracked config | Labels may disagree with actual account/task/push collection | Auth/planner schemas; `push.ts`; build 5 manifest has an empty collected-data array | Complete inventory, SDK review, labels and reproducible manifest configuration; inspect final archive report | M | High for code/artifact; console labels unverified |
| P1 · R07 | Technical / Android | No evidenced store-signed release AAB or complete device acceptance | Upload, sign-in, notifications or native libraries may fail | Generated local Gradle release uses debug signing; earlier evidence is a debug APK/export | Prepare a release-signed AAB, inspect the merged manifest/signature and 16 KB compatibility, then run signed-device acceptance | M–L | High for local state; EAS credentials unverified |
| P1 · R08 | Technical / both | Final listing/version/content declarations unverified | Required submission fields or matching build may be absent | `version: 0.1.0`; last documented Apple draft is `1.0`; Android listing assets not prepared here | Align the public version, verify age/content/privacy/access forms, prepare Android assets and check current console state | M | Medium; prior Apple draft may have changed |
| P2 · R09 | Permissions / both | Native generation includes unnecessary permission/development settings | Excess permissions or release configuration drift complicates review | Clean Expo introspection; generated manifests; tracked config lacks permission exclusions | Remove unused Android storage/overlay declarations for store builds; audit final iOS ATS/dev-launcher/Face ID entries | S–M | High for generated settings; final Android artifact unverified |

## 3. Detailed findings

### Privacy and data handling — R01, R03, R06

**Observed.** Searches of native account/sign-in/settings and the web routes found no privacy/support pages or policy links. Unauthenticated GETs to the production origin returned 404 for `/privacy`, `/support` and `/delete-account`. These paths were probes, not evidence of which URLs are currently entered in the consoles; an externally hosted policy would still need an in-app link. Both stores require accessible privacy information: [Apple 5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage), [Google User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en). Apple also requires usable contact information under [1.5](https://developer.apple.com/app-store/review/guidelines/#developer-information).

**Change.** Publish policy and support pages identifying Timely and its actual operator/contact. Describe collection, purpose, processors, security, retention and deletion. Confirm backup/log retention instead of inventing a retention period. Link the pages before sign-in and in Settings. An external deletion page can lead into the existing authenticated web deletion flow, but must clearly explain the route and work without reinstalling the mobile app. See [Google's deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

**Data inventory starting point, not a completed store questionnaire:**

| Implemented data | Evidence and purpose | Declaration work |
| --- | --- | --- |
| Email, provider name/account ID; possible provider profile image | `packages/db/src/auth-schema.ts`; identity and authentication | Account-linked contact information and identifiers; confirm actual profile-image persistence |
| Task titles, notes, dates, recurrence, completion/history and preferences | Planner schema and authenticated sync | Account-linked user content used for planner functionality |
| Installation UUID, push token, platform, zone, language and reminder coverage | `apps/mobile/src/push.ts`; reminder delivery/sync | Inventory identifiers and notification-related data; distinguish local-only settings from server collection |
| Session IP address, user agent and timestamps; operational diagnostics | Auth schema and `docs/operations.md` | Confirm actual retention and use, then classify security/diagnostic information |
| Notification payload and email delivery data | Push dispatcher and auth mail sender | Review Expo/APNs/FCM and Resend processing, alongside Vercel/Neon and Inngest |

No advertising/tracking implementation was found in the reviewed app code. SDK/provider processing still requires review; account-linked data is not anonymous merely because it is used for functionality. Apple provides [data categories and disclosure guidance](https://developer.apple.com/app-store/app-privacy-details/); Google requires the Data safety form to agree with actual processing and the policy.

Build 5 contains 18 privacy manifests, including an app manifest with required-reason API entries, `NSPrivacyTracking=false`, and an empty `NSPrivacyCollectedDataTypes` array. This does **not** establish that the app collects no data, and is not proof that its App Store privacy label is wrong: that label was not inspected. `app.config.ts` does not configure `ios.privacyManifests`, and generated native folders are ignored by Git. Make app-level declarations reproducible and inspect the aggregate archive privacy report. The installed SDK's [Expo 57 config reference](https://docs.expo.dev/versions/v57.0.0/config/app/#privacymanifests) supports this field.

**Verify.** Open the policy/support/deletion links while signed out, in both interface languages, and on both platforms. Follow the external deletion page through real recent authentication and confirmed deletion on an isolated test backend; confirm another account is unaffected. Compare final console answers, processor behavior and the final signed archive/AAB. Do not test deletion against an owner's real account.

### Permissions and entitlements — R09

**Observed.** An isolated configuration-only copy, without the existing native folders or `.env.local`, still generates `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`; storage permissions are capped at API 32. These are not `MANAGE_EXTERNAL_STORAGE` or modern broad photo permissions. The first release has no attachments or shared-storage feature. `POST_NOTIFICATIONS` and boot handling are supplied by the notifications library; internet/vibration serve actual app behavior.

Clean iOS introspection also includes dev-launcher local-network/Bonjour settings, an arbitrary-load ATS allowance and a generic Face ID string. Introspection does not prove the final release carries those settings: the inspected build 5 explicitly has `NSAllowsArbitraryLoads=false`, `NSAllowsLocalNetworking=true`, no local-network purpose string and a Face ID purpose string. The app does not request biometric SecureStore access in the reviewed calls.

**Change.** Use tracked Expo configuration/plugins to remove unused store permissions and developer-only behavior. Keep legitimate notification permissions; do not add exact-alarm or other special access merely to satisfy an imagined checklist. Check the final merged manifests rather than treating debug output or config introspection as release proof. Do not weaken the existing HTTPS API validation.

**Verify.** Inspect a clean release AAB's merged manifest and the final IPA's plist/entitlements. Confirm reminders work after denial and later opt-in, with no overlay, storage or biometric prompt. Inspect iOS distribution APNs entitlement after signing; the development entitlement in config introspection is not distribution evidence. Follow the installed [Expo notification documentation](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).

### Monetization

No IAP, subscriptions, payment links or paywalls were found in the app scope/dependencies reviewed. Purchase and restore testing is not applicable to this release. Do not add a billing framework for submission.

### Account and authentication — R02, R04

**Observed.** The production capability endpoint returns `{"google":true,"apple":false}`. `apps/mobile/src/sign-in.tsx:104` uses that Apple flag; `packages/auth/src/server.ts:48` needs both Apple Service ID and client secret. The client implements native Apple ID-token exchange but configuration alone does not prove it works.

**Change.** Supply the approved provider's `APPLE_SERVICE_ID`, current `APPLE_CLIENT_SECRET`, correct `APPLE_BUNDLE_ID` (`com.example.timely.dev` for the existing app record), registered HTTPS callback and matching App ID capability. Keep private keys/client secrets on the server. Check first authorization, repeat authorization with absent name/email, Hide My Email, cancellation, restored sessions and relay delivery. The existing Google/Apple provider decision remains unchanged.

In-app account deletion already exists in Settings → Manage account. The server validates a real owner-bound session created within five minutes, then cascades the user and owned data. Native cleanup pauses synchronization, queues notification cleanup and clears the active account. These are implemented controls, with historical database evidence, not a new signed-device proof.

However, `packages/db/src/account.ts:28` deletes directly through SQL and cannot invoke an auth-provider revocation hook. `apps/mobile/src/auth.ts:68` discards Apple's authorization code; only the ID token and nonce are sent. No server exchange/revocation path was found. Apple's [account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) calls for revoking Sign in with Apple tokens.

**Change.** Implement a server-side code exchange and durable revocation handling that survives provider failure and does not lose revocation credentials during the cascade. Keep network calls outside short database transactions. Provide an understandable recent-auth recovery path; the current screen tells users to sign in again but does not start reauthentication there. Explain actual offline-device and backup deletion limits in the policy.

**Verify.** On a signed physical iPhone with a disposable account, complete Apple authorization, deletion, provider-failure retry and new authorization after deletion. Confirm tasks, sessions, device registrations and pending remote reminders are removed for that account only. Use isolated development fixtures for failure injection. Android Apple browser authorization and both platforms' Google signing identities also remain acceptance gates.

### Content, user content and external links

The reviewed app stores private personal plans without a public feed, user messaging or content sharing. Social moderation/report/block features are not required additions for the current product. Public legal/support/deletion destinations remain necessary. Generic task notes do not turn the planner into a medical or financial service; avoid adding unsupported claims in listing copy.

### Technical stability and performance — R07, R08

**Observed.** The saved build 5 IPA has identity `com.example.timely.dev`, version/build `0.1.0 (5)`, SDK `iphoneos26.2`, Xcode value `2620` and minimum iOS `16.4`. Its SHA-256 matches the recorded release hash. The current Xcode and iPhone SDK are also 26.2. Apple currently requires Xcode 26+/iOS SDK 26+ and an iOS deployment target of 13+; these inspected values pass those narrow requirements.

The installed React Native version catalog specifies target/compile SDK 36, minimum SDK 24, AGP 8.12.0 and NDK 27.1.12297006. The existing merged **debug** manifest confirms target 36/minimum 24. Google currently requires API 36 for new phone apps and updates. A final Android release manifest was not available.

The generated local Android `build.gradle` uses the debug keystore even for its release build type. EAS can inject proper release credentials, so this is not proof that EAS production signing is broken. There is no reviewed release AAB/signature/Play acceptance evidence. No Android submit profile is required when uploading manually; its absence is not itself a policy violation. Google's [signing guidance](https://developer.android.com/studio/publish/app-signing) and Expo's [first-upload guide](https://docs.expo.dev/submit/android-manual/) describe the relevant preparation.

React Native/Hermes/SQLite include native libraries, so check both ELF alignment and APK packaging plus runtime on 16 KB pages. Do not infer compatibility from the SDK version or a JavaScript export. Google's current [16 KB guidance](https://developer.android.com/guide/practices/page-sizes) states the compatibility requirement for API 35+ apps and an update-release enforcement date of **1 February 2027**; this review does not substitute an older deadline.

**Change and verify.** Prepare a signed AAB with the existing approved backend, confirm package/upload key, register the actual Android OAuth SHA identities, configure FCM v1 and test a signed physical Android build. Also use a 16 KB emulator/device (`adb shell getconf PAGE_SIZE` must return `16384`) and APK Analyzer/alignment checks. Run offline cold-start/edit/reconnect, notification permission/delivery/cancellation/termination, Android Back, large text, screen readers, landscape and the existing two-account/two-device matrix. Device evidence remains required under the project contracts.

The last documented App Store draft is `1.0`, while config and build 5 are `0.1.0`. Verify current console state before changing either; the public record and selected build must correspond. Preserve the existing bundle ID/app record rather than renaming an already-uploaded app. Apple [associates uploads using bundle ID and version](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

### UX and reviewability — R05, R08

**Observed.** Email OTP expires in 300 seconds; password sign-in is disabled. No reusable review access procedure was demonstrated. A code from the owner or an owner's inbox is not a reliable review process. Google explicitly requires [reusable access independent of expiring OTP](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-EN). Apple requests full access under its [review preparation/completeness guidance](https://developer.apple.com/app-store/review/guidelines/#before-you-submit).

**Change and verify.** Prepare a dedicated, least-privilege review account with realistic synthetic plans and a durable login method the reviewer can use independently. Prove it from a clean install and another location/session, then put the instructions and credentials only in each store's private review fields. Do not introduce a universal OTP, hidden client bypass or fake-success backend. The specific durable authentication mechanism needs a scoped implementation decision if existing supported provider access cannot satisfy review.

The five saved Spanish iPhone/iPad screenshot hashes all match their manifest. Visual inspection of iPhone Day and iPad Month confirms actual planner UI with synthetic tasks. Those screenshots were documented as accepted in the Apple draft; acceptance/current placement was not rechecked. The beta descriptions explicitly say beta: prepare public-release wording before using them as public listing copy. Prepare actual Android screenshots, a Play icon and feature graphic against [Google's asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

Verify both consoles' support/privacy/contact information, target audience, ratings, territories and release controls; do not infer them from source. Apple uses its [updated age-rating questionnaire](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/). For personal Google developer accounts created after 13 November 2023, production access may require a closed test with at least **12 continuously opted-in testers for 14 days**, followed by an application for production access. Account type/date are unverified; this is conditional, not a universal requirement. See [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).

## 4. Reviewer experience checklist

| Reviewer action | Current result |
| --- | --- |
| Install and launch | Prior signed iOS artifacts/uploads documented; build 5 processing/access not freshly verified. Store-signed Android unverified. |
| Understand first run | Native branding, planner purpose and Spanish/English choice implemented. Explain account-backed sync in review notes. |
| Deny notifications | Permission is optional and requested through reminder interaction in code; final signed-device denial test open. |
| Reach planner independently | Blocked until reusable reviewer access is demonstrated. |
| Create/repeat/complete/move/search tasks | Implemented; historical tests/screenshots exist. Repeat the core loop on the final signed artifacts. |
| Purchase/restore | Not applicable. |
| Open policy and contact support | Fails in-app availability; probed public destinations return 404. |
| Delete account | In-app handler exists; Apple revocation and external Play destination unfinished. |
| Restart offline and sync later | Implemented and partly tested historically; final physical iOS/Android matrix still open. |

## 5. Suggested reviewer notes — draft, not ready to paste

Replace the bracketed fields and verify every claim before saving these notes. Keep actual credentials out of Git and this report.

> Timely is a personal planner with account-backed synchronization. First sign-in/download needs internet; downloaded plans can then be edited offline and synchronize after reconnection. There are no purchases, subscriptions, advertising or public sharing features.
>
> Review access: [dedicated review account and independently reusable login steps, supplied privately]. This account contains only synthetic plans. [Confirm access is reusable and has no expiring OTP dependency.]
>
> Choose English on the sign-in screen if needed. Open Planner, choose Day/Week/Month, and use Add task to create a plan. Task details include repeat schedules, priority and optional reminders. Complete or move a task through its controls. Review shows history; Search finds plans.
>
> Notifications are optional. Settings → Reminders controls the daily summary and individual task reminder defaults. The daily summary sends one quiet reminder for unfinished plans; permissions can be denied without blocking planning.
>
> Settings → Manage account → Delete account starts account deletion. [Insert verified recent-auth steps.] Privacy: [verified HTTPS URL]. Support: [verified HTTPS URL]. External deletion: [verified HTTPS URL, for Google Play].

For Google Play, also save English login instructions in App content → Sign-in details/App access. For Apple, populate the private App Review account/contact fields. An instruction to contact the owner for a code is not a completed access plan.

## 6. Next pass and verification handoff

The next implementation pass should address R01/R03 together, then R02/R04 and R05, finish R06/R09, and prepare R07/R08 artifacts and acceptance. This review changed documentation only. Existing engineering stages remain open; the current release review does not mark stage 09 complete.

| External item | State | Exact evidence/setup needed |
| --- | --- | --- |
| Apple provider | `blocked_external` | Server Apple Service ID, current client secret, matching bundle audience and registered callback; signed physical sign-in/relay evidence. Never place private keys in the client or report. |
| Store consoles | `blocked_external` for verification | Current App Store Connect app/version/build/labels/review fields; Google Play developer account/app record, account type, signing/production-access status and content forms. No console was opened in this pass. |
| Android auth/push/signing | `blocked_external` | Registered Android OAuth package/SHA identities, FCM v1 credentials in the approved secret store, release upload-key/EAS signing access and a physical test device. |
| Public policy/contact | Content/setup needed | Confirm operator/privacy-support contact and actual processor/backup/log retention; implement pages locally before seeking publication authorization. |
| Reviewer access | Implementation/setup needed | Dedicated review identity and proven reusable access; keep secrets in store review fields. |

Checks performed on this working tree:

| Command/check | Actual result |
| --- | --- |
| `pnpm --filter @timely/mobile typecheck` | Pass. |
| `pnpm --filter @timely/mobile exec expo install --check` | Pass using the installed Expo dependency map; networking disabled, so online version validation was unavailable. |
| `pnpm exec vitest run tests/mobile-api-url.test.ts tests/api.test.ts tests/sqlite-store.test.ts tests/expo-push.test.ts tests/daily-summary-push.test.ts` | Five files / **26 tests pass**. A nonfatal Expo base-tsconfig resolution warning appeared. These are API-boundary, local-persistence and reminder/config tests, not physical-device or new real-DB deletion proof. |
| `xcodebuild -version`; `xcrun --sdk iphoneos --show-sdk-version` | Xcode 26.2 / SDK 26.2; sandbox FSEvents/cache warnings did not fail the commands. |
| Existing build 5 IPA plist, manifests and SHA-256 | Values recorded above; hash `ad50d00b38ad54d0549c3f6c3c9cbe7e026a3dc53e5e3124ae7e408378fa6324`. No new signature validation/upload. |
| Production GET probes | Provider flags `google=true, apple=false`; `/privacy`, `/support`, `/delete-account` all 404. Initial sandbox DNS failure was resolved with an approved read-only network retry. |
| Production Expo introspection, existing native folders and isolated config-only copy | Pass. Both inspected without regenerating the working tree's native projects. Outputs in `/tmp/timely-store-review-{config,clean-config}.json`; temporary project `/tmp/timely-store-review-ktjm251f`. These are config inspection, not signed builds. |
| Screenshot manifest SHA-256 verification | Five of five match. Two representative images visually inspected. |
| `git diff --check`; documentation local-link check | Pass; all local Markdown destinations in the four changed documents exist. |
| Skill CLI discovery | `npx --yes skills find app-store-review` failed with registry DNS `ENOTFOUND`; upstream skill was subsequently found and read through the web tool. No installation needed. |

Reproduce the public checks without credentials:

```sh
curl --fail --silent --show-error https://timely-mauve-five.vercel.app/api/v1/auth/providers
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://timely-mauve-five.vercel.app/privacy
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://timely-mauve-five.vercel.app/support
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://timely-mauve-five.vercel.app/delete-account
```

Release preparation after fixes: run the project checks and signed-device matrix in [release checklist](../release-checklist.md), [native verification](../mobile-verification.md) and [stage 09](../planner/stages/09_QA_RELEASE.md). Prepare the iOS archive with a matching public version and unused build number. Prepare Android through `eas build --platform android --profile production` only after the signing/environment setup and build-service usage are authorized; use a local build if appropriate. A first Google Play upload is manual, and any later EAS submission service-account key belongs in protected credentials. Uploading/submitting/publishing remains a separate owner-authorized action; none is requested by this audit.
