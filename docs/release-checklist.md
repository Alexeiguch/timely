# First-release acceptance checklist

These gates remain reviewable preparation, not permission to publish. Current implementation/evidence: [progress](progress.md), [QA](qa-evidence.md), [release readiness](release-readiness.md).

The [Apple App Store / Google Play review dated 2026-10-15](app-store/submission-review-2026-10-15.md) records confirmed issues, current official requirements and checks. Public release readiness is blocked on both stores; earlier TestFlight uploads do not close these gates.

- [ ] Public privacy/support pages identify Timely and its operator/contact, describe actual processing/retention, and are linked before native sign-in and in Settings (R01).
- [ ] Production Apple sign-in is enabled alongside Google and passes signed physical first/repeat/Hide My Email tests (R02).
- [ ] Google Play's external account deletion URL works without reinstalling the app and leads to a real deletion/request flow (R03).
- [ ] Apple authorization credentials are exchanged/stored only on the server and revoked reliably during account deletion, including provider-failure retry (R04).
- [ ] Store reviewers have independently reusable access, English instructions and synthetic plans, with credentials kept out of the repository (R05).
- [ ] App Privacy / Data safety answers, SDK processing and reproducible privacy manifests agree with actual data collection (R06).
- [ ] Final signed Android AAB has the correct package/upload key, target API 36+, inspected permissions, 16 KB compatibility evidence and signed-device authentication/reminder acceptance (R07/R09).
- [ ] Public version matches the selected iOS build; both stores' listing assets, contacts, ratings/content declarations and any conditional Play closed-testing/production-access gates are verified (R08).
- [ ] Clean signed release artifacts exclude unused permissions/developer settings and retain appropriate HTTPS/push configuration (R09).

- [ ] All canonical stage acceptance criteria have current evidence; engineering gaps are closed.
- [ ] Frozen-lockfile installation, workspace checks, production web build and hosted CI pass.
- [ ] Actual IndexedDB and SQLite upgrades preserve pending operations, identity, clocks and staged bootstrap.
- [ ] Representative 1,000-task account meets measured startup, sync, query and scrolling targets on supported devices.
- [ ] Overlapping scopes, response loss, expired cursors, account switch and two-device conflicts converge without lost terminal history.
- [ ] Keyboard, focus restoration, screen readers, 200% web zoom, large native text, landscape and Android Back pass.
- [ ] Real Google and Apple consent/token exchange/session restoration/cancellation pass on required platforms.
- [ ] Hosted verified mail, production HTTPS callbacks, registered app IDs and signing are configured.
- [ ] Local and remote reminders pass permission, offline/terminated cancellation, budget, zone/DST and handoff tests on physical iOS/Android.
- [ ] Push receipt, invalid-token, response-loss and bounded retry policies pass; approved Inngest cadence/plan is recorded.
- [ ] Account deletion, last-sign-in-method protection/linking and private-cache/bundle/log review pass.
- [ ] Backup restoration, checkpoint/retention and compatible rollback are rehearsed without touching production user data.
- [ ] Final signed native artifacts, web release identifier, store metadata/privacy information and supported-device matrix are prepared.
- [ ] Owner explicitly authorizes the concrete publication, production migration, DNS and store submission actions that are ready for review.
