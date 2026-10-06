# First-release acceptance checklist

These gates remain reviewable preparation, not permission to publish. Current implementation/evidence: [progress](progress.md), [QA](qa-evidence.md), [release readiness](release-readiness.md).

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
