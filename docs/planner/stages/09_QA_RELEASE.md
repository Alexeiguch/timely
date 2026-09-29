# Stage 09 — integrated QA, operations and release preparation

## Goal and dependencies

Turn the implemented planner into a reviewable release with real evidence and maintainable operations. All previous stages must be implemented; unresolved external auth/push gates remain explicit release blockers. Read every canonical contract and current progress before declaring completion.

## Integrated acceptance matrix

| Area | Required evidence |
| --- | --- |
| Auth | Apple/Google/email OTP by platform, restoration, expiry and account isolation |
| Planner | Quick Add, Day/Week/Month, dates, priority, completion, skip and Undo |
| Recurrence | Custom rules, invalid dates, previews, all scopes and retained history |
| Reschedule | One-tap/menu/drag, stable identity, original date and unchanged cadence |
| Offline | Both apps reload/restart offline, persist edits and later sync |
| Conflicts | Reordered/duplicate delivery, different-group merge, same-group latest winner |
| History | Overdue catch-up, monthly grouping and correct Review denominators |
| Notifications | Timing, local/remote ownership, cancellation and actual device delivery |
| Settings | Preferences, time zone, first weekday, permissions and account lifecycle |
| Design | Exact palette/fonts, rounded cards, responsive layout, reduced motion and access |

Run meaningful suites once the final changes are in place; rerun affected checks after fixes. Avoid repetitive broad testing without a new reason. Use a versioned QA evidence document with commands, build/dependency versions, devices, screenshots and outcomes. A screen recording is useful for gestures and offline flows; sanitized screenshots suffice for static layout.

## Required failure and scale checks

- Browser offline reload, native force-close offline and subsequent convergence with the other client.
- Offline series edit versus remote completion; old revision/excluded slots not recreated.
- Session expiry, database wake-up/unavailability, response loss after commit and duplicate worker invocation.
- Two accounts and installations; wrong-owner deep links/API targets rejected.
- Cursor expiration, interrupted bootstrap, local schema upgrade with outbox and tombstone retention.
- Clock rollback/skew, London DST changes, travel zones and overnight durations.
- Dense reminders beyond the local budget, stale remote versions and invalid push tokens.
- A seeded account with at least 1,000 authored tasks/records and multiple long-lived recurring series. Measure initial download, date navigation, search, local edits and sync batch behavior on a representative device.

Use measured budgets rather than unverifiable claims. Aim for immediate local feedback, bounded range queries, no long main-thread recurrence expansion and no full-list rerender on every toggle. Record hardware/fixture size and fix clear regressions. Do not optimize away correctness or accessibility.

## Security and data review

Check session/owner authorization, input validation, callback/trusted-origin setup, token/audience/nonce checks, practical rate limits, secret bundling, log redaction and account-deletion cleanup. Review migrations and query indexes. Dependency checks should identify material vulnerabilities in the installed set without speculative warnings in product copy.

Validate offline/private-cache behavior and shared-device sign out. Keep user task content out of service-worker public caches and telemetry. Ensure notification taps/actions check current identity and state. Document data retention, backups and recovery without claiming guarantees unsupported by the selected plan.

## Release deliverables

Write:

1. `docs/setup.md`: reproducible installation, environment variables, database/auth/mail/native setup and smoke checks.
2. `docs/deployment.md`: staging/production Vercel configuration, Neon environment/branch strategy, migrations, Inngest worker/cadence, mail sender, EAS build profiles and provider callbacks.
3. `docs/operations.md`: sync lag/job lag/mail/push metrics, token cleanup, error diagnosis, local-cache recovery and backup/restore checks.
4. `docs/release-checklist.md`: actual pass/blocked gates, final build artifacts and owner actions.
5. `docs/qa-evidence.md`: integrated test and visual evidence, with no credentials/private content.

Prepare production env templates and application-store metadata/privacy descriptions from implemented behavior. Do not submit/publish/change DNS or buy a plan without authorization. Prepare a concrete tested release so any required owner approval is the final step.

Rollback plans must consider DB compatibility and outstanding offline clients. Favor additive schema/protocol changes; do not immediately drop fields used by older installs. Stage new protocol versions and cursor-expiry/rebootstrap behavior. An application rollback does not automatically undo destructive migrations.

## Completion report

Report what users can now do on web/mobile, the chosen auth/storage architecture, the actual tests/devices checked, design evidence and any remaining external blockers. Clearly separate implemented, tested and deployed. List the exact owner action for each blocker and leave the next command/reproduction step in progress.

The application is release-ready only when the mandatory auth, sync, history and notification gates have real evidence. Calendar integrations, widgets and richer analytics remain documented future ideas, not unfinished first-release work.
