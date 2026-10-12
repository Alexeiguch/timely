# API diagnostics, reminder fairness and shared overdue selection

2026-10-12. The owner requested fixes after reviewing hidden server failures, inconsistent overdue lists, reminder worker failures and maintainability/security gaps.

## Behavior

Unexpected API exceptions return `500 / INTERNAL_ERROR`; recognized connection and PostgreSQL availability failures return `503 / TEMPORARY_UNAVAILABLE`. Server diagnostics include the existing request ID, method/path, allowlisted error classifications and bounded code locations. They omit error messages, query strings, SQL, task content, OTPs, credentials and owner/device identifiers. The sync engine keeps the authored outbox, uses backoff, and shows Needs attention for HTTP failures; transport/network failures show Offline. Non-JSON error responses retain their HTTP classification, and malformed successful JSON is a protocol error.

Web and mobile call `overdueOccurrences` in the domain package. Previous-day catch-up references appear only in today's Day view, use shared status/due calculation, preserve occurrence identity and sort consistently. The existing bounded past-year projection remains; the web still labels older history as unloaded.

The reminder worker isolates owner reconciliation, dispatch claims/sends and receipt transaction failures, reporting aggregate failure counts and sanitized run-correlated diagnostics. A thrown send is uncertain because provider acceptance may already have happened; it is never automatically replayed. Infrastructure-wide failures still fail the worker invocation for its existing retry mechanism.

Migration `0005_aberrant_masque` adds an owner-scoped reconciliation table with cascading account deletion. One query combines pending invalidations and rolling device coverage, deduplicates owners before selecting fifty, and orders by least recent attempt, oldest work and owner. Conditional upserts lease selected owners for one minute across workers. Crashed leases expire; owner failures persist exponential backoff from one minute to one hour. Success resets retry state atomically with canonical reconciliation. A delayed failure cannot overwrite a newer lease. The shared `lockOwner` serializes sync and notification mutations through the original sync head.

## Security and structure

The web root uses dynamic rendering and a fresh cryptographic nonce in request/response CSP headers. Next applies the rendering nonce to its own scripts. Production permits neither script `unsafe-inline` nor `unsafe-eval`; development permits eval for debugging. React layout style attributes remain allowed. Production HSTS has a one-year max-age without opting unrelated subdomains into the policy. The service worker cache advances to v4 and caches the public shell with its matching nonce/header pair; it still omits credentials when fetching the shell and never caches private API responses. Non-page CSP permits same-origin connections so service worker fetches remain functional.

Pinned ESLint 10.12.0, @eslint/js 10.0.1, typescript-eslint 8.71.1 and React Hooks 7.1.1 run before the existing boundary guard. Hook dependency fixes preserve account scoping and use stable native reload/reminder callbacks. Database suites run serially when enabled because the worker selects across owners and parallel suites would consume each other's synthetic fixtures.

Task cards, grouped series, month grid, settings, review and history filters are six separate components; account browser navigation is a hook. The main web component is 912 lines, down from the 1,546-line working copy inspected before changes. Focused static classes group native notification access, push request helpers, database notification records and canonical operation fingerprinting. Existing function exports stay compatible. No user-owned uncommitted changes were reset.

## Verification and rollout

All 203 unit/SQLite/PostgreSQL cases pass with integration gates enabled against a newly created, separate local database `timely_review_20261012`. Migration application, all ten workspace type checks, lint/boundaries, frozen offline lockfile validation, production web build and all 28 desktop/320px Chrome cases pass. Browser cases cover real local mail-capture sign-in, two accounts/devices, identity-preserving edits, IndexedDB migration, offline reload/reconnect, settings/history and parser-injected script rejection. iOS and Android Hermes production exports pass to `/tmp/timely-review-expo-export` (3,340 / 3,476 modules).

This is local verification, not hosted rollout or renewed physical-device notification evidence. Apply the additive migration to an approved target before deploying the worker code. Existing external provider, hosted worker and physical-device acceptance gates remain open; see [release readiness](../release-readiness.md). The owner subsequently authorized the hosted migration, GitHub push and production rollout; these completed with preserved existing data, green CI and live verification. See [rollout evidence](../progress.md#authorized-review-rollout--2026-10-12). No store submission or purchase was performed.
