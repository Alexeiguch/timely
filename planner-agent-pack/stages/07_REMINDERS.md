# Stage 07 — offline reminders and durable push

## Goal and dependencies

Deliver opted-in reminders and cancellation through the domain, local persistence and native builds. Stages 02–04 and 06 are required; web changes also invalidate schedules. Read [notifications](../NOTIFICATIONS.md), [recurrence/time](../RECURRENCE_AND_TIME.md) and [architecture](../ARCHITECTURE.md).

## Implement

1. Wire task Warn me/before/overdue choices and synchronized defaults into the shared reminder planner.
2. Add context-sensitive notification permission request and platform-settings recovery. Permission denial must not stop task creation or imply a scheduled reminder.
3. Implement the native local scheduler adapter, stable identity/native-ID mappings, rolling seven-day plan, 48-entry initial budget and actual scheduled-entry reconciliation.
4. Write a durable notification side-effect queue for cancellation/rescheduling after local edits. Recover from crashes between native SDK calls and local metadata updates.
5. Register device tokens, capability and zone; report only successfully scheduled local coverage. Implement the local/remote ownership transition and stale schedule-version handling.
6. Implement Postgres reminder jobs and transactional invalidation outbox processing in Inngest. Add a due/reconciliation sweep at a verified cadence appropriate for the approved timing. Recheck state/version/coverage immediately before send.
7. Add push provider dispatch, sanitized receipts, invalid-token handling, bounded transient retries and conservative handling of uncertain send results. Never promise exactly-once visible delivery.
8. Add notification tap routing to the current occurrence state. If implementing Complete/Move actions, use durable authenticated/offline commands, not a separate mutation shortcut. Verify native categories/actions rather than assuming support.
9. Add foreground in-app cues and an overdue review path to web/mobile. Do not introduce browser Web Push as an undeclared release dependency.
10. Add understandable reminder coverage/status to Settings and service/job monitoring to operations documentation.

## Timing and cancellation checks

Use a controlled clock and seeded task examples, then verify actual native behavior:

- Task 10:00, duration 45 minutes: before 09:30, overdue 10:55.
- Task 10:00, no duration: before 09:30, overdue 10:10.
- No time/duration-only: 09:00 same-day reminder; overdue at next-day start; next-day 09:00 alert.
- Reminder enabled after its before-time has passed: do not send a stale before alert.
- Complete/Skip/Delete cancels locally immediately and remotely after committed sync.
- Move/edit/series update/preferences/zone change cancels old versions and schedules only current ones.
- Reopen plans future eligible reminders rather than replaying every missed alert.

## Real-device failure verification

Test offline creation and scheduling, offline completion/cancellation, terminated app, foreground/background presentation, permission revocation, token change, system focus restrictions, a week of dense reminders and device-zone changes. Simulators/Expo Go are not sufficient for all push gates.

Test local/remote handoff during crashes and network loss; routine coverage must prevent equivalent remote sends. Completing on web while a phone is disconnected may leave an already-native-scheduled stale alert until reconciliation; document that narrow limitation and ensure the tap shows current task status.

## Acceptance and handoff

- Opted-in tasks produce the approved plans; non-opted-in and terminal tasks produce none.
- Local entry mappings survive restart and stale entries are removed safely.
- Server jobs survive process failures and cancel/expire by state/version.
- There is no routine same-device local/remote double delivery.
- No overnight untimed overdue spam or backlog flood after a long outage.
- Push tokens, auth/session material and private notes are absent from user-facing diagnostics/logs.
- Actual iOS/Android evidence and remaining OS/provider limits are documented.

Update progress with worker cadence/plan assumptions, device results and receipt examples without private payloads. An unverified remote push provider remains a release blocker, not a reason to fake delivery.
