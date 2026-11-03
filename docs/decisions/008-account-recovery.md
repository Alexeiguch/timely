# Account lifecycle and exceptional-operation recovery

Account deletion uses a confirmed online handler and the actual Better Auth session ID. Inside a transaction it requires an owner-bound unexpired session created within five minutes. Session refresh time is not proof of recent authentication. Deleting the owner cascades planner records, snapshots, queued jobs, installations, provider accounts and all sessions; another account's records remain untouched. Device removal is owner-scoped and serialized with push. Clients pause their sync engine before destructive cleanup, purge their account namespace only after success, and resume if the request fails.

The planner request limiter uses the existing auth rate-limit table with a separate `planner:` key. An atomic PostgreSQL upsert enforces the same per-owner fixed minute across server processes. It replaces the process-local map without adding a provider or credentials.

An invalid atomic batch is retried in singleton order before a command is marked blocked. Settings offers retry with the same operation UUID and confirmed discard of every pending command for that definition. Discarding dependents together avoids leaving edits targeting a discarded offline creation. Other definitions, canonical shadows and logical clocks remain intact. Sign-out offers a separate explicitly confirmed unsynced-discard option; online device/session removal finishes before local purge. Failed sign-out preserves the outbox.

Web actions use the same durable commands as native. State changes, moves and scoped deletes offer an eight-second Undo using newer inverse commands. Keyboard Move and untimed reorder complement week/month date drops; only the period heading recognizes horizontal touch gestures. Validated per-account navigation is restored and reflected in the URL. Linked occurrences are resolved inside the current account; a URL owner value never grants access.

## Reauthentication entry and deletion wording — 2026-10-19

Settings → Manage account now opens the existing sign-in flow on web and native before deletion, without signing out or clearing pending local edits. Web remembers the session being reauthenticated: refreshing that same session must not close sign-in; a new session completes the flow. Users can return to saved plans without authenticating. The server's five-minute recent-auth requirement and destructive confirmation remain authoritative.

Deletion copy describes removal from the service and explicitly acknowledges that disconnected devices can retain local copies. No remote wipe or backup-retention promise is made. Apple token revocation remains a separate unfinished integration; this UI change does not satisfy that release gate.

## Public help and deletion entry — 2026-10-20

Public `/privacy`, `/support` and `/delete-account` routes use the existing language layer and design tokens. The deletion page leads to the real web account-management flow; visiting it never mutates account data. Sign-in and Settings expose the links on web and native, using the native installation's configured backend origin. Public routes receive the same nonce-based HTML security policy as the planner.

The owner requested authored pages but has not supplied a public operator identity/contact or verified retention periods. Privacy is therefore visibly a draft, support states that its contact is not yet configured, and deletion explains known active-database/offline-copy behavior without promising backup or provider-record erasure. These are implemented local pages, not completed store policy gates. Before publication, replace the draft disclosures with verified facts and review provider processing and Apple revocation. The browser entry follows [Google's external deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en); it is not a claim of store acceptance.
