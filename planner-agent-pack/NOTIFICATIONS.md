# Reminder delivery and cancellation

## Product timing

Warn me is task-level opt-in. Before and overdue reminders can be switched independently. Default timed reminders are **30 minutes before the effective start** and **10 minutes after the due boundary**, where duration determines the boundary when present. Defaults may be changed in Settings and optionally overridden per task.

Untimed/duration-only tasks use a same-day morning reminder at **09:00 local time** initially and an overdue reminder at the configured morning time on the following local day. The task becomes overdue at the beginning of that following day; the notification intentionally waits until morning. This is distinct from the +10-minute timed rule.

Completed, skipped and deleted occurrences have no pending reminder plan. Reopening recomputes only future reminder instants. Rescheduling, recurrence changes, time-zone changes and preference edits invalidate and rebuild the affected plan.

If a before-reminder time is already past when a task is created/moved or a device returns online, do not send it retroactively. An overdue reminder missed during a temporary outage may be sent once if it is no more than 60 minutes late, the occurrence is still pending and permissions/preferences permit it. Older reminders expire. Show an in-app overdue list rather than flooding the user with a backlog.

## Channels and assumptions

First release: mobile system notifications plus foreground web/mobile in-app cues. Browser system Web Push is a later feature, not a hidden requirement for the full web planner. Task/reminder configuration remains available on web and synchronizes to mobile.

Use local scheduled notifications for offline-capable delivery. Use backend remote push for reminders that a recipient device does not own locally, and for best-effort sync/reconciliation cues. Do not schedule the same reminder through both channels hoping the client always deduplicates after presentation.

The OS controls actual notification permission, delivery timing, focus modes and background execution. The app can calculate intended times and schedule/cancel requests; it cannot guarantee presentation at an exact minute on every device. Record/test behavior without promising an alarm-clock service.

## Pure reminder planner

`packages/domain` computes zero or more planned reminder records from occurrence state, resolved schedule, task/user policy, device zone and injected now. Each plan includes occurrence UUID, reminder kind, due UTC instant and a schedule fingerprint/version. Keep mobile and server planning identical.

Stable identity is `(device_id, occurrence_id, reminder_kind, schedule_version)`. Include this identity in notification data/deep links and server job idempotency keys. A schedule change yields a new version; old versions are stale and may not be sent.

## Local scheduling

Use the current expo-notifications API and platform permissions. Maintain a rolling next-seven-day horizon and an initial budget of at most **48 pending local notifications** per installation, prioritizing the nearest times. This is an application budget; inspect actual OS limits/capabilities in the native build and adjust conservatively.

When there are more reminders than the budget, do not silently lose them. Schedule nearest reminders locally, show coverage/status in Settings, and leave remaining eligible reminders to the remote path while online. Without connectivity and without local coverage, those later reminders cannot be guaranteed; explain the coverage horizon concisely.

Persist the association between plan identity and native notification identifier. Reconcile by comparing the desired plans with both stored mappings and actual OS scheduled entries. Cancel stale entries, add missing entries, remove duplicate entries and then update coverage. Run on creation/edit/state change, foreground, reconnect, zone/permission changes and successful sync. Keep a durable retry queue for interrupted scheduling calls.

Offline completion cancels the current device's schedules immediately. Its outbox later tells the server and other clients. Cancel all relevant native entries on sign out or account deletion. Do not delete another account's entries accidentally when multiple namespaces are supported.

## Remote ownership and deduplication

After successfully scheduling a local reminder, the device reports coverage for that exact occurrence/kind/version and intended instant. The server suppresses the equivalent remote job for that device while valid coverage applies. Scheduling failure reports no coverage; permission denial disables delivery. Other devices have their own independent policies and coverage.

Avoid a handoff gap: prepare/report local ownership before enabling a competing remote dispatch, and use a canonical delivery-state transition that the worker checks. Because local scheduling and network transactions cannot be atomic, test crashes and reconnects during handoff, reconcile by identity, and favor keeping the established channel until the new ownership is acknowledged.

If a locally owned phone becomes offline, do not expire its claim solely because a heartbeat is stale and send a duplicate visible push for the same scheduled plan. Coverage remains associated with the plan until explicit cancellation, a known schedule change or its scheduled instant. After an owned reminder's instant passes, mark that version locally handled/elapsed rather than making it eligible for a late remote fallback. Do not turn expired coverage into a duplicate remote retry. A schedule change on another device invalidates the server version but cannot erase a native offline schedule immediately.

Cross-device stale alerts are an unavoidable limited case: if a task is completed on web while a phone is disconnected, that phone cannot know until sync/reconciliation. Use push/background cues where allowed, revalidate on tap/foreground, and clearly distinguish this limitation from cancellation on the device that made the change. Do not claim an already-delivered notification can be recalled from another disconnected device.

## Server job processing

Write reminder creation/invalidation events into the Postgres job outbox in the same transaction as task changes. Inngest processes events and a periodic reconciliation/due sweep at a verified suitable cadence. Use durable records rather than per-task in-memory timeouts.

Before sending, the worker authenticates its service call, claims the job atomically, rechecks owner/device/permission/token, active occurrence state, latest schedule version, coverage and due/expiry. Use retries only for transient failures and process push receipts. Disable tokens identified as unregistered; do not retry them forever.

Exactly-once visible remote delivery cannot be guaranteed if a provider accepts a message and the response is lost. Use stable job keys, bounded retries, receipt tracking and conservative retry decisions for uncertain sends. Do not describe this as a proof of exactly-once OS presentation.

Remote device-zone reporting happens on launch/foreground and sync. If the server has an old zone because a terminated/offline device travelled, it can only use that last-known zone until updated. Local/native scheduling should be tested for OS zone behavior, followed by explicit reconciliation when the app runs.

## Interaction and permission UX

Ask for notification permission when the user enables Warn me, with a short explanation. Do not force the permission prompt on first launch. Denial leaves the planner usable and the reminder preference visible as unavailable on this device. Provide a platform-settings action where supported.

Tapping an alert opens the exact occurrence; if it is completed/deleted, show its current state instead of reintroducing stale work. Support **Complete** and **Move to today** notification actions where tested and usable. They use the same durable command path and can work offline; actions must not create anonymous writes or duplicate tasks.

Use concise copy, avoid private notes in notification previews, and make lock-screen content configurable if implemented. Start with title/time content only. Badge count, if enabled, represents a documented locally known count and is recalculated; platform badge support varies.

## Required verification

- Timed examples with and without duration; untimed morning and next-morning cases.
- Before toggle, overdue toggle and global default changes.
- Completion, skip, deletion, reopen, reschedule and series-scope edit cancellation.
- Offline create/complete and termination/relaunch with native scheduled entries.
- Multiple devices, coverage handoff, stale-version job claims and no routine local/remote duplicate.
- Permission denial/revocation, invalid push token and provider response-loss handling.
- Local zone changes and DST; native actions and deep-link account checks.
- Delivery in foreground/background/terminated states on real iOS and Android development builds.
- Budget exhaustion, delayed jobs, a long offline period, and no reminder backlog flood.
