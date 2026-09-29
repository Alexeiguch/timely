# Instructions for implementation agents

## Product and authority

Implement the personal planner described in `docs/planner/README.md` and its linked contracts. The supplied design is a required product direction. This file governs agent execution; it is not app copy.

Honor the owner's latest instructions. Resolve ordinary engineering choices yourself. Ask a focused question only when an unresolved choice would materially change product behavior, expose another user's data, incur an unapproved purchase, or replace an approved provider. Continue work that does not depend on the answer. Do not repeatedly ask for approval for local development, normal migrations in disposable development databases, or reversible fixes within the authorized task.

## Read and execute

1. Inspect existing repository instructions and code before scaffolding.
2. Read the canonical planner contracts, `docs/progress.md`, and relevant architecture decisions.
3. Work on the first incomplete stage whose dependencies are met.
4. Implement usable end-to-end behavior, not just static screens or mocks.
5. Run the stage's meaningful checks. Capture actual results and limitations.
6. Update progress and decisions before switching stages or handing off.

Use a supported compatible dependency set and a committed lockfile. Inspect official documentation for the installed versions. Do not copy old API shapes blindly. Do not use arbitrary `latest` versions independently across Expo, React, React Native and native modules.

## Engineering boundaries

- Shared domain code owns recurrence, task state, time conversion, reminder planning and sync ordering.
- Components call use cases/repositories; they do not write SQL, generate recurrence or independently define overdue logic.
- All database access occurs behind authenticated server handlers. Never put `DATABASE_URL`, Apple private keys, provider secrets or mail API keys in web/native bundles.
- Every server query and mutation checks the authenticated owner. Client `user_id` is not authority.
- Validate request and stored payloads. Keep transactions short and idempotent.
- Local user mutations and outbox writes are atomic. A network error must not erase a saved edit.
- Use immutable occurrence identities; moving a task never changes its identity.
- Preserve terminal history when changing a recurring series.
- Never replace real authentication or remote persistence with fake success to pass a gate.

## Quality and scope

Use strict TypeScript. Prefer small coherent modules and explicit names. Avoid needless frameworks, generic abstractions with one use case, premature optimization and giant components. Build the smallest complete implementation of each contract.

Test business behavior, synchronization failure paths and authentication boundaries. Do not add tests that only restate rendering implementation. Use realistic dates, time zones, recurrence exceptions, two-account and two-device fixtures. Use accessible interaction semantics on both platforms.

No collaboration, SMS, payments, attachments, calendar import/export, widgets or AI task generation in the first release. Do not add features just because a dependency supports them.

## External dependencies and verification

List the exact missing credential or account when external verification is blocked. Provide executable setup steps and a runnable development path. Mark the affected gate `blocked_external`; proceed with independent stages, and revisit the gate when credentials arrive. A blocked integration is not a completed integration.

Use native development builds to verify platform-specific sign-in and notifications. Expo Go, simulators and stubbed OAuth are insufficient evidence for all production gates. Do not place real credentials or OTPs in logs, screenshots or progress files.

Prepare deployment configuration and release artifacts within authorized scope. Publishing, DNS changes, store submissions and paid purchases need the owner's authorization for that action; local release preparation should be finished before requesting it.

## Handoff and interruption

Before a context limit, execution limit or session end, save:

- Current stage and last completed milestone.
- Files changed and useful commit/branch identifiers.
- Commands run and their actual outcomes.
- Failing checks, external blockers and reproduction steps.
- The exact next action and relevant document links.

Do not claim that a rate-limited agent will automatically resume on a particular date. Leave durable progress so any later session or agent can resume. Do not overwrite uncommitted user changes, reset a repository, rewrite published history, or delete user data to simplify a handoff.
